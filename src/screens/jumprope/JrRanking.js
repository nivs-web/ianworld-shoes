/**
 * 줄넘기 챔피언 — 명예의 전당.
 *   무한 줄넘기 쉬움 · 보통 · 어려움 (한 판에 넘은 최고 개수) / 레벨 / 모은 줄넘기 수
 * 줄마다 캐릭터 얼굴(모자 포함) · 이모티콘 · 이름 · 든 줄넘기 · 레벨 · 총 넘은 횟수.
 * 마크업은 다른 명예의 전당과 같은 이름(`rank-*`)이라 같은 CSS 를 탄다.
 *
 * ⏳ 서버 규칙(`jumpPlayers`)이 게시되기 전에는 읽기가 거부된다 — 그때는 «준비 중»과 내 기록만 보여 준다.
 */

import S from '../../config/strings.ko.js';
import { el, backButton, screen, title, segmented } from '../ui.js';
import { get as getProfile } from '../../services/profile.js';
import { currentUser } from '../../services/auth.js';
import * as J from '../../services/jumprope.js';
import { fetchJumpBoard, syncJumpPlayer } from '../../services/jumpRank.js';
import { ROPE_BY_ID, ROPES, EMOJIS, decodeLook, DIFFS } from '../../games/jumprope/data.js';
import { headIcon, ropeIcon } from '../../games/jumprope/art.js';
import { crownSlot } from '../crown.js';
import { ensureJrStyle } from './jrui.js';

const BOARDS = [
  { value: 'easy', label: '쉬움' },
  { value: 'normal', label: '보통' },
  { value: 'hard', label: '어려움' },
  { value: 'level', label: '레벨' },
  { value: 'ropes', label: '줄넘기' },
];
const NOTE = {
  easy: '무한 줄넘기(쉬움) — 한 판에 넘은 최고 개수',
  normal: '무한 줄넘기(보통) — 한 판에 넘은 최고 개수',
  hard: '무한 줄넘기(어려움) — 한 판에 넘은 최고 개수',
  level: '레벨 — 경험치가 많은 순서',
  ropes: `모은 줄넘기 수 (전부 ${ROPES.length}개)`,
};

export default function JrRanking(nav) {
  ensureJrStyle();
  let board = J.jr().diff;
  let state = { loading: true, rows: [], err: null };
  let live = true, reqId = 0;
  const myUid = currentUser()?.uid;

  function load() {
    const my = ++reqId;
    state = { loading: true, rows: [], err: null };
    fetchJumpBoard(board).then((r) => {
      if (!live || my !== reqId) return;
      state = r.ok ? { loading: false, rows: r.rows, err: null } : { loading: false, rows: [], err: r.reason || 'error' };
      nav.refresh();
    });
  }
  /* 내 줄이 최신이어야 순위를 보는 의미가 있다 — 먼저 올리고 읽는다 */
  syncJumpPlayer(J.derive).catch(() => false).then(() => { if (live) load(); });

  const unit = () => (board === 'level' ? '' : board === 'ropes' ? '개' : '개');
  function row(r, i) {
    const rank = i + 1;
    const look = decodeLook(r.look);
    const rope = ROPE_BY_ID[r.rope] || ROPE_BY_ID.red;
    const value = board === 'level' ? `Lv.${r.level}` : `${Number(r.value || 0).toLocaleString('en-US')}${unit()}`;
    return el('div.rank-row.cbr-row', {
      class: [r.uid === myUid ? 'me' : '', rank <= 3 ? `crowned c${rank}` : ''].filter(Boolean).join(' '),
    }, [
      el('div.rank-place', null, [crownSlot(rank), el('span.rank-no', S.rankPlace(rank))]),
      el('div.cbr-face', null, [headIcon(look, 2)]),
      el('div.cbr-emo', EMOJIS[look.emoji] || '😀'),
      el('div.rank-name', r.nickname || '???'),
      el('div.jr-rope-ic', null, [ropeIcon(rope, 1)]),
      el('div.cbr-sub', board === 'level' ? `총 ${r.jumps.toLocaleString('en-US')}번` : `Lv.${Math.max(1, r.level)}`),
      el('div.rank-value', value),
    ]);
  }
  function body() {
    if (state.loading) return el('div.hint', S.loading);
    if (state.err === 'auth') return el('div.hint.bad', S.rankNeedLogin);
    if (state.err === 'rules') return el('div.hint', '명예의 전당을 여는 중이에요. 곧 열려요! 내 기록은 계속 쌓이고 있어요.');
    if (state.err) return el('div.hint.bad', S.rankLoadFailed);
    if (!state.rows.length) return el('div.hint', '아직 아무도 없어요. 첫 번째 주인공이 되어 보세요!');
    return el('div.rank-list', null, state.rows.map(row));
  }
  function mine() {
    const j = J.jr();
    const p = getProfile();
    const L = J.levelOf(j);
    return el('div.jr-box', null, [
      el('h4', `내 기록 — ${p.nickname || '나'}`),
      el('div', `무한 줄넘기 최고: 쉬움 ${j.endless.easy}개 · 보통 ${j.endless.normal}개 · 어려움 ${j.endless.hard}개`),
      el('div', `레벨 ${L.level} · 모은 줄넘기 ${J.ownedRopes(j).length}개 · 총 넘은 횟수 ${j.jumps.toLocaleString('en-US')}번 · 최대 콤보 ${j.bestCombo}`),
      el('div', `별: ${['easy', 'normal', 'hard'].map((d) => `${DIFFS[d].label} ${J.starsIn(j, d)}`).join(' · ')}`),
    ]);
  }

  return {
    onLeave() { live = false; },
    render() {
      return screen(
        title('명예의 전당'),
        el('div.jr-seg5', null, [segmented(BOARDS, board, (v) => { board = v; load(); nav.refresh(); })]),
        el('div.hint', NOTE[board]),
        body(),
        mine(),
        el('div.spacer'),
        backButton('게임 로비로', () => nav.back()),
      );
    },
  };
}

/* 캐치볼 명예의 전당과 같은 줄 모양(cbr-*)을 쓴다 — 그 CSS 는 CatchRanking 안에 있으니 여기서도 넣는다 */
const CSS = `
.cbr-row { cursor: default; }
.cbr-face { flex: 0 0 34px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; }
.cbr-emo { flex: 0 0 22px; font-size: 18px; line-height: 1; text-align: center; }
.cbr-row .rank-name { flex: 0 1 70px; }
.cbr-sub { flex: 1 1 auto; min-width: 0; font-size: 11px; color: var(--c-panel-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 360px) { .cbr-sub { display: none; } .cbr-row .rank-name { flex: 1 1 auto; } }
`;
if (typeof document !== 'undefined' && !document.getElementById('jr-rank-css')) {
  const st = document.createElement('style');
  st.id = 'jr-rank-css';
  st.textContent = CSS;
  document.head.append(st);
}
