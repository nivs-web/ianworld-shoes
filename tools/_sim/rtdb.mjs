/**
 * 메모리 RTDB (진단 전용).
 *
 * 실기기 2대가 없으면 "둘 다 나가기" 같은 순서 버그를 재현할 방법이 없다.
 * 그래서 서버를 흉내 낸다 — **경로 · 멀티패스 update · onValue · 서버 시각 ·
 * 권한(잎마다 내 것만)** 까지. 여기서 재현되는 것만 진짜 버그로 취급한다.
 */

/**
 * 시계는 **클라이언트와 서버가 같은 것을 본다.**
 * `Date.now()` 를 갈아 끼워서 "2분이 지났다"를 즉시 만들 수 있게 한다 —
 * 그래야 부활 창(20초)·생존 신호 끊김(60초) 같은 시간 규칙을 검사할 수 있다.
 */
const REAL_NOW = Date.now();
const CLOCK = { base: REAL_NOW, skew: 0 };
export const clock = CLOCK;
export const now = () => CLOCK.base + CLOCK.skew;
export const advance = (ms) => { CLOCK.skew += ms; };
Date.now = now;

const SV = { '.sv': 'timestamp' };
const isSv = (v) => v && typeof v === 'object' && v['.sv'] === 'timestamp';

export class FakeDb {
  constructor() {
    this.data = {};
    this.listeners = [];       // {path, cb, err}
    this.disconnects = new Map();
    /** uid → 접속 상태 (없으면 붙어 있는 것) */
    this.online = new Map();
    this.log = [];             // {op, path, uid, ok}
    this.denyLog = [];
  }

  // ── 경로 유틸 ──
  static parts(p) { return String(p).split('/').filter(Boolean); }

  read(path) {
    let cur = this.data;
    for (const k of FakeDb.parts(path)) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = cur[k];
    }
    return cur === undefined ? null : clone(cur);
  }

  /** 실제 서버처럼: 빈 객체는 존재하지 않는 것으로 접는다 */
  prune(path) {
    const parts = FakeDb.parts(path);
    for (let i = parts.length; i > 0; i--) {
      const p = parts.slice(0, i);
      let cur = this.data, parent = null, key = null;
      for (const k of p) { parent = cur; key = k; cur = cur?.[k]; }
      if (cur && typeof cur === 'object' && !Array.isArray(cur) && Object.keys(cur).length === 0) {
        delete parent[key];
      }
    }
  }

  write(path, value) {
    /* 서버 증가(`increment(n)`) — 지금 값에 더한다 (2026-11-04, 운영자 통계) */
    const inc = value && typeof value === 'object' && value['.sv'] && typeof value['.sv'].increment === 'number'
      ? value['.sv'].increment : null;
    if (inc !== null) value = (Number(this.read(path)) || 0) + inc;
    const parts = FakeDb.parts(path);
    if (!parts.length) { this.data = clone(value) ?? {}; return; }
    let cur = this.data;
    for (const k of parts.slice(0, -1)) {
      if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
      cur = cur[k];
    }
    const last = parts[parts.length - 1];
    if (value === null || value === undefined) delete cur[last];
    else cur[last] = clone(value);
    this.prune(parts.slice(0, -1).join('/'));
  }

  fill(v) {
    if (isSv(v)) return now();
    if (Array.isArray(v)) return v.map((x) => this.fill(x));
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v)) o[k] = this.fill(v[k]);
      return o;
    }
    return v;
  }

  notify(changedPath) {
    for (const l of [...this.listeners]) {
      if (changedPath === l.path || changedPath.startsWith(l.path + '/') || l.path.startsWith(changedPath + '/') || l.path === '') {
        l.cb({ val: () => this.read(l.path) });
      }
    }
  }

  /**
   * **소켓이 끊겼다** — 그 사람이 걸어 둔 `onDisconnect` 예약을 서버가 실행한다.
   * 폰에서 전화를 받아 페이지가 얼어붙는 상황을 이걸로 재현한다.
   */
  dropConnection(uid) {
    this.online.set(uid, false);
    this.notify('.info/connected');
    for (const [key, d] of [...this.disconnects]) {
      if (d.uid !== uid) continue;
      this.disconnects.delete(key);
      if (d.op === 'remove') this.write(d.path, null);
      else if (d.op === 'set') this.write(d.path, this.fill(d.value));
      else if (d.op === 'update') {
        for (const [k, v] of Object.entries(d.value ?? {})) this.write(`${d.path}/${k}`, this.fill(v));
      }
      this.notify(d.path);
    }
  }

  /** 다시 붙었다 — 클라이언트가 자리 지킴을 새로 걸고 끊김 표시를 지운다 */
  restoreConnection(uid) {
    this.online.set(uid, true);
    this.notify('.info/connected');
  }
}

