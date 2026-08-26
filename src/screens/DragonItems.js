/**
 * S22 아이템쇼핑.
 *
 * ★ **신발을 찾아서의 아이템쇼핑과 같은 모양이다.** (2026-08-26, 사용자 지정)
 *
 * 앞서 만든 카드 격자는 스무 장이 한꺼번에 쏟아져서 뭘 보고 있는지 흐렸다.
 * 오락실 안의 두 게임이 서로 다른 방식으로 물건을 팔 이유가 없으므로,
 * 이미 손에 익은 쪽으로 맞춘다:
 *
 *   위에 분류 탭 → 가운데 목록 → 큰 버튼 하나 → 맨 아래 입어 본 모습
 *
 * 분류는 여섯이다 — 미사일 / 핵무기 / 마스크 / 불꽃 / 머리 / 다리.
 *
 * 앞의 둘은 **계단**이라 끼고 벗을 것이 없다(사면 영영 그만큼 들고 시작한다).
 * 그래서 그 둘만 버튼이 두 얼굴이고, 나머지 넷은 신발게임과 똑같이 세 얼굴이다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title, segmented, confirmDialog, toast } from './ui.js';
import * as Sfx from '../audio/sfx.js';
import {
  get as getProfile, hasDragonItem, buyDragonItem, equipDragonItem, dragonEquipment,
} from '../services/profile.js';
import { SLOTS, BY_SLOT, ITEMS, ladderState, startMissiles, startBombs, itemById } from '../games/dragon/items.js';
import { loadDragon } from './DragonGame.js';

/** 탭에 적는 짧은 이름 — 여섯 개가 한 줄에 들어가야 해서 자른다 */
const TAB_LABEL = {
  startMsl: '미사일', startBomb: '핵무기',
  mask: '마스크', flame: '불꽃', head: '머리', leg: '다리',
};

