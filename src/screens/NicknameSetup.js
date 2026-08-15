/**
 * S02 닉네임 입력 — 최초 1회.
 * 한글 2~4자. 중복은 Firebase가 있을 때만 검사한다. (기획서 §8)
 */

import S from '../config/strings.ko.js';
import { el, button, screen, title } from './ui.js';
import { validateNickname, isNicknameTaken, saveNickname } from '../services/profile.js';
import { continueAsGuest, currentUser, setNickname } from '../services/auth.js';
import Portal from './Portal.js';

export default function NicknameSetup(nav) {
  let busy = false;

  return {
    render() {
      const input = el('input.nick-input', {
        type: 'text',
        maxlength: 4,
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
        placeholder: '○○○',
      });
      const msg = el('div.hint', S.nicknameRule);
      const ok = button(S.confirm, submit, { primary: true });

      async function submit() {
        if (busy) return;
        const v = input.value.trim();

        if (!validateNickname(v)) {
          msg.textContent = S.nicknameInvalid;
          msg.classList.add('bad');
          return;
        }

        busy = true;
        ok.disabled = true;
        msg.classList.remove('bad');
        msg.textContent = S.loading;

        try {
          if (await isNicknameTaken(v)) {
            msg.textContent = S.nicknameTaken;
            msg.classList.add('bad');
            return;
          }
        } catch {
          // 중복 확인 실패는 진행을 막지 않는다 — 네트워크 문제로 가입이 멈추면 안 된다
        } finally {
          busy = false;
          ok.disabled = false;
        }

        saveNickname(v);
        if (currentUser()) setNickname(v);
        else continueAsGuest(v);
        nav.replace(Portal);
      }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
      });
      // 화면이 그려진 뒤 포커스 (모바일 키보드 자동 노출)
      setTimeout(() => input.focus(), 50);

      return screen(
        title(S.nicknamePrompt),
        el('div.nick-wrap', null, [input]),
        msg,
        el('div.spacer'),
        ok
      );
    },
  };
}
