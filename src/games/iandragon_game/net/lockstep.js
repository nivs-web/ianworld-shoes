/**
 * 명령 락스텝 (3차 멀티 · 2026-11-11 · 기획 IAN_DRAGON_MULTI_PLAN.md 3장) — 서버 · 화면을 모르는 순수 계산.
 *
 * 버튼을 누르면 «실행 틱 = 지금 틱 + 지연(12틱 = 0.4초)» 으로 약속하고, 0.2초마다 묶음(lk 문자열)을 방에 쓴다.
 * 묶음 = «약속 틱 | 해시 잰 틱:해시 | 순번:실행 틱:명령, …(최근 20개)».
 *   약속 틱 T = «T 이전에 실행될 내 명령은 더 없다». 받는 쪽은 모든 자리가 약속한 틱까지만 계산한다 → 늦게 온 명령으로 어긋날 수 없다.
 *   최근 20개를 매번 다시 보낸다 → 묶음 몇 개를 놓쳐도 명령이 사라지지 않는다(순번으로 중복 거름).
 * 같은 틱 명령 순서 = 자리 번호 → 순번 (두 기기가 같은 순서).
 * 명령 글자 : s0~s9 출격(덱 칸) · w 화로 · b 브레스 · k0 k1 스킬 · r 포효
 */

export const DELAY = 12;          // 입력 지연 (틱)
const KEEP = 20;                  // 묶음에 다시 넣는 최근 명령 수

/** 코어 명령 { type, i } ↔ 글자 */
export function encodeCmd(c) {
  if (c.type === 'spawn') return 's' + c.i;
  if (c.type === 'wallet') return 'w';
  if (c.type === 'breath') return 'b';
  if (c.type === 'skill') return 'k' + c.i;
  if (c.type === 'rage') return 'r';
  return null;
}
export function decodeCmd(s) {
  const t = s[0], n = Number(s.slice(1));
  if (t === 's' && n >= 0 && n <= 9) return { type: 'spawn', i: n };
  if (t === 'w' && s.length === 1) return { type: 'wallet' };
  if (t === 'b' && s.length === 1) return { type: 'breath' };
  if (t === 'k' && (n === 0 || n === 1)) return { type: 'skill', i: n };
  if (t === 'r' && s.length === 1) return { type: 'rage' };
  return null;
}

/**
 * @param {{ seat:number, seats:number, delay?:number }} o  seat = 내 자리(0부터), seats = 사람 수
 */
export function createLockstep({ seat, seats, delay = DELAY }) {
  const promised = Array(seats).fill(delay - 1);   // 자리마다 «이 틱까지는 명령이 다 왔다» (처음 지연 구간은 명령이 있을 수 없다)
  const cmds = Array.from({ length: seats }, () => new Map());   // 자리 → 순번 → { tick, c }
  const hashes = Array.from({ length: seats }, () => new Map());   // 자리 → 틱 → 해시
  const mine = [];                 // 내가 보낸 최근 명령 { seq, tick, s }
  let seq = 0;

  return {
    seat, seats,
    /** 내 버튼 → 실행 틱을 약속하고 기억 (돌려주는 값 = 실행 틱) */
    press(cmd, nowTick) {
      const s = encodeCmd(cmd); if (s == null) return -1;
      const tick = Math.max(nowTick + delay, promised[seat] + 1);
      seq++; mine.push({ seq, tick, s }); if (mine.length > KEEP) mine.shift();
      cmds[seat].set(seq, { tick, c: { p: seat, ...cmd } });
      return tick;
    },
    /** 0.2초마다 방에 쓸 묶음. hash = [잰 틱, 해시] (없으면 생략) */
    packet(nowTick, hash) {
      promised[seat] = Math.max(promised[seat], nowTick + delay - 1);
      const h = hash ? `${hash[0]}:${hash[1]}` : '';
      if (hash) hashes[seat].set(hash[0], String(hash[1]));
      return `${promised[seat]}|${h}|${mine.map((m) => `${m.seq}:${m.tick}:${m.s}`).join(',')}`;
    },
    /** 다른 자리의 묶음 받기 (같은 것을 여러 번 받아도 된다 · 이상한 글자는 버린다) */
    receive(from, str) {
      if (from === seat || from < 0 || from >= seats || typeof str !== 'string' || str.length > 600) return false;
      const [p, h, list] = str.split('|');
      const pt = Number(p);
      if (list) for (const part of list.split(',')) {
        const [q, t, s] = part.split(':'); const qn = Number(q), tn = Number(t), c = decodeCmd(s || '');
        if (!c || !(qn > 0) || !(tn >= 0) || cmds[from].has(qn)) continue;
        cmds[from].set(qn, { tick: tn, c: { p: from, ...c } });
      }
      if (h) { const [ht, hv] = h.split(':'); if (Number(ht) >= 0) hashes[from].set(Number(ht), hv); }
      if (Number.isFinite(pt) && pt > promised[from]) promised[from] = pt;
      return true;
    },
    /** 이 틱을 계산해도 되나 (모든 자리가 이 틱까지 약속했나) */
    ready(tick) { return promised.every((p) => p >= tick); },
    /** 이 틱에 넣을 명령 — 자리 번호 → 순번 순 */
    commandsAt(tick) {
      const out = [];
      for (let s = 0; s < seats; s++) {
        const list = [...cmds[s].entries()].filter(([, v]) => v.tick === tick).sort((a, b) => a[0] - b[0]);
        for (const [, v] of list) out.push(v.c);
      }
      return out;
    },
    /** 같은 틱 해시 비교 — 다르면 그 판은 어긋남(무효) */
    mismatch() {
      for (const [t, h] of hashes[seat]) for (let s = 0; s < seats; s++) if (s !== seat && hashes[s].has(t) && hashes[s].get(t) !== h) return t;
      return -1;
    },
    /** 상대가 얼마나 늦었나 (틱) — 화면의 «연결 확인 중» 표시용 */
    lag(nowTick) { return Math.max(0, nowTick - Math.min(...promised)); },
    /** 오래된 명령 지우기 (메모리) */
    forget(beforeTick) { for (const m of cmds) for (const [k, v] of m) if (v.tick < beforeTick) m.delete(k); },
  };
}