export default function DragonItems(nav) {
  let cat = SLOTS[0].key;
  /** 분류마다 마지막으로 보던 줄 — 탭을 오갈 때 처음으로 튕기지 않게 */
  const looking = {};
  let mod = null;
  let live = true;

  loadDragon().then((m) => { mod = m; if (live) nav.refresh(); }).catch(() => {});

  const slotOf = (k) => SLOTS.find((s) => s.key === k);
  const itemsOfCat = (k) => ITEMS.filter((i) => i.slot === k);

  /** 지금 골라 둔 줄 */
  function current() {
    const list = itemsOfCat(cat);
    return itemById(looking[cat]) && itemById(looking[cat]).slot === cat
      ? itemById(looking[cat])
      : list[0];
  }

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
    Sfx.play('sfx_purchase');
    toast(S.dragonItemBought(it.ko), 2200);
    nav.refresh();
  }

  return {
    onLeave() { live = false; },

    render() {
      const p = getProfile();
      const coins = p.dragonCoins || 0;
      const worn = dragonEquipment();
      const slot = slotOf(cat);
      const ladder = !!slot.ladder;
      const item = current();
      const 산것 = !!(item && hasDragonItem(item.id));
      const 낀것 = !!(item && worn[item.slot] === item.id);

      /* 계단은 앞 칸을 사야 다음 칸이 열린다 — 잠긴 줄은 눌러도 소용없다 */
      const steps = ladder ? ladderState(p, cat) : null;
      const stepOf = (id) => steps && steps.find((r) => r.item.id === id);

      const list = el('div.shop-list', null, itemsOfCat(cat).map((it) => {
        const 샀나 = hasDragonItem(it.id);
        const st = stepOf(it.id);
        const 잠김 = !!(st && st.locked);
        return el('div.shop-row', {
          class: [it.id === item?.id ? 'on' : '', 샀나 ? 'owned' : '', 잠김 ? 'locked' : '']
            .filter(Boolean).join(' '),
          onclick: () => {
            if (잠김) { toast(S.dragonItemStepLocked, 1600); return; }
            looking[cat] = it.id; Sfx.play('sfx_menu_move'); nav.refresh();
          },
        }, [
          el('div.shop-name', it.ko),
          /* 산 줄에는 값 대신 상태를 적는다 — 값은 살 사람에게만 필요한 정보다 */
          샀나
            ? el('div.shop-have', { class: worn[it.slot] === it.id ? 'on' : '' },
                ladder ? S.dragonItemOwned : (worn[it.slot] === it.id ? S.itemWorn : S.itemOwned))
            : 잠김
              ? el('div.shop-have', S.dragonItemStepLocked)
              : el('div.shop-cost', `${it.price.toLocaleString('en-US')} 금화`),
        ]);
      }));

      /**
       * 큰 버튼 하나가 여러 얼굴을 한다 (신발게임과 같은 방침).
       *   계단   : 구매하기 / 보유 중(누를 것 없음) / 앞 단계부터
       *   착용류 : 구매하기 / 착용하기 / 착용해제
       */
      let action = null;
      if (item) {
        const st = stepOf(item.id);
        if (st && st.locked) action = button(S.dragonItemStepLocked, () => {}, { class: 'dim' });
        else if (산것 && ladder) action = button(S.dragonItemOwned, () => {}, { class: 'dim' });
        else if (산것) {
          action = button(낀것 ? S.itemTakeOff : S.itemWear, () => {
            equipDragonItem(item.slot, item.id);
            Sfx.play('sfx_menu_select');
            nav.refresh();
          }, { primary: !낀것 });
        } else {
          action = button(S.dragonItemBuyBtn(item.price), () => buy(item), {
            primary: true,
            class: coins >= item.price ? '' : 'dim',
          });
        }
      }

      /* 맨 아래 — 불꽃은 불줄기, 나머지 착용류는 입어 본 모습, 계단은 개수 */
      let footer;
      if (cat === 'flame') {
        /**
         * ★ **불꽃은 드래곤이 아니라 불을 보여줘야 한다.** (2026-08-26, 사용자 지정)
         * 드래곤 그림 위에서는 불꽃 색이 안 보인다 — 불은 입에서 나가는 것이라
         * 서 있는 드래곤에는 안 그려진다. 고른 불이 실제로 어떻게 뻗는지를 보여준다.
         */
        const it2 = item;
        footer = el('div.wear-box', null, [
          el('div.wear-title', S.dragonFlameTitle),
          el('div.flame-strip', { class: 산것 ? '' : 'locked' },
            [mod && it2 ? mod.flamePreview(it2.pal, 2, 0.62) : null].filter(Boolean)),
          el('div.wear-cap', 산것 ? it2?.ko : S.dragonFlameLocked),
        ]);
      } else if (ladder) {
        const now = cat === 'startMsl' ? startMissiles(p) : startBombs(p);
        const after = item ? item.qty : now;
        footer = el('div.wear-title', null, [
          S.dragonStartNow(slot.ko, now),
          산것 || !item ? null : el('span.step-arrow', S.dragonStartAfter(after)),
        ].filter(Boolean));
      } else {
        /* 왼쪽 = 고른 것을 걸쳐 본 모습 · 오른쪽 = 지금 낀 모습 */
        const gearOf = (eq) => ({
          head: itemById(eq.head)?.tint || null,
          leg: itemById(eq.leg)?.tint || null,
          /* 마스크는 색만으로 부족하다 — 등급마다 생김새가 달라서 등급도 같이 넘긴다 */
          mask: itemById(eq.mask)?.tint || null,
          maskLv: itemById(eq.mask)?.lv || 0,
        });
        const tryOn = { ...worn, [item?.slot ?? 'mask']: item?.id };
        /**
         * ★ **안 산 것은 회색으로 눌러 둔다.** (2026-08-26, 사용자 지정)
         * 어떤 색인지까지 다 보여 주면 살 이유가 줄어든다 — 모양만 비치게 한다.
         */
        const cut = (eq, label, dim) => el('div.wear-cut', null, [
          el('div.wear-pic', { class: dim ? 'locked' : '' },
            [mod ? mod.dragonPortrait(p.dragonCharacter | 0, 2, false, gearOf(eq)) : null].filter(Boolean)),
          el('div.wear-cap', label),
        ]);
        footer = el('div.wear-box', null, [
          el('div.wear-title', S.itemWearTitle),
          el('div.wear-row', null, [cut(tryOn, S.itemCutPreview, !산것), cut(worn, S.itemCutCurrent)]),
        ]);
      }

      return screen(
        title(S.dragonItemTitle),

        segmented(SLOTS.map((c) => ({ value: c.key, label: TAB_LABEL[c.key] })), cat, (v) => {
          cat = v; nav.refresh();
        }),

        el('div.shop-wallet', S.dragonWallet(coins.toLocaleString('en-US'))),
        el('div.hint', slot.note),

        list,
        action,
        footer,

        backButton(S.backToGameLobby, () => nav.back())
      );
    },
  };
}
