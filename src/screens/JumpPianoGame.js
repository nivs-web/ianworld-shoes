/**
 * 줄넘기 피아노 — 게임 화면 래퍼 (줄넘기 챔피언의 JumpRopeGame 을 줄인 것: 멀티 · 아이템 · 서버 저장 없음).
 * 설정과 최고 점수는 localStorage(`jp.v1`) 에만 둔다.
 */
import { el, toast } from './ui.js';
import { setGameGuard } from './router.js';
import { stopLoop, startLoop, isRunning } from '../core/loop.js';
import * as Scene from '../core/scene.js';
import * as J from '../services/jumprope.js';
import { tunes } from '../services/tuning.js';

const KEY = 'jp.v1';
export function pianoLoad() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* */ }
  return { ctrl: o.ctrl === 'both' ? 'both' : 'jump', diff: ['easy', 'normal', 'hard'].includes(o.diff) ? o.diff : 'normal', best: o.best || {} };
}
export function pianoSave(patch) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...pianoLoad(), ...patch })); } catch { /* */ }
}

export default function JumpPianoGame(nav, params = {}) {
  let live = true, stopped = false, mod = null;
  const mode = params.mode === 'endless' ? 'endless' : 'stage';
  const stageNo = Math.max(1, Math.min(5, params.stageNo | 0 || 1));
  return {
    onLeave() {
      live = false; setGameGuard(null);
      if (mod) mod.unmount();
      if (stopped) { startLoop(Scene.updateCurrent, Scene.renderAll); stopped = false; }
    },
    render() {
      const host = el('div.dg-host');
      import('../games/jumppiano/beat/rhythm.js').then((m) => {
        if (!live) return;
        mod = m;
        if (isRunning()) { stopLoop(); stopped = true; }
        setGameGuard(() => m.requestPause());
        const st = pianoLoad(), j = J.jr();
        const bk = `${st.ctrl}:${st.diff}:${mode === 'endless' ? 'endless' : stageNo}`;
        m.mount(host, {
          mode, stageNo, diff: st.diff, ctrl: st.ctrl, tune: tunes('jump'),
          look: J.look(j), rope: J.rope(j), items: {}, opts: j.opts,
          best: st.best[bk] | 0, comboRec: 0, hasNext: false,
          onFinish: (r) => {
            const sc = r.score | 0;
            if (sc > (st.best[bk] | 0)) pianoSave({ best: { ...pianoLoad().best, [bk]: sc } });
            return null;
          },
          onSound: (on) => J.setOpt('sound', on),
          onExit(kind) {
            if (!live) return;
            if (kind === 'retry') nav.replace(JumpPianoGame, params); else nav.back();
          },
        });
      }).catch((e) => { console.warn('[PIANO] 게임을 받지 못했다', e); if (live) { toast('게임을 불러오지 못했어요. 잠시 뒤 다시 해 주세요.', 3200); nav.back(); } });
      return el('div.dragon-stage', null, [el('div.dragon-loading', '줄넘기 피아노 준비 중…'), host]);
    },
  };
}