function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

/**
 * 규칙 흉내 — 실제 규칙 전부는 아니고, **이 시뮬레이터가 검사하려는 것**만 본다.
 *
 * RTDB 의 두 층을 그대로 흉내 낸다:
 *   ① **쓰기 권한(.write)** — 경로 위쪽 어디서든 통과하면 아래는 전부 열린다.
 *      그래서 방 참가자는 `result/given` 도 쓸 수 있다(부활 판돈이 이 경로다).
 *   ② **검증(.validate)** — 남의 참가자 칸은 초기값 되돌리기 말고는 못 바꾼다.
 */
function allow(db, uid, path, newValue) {
  const parts = FakeDb.parts(path);
  if (parts[0] === 'stats') return statsOk(db, uid, parts, newValue);
  if (parts[0] !== 'rooms') return true;
  const code = parts[1];
  const room = db.read(`rooms/${code}`);
  const sub = parts.slice(2);
  if (!room) return true;                                   // 새 방 만들기

  const member = !!room.players?.[uid];
  const 내참가자노드 = sub[0] === 'players' && sub[1] === uid;
  const 내정산경로 = sub[0] === 'result' && ['given', 'settled', 'claims'].includes(sub[1]) && sub[2] === uid;
  const 방통째로내가들어감 = !sub.length && !!newValue?.players?.[uid];

  // ① 쓰기 권한
  let granted = member || 내참가자노드 || 방통째로내가들어감;
  if (!granted && 내정산경로) {
    // 방 밖에서는 순위가 박힌 방에만 낼 수 있고, 판돈 회수(지우기)는 언제나 된다
    if (sub[1] === 'settled' || sub[1] === 'claims') granted = !!room.result?.rankings;
    else granted = !!room.result?.rankings || newValue === null;
  }
  if (!granted) return false;

  // ② 검증 — 남의 참가자 칸은 **초기값으로 되돌리기**만 된다 (다음 판 준비)
  if (sub[0] === 'players' && sub[1] && sub[1] !== uid) {
    const 초기값 = (v) => v === 0 || v === false || v === true || v === null || isSv(v);
    if (newValue && typeof newValue === 'object' && !Array.isArray(newValue)) {
      const 옛값 = room.players[sub[1]] ?? {};
      const RESET = { ready: false, stairs: 0, shoesFound: 0, alive: true };
      for (const [k, v] of Object.entries(newValue)) {
        if (k in RESET) { if (v !== RESET[k]) return false; continue; }
        if (isSv(v)) continue;                       // seenAt 등 서버 시각
        if (JSON.stringify(v) !== JSON.stringify(옛값[k])) return false;
      }
      return true;
    }
    if (!초기값(newValue)) return false;
  }
  // 남의 정산 칸
  if (sub[0] === 'result' && ['given', 'settled', 'claims'].includes(sub[1]) && sub[2] && sub[2] !== uid) return false;
  return true;
}


/**
 * ★ **남의 참가자 칸 — 진짜 규칙의 칸별 검증을 흉내 낸다.** (2026-11-04)
 *
 * 위 `allow` 는 경로 하나만 본다. 그런데 `resetRoom` 처럼 **방 통째로**(`rooms/{code}`)
 * 쓰면 그 아래 남의 칸은 아무도 안 봤다 — 진짜 서버는 바뀐 잎마다 `.validate` 를 돈다
 * (`docs/rtdb-rules.json`). 그래서 드래곤 방 "계속하기" 가 실서버에서는 거부되는데
 * 시뮬에서는 통과했다. 이제 쓰기 **전후의 방을 견줘** 남의 칸이 바뀐 것을 잡는다.
 *
 *   · 값이 그대로면 통과, 지워지는 것도 통과(지워진 잎에는 검증이 안 돈다)
 *   · ready/stairs/shoesFound/alive 만 **finished → waiting** (결과 없음) 일 때 초기값으로
 */
