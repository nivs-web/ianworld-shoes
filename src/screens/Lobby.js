/**
 * S04 게임 로비 — 기획서 §7-1 레이아웃 순서 그대로.
 *
 *   로고 / 캐릭터+기록 / 난이도 / 메뉴 4개 / 싱글·멀티 / 엘리베이터 / 포털 복귀
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, segmented, screen, toast, confirmDialog } from './ui.js';
import { get as getProfile, setDifficulty, dexUnique } from '../services/profile.js';
import { everPlayedMulti } from '../services/storageLocal.js';
import { characterById, characterSprite } from '../data/characters.js';
import { SHOE_TOTAL } from '../config/balance.js';
import { ELEVATOR } from '../config/balance.js';
import { PAL } from '../game/palette.js';
import { pixelText } from './pixelText.js';
import { loadSmallFont, smallReady } from '../core/pixelfont.js';
import { pixelBadge } from './pixelBadge.js';
import { badgeSlots } from '../data/badges.js';
import Portal from './Portal.js';
import { lazyScreen, prefetchScreens } from './lazyScreen.js';
import { startGame } from './startGame.js';
import * as Presence from '../services/presence.js';

/**
 * ★ **메뉴 화면은 누를 때 받는다.** (2026-08-19 13차, 속도 — `lazyScreen.js` 주석)
 *
 * 이 다섯을 정적으로 import 하면 도감의 신발 130종 표, 배경설정의 배경 44종 명단,
 * 명예의 전당, 멀티 화면 일체가 **로비를 그리기도 전에** 부팅 번들에 들어온다.
 * 로비에서 실제로 쓰는 건 버튼 라벨뿐이다.
 */
const Collection = lazyScreen(() => import('./Collection.js'), S.menuCollection);
const CharacterSelect = lazyScreen(() => import('./CharacterSelect.js'), S.menuCharacter);
const HallOfFame = lazyScreen(() => import('./HallOfFame.js'), S.hallTitle);
const Settings = lazyScreen(() => import('./Settings.js'), S.settingsTitle);
const MultiMenu = lazyScreen(() => import('./multi/MultiMenu.js'), S.multiTitle);

const DIFFS = [
  { value: 'easy', label: S.difficultyEasy },
  { value: 'normal', label: S.difficultyNormal },
  { value: 'hard', label: S.difficultyHard },
];

/**
 * ★ **멀티를 해 본 사람은 로비에서 미리 붙여 둔다.** (2026-08-19, 입장 체감속도)
 *
 * 예전에는 멀티 메뉴를 연 순간에야 `prewarm()` 이 돌았다. 그런데 거기서 '방 입장'까지는
 * 몇 백 ms 만에 눌리는 일이 많아서, **RTDB 청크(192KB)를 받고 웹소켓을 여는 시간이
 * 그대로 버튼 누른 뒤의 대기**로 나타났다. 로비에서 미리 시작하면 그 시간이 사용자가
 * 화면을 보는 동안 지나간다.
 *
 * **멀티를 한 번도 안 한 사람에게는 절대 부르지 않는다** — 싱글만 하는 사람이 192KB를
 * 받게 되는 건 예전에 고친 회귀다(§9-0-11).
 */
function prewarmMultiIfReturning() {
  if (!everPlayedMulti()) return;
  /**
   * ★ **한가할 때 붙는다.** (2026-08-19 13차, 속도)
   *
   * 로비는 **부팅 직후**에 뜬다. 여기서 곧바로 RTDB 청크(44KB gz)를 부르면
   * 아직 내려오는 중인 firebase 청크·글꼴·로고와 회선을 다툰다 — 그 대가는
   * "첫 화면이 늦다"로 나타나고, 정작 얻는 건 몇 초 뒤에나 쓸 연결이다.
   * `requestIdleCallback` 으로 미루면 **누르기 전에는 반드시 붙어 있고**
   * 부팅과는 겹치지 않는다.
   */
  const go = () => import('../services/multiplayer.js').then((M) => M.prewarm()).catch(() => {});
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1200);
}

/** 로비에 들어오면 **한가할 때** 메뉴 화면들을 미리 받아 둔다 — 누를 때는 이미 있다 */
function prewarmMenus() {
  prefetchScreens([Collection, CharacterSelect, HallOfFame, Settings, MultiMenu]);
}

