/**
 * 로비 무대의 «드래곤 ↔ 드래곤캐슬 전환» (겜보조 2 · 11/13 · IDG_DRAGON_CASTLE_PLAN §2)
 *  무대 하나에 드래곤 또는 드래곤캐슬만 보인다(캐슬 보기 = 단계 그림 + 깃발 + 낀 장비 + 지붕 · 정문 · 앞마당 · 알 · 하수인 없음 · 프로필 얼굴은 그대로).
 *  전환 연출 : 먼지 «펑» 2~3칸 → 바뀐 것이 «통통» 0.3초 (번지거나 흐려지지 않는다 — 칸 교체만).
 *  저장 : idg.view = 'dragon' | 'castle'. 저장 정규화(normIdg)가 아직 모르는 필드라서, 합쳐지기 전에는 이 변수가 로비를 다시 그려도 기억한다.
 */
import { el } from './ui.js';
import S from '../config/strings.ko.js';
import { liveCastle } from '../games/iandragon_game/render/castleView.js';
import { decoOf } from '../games/iandragon_game/render/castleKit.js';
import '../styles/idg-lobby-view.css';

let mem = null;
/** 지금 로비에 보이는 것 (저장값 우선 · 없으면 방금 고른 값 · 기본 드래곤) */
export const viewOf = (g) => ((g?.view ?? mem) === 'castle' ? 'castle' : 'dragon');
const FX = '/assets/iandragon_game/ai/fx/';
const PUFF = [0, 1, 2];   // dust_0 ~ dust_2 : 작게 → 크게 (100ms 씩)

/** 드래곤캐슬 무대 (드래곤 무대 button.l2-dragon 과 같은 자리 · 같은 크기) — 누르면 onTap (꾸미기 캐슬 칸) */
export function castleBox(g, onTap) {
  const box = el('button.l2-dragon.l2-castle', { type: 'button', 'aria-label': S.idgCastleAria, onclick: onTap });
  const live = liveCastle(box, { W: 420, H: 330, cls: 'l2-leader live' });
  live.show(decoOf(g)).catch(() => {});
  box.kill = live.kill;
  return box;
}

/** 발밑 «전환» 단추 — 지금 보이는 것의 반대 이름이 적힌다 */
export function switchButton(view, onClick) {
  const b = el('button.l2-switch', { type: 'button', onclick: onClick }, [el('i.l2-sw-ico', { 'aria-hidden': 'true' }), el('span')]);
  const set = (v) => { const t = v === 'castle' ? S.idgSwitchDragon : S.idgSwitchCastle; b.querySelector('span').textContent = t; b.setAttribute('aria-label', t); };
  set(view); b.set = set;
  return b;
}

/**
 * 전환 : 먼지가 터지는 사이(둘째 칸)에 무대를 바꿔 끼운다. build(view) = 새 무대 노드 · old = 지금 무대 · screen = 올려 둘 곳.
 * 돌려줌 : 새 무대 노드 (전환 중이면 null)
 */
let busy = false;
export function flip({ screen, old, next, build, save, done }) {
  if (busy) return null;
  busy = true; mem = next; try { save?.({ view: next }); } catch { /* 정규화 전에는 저장에 안 남는다 — 위 mem 이 기억 */ }
  const puff = el('div.l2-puff', { 'aria-hidden': 'true' }, [el('img', { alt: '', src: `${FX}dust_${PUFF[0]}.png` })]);
  screen.appendChild(puff);
  const img = puff.firstChild;
  PUFF.slice(1).forEach((n, i) => setTimeout(() => { img.src = `${FX}dust_${n}.png`; }, 100 * (i + 1)));
  setTimeout(() => {
    old.kill?.();
    const nu = build(next); nu.classList.add('pop');
    old.replaceWith(nu); done?.(nu);
    setTimeout(() => nu.classList.remove('pop'), 320);
  }, 120);
  setTimeout(() => { puff.remove(); busy = false; }, 340);
  return true;
}
