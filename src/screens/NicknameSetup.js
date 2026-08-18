/**
 * S02 닉네임 입력 — 최초 1회.
 * 한글 2~4자. 중복은 Firebase가 있을 때만 검사한다. (기획서 §8)
 */

import S from '../config/strings.ko.js';
import { el, button, screen, title } from './ui.js';
import { validateNickname, isNicknameTaken, saveNickname } from '../services/profile.js';
import { setNickname } from '../services/auth.js';
import { NICKNAME } from '../config/balance.js';
import Portal from './Portal.js';

export default function NicknameSetup(nav) {
  let busy = false;

  return {
    render() {
      const input = el('input.nick-input', {
        type: 'text',
        maxlength: NICKNAME.maxLength,
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
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
        setNickname(v);
        nav.replace(Portal);
      }

      /**
       * ★ **한글 조합 중 Enter 는 제출이 아니다.** (2026-08-16)
       *
       * 조합 중 Enter 는 "글자를 확정"하는 키다. 그런데 검사가 없으면 크롬에서는
       * `key` 가 `'Process'` 로 와서 **아무 반응이 없고**, 사파리 계열에서는 조합
       * 확정 전 값(자모 하나)으로 제출돼 **"형식이 올바르지 않습니다"** 가 뜬다.
       * 신규 가입 필수 화면에서 이러면 사용자는 갇힌 것과 같다.
       */
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
        submit();
      });
      // 화면이 그려진 뒤 포커스 (모바일 키보드 자동 노출)
      setTimeout(() => input.focus(), 50);

      /**
       * ★ **확인 버튼을 입력칸 바로 아래에 둔다.** (2026-08-16)
       *
       * 예전에는 `spacer`(flex:1) 뒤에 있어 화면 **맨 아래에 고정**됐다. `body` 가
       * `position:fixed; height:100dvh` 라 iOS 에서 키보드가 올라와도 레이아웃이 줄지 않아
       * **버튼이 키보드 뒤에 가려지고 스크롤로 끌어올릴 수도 없었다.** 남은 제출 수단이
       * 키보드 개행뿐인데 그마저 위의 조합 문제로 어긋났다 — 가입이 여기서 멈춘다.
       */
      return screen(
        title(S.nicknamePrompt),
        el('div.nick-wrap', null, [input]),
        msg,
        ok,
        el('div.spacer')
      );
    },
  };
}
