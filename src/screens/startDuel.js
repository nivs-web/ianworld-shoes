/**
 * 대기방 → 드래곤 결투 다리. (`startMultiGame.js` 의 드래곤판)
 *
 * ★ **화면을 새로 짓지 않는다.** `DragonGame` 이 이미 어려운 것을 다 하고 있다 —
 * 오락실 루프 멈추기, 가로 고정, 접속 상태, ESC 가로채기, 나갈 때 되돌리기.
 * 결투라고 그게 달라질 이유가 없으므로 **모드와 방 코드만 얹어서** 그리로 보낸다.
 *
 * 여기서 하는 일은 둘뿐이다:
 *   · 판돈 **금화 1,000** 을 시작 직전에 뺀다
 *   · 게임을 못 받으면 건 것을 돌려준다
 */

import S from '../config/strings.ko.js';
import { toast } from './ui.js';
import * as Room from '../services/multiplayer.js';
import { stakeDuel, refundDuel, DUEL_STAKE } from '../services/dragonSettle.js';
import DragonGame, { loadDragon } from './DragonGame.js';

let starting = false;

export async function startDuel(nav, { code }) {
  if (starting) return false;

  /**
   * ★ **판돈은 시작 직전에 뺀다.** 대기방에 앉을 때 빼면 그냥 나가는 사람마다
   * 되돌려주는 길이 하나 더 생기고, 되돌리는 길에서 사고가 난다.
   */
  if (!stakeDuel(code)) { toast(S.duelNeedCoins(DUEL_STAKE), 2600); return false; }

  starting = true;
  try {
    await loadDragon();               // 미리 받아 둔다 — 못 받으면 판돈을 물린다
  } catch (e) {
    refundDuel(code);
    starting = false;
    toast(S.dragonLoadFailed, 3200);
    throw e;
  }
  starting = false;

  /* 판이 시작됐다 — 잠깐 끊겼다고 방에서 빠지면 안 된다 */
  Room.holdRoomSeat(code).catch(() => {});

  nav.replace(DragonGame, { mode: 'duel', code });
  return true;
}
