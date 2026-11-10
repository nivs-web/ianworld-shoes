/**
 * 캐릭터 움직임 섞기 (움직임 규칙서 v2 6장 · 화면 전용)
 *
 * 그림(겜팀장)은 동작별 프레임을 주고, 여기서 "언제 어떤 프레임"을 정한다 :
 *  - 쉬기 idle0 ↔ idle1 0.5초마다 (숨쉬기) · 쉬는 중 2~5초마다 blink0 0.12초 (눈 깜빡임)
 *  - 걷기 walk0~3 — 이동 빠르기에 맞춰 초당 6~10장
 *  - 공격 atk0(준비) → atk1(타격 0.1초) → atk2(마무리) — 선딜 · 후딜 시간에 맞춤
 *  - 맞음 kb0 + 1프레임 하얗게 번쩍
 *  - **엇박자** : 캐릭터마다 시작 위상 · 깜빡임 간격이 달라 줄지어 걸어도 똑같이 안 움직인다
 * 아직 v2 프레임이 없는 그림은 옛 이름으로 대신한다 (walk2→walk0, idle1→idle0 …).
 */
const FALLBACK = {
  idle1: ['idle0'], blink0: ['idle0'], walk2: ['walk0'], walk3: ['walk1'], walk1: ['walk0'],
  atk2: ['atk0', 'idle0'], atk1: ['atk0', 'idle0'], atk0: ['idle0'], kb0: ['idle0'],
  roar0: ['atk0', 'idle0'], roar1: ['atk1', 'atk0', 'idle0'], breath0: ['idle0'], breath1: ['breath0', 'idle0'],
};

export function makeFramePicker(T, has) {
  /** prefix + 동작 → 있는 텍스처 (없으면 대신할 것) */
  return (prefix, a) => {
    if (has(`${prefix}/${a}`)) return T(`${prefix}/${a}`);
    for (const b of FALLBACK[a] || []) if (has(`${prefix}/${b}`)) return T(`${prefix}/${b}`);
    return T(`${prefix}/idle0`);
  };
}

/**
 * 캐릭터 하나의 움직임 상태. state 는 바깥(전투 화면)이 정해 준다 : 'idle' | 'walk' | 'fore' | 'hit' | 'back' | 'kb' | 'roar' | 'breath'
 */
export function createAnim(prefix, pick, { speed = 80 } = {}) {
  const A = {
    prefix, state: 'idle', t: Math.random() * 3,          // 위상 엇박자
    blinkAt: 2 + Math.random() * 3, blinkT: 0, flashT: 0, hitT: 0,
    walkFps: Math.max(6, Math.min(10, speed / 11)),
    set(state) { if (state !== A.state) { A.state = state; A.st = 0; } },
    flash() { A.flashT = 0.06; },
    /** dt 초만큼 진행하고 지금 보여 줄 텍스처를 돌려준다 */
    frame(dt) {
      A.t += dt; A.st = (A.st || 0) + dt;
      if (A.flashT > 0) A.flashT -= dt;
      switch (A.state) {
        case 'walk': return pick(prefix, `walk${Math.floor(A.t * A.walkFps) % 4}`);
        case 'fore': return pick(prefix, 'atk0');
        case 'hit': return pick(prefix, 'atk1');
        case 'back': return pick(prefix, A.st < 0.12 ? 'atk1' : 'atk2');
        case 'kb': return pick(prefix, 'kb0');
        case 'roar': return pick(prefix, Math.floor(A.st * 6) % 2 ? 'roar1' : 'roar0');
        case 'breath': return pick(prefix, A.st < 0.5 ? 'breath0' : 'breath1');
        default: {
          A.blinkAt -= dt;
          if (A.blinkAt <= 0) { A.blinkT = 0.12; A.blinkAt = 2 + Math.random() * 3; }
          if (A.blinkT > 0) { A.blinkT -= dt; return pick(prefix, 'blink0'); }
          return pick(prefix, Math.floor(A.t * 2) % 2 ? 'idle1' : 'idle0');
        }
      }
    },
  };
  return A;
}
