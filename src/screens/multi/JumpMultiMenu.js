/**
 * S42 줄넘기 챔피언 · ROPE BEAT — 멀티 서바이벌 메뉴. (2026-11-07)
 *
 * 캐치볼 · 드래곤 멀티 메뉴와 **같은 자리, 같은 순서**다(빠른 입장 · 방 목록 · 비밀방 만들기 · 코드로 입장).
 * 다른 것: 방을 `game: 'jump'` 로 **최대 8명**으로 판다 · 걸린 것이 없다(친선).
 *
 * ⏳ RTDB 규칙이 아직 'jump' 방(정원 8)을 모르면 방 만들기 쓰기가 거부된다 — 그때는 «서버 준비 중» 안내.
 */

import S from '../../config/strings.ko.js';
import { el, button, backButton, screen, title, toast } from '../ui.js';
import * as Room from '../../services/multiplayer.js';
import * as J from '../../services/jumprope.js';
import { DIFFS } from '../../games/jumprope/data.js';
import { SURVIVAL } from '../../games/jumprope/beat/survival.js';
import { lazyScreen } from '../lazyScreen.js';
import { ensureJrStyle } from '../jumprope/jrui.js';

const WaitingRoom = lazyScreen(() => import('./WaitingRoom.js'), '줄넘기 서바이벌');
const RoomList = lazyScreen(() => import('./RoomList.js'), S.roomListTitle);
const CodeInput = lazyScreen(() => import('./CodeInput.js'), S.enterByCode);

const GAME = Room.GAME_JUMP;
export const JUMP_SEATS = 8;

export default function JumpMultiMenu(nav) {
  ensureJrStyle();
  let busy = false;
  Room.prewarm();

  async function guard(fn) {
    if (busy) return;
    busy = true;
    nav.refresh();
    try {
      const code = await fn();
      if (code) nav.replace(WaitingRoom, { code, game: GAME });
      else toast('멀티 서바이벌 서버를 준비하는 중이에요. 곧 열려요!', 2600);
    } catch {
      toast('멀티 서바이벌 서버를 준비하는 중이에요. 곧 열려요!', 2600);
    } finally {
      busy = false;
      nav.refresh();
    }
  }

  return {
    render() {
      const j = J.jr();
      const diff = DIFFS[j.diff] ? j.diff : 'normal';
      return screen(
        title('멀티 서바이벌'),
        el('div.jr-box', null, [
          el('h4', '마지막까지 줄에 안 걸리는 사람이 우승!'),
          el('div', `최대 ${JUMP_SEATS}명 · 모두 같은 곡 · 같은 줄 · 같은 순간에 시작해요.`),
          el('div', `하트 ${SURVIVAL.hearts}개 — 줄에 걸리면(JUMP 놓침) 하나씩 잃고, 다 잃으면 탈락 · 관전.`),
          el('div', `8마디마다 빨라져요: BPM ${SURVIVAL.bpms.join(' → ')}`),
          el('div', `모두 JUMP 하나로 같은 줄을 넘어요 · 걸린 것은 없어요 · 새 방 난이도: ${DIFFS[diff].label}`),
        ]),
        button(busy ? S.loading : '빠른 입장',
          () => guard(() => Room.quickJoin({ game: GAME, maxPlayers: JUMP_SEATS, difficulty: diff })),
          { primary: true, disabled: busy }),
        button(S.roomListTitle, () => nav.push(RoomList, { game: GAME }), { disabled: busy }),
        button(S.createPrivateRoom,
          () => guard(() => Room.createRoom({ isPrivate: true, game: GAME, maxPlayers: JUMP_SEATS, difficulty: diff })),
          { disabled: busy }),
        button(S.enterByCode, () => nav.push(CodeInput, { game: GAME }), { disabled: busy }),
        el('div.spacer'),
        backButton('게임 로비로', () => nav.back()),
      );
    },
  };
}
