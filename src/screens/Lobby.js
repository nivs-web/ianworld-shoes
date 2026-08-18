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
import { pixelBadge } from './pixelBadge.js';
import { badgeSlots } from '../data/badges.js';
import CharacterSelect from './CharacterSelect.js';
import Collection from './Collection.js';
import HallOfFame from './HallOfFame.js';
import Settings from './Settings.js';
import MultiMenu from './multi/MultiMenu.js';
import Portal from './Portal.js';
import { startGame } from './startGame.js';

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
  import('../services/multiplayer.js').then((M) => M.prewarm()).catch(() => {});
}

export default function Lobby(nav) {
  prewarmMultiIfReturning();
  return {
    render() {
      const p = getProfile();
      const ch = characterById(p.selectedCharacter);

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
            // 최고기록 숫자만 인게임 계단 수와 같은 글꼴·외곽선으로 (기획 요청)
            el('div.stat-best', null, [
              el('span', S.bestRecord),
              pixelText(p.bestStairs, {
                scale: 3, color: PAL.text, outline: PAL.textShadow, mono: true,
              }),
              el('span', S.bestRecordUnit),
            ]),
            el('div', S.myShoesOwned(p.shoesOwned)),
            el('div', S.myDexProgress(dexUnique(), SHOE_TOTAL)),
            el('div', S.myMultiRecord(p.multiWins ?? 0, (p.multiWins ?? 0) + (p.multiLosses ?? 0))),
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
