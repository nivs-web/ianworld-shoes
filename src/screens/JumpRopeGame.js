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
 * ## 멀티 서바이벌 (`mode: 'survival'`, 2026-11-07)
 * 게임 모듈은 Firebase 를 모른다. 여기서 방을 구독해 `setRoom` 으로 넣고, 게임이 `publish` 로 주는
 * 내 칸(하트 · 점수 · 콤보 · 생존)을 `Room.publishJump` 로 쓴다. 5초마다 생존 신호. 시작 시각은 방의 startAt.
 *
 * @param {{mode:'stage'|'endless'|'test'|'survival', stageNo?:number, stage?:object, itemSel?:object, code?:string, room?:object}} params
 */

import { el, toast } from './ui.js';
import { setGameGuard } from './router.js';
import { stopLoop, startLoop, isRunning } from '../core/loop.js';
import * as Scene from '../core/scene.js';
import * as J from '../services/jumprope.js';
import * as Room from '../services/multiplayer.js';
import { currentUser } from '../services/auth.js';
import { MULTI } from '../config/balance.js';
import { tunes } from '../services/tuning.js';

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
  if (!params._used) params._used = mode === 'test' || mode === 'survival' ? {} : J.useItems(params.itemSel || {});
  const used = params._used;
  /* 서바이벌 — 방 */
  const code = mode === 'survival' ? params.code : null;
  let unsubRoom = null, beat = null, left = false, keepSeat = false;
  const leaveRoom = () => { if (!code || left || keepSeat) return; left = true; Room.leaveRoom(code).catch(() => {}); };
  async function rematch() {
    const r = await Room.resetRoom(code).catch(() => false);
    if (!live) return;
    if (r === 'ok') {
      keepSeat = true;
      const { default: WaitingRoom } = await import('./multi/WaitingRoom.js');
      if (live) nav.replace(WaitingRoom, { code, game: Room.GAME_JUMP });
      return;
    }
    toast('다시 시작을 준비하지 못했어요. 잠시 뒤 다시 눌러 주세요.', 2400);
  }

  return {
    onLeave() {
      live = false;
      unsubRoom?.(); unsubRoom = null;
      clearInterval(beat);
      leaveRoom();
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
        if (mode === 'survival') {
          const room = params.room || {};
          import('../services/stats.js').then((St) => St.countPlay('jump')).catch(() => {});   // 관리자 «신규 회원 가입 현황» 판 수
          m.mount(host, {
            mode, diff: room.difficulty || 'normal', seed: room.seed | 0, room, comboRec: j.comboRec | 0, tune: tunes('jump'),
            myUid: currentUser()?.uid,
            look: J.look(j), rope: J.rope(j), items: {}, opts: j.opts,
            msUntil: () => Room.msUntilStart(Number(room.startAt) || Date.now() + 3000),
            serverNow: () => Date.now() + Room.serverOffsetSync(),
            publish: (f) => { if (live) Room.publishJump(code, f).catch(() => {}); },
            onRoundOver: () => Room.endJumpRound(code).catch(() => {}),
            onFinish: (r) => J.finishSurvival(r),
            onSound: (on) => J.setOpt('sound', on),
            onExit(kind) {
              if (!live) return;
              if (kind === 'rematch') { rematch(); return; }
              leaveRoom();
              nav.back();
            },
          });
          unsubRoom = Room.subscribeRoom(code, (r) => { if (live) m.setRoom(r); });
          Room.heartbeat(code).catch(() => {});
          beat = setInterval(() => Room.heartbeat(code).catch(() => {}), MULTI.heartbeatMs);
          return;
        }
        import('../services/stats.js').then((St) => St.countPlay('jump')).catch(() => {});   // 관리자 «신규 회원 가입 현황» 판 수
        m.mount(host, {
          mode,
          stageNo,
          custom: mode === 'test' ? params.stage : null,
          diff: j.diff,
          ctrl: J.ctrlMode(j),
          song: j.opts.song,            // 무한 줄넘기 곡
          tune: tunes('jump'),          // 운영자 난이도(판정 · 촘촘함 · 빠르기 · 피해)
          look: J.look(j),
          rope: J.rope(j),
          items: used,
          opts: j.opts,
          best: mode === 'endless' ? j.endless[j.diff] : j.scores[j.diff][stageNo - 1],
          comboRec: j.comboRec | 0,
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
