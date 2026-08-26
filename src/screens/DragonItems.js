/**
 * S22 아이템 쇼핑 — 네 자리에 다섯 개씩, 스무 개.
 *
 * ★ **드래곤은 여기에 없다.** (2026-08-26, 사용자 지정)
 * 드래곤은 아이템이 아니라 내가 조종하는 몸이라 [드래곤 변경] 에서 산다.
 * 여기서 파는 것은 그 몸에 걸치는 것들뿐이다.
 *
 * ★ **사면 곧바로 낀다.** 사놓고 또 눌러야 착용되는 상점은 한 번 더 헷갈린다.
 * 이미 산 것은 눌러서 끼고, 낀 것을 다시 누르면 벗는다 — 벗는 데는 돈이 안 든다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, confirmDialog, toast } from './ui.js';
import {
  get as getProfile, hasDragonItem, buyDragonItem, equipDragonItem, dragonEquipment,
} from '../services/profile.js';
import { BY_SLOT } from '../games/dragon/items.js';

const won = (n) => Number(n || 0).toLocaleString('en-US');

export default function DragonItems(nav) {
  async function onPick(it) {
    const eq = dragonEquipment();

    /* 이미 산 것 — 끼거나 벗는다 */
    if (hasDragonItem(it.id)) {
      const wasOn = eq[it.slot] === it.id;
      equipDragonItem(it.slot, it.id);
      toast(wasOn ? S.dragonItemUnequip : `${it.ko} ${S.dragonItemEquipped}`, 1300);
      nav.refresh();
      return;
    }

    /* 사는 것은 되돌릴 수 없다 — 한 번 되묻는다 */
    const ok = await confirmDialog({
      message: S.dragonItemConfirm(it.ko, it.price),
      detail: it.desc,
      yes: S.yes,
      no: S.no,
    });
    if (!ok) return;

    const r = buyDragonItem(it.id, it.slot, it.price);
    if (!r.ok) { toast(S.dragonNeedCoins(r.short), 2600); return; }
    toast(S.dragonItemBought(it.ko), 2200);
    nav.refresh();
  }

  function card(it, eq, coins) {
    const owned = hasDragonItem(it.id);
    const on = owned && eq[it.slot] === it.id;
    const canAfford = coins >= it.price;

    return el('button.it-card', {
      class: [on ? 'on' : '', owned ? 'owned' : 'locked'].filter(Boolean).join(' '),
      type: 'button',
      onclick: () => onPick(it),
    }, [
      /* 아이콘은 그 아이템의 색 하나로 그린다 — 도트를 스무 벌 그리는 대신
         색만으로도 어느 등급인지 한눈에 갈린다 */
      el('span.it-chip', { style: `--it: ${it.tint}` }),
      el('div.it-body', null, [
        el('div.it-name', it.ko),
        el('div.it-desc', it.desc),
      ]),
      el('div.it-foot', null, [
        on ? el('span.it-tag.on', S.dragonItemEquipped)
        : owned ? el('span.it-tag.owned', S.dragonItemEquip)
        : el('span.it-tag.price', { class: canAfford ? 'ok' : 'no' }, S.dragonItemBuy(it.price)),
      ]),
    ]);
  }

  return {
    render() {
      const p = getProfile();
      const coins = p.dragonCoins || 0;
      const eq = dragonEquipment();

      return screen(
        el('div.dragon-title', S.dragonItemTitle),
        el('div.dg-wallet', S.dragonWallet(won(coins))),

        ...BY_SLOT.map((slot) => el('section.it-slot', null, [
          el('div.it-slot-head', null, [
            el('span.it-slot-name', slot.ko),
            el('span.it-slot-note', slot.note),
          ]),
          el('div.it-grid', null, slot.items.map((it) => card(it, eq, coins))),
        ])),

        el('div.hint', S.dragonItemHint),
        el('div.spacer'),
        backButton(S.backToGameLobby, () => nav.back())
      );
    },
  };
}
