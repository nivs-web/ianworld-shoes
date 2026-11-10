/**
 * 가로 전용 지킴이 (기획서 11.0 · 대표님 «세로 모드는 없다»).
 *
 * 세로로 들고 있으면 화면 전체를 덮는 «가로로 돌려 주세요» 안내를 띄우고 `onPortrait()` 를 부른다
 * (게임은 여기서 일시정지). 가로가 되면 안내를 걷고 `onLandscape()` .
 * 아이폰은 방향 잠금이 없어서 이 방법뿐이고, 안드로이드도 전체화면이 안 됐을 때 이걸로 막는다.
 * 안내 안에도 «나가기» 를 둔다 — 가로로 못 돌리는 상황에서 갇히지 않게.
 */

export function isPortrait() {
  return innerHeight > innerWidth;
}

/**
 * @param {HTMLElement} host
 * @param {{rotate:string, rotateSub:string, exit:string}} text
 * @param {{onPortrait?:Function, onLandscape?:Function, onExit:Function}} cb
 */
export function guardLandscape(host, text, cb) {
  const box = document.createElement('div');
  box.className = 'idg-rotate';
  box.innerHTML = '<div class="idg-rotate-icon">📱↻</div><div class="idg-rotate-main"></div><div class="idg-rotate-sub"></div>';
  box.querySelector('.idg-rotate-main').textContent = text.rotate;
  box.querySelector('.idg-rotate-sub').textContent = text.rotateSub;
  const exit = document.createElement('button');
  exit.type = 'button';
  exit.className = 'idg-rotate-exit';
  exit.textContent = text.exit;
  exit.addEventListener('click', () => cb.onExit());
  box.appendChild(exit);
  host.appendChild(box);

  let portrait = null;
  const check = () => {
    const p = isPortrait();
    if (p === portrait) return;
    portrait = p;
    box.hidden = !p;
    if (p) cb.onPortrait?.(); else cb.onLandscape?.();
  };
  check();
  addEventListener('resize', check);
  addEventListener('orientationchange', check);
  return {
    get portrait() { return portrait; },
    destroy() {
      removeEventListener('resize', check);
      removeEventListener('orientationchange', check);
      box.remove();
    },
  };
}
