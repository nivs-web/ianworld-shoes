/**
 * S22 멀티게임순위 — 명예의 전당의 **쌍둥이 화면**. (2026-08-19 23차, 사용자 지정)
 *
 *   승리왕 / 승률왕 / 오늘 / 주간 / 월간
 *
 * *"명예의 전당과 거의 똑같은 메뉴가 뜨는데 제목이 멀티게임순위 (…) 여기에는 오직
 *   승리 횟수만 나오는거야"*
 *
 * ## 왜 명예의 전당에 탭을 더하지 않았나
 *
 * 한 화면에 계단 순위와 승리 순위를 섞으면 **같은 `역대` 탭이 무엇의 역대인지** 흐려진다.
 * 그리고 이 화면의 1·2·3위는 로비 딱지가 되므로(승리왕), 어디를 보고 딱지를 받았는지가
 * 분명해야 한다. 대신 줄 모양·왕관·스크롤은 **같은 CSS 를 그대로 쓴다** — 두 화면이
 * 다르게 보일 이유는 없다.
 *
 * ## 승률왕만 규칙이 둘 더 있다
 *
 * ① **10게임 이상** — 1승 0패가 100% 로 1위가 되면 승률 순위는 아무 의미가 없다.
 *    거르는 자리는 화면이 아니라 **계정 문서**다: 10판을 넘겨야 `winRate` 필드가
 *    생기고, 없는 필드는 색인에 안 실린다(`multiSettle.multiRankFields`).
 * ② **최근 일주일 안에 한 판** (2026-08-19 24차, 사용자 지정) — ①만으로는
 *    *"10게임해서 10판 다 승리하면 (…) 항상 1위로 100% 상태에서 늘 고정"* 이 된다.
 *    이건 시간이 지나면 저절로 깨지는 조건이라 서버에 못 박을 수 없어서
 *    **읽는 쪽에서 거른다**(`leaderboard.rateEligible`).
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title } from './ui.js';
import { get as getProfile } from '../services/profile.js';
import { rankWindow } from '../services/rankWindow.js';
import { fetchMultiBoard, fetchUserCard } from '../services/leaderboard.js';
import { characterById } from '../data/characters.js';
import { rankFigure, wornList } from './wearFigure.js';
import { crownSlot, hasCrown } from './crown.js';
import { pixelText } from './pixelText.js';
import { PAL } from '../game/palette.js';
import { openUserCard } from './UserCard.js';
import { MULTI } from '../config/balance.js';

const TABS = [
  { id: 'wins', label: S.tabWinKing },
  { id: 'rate', label: S.tabRateKing },
  { id: 'daily', label: S.tabToday },
  { id: 'weekly', label: S.tabWeekly },
  { id: 'monthly', label: S.tabMonthly },
];

export default function MultiRank(nav) {
  let tabId = 'wins';
  let state = { loading: true, data: null };
  let reqId = 0;
  const cache = new Map();

  let scrolledFor = null;
  function scrollToMine(list, node, key) {
    if (scrolledFor === key) return;
    scrolledFor = key;
    requestAnimationFrame(() => {
      if (!list.isConnected) return;
      const mid = (list.clientHeight - node.offsetHeight) / 2;
      list.scrollTop = Math.max(0, node.offsetTop - list.offsetTop - mid);
    });
  }

  function load() {
    const my = ++reqId;
    const hit = cache.get(tabId);
    if (hit) { state = { loading: false, data: hit }; return; }

    state = { loading: true, data: null };
    fetchMultiBoard(tabId).then((data) => {
      if (my !== reqId) return;
      if (!data.error) cache.set(tabId, data);
      state = { loading: false, data };
      nav.refresh();
      data.mePromise?.then((me) => {
        if (my !== reqId || !me) return;
        data.me = me;
        nav.refresh();
      });
    });
  }

  load();

  /** 줄을 누르면 유저상태창 — 명예의 전당과 같은 동작 (§9-0-41) */
  function openCard(r) {
    const known = {
      uid: r.uid, nickname: r.nickname, characterId: r.characterId,
      shoesOwned: r.shoesOwned, multiWins: r.multiWins, multiLosses: r.multiLosses,
    };
    const load = fetchUserCard(r.uid).then((full) => {
      if (full) Object.assign(r, full);
      return full;
    }).catch(() => null);
    openUserCard(known, { nav, load });
  }

  /**
   * ★ **승률왕 줄은 값이 둘이다.** (2026-08-19 24차, 사용자 지정)
   *
   * *"'0게임중 0승'으로만 간단하게 하자, 그리고 오른쪽에는 다른폰트 글씨 더크게 (…)
   *   98이라는 숫자가 눈에 확 띄게"*
   *
   * 왼쪽 `24게임중 20승` 은 근거고, 오른쪽 `승률 83%` 가 **순위를 정하는 값**이다.
   * 그래서 숫자만 로비와 같은 **비트맵 글꼴 18px** 로 찍는다 — DOM 글꼴과 확연히
   * 달라서 눈이 먼저 간다(로비의 최고기록 숫자와 같은 처리다).
   */
  function rateCells(r) {
    if (r.value === null) return [el('div.rank-value.rate-none', S.rateNone)];
    const games = r.games ?? (r.multiWins ?? 0) + (r.multiLosses ?? 0);
    const pct = Math.round((r.value ?? 0) / 100);
    return [
      el('div.rank-sub', S.rateLine(games, r.multiWins ?? 0)),
      el('div.rank-pct', null, [
        el('span.rank-pct-label', S.ratePctLabel),
        pixelText(pct, { scale: 2, mini: true, color: PAL.text, mono: true }),
        el('span.rank-pct-sign', '%'),
      ]),
    ];
  }

  function row(r, opt = {}) {
    const ch = characterById(r.characterId);
    return el('div.rank-row', {
      class: [opt.me ? 'me' : '', tabId === 'rate' ? 'rate' : '', hasCrown(r.rank) ? `crowned c${r.rank}` : ''].filter(Boolean).join(' '),
      onclick: () => openCard(r),
    }, [
      el('div.rank-place', null, [
        crownSlot(r.rank),
        el('span.rank-no', r.rank === null ? '-' : S.rankPlace(r.rank)),
      ]),
      /**
       * ★ **착용한 모습 그대로** 보여 준다. (2026-08-21 30차, 사용자 지정)
       * 순위표는 남이 내 이름을 보는 거의 유일한 화면이다 — 여기서 안 보이면
       * 만 켤레짜리 아이템을 자랑할 자리가 없다. 로비·쇼핑과 **같은 부품**이다.
       */
      rankFigure(ch?.id, wornList(r.items)),
      el('div.rank-name', r.nickname || '???'),
      ...(tabId === 'rate'
        ? rateCells(r)
        : [el('div.rank-value', `${(r.value ?? 0).toLocaleString('en-US')}${S.rankUnitWins}`)]),
    ]);
  }

  return {
    onLeave() { reqId++; },

    render() {
      const me = getProfile();
      let listed = false;

      const tabs = el('div.seg.hof-tabs', null,
        TABS.map((t) =>
          button(t.label, () => {
            if (t.id === tabId) return;
            tabId = t.id;
            scrolledFor = null;
            load();
            nav.refresh();
          }, { class: t.id === tabId ? 'on' : '', sfx: 'sfx_menu_move' })
        )
      );

      const REASON = { auth: S.rankNeedLogin, offline: S.networkError, failed: S.rankLoadFailed };

      let body;
      if (state.loading) {
        body = el('div.hint', S.loading);
      } else if (!state.data || state.data.error) {
        body = el('div.hint', REASON[state.data?.error] ?? S.networkError);
      } else if (!state.data.rows.length) {
        body = el('div.hint', S.noRankYet);
      } else {
        const win = rankWindow(state.data.rows, me.uid);
        let mineNode = null;
        const list = el('div.rank-list', null, win.map((r) => {
          const node = row(r, { me: r.uid === me.uid });
          if (r.uid === me.uid) mineNode = node;
          return node;
        }));
        if (mineNode) scrollToMine(list, mineNode, tabId);
        body = list;
        listed = true;
      }

      /**
       * ★ **승률왕은 규칙을 먼저 말한다.** (사용자 지정)
       * *"맨위에 바로 1위부터 나열된게 나오는게 아니고 '승률왕은 최소 멀티게임을 10판
       *   이상 유저만 측정합니다' 라는 메세지를 넣어줘"*
       * 10판을 안 채운 사람이 자기 이름을 찾다가 "고장났다"고 여기는 걸 막는다.
       */
      const notice = tabId === 'rate'
        ? el('div.rank-notice', S.rateKingNotice(MULTI.rateMinGames))
        : null;

      const mine = state.data?.me
        ? el('div.rank-mine', null, [
            el('div.rank-mine-label', S.myRank),
            row(state.data.me, { me: true }),
          ])
        : null;

      return screen(
        title(S.multiRankTitle),
        tabs,
        notice,
        body,
        listed ? null : el('div.spacer'),
        mine,
        backButton(S.back, () => nav.back())
      );
    },
  };
}
