/**
 * 점프 피아노 — 점프 피아노 챔피언십 5대회 고르기.
 * 줄넘기 챔피언 `JrStages.js` 를 복사해 이름만 바꿨다 — 별 · 점수는 피아노 기록(`jp`)이다.
 * 난이도마다 별 · 최고 점수 · 잠금이 따로다. 앞 대회를 완주(별 1개+)하면 다음이 열린다.
 * 칸 그림은 그 대회장(도트) — 게임과 같은 그림 코드(beatArt.drawArena).
 */

import { el, backButton, screen, title, segmented, toast } from '../ui.js';
import * as J from '../../services/jumppiano.js';
import { DIFFS as DIFF_INFO, DIFF_KEYS } from '../../games/jumprope/data.js';
import { STAGES } from '../../games/jumprope/beat/stages.js';
import * as BA from '../../games/jumprope/beat/beatArt.js';
import { ensureJpStyle } from './jpui.js';
import JpReady from './JpReady.js';

const SEG = DIFF_KEYS.map((k) => ({ value: k, label: DIFF_INFO[k].label }));
export function arenaThumb(arena, w = 96, h = 54, scale = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  try { BA.drawArena(c.getContext('2d'), arena, w, h, h - 10, 2.2, { energy: 2 }); } catch { /* 그림이 없으면 빈 칸 */ }
  c.style.width = `${w * scale}px`;
  c.style.height = `${h * scale}px`;
  c.style.imageRendering = 'pixelated';
  return c;
}
const bpmRange = (st) => { const b = st.tempo.map((x) => x.bpm); return `${Math.min(...b)}~${Math.max(...b)}`; };

export default function JpStages(nav) {
  ensureJpStyle();
  return {
    render() {
      const j = J.jp();
      const diff = j.diff;
      const stars = (n) => el('span.jr-stars', null, [el('b', '★'.repeat(n)), '★'.repeat(3 - n)]);
      return screen(
        title('점프 피아노 챔피언십'),
        segmented(SEG, diff, (v) => { J.setDiff(v); nav.refresh(); }),
        el('div.hint', `${DIFF_INFO[diff].label} — 별 ${J.champStars(j, diff)}/${J.CHAMP_STAGES * 3} · 곡 하나 = 한 판 약 60초`),
        el('div.jr-list', null, STAGES.map((st) => {
          const open = J.champUnlocked(st.no, diff, j);
          const n = j.stars[diff][st.no - 1] | 0;
          const best = j.scores[diff][st.no - 1] | 0;
          return el('button.jr-stage', {
            type: 'button',
            class: open ? '' : 'locked',
            onclick: () => {
              if (!open) { toast('앞 대회를 먼저 완주해 주세요!', 1800); return; }
              nav.push(JpReady, { mode: 'stage', stageNo: st.no });
            },
          }, [
            arenaThumb(st.arena),
            el('div.jr-stage-body', null, [
              el('div.jr-stage-name', `${st.no}. ${open ? st.name : '???'}`),
              el('div.jr-stage-sub', open ? `${st.en} · BPM ${bpmRange(st)}` : '잠겨 있어요'),
              el('div.jr-stage-sub', open ? `♪ ${st.song.title}${best ? ` · 최고 ${best.toLocaleString('en-US')}점` : ''}` : ''),
            ]),
            stars(n),
          ]);
        })),
        el('div.spacer'),
        backButton('게임 로비로', () => nav.back()),
      );
    },
  };
}
