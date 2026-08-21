/**
 * S23 아이템 쇼핑 — 악세사리 · 날개 · 반려견. (2026-08-21 26차, 사용자 지정)
 *
 * *"신발이 3000~5000켤레 있는 사람들은 신발이 남아 돌아서, 재미가 없으니, 신발을
 *   소진할 수 있는 아이템 구매 쇼핑 항목을 추가하고 싶어"*
 *
 * ## 이 화면이 하는 일은 셋뿐이다
 *
 *   ① 카테고리 셋 중 하나를 고른다
 *   ② 목록에서 하나를 고른다 — **안 산 것도 고를 수 있다**(사기 전에 어떻게 생겼는지
 *      봐야 살지 말지 정한다). 값은 아래 미리보기가 보여 준다.
 *   ③ 산 것이면 [착용하기]/[착용해제], 아직이면 [구매하기]
 *
 * ## 아래 두 컷은 **하는 일이 다르다** (2026-08-21 사용자 지정)
 *
 *   · 미리보기 — 목록에서 **고른 것을 입어 본** 모습. 누를 때마다 바뀐다.
 *   · 현재 모습 — 실제로 **착용해 둔** 모습. `착용하기` 를 눌러야 바뀌고,
 *                 **게임에 그대로 들어가는 그림**이다.
 *
 * 둘 다 정면이다. 옆모습을 하나 두는 것보다 "지금"과 "만약"을 나란히 놓는 쪽이
 * 살지 말지 정하는 데 쓸모가 있다.
 *
 * ## 왜 착용 미리보기가 이 화면 안에 있나
 *
 * *"아이템 구매 아래쪽에 '아이템 착용 모습' 이라는 타이틀이 있고, 구매한 아이템을
 *   선택하면, 아래 캐릭터가 착용한 모습이 있으면 좋겠어"* — 값이 1,000~10,000켤레라
 * **사고 나서 처음 보는 일이 있으면 안 된다.** 그래서 목록에서 고르는 즉시 아래에
 * 그려 준다. 옆모습의 반대편은 캐릭터와 같이 **거울 반사**라 컷 두 개면 충분하다(§5).
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title, toast, confirmDialog, segmented } from './ui.js';
import * as Sfx from '../audio/sfx.js';
import { ITEM_CATS, itemsOf, itemById, itemSprite, itemOffset, WEAR } from '../data/items.js';
import { characterSprite } from '../data/characters.js';
import { get as getProfile, buyItem, equipItem, unequipAll } from '../services/profile.js';

/**
 * 착용 모습 한 컷.
 *
 * ★ **날개는 캐릭터보다 먼저 붙인다**(`behind`). 캔버스와 달리 DOM 은 나중에 붙인 것이
 * 위에 오므로, 순서가 곧 앞뒤다 — 이 한 줄이 없으면 날개가 얼굴을 덮는다.
 * (인게임 고스트를 `player.render()` 앞으로 옮긴 것과 같은 이유, §9-0-33)
 */
