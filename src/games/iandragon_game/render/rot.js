/**
 * 전투는 항상 가로 (2026-11-11 대표님 정정 «냥코처럼 가로만 · 세로로 들어도 경고 · 돌려 달라는 말 없이 그냥 가로로 계속»)
 *
 * 세로로 들고 있으면 게임 틀(.dg-host)을 통째로 90° 돌려 가로 크기로 그린다 (html.idg-rot).
 * DOM 단추는 브라우저가 돌린 그대로 눌러 주고, 손가락 좌표를 직접 읽는 곳(전장 끌기 · 미니맵)만 아래 px · py 로 바꿔 읽는다.
 * 돌린 틀 : 틀의 가로(x) = 화면 아래쪽(clientY), 틀의 세로(y) = 화면 왼쪽으로(innerWidth − clientX).
 */
export const rotated = () => document.documentElement.classList.contains('idg-rot');
/** 손가락의 «게임 가로» 좌표 (화면 px) */
export const px = (e) => (rotated() ? e.clientY : e.clientX);
/** 손가락의 «게임 세로» 좌표 (화면 px) */
export const py = (e) => (rotated() ? innerWidth - e.clientX : e.clientY);

/** host 를 세로 화면에서 돌려 놓는다. 돌려 놓기를 푸는 함수를 돌려준다 (창 크기가 바뀔 때마다 다시 맞춤) */
export function keepLandscape(host) {
  const fit = () => {
    const on = innerHeight > innerWidth;
    document.documentElement.classList.toggle('idg-rot', on);
    Object.assign(host.style, on
      ? { position: 'fixed', left: `${innerWidth}px`, top: '0px', right: 'auto', bottom: 'auto', width: `${innerHeight}px`, height: `${innerWidth}px`, transform: 'rotate(90deg)', transformOrigin: '0 0' }
      : { position: '', left: '', top: '', right: '', bottom: '', width: '', height: '', transform: '', transformOrigin: '' });
  };
  fit();
  /* 게임(app.js)의 창 크기 맞춤보다 먼저 불려야 해서 캡처 단계로 단다 */
  addEventListener('resize', fit, true); addEventListener('orientationchange', fit, true);
  return () => { removeEventListener('resize', fit, true); removeEventListener('orientationchange', fit, true); document.documentElement.classList.remove('idg-rot'); };
}