/**
 * 로비 통계의 큰 숫자 크기. 최고기록과 보유신발이 **같은 값을 쓴다** —
 * 둘이 달라지면 "같은 크기로" 라는 요구(16차)가 깨진다.
 *
 * ★ **7px 글꼴 ×3 = 21px** (2026-08-19 17차, 사용자 지정 "딱 1단계만 줄여")
 *
 * 배율은 정수만 되므로(§3-1) 고를 수 있는 크기는 두 글꼴을 합쳐
 * **11 · 14 · 21 · 22 · 28 · 33px** 뿐이다. 16차의 22px(11px 글꼴 ×2) 바로 아래 칸이 21px 다.
 * 네 가지를 실제로 렌더해 나란히 보여 주고 사용자가 골랐다.
 *
 * ⚠ 작은 글꼴은 **비동기로 받는다**(`loadSmallFont`). 아직 안 왔는데 `small: true` 로
 *   그리면 `pixelText` 가 11px 글꼴로 떨어져 **×3 = 33px**, 즉 **더 커진다.**
 *   그래서 도착 전에는 배율 2(=22px)로 그리고 도착하면 다시 그린다 — 22 → 21 은 1px
 *   차이라 바뀌는 순간이 눈에 안 띈다. 반대로 33 → 21 이면 화면이 출렁인다.
 */
const STAT_SCALE = 3;
const STAT_FALLBACK_SCALE = 2;

/**
 * ★ **문구 안의 숫자만 크게 찍는다.** (2026-08-19 17차, 사용자 지정)
 *
 * *"신발도감 87/130켤레, 멀티게임 17승/50게임 (…) 87, 130, 17, 50 이렇게 4곳
 *   숫자부분만 글씨 크기를 2단계 크게"*
 *
 * 문구를 `신발도감`/`87`/`/`/`130`/`켤레` 처럼 조각내서 strings 에 두는 방법도 있지만,
 * 그러면 **문구 하나가 코드 다섯 줄이 되고** 나중에 말을 바꿀 때 두 곳을 고쳐야 한다.
 * 여기서 숫자 덩어리만 찾아 감싼다 — 문구는 `strings.ko.js` 에 문장 그대로 남는다
 * (그래서 `qa:multi` 의 문구 검사도 문장 하나로 유지된다).
 *
 * 비트맵이 아니라 **CSS 글자 크기**다. 이 줄들은 게임 화면과 같아야 할 이유가 없고,
 * 비트맵으로 찍으면 줄이 넘칠 때 잘리지도 줄바꿈되지도 않는다(pixelText 주석 참고).
 */
function statLine(str) {
  return el('div', null,
    String(str).split(/(\d+)/).map((part) => (/^\d+$/.test(part) ? el('span.stat-num', part) : part))
  );
}

