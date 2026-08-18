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

export function makeFb(db, uid) {
  const dbMod = {
    serverTimestamp: () => ({ ...SV }),
    ref: (_db, p = '') => ({ path: String(p) }),
    query: (r, ...mods) => ({ ...r, mods }),
    orderByChild: (k) => ({ t: 'order', k }),
    equalTo: (v) => ({ t: 'eq', v }),
    limitToFirst: (n) => ({ t: 'limit', n }),

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
      if (r.path === '.info/connected') { cb({ val: () => true }); return () => {}; }
      const l = { path: r.path, cb, err };
      db.listeners.push(l);
      cb({ val: () => db.read(r.path) });
      return () => { db.listeners = db.listeners.filter((x) => x !== l); };
    },

    async set(r, v) {
      await tick();
      if (!allow(db, uid, r.path, v)) { db.denyLog.push({ op: 'set', path: r.path, uid }); throw new Error('PERMISSION_DENIED ' + r.path); }
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

    onDisconnect(r) {
      return {
        remove: async () => { db.disconnects.set(r.path, uid); return true; },
        cancel: async () => { db.disconnects.delete(r.path); return true; },
      };
    },
  };
  return { rtdb: db, dbMod };
}

const tick = () => new Promise((res) => setTimeout(res, 0));
