/**
 * S21 드래곤변경 — 한 마리씩 넘겨 보고 고르거나 산다.
 *
 * ★ **신발을 찾아서의 캐릭터 변경과 같은 모양이다.** (2026-08-26, 사용자 지정)
 *
 * 앞서 만든 카드 격자는 열 마리가 한꺼번에 깔려서 한 마리도 제대로 안 보였다 —
 * 그림이 76px 로 쪼그라들어 뿔 차이도 안 보였고, 사는 화면인지 고르는 화면인지도 흐렸다.
 *
 *   ◀ [ 큰 드래곤 하나 ] ▶
 *          이름 / n번째
 *      [이 드래곤으로] 또는 [사기]
 *
 * 한 마리만 크게 보여 주면 뿔·색·무장이 다 보이고, 버튼이 하나라 뭘 눌러야 하는지 분명하다.
 * 오락실 안에서 두 게임이 같은 방식으로 캐릭터를 고르니 손이 헤매지 않는다.
 *
 * ★ **보고 있는 드래곤은 살아 움직인다** — 날갯짓·턱·불.
 * 도는 것은 언제나 하나뿐이라 드래곤을 서른 마리로 늘려도 부담이 그대로다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title, confirmDialog, toast } from './ui.js';
import * as Sfx from '../audio/sfx.js';
import { get as getProfile, setDragonCharacter, hasDragon, buyDragon } from '../services/profile.js';
import { loadDragon } from './DragonGame.js';

export default function DragonShop(nav) {
  let mod = null;
  let live = true;
  /** 지금 보고 있는 드래곤 — 처음에는 지금 쓰는 놈이 뜬다 */
  let index = getProfile().dragonCharacter | 0;

  /**
   * 돌고 있는 애니메이션 하나. 다시 그리거나 나갈 때 반드시 멈춘다 —
   * 안 멈추면 rAF 가 유령처럼 계속 돌면서 배터리를 먹는다.
   */
  let anim = null;
  const stopAnim = () => { if (anim) { anim.stop(); anim = null; } };

  /* 도트가 게임 모듈에만 있다 — 도착하면 화면을 한 번 다시 그린다 */
  loadDragon().then((m) => { mod = m; if (live) nav.refresh(); }).catch(() => {});

  return {
    onLeave() { live = false; stopAnim(); },

    render() {
      stopAnim();                       // 다시 그리면 옛 캔버스는 버려진다
      const p = getProfile();
      const list = mod ? mod.dragonList() : [];
      if (!list.length) return screen(title(S.dragonShopTitle), el('div.hint', S.loading));

      index = ((index % list.length) + list.length) % list.length;
      const d = list[index];
      const owned = hasDragon(d.idx);
      const using = owned && (p.dragonCharacter | 0) === d.idx;
      const coins = p.dragonCoins || 0;
      const affordable = coins >= d.price;

      const move = (step) => {
        index = (index + step + list.length) % list.length;
        Sfx.play('sfx_menu_move');
        nav.refresh();
      };

      const pick = () => {
        setDragonCharacter(d.idx);
        Sfx.play('sfx_menu_select');
        nav.refresh();
      };

      async function buy() {
        if (!affordable) {
          Sfx.play('sfx_denied');
          toast(S.dragonNeedCoins(d.price - coins), 2600);
          return;
        }
        const ok = await confirmDialog({
          message: S.dragonBuyConfirm(d.ko),
          detail: S.dragonBuy(d.price),
          yes: S.yes,
          no: S.no,
        });
        if (!ok) return;
        const r = buyDragon(d.idx, d.price);
        if (!r.ok) { toast(S.dragonNeedCoins(r.short), 2600); return; }
        Sfx.play('sfx_purchase');
        setDragonCharacter(d.idx);
        toast(S.dragonBought(d.ko), 2200);
        nav.refresh();
      }

      /**
       * 산 드래곤은 살아 움직이고, 안 산 것은 **회색 실루엣**이다.
       * 생김새를 숨겨야 궁금해진다 (신발게임 캐릭터 선택과 같은 방침).
       */
      const figure = () => {
        if (!mod) return null;
        /* 폭을 움직이는 그림과 **맞춘다** — 안 그러면 산 놈과 안 산 놈을 오갈 때
           그림이 219px <-> 144px 로 튀어서 화살표 위치까지 흔들린다 */
        if (!owned) return mod.dragonPortrait(d.idx, 4, true, null);
        anim = mod.dragonAnim(d.idx, 4);
        return anim.cv;
      };

      return screen(
        title(S.dragonShopTitle),
        el('div.dg-wallet', S.dragonWallet(coins.toLocaleString('en-US'))),

        el('div.char-stage', null, [
          el('button.arrow', { text: '◀', type: 'button', onclick: () => move(-1) }),
          el('div.dg-stagepic', { class: owned ? '' : 'locked' }, [figure()].filter(Boolean)),
          el('button.arrow', { text: '▶', type: 'button', onclick: () => move(1) }),
        ]),

        el('div.char-name', owned ? d.ko : S.dragonLocked),
        el('div.dg-theme', owned ? d.theme : ''),
        el('div.dg-trait', owned ? d.trait : ''),
        el('div.char-count', `${index + 1} / ${list.length}`),

        using
          ? el('div.dg-using', S.dragonInUse)
          : owned
            ? button(S.dragonSelect, pick, { primary: true })
            : el('div.buy-wrap', null, [
                el('div.hint', S.dragonBuy(d.price)),
                button(S.dragonBuyBtn, buy, { primary: affordable }),
              ]),

        el('div.spacer'),
        backButton(S.backToGameLobby, () => nav.back())
      );
    },
  };
}
