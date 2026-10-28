/**
 * S30 캐치볼 — 게임 화면. (2026-10-28, 오락실 3번째 게임)
 *
 * `DragonGame.js` 와 같은 방식이다 — 게임은 모듈(`games/catch/catchball.js`)이고
 * 여기서 붙였다 뗀다. 오락실 루프 멈추기 · 뒤로가기 가로채기 · 접속 상태도 같은 자리에서 한다.
 *
 * 포털 카드를 누르면 **곧바로 이 화면**이다. 게임 타이틀이 로비 역할을 한다
 * (혼자 하기 · 친구랑 1:1 대결 · 나가기 · 유니폼 · 최고 기록).
 *
 * ## 1:1 대결 (`mode: 'duel'`)
 * 게임 모듈은 Firebase 를 모른다. 여기서
 *   · 방을 구독해 **상대 칸**을 `setRemote` 로 넣고
 *   · 게임이 `send` 로 주는 값을 **내 칸**에 쓴다 (`Room.publishCatch`).
 * 5초마다 생존 신호를 보낸다 — 상대 화면이 30초 동안 신호를 못 받으면 내가 나간 것으로 본다.
 *
 * 걸린 것이 없는 친선 대결이라 정산이 없다. 승패는 계정 기록(`catchWins/catchLosses`)에만 남는다.
 *
 * ## 꾸미기 · 선물함 · 명예의 전당 (2026-10-29)
 * 게임이 콜백으로 알려 주면 여기서 프로필에 적는다 — onLook · onProgress · onClaim · onFinish.
 * 순위 문서(`catchPlayers/{uid}`)는 프로필이 바뀔 때 `services/catchRank.js` 가 몰아서 올린다.
 * 대결 상대의 모습은 그 순위 문서에서 읽어 와 게임에 넣는다(`setOppLook`) — 못 읽으면 팀 모자 친구 모습.
 */

import S from '../config/strings.ko.js';
import { el, toast } from './ui.js';
import { get as getProfile, finishCatchRun, recordCatchDuel, setCatchTeam, setCatchDifficulty, catchBests,
  catchCombos, catchProgress, saveCatchProgress, saveCatchOwned, setCatchLook } from '../services/profile.js';
import { fetchCatchLook, syncCatchPlayer } from '../services/catchRank.js';
import { unlockOrientation } from '../core/fullscreen.js';
import { setGameGuard } from './router.js';
import { stopLoop, startLoop, isRunning } from '../core/loop.js';
import * as Scene from '../core/scene.js';
import * as Presence from '../services/presence.js';
import * as Room from '../services/multiplayer.js';
import { currentUser } from '../services/auth.js';
import { MULTI } from '../config/balance.js';
import { lazyScreen } from './lazyScreen.js';

const CatchMultiMenu = lazyScreen(() => import('./multi/CatchMultiMenu.js'), S.catchDuelTitle);
const CatchRanking = lazyScreen(() => import('./CatchRanking.js'), S.catchRankTitle);

/** 혼자 하기 · 대결 공통 — 꾸미기 · 성장 · 선물 */
function lookOpts(p) {
  return {
    team: p.catchTeam || 'red',
    look: p.catchLook || null,
    progress: catchProgress(p),
    onLook(look, code) { setCatchLook(code, look?.team); },
    onProgress(pr) { saveCatchProgress(pr); },
    onClaim(o) { saveCatchOwned(o); },
  };
}

/** 게임 코드는 누를 때 받는다 — 다른 게임만 하는 사람의 부팅 번들에 넣지 않는다 */
let mod = null;
export async function loadCatch() {
  if (!mod) mod = await import('../games/catch/catchball.js');
  return mod;
}

/**
 * @param {object} nav
 * @param {{mode?:'solo'|'duel', code?:string, room?:object}} opt
 */
