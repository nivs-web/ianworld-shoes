/**
 * 좀비와 드래곤 «늘 가로» (11/14 대표님 «로비든 게임이든 세로 모드 안 되게 · 안내 문구 없이»)
 *
 * 브라우저는 방향을 강제로 못 잠근다(아이폰 · 전체 화면 아닌 안드로이드). 그래서 폰을 세로로 들면
 * 좀비와 드래곤을 «가로 크기의 액자(iframe)» 안에서 띄우고 액자를 90° 돌려 보여 준다.
 * 액자 안은 화면이 가로라서 CSS · 그림 · 전투가 전부 가로 그대로 돌아간다(안내 화면 없음).
 *  - 액자 주소 = 같은 사이트 + ?idgEmbed=1 → main.js 가 오락실 대신 바로 좀비와 드래곤 로비를 띄운다
 *  - 액자 안에서 «이안오락실로» 를 누르면 부모에게 알려 액자를 닫고 오락실로
 *  - 폰을 다시 가로로 돌려도 액자는 그대로(돌림만 풂) — 게임 상태가 끊기지 않게
 */
export const IDG_EMBED = typeof location !== 'undefined' && new URLSearchParams(location.search).has('idgEmbed');
if (IDG_EMBED && typeof window !== 'undefined') window.__idgEmbed = true;

/** 지금 세로인가 (액자 안에서는 늘 아니라고 본다) */
export const isPortraitNow = () => !IDG_EMBED && typeof window !== 'undefined' && window.innerHeight > window.innerWidth;

/** 액자 안 → 부모 : 오락실로 나가기 */
export function embedExit() {
  try { window.parent?.postMessage({ idg: 'exit' }, location.origin); } catch { /* */ }
}

/**
 * 부모 쪽 «돌린 액자» 화면 (screen 객체 : render · onLeave)
 * @param {{ onExit: Function }} o
 */
export function rotateHost(o) {
  let frame = null, host = null;
  const fit = () => {
    if (!frame) return;
    const W = window.innerWidth, H = window.innerHeight, port = H > W;
    Object.assign(frame.style, port
      ? { width: `${H}px`, height: `${W}px`, left: `${W}px`, top: '0px', transform: 'rotate(90deg)' }
      : { width: `${W}px`, height: `${H}px`, left: '0px', top: '0px', transform: 'none' });
  };
  const onMsg = (e) => { if (e.origin === location.origin && e.data?.idg === 'exit') o.onExit?.(); };
  const leave = () => { removeEventListener('resize', fit); removeEventListener('orientationchange', fit); removeEventListener('message', onMsg); frame?.remove(); frame = null; };
  return {
    onLeave: leave,
    destroy: leave,
    render() {
      host = document.createElement('div');
      host.className = 'screen idg-rotate-host';
      Object.assign(host.style, { position: 'fixed', inset: '0', background: '#000', overflow: 'hidden', zIndex: '50' });
      frame = document.createElement('iframe');
      frame.title = '좀비와 드래곤';
      frame.setAttribute('allow', 'autoplay; fullscreen; clipboard-write');
      frame.src = `${location.pathname}?idgEmbed=1`;
      Object.assign(frame.style, { position: 'absolute', border: '0', transformOrigin: '0 0', background: '#000' });
      host.appendChild(frame);
      fit();
      addEventListener('resize', fit); addEventListener('orientationchange', fit); addEventListener('message', onMsg);
      return host;
    },
  };
}
