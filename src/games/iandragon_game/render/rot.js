/**
 * 화면 방향 설정 (2026-11-11 대표님 «설정에 가로 고정 · 세로 고정 · 자동 회전 3개 중 선택 · 기본은 자동 회전»)
 *
 *  auto : 기기 방향 그대로 (가로 · 세로 둘 다 전투가 된다)
 *  land : 가로 고정 — 기기가 세로면 전투 틀(.dg-host)을 시계 방향 90° 돌려 가로로 그린다 (html.idg-rot.cw)
 *  port : 세로 고정 — 기기가 가로면 전투 틀을 반시계 방향 90° 돌려 세로로 그린다 (html.idg-rot.ccw)
 * 되는 기기(안드로이드 전체 화면)는 screen.orientation.lock 도 덤으로 건다 — 안 돼도 돌려 그리기로 진행이 막히지 않는다(경고 · 안내 없음).
 * DOM 단추는 브라우저가 돌린 그대로 눌러 주고, 손가락 좌표를 직접 읽는 곳(전장 끌기 · 미니맵)만 아래 px 로 바꿔 읽는다.
 */
const KEY = 'idgOrient';
export const ORIENTS = [{ v: 'auto', label: '자동' }, { v: 'land', label: '가로' }, { v: 'port', label: '세로' }];   /* 단추 글씨 = 자동 회전 · 가로 고정 · 세로 고정 (폰에서 넘치지 않게 짧게) */
export const orientPref = () => { try { const v = localStorage.getItem(KEY); return v === 'land' || v === 'port' ? v : 'auto'; } catch { return 'auto'; } };
export function setOrientPref(v) { try { localStorage.setItem(KEY, v); } catch { /* */ } lockPref(); dispatchEvent(new Event('resize')); }
/** 지금 돌려 그리는 중이면 'cw' · 'ccw', 아니면 '' */
export const rotated = () => { const c = document.documentElement.classList; return c.contains('idg-rot') ? (c.contains('ccw') ? 'ccw' : 'cw') : ''; };
/** 손가락의 «게임 가로» 좌표 (화면 px) — 돌렸으면 그 방향으로 */
export const px = (e) => { const r = rotated(); return r === 'cw' ? e.clientY : r === 'ccw' ? innerHeight - e.clientY : e.clientX; };
/** 기기 가로 잠금 · 세로 잠금 (되는 곳에서만 · 실패는 조용히) */
export function lockPref() {
  const v = orientPref();
  try { if (v === 'auto') screen.orientation?.unlock?.(); else screen.orientation?.lock?.(v === 'land' ? 'landscape' : 'portrait')?.catch?.(() => {}); } catch { /* */ }
}

/** 전투 틀을 설정대로 돌려 놓는다. 푸는 함수를 돌려준다 (창 크기가 바뀔 때마다 다시 맞춤) */
export function keepOrient(host) {
  const fit = () => {
    const v = orientPref(), portrait = innerHeight > innerWidth;
    const mode = v === 'land' && portrait ? 'cw' : v === 'port' && !portrait ? 'ccw' : '';
    const c = document.documentElement.classList;
    c.toggle('idg-rot', !!mode); c.toggle('cw', mode === 'cw'); c.toggle('ccw', mode === 'ccw');
    Object.assign(host.style, mode === 'cw'
      ? { position: 'fixed', left: `${innerWidth}px`, top: '0px', right: 'auto', bottom: 'auto', width: `${innerHeight}px`, height: `${innerWidth}px`, transform: 'rotate(90deg)', transformOrigin: '0 0' }
      : mode === 'ccw'
        ? { position: 'fixed', left: '0px', top: `${innerHeight}px`, right: 'auto', bottom: 'auto', width: `${innerHeight}px`, height: `${innerWidth}px`, transform: 'rotate(-90deg)', transformOrigin: '0 0' }
        : { position: '', left: '', top: '', right: '', bottom: '', width: '', height: '', transform: '', transformOrigin: '' });
  };
  fit(); lockPref();
  /* 게임(app.js)의 창 크기 맞춤보다 먼저 불려야 해서 캡처 단계로 단다 */
  addEventListener('resize', fit, true); addEventListener('orientationchange', fit, true);
  return () => { removeEventListener('resize', fit, true); removeEventListener('orientationchange', fit, true); document.documentElement.classList.remove('idg-rot', 'cw', 'ccw'); };
}
