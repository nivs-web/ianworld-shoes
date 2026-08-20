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
 * ★ **로비 통계 네 줄을 전부 같은 방식으로 그린다.** (2026-08-19 17~18차, 사용자 지정)
 *
 * 문구는 `strings.ko.js` 에 **문장 그대로** 있고, 여기서 숫자 덩어리만 찾아
 * 비트맵(`pixelText`)으로 갈아 끼운다. 사이사이 글자는 문자열 그대로 남으므로
 * **띄어쓰기가 문구에 적힌 대로 나온다** — `최고기록 5432계단` 이면 라벨 뒤는 한 칸,
 * `계단` 앞은 0칸이다. `gap` 으로 조각을 붙이면 그 구분이 불가능하다(18차에 고친 것).
 *
 * 문구를 `신발도감`/`87`/`/`/`130`/`켤레` 로 쪼개 strings 에 두는 방법도 있지만,
 * 그러면 문구 하나가 코드 다섯 줄이 되고 말을 바꿀 때 두 곳을 고쳐야 한다.
 *
 * `mono` 로 찍는 이유: 자릿수가 바뀔 때 숫자 칸의 폭이 들쭉날쭉하면 줄이 흔들린다.
 */
function statLine(str, numOpt) {
  const parts = String(str).split(/(\d+)/);
  return el('div.stat-line', null, parts.map((part, i) => {
    if (!/^\d+$/.test(part)) return part;
    const cv = pixelText(part, numOpt);
    /**
     * 캔버스에는 외곽선 여백이 사방에 있다(투명한 빈 칸). 그대로 두면 `5432 계단` 처럼
     * **없는 띄어쓰기가 생긴다** — 음수 여백으로 정확히 상쇄한다.
     * 다만 **앞이 공백이면 왼쪽은 그대로 둔다**: 그 자리는 문구에 적힌 진짜 띄어쓰기라
     * 같이 지우면 `최고기록5432` 처럼 라벨까지 달라붙는다.
     */
    const pad = Number(cv.dataset.pad || 0);
    cv.style.marginLeft = /\s$/.test(parts[i - 1] ?? '') ? '0' : `-${pad}px`;
    cv.style.marginRight = `-${pad}px`;
    return cv;
  }));
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
        mono: true,
      };

      /** 엘리베이터 — 500층을 밟아 본 계정에게만 보인다 (기획서 §5-8-1) */
      /**
       * 19차: `ELEVATOR.enabled` 가 꺼져 있으면 **버튼 자체가 없다**(사용자 지정).
       * 해금 여부·신발 수는 그대로 계산해 두므로 다시 켜면 그 자리에 그대로 돌아온다.
       */
      const elevatorUnlocked = ELEVATOR.enabled && p.bestStairs >= ELEVATOR.unlockFloor;
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
             * ★ **네 줄 전부 같은 모양** — 라벨 · 21px 비트맵 숫자 · 붙은 단위.
             * (2026-08-19 18차, 사용자 지정: *"00승 00게임에서 숫자로 나온 부분 21px으로
             * 가자 (…) 모든 줄 간격이 똑같게 하면 깔끔할거 같아"*)
             *
             * 순서도 바꿨다 — **멀티게임이 위, 신발도감이 아래.**
             * 네 줄이 같은 함수·같은 옵션(`statNum`)을 쓰므로 크기가 갈라질 수 없다.
             */
            statLine(S.myBestRecord(p.bestStairs), statNum),
            statLine(S.myShoesOwned(p.shoesOwned), statNum),
            statLine(S.myMultiRecord(p.multiWins ?? 0, (p.multiWins ?? 0) + (p.multiLosses ?? 0)), statNum),
            statLine(S.myDexProgress(dexUnique(), SHOE_TOTAL), statNum),
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
