/**
 * S41 줄넘기 챔피언 — 게임 화면 래퍼. (2026-11-07, 이안오락실 5번째 게임)
 *
 * 캐치볼 · 드래곤과 같은 방식이다 — 게임은 모듈(`games/jumprope/game.js`)이고 여기서 붙였다 뗀다.
 * 오락실 루프 멈추기 · 뒤로가기(=일시정지) 가로채기도 같은 자리에서 한다.
 * 저장 · 보상은 `services/jumprope.js` 가 하고, 게임에는 요약만 돌려준다.
 *
 * ## 접속 표시
 * RTDB 규칙의 `game` 칸이 아직 'jump' 를 모른다(shoes · dragon · catch 만). 모르는 값을 쓰면
 * **접속 표시 쓰기 전체가 거부**되므로, 규칙이 게시되기 전까지는 접속 표시를 건드리지 않는다.
 * 규칙 게시 뒤 `PRESENCE_GAME = 'jump'` 로 바꾸면 «줄넘기 챔피언 하는 중»이 뜬다(docs/FIREBASE_RULES.md).
 *
 * @param {{mode:'stage'|'endless'|'test', stageNo?:number, stage?:object, itemSel?:object}} params
 */

import { el, toast } from './ui.js';
import { setGameGuard } from './router.js';
import { stopLoop, startLoop, isRunning } from '../core/loop.js';
import * as Scene from '../core/scene.js';
import * as J from '../services/jumprope.js';
import { STAGES } from '../games/jumprope/data.js';

export const PRESENCE_GAME = null;

let mod = null;
export async function loadJumpRope() {
  if (!mod) mod = await import('../games/jumprope/game.js');
  return mod;
}

export default function JumpRopeGame(nav, params = {}) {
  let live = true;
  let stoppedArcadeLoop = false;
  const mode = params.mode || 'stage';
  /* 아이템은 판을 시작할 때 쓴다 — 가진 것만 실제로 빠진다 */
  /* 화면이 다시 만들어져도(라우터) 두 번 빠지지 않게 이 판의 params 에 적어 둔다 */
  if (!params._used) params._used = mode === 'test' ? {} : J.useItems(params.itemSel || {});
  const used = params._used;

  return {
    onLeave() {
      live = false;
      setGameGuard(null);
      if (mod) mod.unmount();
      if (stoppedArcadeLoop) { startLoop(Scene.updateCurrent, Scene.renderAll); stoppedArcadeLoop = false; }
    },
    render() {
      const host = el('div.dg-host');
      loadJumpRope().then((m) => {
        if (!live) return;
        if (isRunning()) { stopLoop(); stoppedArcadeLoop = true; }
        setGameGuard(() => m.requestPause());
        const j = J.jr();
        const diff = j.diff;
        let stage = null, stageNo = 0, best = 0;
        if (mode === 'stage') {
          stageNo = Math.max(1, Math.min(10, params.stageNo | 0 || 1));
          stage = J.playStage(STAGES[stageNo - 1], diff, false, j);
          best = j.scores[diff][stageNo - 1];
        } else if (mode === 'test') {
          stage = J.playStage(params.stage, diff, true, j);
        } else {
          best = j.endless[diff];
        }
        m.mount(host, {
          mode, stage, stageNo, diff, best,
          endlessShift: J.endlessShift(diff),
          ring: j.opts.ring === 'on' ? true : j.opts.ring === 'off' ? false : undefined,
          look: J.look(j),
          rope: J.rope(j),
          items: used,
          opts: j.opts,
          hasNext: mode === 'stage' && stageNo < 10,
          onFinish: (r) => J.finishRun(r),
          onSound: (on) => J.setOpt('sound', on),
          onExit(kind) {
            if (!live) return;
            if (kind === 'retry') nav.replace(JumpRopeGame, { mode, stageNo: params.stageNo, stage: params.stage, itemSel: params.itemSel });
            else if (kind === 'next') import('./jumprope/JrReady.js').then((R) => { if (live) nav.replace(R.default, { mode: 'stage', stageNo: stageNo + 1 }); });
            else nav.back();
          },
        });
      }).catch((e) => {
        console.warn('[줄넘기] 게임을 받지 못했다', e);
        if (live) { toast('게임을 불러오지 못했어요. 잠시 뒤 다시 해 주세요.', 3200); nav.back(); }
      });
      return el('div.dragon-stage', null, [el('div.dragon-loading', '줄넘기 준비 중…'), host]);
    },
  };
}
