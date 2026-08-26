/**
 * S22 아이템 쇼핑 — 자리 여섯, 각 다섯 개.
 *
 * ★ **드래곤은 여기에 없다.** (2026-08-26, 사용자 지정)
 * 드래곤은 아이템이 아니라 내가 조종하는 몸이라 [드래곤 변경] 에서 산다.
 * 여기서 파는 것은 그 몸에 걸치는 것과 손에 쥐고 시작하는 것뿐이다.
 *
 * 자리는 두 종류다:
 *   · **끼는 자리** (마스크·불꽃·머리무장·다리무장)
 *     사면 곧바로 낀다. 이미 산 것은 눌러서 끼고, 낀 것을 다시 누르면 벗는다 —
 *     벗는 데는 돈이 안 든다.
 *   · **계단 자리** (초기 미사일·초기 핵무기)
 *     끼고 벗을 것이 없다. 앞 칸을 사야 다음 칸이 열리고, 값은 칸마다 세 배씩 뛴다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, confirmDialog, toast } from './ui.js';
import {
  get as getProfile, hasDragonItem, buyDragonItem, equipDragonItem, dragonEquipment,
} from '../services/profile.js';
import { BY_SLOT, ladderState } from '../games/dragon/items.js';

const won = (n) => Number(n || 0).toLocaleString('en-US');

export default function DragonItems(nav) {
  /** 사기 — 계단이든 끼는 자리든 값을 치르는 방식은 같다 */
  async function buy(it) {
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

  async function onPickWearable(it) {
    if (!hasDragonItem(it.id)) return buy(it);
    const wasOn = dragonEquipment()[it.slot] === it.id;
    equipDragonItem(it.slot, it.id);
    toast(wasOn ? S.dragonItemUnequip : `${it.ko} ${S.dragonItemEquipped}`, 1300);
    nav.refresh();
  }

  /** 카드 한 장. `state` 는 계단 자리에서만 온다 */
  function card(it, { on = false, owned = false, locked = false, coins = 0, tag }) {
    return el('button.it-card', {
      class: [on ? 'on' : '', owned ? 'owned' : (locked ? 'locked step-locked' : 'locked')]
        .filter(Boolean).join(' '),
      type: 'button',
      disabled: locked,
      onclick: () => { if (!locked) (it.qty ? buy(it) : onPickWearable(it)); },
    }, [
      /* 아이콘은 그 아이템의 색 하나로 그린다 — 도트를 서른 벌 그리는 대신
         색만으로도 어느 등급인지 한눈에 갈린다 */
      el('span.it-chip', { style: `--it: ${it.tint}` }),
      el('div.it-body', null, [
        el('div.it-name', it.ko),
        el('div.it-desc', it.desc),
      ]),
      el('div.it-foot', null, [tag ?? el('span.it-tag.price', {
        class: coins >= it.price ? 'ok' : 'no',
      }, S.dragonItemBuy(it.price))]),
    ]);
  }

  return {
    render() {
      const p = getProfile();
      const coins = p.dragonCoins || 0;
      const eq = dragonEquipment();

      const slotEl = (slot) => {
        let cards;
        if (slot.ladder) {
          /* 계단 — 산 칸, 지금 살 수 있는 칸, 아직 잠긴 칸 */
          cards = ladderState(p, slot.key).map(({ item, owned, buyable, locked }) => card(item, {
            owned, locked, coins, on: owned,
            tag: owned ? el('span.it-tag.on', S.dragonItemOwned)
              : locked ? el('span.it-tag.step', S.dragonItemStepLocked)
              : undefined,
          }));
        } else {
          cards = slot.items.map((it) => {
            const owned = hasDragonItem(it.id);
            const on = owned && eq[it.slot] === it.id;
            return card(it, {
              on, owned, coins,
              tag: on ? el('span.it-tag.on', S.dragonItemEquipped)
                : owned ? el('span.it-tag.owned', S.dragonItemEquip)
                : undefined,
            });
          });
        }
        return el('section.it-slot', null, [
          el('div.it-slot-head', null, [
            el('span.it-slot-name', slot.ko),
            el('span.it-slot-note', slot.note),
          ]),
          el('div.it-grid', null, cards),
        ]);
      };

      return screen(
        el('div.dragon-title', S.dragonItemTitle),
        el('div.dg-wallet', S.dragonWallet(won(coins))),

        ...BY_SLOT.map(slotEl),

        el('div.hint', S.dragonItemHint),
        el('div.spacer'),
        backButton(S.backToGameLobby, () => nav.back())
      );
    },
  };
}
