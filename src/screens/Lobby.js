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
import CharacterSelect from './CharacterSelect.js';
import Collection from './Collection.js';
import Controls from './Controls.js';
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

      return screen(
        el('div.lobby-logo', S.gameTitle),

        el('div.panel', null, [
          el('img', { src: characterSprite(ch.id, 'front'), alt: ch.ko }),
          el('div.stats', null, [
            el('div', `${S.bestRecord} ${p.bestStairs}${S.bestRecordUnit}`),
            el('div', `${S.myCollection} ${dexUnique()}/${SHOE_TOTAL}${S.collectionUnit}`),
            el('div', `${S.playerName} : ${p.nickname || '게스트'}`),
          ]),
        ]),

        el('div.diff-title', S.difficultyTitle),
        segmented(DIFFS, p.difficulty, (v) => {
          setDifficulty(v);
          nav.refresh();
        }),

        button(S.menuCollection, () => nav.push(Collection)),
        button(S.menuCharacter, () => nav.push(CharacterSelect)),
        button(S.menuHallOfFame, () => toast(S.comingSoon)),
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
        backButton(S.backToPortal, () => nav.back())
      );
    },
  };
}
