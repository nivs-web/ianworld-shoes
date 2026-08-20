/**
 * S07 명예의 전당 — 기획서 §5-9.
 *
 *   1차 탭: 신발왕 / 주간 / 월간 / 연간 / 역대
 *   2차 탭: 쉬움 / 보통 / 어려움  (신발왕에는 없다 — 통합 랭킹 1개)
 *   상위 100명 + **항상 하단에 내 순위 고정**
 *
 * 화면 상태(선택한 탭, 불러온 목록)를 인스턴스가 들고 있으므로 다시 그릴 때는
 * `nav.refresh()` 를 쓴다. `mount` 을 부르면 탭이 초기화된다 (screens/router.js 주석 참고).
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title } from './ui.js';
import { get as getProfile } from '../services/profile.js';
import { rankWindow } from '../services/rankWindow.js';
import { fetchBoard } from '../services/leaderboard.js';
import { characterSprite, characterById } from '../data/characters.js';
import { fetchUserCard } from '../services/leaderboard.js';
import { openUserCard } from './UserCard.js';

const TABS = [
  { id: 'shoeking', label: S.tabShoeKing, unit: S.rankUnitShoes, byDifficulty: false },
  { id: 'weekly', label: S.tabWeekly, unit: S.rankUnitStairs, byDifficulty: true },
  { id: 'monthly', label: S.tabMonthly, unit: S.rankUnitStairs, byDifficulty: true },
  { id: 'yearly', label: S.tabYearly, unit: S.rankUnitStairs, byDifficulty: true },
  { id: 'alltime', label: S.tabAllTime, unit: S.rankUnitStairs, byDifficulty: true },
];

const DIFFS = [
  { value: 'easy', label: S.difficultyEasy },
  { value: 'normal', label: S.difficultyNormal },
  { value: 'hard', label: S.difficultyHard },
];

export default function HallOfFame(nav) {
  let tabId = 'shoeking';
  /** 기본값은 **마지막에 플레이한 난이도** (기획서 §5-9) */
  let diff = getProfile().difficulty;
  let state = { loading: true, data: null };
  /** 늦게 도착한 응답이 최신 화면을 덮어쓰지 않게 하는 표식 */
  let reqId = 0;

  /**
   * 이미 받아 둔 탭은 다시 부르지 않는다.
   * 탭을 왔다 갔다 할 때마다 조회가 나가면 느리기도 하고 읽기 할당량도 축낸다.
   * (새로 고침이 필요하면 화면을 다시 열면 된다 — 인스턴스와 함께 캐시도 사라진다)
   */
  const cache = new Map();
  const keyOf = (t, d) => `${t}:${TABS.find((x) => x.id === t).byDifficulty ? d : '-'}`;

  /**
   * 이미 스크롤을 맞춘 탭. **탭이 바뀔 때만** 내려 준다 —
   * `nav.refresh()` 는 내 줄이 늦게 도착할 때도 불리므로, 매번 내리면
   * 사용자가 손으로 올려 본 위치가 그때마다 튕겨 돌아온다.
   */
  let scrolledFor = null;
  function scrollToMine(list, node, key) {
    if (scrolledFor === key) return;
    scrolledFor = key;
    // 붙기 전에는 높이를 잴 수 없다 — 한 프레임 뒤에 잰다 (render() 직후 append 된다)
    requestAnimationFrame(() => {
      if (!list.isConnected) return;
      const mid = (list.clientHeight - node.offsetHeight) / 2;
      list.scrollTop = Math.max(0, node.offsetTop - list.offsetTop - mid);
    });
  }

  function load() {
    const my = ++reqId;
    const key = keyOf(tabId, diff);
    const hit = cache.get(key);
    if (hit) { state = { loading: false, data: hit }; return; }

    state = { loading: true, data: null };
    const tab = TABS.find((t) => t.id === tabId);
    fetchBoard(tabId, tab.byDifficulty ? diff : undefined).then((data) => {
      if (my !== reqId) return; // 탭을 이미 옮겼다
      if (!data.error) cache.set(key, data);
      state = { loading: false, data };
      nav.refresh();
      /**
       * 내 줄은 늦게 와도 된다 — 순위표를 먼저 보여 주고, 도착하면 아래에 붙인다.
       * 이걸 기다렸다 그리면 목록이 있는데도 화면이 비어 있는 시간이 생긴다.
       */
      data.mePromise?.then((me) => {
        if (my !== reqId || !me) return;
        data.me = me;
        nav.refresh();
      });
    });
  }

  load();

  /**
   * ★ **줄을 누르면 유저상태창.** (2026-08-19 11차, 사용자 지정)
   *
   * *"명예의 전당에서 유저 아이디 누르면 무반응인데 (…) 멀티게임에서 아이디 누르면
   * 팝업으로 뜨는 창 뜨게 해줘"*
   *
   * 줄이 들고 있는 값은 탭마다 다르다 — 신발왕·역대는 계정 문서에서 오므로 신발·승패가
   * 실려 있지만, 주간·월간·연간은 `scores` 에서 와서 **계단 수밖에 없다.** 그래서
   * 아는 값으로 카드를 **먼저 띄우고**, 계정 값을 받아 오면 그때 다시 띄운다.
   * 조회를 기다렸다 띄우면 "눌렀는데 아무 일도 안 난다"가 된다.
   */
  function openCard(r) {
    const known = { uid: r.uid, nickname: r.nickname, characterId: r.characterId };
    if (r.shoesOwned !== undefined) {
      openUserCard({ ...known, shoesOwned: r.shoesOwned, multiWins: r.multiWins, multiLosses: r.multiLosses }, { nav });
      return;
    }
    /**
     * 조회를 **기다렸다 띄우지 않는다** — "눌렀는데 아무 일도 안 난다"가 된다.
     * 아는 값으로 먼저 띄우고, 도착하면 카드가 그 줄만 갈아 끼운다(`opt.load`).
     * 다음에 같은 줄을 눌렀을 때 또 조회하지 않게 줄에도 적어 둔다.
     */
    const load = fetchUserCard(r.uid).then((full) => {
      if (full) Object.assign(r, full);
      return full;
    }).catch(() => null);
    openUserCard(known, { nav, load });
  }

  /** 순위 한 줄 */
  function row(r, opt = {}) {
    const ch = characterById(r.characterId);
    const games = (r.multiWins ?? 0) + (r.multiLosses ?? 0);
    return el('div.rank-row', { class: opt.me ? 'me' : '', onclick: () => openCard(r) }, [
      el('div.rank-no', r.rank === null ? '-' : String(r.rank)),
      ch ? el('img.rank-face', { src: characterSprite(ch.id, 'front'), alt: ch.ko, loading: 'lazy', decoding: 'async' })
         : el('div.rank-face'),
      el('div.rank-name', r.nickname || '???'),
      /**
       * ★ **신발왕 탭에만** 멀티 승률 칸. (2026-08-19 11차, 사용자 지정)
       * 고정폭 칸이라 이름 길이와 무관하게 세로로 줄이 맞는다 — *"줄 정렬해서 써줘"*.
       * 다른 탭에 넣지 않는 이유: 그 줄들은 `scores` 에서 와서 승패를 모른다.
       */
      opt.rate ? el('div.rank-rate', S.rankWinRate(r.multiWins ?? 0, games)) : null,
      el('div.rank-value', `${r.value.toLocaleString('en-US')}${opt.unit}`),
    ].filter(Boolean));
  }

  return {
    /**
     * ★ **떠난 뒤에 도착한 응답이 남의 화면을 건드리지 않게 한다.** (2026-08-16)
     *
     * `reqId` 는 원래 **같은 화면 안에서 탭을 옮긴 경우**만 막았다. 화면을 아예 떠난
     * 경우는 `my === reqId` 가 그대로 참이라 `nav.refresh()` 가 실행됐고,
     * `router.draw()` 는 "지금 살아 있는 화면"을 다시 그린다. 느린 회선에서
     * 순위표를 열었다 닫고 캐릭터 화면에서 닉네임을 입력하던 중에 응답이 도착하면
     * **입력하던 글자가 소리 없이 사라졌다.** 여기서 번호만 올려도 두 콜백이 다 빠져나간다.
     */
    onLeave() { reqId++; },

    render() {
      const tab = TABS.find((t) => t.id === tabId);
      const me = getProfile();
      /** 본문이 **스크롤되는 목록**인가 (로딩·오류·빈 목록은 아니다) */
      let listed = false;

      const tabs = el('div.seg.hof-tabs', null,
        TABS.map((t) =>
          button(t.label, () => {
            if (t.id === tabId) return;
            tabId = t.id;
            load();
            nav.refresh();
          }, { class: t.id === tabId ? 'on' : '', sfx: 'sfx_menu_move' })
        )
      );

      const subTabs = tab.byDifficulty
        ? el('div.seg', null,
            DIFFS.map((d) =>
              button(d.label, () => {
                if (d.value === diff) return;
                diff = d.value;
                load();
                nav.refresh();
              }, { class: d.value === diff ? 'on' : '', sfx: 'sfx_menu_move' })
            )
          )
        : null;

      /**
       * 비어 보이는 이유를 **구분해서** 말한다.
       * 예전에는 로그인이 풀렸든 연결이 막혔든 전부 "아직 기록이 없습니다"였다.
       * 그 한 줄 때문에 순위표가 왜 안 나오는지 아무도 알 수 없었다.
       */
      const REASON = {
        auth: S.rankNeedLogin,
        offline: S.networkError,
        failed: S.rankLoadFailed,
      };

      let body;
      if (state.loading) {
        body = el('div.hint', S.loading);
      } else if (!state.data || state.data.error) {
        body = el('div.hint', REASON[state.data?.error] ?? S.networkError);
      } else if (!state.data.rows.length) {
        body = el('div.hint', S.noRankYet);
      } else {
        /**
         * ★ **내가 가운데 오도록 잘라서 보여 준다.** (2026-08-19, 사용자 요청)
         * 11등인 사람에게 1~10등은 스크롤로 지나칠 줄일 뿐이다. 줄마다 등수 숫자가
         * 찍히므로 목록이 6등부터 시작해도 헷갈리지 않는다.
         */
        const win = rankWindow(state.data.rows, me.uid);
        let mineNode = null;
        const list = el('div.rank-list', null, win.map((r) => {
          const node = row(r, { unit: tab.unit, me: r.uid === me.uid, rate: tabId === 'shoeking' });
          if (r.uid === me.uid) mineNode = node;
          return node;
        }));
        /**
         * ★ **내 줄이 보이는 자리로 스크롤한다.** (2026-08-19 11차)
         * 반경이 50 이 되면서 목록이 100줄까지 나온다 — 안 내려 주면 내 순위를
         * 손으로 찾아야 하고, 그러면 "가운데에 나를 놓는다"는 규칙이 무의미해진다.
         */
        if (mineNode) scrollToMine(list, mineNode, keyOf(tabId, diff));
        body = list;
        listed = true;
      }

      // 하단 고정 — 100위 밖이어도 내 기록은 항상 보인다
      const mine = state.data?.me
        ? el('div.rank-mine', null, [
            el('div.rank-mine-label', S.myRank),
            row(state.data.me, { unit: tab.unit, me: true, rate: tabId === 'shoeking' }),
          ])
        : null;

      /**
       * ★ **목록이 있을 때는 여백을 넣지 않는다.** (2026-08-19 16차)
       *
       * `.spacer` 도 `.rank-list` 도 둘 다 `flex: 1` 이라, 둘을 같이 두면 남는 공간을
       * 나눠 갖는다. 그런데 목록은 `max-height` 로 묶여 있었으므로 **남는 공간이 전부
       * 여백으로 갔다** — 목록 아래가 통째로 검은 공백이 된 이유가 이것이다(실측 173~243px).
       * 목록이 늘어나야 할 자리에 여백이 들어가 있으면 안 된다.
       *
       * 반대로 로딩·오류처럼 목록이 없을 때는 여백이 있어야 '내 순위' 가 바닥에 붙는다.
       */
      return screen(
        title(S.hallTitle),
        tabs,
        subTabs,
        body,
        listed ? null : el('div.spacer'),
        mine,
        backButton(S.back, () => nav.back())
      );
    },
  };
}
