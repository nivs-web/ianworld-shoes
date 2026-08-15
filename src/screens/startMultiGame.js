/**
 * 대기방 → 멀티 인게임 다리. (`startGame.js` 의 멀티판)
 *
 * 싱글과 갈리는 지점만 여기서 정한다:
 *   · 시드를 **방에서 받는다** — 네 명이 같은 계단을 봐야 승부가 성립한다
 *   · 도감 가중치를 **끄고 넘긴다** — 각자의 도감을 반영하면 사람마다 다른 신발이 나온다
 *   · 부활·엘리베이터 없음 (기획서 §5-6, §5-8-1)
 *   · 끝나면 결과를 확정하고 정산 화면으로
 */

import * as Scene from '../core/scene.js';
import { enterFullscreen, exitFullscreen, lockPortrait } from '../core/fullscreen.js';
import { get as getProfile } from '../services/profile.js';
import * as Room from '../services/multiplayer.js';
import { currentUser } from '../services/auth.js';
import MultiResult from './multi/MultiResult.js';

export function startMultiGame(nav, { code, room }) {
  const p = getProfile();
  enterFullscreen().then((ok) => { if (ok) lockPortrait(); });

  const { GameScene } = window.__gameModule;
  Room.resetProgressThrottle();
  nav.toCanvas();

  Scene.reset(new GameScene({
    difficulty: room.difficulty,
    charId: p.selectedCharacter,
    controlMode: p.controlMode,
    seed: room.seed,          // ★ 전원 동일
    multi: { code, startAt: room.startAt ?? 0, myUid: currentUser()?.uid },
    onFinish: async () => {
      exitFullscreen();
      /**
       * 결과 확정은 **모두가 부른다.** 트랜잭션이라 처음 것 하나만 남고,
       * 방장이 먼저 나가버려도 순위가 안 나오는 일이 없다.
       */
      await Room.finalizeResult(code).catch(() => null);
      nav.reset(MultiResult, { code });
    },
  }));
  return true;
}