export default function Lobby(nav) {
  prewarmMultiIfReturning();
  /**
   * 큰 숫자에 쓸 7px 글꼴을 받아 둔다. 화면을 떠난 뒤에 도착하면 다시 그리지 않는다 —
   * `nav.refresh()` 는 "지금 살아 있는 화면"을 그리므로 남의 화면을 건드리게 된다
   * (§9-0-14 에서 순위표 응답이 정확히 그렇게 입력 중인 닉네임을 날렸다).
   */
  let live = true;
  if (!smallReady()) {
    /**
     * **한가할 때** 받는다(19KB gzip). 로비를 그린 직후는 사용자가 곧바로
     * `싱글게임` 을 누르는 순간이라 판 에셋(146KB)과 회선을 다투게 된다(§9-0-43).
     * 도착 전에는 22px 로 그려져 있고 바뀌어도 1px 차이라 눈에 안 띈다.
     */
    const go = () => { loadSmallFont().then((f) => { if (f && live) nav.refresh(); }).catch(() => {}); };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 2500 });
    else setTimeout(go, 1200);
  }
  /**
   * 로비로 돌아왔다 — 접속 카드의 신발·승패·닉네임을 다시 쓴다. (2026-08-19 11차)
   * 판이 끝났거나 캐릭터를 샀거나 닉네임을 바꿨으면 반드시 여기를 지나므로,
   * 화면마다 갱신을 흩뿌리지 않고 이 한 곳에서 맞춘다. 아직 안 붙었으면 아무 일도 안 한다.
   */
  Presence.refresh();
  prewarmMenus();
  return {
    onLeave() { live = false; },

    render() {
      const p = getProfile();
      const ch = characterById(p.selectedCharacter);
      /** 최고기록·보유신발이 **반드시 같은 값을 쓰게** 한 곳에서 만든다 */
      const small = smallReady();
      const statNum = {
        scale: small ? STAT_SCALE : STAT_FALLBACK_SCALE,
        small,
        color: PAL.text,
        outline: PAL.textShadow,
        mono: true,
      };

      /** 엘리베이터 — 500층을 밟아 본 계정에게만 보인다 (기획서 §5-8-1) */
      const elevatorUnlocked = p.bestStairs >= ELEVATOR.unlockFloor;
      const canAffordElevator = p.shoesOwned >= ELEVATOR.cost;

      async function onElevator() {
        if (!canAffordElevator) {
          toast(S.needShoes(ELEVATOR.cost));
          return;
        }
        const ok = await confirmDialog({
          message: S.elevatorConfirm,
          detail: `${S.elevatorCost(ELEVATOR.cost)}\n${S.purchaseWarning}`,
          yes: S.yes,
          no: S.no,
        });
        if (ok) startGame(nav, { useElevator: true });
      }

      // 뱃지 2칸 — 없으면 빈 진열대를 그린다 (data/badges.js 가 조건을 판정한다)
      const slots = badgeSlots(p);

      return screen(
        el('img.lobby-logo', { src: '/assets/ui/logo_game.png', alt: S.gameTitle }),

        el('div.panel', null, [
          /**
           * ★ **캐릭터 칸 — 그림 + 이름.** (2026-08-19)
           * 예전에는 이름이 오른쪽 통계 줄에 `플레이어 이름 : ○○` 로 섞여 있었다.
           * 그 자리는 이제 멀티 전적이 쓰고, 캐릭터 이름은 **그림 바로 아래 노란 글씨**로
           * 붙인다 — 누구를 고르고 있는지는 그림 옆이 가장 읽기 쉽다.
           */
          /**
           * 그림 아래 이름은 **캐릭터 이름이 아니라 내 닉네임**이다 (2026-08-19 정정).
           * 로그인하고 직접 정한 2~5자 아이디가 "나"를 가리키는 이름이고, 캐릭터 이름은
           * 캐릭터 변경 화면에서 고를 때만 필요하다. 로비에서 내 이름이 안 보이면
           * 어느 계정으로 들어와 있는지 알 길이 없다.
           */
          el('div.char-cell', null, [
            el('img', { src: characterSprite(ch.id, 'front'), alt: ch.ko }),
            el('div.char-name', p.nickname || '???'),
          ]),
          el('div.stats', null, [
            /**
             * ★ **큰 숫자 두 줄** — 최고기록과 보유신발. (2026-08-19 16차, 사용자 지정)
             *
             * 인게임 계단 수와 같은 글꼴·외곽선으로 찍는다(`pixelText`). 배율은
             * **3 → 2**(33px → 22px) — *"3단계 숫자 크기를 작게 줄여"*. 배율은 정수만
             * 허용되므로(§3-1) 11px 글꼴에서 고를 수 있는 것은 22 와 33 둘뿐이다.
             *
             * 그리고 보유신발을 **같은 크기**로 올렸다 — *"보유 신발 수량이 생각보다
             * 중요한데 너무 작게 표기되는 거 같아서"*. 둘 다 22 로 맞추면 패널 높이가
             * 예전(33+13)과 같아서(22+22) 뱃지 칸·캐릭터 칸이 밀리지 않는다
             * (`npm run qa:lobbyfit` 이 네 폭에서 잰다).
             */
            el('div.stat-best', null, [
              el('span', S.bestRecord),
              pixelText(p.bestStairs, statNum),
              el('span', S.bestRecordUnit),
            ]),
            el('div.stat-best.stat-shoes', null, [
              el('span', S.myShoesLabel),
              pixelText(p.shoesOwned, statNum),
              el('span', S.myShoesUnit),
            ]),
            statLine(S.myDexProgress(dexUnique(), SHOE_TOTAL)),
            statLine(S.myMultiRecord(p.multiWins ?? 0, (p.multiWins ?? 0) + (p.multiLosses ?? 0))),
          ]),
          el('div.badges', null, slots.map((b) => pixelBadge(b))),
        ]),

        el('div.diff-title', S.difficultyTitle),
        segmented(DIFFS, p.difficulty, (v) => {
          setDifficulty(v);
          nav.refresh();
        }),

        button(S.menuCollection, () => nav.push(Collection)),
        button(S.menuCharacter, () => nav.push(CharacterSelect)),
        button(S.menuHallOfFame, () => nav.push(HallOfFame)),
        button(S.menuSettings, () => nav.push(Settings)),

        el('div.row', null, [
          button(S.playSingle, () => startGame(nav, {}), { primary: true }),
          button(S.playMulti, () => nav.push(MultiMenu)),
        ]),

        elevatorUnlocked
          ? button(S.elevatorButton, onElevator, { disabled: false, class: canAffordElevator ? '' : 'dim' })
          : null,
        elevatorUnlocked && !canAffordElevator ? el('div.hint', S.needShoes(ELEVATOR.cost)) : null,

        el('div.spacer'),
        /**
         * `nav.back()` 이 아니라 `reset(Portal)` 이다.
         * 닉네임이 있는 재방문자는 main.js가 로비로 **직행**시켜서 스택에 로비 하나뿐이고,
         * router.back() 은 stack.length <= 1 이면 아무 일도 하지 않는다 —
         * 그래서 로그인한 뒤로는 이 버튼이 먹지 않았다. 포털은 어차피 뿌리 화면이라
         * 어떤 경로로 들어왔든 여기로 되돌리는 게 맞다.
         */
        backButton(S.backToPortal, () => nav.reset(Portal))
      );
    },
  };
}
