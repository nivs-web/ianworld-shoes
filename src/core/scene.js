/**
 * 씬 스택. 인게임(Canvas)과 메뉴(DOM)를 같은 방식으로 다룬다.
 *
 * Scene 인터페이스 (전부 선택):
 *   enter(params)  씬 진입
 *   exit()         정리 (이벤트 해제 필수)
 *   update(dt)     고정 스텝 갱신 — Canvas 씬만 구현
 *   render()       그리기 — Canvas 씬만 구현
 *   pause()/resume() 위에 다른 씬이 쌓였을 때
 */

/** @type {Array<{scene:object,params:any}>} */
const stack = [];

function top() {
  return stack.length ? stack[stack.length - 1] : null;
}

export function push(scene, params = {}) {
  const cur = top();
  cur?.scene.pause?.();
  stack.push({ scene, params });
  scene.enter?.(params);
}

export function pop() {
  const cur = stack.pop();
  cur?.scene.exit?.();
  top()?.scene.resume?.();
  return cur?.scene ?? null;
}

/** 현재 씬을 교체한다 (되돌아갈 필요가 없을 때). */
export function replace(scene, params = {}) {
  const cur = stack.pop();
  cur?.scene.exit?.();
  stack.push({ scene, params });
  scene.enter?.(params);
}

/** 스택을 비우고 새 씬으로 시작한다 (로비 복귀 등). */
export function reset(scene, params = {}) {
  while (stack.length) {
    const cur = stack.pop();
    cur?.scene.exit?.();
  }
  push(scene, params);
}

export function current() {
  return top()?.scene ?? null;
}

export function depth() {
  return stack.length;
}

/** 루프에서 호출. 최상단 씬만 갱신한다. */
export function updateCurrent(dt) {
  top()?.scene.update?.(dt);
}

/**
 * 루프에서 호출.
 * 스택 전체를 아래에서 위로 그린다 → 일시정지 화면이 게임 위에 겹쳐 보인다.
 */
export function renderAll() {
  for (const entry of stack) entry.scene.render?.();
}
