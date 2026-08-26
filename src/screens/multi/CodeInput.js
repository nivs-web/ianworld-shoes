/**
 * S15 멀티 코드 입력 — 4자리 숫자 패드.
 *
 * `<input type=number>` 를 쓰지 않는다. 모바일 키보드가 화면 절반을 덮고,
 * 기종마다 다른 자판이 올라와서 도트 화면이 통째로 흐트러진다.
 * 숫자 10개 + 지우기면 되는 일이라 패드를 직접 그린다.
 */

import S from '../../config/strings.ko.js';
import { el, button, backButton, screen, title, toast } from '../ui.js';
import { MULTI } from '../../config/balance.js';
import * as Room from '../../services/multiplayer.js';
import WaitingRoom from './WaitingRoom.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', '↵'];

export default function CodeInput(nav, params = {}) {
  const game = params.game === 'dragon' ? 'dragon' : 'shoes';
  let code = '';
  let busy = false;

  async function submit() {
    if (busy || code.length !== MULTI.codeLength) return;
    busy = true;
    nav.refresh();
    const r = await Room.joinRoom(code, null, game);
    busy = false;
    if (r === 'ok') return nav.replace(WaitingRoom, { code, game });
    /**
     * ★ **대기자 입장을 여기서도 받는다.** (2026-08-18)
     * `joinRoom` 은 게임 중인 방이면 `'waiting'` 을 돌려준다(자리는 이미 잡았다).
     * 이 화면만 그 값을 몰라서 "네트워크 오류" 토스트를 띄우고 코드를 지웠다 —
     * 사용자는 실패한 줄 알고 떠나지만 **자리는 계속 차지한 유령**이 됐고,
     * 다음 판에서 레디를 안 한 사람으로 남아 시작 자체를 막았다. (`RoomList` 와 동일 처리)
     */
    if (r === 'waiting') {
      toast(S.roomJoinedAsWaiter, 2600);
      return nav.replace(WaitingRoom, { code, game });
    }
    toast({ full: S.roomFull, started: S.roomAlreadyStarted, notfound: S.roomNotFound , wronggame: S.roomWrongGame }[r] ?? S.networkError);
    code = '';
    nav.refresh();
  }

  function press(k) {
    if (busy) return;
    if (k === '←') code = code.slice(0, -1);
    else if (k === '↵') return submit();
    else if (code.length < MULTI.codeLength) code += k;
    nav.refresh();
    // 다 채우면 알아서 들어간다 — 확인 버튼을 또 찾게 하지 않는다
    if (code.length === MULTI.codeLength) submit();
  }

  return {
    render() {
      /** 빈 칸은 밑줄로 — 몇 자리 남았는지 보여야 한다 */
      const slots = Array.from({ length: MULTI.codeLength }, (_, i) =>
        el('div.code-slot', { class: code[i] ? 'on' : '' }, code[i] ?? '')
      );

      return screen(
        title(S.enterCode),
        el('div.code-row', null, slots),
        /**
         * ★ 지우기(←)·입장(↵) 은 **숫자와 다른 크기·색**으로 그린다. (2026-08-19)
         * 예전엔 셋 다 18px 라 화살표 글리프가 숫자보다 작아 보였고, 엔터 칸이
         * "엔터처럼 안 보인다"는 신고가 있었다. 기호는 같은 글자 크기라도 실제로
         * 차지하는 획이 훨씬 작아서, 숫자와 같은 값을 주면 작아 보이는 게 정상이다.
         */
        el('div.keypad', null, KEYS.map((k) =>
          button(k, () => press(k), {
            class: k === '↵' ? 'key key-enter' : k === '←' ? 'key key-back' : 'key',
            primary: k === '↵',
          })
        )),
        busy ? el('div.hint', S.loading) : null,
        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
