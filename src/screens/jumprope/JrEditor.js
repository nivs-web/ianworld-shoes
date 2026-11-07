/**
 * 줄넘기 챔피언 — 스테이지 만들기 · 고치기 · 코드로 나누기.
 *
 * 스테이지 = 박자 조각을 차례로 쌓은 것 (같은 박자 · 랜덤 박자 · 빨라지기/느려지기 · 멈칫 · 2단 뛰기).
 * 내 스테이지는 이 기기에 최대 20개. 고치면 바로 저장된다.
 * 친구에게는 `JR1-…` 코드 한 줄로 보내고, 친구는 «코드로 가져오기»에 붙여 넣는다 — 서버를 쓰지 않는다.
 * 받은 코드는 엔진(`sanitizeStage`)이 검사해서 이상한 값은 잘라 낸다.
 */

import { el, button, backButton, screen, title, segmented, confirmDialog, toast } from '../ui.js';
import * as Sfx from '../../audio/sfx.js';
import * as J from '../../services/jumprope.js';
import { STAGES, THEMES } from '../../games/jumprope/data.js';
import { SEG_KINDS, LIMITS, JUDGE_LABEL, stageCount, buildBeats, encodeStage, decodeStage, sanitizeStage, SPEED_MIN, SPEED_MAX, segBpm } from '../../games/jumprope/engine.js';
import { stageThumb } from '../../games/jumprope/art.js';
import { buildChart } from '../../games/jumprope/beat/chart.js';
import { ensureJrStyle } from './jrui.js';
import { lazyScreen } from '../lazyScreen.js';

const JumpRopeGame = lazyScreen(() => import('../JumpRopeGame.js'), '줄넘기 챔피언');
const KIND_OPTS = Object.entries(SEG_KINDS).map(([k, v]) => ({ value: k, label: v.name.replace('빨라지기·느려지기', '빨라·느려') }));
const JUDGE_OPTS = Object.entries(JUDGE_LABEL).map(([k, v]) => ({ value: k, label: v }));

function segText(g) {
  const name = SEG_KINDS[g.k]?.name || '';
  if (g.k === 'r') return `${name} · ${g.n}박 · BPM ${segBpm(g.a)}~${segBpm(g.b)}`;
  if (g.k === 'u') return `${g.b >= g.a ? '빨라지기' : '느려지기'} · ${g.n}박 · BPM ${segBpm(g.a)}→${segBpm(g.b)}`;
  return `${name} · ${g.n}박 · BPM ${segBpm(g.v)}`;
}
function newSeg(k, from) {
  const v = from?.v ?? from?.b ?? 3;
  if (k === 'r') return { k, n: 8, a: Math.max(SPEED_MIN, v - 1), b: Math.min(SPEED_MAX, v + 1) };
  if (k === 'u') return { k, n: 8, a: v, b: Math.min(SPEED_MAX, v + 2) };
  return { k, n: k === 'd' || k === 'f' ? 3 : 8, v };
}

