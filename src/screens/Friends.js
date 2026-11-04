/**
 * 친구 — 접속한 친구가 위에. (2026-11-04, 대표님 지시 · 권반장 전달)
 *
 * 없어진 «현재접속자» 자리에 들어간다. 다른 점은 **내 친구만** 보이고, 접속 여부를
 * 실시간 구독하지 않고 **열 때와 30초마다** 한 번씩 읽는다는 것이다(`friends.withStatus`).
 *
 * 줄을 누르면 유저카드 — 쪽지 보내기 · **같이 하기**(= 1:1 대결 신청: 비밀방을 만들고
 * 초대 쪽지를 보낸다, 받는 쪽은 팝업에서 수락) · 친구 삭제가 거기 있다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title } from './ui.js';
import { characterById, characterSprite } from '../data/characters.js';
import * as Friends from '../services/friends.js';
import { openUserCard } from './UserCard.js';

const REFRESH_MS = 30 * 1000;
const GAME_KO = { shoes: '신발을 찾아서', dragon: '드래곤 스트라이커', catch: '캐치볼' };

export default function FriendsScreen(nav, params = {}) {
  const isDragon = params.game === 'dragon';
  let rows;            // undefined = 읽는 중, null = 못 읽음
  let live = true;
  let timer = null;
  let dragonMod = null;
  if (isDragon) {
    import('./DragonGame.js').then((m) => m.loadDragon())
      .then((m) => { dragonMod = m; if (live) nav.refresh(); }).catch(() => {});
  }

  async function load(force = false) {
    const list = await Friends.list(force);
    if (!live) return;
    if (!list) { rows = null; return nav.refresh(); }
    rows = await Friends.withStatus(list);
    if (live) nav.refresh();
  }
  load(true);
  timer = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);

  function statusText(f) {
    if (f.status === 'offline') return S.friendOffline;
    const g = GAME_KO[f.game] ?? '';
    return f.status === 'playing' ? S.friendPlaying(g) : S.friendLobby(g);
  }

  function row(f) {
    const c = f.card ?? {};
    const ch = characterById(c.characterId);
    return el('div.online-row', {
      class: f.status === 'offline' ? 'off' : '',
      onclick: () => openUserCard(
        isDragon ? { uid: f.uid, nickname: f.nickname, ...c, dragonCoins: c.coins ?? 0, dragonCharacter: c.dragon | 0 }
                 : { uid: f.uid, nickname: f.nickname, ...c },
        { status: f.status, game: isDragon ? 'dragon' : 'shoes', nav, onFriendChange: () => load() }),
    }, [
      isDragon
        ? el('div.online-face', null, [dragonMod ? dragonMod.dragonPortrait(c.dragon | 0, 1) : null].filter(Boolean))
        : (ch ? el('img.online-face', { src: characterSprite(ch.id, 'front'), alt: ch.ko, loading: 'lazy', decoding: 'async' })
              : el('div.online-face')),
      el('div.online-name', f.nickname || '???'),
      el('div.online-state', { class: f.status }, statusText(f)),
    ]);
  }

  return {
    onLeave() { live = false; clearInterval(timer); },

    render() {
      let body;
      if (rows === undefined) body = el('div.hint', S.loading);
      else if (rows === null) body = el('div.warn', S.networkError);
      else if (!rows.length) body = el('div.hint', S.friendsEmpty);
      else body = el('div.online-list', null, rows.map(row));
      const on = rows ? rows.filter((f) => f.status !== 'offline').length : 0;
      return screen(
        title(S.friendsTitle),
        rows?.length ? el('div.hint', S.friendsCount(on, rows.length)) : null,
        body,
        el('div.hint', S.friendsHowToAdd),
        button(S.refreshList, () => { rows = undefined; nav.refresh(); load(true); }),
        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
