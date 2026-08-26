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
import { startMissiles, startBombs } from '../games/dragon/items.js';
import { PAL } from '../game/palette.js';
import { pixelText } from './pixelText.js';
import Portal from './Portal.js';
import * as Crowns from '../services/dragonCrowns.js';
import DragonGame, { prefetchDragon, dragonFigure } from './DragonGame.js';
import { lazyScreen } from './lazyScreen.js';

/** 드래곤 변경은 이제 DOM 상점 화면이다 — 가로로 돌릴 필요가 없다 */
const DragonShop = lazyScreen(() => import('./DragonShop.js'), S.dragonShopTitle);
const DragonItems = lazyScreen(() => import('./DragonItems.js'), S.dragonItemTitle);
const DragonSettings = lazyScreen(() => import('./DragonSettings.js'), S.dragonMenuSettings);
const DragonRanking = lazyScreen(() => import('./DragonRanking.js'), S.dragonRankScore);
const DragonMultiMenu = lazyScreen(() => import('./multi/DragonMultiMenu.js'), S.duelTitle);

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
      /**
       * ★ **숫자를 고정폭으로 찍지 않는다.** (2026-08-26, 사용자 지정)
       *
       * "숫자와 숫자 사이 간격이 넘다" 는 지적을 재 보았다 —
       * `mono` 는 자릿수마다 가장 넣은 숫자('4')의 폭에 맞춰 밀어넣기 때문에
       * "128,400" 이 78px 으로 끝날 것을 **98px** 로 벌려 놓았다. 20px 이 전부 사이 간격이다.
       *
       * 고정폭은 숫자가 제자리에서 바뀌는 계기판에나 쓸모가 있다.
       * 이건 화면을 드나들 때만 다시 그려지는 문장이라 흔들릴 일이 없다.
       */
      const statNum = { scale: STAT_SCALE, mini: true, color: PAL.text };

      /* 아직 안 만든 메뉴는 감추지 않고 사실대로 말한다 — 감추면 물어볼 데가 없다 */
      const soon = (label) => button(label, () => toast(S.dragonSoon), { class: 'dim' });

      const wins = p.dragonMultiWins ?? 0;
      const games = wins + (p.dragonMultiLosses ?? 0);
      const c = Crowns.cached();

      /**
       * ★ **화면 순서** (2026-08-26, 사용자 지정 — 두 번 고쳤다)
       *
       * 처음엔 [싱글게임] 을 맨 위로 올렸는데, 직접 보고 나서
       * "역시 아래쪽이 예쁘다" 는 판단이 나왔다. 시작 버튼이 화면 맨 아래에
       * 있는 편이 오락실 기계의 큰 버튼처럼 읽힌다.
       *
       *   난이도 → 드래곤 변경·아이템 쇼핑 → 순위 둘 → 설정 → 싱글·멀티 → 오락실
       *
       * 꾸미기가 순위보다 위인 것도 지정이다 — 순위는 가끔 보고,
       * 드래곤과 아이템은 게임 들어가기 전에 매번 들른다.
       */
      return screen(
        /**
         * ★ **제목 글씨 대신 로고 그림.** (2026-08-26, 사용자 제작)
         *
         * 원본이 1916x821 · 2MB 였다. 로비 폭이 400px 안팎이라 **정확히 1/4** 로
         * 줄였다(479x205, 188KB). 정수배 + NEAREST 라 도트 격자가 4칸이 1칸으로
         * 그대로 접힌다 — 어중간한 배율로 줄이면 도트가 번져서 픽셀아트가 아니게 된다.
         * 팔레트로 더 줄여도 봤지만 은하수·무지개 테두리의 그라데이션이 뭉개져서
         * (픽셀의 44%가 8단계 넘게 틀어졌다) 무손실로 남겼다.
         *
         * `alt` 에 제목을 남긴다 — 그림이 안 뜨는 상황에서도 무슨 게임인지는 보여야 한다.
         */
        el('img.dragon-logo', {
          src: '/assets/dragon-logo.png',
          alt: S.dragonTitle,
          width: 479,
          height: 205,
          decoding: 'async',
        }),

        /* ── 로비유저상태창 : 고른 드래곤 + 내 기록 + 딱지 ── */
        el('div.panel', null, [
          /* ★ **드래곤 칸은 신발 칸보다 넓다.** (2026-08-26, 사용자 지정)
             그림틀(`.dg-figure`)은 108px 인데 공용 `.char-cell` 이 78px 이라
             드래곤이 날개를 펜 채로 가로로 찌그러져 있었다. */
          el('div.char-cell.dg', null, [
            dragonFigure(p.dragonCharacter | 0),
            el('div.char-name', p.nickname || '???'),
          ]),
          el('div.stats', null, [
            /* ★ 보유금화가 맨 위다 (2026-08-26, 사용자 지정) —
               점수는 순위표용이고 실제로 쓰는 돈은 금화다 */
            statLine(S.dragonCoinsOwned(p.dragonCoins || 0), statNum,
              c?.coins ? S.crownDragonCoin(c.coins) : null, c?.coins),
            statLine(S.dragonBestScore(p.dragonBest || 0), statNum,
              c?.score ? S.crownDragonScore(c.score) : null, c?.score),
            statLine(S.dragonMultiRecord(wins, games), statNum,
              c?.wins ? S.crownDragonWins(c.wins) : null, c?.wins),
            statLine(S.dragonPlays(p.dragonPlays || 0), statNum),
            /**
             * ★ **초기 보유량을 여기 적어 둔다.** (2026-08-26, 사용자 지정)
             * 아이템 쇼핑에 [초기 미사일]·[초기 핵무기] 가 생겼는데, 상점에 들어가야만
             * 보이면 그런 게 있는 줄도 모른다. 로비에서 매번 눈에 밟혀야 사러 간다.
             */
            statLine(S.dragonStartMissiles(startMissiles(p)), statNum),
            statLine(S.dragonStartBombs(startBombs(p)), statNum),
          ]),
        ]),

        el('div.diff-title', S.dragonHint),
        segmented(DIFFS, p.dragonDifficulty || 'normal', (v) => {
          setDragonDifficulty(v);
          nav.refresh();
        }),

        /**
         * 드래곤 변경은 DOM 상점(`DragonShop`), 설정은 게임 안 화면이다.
         * 설정의 도트 미리보기(스틱·버튼)가 캔버스에만 있어서 아직 옮기지 못했다.
         */
        el('div.row', null, [
          button(S.dragonMenuCharacter, () => nav.push(DragonShop)),
          button(S.dragonMenuShop, () => nav.push(DragonItems)),
        ]),

        el('div.row', null, [
          button(S.dragonRankScore, () => nav.push(DragonRanking, { kind: 'score' })),
          button(S.dragonRankCoin, () => nav.push(DragonRanking, { kind: 'coin' })),
        ]),

        button(S.dragonMenuSettings, () => nav.push(DragonSettings)),

        /* 시작 버튼은 맨 아래 — 오락실 기계의 큰 버튼 자리다 */
        el('div.row', null, [
          button(S.playSingle, () => nav.push(DragonGame, { mode: 'play' }), { primary: true }),
          button(S.playMulti, () => nav.push(DragonMultiMenu)),
        ]),

        el('div.spacer'),
        backButton(S.backToPortal, () => nav.reset(Portal))
      );
    },
  };
}
