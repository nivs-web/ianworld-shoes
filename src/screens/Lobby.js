/**
 * S04 게임 로비 — 기획서 §7-1 레이아웃 순서 그대로.
 *
 *   로고 / 캐릭터+기록 / 난이도 / 메뉴 4개 / 싱글·멀티 / 엘리베이터 / 포털 복귀
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, segmented, screen, toast, confirmDialog } from './ui.js';
import { get as getProfile, setDifficulty, dexUnique } from '../services/profile.js';
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
import Controls from './Controls.js';
import Portal from './Portal.js';
import { startGame } from './startGame.js';

const DIFFS = [
  { value: 'easy', label: S.difficultyEasy },
  { value: 'normal', label: S.difficultyNormal },
  { value: 'hard', label: S.difficultyHard },
];

export default function Lobby(nav) {
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
          el('img', { src: characterSprite(ch.id, 'front'), alt: ch.ko }),
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
            el('div', `${S.playerName} : ${p.nickname}`),
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
        button(S.menuControls, () => nav.push(Controls)),

        el('div.row', null, [
          button(S.playSingle, () => startGame(nav, {}), { primary: true }),
          button(S.playMulti, () => toast(S.comingSoon)),
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
