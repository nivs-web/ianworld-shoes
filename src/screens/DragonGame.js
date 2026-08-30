/**
 * S20 드래곤 스트라이커 — 게임 화면.
 *
 * ★ **iframe 을 걷어냈다.** (2026-08-26 B단계)
 *
 * 예전에는 `public/dragon/index.html` 을 iframe 으로 띄우고 postMessage 로만 오갔다.
 * 붙이기는 쉬웠지만 **화면 아무 데나 터치하면 키보드가 죽었다** — 포커스가 부모로
 * 가면 keydown 이 게임에 닿지 않는다. 실측으로 확인한 뒤 걷어냈다.
 * 전체화면·뒤로가기·소리가 따로 놀던 것도 전부 같은 뿌리였다.
 *
 * 이제 게임은 `games/dragon/dragon.js` 모듈이고, 여기서 직접 붙였다 뗀다.
 * 오가는 것은 함수 호출뿐이다.
 *
 * 캔버스는 **게임이 자기 것을 만든다.** 오락실 캔버스(`core/canvas.js`)는
 * 180x320 을 정수배로만 키우는 신발게임 전용이고, 드래곤은 1280x720 을
 * 소수배 레터박스로 맞춘다 — 같은 요소를 나눠 쓸 수 없다.
 */

import S from '../config/strings.ko.js';
import { el, toast } from './ui.js';
import { get as getProfile, finishDragonRun, setDragonCharacter , dragonEquipment , hasDragon , spendDragonCoins , patch as patchProfile } from '../services/profile.js';
import { effectsOf, startMissiles, startBombs } from '../games/dragon/items.js';
import { unlockOrientation } from '../core/fullscreen.js';
import { setGameGuard } from './router.js';
import { stopLoop, startLoop, isRunning } from '../core/loop.js';
import * as Scene from '../core/scene.js';
import * as Presence from '../services/presence.js';
import * as Room from '../services/multiplayer.js';
import { currentUser } from '../services/auth.js';

/**
 * ★ **게임 코드는 누를 때 받는다.** 신발게임만 하는 사람에게 드래곤 본체를
 * 부팅 번들로 내려보낼 이유가 없다 (`game/loadGame.js` 와 같은 이유).
 */
let mod = null;
export async function loadDragon() {
  if (!mod) mod = await import('../games/dragon/dragon.js');
  return mod;
}
/**
 * 로비에 들어오면 한가할 때 미리 받아 둔다 — 누를 때는 이미 있다.
 * 게임로비의 드래곤 그림도 이 모듈이 그려 주므로, 도착을 기다릴 수 있게
 * 프라미스를 돌려준다.
 */
export function prefetchDragon() {
  return new Promise((resolve) => {
    const go = () => loadDragon().then(resolve, resolve);
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 3000 });
    else setTimeout(go, 1200);
  });
}

/**
 * 게임로비의 「로비유저상태창」에 들어갈 드래곤 그림.
 *
 * 드래곤 도트는 게임 모듈 안의 그리드·팔레트로만 그려진다 — 그림 파일이 없다.
 * 그래서 여기서 직접 만들 수가 없고, 모듈이 도착한 뒤에야 채워진다.
 * 아직이면 **빈 자리를 같은 크기로 잡아 둔다** — 나중에 그림이 들어오면서
 * 화면이 출렁이지 않게 한다.
 */
export function dragonFigure(idx) {
  const box = el('div.dg-figure');
  if (mod && mod.dragonPortrait) box.append(mod.dragonPortrait(idx, 3));
  return box;
}

/**
 * @param {object} nav
 * @param {{mode?:'play'|'chars'|'options'}} opt
 */