const RESETTABLE = { ready: (v) => typeof v === 'boolean', stairs: (v) => v === 0, shoesFound: (v) => v === 0, alive: (v) => v === true };
function othersOk(db, uid, writes) {
  const code = writes.map(([p]) => FakeDb.parts(p)).find((x) => x[0] === 'rooms' && x[1])?.[1];
  if (!code) return true;
  const before = db.read(`rooms/${code}`);
  if (!before?.players) return true;
  const tmp = new FakeDb();
  tmp.data = { rooms: { [code]: clone(before) } };
  for (const [p, v] of writes) tmp.write(p, v);
  const after = tmp.read(`rooms/${code}`);
  if (!after?.players) return true;
  const resetting = before.state === 'finished' && after.state === 'waiting' && !after.result;
  for (const [u, rec] of Object.entries(after.players)) {
    if (u === uid || !rec || typeof rec !== 'object') continue;
    const old = before.players[u];
    if (!old) continue;
    for (const [k, v] of Object.entries(rec)) {
      if (JSON.stringify(v) === JSON.stringify(old[k])) continue;
      if (k === 'seenAt' || k === 'offAt') continue;
      if (resetting && RESETTABLE[k]?.(v)) continue;
      return false;
    }
  }
  return true;
}

/**
 * ★ **운영자 통계 칸 규칙 흉내** (2026-11-05, `docs/rtdb-rules.json` 의 `stats`).
 * 서버 증가(`increment`)는 지금 값에 더한 **결과**로 검사한다(진짜 서버와 같다).
 * 특히 `live` 는 0 아래로 못 내려간다 — 운영에서 통계가 하나도 안 쌓인 원인이 이 규칙과
 * "끊기면 −1" 예약이 만난 것이었다(아래 `onDisconnect` 의 등록 시 검사).
 */
function statsOk(db, uid, parts, v) {
  const inc = v && typeof v === 'object' && v['.sv'] && typeof v['.sv'].increment === 'number' ? v['.sv'].increment : null;
  const old = db.read(parts.join('/'));
  const val = inc !== null ? (Number(old) || 0) + inc : v;
  const [, a, day, leaf, who] = parts;
  if (a === 'live') return typeof val === 'number' && val >= 0 && val <= 200000;
  if (a !== 'days' || !/^[0-9]{8}$/.test(day || '')) return false;
  if (leaf === 'u') return who === uid && old == null && val === true;
  if (leaf === 'n') return typeof val === 'number' && val === (Number(old) || 0) + 1;
  if (leaf === 'peak') return typeof val === 'number' && val > (Number(old) || 0) && val <= (Number(db.read('stats/live')) || 0);
  return false;
}