export default function CatchGame(nav, opt = {}) {
  const duelCode = opt.mode === 'duel' ? (opt.code || null) : null;
  let live = true;
  let stoppedArcadeLoop = false;
  let unsubRoom = null;
  let beat = null;
  /** 승패는 한 판에 한 번만 센다 */
  let recorded = false;
  /** 방을 이미 나갔다 / 다음 판을 하려고 자리를 지킨다 */
  let left = false;
  let keepSeat = false;

  function leaveDuelRoom() {
    if (!duelCode || left || keepSeat) return;
    left = true;
    Room.leaveRoom(duelCode).catch(() => {});
  }

  async function rematch() {
    const r = await Room.resetRoom(duelCode).catch(() => false);
    if (!live) return;
    if (r === 'ok') {
      keepSeat = true;
      const { default: WaitingRoom } = await import('./multi/WaitingRoom.js');
      if (live) nav.replace(WaitingRoom, { code: duelCode, game: 'catch' });
      return;
    }
    toast(S.catchRematchFailed, 2400);
  }

  function mountDuel(m, host) {
    const p = getProfile();
    const room = opt.room || {};
    const myUid = currentUser()?.uid;
    const players = room.players || {};
    const oppUid = Object.keys(players).find((u) => u !== myUid && !players[u]?.waiting) || null;
    const opp = (oppUid && players[oppUid]) || {};
    /* 먼저 던지는 사람 — 방장. 방장이 둘 중에 없으면 uid 순서로 (누가 계산해도 같다) */
    const iStart = players[room.hostUid] && oppUid
      ? room.hostUid === myUid
      : String(myUid) < String(oppUid);
    const startAt = Number(room.startAt) || Date.now();

    /* 내 모습을 순위 문서에 올려 둔다 — 상대 화면이 거기서 읽는다 */
    syncCatchPlayer().catch(() => {});
    let oppLook = null;
    if (oppUid) fetchCatchLook(oppUid).then((code) => { if (!live || !code) return; oppLook = code; mod?.setOppLook?.(code); });

    Room.msUntilStart(startAt).catch(() => 3000).then((ms) => {
      if (!live) return;
      m.mount(host, {
        mode: 'duel',
        ...lookOpts(p),
        duel: {
          oppLook,
          gid: String(startAt % 1000000),
          iStart,
          myName: p.nickname || '나',
          difficulty: room.difficulty || 'normal',
          oppName: opp.nickname || '상대',
          startInMs: Math.max(0, Math.min(8000, ms)),
          absentMs: MULTI.absentSeconds * 1000,
          send(fields) { if (live) Room.publishCatch(duelCode, fields).catch(() => {}); },
          onEnd(res) {
            if (!recorded) { recorded = true; recordCatchDuel(!!res.win); }
            Room.endCatchRound(duelCode).catch(() => {});
          },
        },
        onExit(kind) {
          if (!live) return;
          if (kind === 'rematch') { rematch(); return; }
          if (kind === 'forfeit' && !recorded) { recorded = true; recordCatchDuel(false); }
          if (kind === 'forfeit') Room.endCatchRound(duelCode).catch(() => {});
          leaveDuelRoom();
          nav.back();
        },
      });

      unsubRoom = Room.subscribeRoom(duelCode, (r) => {
        if (!live || !mod) return;
        if (!r) { mod.setRemote(null); return; }
        const me = currentUser()?.uid;
        const ou = oppUid || Object.keys(r.players || {}).find((u) => u !== me) || null;
        mod.setRemote(ou && r.players ? (r.players[ou] ?? null) : null);
      });
      Room.heartbeat(duelCode).catch(() => {});
      beat = setInterval(() => Room.heartbeat(duelCode).catch(() => {}), MULTI.heartbeatMs);
    });
  }

  return {
    onLeave() {
      live = false;
      unsubRoom?.(); unsubRoom = null;
      clearInterval(beat);
      setGameGuard(null);
      unlockOrientation();
      if (mod) mod.unmount();
      /* 대결 화면을 다른 길(하드웨어 뒤로가기 등)로 벗어났으면 방에서도 나간다 */
      leaveDuelRoom();
      Presence.setState('lobby', 'catch');
      if (stoppedArcadeLoop) { startLoop(Scene.updateCurrent, Scene.renderAll); stoppedArcadeLoop = false; }
    },

    render() {
      const host = el('div.dg-host');

      loadCatch().then((m) => {
        if (!live) return;
        /* 캐치볼은 제 rAF 루프를 돈다 — 오락실 루프는 잠깐 멈춘다 (DragonGame 과 같은 이유) */
        if (isRunning()) { stopLoop(); stoppedArcadeLoop = true; }
        Presence.setState('playing', 'catch');
        /* ESC · 안드로이드 뒤로가기 — 혼자면 일시정지, 대결이면 기권할지 묻는다 */
        setGameGuard(() => m.requestPause());
        if (duelCode) { mountDuel(m, host); return; }

        const p = getProfile();
        m.mount(host, {
          mode: 'solo',
          ...lookOpts(p),
          difficulty: p.catchDifficulty || 'normal',
          bests: catchBests(p),
          combos: catchCombos(p),
          duelRecord: { wins: p.catchWins | 0, losses: p.catchLosses | 0 },
          onFinish(r) { finishCatchRun(r); },
          onDifficulty(d) { setCatchDifficulty(d); },
          onTeam(t) { setCatchTeam(t); },
          onDuel() { if (live) nav.push(CatchMultiMenu); },
          onRanking() { if (live) nav.push(CatchRanking, { diff: getProfile().catchDifficulty }); },
          onExit() { if (live) nav.back(); },
        });
      }).catch((e) => {
        console.warn('[catch] 게임을 받지 못했다', e);
        if (live) { toast(S.catchLoadFailed, 3200); nav.back(); }
      });

      return el('div.dragon-stage', null, [
        el('div.dragon-loading', S.catchLoading),
        host,
      ]);
    },
  };
}
