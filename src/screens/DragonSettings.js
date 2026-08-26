/**
 * S23 드래곤 스트라이커 설정.
 *
 * ★ **닉네임 변경은 설정으로 옮겼다.** (2026-08-26, 사용자 지정)
 *
 * 처음엔 [드래곤 변경] 화면 아래에 뒀는데, 거기는 드래곤을 파는 가게다 —
 * 드래곤 열 마리를 구경하러 들어간 사람에게 이름 바꾸는 입력칸까지 들이밀 이유가 없다.
 * 이름을 바꿀 사람은 설정에 들어와서 바꾸면 된다. 값이 비싼 것으로 충분하다.
 *
 * 조작·소리 설정은 여전히 게임 안 캔버스 화면이다 — 스틱과 버튼 미리보기가
 * 도트로만 있어서 아직 DOM 으로 못 옮겼다. 여기서는 그리로 보내는 문만 연다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, toast } from './ui.js';
import {
  get as getProfile, spendDragonCoins,
  validateNickname, isNicknameTaken, saveNickname,
} from '../services/profile.js';
import { setNickname } from '../services/auth.js';
import { NICKNAME } from '../config/balance.js';
import DragonGame from './DragonGame.js';

/**
 * ★ **닉네임 변경은 금화 10,000 이다.** (2026-08-26, 사용자 지정)
 *
 * 신발게임에서는 신발로 받는데, 여기 지갑은 금화라 값도 금화로 매긴다.
 * 일부러 비싸게 뒀다 — 20스테이지 완주 두세 판 값이다. 이름은 순위표에 걸리는
 * 얼굴이라, 싸게 두면 기록이 나빠질 때마다 이름을 갈아 치우며 도망칠 수 있다.
 */
export const RENAME_COST = 10000;

export default function DragonSettings(nav) {
  /** 입력 중인 닉네임과 안내 문구 — 다시 그려도 살아남아야 한다 */
  let draftNick = '';
  let draftMsg = '';
  let renaming = false;

  function renameSection(p) {
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

    return el('div.rename-box', null, [
      el('div.rename-title', S.dragonRename),
      el('div.hint', S.dragonRenameNow(p.nickname || '???')),
      el('div.nick-wrap', null, [input]),
      msg,
      button(S.confirm, submit),
      el('div.hint', S.dragonRenameCost(RENAME_COST)),
    ]);
  }

  return {
    render() {
      const p = getProfile();
      return screen(
        el('div.dragon-title', S.dragonMenuSettings),
        el('div.dg-wallet', S.dragonWallet((p.dragonCoins || 0).toLocaleString('en-US'))),

        button(S.dragonMenuControls, () => nav.push(DragonGame, { mode: 'options' })),

        renameSection(p),

        el('div.spacer'),
        backButton(S.backToGameLobby, () => nav.back())
      );
    },
  };
}
