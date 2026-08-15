/**
 * S03 포털 — 「오락실 이안월드」. 게임 카드 목록.
 * 지금은 「신발을 찾아서」 1종. 게임이 늘면 CARDS 에 추가한다.
 */

import S from '../config/strings.ko.js';
import { el, button, screen } from './ui.js';
import { get as getProfile } from '../services/profile.js';
import Lobby from './Lobby.js';

const CARDS = [
  { id: 'find_shoes', title: S.gameTitle, screen: () => Lobby, ready: true },
];

export default function Portal(nav) {
  return {
    render() {
      const p = getProfile();
      return screen(
        el('div.portal-head', null, [
          el('div.portal-logo', S.portalTitle),
          el('div.portal-user', `${S.playerName} : ${p.nickname || '게스트'}`),
        ]),
        ...CARDS.map((c) =>
          el('div.game-card', null, [
            el('div.game-card-title', c.title),
            el('div.game-card-sub', `${S.myCollection} ${p.shoesOwned}${S.collectionUnit}`),
            button(S.touchToStart, () => nav.push(c.screen()), { primary: true }),
          ])
        ),
        el('div.spacer')
      );
    },
  };
}
