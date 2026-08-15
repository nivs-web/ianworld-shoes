/**
 * 닉네임 변경 — 최초 설정(NicknameSetup)과 달리 **유료**다.
 *
 * 최초 1회는 계정을 만들려면 반드시 거쳐야 하는 단계라 공짜지만, 변경은 선택이다.
 * 값을 매겨 두지 않으면 랭킹에서 이름만 바꿔 가며 도망칠 수 있다.
 * 비용은 balance.NICKNAME.changeCost (신발 켤레).
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title, toast } from './ui.js';
import { NICKNAME } from '../config/balance.js';
import {
  get as getProfile, validateNickname, isNicknameTaken, saveNickname,
} from '../services/profile.js';
import { setNickname } from '../services/auth.js';
import * as L from '../services/storageLocal.js';

export default function NicknameChange(nav) {
  let busy = false;

  return {
    render() {
      const p = getProfile();
      const cost = NICKNAME.changeCost;

      const input = el('input.nick-input', {
        type: 'text',
        maxlength: NICKNAME.maxLength,
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
      });
      const msg = el('div.hint', S.nicknameRule);
      const ok = button(S.confirm, submit, { primary: true });

      const fail = (t) => {
        msg.textContent = t;
        msg.classList.add('bad');
      };

      async function submit() {
        if (busy) return;
        const v = input.value.trim();

        if (!validateNickname(v)) return fail(S.nicknameInvalid);
        if (v === p.nickname) return fail(S.renameSame);
        // 신발 확인을 **먼저** 한다 — 중복 검사로 몇 초 기다린 뒤에 부족하다고 하면 짜증난다
        if (p.shoesOwned < cost) return fail(S.renameNeedShoes(cost));

        busy = true;
        ok.disabled = true;
        msg.classList.remove('bad');
        msg.textContent = S.loading;

        try {
          if (await isNicknameTaken(v)) return fail(S.nicknameTaken);
        } catch {
          // 중복 확인 실패가 변경을 막지는 않는다 (NicknameSetup 과 같은 방침)
        } finally {
          busy = false;
          ok.disabled = false;
        }

        // 차감이 실패하면 이름도 바꾸지 않는다 — 둘은 같이 일어나야 한다
        if (!L.consumeShoes(cost)) return fail(S.renameNeedShoes(cost));
        saveNickname(v);
        setNickname(v);
        toast(S.renameDone);
        nav.back();
      }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
      });
      setTimeout(() => input.focus(), 50);

      return screen(
        title(S.renameTitle),
        el('div.rename-current', `${S.playerName} : ${p.nickname}`),
        el('div.diff-title', S.renamePrompt),
        el('div.nick-wrap', null, [input]),
        msg,
        el('div.hint', S.renameCost(cost)),
        el('div.hint', S.myShoesOwned(p.shoesOwned)),
        el('div.spacer'),
        ok,
        backButton(S.back, () => nav.back())
      );
    },
  };
}