function wearCut(charId, items, label) {
  /**
   * ★ 확대는 **안쪽 상자 하나가** 맡는다. 그림마다 `transform: scale(2)` 를 걸면
   * 크기만 두 배가 되고 **자리(`left`/`top`)는 그대로**라 전부 어긋난다(실제로 그렇게
   * 짰다가 모자가 어깨에 붙었다). 안쪽 상자를 통째로 키우면 좌표는 논리값 그대로 둘
   * 수 있고, 배율이 화면 코드 여기저기로 흩어지지 않는다.
   */
  const inner = el('div.wear-inner', {
    style: { width: `${WEAR.w}px`, height: `${WEAR.h}px` },
  });
  const put = (src, x, y, w, h) => {
    inner.append(el('img.wear-part', {
      src,
      alt: '',
      style: { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` },
    }));
  };
  const list = (items ?? []).filter(Boolean);
  const draw = (it) => {
    const off = itemOffset(it, 'front');
    put(itemSprite(it.id, 'front'), off.x, off.y, it.w, it.h);
  };
  for (const it of list) if (it.behind) draw(it);
  put(characterSprite(charId, 'front'), WEAR.charX, WEAR.charY, 35, 50);
  for (const it of list) if (!it.behind) draw(it);
  return el('figure.wear-cut', null, [
    el('div.wear-stage', null, [inner]),
    el('figcaption', label),
  ]);
}

export default function ItemShop(nav) {
  let cat = ITEM_CATS[0].id;
  /** 지금 보고 있는 아이템 — 카테고리마다 따로 기억한다(탭을 오가도 자리를 안 잃는다) */
  const looking = {};

  const CAT_LABEL = { acc: S.itemCatAcc, wing: S.itemCatWing, pet: S.itemCatPet };

  /**
   * 지금 보고 있는 아이템.
   *
   * 아직 아무것도 안 눌렀으면 **그 자리에 착용해 둔 것**을 먼저 보여 준다 — 이 화면에
   * 들어온 사람이 제일 먼저 확인하고 싶은 건 "지금 뭘 끼고 있지"다. 그것도 없으면 첫 줄.
   */
  function current(worn) {
    const list = itemsOf(cat);
    const slot = ITEM_CATS.find((c) => c.id === cat)?.slot;
    return itemById(looking[cat]) ?? itemById(worn?.[slot]) ?? list[0] ?? null;
  }

  /**
   * 지금 착용해 둔 것들. `현재 모습` 이 이걸 그대로 그리고, 게임도 같은 값을 읽는다.
   * @param {object} worn `profile.equippedItems`
   */
  const wornList = (worn) => Object.values(worn ?? {}).map(itemById).filter(Boolean);

  /**
   * "이걸 입으면 어떻게 되나" — 착용해 둔 것에서 **고른 것의 자리만** 갈아 끼운다.
   * 고른 것만 홀로 보여 주면 이미 낀 날개·반려견이 사라져 실제와 다른 그림이 된다.
   */
  const previewList = (worn, item) => {
    const next = { ...(worn ?? {}) };
    if (item) next[item.slot] = item.id;
    return wornList(next);
  };

  async function buy(item, p) {
    if ((p.shoesOwned ?? 0) < item.cost) {
      Sfx.play('sfx_denied');
      toast(S.itemNeedMore(item.cost - (p.shoesOwned ?? 0)));
      return;
    }
    const ok = await confirmDialog({
      message: S.itemBuyConfirm(item.ko, item.cost),
      detail: S.purchaseWarning,
      yes: S.yes,
      no: S.no,
    });
    if (!ok) return;
    const r = buyItem(item.id, item.cost);
    if (r.ok) {
      Sfx.play('sfx_purchase');
      toast(S.itemBought(item.ko));
      // 산 즉시 입혀 준다 — 사고 나서 한 번 더 눌러야 하는 이유가 없다
      equipItem(item.slot, item.id);
    } else {
      Sfx.play('sfx_denied');
      toast(S.purchaseFailed);
    }
    nav.refresh();
  }

  return {
    render() {
      const p = getProfile();
      const owned = p.ownedItems ?? {};
      const worn = p.equippedItems ?? {};
      const item = current(worn);
      const 산것 = !!(item && owned[item.id]);
      const 입은것 = !!(item && worn[item.slot] === item.id);

      const list = el('div.shop-list', null, itemsOf(cat).map((it) => {
        const 샀나 = !!owned[it.id];
        return el('div.shop-row', {
          class: [it.id === item?.id ? 'on' : '', 샀나 ? 'owned' : ''].filter(Boolean).join(' '),
          onclick: () => { looking[cat] = it.id; Sfx.play('sfx_menu_move'); nav.refresh(); },
        }, [
          el('div.shop-name', it.ko),
          /**
           * ★ 산 것은 **값 대신 상태**를 적는다(사용자 지정). 값은 살 사람에게만 필요한
           * 정보이고, 이미 산 줄에서 궁금한 것은 "지금 입고 있나"다.
           * 착용중은 한 번 더 눈에 띄어야 해서 색을 따로 준다(`.on`).
           */
          샀나
            ? el('div.shop-have', {
                class: worn[it.slot] === it.id ? 'on' : '',
              }, worn[it.slot] === it.id ? S.itemWorn : S.itemOwned)
            : el('div.shop-cost', S.itemCost(it.cost)),
        ]);
      }));

      return screen(
        title(S.menuItemShop),

        segmented(ITEM_CATS.map((c) => ({ value: c.id, label: CAT_LABEL[c.id] })), cat, (v) => {
          cat = v;
          nav.refresh();
        }),

        // 내 지갑을 늘 보여 준다 — 값이 네 자리라 "살 수 있나"가 한눈에 보여야 한다
        el('div.shop-wallet', S.itemWallet(p.shoesOwned ?? 0)),

        list,

        /**
         * ★ 큰 버튼 하나가 **세 얼굴**을 한다(사용자 지정).
         *   · 안 산 것       → `구매하기 (신발 N개)`
         *   · 산 것 · 미착용 → `착용하기`
         *   · 산 것 · 착용중 → `착용해제`
         * 버튼을 셋으로 나누면 지금 무엇을 눌러야 하는지가 흐려진다 — 상태가 배타적이라
         * 한 자리에 하나만 있는 쪽이 읽기 쉽다.
         */
        item
          ? (산것
            ? button(입은것 ? S.itemTakeOff : S.itemWear, () => {
                equipItem(item.slot, item.id);
                Sfx.play('sfx_menu_select');
                nav.refresh();
              }, { primary: !입은것 })
            : button(S.itemBuy(item.cost), () => buy(item, p), {
                primary: true,
                class: (p.shoesOwned ?? 0) >= item.cost ? '' : 'dim',
              }))
          : null,

        el('div.wear-title', S.itemWearTitle),
        el('div.wear-row', null, [
          // 왼쪽 = 고른 것을 입어 본 모습 · 오른쪽 = 실제로 착용해 둔 모습(게임에 들어가는 그림)
          wearCut(p.selectedCharacter, previewList(worn, item), S.itemCutPreview),
          wearCut(p.selectedCharacter, wornList(worn), S.itemCutCurrent),
        ]),

        /**
         * ★ **모두 벗기.** 자리가 셋이라 하나씩 벗으면 세 번 눌러야 한다.
         * 아무것도 안 입었으면 눌러도 아무 일이 안 일어나는 대신 **왜 안 되는지 말한다**
         * — 조용히 아무 일도 안 하는 버튼은 고장으로 보인다(사용자 지정 문구 그대로).
         */
        button(S.itemUnequipAll, () => {
          const r = unequipAll();
          if (!r.off) { Sfx.play('sfx_denied'); toast(S.itemNothingWorn); return; }
          Sfx.play('sfx_menu_select');
          toast(S.itemAllOff);
          nav.refresh();
        }, { class: Object.values(worn).filter(Boolean).length ? '' : 'dim' }),

        backButton(S.itemShopExit, () => nav.back())
      );
    },
  };
}
