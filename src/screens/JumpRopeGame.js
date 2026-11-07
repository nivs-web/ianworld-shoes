/**
 * S41 줄넘기 챔피언 · ROPE BEAT — 게임 화면 래퍼. (2026-11-07, 리듬게임판)
 *
 * 캐치볼 · 드래곤과 같은 방식이다 — 게임은 모듈(`games/jumprope/beat/rhythm.js`)이고 여기서 붙였다 뗀다.
 * 오락실 루프 멈추기 · 뒤로가기(=일시정지) 가로채기도 같은 자리에서 한다.
 * 저장 · 보상은 `services/jumprope.js` 의 finishBeat 가 하고, 게임에는 요약만 돌려준다.
 *
 * ## 접속 표시
 * RTDB 규칙의 `game` 칸이 아직 'jump' 를 모른다(shoes · dragon · catch 만). 모르는 값을 쓰면
 * **접속 표시 쓰기 전체가 거부**되므로, 규칙이 게시되기 전까지는 접속 표시를 건드리지 않는다.
 *
 * @param {{mode:'stage'|'endless'|'test', stageNo?:number, stage?:object, itemSel?:object}} params
 */

import { el, toast } from './ui.js';
import { setGameGuard } from './router.js';
import { stopLoop, startLoop, isRunning } from '../core/loop.js';
import * as Scene from '../core/scene.js';
import * as J from '../services/jumprope.js';

export const PRESENCE_GAME = null;

let mod = null;
export async function loadJumpRope() {
  if (!mod) mod = await import('../games/jumprope/beat/rhythm.js');
  return mod;
}

export default function JumpRopeGame(nav, params = {}) {
  let live = true;
  let stoppedArcadeLoop = false;
  const mode = params.mode || 'stage';
  /* 아이템은 판을 시작할 때 쓴다 — 화면이 다시 만들어져도 두 번 빠지지 않게 이 판의 params 에 적어 둔다 */
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
        const stageNo = Math.max(1, Math.min(J.CHAMP_STAGES, params.stageNo | 0 || 1));
        m.mount(host, {
          mode,
          stageNo,
          custom: mode === 'test' ? params.stage : null,
          diff: j.diff,
          look: J.look(j),
          rope: J.rope(j),
          items: used,
          opts: j.opts,
          best: mode === 'endless' ? j.endless[j.diff] : j.scores[j.diff][stageNo - 1],
          hasNext: mode === 'stage' && stageNo < J.CHAMP_STAGES,
          onFinish: (r) => J.finishBeat(r),
          onSound: (on) => J.setOpt('sound', on),
          onExit(kind) {
            if (!live) return;
            if (kind === 'retry') nav.replace(JumpRopeGame, { mode, stageNo: params.stageNo, stage: params.stage, itemSel: params.itemSel });
            else if (kind === 'next') import('./jumprope/JrReady.js').then((R) => { if (live) nav.replace(R.default, { mode: 'stage', stageNo: stageNo + 1 }); });
            else nav.back();
          },
        });
      }).catch((e) => {
        console.warn('[ROPE BEAT] 게임을 받지 못했다', e);
        if (live) { toast('게임을 불러오지 못했어요. 잠시 뒤 다시 해 주세요.', 3200); nav.back(); }
      });
      return el('div.dragon-stage', null, [el('div.dragon-loading', 'ROPE BEAT 준비 중…'), host]);
    },
  };
}
