/**
 * S24 드래곤 순위 — 점수 순위 / 금화왕 순위.
 *
 * ★ **화면 하나로 둘을 그린다.** (2026-08-26 E단계)
 * 두 순위표는 줄에 적히는 숫자만 다르고 나머지가 전부 같다. 파일을 둘로 나누면
 * 탭 하나 고칠 때 두 곳을 고쳐야 하고, 한쪽만 고치는 사고가 난다.
 *
 * 탭은 넷 — 오늘 · 금주 · 금월 · 역대.
 * 기간 탭은 **그 기간에 친 한 판의 최고**고, 역대는 계정에 쌓인 값이다.
 * 그래서 금화왕의 역대만 '누적'이다 — 화면에 그렇게 적어 둔다.
 *
 * 마크업은 명예의 전당(`HallOfFame`)과 같은 이름을 쓴다 — 같은 CSS 를 그대로 탄다.
 */

import S from '../config/strings.ko.js';
import { el, backButton, screen, segmented } from './ui.js';
import { get as getProfile } from '../services/profile.js';
import { fetchDragonBoard } from '../services/leaderboard.js';
import { loadDragon } from './DragonGame.js';

const TABS = [
  { value: 'daily', label: '오늘' },
  { value: 'weekly', label: '금주' },
  { value: 'monthly', label: '금월' },
  { value: 'alltime', label: '역대' },
];
const DIFFS = [
  { value: 'easy', label: '쉬움' },
  { value: 'normal', label: '보통' },
  { value: 'hard', label: '어려움' },
];

/**
 * @param {object} nav
 * @param {{kind?:'score'|'coin'}} opt
 */
export default function DragonRanking(nav, opt = {}) {
  const kind = opt.kind === 'coin' ? 'coin' : 'score';
  const me = getProfile();

  let tab = 'daily';
  let difficulty = me.dragonDifficulty || 'normal';
  let state = { loading: true, rows: [], err: null };
  let mod = null;
  let live = true;
  /** 늦게 온 응답이 **옛 탭의 줄**을 덮어쓰는 것을 막는다 */
  let reqId = 0;

  loadDragon().then((m) => { mod = m; if (live) nav.refresh(); }).catch(() => {});

  function load() {
    const my = ++reqId;
    state = { loading: true, rows: [], err: null };
    fetchDragonBoard(kind, tab, difficulty).then((r) => {
      if (!live || my !== reqId) return;
      state = r.ok
        ? { loading: false, rows: r.rows, err: null }
        : { loading: false, rows: [], err: r.reason || 'error' };
      nav.refresh();
    });
  }
  load();

  const unit = kind === 'coin' ? '금화' : '점';

  function row(r, i) {
    const rank = i + 1;
    return el('div.rank-row', {
      class: [r.uid === me.uid ? 'me' : '', rank <= 3 ? `crowned c${rank}` : ''].filter(Boolean).join(' '),
    }, [
      el('div.rank-place', null, [el('span.rank-no', S.rankPlace(rank))]),
      /* 그 사람이 쓰는 드래곤 얼굴 — 순위표는 남이 내 드래곤을 보는 거의 유일한 화면이다 */
      el('div.rank-face', null, [mod ? mod.dragonPortrait(r.dragon, 2) : null].filter(Boolean)),
      el('div.rank-name', r.nickname || '???'),
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

  return {
    onLeave() { live = false; },

    render() {
      return screen(
        el('div.dragon-title', kind === 'coin' ? S.dragonRankCoin : S.dragonRankScore),

        segmented(TABS, tab, (v) => { tab = v; load(); nav.refresh(); }),

        /* 역대는 계정에 쌓인 값이라 난이도로 나뉘지 않는다 — 고를 것이 없으니 감춘다 */
        tab === 'alltime'
          ? el('div.hint', kind === 'coin' ? S.dragonRankAllCoin : S.dragonRankAllScore)
          : segmented(DIFFS, difficulty, (v) => { difficulty = v; load(); nav.refresh(); }),

        body(),

        el('div.spacer'),
        backButton(S.backToGameLobby, () => nav.back())
      );
    },
  };
}
