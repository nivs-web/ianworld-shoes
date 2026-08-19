/**
 * S21 메세지 수신 설정 — 켜짐 / 꺼짐 하나뿐. (2026-08-19 12차, 사용자 지정)
 *
 * *"'꺼짐'을 누르면 메세지나 1:1대결을 보낼 수 없어. 보내기 누르면 '상대방에 메세지
 * 수신 거부중' 이라고 뜨게끔해"*
 *
 * 실제로 막는 건 **서버 규칙**이다(`inbox/$uid/$id/.write` 가 `prefs/$uid/accept` 를 본다).
 * 화면에서만 막으면 조작한 클라이언트가 그대로 뚫는다.
 *
 * 차단(개인별)은 여기가 아니라 **받은 메세지함의 줄**에서 한다 — "이 사람"이 눈앞에
 * 있어야 차단할지 말지 정할 수 있기 때문이다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title, toast } from './ui.js';
import * as Presence from '../services/presence.js';

export default function MessageSettings(nav) {
  /** null = 아직 못 받았다 (기본값 '켜짐'을 먼저 그려 놓고 깜빡이게 하지 않는다) */
  let accept = null;
  let busy = false;
  let unsub = () => {};

  unsub = Presence.subscribeMyPrefs((v) => {
    accept = v ? v.accept : true;
    nav.refresh();
  });

  async function set(on) {
    if (busy || accept === on) return;
    busy = true;
    nav.refresh();
    const ok = await Presence.setAccept(on);
    busy = false;
    if (!ok) toast(S.networkError, 1800);
    nav.refresh();
  }

  return {
    onLeave() { unsub(); unsub = () => {}; },

    render() {
      const on = accept !== false;
      return screen(
        title(S.msgAcceptTitle),

        el('div.seg', null, [
          button(S.msgAcceptOn, () => set(true), {
            class: accept === true ? 'on' : '', disabled: busy, sfx: 'sfx_menu_move',
          }),
          button(S.msgAcceptOff, () => set(false), {
            class: accept === false ? 'on' : '', disabled: busy, sfx: 'sfx_menu_move',
          }),
        ]),

        el('div.hint', accept === null ? S.loading : (on ? S.msgAcceptHintOn : S.msgAcceptHintOff)),

        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
