/**
 * S31 캐치볼 명예의 전당 (2026-10-29, 사용자 지정)
 *
 *   쉬움 · 보통 · 어려움  x  최고기록(한 판에 잡은 공) · 콤보(연속 캐치)
 *   1:1 대결 — 이긴 횟수
 *   종합 — 세 난이도 최고기록과 1:1 승리를 무게 매겨 더한 값 (`catchRank.TOTAL_RULE`)
 *   3D — 3D캐치볼 기록 (2026-10-29). 맨 위 '2D · 3D' 로 바꾼다. 쉬움 · 보통 · 어려움 x 최고기록 · 콤보.
 *        1:1 승패는 2D · 3D 가 같은 칸이라 2D 쪽 '1:1' 에 같이 센다. 종합 점수에는 3D 를 넣지 않는다.
 *
 * ★ 줄마다 **캐릭터 얼굴(모자 포함) · 이모티콘 · 이름 · 글러브 모양**이 꼭 뜬다 (사용자 지정).
 * 그림은 캐치볼 그림 모듈(`games/catch/art.js`)을 받아 와서 그린다 — 오기 전에는 자리만 비워 둔다.
 *
 * 마크업은 명예의 전당과 같은 이름(`rank-*`)을 써서 같은 CSS 를 탄다.
 */

import S from '../config/strings.ko.js';
import { el, backButton, screen, title, segmented } from './ui.js';
import { get as getProfile } from '../services/profile.js';
import { fetchCatchBoard, syncCatchPlayer, TOTAL_RULE } from '../services/catchRank.js';
import { crownSlot } from './crown.js';

const BOARDS = [
  { value: 'easy', label: '쉬움' },
  { value: 'normal', label: '보통' },
  { value: 'hard', label: '어려움' },
  { value: 'duel', label: '1:1' },
  { value: 'total', label: '종합' },
];
const VIEWS = [
  { value: '2d', label: '캐치볼' },
  { value: '3d', label: '3D캐치볼' },
];
const BOARDS_3D = BOARDS.slice(0, 3);
const KINDS = [
  { value: 'best', label: '최고기록' },
  { value: 'combo', label: '콤보기록' },
];
const NOTE = {
  best: '한 판에 잡은 공의 수 (종합 갯수)',
  combo: '놓치지 않고 연속으로 잡은 공의 수',
  duel: '1:1 대결에서 이긴 횟수',
  total: `종합 점수 = ${TOTAL_RULE}`,
};

let art = null;
const loadArt = () => (art ? Promise.resolve(art) : import('../games/catch/art.js').then((m) => (art = m)));

/** @param {object} nav @param {{diff?:string, view3d?:boolean}} opt */
export default function CatchRanking(nav, opt = {}) {
  const me = getProfile();
  /* 3D캐치볼에서 열면 3D 순위부터 */
  const from3d = !!opt.view3d;
  let view = from3d ? '3d' : '2d';
  let board = ['easy', 'normal', 'hard'].includes(opt.diff) ? opt.diff : ((from3d ? me.catch3dDifficulty : me.catchDifficulty) || 'normal');
  let kind = 'best';
  let state = { loading: true, rows: [], err: null };
  let live = true;
  let reqId = 0;

  loadArt().then(() => { if (live) nav.refresh(); }).catch(() => {});

  function load() {
    const my = ++reqId;
    state = { loading: true, rows: [], err: null };
    const k = board === 'duel' || board === 'total' ? board : view === '3d' ? kind + '3' : kind;
    fetchCatchBoard(k, board).then((r) => {
      if (!live || my !== reqId) return;
      state = r.ok ? { loading: false, rows: r.rows, err: null } : { loading: false, rows: [], err: r.reason || 'error' };
      nav.refresh();
    });
  }
  /* 내 줄이 최신이어야 순위를 보는 의미가 있다 — 먼저 올리고 읽는다 */
  syncCatchPlayer().catch(() => false).then(() => { if (live) load(); });

  function face(r) {
    if (!art) return el('div.cbr-face');
    const look = art.decodeLook(r.look);
    const box = el('div.cbr-face', null, [art.headIcon(look, 34)]);
    return box;
  }
  function row(r, i) {
    const rank = i + 1;
    const look = art ? art.decodeLook(r.look) : null;
    const unit = board === 'duel' ? '승' : board === 'total' ? '점' : '개';
    return el('div.rank-row.cbr-row', {
      class: [r.uid === me.uid ? 'me' : '', rank <= 3 ? `crowned c${rank}` : ''].filter(Boolean).join(' '),
    }, [
      el('div.rank-place', null, [crownSlot(rank), el('span.rank-no', S.rankPlace(rank))]),
      face(r),
      el('div.cbr-emo', look ? art.EMOJIS[look.emoji] || '😀' : ''),
      el('div.rank-name', r.nickname || '???'),
      el('div.cbr-glove', null, [look ? art.gloveIcon(look.glove, 26) : null].filter(Boolean)),
      board === 'duel' ? el('div.cbr-sub', `${r.wins}승 ${r.losses}패`) : el('div.cbr-sub', `Lv.${Math.max(1, r.level)}`),
      el('div.rank-value', `${Number(r.value || 0).toLocaleString('en-US')}${unit}`),
    ]);
  }
  function body() {
    if (state.loading) return el('div.hint', S.loading);
    if (state.err === 'auth') return el('div.hint.bad', S.rankNeedLogin);
    if (state.err) return el('div.hint.bad', S.rankLoadFailed);
    if (!state.rows.length) return el('div.hint', S.noRankYet);
    return el('div.rank-list', null, state.rows.map(row));
  }
  function mine() {
    if (state.loading || state.err || !state.rows.length) return null;
    if (state.rows.some((r) => r.uid === me.uid)) return null;
    return el('div.rank-mine', null, [el('div.rank-mine-label', S.myRank), el('div.hint', S.catchRankNotIn)]);
  }

  return {
    onLeave() { live = false; },
    render() {
      const byDiff = board !== 'duel' && board !== 'total';
      const pickView = (v) => {
        view = v;
        /* 3D 에는 1:1 · 종합 판이 없다 — 난이도 판으로 돌린다 */
        if (v === '3d' && !byDiff) board = (me.catch3dDifficulty || 'normal');
        load(); nav.refresh();
      };
      return screen(
        el('style', null, [CSS]),
        title(S.catchRankTitle),
        segmented(VIEWS, view, pickView),
        segmented(view === '3d' ? BOARDS_3D : BOARDS, board, (v) => { board = v; load(); nav.refresh(); }),
        byDiff ? segmented(KINDS, kind, (v) => { kind = v; load(); nav.refresh(); }) : null,
        el('div.hint', NOTE[byDiff ? kind : board]),
        body(),
        mine(),
        el('div.spacer'),
        backButton(from3d ? S.catch3dBackToGame : S.catchBackToGame, () => nav.back()),
      );
    },
  };
}

const CSS = `
.cbr-row { cursor: default; }
.cbr-face { flex: 0 0 34px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; }
.cbr-face canvas { display: block; }
.cbr-emo { flex: 0 0 22px; font-size: 18px; line-height: 1; text-align: center; }
.cbr-glove { flex: 0 0 26px; width: 26px; height: 26px; }
.cbr-glove canvas { display: block; }
.cbr-row .rank-name { flex: 0 1 70px; }
.cbr-sub { flex: 1 1 auto; min-width: 0; font-size: 11px; color: var(--c-panel-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 360px) { .cbr-sub { display: none; } .cbr-row .rank-name { flex: 1 1 auto; } }
`;
