/**
 * 줄넘기 챔피언 — 스테이지 고르기 (10개). 난이도마다 별 · 최고 점수 · 잠금이 따로다.
 * 앞 스테이지를 깨면(별 1개 이상) 다음이 열린다.
 */

import { el, backButton, screen, title, segmented, toast } from '../ui.js';
import * as J from '../../services/jumprope.js';
import { STAGES, DIFFS, DIFF_KEYS } from '../../games/jumprope/data.js';
import { stageCount } from '../../games/jumprope/engine.js';
import { stageThumb } from '../../games/jumprope/art.js';
import { ensureJrStyle } from './jrui.js';
import JrReady from './JrReady.js';

const SEG = DIFF_KEYS.map((k) => ({ value: k, label: DIFFS[k].label }));
const thumbs = new Map();
const thumb = (theme) => {
  if (!thumbs.has(theme)) thumbs.set(theme, stageThumb(theme, 96, 54, 1));
  const c = thumbs.get(theme);
  const copy = c.cloneNode(false);
  copy.getContext('2d').drawImage(c, 0, 0);
  return copy;
};

export default function JrStages(nav) {
  ensureJrStyle();
  return {
    render() {
      const j = J.jr();
      const diff = j.diff;
      const stars = (n) => el('span.jr-stars', null, [el('b', '★'.repeat(n)), '★'.repeat(3 - n)]);
      return screen(
        title('스테이지'),
        segmented(SEG, diff, (v) => { J.setDiff(v); nav.refresh(); }),
        el('div.hint', `${DIFFS[diff].label} — 별 ${J.starsIn(j, diff)}/30`),
        el('div.jr-list', null, STAGES.map((st) => {
          const open = J.stageUnlocked(st.no, diff, j);
          const n = j.stars[diff][st.no - 1] | 0;
          const best = j.scores[diff][st.no - 1] | 0;
          return el('button.jr-stage', {
            type: 'button',
            class: open ? '' : 'locked',
            onclick: () => {
              if (!open) { toast('앞 스테이지를 먼저 깨 주세요!', 1800); return; }
              nav.push(JrReady, { mode: 'stage', stageNo: st.no });
            },
          }, [
            thumb(st.theme),
            el('div.jr-stage-body', null, [
              el('div.jr-stage-name', `${st.no}. ${open ? st.name : '???'}`),
              el('div.jr-stage-sub', open ? `${stageCount(st)}번 넘기${best ? ` · 최고 ${best.toLocaleString('en-US')}점` : ''}` : '잠겨 있어요'),
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

