/**
 * 인게임 아이템 착용 렌더 — 계단 위 내 캐릭터와 상대 고스트에 얹는다.
 * (2026-08-21 26차 후속, 사용자 요청 *"전부 구현해"*)
 *
 * ## 쇼핑 화면과 **같은 표**를 쓴다
 *
 * `data/items.js` 의 `dx`·`dy` 는 **착용 상자(WEAR 60×66)** 안에서 캐릭터를 (12,12) 에
 * 놓았을 때의 좌표다. 인게임은 그 상자가 없으니 **캐릭터 기준으로 환산**한다:
 *
 *     relX = dx - WEAR.charX      relY = dy - WEAR.charY      (원본 도트 단위)
 *
 * 이렇게 두면 쇼핑 미리보기에서 본 자리와 계단 위의 자리가 **정확히 같다** —
 * 사용자가 나중에 직접 그린 png 로 갈아 끼워도 표 하나만 맞추면 두 화면이 같이 따라온다.
 *
 * ## 캐릭터 상자는 컷과 무관하게 35×50 으로 본다
 *
 * 점프 컷은 50×50 이라 좌우가 더 넓지만 **몸통은 같은 자리에 있고 발끝은 언제나
 * `footY`, 중심은 언제나 `cx`** 다. 컷마다 상자를 바꾸면 이펙트 3프레임 동안 모자가
 * 옆으로 튄다 — 기준을 하나로 두는 쪽이 눈에 안정적이다.
 *
 * ## 좌우 반전은 **캐릭터 상자 안에서** 뒤집는다
 *
 * 화면 좌표를 뒤집으면 배율(1.5)이 곱해진 뒤라 반올림 오차가 생긴다. 원본 도트 단위에서
 * 먼저 뒤집고(`CHAR.w - relX - w`) 그 다음에 배율을 곱한다 — 어느 방향을 보든 같은 자리다.
 */

import { CHAR } from '../config/layout.js';
import { WEAR, itemById, itemSprite } from '../data/items.js';
import { img, loadAll, has } from '../core/assets.js';
import { drawFrameAt, drawFrameAtFlipped } from '../core/sprite.js';

/** 에셋 캐시 키 — 캐릭터 컷과 겹치지 않게 접두사를 붙인다 */
export const itemKey = (id, cut) => `item_${id}_${cut}`;

/**
 * 목록 문자열의 포장·해제는 **표 옆(`data/items.js`)** 에 있다 — 멀티 서비스도 같은
 * 함수를 쓰는데, 서비스가 `game/` 을 물면 브라우저 전용 모듈이 딸려 온다.
 * 화면 코드가 한 곳만 보게 여기서 그대로 다시 내보낸다.
 */
export { packItems, parseItems } from '../data/items.js';

/** 아직 안 받은 그림만 받는다. 못 받아도 게임은 그대로 돈다(빈칸으로 보일 뿐이다) */
export function ensureItemAssets(ids) {
  const want = [];
  for (const id of ids ?? []) {
    for (const cut of ['front', 'side']) {
      const k = itemKey(id, cut);
      if (!has(k)) want.push({ key: k, url: itemSprite(id, cut) });
    }
  }
  if (want.length) loadAll(want).catch(() => {});
}

/**
 * 착용 아이템 한 겹을 그린다.
 *
 * @param {string[]} ids       착용한 아이템 id 들
 * @param {number} cx          캐릭터 중심 화면 x
 * @param {number} footY       발끝 화면 y
 * @param {number} scale       캐릭터와 **같은 배율** (인게임 1.5, 고스트 1)
 * @param {number} facing      1 오른쪽 / -1 왼쪽
 * @param {'front'|'side'} cut 지금 그린 캐릭터 컷
 * @param {boolean} behind     true 면 날개처럼 **캐릭터보다 뒤**인 것만, false 면 나머지
 */
export function drawWornItems(ids, cx, footY, scale, facing, cut, behind) {
  if (!ids?.length) return;
  const left = Math.round(cx - (CHAR.w * scale) / 2);
  const top = Math.round(footY - CHAR.h * scale);
  const flip = cut !== 'front' && facing !== 1;

  for (const id of ids) {
    const it = itemById(id);
    if (!it || !!it.behind !== !!behind) continue;
    const sprite = img(itemKey(id, cut));
    if (!sprite) continue;

    const relX = it.dx - WEAR.charX;
    const relY = it.dy - WEAR.charY;
    // ★ 뒤집기는 **원본 도트 단위**에서 (위 주석)
    const rx = flip ? CHAR.w - relX - it.w : relX;
    const dx = left + Math.round(rx * scale);
    const dy = top + Math.round(relY * scale);

    if (flip) drawFrameAtFlipped(sprite, 0, 0, it.w, it.h, dx, dy, scale);
    else drawFrameAt(sprite, 0, 0, it.w, it.h, dx, dy, scale);
  }
}
