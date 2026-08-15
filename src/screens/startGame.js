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
import { nav } from './router.js';
import Lobby from './Lobby.js';

/**
 * @param {object} navigator router.nav
 * @param {{useElevator?:boolean}} opt
 */
export function startGame(navigator, opt = {}) {
  const p = getProfile();

  // 엘리베이터는 **누르는 즉시** 차감한다 (기획서 §5-8-1 "도중에 나가도 환불 없음")
  let startFloor = 0;
  if (opt.useElevator) {
    if (!L.consumeShoes(ELEVATOR.cost)) return false;
    L.patchProfile({ elevatorUses: (p.elevatorUses ?? 0) + 1 });
    startFloor = ELEVATOR.startFloor;
  }

  const { GameScene } = window.__gameModule;
  navigator.toCanvas();
  Scene.reset(
    new GameScene({
      difficulty: p.difficulty,
      charId: p.selectedCharacter,
      controlMode: p.controlMode,
      startFloor,
      onFinish: handleFinish,
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
  if (result) finishRun(result);
  if (action === 'retry') startGame(nav, {});
  else nav.reset(Lobby);
}
