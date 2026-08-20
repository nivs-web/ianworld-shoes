/**
 * 로비 → 인게임 다리.
 *
 * 화면(DOM)과 게임(Canvas)이 서로를 직접 import 하면 순환이 생긴다.
 * 그래서 "게임을 시작한다"와 "게임이 끝났다"만 이 파일이 중개한다.
 */

import { get as getProfile, finishRun } from '../services/profile.js';
import { ELEVATOR } from '../config/balance.js';
import * as L from '../services/storageLocal.js';
import * as Scene from '../core/scene.js';
import { enterFullscreen, exitFullscreen, lockPortrait } from '../core/fullscreen.js';
import { nav } from './router.js';
import Lobby from './Lobby.js';
import { loadGameModule } from '../game/loadGame.js';

/**
 * @param {object} navigator router.nav
 * @param {{useElevator?:boolean}} opt
 */
/**
 * 두 번 눌려도 판이 둘 열리지 않게. 인게임 코드를 받는 동안(첫 판 한정)
 * 화면이 아직 로비라 **연타가 가능해졌기 때문에** 생긴 방어다.
 */
let starting = false;

export async function startGame(navigator, opt = {}) {
  if (starting) return false;
  const p = getProfile();

  // 엘리베이터는 **누르는 즉시** 차감한다 (기획서 §5-8-1 "도중에 나가도 환불 없음")
  let startFloor = 0;
  // 19차: 꺼져 있으면 어떤 경로로 불려도 안 태운다 — 버튼만 숨기면 옛 링크·자동화가 뚫는다
  if (opt.useElevator && ELEVATOR.enabled) {
    if (!L.consumeShoes(ELEVATOR.cost)) return false;
    L.patchProfile({ elevatorUses: (p.elevatorUses ?? 0) + 1 });
    startFloor = ELEVATOR.startFloor;
  }

  /**
   * 전체화면 요청은 **클릭 핸들러 안**에서 곧바로 해야 브라우저가 받아 준다.
   * await 하지 않는 이유도 같다 — 기다렸다 부르면 제스처 컨텍스트를 벗어난다.
   * 실패해도(아이폰 등) 게임은 그대로 시작한다.
   */
  enterFullscreen().then((ok) => { if (ok) lockPortrait(); });

  /**
   * ★ 인게임 코드는 **여기서** 받는다 (2026-08-19 13차, `game/loadGame.js`).
   * 전체화면 요청보다 **뒤에** 있는 게 중요하다 — `await` 를 먼저 하면 제스처
   * 컨텍스트를 벗어나 브라우저가 전체화면을 거절한다(§9-0-2 에서 한 번 데였다).
   * 부팅 직후에 미리 받아 두므로(`prefetchGame`) 보통은 마이크로태스크 하나다.
   */
  starting = true;
  let GameScene;
  try {
    ({ GameScene } = await loadGameModule());
  } finally {
    starting = false;
  }
  navigator.toCanvas();
  Scene.reset(
    new GameScene({
      difficulty: p.difficulty,
      charId: p.selectedCharacter,
      controlMode: p.controlMode,
      // 설정 → 싱글게임 배경설정. 'random' 이면 GameScene 이 시드로 뽑는다 (2026-08-19)
      buildingId: p.singleBg,
      startFloor,
      onFinish: handleFinish,
      /**
       * ★ **죽는 그 순간 계정에 반영한다.** (2026-08-18)
       * 예전에는 게임오버 화면의 버튼을 눌러야만 저장돼서, 죽자마자 앱을 닫으면
       * 그 판의 계단·신발·도감이 전부 사라졌다. (`GameScene.finish()` 주석 참고)
       */
      onCommit: (result) => { try { finishRun(result); } catch (e) { console.warn('[game] 결과 반영 실패', e); } },
    })
  );
  return true;
}

/**
 * 판이 끝났을 때 GameScene이 부른다.
 * 결과는 어느 쪽이든 **먼저 반영**한다 — 다시하기를 눌렀다고 방금 주운 신발이 사라지면 안 된다.
 * @param {{floor:number, difficulty:string, shoeIndices:number[]}} result
 * @param {'home'|'retry'} action
 */
export function handleFinish(result, action) {
  // result 가 null 이면 이미 `onCommit` 에서 반영했다는 뜻이다 (이중 집계 방지)
  if (result) { try { finishRun(result); } catch (e) { console.warn('[game] 결과 반영 실패', e); } }
  if (action === 'retry') {
    startGame(nav, {});   // 전체화면은 유지된다
    return;
  }
  exitFullscreen();       // 로비는 브라우저 UI가 있는 편이 낫다
  /**
   * ★ **씬 스택을 반드시 비운다.** (2026-08-16)
   * 이게 없어서 로비·도감을 보는 내내 죽은 GameScene 을 60fps 로 계속 그리고 있었다.
   * 자세한 내용은 core/scene.js 의 `clear()` 주석.
   */
  Scene.clear();
  nav.reset(Lobby);
}
