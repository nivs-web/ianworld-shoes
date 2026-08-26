/**
 * S21 드래곤 변경 — 열 마리를 늘어놓고 고르거나 산다.
 *
 * ★ **캔버스가 아니라 DOM 화면이다.** (2026-08-26, 사용자 지정)
 *
 * 예전에는 게임 안 캔버스 화면이라 **가로로 돌려야만** 드래곤을 바꿀 수 있었다.
 * 드래곤을 고르는 데 가로 모드가 필요할 이유가 없다 — 아이템을 사는 것과 같은 일이다.
 * 세로로 들고 스크롤하며 구경하는 편이 훨씬 자연스럽다.
 *
 * 그림만 게임 모듈에서 빌려 온다(도트가 거기에만 있다).
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, confirmDialog, toast } from './ui.js';
import {
  get as getProfile, setDragonCharacter, hasDragon, buyDragon,
  spendDragonCoins, validateNickname, isNicknameTaken, saveNickname,
} from '../services/profile.js';
import { setNickname } from '../services/auth.js';
import { NICKNAME } from '../config/balance.js';
import { loadDragon } from './DragonGame.js';

/**
 * ★ **닉네임 변경은 금화 10,000 이다.** (2026-08-26, 사용자 지정)
 *
 * 신발게임에서는 신발로 받는데, 여기 지갑은 금화라 값도 금화로 매긴다.
 * 일부러 비싸게 뒀다 — 20스테이지 완주 두세 판 값이다. 이름은 순위표에 걸리는
 * 얼굴이라, 싸게 두면 기록이 나빠질 때마다 이름을 갈아 치우며 도망칠 수 있다.
 */
const RENAME_COST = 10000;

export default function DragonShop(nav) {
  let mod = null;
  let live = true;
  /** 입력 중인 닉네임과 안내 문구 — 카드를 눌러 다시 그려도 살아남아야 한다 */
  let draftNick = '';
  let draftMsg = '';
  let renaming = false;

  /* 도트가 게임 모듈에만 있다 — 도착하면 화면을 한 번 다시 그린다 */
  loadDragon().then((m) => { mod = m; if (live) nav.refresh(); }).catch(() => {});

  async function onPick(d) {
    const p = getProfile();
    if (hasDragon(d.idx)) {
      if ((p.dragonCharacter | 0) === d.idx) return;    // 이미 쓰는 중
      setDragonCharacter(d.idx);
      toast(`${d.ko}`, 1400);
      nav.refresh();
      return;
    }
    /* 사는 것은 되돌릴 수 없다 — 한 번 되묻는다 */
    const ok = await confirmDialog({
      message: `${d.ko} 을(를) 사시겠습니까?`,
      detail: S.dragonBuy(d.price),
      yes: S.yes,
      no: S.no,
    });
    if (!ok) return;
    const r = buyDragon(d.idx, d.price);
    if (!r.ok) { toast(S.dragonNeedCoins(r.short), 2600); return; }
    setDragonCharacter(d.idx);
    toast(S.dragonBought(d.ko), 2200);
    nav.refresh();
  }

  /**
   * 닉네임 변경 — 드래곤을 고르는 화면 아래에 둔다.
   *
   * 신발게임의 캐릭터 화면과 같은 자리, 같은 모양이다. 두 게임에서 이름을 바꾸는
   * 곳이 서로 다르게 생겼으면 같은 계정인 줄 모른다.
   */
  function renameSection(p) {
    const input = el('input.nick-input', {
      type: 'text',
      maxlength: NICKNAME.maxLength,
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
    });
    /* 입력값을 DOM 밖에 들고 있는다 — 드래곤 카드를 한 번 누르면 화면이
       통째로 다시 그려지는데, 그때 치던 이름이 사라지면 안 된다 */
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
      el('div.nick-wrap', null, [input]),
      msg,
      button(S.confirm, submit),
      el('div.hint', S.dragonRenameCost(RENAME_COST)),
    ]);
  }

  return {
    onLeave() { live = false; },

    render() {
      const p = getProfile();
      const cur = p.dragonCharacter | 0;
      const list = mod ? mod.dragonList() : [];

      return screen(
        el('div.dragon-title', S.dragonShopTitle),
        el('div.dg-wallet', S.dragonWallet((p.dragonCoins || 0).toLocaleString('en-US'))),

        el('div.dg-grid', null, list.map((d) => {
          const owned = hasDragon(d.idx);
          const using = owned && d.idx === cur;
          const canAfford = (p.dragonCoins || 0) >= d.price;

          const card = el('button.dg-card', {
            class: [using ? 'using' : '', owned ? 'owned' : 'locked'].filter(Boolean).join(' '),
            type: 'button',
            onclick: () => onPick(d),
          }, [
            el('div.dg-card-pic', null, [mod ? mod.dragonPortrait(d.idx, 2) : null].filter(Boolean)),
            el('div.dg-card-name', d.ko),
            el('div.dg-card-sub', d.theme),
            el('div.dg-card-trait', d.trait),
            el('div.dg-card-foot', null, [
              using ? el('span.dg-tag.using', S.dragonInUse)
              : owned ? el('span.dg-tag.owned', S.dragonSelect)
              : el('span.dg-tag.price', { class: canAfford ? 'ok' : 'no' }, `${d.price.toLocaleString('en-US')} 금화`),
            ]),
          ]);
          return card;
        })),

        renameSection(p),

        el('div.spacer'),
        backButton(S.backToGameLobby, () => nav.back())
      );
    },
  };
}
