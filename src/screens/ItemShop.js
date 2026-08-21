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
import { ITEM_CATS, itemsOf, itemById } from '../data/items.js';
/**
 * ★ 착용 모습은 **로비와 같은 부품**이 그린다(2026-08-21 28차). 여기서 따로 그리면
 * 앞뒤 순서와 좌표 환산이 두 벌이 되어 언젠가 한쪽만 고쳐진다 — `wearFigure.js` 주석.
 */
import { wearCut, wornList } from './wearFigure.js';
import { get as getProfile, buyItem, equipItem } from '../services/profile.js';
/**
 * ★ **값은 화면이 정하지 않는다** (2026-08-21 32차). 하루 5분만 열리는 할인 때문에
 * 같은 아이템의 값이 시각에 따라 달라진다 — 목록·큰 버튼·확인 문구·실제 차감이 전부
 * 이 함수 하나를 부르지 않으면 "화면에는 500인데 7,000이 빠지는" 사고가 난다.
 */
import { priceOf, eggSale, msUntilEggChange } from '../config/easterEgg.js';

export default function ItemShop(nav) {
  let cat = ITEM_CATS[0].id;
  /** 지금 보고 있는 아이템 — 카테고리마다 따로 기억한다(탭을 오가도 자리를 안 잃는다) */
  const looking = {};
  /**
   * ★ 할인 창이 열리거나 닫히는 **그 순간에만** 다시 그린다(2026-08-21 32차).
   *
   * 1초마다 다시 그릴 이유가 없다 — 값이 바뀌는 순간은 하루에 딱 두 번이다.
   * 이게 없으면 19:29 에 쇼핑을 열어 둔 사람은 화면에 7,000이 찍힌 채로 500에 사게
   * 되거나(반대로) 19:35 에 500을 보고 눌렀다가 7,000이 빠진다 — 저장소가 값을
   * 스스로 계산하므로 차감은 항상 옳지만, **화면이 거짓말을 하면 안 된다.**
   */
  let eggTimer = null;
  function armEggTimer() {
    clearTimeout(eggTimer);
    eggTimer = setTimeout(() => { eggTimer = null; nav.refresh(); }, msUntilEggChange() + 50);
  }

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
   * "이걸 입으면 어떻게 되나" — 착용해 둔 것에서 **고른 것의 자리만** 갈아 끼운다.
   * 고른 것만 홀로 보여 주면 이미 낀 날개·반려견이 사라져 실제와 다른 그림이 된다.
   */
  const previewList = (worn, item) => {
    const next = { ...(worn ?? {}) };
    if (item) next[item.slot] = item.id;
    return wornList(next);
  };

  async function buy(item, p) {
    /**
     * ★ 값은 **누르는 순간** 다시 묻는다. 그리는 시각과 누르는 시각 사이에 할인 창이
     * 열리거나 닫힐 수 있는데, 그때 화면에 찍힌 옛 값으로 판단하면 확인 문구와 실제
     * 차감이 어긋난다. 저장소도 같은 함수를 부르므로 둘은 항상 같은 답을 낸다.
     */
    const cost = priceOf(item);
    if ((p.shoesOwned ?? 0) < cost) {
      Sfx.play('sfx_denied');
      toast(S.itemNeedMore(cost - (p.shoesOwned ?? 0)));
      return;
    }
    const ok = await confirmDialog({
      message: S.itemBuyConfirm(item.ko, cost),
      detail: S.purchaseWarning,
      yes: S.yes,
      no: S.no,
    });
    if (!ok) return;
    const r = buyItem(item.id);
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
      armEggTimer();
      /** 한 번만 잡는다 — 한 화면 안에서 줄과 버튼의 값이 갈리면 안 된다 */
      const now = Date.now();
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
            : el('div.shop-cost', S.itemCost(priceOf(it, now))),
          /**
           * ★ 할인 중인 줄에만 붙는 빨간 배지. **안 산 줄에만** 뜬다 — 이미 산 사람에게
           * 값이 내려갔다는 소식은 약이 오르기만 할 뿐 쓸모가 없다.
           */
          !샀나 && eggSale(it, now) ? el('div.shop-sale', S.itemSaleTag) : null,
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
            : button(S.itemBuy(priceOf(item, now)), () => buy(item, p), {
                primary: true,
                class: (p.shoesOwned ?? 0) >= priceOf(item, now) ? '' : 'dim',
              }))
          : null,

        el('div.wear-title', S.itemWearTitle),
        el('div.wear-row', null, [
          // 왼쪽 = 고른 것을 입어 본 모습 · 오른쪽 = 실제로 착용해 둔 모습(게임에 들어가는 그림)
          wearCut(p.selectedCharacter, previewList(worn, item), S.itemCutPreview),
          wearCut(p.selectedCharacter, wornList(worn), S.itemCutCurrent),
        ]),

        backButton(S.itemShopExit, () => nav.back())
      );
    },
    onLeave() { clearTimeout(eggTimer); eggTimer = null; },
  };
}
