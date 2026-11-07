/**
 * 줄넘기 챔피언 — 판 시작 전 «준비» 화면. 스테이지 소개 · 이번 판에 쓸 아이템 고르기 · 시작.
 * 시작하면 이 화면을 게임으로 **바꿔 끼운다**(replace) — 게임에서 나오면 스테이지 목록(또는 로비)으로 간다.
 *
 * @param {{mode:'stage'|'endless', stageNo?:number}} params
 */

import { el, button, backButton, screen, title, toast } from '../ui.js';
import * as J from '../../services/jumprope.js';
import { STAGES, DIFFS, ITEMS } from '../../games/jumprope/data.js';
import { stageCount, JUDGE_LABEL } from '../../games/jumprope/engine.js';
import { stageThumb, itemIcon, figureCanvas } from '../../games/jumprope/art.js';
import { ensureJrStyle, candyTag } from './jrui.js';
import { lazyScreen } from '../lazyScreen.js';

const JumpRopeGame = lazyScreen(() => import('../JumpRopeGame.js'), '줄넘기 챔피언');
const JrShop = lazyScreen(() => import('./JrShop.js'), '상점');

export default function JrReady(nav, params = {}) {
  ensureJrStyle();
  const sel = {};
  const mode = params.mode === 'endless' ? 'endless' : 'stage';
  const no = Math.max(1, Math.min(10, params.stageNo | 0 || 1));
  JumpRopeGame.prefetch?.();

  return {
    render() {
      const j = J.jr();
      const diff = j.diff;
      const D = DIFFS[diff];
      let info;
      if (mode === 'stage') {
        const st = STAGES[no - 1];
        const ps = J.playStage(st, diff, false, j);
        const n = j.stars[diff][no - 1] | 0;
        info = [
          title(`${no}. ${st.name}`),
          el('div.jr-preview', null, [stageThumb(st.theme, 150, 75, 2)]),
          el('div.jr-box', null, [
            el('h4', st.intro),
            el('div', `${stageCount(st)}번 넘기 · 하트 ${ps.hearts}개 · 판정 ${JUDGE_LABEL[ps.judge]} · 도우미 링 ${ps.ring ? '켜짐' : '꺼짐'}`),
            el('div', `난이도 ${D.label} · 별 ${'★'.repeat(n)}${'☆'.repeat(3 - n)} · 최고 ${(j.scores[diff][no - 1] | 0).toLocaleString('en-US')}점`),
          ]),
        ];
      } else {
        info = [
          title('무한 줄넘기'),
          el('div.jr-preview', null, [figureCanvas(J.look(j), J.rope(j), 3, { w: 44, h: 68 })]),
          el('div.jr-box', null, [
            el('h4', '하트가 다 떨어질 때까지 몇 번 넘을 수 있을까요?'),
            el('div', '처음 10번은 같은 박자 · 그다음부터 빨라지고 흔들려요 · 30번부터 멈칫, 50번부터 2단 뛰기!'),
            el('div', `난이도 ${D.label} · 내 최고 ${j.endless[diff]}개 · 명예의 전당에 올라가요`),
          ]),
        ];
      }

      const items = ITEMS.map((it) => {
        const have = j.items[it.id] | 0;
        const on = !!sel[it.id] && have > 0;
        return el('div.jr-item', { class: on ? 'on' : '' }, [
          itemIcon(it.id, 2),
          el('div.jr-item-body', null, [
            el('div.jr-item-name', `${it.name} (${have}개)`),
            el('div.jr-item-desc', it.desc),
          ]),
          have > 0
            ? button(on ? '쓰기 ✓' : '안 씀', () => { sel[it.id] = !sel[it.id]; nav.refresh(); }, { primary: on, sfx: 'sfx_menu_move' })
            : button('사러 가기', () => nav.push(JrShop, { tab: 'item' })),
        ]);
      });

      return screen(
        ...info,
        el('div.diff-title', '이번 판에 쓸 아이템'),
        candyTag(j.candy),
        el('div.jr-list', null, items),
        el('div.spacer'),
        button('시작!', () => {
          const pick = Object.fromEntries(Object.entries(sel).filter(([k, v]) => v && (j.items[k] | 0) > 0));
          if (Object.keys(pick).length) toast(`아이템 사용: ${ITEMS.filter((x) => pick[x.id]).map((x) => x.name).join(', ')}`, 1600);
          nav.replace(JumpRopeGame, { mode, stageNo: no, itemSel: pick });
        }, { primary: true }),
        backButton('뒤로', () => nav.back()),
      );
    },
  };
}
