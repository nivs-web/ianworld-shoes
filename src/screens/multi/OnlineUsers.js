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

export default function OnlineUsers(nav, params = {}) {
  const myUid = currentUser()?.uid;
  let list = null;          // null = 아직 못 받았다 (빈 배열과 구분한다)
  /** 못 붙었다 — "아무도 없다"와 다른 말을 해야 한다 */
  let failed = false;
  let unsub = () => {};

  /**
   * ★ **보이는 것이 안 바뀌었으면 다시 그리지 않는다.** (2026-08-19 15차, 속도)
   *
   * `presence` 는 **최상위 노드 전체**를 구독한다. 그래서 접속자 중 **아무나** 카드를
   * 다시 쓰면(`at` 시각만 바뀌어도) 목록 전체가 다시 내려오고, 예전에는 그때마다
   * 화면을 통째로 헐고 다시 세웠다 — 얼굴 `<img>` 가 전부 새로 만들어져 깜빡이고,
   * 열어 둔 유저상태창 위에서 화면이 계속 요동쳤다.
   *
   * 이 화면이 실제로 읽는 값은 다섯 개뿐이다. `at` 은 어디에도 안 나온다.
   */
  const viewKey = (rows) => rows
    .map((u) => [u.uid, u.nickname ?? '', u.characterId ?? '', u.shoesOwned ?? 0, u.state ?? ''].join(':'))
    .join('|');
  let lastView = null;

  const listen = () => Presence.subscribeOnline((rows) => {
    if (!rows) { failed = true; list = null; lastView = null; return nav.refresh(); }
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
    const key = viewKey(list);
    if (key === lastView) return;
    lastView = key;
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
    lastView = null;
    nav.refresh();
    Presence.refresh();
    unsub = listen();
  }

  const isDragon = params.game === 'dragon';

  function row(u) {
    const ch = characterById(u.characterId);
    const isMe = u.uid === myUid;
    const playing = u.state === 'playing';
    return el('div.online-row', {
      class: isMe ? 'me' : '',
      onclick: () => openUserCard(
        isDragon ? { ...u, dragonCoins: u.coins ?? 0, dragonCharacter: u.dragon | 0 } : u,
        {
          // 이미 아는 상태를 넘긴다 — 서버에 한 번 더 묻지 않는다
          status: playing ? 'playing' : 'lobby',
          game: isDragon ? 'dragon' : 'shoes',
          nav,
        }),
    }, [
      ch ? el('img.online-face', { src: characterSprite(ch.id, 'front'), alt: ch.ko, loading: 'lazy', decoding: 'async' })
         : el('div.online-face'),
      el('div.online-name', `${u.nickname || '???'}${isMe ? ` (${S.meTag})` : ''}`),
      /**
       * ★ **드래곤 쪽에서 "신발 N켤레" 가 뜨면 안 된다.** (2026-08-27, 사용자 지적)
       * *"이 게임은 드래곤 스트라이커야, '신발 0켤레' 이렇게 뜨는게 아니라,
       *   '보유 금화 0개' 이렇게 뜨게끔 통일시켜"*
       */
      el('div.online-shoes', isDragon ? S.roomCoins(u.coins ?? 0) : S.roomShoes(u.shoesOwned ?? 0)),
      el('div.online-state', { class: playing ? 'playing' : 'idle' },
        playing ? S.stateShortPlaying : S.stateShortIdle),
    ]);
  }

  return {
    onLeave() { unsub(); unsub = () => {}; },

    render() {
      let body;
      let listed = false;   // 본문이 **스크롤되는 목록**인가 (로딩·오류·빈 목록은 아니다)
      if (failed) body = el('div.hint', S.networkError);
      else if (list === null) body = el('div.hint', S.loading);
      else if (!list.length) body = el('div.hint', S.noOneOnline);
      else { body = el('div.online-list', null, list.map(row)); listed = true; }

      /**
       * ★ 목록이 있으면 **여백을 넣지 않는다.** (2026-08-19 16차)
       * `.spacer` 도 목록도 둘 다 `flex: 1` 이라 남는 공간을 나눠 갖는다 —
       * 그러면 목록 아래가 검은 공백이 된다(명예의 전당에서 실측 173~243px).
       */
      return screen(
        title(S.onlineUsers),
        list ? el('div.hint', S.onlineCount(list.length)) : null,
        body,
        listed ? null : el('div.spacer'),
        button(S.refreshList, refresh, { sfx: 'sfx_menu_move' }),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
