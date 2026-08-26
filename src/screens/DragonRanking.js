/**
 * S24 드래곤 순위 — 점수순위 / 금화순위.
 *
 * ★ **둘의 성격이 아예 다르다.** (2026-08-26, 사용자 지정)
 *
 *   점수순위 : 오늘 · 금주 · 금월 · 역대  x  쉬움 · 보통 · 어려움
 *              한 판의 점수라 기간과 난이도로 갈린다.
 *
 *   금화순위 : 금화왕 · 싱글왕 · 멀티왕 · 승률왕
 *              **넷 다 계정에 쌓인 값이다.** 기간도 난이도도 없다 —
 *              "역대" 라는 탭조차 필요 없어서 아예 안 만든다.
 *
 * 화면 하나로 둘을 그리는 이유는 줄 모양이 같기 때문이다. 파일을 나누면 줄
 * 하나 고칠 때 두 곳을 고쳐야 하고, 한쪽만 고치는 사고가 난다.
 *
 * 마크업은 명예의 전당(`HallOfFame`)과 같은 이름을 쓴다 — 같은 CSS 를 그대로 탄다.
 */

import S from '../config/strings.ko.js';
import { el, backButton, screen, title, segmented } from './ui.js';
import { get as getProfile } from '../services/profile.js';
import { fetchDragonBoard, fetchDragonCrownBoard, fetchUserCard } from '../services/leaderboard.js';
import { openUserCard } from './UserCard.js';
import { crownSlot } from './crown.js';
import { loadDragon } from './DragonGame.js';

