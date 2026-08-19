/**
 * S19 현재접속자 — 지금 게임에 붙어 있는 모든 사람. (2026-08-19 11차, 사용자 지정)
 *
 * *"'현재접속자'라는 메뉴이고 게임중이던... 로비에 있던 어디에 있던 현재 접속중인
 * 모든 유저가 나오게 해줘... 클릭하면 유저상태창 뜨게해"*
 *
 * 방 목록(`RoomList`)과 다른 점: 여기는 **방과 무관**하다. 로비에서 도감을 보고 있는
 * 사람도, 싱글 게임을 도는 사람도 전부 나온다. 그래야 "누구한테 말을 걸까"를 고를 수 있다.
 *
 * 목록은 **구독**한다. 접속자는 시시각각 바뀌는데 폴링하면 이미 나간 사람에게
 * 대결을 신청하게 된다.
 */

import S from '../../config/strings.ko.js';
import { el, button, backButton, screen, title } from '../ui.js';
import { characterById, characterSprite } from '../../data/characters.js';
import { currentUser } from '../../services/auth.js';
import * as Presence from '../../services/presence.js';
import { openUserCard } from '../UserCard.js';

export default function OnlineUsers(nav) {
  const myUid = currentUser()?.uid;
  let list = null;          // null = 아직 못 받았다 (빈 배열과 구분한다)
  /** 못 붙었다 — "아무도 없다"와 다른 말을 해야 한다 */
  let failed = false;
  let unsub = () => {};

  const listen = () => Presence.subscribeOnline((rows) => {
    if (!rows) { failed = true; list = null; return nav.refresh(); }
    failed = false;
    /**
     * 정렬은 **대기중 먼저**다. 대결을 신청할 수 있는 사람이 위에 있어야 한다 —
     * 게임 중인 사람은 눌러 봐야 "게임중 상태에선 …" 만 뜬다.
     * 같은 상태 안에서는 이름순이라 목록이 매 갱신마다 춤추지 않는다.
     */
    list = rows.slice().sort((a, b) => {
      const s = (a.state === 'playing' ? 1 : 0) - (b.state === 'playing' ? 1 : 0);
      if (s) return s;
      return String(a.nickname ?? '').localeCompare(String(b.nickname ?? ''), 'ko');
    });
    nav.refresh();
  });
  unsub = listen();

  /**
   * ★ **새로고침** (2026-08-19 13차, 사용자 요청).
   *
   * 목록은 원래 **구독**이라 저절로 따라온다. 그런데 소켓이 끊겼다 붙는 사이에는
   * 스냅샷이 안 오고, 사용자에게는 "목록이 멈춘 것"으로 보인다 — 그때 누를 것이 있어야 한다.
   * 구독을 끊고 다시 걸면 연결부터 새로 잡으므로 그 상태가 실제로 풀린다.
   * 내 카드도 같이 다시 올린다(신발 수가 바뀐 뒤였을 수 있다).
   */
  function refresh() {
    unsub();
    list = null;
    failed = false;
    nav.refresh();
    Presence.refresh();
    unsub = listen();
  }

  function row(u) {
    const ch = characterById(u.characterId);
    const isMe = u.uid === myUid;
    const playing = u.state === 'playing';
    return el('div.online-row', {
      class: isMe ? 'me' : '',
      onclick: () => openUserCard(u, {
        // 이미 아는 상태를 넘긴다 — 서버에 한 번 더 묻지 않는다
        status: playing ? 'playing' : 'lobby',
        nav,
      }),
    }, [
      ch ? el('img.online-face', { src: characterSprite(ch.id, 'front'), alt: ch.ko, loading: 'lazy', decoding: 'async' })
         : el('div.online-face'),
      el('div.online-name', `${u.nickname || '???'}${isMe ? ` (${S.meTag})` : ''}`),
      el('div.online-shoes', S.roomShoes(u.shoesOwned ?? 0)),
      el('div.online-state', { class: playing ? 'playing' : 'idle' },
        playing ? S.stateShortPlaying : S.stateShortIdle),
    ]);
  }

  return {
    onLeave() { unsub(); unsub = () => {}; },

    render() {
      let body;
      if (failed) body = el('div.hint', S.networkError);
      else if (list === null) body = el('div.hint', S.loading);
      else if (!list.length) body = el('div.hint', S.noOneOnline);
      else body = el('div.online-list', null, list.map(row));

      return screen(
        title(S.onlineUsers),
        list ? el('div.hint', S.onlineCount(list.length)) : null,
        body,
        el('div.spacer'),
        button(S.refreshList, refresh, { sfx: 'sfx_menu_move' }),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
