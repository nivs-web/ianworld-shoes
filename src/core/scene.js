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

/**
 * 스택을 통째로 비운다. **판이 끝나 DOM 화면으로 나갈 때 반드시 부른다.**
 *
 * 예전에는 부르는 곳이 없었다. `Scene.reset()` 은 게임을 **시작할 때만** 불렸고,
 * 끝날 때는 `nav.reset(Lobby)` 로 DOM 화면만 바꿨다. 그래서 죽은 `GameScene` 이
 * 스택에 그대로 남아 세 가지 사고를 냈다:
 *
 *   1. **멀티 결과 화면에서 사망 효과음이 났다.** 상대가 먼저 죽어 내가 살아 있는 채로
 *      결과 화면에 가면 스택 맨 위가 여전히 GameScene 이라 `update()` 가 계속 돈다 —
 *      게이지가 마저 닳고 0이 되는 순간 `sfx_death` 가 결과 화면에서 울렸다.
 *   2. **로비·도감·명예의 전당을 보는 내내 인게임을 60fps 로 그렸다.** `display:none`
 *      이라 눈에만 안 보일 뿐 드로우 콜은 그대로 나갔다 (프레임당 700회 넘는 fillRect).
 *   3. `exit()` 이 안 불려 탭·일시정지 핸들러와 멀티 방 구독이 살아남았다.
 */
export function clear() {
  while (stack.length) {
    const cur = stack.pop();
    cur?.scene.exit?.();
  }
}

/** 스택을 비우고 새 씬으로 시작한다 (게임 시작 등). */
export function reset(scene, params = {}) {
  clear();
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