/** 점수순위 — 기간 x 난이도 */
const SCORE_TABS = [
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

/** 금화순위 — 왕 넷 */
const CROWN_TABS = [
  { value: 'coin', label: '금화왕' },
  { value: 'single', label: '싱글왕' },
  { value: 'multi', label: '멀티왕' },
  { value: 'rate', label: '승률왕' },
];
const CROWN_NOTE = {
  coin: '지금까지 주운 금화를 모두 더한 값입니다',
  single: '싱글게임을 많이 한 사람이 위입니다',
  multi: '멀티게임을 많이 이긴 사람이 위입니다',
  rate: '이긴 비율입니다 — 10게임 이상 한 사람만 오릅니다',
};

/**
 * @param {object} nav
 * @param {{kind?:'score'|'coin'}} opt
 */
export default function DragonRanking(nav, opt = {}) {
  const crown = opt.kind === 'coin';
  const me = getProfile();

  let tab = crown ? 'coin' : 'daily';
  let difficulty = me.dragonDifficulty || 'normal';
  let state = { loading: true, rows: [], err: null, unit: '' };
  let mod = null;
  let live = true;
  /** 늦게 온 응답이 **옛 탭의 줄**을 덮어쓰는 것을 막는다 */
  let reqId = 0;

  loadDragon().then((m) => { mod = m; if (live) nav.refresh(); }).catch(() => {});

  function load() {
    const my = ++reqId;
    state = { loading: true, rows: [], err: null, unit: '' };
    const req = crown ? fetchDragonCrownBoard(tab) : fetchDragonBoard('score', tab, difficulty);
    req.then((r) => {
      if (!live || my !== reqId) return;
      state = r.ok
        ? { loading: false, rows: r.rows, err: null, unit: r.unit ?? '점' }
        : { loading: false, rows: [], err: r.reason || 'error', unit: '' };
      nav.refresh();
    });
  }
  load();

  /**
   * 누른 줄의 유저상태창을 띄운다.
   * **기다렸다 띄우지 않는다** — "눌렀는데 아무 일도 안 난다" 가 되기 때문이다.
   * 아는 값으로 먼저 띄우고, 계정 문서가 도착하면 카드가 그 줄만 갈아 끼운다.
   */
  function openCard(r) {
    const known = { uid: r.uid, nickname: r.nickname };
    const load = fetchUserCard(r.uid).then((full) => {
      if (full) Object.assign(r, full);
      return full;
    }).catch(() => null);
    openUserCard(known, { nav, load, game: 'dragon' });
  }

  function row(r, i) {
    const rank = i + 1;
    /* 승률은 소수 한 자리, 나머지는 자릿수 구분 */
    const val = tab === 'rate'
      ? `${r.value}%`
      : `${Number(r.value || 0).toLocaleString('en-US')}${state.unit}`;
    return el('div.rank-row', {
      class: [r.uid === me.uid ? 'me' : '', rank <= 3 ? `crowned c${rank}` : ''].filter(Boolean).join(' '),
      /**
       * ★ **줄을 누르면 유저상태창이 뜬다.** (2026-08-26, 사용자 지정)
       * 명예의 전당과 **같은 부품**(`openUserCard`)을 쓴다 — 오락실 안에서 남의 카드는
       * 어디서 눌러도 같은 모양이어야 한다. 두 화면이 각자 만들면 언젠가 다른 말을 한다.
       */
      onclick: () => openCard(r),
    }, [
      /**
       * ★ **1·2·3위에 금·은·동 왕관.** (2026-08-26, 사용자 지정 — 명예의 전당 참고)
       * 왕관이 없으면 1위와 47위가 똑같이 생겨서 순위표가 그냥 목록이 된다.
       * 명예의 전당과 **같은 부품**이라 두 게임의 순위표가 같은 신호를 쓴다.
       */
      el('div.rank-place', null, [crownSlot(rank), el('span.rank-no', S.rankPlace(rank))]),
      /* 그 사람이 쓰는 드래곤 얼굴 — 순위표는 남이 내 드래곤을 보는 거의 유일한 화면이다 */
      el('div.rank-face', null, [mod ? mod.dragonPortrait(r.dragon, 2) : null].filter(Boolean)),
      el('div.rank-name', r.nickname || '???'),
      /* 승률왕에는 몇 승 몇 게임인지도 같이 — 비율만으로는 크기를 모른다 */
      tab === 'rate' ? el('div.rank-rate', `${r.wins}승 ${r.games}게임`) : null,
      el('div.rank-value', val),
    ].filter(Boolean));
  }

  function body() {
    if (state.loading) return el('div.hint', S.loading);
    if (state.err === 'auth') return el('div.hint.bad', S.rankNeedLogin);
    if (state.err) return el('div.hint.bad', S.rankLoadFailed);
    if (!state.rows.length) return el('div.hint', S.noRankYet);
    return el('div.rank-list', null, state.rows.map(row));
  }

  /**
   * ★ **내 기록은 100위 밖이어도 보인다.** (2026-08-26, 명예의 전당과 같은 방침)
   * 순위표를 여는 이유의 절반은 "내가 몇 등인가" 인데, 목록에만 의지하면
   * 상위 100명이 아닌 사람은 자기 줄을 영영 못 본다.
   */
  function mineRow() {
    if (state.loading || state.err || !state.rows.length) return null;
    const i = state.rows.findIndex((r) => r.uid === me.uid);
    if (i >= 0) return null;                 // 목록 안에 이미 있다
    return el('div.rank-mine', null, [
      el('div.rank-mine-label', S.myRank),
      el('div.hint', S.rankNotInTop),
    ]);
  }

  return {
    onLeave() { live = false; },

    render() {
      return screen(
        title(crown ? S.dragonRankCoin : S.dragonRankScore),

        segmented(crown ? CROWN_TABS : SCORE_TABS, tab, (v) => { tab = v; load(); nav.refresh(); }),

        /**
         * 난이도 줄은 **점수순위의 기간 탭에서만** 뜬다.
         * 금화순위 넷과 점수순위의 역대는 계정에 쌓인 값이라 난이도로 나뉘지 않는다 —
         * 고를 것이 없는 줄을 띄워 두면 눌러 보고 아무 일도 안 일어나서 고장으로 읽힌다.
         */
        crown
          ? el('div.hint', CROWN_NOTE[tab])
          : tab === 'alltime'
            ? el('div.hint', S.dragonRankAllScore)
            : segmented(DIFFS, difficulty, (v) => { difficulty = v; load(); nav.refresh(); }),

        body(),
        mineRow(),

        el('div.spacer'),
        backButton(S.backToGameLobby, () => nav.back())
      );
    },
  };
}
