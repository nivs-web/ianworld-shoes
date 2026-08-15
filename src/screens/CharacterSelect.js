/**
 * S05 캐릭터 선택 / 구매.
 *
 * 잠금 캐릭터는 **회색 실루엣**으로만 보여준다 — 생김새를 숨겨야 궁금해진다. (기획서 §5-8)
 * 구매는 신발을 **높은 티어부터** 차감한다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title, toast, confirmDialog } from './ui.js';
import * as Sfx from '../audio/sfx.js';
import { CHARACTERS, characterSprite } from '../data/characters.js';
import { get as getProfile, setCharacter, buyCharacter } from '../services/profile.js';

export default function CharacterSelect(nav) {
  let index = Math.max(0, CHARACTERS.findIndex((c) => c.id === getProfile().selectedCharacter));

  return {
    render() {
      const p = getProfile();
      const ch = CHARACTERS[index];
      const owned = p.unlockedCharacters.includes(ch.id);
      const affordable = p.shoesOwned >= ch.cost;

      function move(d) {
        index = (index + d + CHARACTERS.length) % CHARACTERS.length;
        Sfx.play('sfx_menu_move');
        nav.refresh();
      }

      function pick() {
        setCharacter(ch.id);
        nav.back();
      }

      async function buy() {
        if (!affordable) {
          Sfx.play('sfx_denied');
          toast(S.purchaseFailed);
          return;
        }
        const ok = await confirmDialog({
          message: S.purchaseConfirm,
          detail: S.purchaseWarning,
          yes: S.yes,
          no: S.no,
        });
        if (!ok) return;
        const r = buyCharacter(ch.id);
        if (r.ok) {
          Sfx.play('sfx_purchase');
          toast(S.purchaseDone);
          setCharacter(ch.id);
        } else {
          Sfx.play('sfx_denied');
          toast(S.purchaseFailed);
        }
        nav.refresh();
      }

      return screen(
        title(S.menuCharacter),

        el('div.char-stage', null, [
          el('button.arrow', { text: '◀', type: 'button', onclick: () => move(-1) }),
          el('div.char-figure', { class: owned ? '' : 'locked' }, [
            el('img', { src: characterSprite(ch.id, 'front'), alt: owned ? ch.ko : '???' }),
          ]),
          el('button.arrow', { text: '▶', type: 'button', onclick: () => move(1) }),
        ]),

        el('div.char-name', owned ? ch.ko : S.notFoundYet),
        el('div.char-count', `${index + 1} / ${CHARACTERS.length}`),

        owned
          ? button(S.select, pick, { primary: true })
          : el('div.buy-wrap', null, [
              el('div.hint', S.needShoes(ch.cost)),
              button(S.buyCharacter, buy, { primary: affordable, disabled: false }),
              el('div.hint', `${S.myCollection} ${p.shoesOwned}${S.collectionUnit}`),
            ]),

        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
