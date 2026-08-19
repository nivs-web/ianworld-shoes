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
import Lobby from './Lobby.js';
import { toast } from './ui.js';
import S from '../config/strings.ko.js';
import { MULTI } from '../config/balance.js';
import { loadGameModule } from '../game/loadGame.js';

let starting = false;

export async function startMultiGame(nav, { code, room }) {
  if (starting) return false;
  const p = getProfile();
  enterFullscreen().then((ok) => { if (ok) lockPortrait(); });

  // 인게임 코드는 따로 받는다 — 전체화면 요청 **뒤에** (제스처 컨텍스트, §9-0-2)
  starting = true;
  let GameScene;
  try {
    ({ GameScene } = await loadGameModule());
  } finally {
    starting = false;
  }
  Room.resetProgressThrottle();
  // 판이 시작됐다 — 잠깐 끊겼다고 방에서 빠지면 안 된다 (multiplayer.js armDisconnect)
  Room.holdRoomSeat(code).catch(() => {});
  nav.toCanvas();

  Scene.reset(new GameScene({
    difficulty: room.difficulty,
    charId: p.selectedCharacter,
    controlMode: p.controlMode,
    seed: room.seed,          // ★ 전원 동일
    multi: { code, startAt: room.startAt ?? 0, myUid: currentUser()?.uid },
    /**
     * @param {{floor:number,difficulty:string,shoeIndices:number[]}|null} result
     *
     * ★ **판 결과를 결과 화면까지 들고 간다.** (2026-08-16)
     * 예전에는 `onFinish` 가 인자를 아예 안 받아서, 멀티 한 판에서 주운 신발도
     * 도달한 계단도 **통째로 버려졌다.** `finishRun()` 호출부가 싱글 한 곳뿐이었다.
     * 기획서 §5-9 는 "멀티 게임: 승자만 기록 반영" 이므로, 반영 여부는
     * 승패를 아는 결과 화면(`MultiResult`)이 판단한다.
     */
    onFinish: (result) => {
      exitFullscreen();
      /**
       * ★ **화면부터 넘긴다.** (2026-08-19)
       *
       * 예전에는 `await finalizeResult()` 를 먼저 했다. 그런데 그 안의 서버 읽기는
       * **최대 8초**를 기다리고 쓰기는 12초다 — 네트워크가 나쁘면 판이 끝난 뒤에도
       * 화면이 멈춘 채로 20초를 서 있는다. 사용자에게는 그게 "튕김"이다.
       *
       * 순위 확정은 결과 화면이 방을 구독하면서, 정산이 시작될 때(`settleRoom`)
       * 또 한 번, 다음 접속의 청산에서 또 한 번 시도한다. **여기서 기다릴 이유가 없다.**
       */
      Scene.clear(); // 판은 끝났다 — 씬을 비운다 (안 그러면 결과 화면 뒤에서 계속 돈다)
      nav.reset(MultiResult, { code, result });
      Room.finalizeResult(code).catch(() => null);
    },
    /**
     * ★ **30초 넘게 자리를 비웠다 — 로비로 내보낸다.** (2026-08-19 10차, 사용자 지정)
     *
     * 결과 화면이 아니라 **로비**인 이유: 그 판은 내가 뛰지 않은 판이 됐다(남들이 이미
     * 나를 뺐다). 결과를 보여 줘 봐야 내 순위가 없고, 판돈 정산은 다음 접속의 청산이
     * 마저 한다. 대신 **왜 나왔는지는 반드시 말해 준다** — 설명 없는 화면 전환은
     * 고장으로 보인다.
     */
    onAbsent: () => {
      exitFullscreen();
      Scene.clear();
      nav.reset(Lobby);
      toast(S.kickedAbsent(MULTI.absentSeconds), 3200);
    },
  }));
  return true;
}