export default function DragonGame(nav, opt = {}) {
  const mode = opt.mode || 'play';
  /**
   * ★ **결투면 방 코드가 온다.** (2026-08-26 F단계)
   * 코드가 있으면 1초마다 진행도를 방에 올리고, 끝나면 결과 화면으로 간다.
   * 없으면 지금까지처럼 혼자 하는 판이라 오락실 기록에만 남는다.
   */
  const duelCode = mode === 'duel' ? (opt.code || null) : null;
  let live = true;
  /** 오락실 루프를 우리가 멈췄는가 — 나갈 때 그대로 되돌려야 한다 */
  let stoppedArcadeLoop = false;
  /** 한 판은 한 번만 센다 — 결과가 두 번 와도 기록은 하나다 */
  let settled = false;
  /** 결투: 방을 지켜보는 구독 해제 함수 */
  let unsubRoom = null;

  return {
    onLeave() {
      live = false;
      unsubRoom?.(); unsubRoom = null;
      setGameGuard(null);
      unlockOrientation();
      if (mod) mod.unmount();
      Presence.setState('lobby', 'dragon');   // 드래곤 게임에서 나오면 드래곤 로비다
      /**
       * 멈춰 뒀던 오락실 루프를 되살린다. 이게 없으면 로비로 돌아온 뒤
       * 신발게임이 영영 안 돈다 — 화면은 DOM 이라 멀쩡해 보여서 늦게 발견된다.
       */
      if (stoppedArcadeLoop) { startLoop(Scene.updateCurrent, Scene.renderAll); stoppedArcadeLoop = false; }
    },

    render() {
      const host = el('div.dg-host');
      const p = getProfile();

      loadDragon().then((m) => {
        if (!live) return;                    // 받는 동안 화면을 떠났다
        /**
         * ★★ **방향은 게임이 스스로 건다.** (2026-08-27, 사용자 지정)
         *
         * 드래곤은 세로가 기본이고, 오른쪽 위 단추로 가로로 바꿀 수 있다.
         * 지금 어느 쪽인지는 게임이 들고 있는 설정에만 있으므로
         * 여기서 미리 잠그면 그 설정과 어긋난다 —
         * 게임이 `mount` 에서 제 설정대로 건다 (`applyOrientationLock`).
         */
        /**
         * ★ **오락실 루프를 멈춘다.** (2026-08-26)
         *
         * 드래곤은 제 rAF 루프를 돌린다. 그런데 오락실 루프도 계속 돌고 있어서
         * **한 프레임에 rAF 체인이 둘** 이었다. 신발게임 씬 스택은 비어 있으니
         * 그리는 건 없지만, 매 프레임 콜백·게임패드 폴링·고정 스텝 계산이
         * 공짜로 도는 것은 아니다. 게임이 도는 동안에는 하나만 돌린다.
         */
        if (isRunning()) { stopLoop(); stoppedArcadeLoop = true; }
        /**
         * ★★ **결투: 최대 4인, 각자 다른 상대를 지켜본다.** (2026-08-27, 사용자 지정)
         *
         * *"멀티 플레이 최대 4인 가능으로 만들 수 있을까? (...) 각자 맵에서
         *   각자 알아서 생존하는거고, 상대방의 움직임만 보이는거야"*
         *
         * 게임 모듈은 Firebase 를 모른다 — 알게 하면 혼자 돌려 보는 검사가
         * 불가능해진다. 그래서 **방을 여기서 읽어 게임에 넣어 준다.**
         * 예전엔 상대가 하나뿐이라 `.find()` 로 하나만 골랐다 — 이제는 나를
         * 뺀 모두를 돌며 uid 별로 넣는다. 게임은 `setDuelPeer(uid, ...)` 로
         * 받은 값만 보고 판을 끝낼지 정한다.
         */
        if (duelCode && m.setDuelPeer) {
          unsubRoom = Room.subscribeRoom(duelCode, (r) => {
            if (!live || !r || !r.players) return;
            /**
             * ★ **내 uid 는 그때그때 다시 읽는다.** (2026-08-29)
             * 예전에는 구독을 걸 때 한 번만 읽어 뒀다. 그 순간 로그인이 아직
             * 안 잡혀 있으면 `undefined` 가 되고, 그러면 아래 `uid === myUid`
             * 가 영영 거짓이라 **나 자신도 상대로 등록된다** — 그 가짜 상대는
             * 죽지 않으니 "모두 죽었는가" 가 절대 참이 안 된다.
             */
            const myUid = currentUser()?.uid;
            /** 이번 판 사람들 (대기자는 이 판 사람이 아니다) */
            const inRound = Object.entries(r.players).filter(([, v]) => v && !v.waiting);

            for (const [uid, v] of inRound) {
              if (uid === myUid) continue;
              m.setDuelPeer(uid, {
                alive: v.alive !== false, coins: v.coins | 0,
                name: v.nickname || '', dragon: v.dragon | 0, lives: v.lives,
                /* 자리는 안 왔을 수도 있다 — 규칙이 아직 게시되기 전이면 없다.
                   없으면 넣지 않는다(0,0 으로 두면 고스트가 왼쪽 위 구석에 선다) */
                ...(v.gx !== undefined && v.gy !== undefined ? { x: v.gx, y: v.gy } : {}),
                ...(v.glv !== undefined ? { lv: v.glv } : {}),
              });
            }

            /**
             * ★★★ **살아 있는 사람이 하나만 남으면 그 자리에서 끝낸다.**
             *   (2026-08-29, 사용자 지정 — "1명이 죽으면 즉시 게임이 종료되게
             *   만들어!")
             *
             * 1대1이면 상대가 죽는 그 순간 살아 있는 사람이 나 하나가 되므로
             * 곧바로 끝난다 — 사용자가 요구한 그대로다. 넷이서 하면 마지막
             * 한 명이 남을 때 끝난다(결과 화면의 정산 조건과 같은 규칙이다).
             *
             * **죽음을 두 통로로 함께 본다.** `alive` 는 진행도 채널, `lives`
             * 는 고스트 채널로 서로 다른 쓰기다 — 하나가 씹혀도 다른 하나가
             * 알려 준다. 사용자는 하트(=`lives`)가 0까지 줄어드는 것을 봤다고
             * 했으므로, 적어도 그 통로는 살아 있다.
             */
            const 죽음 = (v) => v.alive === false || v.lives === 0;
            const 살아있는수 = inRound.filter(([, v]) => !죽음(v)).length;
            if (inRound.length >= 2 && 살아있는수 <= 1 && m.endDuelNow) {
              m.endDuelNow('최후의 생존');
            }
          });
        }
        /* 접속자 목록에 '게임 중' 으로 뜨게 한다 (신발게임의 toCanvas 와 같은 자리) */
        Presence.setState('playing', 'dragon');
        /* ESC · 안드로이드 뒤로가기를 게임이 먼저 받는다 — 곧바로 나가지 않고 일시정지 */
        setGameGuard(() => m.requestPause());
        m.mount(host, {
          mode,
          difficulty: p.dragonDifficulty || 'normal',
          character: p.dragonCharacter | 0,
          /* 산 아이템의 효과. 게임은 도감을 몰라도 되게 합쳐놓은 수치만 받는다 */
          /* 산 아이템의 효과 + 계단으로 올린 초기 보유량 */
          equipment: Object.assign(effectsOf(dragonEquipment()), {
            startMissiles: startMissiles(p),
            startBombs: startBombs(p),
            /* 2P 도 산 드래곤만 고를 수 있다 — 안 산 것은 회색 실루에으로 보인다 */
            owned: Array.from({ length: 10 }, (_, i) => i).filter(hasDragon),
          }),

          /**
           * 결투 중 1초마다 — 상대 화면의 숫자가 이걸로 움직인다.
           * 혼자 하는 판에서는 아무 데도 안 간다.
           */
          /**
           * 이어하기 값을 치를 지갑. 결투에서는 안 붙인다 —
           * 결투는 한 판으로 끝나고, 판돈이 걸린 판에서 목숨을 사면 형평이 깨진다.
           */
          coins: () => (duelCode ? 0 : (getProfile().dragonCoins || 0)),
          spendCoins: (n) => (duelCode ? false : spendDragonCoins(n).ok),
          addCoins: (n) => { if (!duelCode) patchProfile({ dragonCoins: (getProfile().dragonCoins || 0) + n }); },

          onProgress(r) {
            if (!live || !duelCode) return;
            Room.publishDuelProgress(duelCode, r).catch(() => {});
          },

          /** 결투: 내 자리와 먹은 금화 (진행도와 **따로** 나간다) */
          onGhost(g) {
            if (!live || !duelCode) return;
            Room.publishGhost(duelCode, g).catch(() => {});
          },

          /** 한 판 끝 */
          onFinish(r) {
            /**
             * ★★ **래치는 결투에만 있어야 한다.** (2026-08-27, 사용자 신고)
             *
             * 예전에는 여기 맨 위에 `if (settled) return` 이 있었다. 그런데 게임은
             * **스테이지가 끝날 때마다** 이 함수를 부른다 — 20판을 깨면 스무 번이다.
             * 그래서 1스테이지 것만 들어가고 나머지 열아홉 판, 30분치 금화가
             * 통째로 버려졌다. 한 판만 하고 나가면 멀쩡해 보였던 이유이기도 하다.
             *
             * 이제 금화는 **차액**으로 오므로(게임 쪽 `RUN.banked`) 여러 번 불려도
             * 두 번 들어가지 않는다. 결투는 한 판으로 끝나고 정산이 따로 있어
             * 래치를 그대로 둔다.
             */
            if (duelCode) {
              if (settled) return;
              settled = true;
              /**
               * ★ **결투 기록은 싱글 기록에 안 섞는다.**
               * 어려움 고정에 300초짜리라 최고점수·최고 스테이지 눈금이 다르다 —
               * 섞으면 싱글 순위표가 결투 점수로 오염된다.
               * 금화도 여기서 안 넣는다: 결투의 금화는 **이긴 사람이 다 가져가므로**
               * 정산(`dragonSettle`)이 끝나고 나서야 주인이 정해진다.
               */
              Room.publishDuelProgress(duelCode, r, true).catch(() => {});
              return;
            }
            /**
             * ★ **신기록 알림을 없앴다.** (2026-08-27, 사용자 지정)
             * *"[신기록] 이라고 팝업 뜨는데 그거 없애, 신기록이던 아니던
             *   아무튼 그건 안뜨는게 맞는거 같아"*
             * 결과 화면에 점수가 이미 크게 떠 있고, 최고 기록은 순위표에서 본다.
             * 판이 끝나는 자리에 알림이 겹쳐 뜨면 표를 가린다.
             */
            finishDragonRun(r);
          },

          /** 게임 안에서 드래곤을 바꿨다 — 로비 카드에도 같은 것이 보여야 한다 */
          onCharacter(i) { setDragonCharacter(i); },

          /** 로비로 (결투면 결과 화면으로) */
          onExit() {
            if (!live) return;
            if (duelCode) {
              import('./multi/DuelResult.js')
                .then((r) => nav.replace(r.default, { code: duelCode }))
                .catch(() => nav.back());
              return;
            }
            nav.back();
          },
        });
      }).catch((e) => {
        console.warn('[dragon] 게임을 받지 못했다', e);
        if (live) { toast(S.dragonLoadFailed, 3200); nav.back(); }
      });

      return el('div.dragon-stage', null, [
        el('div.dragon-loading', S.dragonLoading),
        host,
      ]);
    },
  };
}
