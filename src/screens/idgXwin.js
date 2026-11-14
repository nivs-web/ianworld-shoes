/**
 * 로비 창 공통 : 머리 현판 + 오른쪽 X 하나 (아래 «닫기» 단추 없음 · IDG_UI_PATTERNS §5) — 겜보조 1 · 11/13
 *   xTitle('연구소', () => close())  →  <div class="idg-how-title">연구소 <button class="idg-k-close"></div>
 *   창 상자에는 클래스 `idg-xw` 를 같이 단다 (idg-xwin.css 가 현판 폭 · X 자리를 잡는다)
 */
import { el } from './ui.js';
import { kitClose } from './idgKit.js';
import '../styles/idg-xwin.css';

/* 틀 2판 (11/14) : opt.left = 왼쪽(재화 알약 등 · 자동으로 .v2-left) · opt.right = X 왼쪽(바로가기 단추) — idgFrame.js 가 위 줄로 바꾼다 */
export const xTitle = (text, onClose, opt = {}) => el('div.idg-how-title', null, [text, ...(opt.left || []).map((n) => (n.classList.add('v2-left'), n)), ...(opt.right || []), kitClose(onClose)]);
/** 창 안 재화 알약 (규칙표 ⑭ : 코인 | 젬) */
export const v2Cash = (coins, gems) => el('div.v2-cash', null, [el('img', { src: '/assets/iandragon_game/ai/ui/coin.svg', alt: '' }), el('b.c', Number(coins || 0).toLocaleString('en-US')), el('i'), el('img', { src: '/assets/iandragon_game/ai/ui/gem.svg', alt: '' }), el('b.g', Number(gems || 0).toLocaleString('en-US'))]);
