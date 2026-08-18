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

  /**
   * 전체화면 요청은 **클릭 핸들러 안**에서 곧바로 해야 브라우저가 받아 준다.
   * await 하지 않는 이유도 같다 — 기다렸다 부르면 제스처 컨텍스트를 벗어난다.
   * 실패해도(아이폰 등) 게임은 그대로 시작한다.
   */
  enterFullscreen().then((ok) => { if (ok) lockPortrait(); });

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
