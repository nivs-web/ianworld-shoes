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
import {
  get as getProfile, setCharacter, buyCharacter,
  validateNickname, isNicknameTaken, saveNickname,
} from '../services/profile.js';
import { setNickname } from '../services/auth.js';
import { NICKNAME } from '../config/balance.js';
import * as L from '../services/storageLocal.js';

export default function CharacterSelect(nav) {
  /** 입력 중인 닉네임과 안내 문구 — 다시 그려도 살아남아야 한다 */
  let draftNick = '';
  let draftMsg = '';
  let index = Math.max(0, CHARACTERS.findIndex((c) => c.id === getProfile().selectedCharacter));
  let renaming = false;

  /**
   * 닉네임 변경 — 캐릭터 화면 아래 빈 자리에 둔다.
   *
   * **최초 설정은 공짜지만 변경은 유료다.** 계정을 만들 때는 반드시 거쳐야 하는 단계지만
   * 변경은 선택이고, 값을 매기지 않으면 랭킹에서 이름만 바꿔 가며 도망칠 수 있다.
   */
  function renameSection(p) {
    const cost = NICKNAME.changeCost;
    const input = el('input.nick-input', {
      type: 'text',
      maxlength: NICKNAME.maxLength,
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
    });
    /**
     * ★ **입력값과 안내 문구를 화면 인스턴스가 들고 있는다.** (2026-08-16)
     *
     * `nav.refresh()` 는 `#ui` 를 통째로 다시 그린다(router.js). 탭·index 같은 상태는
     * 인스턴스 변수라 살아남았는데, **입력값만은 DOM 안에만 있었다.** 그래서 닉네임을
     * 절반쯤 치다가 캐릭터 화살표(`◀`/`▶`)를 한 번 누르면 **입력이 통째로 사라졌다.**
     * 200켤레짜리 유료 기능인데 왜 지워졌는지 알 방법도 없었다(문구도 같이 초기화).
     */
    input.value = draftNick;
    input.addEventListener('input', () => { draftNick = input.value; });
    const msg = el('div.hint', draftMsg || S.renamePrompt);
    if (draftMsg) msg.classList.add('bad');
    const fail = (t) => { draftMsg = t; msg.textContent = t; msg.classList.add('bad'); };

    async function submit() {
      if (renaming) return;
      const v = input.value.trim();
      if (!validateNickname(v)) return fail(S.nicknameInvalid);
      if (v === p.nickname) return fail(S.renameSame);
      // 신발 확인을 **먼저** — 중복 검사로 몇 초 기다린 뒤에 부족하다고 하면 짜증난다
      if (p.shoesOwned < cost) return fail(S.renameNeedShoes(cost));

      renaming = true;
      msg.classList.remove('bad');
      msg.textContent = S.loading;
      try {
        if (await isNicknameTaken(v)) return fail(S.nicknameTaken);
      } catch {
        // 중복 확인 실패가 변경을 막지는 않는다 (NicknameSetup 과 같은 방침)
      } finally {
        renaming = false;
      }
      // 차감이 실패하면 이름도 바꾸지 않는다 — 둘은 같이 일어나야 한다
      if (!L.consumeShoes(cost)) return fail(S.renameNeedShoes(cost));
      saveNickname(v);
      setNickname(v);
      draftNick = '';
      draftMsg = '';
      Sfx.play('sfx_purchase');
      toast(S.renameDone);
      nav.refresh();
    }

    /**
     * `isComposing` 검사가 없으면 **한글 조합 중 Enter** 가 제출로 새어 들어간다.
     * 크롬은 조합 중 `key` 가 `'Process'` 로 와서 무반응, 사파리 계열은 조합 확정 전
     * 값으로 제출돼 "형식이 올바르지 않다"가 뜬다. 둘 다 사용자 잘못이 아니다.
     */
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
      submit();
    });

    return el('div.rename-box', null, [
      el('div.rename-title', S.menuRename),
      el('div.nick-wrap', null, [input]),
      msg,
      button(S.confirm, submit),
      el('div.hint', S.renameCost(cost)),
    ]);
  }

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

        renameSection(p),

        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
