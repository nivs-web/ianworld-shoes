/**
 * 부트스트랩 — M2: 바로 싱글 게임으로 진입한다.
 * (M5에서 로그인 → 포털 → 로비 흐름으로 교체)
 */

import { initCanvas } from './core/canvas.js';
import { initInput, setInputEnabled } from './core/input.js';
import { startLoop, stopLoop, bindVisibility } from './core/loop.js';
import * as Scene from './core/scene.js';
import { GameScene } from './game/GameScene.js';

// 오버레이에서 재시작할 때 순환 import를 피하기 위한 전역 훅
window.__gameModule = { GameScene };

function hideBoot() {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('hidden');
  setTimeout(() => boot.remove(), 300);
}

async function boot() {
  initCanvas();
  initInput();
  setInputEnabled(true);

  const scene = new GameScene({ difficulty: 'normal', charId: 'ian', controlMode: 1 });
  Scene.push(scene);

  // 개발/테스트 훅
  window.__dbg = { Scene, scene };

  const update = (dt) => Scene.updateCurrent(dt);
  const render = () => Scene.renderAll();
  startLoop(update, render);
  bindVisibility(
    () => stopLoop(),
    () => startLoop(update, render)
  );

  hideBoot();
}

boot().catch((err) => {
  console.error(err);
  const boot = document.getElementById('boot');
  if (boot) boot.textContent = '실행에 실패했습니다';
});
