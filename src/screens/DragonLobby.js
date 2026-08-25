/**
 * S19 드래곤 스트라이커 로비 — 신발게임 로비(`Lobby.js`)와 **같은 레이아웃 순서**.
 *
 *   로고 / 기록 패널 / 난이도 / 메뉴 / 싱글·멀티 / 포털 복귀
 *
 * 두 게임의 로비가 서로 다르게 생기면 오락실이 아니라 그냥 딴 사이트다.
 * 그래서 `screen()`·`panel`·`segmented` 같은 부품을 그대로 쓴다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, segmented, screen, toast } from './ui.js';
import { get as getProfile, setDragonDifficulty } from '../services/profile.js';
import { PAL } from '../game/palette.js';
import { pixelText } from './pixelText.js';
import Portal from './Portal.js';
import DragonGame from './DragonGame.js';

const DIFFS = [
  { value: 'easy', label: S.difficultyEasy },
  { value: 'normal', label: S.difficultyNormal },
  { value: 'hard', label: S.difficultyHard },
];

/** 신발게임 로비와 **같은 숫자 크기**를 쓴다 (Lobby.js 의 STAT_SCALE) */
const STAT_SCALE = 2;

/**
 * `숫자 + 단위` 한 줄. 신발 로비의 `statLine` 과 같은 모양이지만,
 * 저쪽은 왕관 딱지까지 받는 함수라 그대로 가져오면 안 쓰는 인자가 따라온다.
 * 필요한 만큼만 여기 둔다.
 */
function statLine(text, numOpt) {
  return el('div', null, [pixelText(text, numOpt)]);
}

export default function DragonLobby(nav) {
  return {
    render() {
      const p = getProfile();
      const statNum = { scale: STAT_SCALE, mini: true, color: PAL.text, mono: true };

      /**
       * 아직 안 만든 메뉴는 **버튼을 감추지 않고 눌리게 두되 사실대로 말한다.**
       * 감춰 두면 "언제 생기나" 를 물어볼 데가 없고, 조용히 아무 일도 안 하면
       * 고장으로 읽힌다.
       */
      const soon = (label) => button(label, () => toast(S.dragonSoon), { class: 'dim' });

      return screen(
        el('div.dragon-title', S.dragonTitle),

        el('div.panel', null, [
          el('div.stats', null, [
            statLine(S.dragonBestScore(p.dragonBest || 0), statNum),
            statLine(S.dragonBestStage(p.dragonBestStage || 0), statNum),
            statLine(S.dragonFireLv(p.dragonBestLevel || 0), statNum),
            statLine(S.dragonPlays(p.dragonPlays || 0), statNum),
          ]),
        ]),

        el('div.diff-title', S.dragonHint),
        segmented(DIFFS, p.dragonDifficulty || 'normal', (v) => {
          setDragonDifficulty(v);
          nav.refresh();
        }),

        /**
         * 드래곤 변경·설정은 **게임 안 화면을 그대로 연다**(`DragonGame` 의 mode).
         * 도트 10종을 그리는 코드가 게임 쪽에만 있어서, 여기에 또 만들면
         * 캐릭터를 하나 추가할 때마다 두 곳을 고쳐야 한다.
         */
        button(S.dragonMenuCharacter, () => nav.push(DragonGame, { mode: 'chars' })),
        button(S.dragonMenuSettings, () => nav.push(DragonGame, { mode: 'options' })),
        soon(S.menuHallOfFame),
        soon(S.menuItemShop),

        el('div.row', null, [
          button(S.playSingle, () => nav.push(DragonGame, { mode: 'play' }), { primary: true }),
          soon(S.playMulti),
        ]),

        el('div.spacer'),
        backButton(S.backToPortal, () => nav.reset(Portal))
      );
    },
  };
}
