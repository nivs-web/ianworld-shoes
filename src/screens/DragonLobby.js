/**
 * S19 드래곤 스트라이커 **게임로비** — [싱글게임] 을 누르면 판이 시작되는 화면.
 *
 * 신발게임 로비(`Lobby.js`)와 같은 레이아웃 순서를 따른다:
 *   제목 / 로비유저상태창 / 난이도 / 메뉴 / 싱글·멀티 / 오락실 복귀
 * 두 게임의 로비가 서로 다르게 생기면 오락실이 아니라 그냥 딴 사이트다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, segmented, screen, toast } from './ui.js';
import { get as getProfile, setDragonDifficulty } from '../services/profile.js';
import { PAL } from '../game/palette.js';
import { pixelText } from './pixelText.js';
import Portal from './Portal.js';
import * as Crowns from '../services/dragonCrowns.js';
import DragonGame, { prefetchDragon, dragonFigure } from './DragonGame.js';
import { lazyScreen } from './lazyScreen.js';

/** 드래곤 변경은 이제 DOM 상점 화면이다 — 가로로 돌릴 필요가 없다 */
const DragonShop = lazyScreen(() => import('./DragonShop.js'), S.dragonShopTitle);

const DIFFS = [
  { value: 'easy', label: S.difficultyEasy },
  { value: 'normal', label: S.difficultyNormal },
  { value: 'hard', label: S.difficultyHard },
];

/** 신발게임 로비와 **같은 숫자 크기**를 쓴다 (Lobby.js 의 STAT_SCALE) */
const STAT_SCALE = 2;

/**
 * `라벨 1,234 단위` 한 줄.
 *
 * ★ **숫자만 도트 글꼴로 찍는다.** (2026-08-26, 버그 수정)
 *
 * 예전에는 문장을 통째로 `pixelText(..., { mini:true })` 에 넘겼다. 그런데 mini 는
 * **숫자 전용 9px 글꼴**이라 한글이 한 자도 없다 — 화면에 `?????????0?` 로 나왔다.
 * 신발게임 로비는 진작부터 숫자만 뽑아 쓰고 있었다(`Lobby.js` 의 `statLine`).
 * 같은 방식으로 되돌린다: 숫자는 도트로, 한글은 평범한 글자로.
 */
function statLine(str, numOpt, tag, crownRank) {
  const parts = String(str).split(/([\d,]+)/);
  const line = el('div.stat-line', null, parts.map((part, i) => {
    if (!/^[\d,]+$/.test(part)) return part;
    const cv = pixelText(part, numOpt);
    /* 캔버스 사방의 외곽선 여백이 없는 띄어쓰기를 만든다 — 음수 여백으로 상쇄 */
    const pad = Number(cv.dataset.pad || 0);
    cv.style.marginLeft = /\s$/.test(parts[i - 1] ?? '') ? '0' : `-${pad}px`;
    cv.style.marginRight = `-${pad}px`;
    return cv;
  }));
  /* 1위 금, 2위 은, 3위 동 — 신발게임과 **같은 부품**을 쓴다 (색이 곧 등수다) */
  if (tag) line.append(el(`span.stat-done${crownRank ? `.crown-tag.c${crownRank}` : ''}`, tag));
  return line;
}

export default function DragonLobby(nav) {
  /**
   * 게임 코드를 미리 받아 둔다. [싱글게임] 을 누를 때 이미 있고,
   * **로비유저상태창의 드래곤 그림도 이 모듈이 그려 준다** — 도트가 거기에만 있다.
   * 도착하면 화면을 한 번 다시 그린다 (신발 로비가 왕관 딱지를 받는 것과 같은 방식).
   */
  let live = true;
  prefetchDragon().then(() => { if (live) nav.refresh(); }).catch(() => {});
  /* 딱지는 없어도 화면이 성립한다 — 늦게 와도 그 줄만 다시 그린다 */
  const offCrowns = Crowns.refresh(() => { if (live) nav.refresh(); });

  return {
    onLeave() { live = false; offCrowns(); },

    render() {
      const p = getProfile();
      const statNum = { scale: STAT_SCALE, mini: true, color: PAL.text, mono: true };

      /* 아직 안 만든 메뉴는 감추지 않고 사실대로 말한다 — 감추면 물어볼 데가 없다 */
      const soon = (label) => button(label, () => toast(S.dragonSoon), { class: 'dim' });

      const wins = p.dragonMultiWins ?? 0;
      const games = wins + (p.dragonMultiLosses ?? 0);
      const c = Crowns.cached();

      /**
       * ★ **화면 순서 개편.** (2026-08-26, 사용자 지정)
       * 가장 자주 누르는 것을 위로: 난이도 → 게임 시작 → 순위 → 꾸미기 → 설정.
       * 예전에는 [싱글게임] 이 메뉴 다섯 개 아래에 있어서 매번 스크롤해야 했다.
       */
      return screen(
        el('div.dragon-title', S.dragonTitle),

        /* ── 로비유저상태창 : 고른 드래곤 + 내 기록 + 딱지 ── */
        el('div.panel', null, [
          el('div.char-cell', null, [
            dragonFigure(p.dragonCharacter | 0),
            el('div.char-name', p.nickname || '???'),
          ]),
          el('div.stats', null, [
            statLine(S.dragonBestScore(p.dragonBest || 0), statNum,
              c?.score ? S.crownDragonScore(c.score) : null, c?.score),
            statLine(S.dragonCoinsOwned(p.dragonCoins || 0), statNum,
              c?.coins ? S.crownDragonCoin(c.coins) : null, c?.coins),
            statLine(S.dragonMultiRecord(wins, games), statNum,
              c?.wins ? S.crownDragonWins(c.wins) : null, c?.wins),
            statLine(S.dragonPlays(p.dragonPlays || 0), statNum),
          ]),
        ]),

        el('div.diff-title', S.dragonHint),
        segmented(DIFFS, p.dragonDifficulty || 'normal', (v) => {
          setDragonDifficulty(v);
          nav.refresh();
        }),

        el('div.row', null, [
          button(S.playSingle, () => nav.push(DragonGame, { mode: 'play' }), { primary: true }),
          soon(S.playMulti),
        ]),

        el('div.row', null, [
          soon(S.dragonRankScore),
          soon(S.dragonRankCoin),
        ]),

        /**
         * 드래곤 변경은 DOM 상점(`DragonShop`), 설정은 게임 안 화면이다.
         * 설정의 도트 미리보기(스틱·버튼)가 캔버스에만 있어서 아직 옮기지 못했다.
         */
        el('div.row', null, [
          button(S.dragonMenuCharacter, () => nav.push(DragonShop)),
          soon(S.dragonMenuShop),
        ]),

        button(S.dragonMenuSettings, () => nav.push(DragonGame, { mode: 'options' })),

        el('div.spacer'),
        backButton(S.backToPortal, () => nav.reset(Portal))
      );
    },
  };
}