export default function JrEditor(nav, params = {}) {
  ensureJrStyle();
  let view = 'list';
  let draft = null;
  let sel = 0;
  let codeShown = '';
  let importText = '';

  const save = () => {
    const r = J.saveMyStage(draft);
    if (r) draft = { ...r, segs: r.segs.map((s) => ({ ...s })) };
    return r;
  };
  /* 고치던 스테이지를 params 에 적어 둔다 — «시험해 보기»에서 돌아오면 화면이 새로 만들어져도 같은 편집 화면으로 */
  const open = (st) => { draft = { ...st, segs: st.segs.map((s) => ({ ...s })) }; sel = 0; codeShown = ''; view = 'edit'; params.editId = st.id; nav.refresh(); };
  const create = (base) => {
    if (J.myStages().length >= J.MY_MAX) { toast(`내 스테이지는 ${J.MY_MAX}개까지예요. 하나를 지우고 만들어 주세요.`, 2400); return; }
    const st = base
      ? { name: `${base.name} 고친판`.slice(0, LIMITS.name), theme: base.theme, hearts: base.hearts, judge: 'n', ring: true, segs: base.segs }
      : { name: '내 스테이지', theme: 0, hearts: 3, judge: 'n', ring: true, segs: [{ k: 's', n: 10, v: 2 }, { k: 'r', n: 10, a: 2, b: 4 }] };
    draft = { ...st, segs: st.segs.map((s) => ({ ...s })) };
    if (!save()) { toast('저장하지 못했어요', 1800); return; }
    open(draft);
  };
  if (params.editId) {
    const st = J.myStages().find((x) => x.id === params.editId);
    if (st) { draft = { ...st, segs: st.segs.map((x) => ({ ...x })) }; view = 'edit'; }
  }
  const change = (fn) => { fn(); draft = { ...draft, ...sanitizeStage(draft), id: draft.id }; save(); nav.refresh(); };

  function listView() {
    const mine = J.myStages();
    return screen(
      title('스테이지 만들기'),
      el('div.hint', `박자 조각을 쌓아 나만의 스테이지를 만들고, 코드 한 줄로 친구에게 보내요. (${mine.length}/${J.MY_MAX})`),
      el('div.row', null, [
        button('새로 만들기', () => create(null), { primary: true }),
        button('기본 스테이지 고치기', () => { view = 'copy'; nav.refresh(); }),
      ]),
      el('div.jr-list', null, mine.length ? mine.map((st) => el('button.jr-stage', { type: 'button', onclick: () => open(st) }, [
        stageThumb(st.theme, 96, 54, 1),
        el('div.jr-stage-body', null, [
          el('div.jr-stage-name', st.name),
          el('div.jr-stage-sub', `${stageCount(st)}번 넘기 · 하트 ${st.hearts} · 판정 ${JUDGE_LABEL[st.judge]} · 조각 ${st.segs.length}개`),
        ]),
      ])) : [el('div.hint', '아직 만든 스테이지가 없어요.')]),
      el('div.diff-title', '친구 코드로 가져오기'),
      el('textarea.jr-code', {
        placeholder: 'JR1-로 시작하는 코드를 붙여 넣어요',
        oninput: (e) => { importText = e.target.value; },
      }, [importText]),
      button('가져오기', () => {
        const st = decodeStage(importText);
        if (!st) { Sfx.play('sfx_denied'); toast('코드가 올바르지 않아요. 다시 확인해 주세요.', 2200); return; }
        if (J.myStages().length >= J.MY_MAX) { toast(`내 스테이지는 ${J.MY_MAX}개까지예요.`, 2000); return; }
        const r = J.saveMyStage(st);
        if (!r) { toast('저장하지 못했어요', 1800); return; }
        importText = '';
        Sfx.play('sfx_purchase');
        toast(`«${r.name}» 을(를) 가져왔어요!`, 2000);
        nav.refresh();
      }),
      el('div.spacer'),
      backButton('게임 로비로', () => nav.back()),
    );
  }

  function copyView() {
    return screen(
      title('어떤 스테이지를 고칠까요?'),
      el('div.jr-list', null, STAGES.map((st) => el('button.jr-stage', { type: 'button', onclick: () => create(st) }, [
        stageThumb(st.theme, 96, 54, 1),
        el('div.jr-stage-body', null, [el('div.jr-stage-name', `${st.no}. ${st.name}`), el('div.jr-stage-sub', `${stageCount(st)}번 넘기`)]),
      ]))),
      el('div.spacer'),
      backButton('뒤로', () => { view = 'list'; nav.refresh(); }),
    );
  }

  function editView() {
    const d = draft;
    const segs = d.segs;
    sel = Math.max(0, Math.min(segs.length - 1, sel));
    const g = segs[sel];
    let secs = 0, notes = 0;
    try { const ch = buildChart(sanitizeStage(d), 'normal', { seed: 1 }); secs = Math.round(ch.duration); notes = ch.notes.length; } catch { /* 채보를 못 만들면 0 */ }
    const stepper = (label, val, lo, hi, set) => el('div.jr-field', null, [
      el('span', label),
      el('div.jr-step', null, [
        button('−', () => change(() => set(Math.max(lo, val - 1))), { sfx: 'sfx_menu_move' }),
        el('b', String(val)),
        button('+', () => change(() => set(Math.min(hi, val + 1))), { sfx: 'sfx_menu_move' }),
      ]),
    ]);

    const segEditor = g ? el('div.jr-box', null, [
      el('h4', `${sel + 1}번째 조각 고치기`),
      el('div.jr-chip-row', null, KIND_OPTS.map((o) => el('button.jr-chip', {
        type: 'button', class: o.value === g.k ? 'on' : '',
        onclick: () => change(() => { segs[sel] = { ...newSeg(o.value, g), n: g.n }; }),
      }, [el('span', o.label)]))),
      stepper('박 수', g.n, 1, LIMITS.n, (v) => { g.n = v; }),
      g.k === 'r' || g.k === 'u'
        ? el('div', null, [
          stepper(`${g.k === 'u' ? '시작' : '느린 쪽'} ${segBpm(g.a)}`, g.a, SPEED_MIN, SPEED_MAX, (v) => { g.a = v; }),
          stepper(`${g.k === 'u' ? '끝' : '빠른 쪽'} ${segBpm(g.b)}`, g.b, SPEED_MIN, SPEED_MAX, (v) => { g.b = v; }),
        ])
        : stepper(`BPM ${segBpm(g.v)}`, g.v, SPEED_MIN, SPEED_MAX, (v) => { g.v = v; }),
      el('div.row', null, [
        button('▲ 위로', () => change(() => { if (sel > 0) { [segs[sel - 1], segs[sel]] = [segs[sel], segs[sel - 1]]; sel -= 1; } }), { sfx: 'sfx_menu_move' }),
        button('▼ 아래로', () => change(() => { if (sel < segs.length - 1) { [segs[sel + 1], segs[sel]] = [segs[sel], segs[sel + 1]]; sel += 1; } }), { sfx: 'sfx_menu_move' }),
        button('빼기', () => { if (segs.length <= 1) { toast('조각이 하나는 있어야 해요', 1600); return; } change(() => { segs.splice(sel, 1); }); }, { sfx: 'sfx_menu_back' }),
      ]),
    ]) : null;

    return screen(
      title('스테이지 고치기'),
      el('div.jr-field', null, [el('span', '이름'), el('input', {
        value: d.name, maxlength: LIMITS.name,
        onchange: (e) => change(() => { d.name = e.target.value; }),
      })]),
      el('div.jr-field', null, [el('span', '배경'), el('select', {
        onchange: (e) => change(() => { d.theme = Number(e.target.value) | 0; }),
      }, THEMES.map((t, i) => el('option', { value: i, selected: i === d.theme }, t.name)))]),
      el('div.jr-preview', null, [stageThumb(d.theme, 120, 60, 2)]),
      stepper('하트', d.hearts, 1, 5, (v) => { d.hearts = v; }),
      el('div.jr-field', null, [el('span', '판정'), segmented(JUDGE_OPTS, d.judge, (v) => change(() => { d.judge = v; }))]),
      el('div.jr-field', null, [el('span', '도우미 링'), segmented([{ value: 'on', label: '켜기' }, { value: 'off', label: '끄기' }], d.ring ? 'on' : 'off', (v) => change(() => { d.ring = v === 'on'; }))]),
      el('div.diff-title', `조각 (${segs.length}/${LIMITS.segs}) · ${stageCount(d)}박 · 노트 ${notes} · 약 ${secs}초`),
      el('div.jr-list', null, segs.map((s, i) => el('button.jr-seg-row', {
        type: 'button', class: i === sel ? 'on' : '',
        style: i === sel ? 'border-color:#ffd23f' : '',
        onclick: () => { sel = i; nav.refresh(); },
      }, [el('span.jr-seg-k', String(i + 1)), el('span.jr-seg-v', segText(s))]))),
      button('+ 조각 추가', () => {
        if (segs.length >= LIMITS.segs) { toast(`조각은 ${LIMITS.segs}개까지예요`, 1600); return; }
        change(() => { segs.splice(sel + 1, 0, newSeg('s', g)); sel += 1; });
      }),
      segEditor,
      el('div.row', null, [
        button('시험해 보기', () => nav.push(JumpRopeGame, { mode: 'test', stage: sanitizeStage(d) }), { primary: true }),
        button('코드 만들기', async () => {
          codeShown = encodeStage(d);
          try { await navigator.clipboard.writeText(codeShown); toast('코드를 복사했어요! 친구에게 보내 주세요.', 2200); } catch { toast('아래 코드를 길게 눌러 복사해 주세요', 2200); }
          nav.refresh();
        }),
      ]),
      codeShown ? el('textarea.jr-code', { readonly: true, onclick: (e) => e.target.select() }, [codeShown]) : null,
      button('이 스테이지 지우기', async () => {
        if (!(await confirmDialog({ message: `«${d.name}» 을(를) 지울까요?`, detail: '지우면 되돌릴 수 없어요 (코드를 받아 두었다면 다시 가져올 수 있어요)', yes: '지우기', no: '아니요' }))) return;
        J.deleteMyStage(d.id);
        view = 'list';
        nav.refresh();
      }, { sfx: 'sfx_menu_back' }),
      el('div.spacer'),
      backButton('목록으로', () => { view = 'list'; params.editId = null; nav.refresh(); }),
    );
  }

  return {
    render() {
      if (view === 'edit' && draft) return editView();
      if (view === 'copy') return copyView();
      return listView();
    },
  };
}
