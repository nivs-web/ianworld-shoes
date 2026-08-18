/**
 * S13-b 방 목록 — 보통의 온라인 게임처럼 **열려 있는 방을 직접 보고 고른다.**
 *
 * ## 왜 목록이 필요했나
 *
 * 자동 매칭만 있을 때는 실패가 **보이지 않았다.** 눌렀는데 방이 만들어지면 그게
 * "빈자리를 못 찾아서"인지 "정말 방이 없어서"인지 사용자는 알 길이 없다.
 * 실기기 세 대로 눌렀더니 셋 다 방장이 됐는데, 화면만 봐서는 원인을 가릴 수 없었다.
 * 목록이 있으면 **눈으로 확인하고 손으로 고를 수 있다** — 자동 매칭이 흔들려도
 * 사용자는 막히지 않는다.
 *
 * ## 게임 중인 방도 보여 준다
 *
 * 자리가 남아 있으면 들어가서 다음 판을 기다린다(대기자). 목록에서 빼 버리면
 * "지금은 아무 방도 없다"로 보여서 또 새 방을 파게 된다.
 */

import S from '../../config/strings.ko.js';
import { el, button, backButton, screen, title, toast } from '../ui.js';
import { MULTI } from '../../config/balance.js';
import * as Room from '../../services/multiplayer.js';
import WaitingRoom from './WaitingRoom.js';
import Lobby from '../Lobby.js';

export default function RoomList(nav) {
  let rooms = null;      // null = 아직 못 받음
  let busy = false;
  let gone = false;

  async function load() {
    const list = await Room.listRooms().catch(() => []);
    if (gone) return;
    rooms = list;
    nav.refresh();
  }
  load();

  async function enter(code) {
    if (busy) return;
    busy = true;
    nav.refresh();
    const r = await Room.joinRoom(code).catch(() => 'error');
    busy = false;
    if (gone) return;
    if (r === 'ok') return nav.replace(WaitingRoom, { code });
    if (r === 'waiting') {
      // 게임 중인 방 — 들어가긴 했고 다음 판부터 함께한다
      toast(S.roomJoinedAsWaiter, 2600);
      return nav.replace(WaitingRoom, { code });
    }
    toast({ full: S.roomFull, notfound: S.roomNotFound, started: S.roomAlreadyStarted }[r] ?? S.networkError);
    load();   // 목록이 낡았을 것이다 — 다시 받는다
  }

  return {
    onLeave() { gone = true; },

    render() {
      const body = rooms === null
        ? el('div.hint', S.roomListLoading)
        : rooms.length
          ? el('div.room-list', null, rooms.map((r) => {
              const 상태 = r.playing ? S.roomStatePlaying : S.roomStateWaiting;
              return el('div.room-row', { class: r.playing ? 'playing' : '' }, [
                el('div.room-state', 상태),
                el('div.room-name', S.roomRow(r.hostName, r.count, r.max)),
                r.full
                  ? el('div.room-full', S.roomFullShort)
                  : button(S.roomEnter, () => enter(r.code), { primary: !r.playing, disabled: busy }),
              ]);
            }))
          : el('div.warn', null, [
              el('div', S.roomListEmpty),
              el('div', S.roomListEmptyHint),
            ]);

      return screen(
        title(S.roomListTitle),
        body,
        el('div.spacer'),
        button(S.roomListRefresh, () => { rooms = null; nav.refresh(); load(); }, { disabled: busy }),
        backButton(S.back, () => (nav.depth() > 1 ? nav.back() : nav.reset(Lobby)))
      );
    },
  };
}
