/**
 * 로비 창 공통 : 머리 현판 + 오른쪽 X 하나 (아래 «닫기» 단추 없음 · IDG_UI_PATTERNS §5) — 겜보조 1 · 11/13
 *   xTitle('연구소', () => close())  →  <div class="idg-how-title">연구소 <button class="idg-k-close"></div>
 *   창 상자에는 클래스 `idg-xw` 를 같이 단다 (idg-xwin.css 가 현판 폭 · X 자리를 잡는다)
 */
import { el } from './ui.js';
import { kitClose } from './idgKit.js';
import '../styles/idg-xwin.css';

export const xTitle = (text, onClose) => el('div.idg-how-title', null, [text, kitClose(onClose)]);
