/**
 * S51 이안 드래곤 게임 — 가로 게임 화면 래퍼. (2026-11-10)
 *
 * 줄넘기 · 드래곤과 같은 방식 : 게임은 모듈(`games/iandragon_game/index.js`)이고 여기서 붙였다 뗀다.
 * 오락실 루프 멈추기 · 뒤로가기(=일시정지) 가로채기도 여기서 한다.
 *
 * ## 가로 전용 (기획서 11.0 · 대표님 결정 «세로 모드는 없다»)
 * - 안드로이드 : 로비에서 전체화면을 켜고 왔으니 여기서 가로로 잠근다 (`lockLandscape`).
 * - 아이폰 : 잠금이 없다 → 게임 모듈이 세로를 감지해 «가로로 돌려 주세요» + 자동 일시정지.
 * - PC · 가로 폰 : 오락실은 앱 전체를 폭 450 안에 가둔다(reset.css, 11/6). 이 게임 화면에 있는 동안만
 *   `html.idg-wide` 로 그 틀을 풀어 창 전체를 쓰고, 나가면 원래대로 돌린다.
 *
 * ## 접속 표시 · 판 수
 * RTDB 규칙의 `game` 칸 · 통계 규칙이 아직 이 게임(`idragon`)을 모른다. 모르는 값을 쓰면 쓰기 전체가
 * 거부되므로, 규칙이 게시되기 전까지는 접속 표시 · `countPlay` 를 부르지 않는다 (멀티 기획 7장).
 */

import S from '../config/strings.ko.js';
import { el, toast } from './ui.js';
import { setGameGuard } from './router.js';
import { stopLoop, startLoop, isRunning } from '../core/loop.js';
import * as Scene from '../core/scene.js';
import { lockLandscape, unlockOrientation } from '../core/fullscreen.js';
import * as G from '../services/iandragonGame.js';
import '../styles/iandragon-game.css';

let mod = null;
export async function loadIanDragonGame() {
  if (!mod) mod = await import('../games/iandragon_game/index.js');
  return mod;
}

export default function IanDragonGame(nav) {
  let live = true;
  let stoppedArcadeLoop = false;
  document.documentElement.classList.add('idg-wide');
  lockLandscape();

  return {
    onLeave() {
      live = false;
      setGameGuard(null);
      if (mod) mod.unmount();
      document.documentElement.classList.remove('idg-wide');
      unlockOrientation();
      if (stoppedArcadeLoop) { startLoop(Scene.updateCurrent, Scene.renderAll); stoppedArcadeLoop = false; }
    },
    render() {
      const host = el('div.dg-host');
      loadIanDragonGame().then((m) => {
        if (!live) return;
        if (isRunning()) { stopLoop(); stoppedArcadeLoop = true; }
        setGameGuard(() => m.requestPause());
        m.mount(host, {
          save: G.idg(),
          stageNo: G.takePickedStage(),
          text: { rotate: S.idgRotate, rotateSub: S.idgRotateSub, exit: S.idgExit },
          onSave: (part) => G.saveIdg(part),
          onExit() { if (live) nav.back(); },
        });
      }).catch((e) => {
        console.warn('[이안 드래곤] 게임을 받지 못했다', e);
        if (live) { toast(S.idgLoadFailed, 3200); nav.back(); }
      });
      return el('div.dragon-stage.idg-stage', null, [el('div.dragon-loading', S.idgLoading), host]);
    },
  };
}
