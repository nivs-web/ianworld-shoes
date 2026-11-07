/**
 * 줄넘기 챔피언 · ROPE BEAT — 멀티 서바이벌 규칙 (순수 계산 · node 시험). (2026-11-07)
 *
 * > 권반장: «멀티 게임을 하면 마지막까지 줄이 안 걸리고 살아남는 사람이 이기는 거야»
 *
 * - 최대 8명 · 같은 곡 · 같은 채보(방 seed) · 같은 시작 시각(방 startAt, 서버 시각).
 * - 하트 3개. **줄에 걸리면(JUMP MISS) −1**, ROPE MISS 는 콤보만 끊긴다. 하트 0 = 탈락 → 관전.
 * - 라운드(8마디)마다 빨라진다: 100 → 120 → 140 → 160 → 180 → 190 → 200(끝까지).
 * - 마지막 한 명이 남으면 끝. 거의 같이(1.5초 안) 탈락하면 점수가 높은 사람이 위.
 * - 주고받는 값은 각자 «내 칸»만: lives · score · jc(콤보) · alive · deadAt · done · jl(모습).
 *   입력 하나하나는 보내지 않는다(비용 원칙 docs/NEW_GAME_RULES.md). 판정은 각자 자기 화면에서(오디오 시각).
 */

export const SURVIVAL = {
  hearts: 3,
  roundBars: 8,
  bpms: [100, 120, 140, 160, 180, 190, 200],
  bars: 200,             // 채보 길이(마디) — 200 BPM 이 되면 거기서 계속(이 안에 거의 다 걸린다)
  staleMs: 25000,        // 생존 신호가 이만큼 끊기면 나간 것으로 본다
  tieMs: 1500,           // 이 안에 같이 걸리면 «동시 탈락» — 점수로 가른다
  publishMs: 1000,       // 내 상태를 올리는 간격
};

/** 라운드 n(0부터)의 BPM */
export const roundBpm = (n) => SURVIVAL.bpms[Math.min(SURVIVAL.bpms.length - 1, Math.max(0, n))];
/** 마디 → 라운드 번호 */
export const roundAt = (bar) => Math.max(0, Math.floor(bar / SURVIVAL.roundBars));

/** 서바이벌 템포 지도 — 라운드 경계에서 **갑자기** 빨라진다(같은 마디에 점 두 개) */
export function survivalTempo(bars = SURVIVAL.bars) {
  const t = [{ bar: 0, bpm: roundBpm(0) }];
  for (let r = 1; r * SURVIVAL.roundBars <= bars; r++) {
    const bar = r * SURVIVAL.roundBars;
    if (roundBpm(r) === roundBpm(r - 1)) continue;
    t.push({ bar, bpm: roundBpm(r - 1) }, { bar, bpm: roundBpm(r) });
  }
  return t;
}

/** 방 기록의 한 사람 → 화면용 */
function seat(uid, p, nowMs) {
  const seenAt = Number(p.seenAt) || 0;
  const stale = !!nowMs && seenAt > 0 && nowMs - seenAt > SURVIVAL.staleMs;
  const lives = Math.max(0, Math.min(SURVIVAL.hearts, p.lives ?? SURVIVAL.hearts));
  const alive = p.alive !== false && lives > 0 && !stale && !p.out;
  return {
    uid,
    nickname: String(p.nickname || '???').slice(0, 16),
    lives: alive ? lives : 0,
    score: Math.max(0, Number(p.score) || 0),
    combo: Math.max(0, Number(p.jc) || 0),
    look: typeof p.jl === 'string' ? p.jl : '',
    alive,
    stale,
    deadAt: alive ? 0 : (Number(p.deadAt) || (stale ? seenAt : 0) || Number(p.offAt) || nowMs || 0),
  };
}

/**
 * 순위 — 살아 있는 사람(점수 순) → 탈락한 사람(늦게 걸린 순, 1.5초 안이면 점수 순).
 * 모든 화면이 같은 방 기록으로 같은 답을 낸다(결정적).
 */
export function rankSeats(seats) {
  const alive = seats.filter((s) => s.alive).sort((a, b) => b.score - a.score || a.uid.localeCompare(b.uid));
  const dead = seats.filter((s) => !s.alive).sort((a, b) => {
    if (Math.abs(a.deadAt - b.deadAt) > SURVIVAL.tieMs) return b.deadAt - a.deadAt;
    return b.score - a.score || a.uid.localeCompare(b.uid);
  });
  return [...alive, ...dead];
}

/**
 * 방 한 장 → 지금 판의 상태.
 * @param {object} room RTDB 방 기록
 * @param {number} nowMs 서버 시각(ms) — 끊긴 사람 가리기
 * @returns {{ seats, ranking, aliveCount, total, over, winner }}
 *   over: 두 명 이상이 시작했는데 한 명 이하만 남았다(또는 모두 걸렸다).
 */
export function survivalStatus(room, nowMs = 0) {
  const players = room?.players || {};
  const seats = Object.entries(players)
    .filter(([, p]) => p && !p.waiting)
    .map(([uid, p]) => seat(uid, p, nowMs));
  const ranking = rankSeats(seats);
  const aliveCount = seats.filter((s) => s.alive).length;
  const total = seats.length;
  const over = total >= 2 ? aliveCount <= 1 : total === 1 ? aliveCount === 0 : false;
  return { seats, ranking, aliveCount, total, over, winner: over ? (ranking[0]?.uid || null) : null };
}

/** 내 모습 한 줄 (방에 싣는 jl) — 꾸미기 코드 + 줄넘기 아이디 */
export const lookLine = (lookCode, ropeId) => `${String(lookCode || '').slice(0, 16)}|${String(ropeId || 'red').slice(0, 20)}`;
export function parseLook(jl) {
  const [look, rope] = String(jl || '').split('|');
  return { look: look || '', rope: rope || 'red' };
}
