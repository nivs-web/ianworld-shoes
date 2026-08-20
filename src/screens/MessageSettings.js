/**
 * S21 메세지 수신 설정 — **[수신차단] [수신허용]** 두 버튼. (2026-08-19 12차 → 21차)
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

  /**
   * ★ **못 읽어도 내가 누른 결과는 살아남는다.** (2026-08-19 14차)
   *
   * 14차 전까지 `prefs/$uid` 에 읽기 규칙이 없었다 — 잎(`accept`·`blocked`)에만 걸었는데
   * **RTDB 읽기 권한은 아래로만 흐른다.** 이 구독은 그 **부모**를 보므로 늘 권한 거부였고,
   * 그러면 `cb(null)` → `accept` 가 영영 `true` 로 굳는다. 쓰기(`setAccept`)는 멀쩡히
   * 성공하는데 화면만 안 바뀌니 사용자에게는 **"버튼 자체가 안 눌린다"** 로 보인다 —
   * *"메세지 꺼짐 누르면 활성화가 안되네 버튼 자체가 안누르네 이유가 뭐야?"*
   *
   * 규칙은 고쳤다(§9-0-44). 그래도 **화면이 서버 한 곳에만 매달리지 않게** 여기도 고친다:
   * 못 읽으면 처음 한 번만 기본값으로 그리고, 그 뒤로는 내가 누른 값을 덮지 않는다.
   */
  unsub = Presence.subscribeMyPrefs((v) => {
    if (!v) {
      if (accept === null) { accept = true; nav.refresh(); }
      return;
    }
    accept = v.accept;
    nav.refresh();
  });

  async function set(on) {
    if (busy || accept === on) return;
    busy = true;
    nav.refresh();
    const ok = await Presence.setAccept(on);
    busy = false;
    // 서버가 받아 줬으면 **구독을 기다리지 않고** 바로 뒤집는다 (누른 즉시 반응해야 한다)
    if (ok) accept = on;
    else toast(S.networkError, 1800);
    nav.refresh();
  }

  return {
    onLeave() { unsub(); unsub = () => {}; },

    render() {
      /**
       * ★ **지금 어느 쪽인지 한 줄로 먼저 말한다.** (2026-08-19 21차, 사용자 지정)
       * *"버튼2개 상단에 '현재상태 : 수신허용' 이런 식으로"*
       *
       * 아직 값을 못 받았으면(`null`) **단정하지 않는다** — `현재상태 : 수신허용` 이라고
       * 써 놓고 잠시 뒤 뒤집히면 그게 제일 나쁘다(§9-0-6 의 그 거짓말).
       */
      const stateWord = accept === null ? S.loading : (accept === false ? S.msgAcceptOff : S.msgAcceptOn);

      return screen(
        title(S.msgAcceptTitle),

        el('div.msg-accept-now', {
          // 차단 상태는 글자만으로도 눈에 띄어야 한다 — 목록의 [차단] 배지와 같은 신호
          class: accept === false ? 'off' : '',
        }, S.msgAcceptNow(stateWord)),

        // 순서는 사용자 지정 그대로 — [수신차단] [수신허용]
        el('div.seg', null, [
          button(S.msgAcceptOff, () => set(false), {
            class: accept === false ? 'on' : '', disabled: busy, sfx: 'sfx_menu_move',
          }),
          button(S.msgAcceptOn, () => set(true), {
            class: accept === true ? 'on' : '', disabled: busy, sfx: 'sfx_menu_move',
          }),
        ]),

        // 안내는 **상태와 무관하게 늘 같은 문장**이다 — 누르기 전에 무엇이 멈추는지 알려야 한다
        el('div.hint', S.msgAcceptHint),

        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
