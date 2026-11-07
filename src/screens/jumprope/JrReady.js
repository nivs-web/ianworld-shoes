/**
 * 줄넘기 챔피언 · ROPE BEAT — 판 시작 전 «준비» 화면. 대회 소개(곡 · BPM · 새 기술 · 목표) · 아이템 고르기 · 시작.
 * 시작하면 이 화면을 게임으로 **바꿔 끼운다**(replace) — 게임에서 나오면 대회 목록(또는 로비)으로 간다.
 *
 * @param {{mode:'stage'|'endless', stageNo?:number}} params
 */

import { el, button, backButton, screen, title, toast } from '../ui.js';
import * as J from '../../services/jumprope.js';
import { DIFFS, ITEMS } from '../../games/jumprope/data.js';
import { STAGES, ENDLESS } from '../../games/jumprope/beat/stages.js';
import { TECHS, buildChart } from '../../games/jumprope/beat/chart.js';
import { goalsFor } from '../../games/jumprope/beat/judge.js';
import { itemIcon, figureCanvas } from '../../games/jumprope/art.js';
import { ensureJrStyle, candyTag } from './jrui.js';
import { arenaThumb } from './JrStages.js';
import { lazyScreen } from '../lazyScreen.js';

const JumpRopeGame = lazyScreen(() => import('../JumpRopeGame.js'), '줄넘기 챔피언');
const JrShop = lazyScreen(() => import('./JrShop.js'), '상점');
const techName = (id) => (TECHS?.[id]?.name ? `${TECHS[id].name}(${TECHS[id].en || id})` : id);

export default function JrReady(nav, params = {}) {
  ensureJrStyle();
  const sel = {};
  const mode = params.mode === 'endless' ? 'endless' : 'stage';
  const no = Math.max(1, Math.min(J.CHAMP_STAGES, params.stageNo | 0 || 1));
  JumpRopeGame.prefetch?.();

  return {
    render() {
      const j = J.jr();
      const diff = j.diff;
      const D = DIFFS[diff];
      let info;
      if (mode === 'stage') {
        const st = STAGES[no - 1];
        const n = j.stars[diff][no - 1] | 0;
        const bpms = st.tempo.map((x) => x.bpm);
        const story = st.sections.filter((x) => x.cue).map((x) => (x.cue === 'SLOW DOWN' ? '▼느려짐' : '▲빨라짐')).join(' ');
        let gl = st.goals, notes = 0;
        try { const ch = buildChart(no, diff, { seed: 7 + no * 31, ctrl: J.ctrlMode(j) }); notes = ch.total; gl = goalsFor(st.goals, diff, ch.goalScale, ch.total) || st.goals; } catch { /* 표의 목표 그대로 */ }
        info = [
          title(`${no}. ${st.name}`),
          el('div.jr-preview', null, [arenaThumb(st.arena, 150, 75, 2)]),
          el('div.jr-box', null, [
            el('h4', `${st.en} · ♪ ${st.song.title}`),
            el('div', `BPM ${Math.min(...bpms)}~${Math.max(...bpms)} · ${story} · 약 60초`),
            el('div', `새 기술: ${st.newTechs.map(techName).join(' · ')}`),
            el('div', `노트 ${notes}개 · ★★★ 목표: 최대 콤보 ${gl.combo} · PERFECT ${gl.perfect}`),
            el('div', `난이도 ${D.label} · 내 별 ${'★'.repeat(n)}${'☆'.repeat(3 - n)} · 최고 ${(j.scores[diff][no - 1] | 0).toLocaleString('en-US')}점`),
          ]),
        ];
      } else {
        info = [
          title('무한 줄넘기'),
          el('div.jr-preview', null, [figureCanvas(J.look(j), J.rope(j), 3, { w: 44, h: 68 })]),
          el('div.jr-box', null, [
            el('h4', `♪ ${ENDLESS.song.title} — BPM ${ENDLESS.startBpm}에서 8마디마다 +${ENDLESS.stepBpm}`),
            el('div', J.ctrlMode(j) === 'both' ? '하드 모드: 줄에 걸리면(JUMP 놓침) 바로 끝! ROPE 를 세 번 놓쳐도 끝.' : '줄에 걸리면(JUMP 놓침) 체력이 줄어요 — 네 번 걸리면 끝! 잘 뛰면 체력이 다시 차올라요.'),
            el('div', `난이도 ${D.label} · 내 최고 ${j.endless[diff]}번 · 명예의 전당에 올라가요`),
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
