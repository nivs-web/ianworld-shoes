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
import { get as getProfile, finishDragonRun, setDragonCharacter } from '../services/profile.js';
import { lockLandscape, unlockOrientation } from '../core/fullscreen.js';

/**
 * ★ **게임 코드는 누를 때 받는다.** 신발게임만 하는 사람에게 드래곤 본체를
 * 부팅 번들로 내려보낼 이유가 없다 (`game/loadGame.js` 와 같은 이유).
 */
let mod = null;
async function loadDragon() {
  if (!mod) mod = await import('../games/dragon/dragon.js');
  return mod;
}
/** 로비에 들어오면 한가할 때 미리 받아 둔다 — 누를 때는 이미 있다 */
export function prefetchDragon() {
  const go = () => loadDragon().catch(() => {});
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1200);
}

/**
 * @param {object} nav
 * @param {{mode?:'play'|'chars'|'options'}} opt
 */
export default function DragonGame(nav, opt = {}) {
  const mode = opt.mode || 'play';
  let live = true;
  /** 한 판은 한 번만 센다 — 결과가 두 번 와도 기록은 하나다 */
  let settled = false;

  return {
    onLeave() {
      live = false;
      unlockOrientation();
      if (mod) mod.unmount();
    },

    render() {
      const host = el('div.dg-host');
      const p = getProfile();

      loadDragon().then((m) => {
        if (!live) return;                    // 받는 동안 화면을 떠났다
        lockLandscape();                      // 가로 게임 (전체화면은 오락실에서 이미 켰다)
        m.mount(host, {
          mode,
          difficulty: p.dragonDifficulty || 'normal',
          character: p.dragonCharacter | 0,

          /** 한 판 끝 */
          onFinish(r) {
            if (settled) return;
            settled = true;
            const { isBest } = finishDragonRun(r);
            if (isBest) toast(S.dragonNewBest(Math.round(Number(r.score) || 0)), 2600);
          },

          /** 게임 안에서 드래곤을 바꿨다 — 로비 카드에도 같은 것이 보여야 한다 */
          onCharacter(i) { setDragonCharacter(i); },

          /** 로비로 */
          onExit() { if (live) nav.back(); },
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
