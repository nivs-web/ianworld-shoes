/**
 * 대기방 → 캐치볼 1:1 대결 다리. (`startDuel.js` 의 캐치볼판, 2026-10-28)
 *
 * 걸린 것이 없으므로 판돈을 빼고 되돌리는 일이 없다. 게임을 미리 받아 두고,
 * 판이 도는 동안 잠깐 끊겨도 방에서 빠지지 않게 자리를 붙든 뒤 게임 화면으로 간다.
 * `view3d` — 3D캐치볼에서 온 사람. 같은 게임 화면이 3D 화면(three.js)을 함께 받아 그린다.
 */

import S from '../config/strings.ko.js';
import { toast } from './ui.js';
import * as Room from '../services/multiplayer.js';
import CatchGame, { loadCatch } from './CatchGame.js';

let starting = false;

export async function startCatchDuel(nav, { code, room, view3d }) {
  if (starting) return false;
  starting = true;
  try {
    await loadCatch();
  } catch (e) {
    starting = false;
    toast(S.catchLoadFailed, 3200);
    throw e;
  }
  starting = false;

  Room.holdRoomSeat(code).catch(() => {});
  nav.replace(CatchGame, { mode: 'duel', code, room, view3d: !!view3d });
  return true;
}
