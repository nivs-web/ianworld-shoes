/**
 * S23-c 닉네임 변경 — 설정 안의 독립 메뉴.
 *
 * ★ **드래곤변경 화면에서 여기로 옮겨 왔다.** (2026-08-26, 사용자 지정)
 * 드래곤변경은 드래곤을 파는 가게다 — 열 마리를 구경하러 들어간 사람에게
 * 이름 바꾸는 입력칸까지 들이밀 이유가 없다. 값이 비싼 것으로 충분하다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title, toast } from './ui.js';
import {
  get as getProfile, spendDragonCoins,
  validateNickname, isNicknameTaken, saveNickname,
} from '../services/profile.js';
import { setNickname } from '../services/auth.js';
import { NICKNAME } from '../config/balance.js';

/**
 * ★ **닉네임 변경은 금화 10,000 이다.** (2026-08-26, 사용자 지정)
 *
 * 신발게임에서는 신발로 받는데, 여기 지갑은 금화라 값도 금화로 매긴다.
 * 일부러 비싸게 뒀다 — 20스테이지 완주 두세 판 값이다. 이름은 순위표에 걸리는
 * 얼굴이라, 싸게 두면 기록이 나빠질 때마다 이름을 갈아 치우며 도망칠 수 있다.
 */
export const RENAME_COST = 10000;

export default function DragonNickname(nav) {
  /** 입력 중인 값과 안내 문구 — 다시 그려도 살아남아야 한다 */
  let draftNick = '';
  let draftMsg = '';
  let renaming = false;

  return {
    render() {
      const p = getProfile();
      const input = el('input.nick-input', {
        type: 'text',
        maxlength: NICKNAME.maxLength,
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
      });
      input.value = draftNick;
      input.addEventListener('input', () => { draftNick = input.value; });

      const msg = el('div.hint', draftMsg || S.renamePrompt);
      if (draftMsg) msg.classList.add('bad');
      const fail = (t) => { draftMsg = t; msg.textContent = t; msg.classList.add('bad'); };

      async function submit() {
        if (renaming) return;
        const v = input.value.trim();
        if (!validateNickname(v)) return fail(S.nicknameInvalid);
        if (v === p.nickname) return fail(S.dragonRenameSame);
        /* 금화부터 본다 — 중복 검사로 몇 초 기다린 뒤에 모자란다고 하면 짜증난다 */
        const have = p.dragonCoins || 0;
        if (have < RENAME_COST) return fail(S.dragonRenameNeed(RENAME_COST - have));

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
        /* 차감이 실패하면 이름도 바꾸지 않는다 — 둘은 같이 일어나야 한다 */
        if (!spendDragonCoins(RENAME_COST).ok) return fail(S.dragonRenameNeed(RENAME_COST - have));
        saveNickname(v);
        setNickname(v);
        draftNick = '';
        draftMsg = '';
        toast(S.dragonRenameDone, 2000);
        nav.refresh();
      }

      /* `isComposing` 검사가 없으면 한글 조합 중 Enter 가 제출로 새어 들어간다 */
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
        submit();
      });

      return screen(
        title(S.dragonRename),
        el('div.dg-wallet', S.dragonWallet((p.dragonCoins || 0).toLocaleString('en-US'))),

        el('div.rename-box', null, [
          el('div.hint', S.dragonRenameNow(p.nickname || '???')),
          el('div.nick-wrap', null, [input]),
          msg,
          button(S.confirm, submit, { primary: true }),
          el('div.hint', S.dragonRenameCost(RENAME_COST)),
        ]),

        el('div.spacer'),
        backButton(S.backToSettings, () => nav.back())
      );
    },
  };
}
