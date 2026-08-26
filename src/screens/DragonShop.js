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
import { get as getProfile, setDragonCharacter, hasDragon, buyDragon } from '../services/profile.js';
import { loadDragon } from './DragonGame.js';

export default function DragonShop(nav) {
  let mod = null;
  let live = true;

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
   * 지금 돌고 있는 애니메이션 하나. 화면을 다시 그리거나 나갈 때 반드시 멈춘다 —
   * 안 멈추면 rAF 가 유령처럼 계속 돌면서 배터리를 먹는다.
   */
  let anim = null;
  const stopAnim = () => { if (anim) { anim.stop(); anim = null; } };

  return {
    onLeave() { live = false; stopAnim(); },

    render() {
      stopAnim();                      // 다시 그리면 옛 캔버스는 버려진다
      const p = getProfile();
      const cur = p.dragonCharacter | 0;

      /* 고른 놈은 움직이는 캔버스, 나머지는 가만히 있는 그림 */
      const pic = (i, live_) => {
        if (!mod) return null;
        /* 가만히 있는 그림도 불 자리만큼 넣어 폭을 맞췄다 —
           안 그러면 고른 놀만 칸에 맞춰 줌어들어 혼자 작게 보인다 */
        if (!live_ || !mod.dragonAnim) return mod.dragonPortrait(i, 2, true);
        anim = mod.dragonAnim(i, 2);
        return anim.cv;
      };
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
            /**
             * ★ **고른 드래곤만 살아 움직인다.** (2026-08-26, 사용자 지정)
             * 날개를 퍼덕이고 턱을 벌려 불을 뿜는다 — 한눈에 뭘 골랐는지 알 수 있고,
             * 열 마리가 다 움직이는 것보다 고른 놈이 도드라진다.
             */
            el('div.dg-card-pic', { class: using ? 'live' : '' }, [pic(d.idx, using)].filter(Boolean)),
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

        el('div.spacer'),
        backButton(S.backToGameLobby, () => nav.back())
      );
    },
  };
}
