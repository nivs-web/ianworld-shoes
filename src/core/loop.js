/**
 * 고정 타임스텝 게임 루프. (CLAUDE.md §3-4)
 *
 * update()는 항상 정확히 1/60초 단위로 호출된다. → 물리/이동이 프레임레이트와 무관하다.
 * render()는 보간하지 않는다. 마지막 update 상태를 그대로 그린다.
 */

export const FPS = 60;
export const FIXED_DT = 1000 / FPS;

/** 탭 전환 등으로 프레임이 밀렸을 때 한 번에 따라잡을 최대 시간(ms) */
const MAX_CATCHUP = 100;

let running = false;
let rafId = 0;
let last = 0;
let acc = 0;
let frame = 0;

/**
 * @param {(dt:number)=>void} update 고정 스텝 업데이트 (dt는 항상 FIXED_DT)
 * @param {()=>void} render 그리기
 */
export function startLoop(update, render) {
  if (running) stopLoop();
  running = true;
  last = performance.now();
  acc = 0;

  const tick = (now) => {
    if (!running) return;
    rafId = requestAnimationFrame(tick);

    let delta = now - last;
    last = now;
    if (delta > MAX_CATCHUP) delta = MAX_CATCHUP; // 스파이크 클램프

    acc += delta;
    while (acc >= FIXED_DT) {
      update(FIXED_DT);
      acc -= FIXED_DT;
      frame++;
    }

    render();
  };

  rafId = requestAnimationFrame(tick);
}

export function stopLoop() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

export function isRunning() {
  return running;
}

/** 부팅 이후 누적된 고정 프레임 수. 애니메이션 타이밍 기준으로 쓴다. */
export function frameCount() {
  return frame;
}

/** 탭이 백그라운드로 가면 루프를 멈춰 배터리를 아낀다. */
export function bindVisibility(onHide, onShow) {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      onHide?.();
    } else {
      last = performance.now(); // 복귀 시 델타 폭주 방지
      acc = 0;
      onShow?.();
    }
  });
}
