/**
 * S06 신발 도감 — 130종.
 *
 * 티어 탭 1~5, 미획득은 실루엣, 탭하면 마스터를 확대한 상세 팝업.
 * 도감은 한 번 찾으면 **절대 사라지지 않는다** (기획서 §5-2).
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title } from './ui.js';
import * as Sfx from '../audio/sfx.js';
import { SHOE_TIERS, SHOE_TOTAL } from '../config/balance.js';
import { SHOE } from '../config/layout.js';
import shoesData from '../data/shoes.json';
import { collection as getCollection, dexUnique, get as getProfile } from '../services/profile.js';

const MASTER_URL = `/assets/shoes/${shoesData.master.file}`;

/**
 * 아틀라스 한 칸을 DOM으로 잘라 보여준다.
 * background-position 방식이라 이미지를 130번 내려받지 않는다.
 * @param {object} shoe shoes.json 항목
 * @param {number} scale 정수 배율 (CLAUDE.md §3-1)
 */
function shoeSprite(shoe, scale) {
  const m = shoesData.master;
  return el('i.shoe-spr', {
    style: {
      width: `${m.shoeW * scale}px`,
      height: `${m.shoeH * scale}px`,
      backgroundImage: `url(${MASTER_URL})`,
      backgroundSize: `${m.w * scale}px ${m.h * scale}px`,
      backgroundPosition: `-${shoe.ax * scale}px -${shoe.ay * scale}px`,
    },
  });
}

function detailPopup(shoe, record, held) {
  const close = () => overlay.remove();
  const overlay = el('div.dialog-overlay', { onclick: close }, [
    el('div.shoe-detail', { onclick: (e) => e.stopPropagation() }, [
      shoeSprite(shoe, SHOE.dexPopupScale),
      el('div.shoe-name', shoe.name),
      el('div.shoe-meta', S.tierTab(shoe.tier)),
      // 주운 횟수와 지금 보유 수는 다르다 — 캐릭터를 사면 보유만 줄어든다
      el('div.shoe-meta', record
        ? `${new Date(record.firstFoundAt).toLocaleDateString('ko-KR')} · ${S.foundTimes(record.count)}`
        : S.notFoundYet),
      record ? el('div.shoe-meta', S.ownedPairs(held)) : null,
      button(S.close, close, { sfx: 'sfx_menu_back' }),
    ]),
  ]);
  document.body.append(overlay);
}

export default function Collection(nav) {
  let tier = 1;

  return {
    render() {
      const owned = getCollection();
      const list = shoesData.shoes.filter((s) => s.tier === tier);
      const haveInTier = list.filter((s) => owned[String(s.index)]).length;
      /**
       * **도감과 지갑은 다른 것이다.**
       *   owned(도감) — 한 번이라도 주웠는지. 절대 사라지지 않는다.
       *   held(지갑)  — 지금 들고 있는 켤레. 캐릭터 구매·엘리베이터로 줄어든다.
       * 그래서 실루엣 여부는 도감으로, 'N켤레 보유'는 지갑으로 판단한다.
       */
      const p = getProfile();
      const held = p.shoesByIndex ?? {};
      const totalPairs = p.shoesOwned;

      const tabs = el('div.seg.tier-tabs', null,
        SHOE_TIERS.map((t) =>
          button(S.tierTab(t.tier), () => { tier = t.tier; nav.refresh(); }, {
            class: t.tier === tier ? 'on' : '',
            sfx: 'sfx_menu_move',
          })
        )
      );

      const grid = el('div.dex-grid', null,
        list.map((s) => {
          const rec = owned[String(s.index)];
          const n = held[String(s.index)] ?? 0;
          return el('button.dex-cell', {
            class: rec ? '' : 'locked',
            type: 'button',
            onclick: () => {
              Sfx.play(rec ? 'sfx_menu_select' : 'sfx_denied');
              detailPopup(s, rec, n);
            },
          }, [
            shoeSprite(s, SHOE.dexListScale),
            // 1켤레는 아무것도 안 쓴다 — 대부분의 칸에 '1켤레 보유'가 붙으면 소음이 된다
            n > 1 ? el('em.dex-count', S.ownedPairs(n)) : null,
          ]);
        })
      );

      return screen(
        title(S.collectionTitle),
        /**
         * 도감 종류(0/130)가 아니라 **보유 켤레 총합**이다.
         * 같은 신발을 여러 켤레 들 수 있어서 200·300켤레가 나오는데,
         * 그걸 `/130` 으로 나눠 보여주면 260/130 같은 말이 안 되는 표기가 된다.
         */
        el('div.dex-total', S.totalShoesCount(totalPairs)),
        el('div.dex-unique', S.dexProgress(dexUnique(), SHOE_TOTAL)),
        tabs,
        el('div.dex-tier-count', S.tierCount(tier, haveInTier, list.length)),
        grid,
        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
