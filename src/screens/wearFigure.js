/**
 * 착용 모습 한 컷 — **쇼핑 화면과 로비가 같은 그림을 쓴다.** (2026-08-21 28차)
 *
 * *"가장 큰 문제는 아이템을 착용하면, 메인 로비 상단에 캐릭터 이미지가 있는 부분에
 *   반드시 착용한 아이템이 착용된 모습으로 있어야 한다는 거야, '현재 모습' 캐릭터
 *   모습 그대로"* (사용자 지정)
 *
 * ## 왜 화면마다 따로 그리지 않는가
 *
 * 27차에 이 코드가 `ItemShop.js` 안에만 있었다. 로비에도 같은 그림이 필요해지자
 * 복사할 수 있었지만, 그러면 **앞뒤 순서(`behind`)와 좌표 환산이 두 벌**이 된다 —
 * 인게임과 쇼핑을 `data/items.js` 한 표로 묶어 둔 이유(§9-0-56)가 여기서 무너진다.
 * 사용자가 나중에 직접 그린 png 로 갈아 끼울 때 **세 화면이 함께 따라와야** 한다.
 *
 * ## 앞뒤는 **붙이는 순서**가 정한다
 *
 * 캔버스와 달리 DOM 은 나중에 붙인 것이 위에 온다. 그래서 `behind`(날개·반려견) →
 * 캐릭터 → 나머지(모자) 순으로 붙인다. 이 한 줄이 없으면 날개가 얼굴을 덮는다.
 */

import { el } from './ui.js';
import { WEAR, itemById, itemSprite, itemOffset, backFirst } from '../data/items.js';
import { characterSprite } from '../data/characters.js';

/**
 * ★ **로비 상단 그림틀** (2026-08-21 28차, 사용자 지정)
 *
 * 로비 칸은 좁다. 그래서 착용 상자(60×66)를 통째로 보여 주지 않고 **실제로 무언가
 * 그려지는 구간만** 잘라 낸다:
 *
 *   · 가로 4~56 — 날개가 정확히 그 구간을 쓴다(`dx 4`, 폭 52)
 *   · 세로 4~62 — 위는 배트맨 귀(`dy 5`), 아래는 캐릭터·반려견의 발(62)
 *
 * 배율 **1.5 는 인게임 캐릭터 배율과 같은 값**이다(§3-1). 그래서 로비에 뜬 그림이
 * 계단 위에서 보게 될 그림과 **크기까지 같다** — 사기 전에 본 것과 사고 나서 보는
 * 것이 다르면 안 되는 물건이라 이 값이 맞다.
 *
 * 결과: 그림틀 78×87px, 그 안의 캐릭터는 52.5px(예전 55px에서 살짝 줄었다).
 * 캐릭터가 조금 작아진 자리에 **날개 양쪽과 반려견이 들어온다** — 사용자가 말한
 * *"캐릭터의 크기를 10% 정도 줄이고, 아이템 날개, 반려견 등의 아이템도 겹쳐서
 * 착용하고 있구나 하는 것을 알 수 있게"* 가 이 숫자다.
 */
export const LOBBY_FIG = { scale: 1.5, x0: 4, y0: 4, w: 52, h: 58 };

/**
 * 착용 상자(60×66) 하나를 만든다 — **좌표는 논리값 그대로.**
 *
 * 확대는 이 상자를 통째로 키워서 한다. 그림마다 `transform: scale()` 을 걸면 크기만
 * 커지고 **자리(`left`/`top`)는 그대로**라 전부 어긋난다(실제로 그렇게 짰다가 모자가
 * 어깨에 붙었다). 상자를 키우면 배율이 화면 코드 여기저기로 흩어지지 않는다.
 *
 * @param {string} charId
 * @param {Array} items `data/items.js` 의 아이템 객체 배열 (null 은 걸러진다)
 */
export function wearInner(charId, items) {
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
  // 뒤 겹 안에서도 순서가 있다 — **정면에서는 반려견이 날개보다 가깝다**(`backFirst` 주석)
  for (const it of list.filter((x) => x.behind).sort(backFirst('front'))) draw(it);
  put(characterSprite(charId, 'front'), WEAR.charX, WEAR.charY, 35, 50);
  for (const it of list) if (!it.behind) draw(it);
  return inner;
}

/** 쇼핑 화면의 한 컷 — 상자 + 설명 글 (배율 2는 `.wear-inner` 의 CSS 가 준다) */
export function wearCut(charId, items, label) {
  return el('figure.wear-cut', null, [
    el('div.wear-stage', null, [wearInner(charId, items)]),
    el('figcaption', label),
  ]);
}

/**
 * 로비 상단 그림 — 같은 상자를 **잘라서** 보여 준다.
 *
 * 배율·잘라 낼 구간을 CSS 가 아니라 여기서 준다. 두 곳에 적으면 한쪽만 고쳐지고,
 * 무엇보다 검사(`qa:lobbyfit`)가 **코드가 쓰는 값 그대로** 잴 수 있어야 한다.
 */
export function lobbyFigure(charId, items) {
  const F = LOBBY_FIG;
  const inner = wearInner(charId, items);
  /**
   * `scale` 다음에 `translate` 를 적으면 **translate 가 먼저** 적용된다(오른쪽부터).
   * 즉 논리 좌표에서 (x0, y0) 만큼 밀어 낸 뒤 통째로 확대되므로, 잘라 낼 구간이
   * 논리 도트 단위로 적힌다 — 화면 px 로 환산해 적으면 배율을 바꿀 때마다 틀어진다.
   */
  inner.style.transform = `scale(${F.scale}) translate(${-F.x0}px, ${-F.y0}px)`;
  return el('div.char-figure', {
    style: { width: `${F.w * F.scale}px`, height: `${F.h * F.scale}px` },
  }, [inner]);
}

/** 지금 착용해 둔 것들 — `profile.equippedItems` → 아이템 객체 배열 */
export const wornList = (worn) => Object.values(worn ?? {}).map(itemById).filter(Boolean);
