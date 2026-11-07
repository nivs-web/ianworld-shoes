/**
 * 대기방 → 줄넘기 서바이벌 다리. (`startCatchDuel.js` 의 줄넘기판, 2026-11-07)
 *
 * 걸린 것이 없는 친선 판이라 판돈이 없다. 게임 코드를 미리 받아 두고, 판이 도는 동안
 * 잠깐 끊겨도 방에서 빠지지 않게 자리를 붙든 뒤 게임 화면으로 간다.
 */

import { toast } from './ui.js';
import * as Room from '../services/multiplayer.js';
import JumpRopeGame, { loadJumpRope } from './JumpRopeGame.js';

let starting = false;

export async function startJumpSurvival(nav, { code, room }) {
  if (starting) return false;
  starting = true;
  try {
    await loadJumpRope();
  } catch (e) {
    starting = false;
    toast('게임을 불러오지 못했어요. 잠시 뒤 다시 해 주세요.', 3200);
    throw e;
  }
  starting = false;
  Room.holdRoomSeat(code).catch(() => {});
  nav.replace(JumpRopeGame, { mode: 'survival', code, room });
  return true;
}