export function makeFb(db, uid) {
  const dbMod = {
    serverTimestamp: () => ({ ...SV }),
    increment: (n) => ({ '.sv': { increment: n } }),
    ref: (_db, p = '') => ({ path: String(p) }),
    query: (r, ...mods) => ({ ...r, mods }),
    orderByChild: (k) => ({ t: 'order', k }),
    equalTo: (v) => ({ t: 'eq', v }),
    limitToFirst: (n) => ({ t: 'limit', n }),
    /* 쪽지 팝업이 최근 N통만 받는다 (2026-11-04) — 가짜 서버는 거르지 않고 전부 준다 */
    orderByKey: () => ({ t: 'key' }),
    limitToLast: (n) => ({ t: 'limitLast', n }),

    async get(r) {
      await tick();
      if (r.path === '.info/serverTimeOffset') return { val: () => 0 };
      const val = db.read(r.path);
      if (!r.mods) return { val: () => val };
      // 방 목록 쿼리
      let rows = Object.entries(val ?? {});
      const order = r.mods.find((m) => m.t === 'order');
      const eq = r.mods.find((m) => m.t === 'eq');
      const lim = r.mods.find((m) => m.t === 'limit');
      if (order && eq) rows = rows.filter(([, v]) => v?.[order.k] === eq.v);
      if (lim) rows = rows.slice(0, lim.n);
      return {
        val: () => Object.fromEntries(rows),
        forEach: (f) => rows.forEach(([, v]) => f({ val: () => v })),
      };
    },

    onValue(r, cb, err) {
      if (r.path === '.info/connected') {
        /**
         * 예전에는 **항상 true 를 한 번만** 돌려줬다. 그러면 "끊겼다 다시 붙었다"를
         * 재현할 수 없어서, 재접속 때 자리 지킴을 다시 거는 코드가 검사 밖에 있었다.
         * 이제 진짜 상태를 들고 있고 `dropConnection`/`restoreConnection` 이 흔든다.
         */
        const l = { path: '.info/connected', cb: () => cb({ val: () => db.online.get(uid) !== false }) };
        db.listeners.push(l);
        l.cb();
        return () => { db.listeners = db.listeners.filter((x) => x !== l); };
      }
      const l = { path: r.path, cb, err };
      db.listeners.push(l);
      cb({ val: () => db.read(r.path) });
      return () => { db.listeners = db.listeners.filter((x) => x !== l); };
    },

    async set(r, v) {
      await tick();
      if (!allow(db, uid, r.path, v) || !othersOk(db, uid, [[r.path, db.fill(v)]])) { db.denyLog.push({ op: 'set', path: r.path, uid }); throw new Error('PERMISSION_DENIED ' + r.path); }
      db.write(r.path, db.fill(v));
      db.log.push({ op: 'set', path: r.path, uid });
      db.notify(r.path);
    },

    async remove(r) {
      await tick();
      if (!allow(db, uid, r.path, null)) { db.denyLog.push({ op: 'remove', path: r.path, uid }); throw new Error('PERMISSION_DENIED ' + r.path); }
      db.write(r.path, null);
      db.log.push({ op: 'remove', path: r.path, uid });
      db.notify(r.path);
    },

    /** 멀티패스 update — 하나라도 막히면 전부 거부된다 (진짜 서버와 같다) */
    async update(r, patch) {
      await tick();
      for (const k of Object.keys(patch)) {
        const full = k.includes('/') || true ? `${r.path}/${k}` : k;
        if (!allow(db, uid, full, patch[k])) {
          db.denyLog.push({ op: 'update', path: full, uid });
          throw new Error('PERMISSION_DENIED ' + full);
        }
      }
      if (!othersOk(db, uid, Object.keys(patch).map((k) => [`${r.path}/${k}`, db.fill(patch[k])]))) {
        db.denyLog.push({ op: 'update', path: r.path, uid });
        throw new Error('PERMISSION_DENIED (남의 칸) ' + r.path);
      }
      for (const k of Object.keys(patch)) db.write(`${r.path}/${k}`, db.fill(patch[k]));
      db.log.push({ op: 'update', path: r.path, uid, keys: Object.keys(patch) });
      db.notify(r.path);
    },

    async runTransaction(r, fn) {
      await tick();
      const cur = db.read(r.path);
      const next = fn(cur);
      if (next === undefined) return { committed: false };
      if (!allow(db, uid, r.path, next)) throw new Error('PERMISSION_DENIED ' + r.path);
      db.write(r.path, db.fill(next));
      db.log.push({ op: 'tx', path: r.path, uid });
      db.notify(r.path);
      return { committed: true };
    },

    /**
     * `onDisconnect` — 서버가 소켓이 끊긴 걸 감지했을 때 대신 실행할 예약.
     * 예전에는 `remove` 만 있었고 **아무도 발동시키지 않았다** — 그래서 "끊겼다"를
     * 검사할 방법이 없었다. 이제 `set` 도 받고, `db.dropConnection(uid)` 로 실제로
     * 발동시킬 수 있다(자리 지킴 `offAt` 을 검사하려면 이게 있어야 한다).
     */
    onDisconnect(r) {
      const put = (op, value) => {
        /**
         * ★ **예약하는 순간 규칙을 검사한다** — 진짜 서버와 같다 (공식 문서: "When you establish an
         * onDisconnect() operation ... The server checks security to make sure the user can perform
         * the write event requested, and informs your app if it is invalid"). 예전 가짜 서버는
         * 그냥 받아 줘서, 운영에서 통계가 0 으로 멈춘 버그를 시뮬이 못 잡았다 (2026-11-05).
         */
        if (op === 'set' && !allow(db, uid, r.path, value)) {
          db.denyLog.push({ op: 'onDisconnect.set', path: r.path, uid });
          return Promise.reject(new Error('PERMISSION_DENIED (onDisconnect) ' + r.path));
        }
        db.disconnects.set(`${uid}|${r.path}`, { path: r.path, uid, op, value });
        return Promise.resolve(true);
      };
      return {
        remove: () => put('remove'),
        set: (v) => put('set', v),
        update: (v) => put('update', v),
        cancel: () => { db.disconnects.delete(`${uid}|${r.path}`); return Promise.resolve(true); },
      };
    },
  };
  return { rtdb: db, dbMod };
}

const tick = () => new Promise((res) => setTimeout(res, 0));
