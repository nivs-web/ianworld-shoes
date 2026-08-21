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
import { WEAR, itemById, itemSprite, itemOffset, backFirst } from '../data/items.js';
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

/**
 * 컷 이름 두 가지를 구분한다 — **그림용**과 **좌표용**이 다르다.
 *
 *   · 그림 : 상승 컷(`jump`)에 전용 그림이 있는 것(날개)만 `_jump` 를 쓰고 나머지는 `_side`
 *   · 좌표 : 정면이 아니면 전부 옆모습 좌표(`sideDx`·`sideDy`)
 *
 * 둘을 한 이름으로 묶으면 "모자는 `_jump` 그림이 없는데 왜 안 뜨지" 같은 자리가 생긴다.
 */
const artCut = (it, cut) => (cut === 'jump' ? (it.jumpCut ? 'jump' : 'side') : cut);

/** 아직 안 받은 그림만 받는다. 못 받아도 게임은 그대로 돈다(빈칸으로 보일 뿐이다) */
export function ensureItemAssets(ids) {
  const want = [];
  for (const id of ids ?? []) {
    const it = itemById(id);
    if (!it) continue;
    for (const cut of it.jumpCut ? ['front', 'side', 'jump'] : ['front', 'side']) {
      const k = itemKey(id, cut);
      if (!has(k)) want.push({ key: k, url: itemSprite(id, cut) });
    }
  }
  if (want.length) loadAll(want).catch(() => {});
}

/** 어떤 그림들을 받아야 하는가 — 판이 시작될 때 목록을 만드는 쪽(`GameScene`)도 쓴다 */
export function itemAssetList(ids) {
  const out = [];
  for (const id of ids ?? []) {
    const it = itemById(id);
    if (!it) continue;
    for (const cut of it.jumpCut ? ['front', 'side', 'jump'] : ['front', 'side']) {
      out.push({ key: itemKey(id, cut), url: itemSprite(id, cut) });
    }
  }
  return out;
}

/**
 * 착용 아이템 한 겹을 그린다.
 *
 * @param {string[]} ids       착용한 아이템 id 들
 * @param {number} cx          캐릭터 중심 화면 x
 * @param {number} footY       발끝 화면 y
 * @param {number} scale       캐릭터와 **같은 배율** (인게임 1.5, 고스트 1)
 * @param {number} facing      1 오른쪽 / -1 왼쪽
 * @param {'front'|'side'|'jump'} cut 지금 그린 캐릭터 컷
 * @param {boolean} behind     true 면 날개·반려견처럼 **캐릭터보다 뒤**인 것만
 */
export function drawWornItems(ids, cx, footY, scale, facing, cut, behind) {
  if (!ids?.length) return;
  const left = Math.round(cx - (CHAR.w * scale) / 2);
  const top = Math.round(footY - CHAR.h * scale);
  const flip = cut !== 'front' && facing !== 1;

  /**
   * 뒤 겹은 **먼 것부터** 그린다. 무엇이 먼지는 **컷마다 다르다** — 옆모습·상승 컷에서
   * 반려견은 한 계단 뒤에서 따라오므로 날개보다 멀다(`items.js` 의 `backFirst` 주석).
   * 이 정렬이 없으면 무서운호랑이가 날개를 통째로 덮는다(실제로 그렇게 나왔다).
   */
  const list = ids.map(itemById).filter((it) => it && !!it.behind === !!behind).sort(backFirst(cut));
  for (const it of list) {
    const sprite = img(itemKey(it.id, artCut(it, cut)));
    if (!sprite) continue;

    const off = itemOffset(it, cut);
    /**
     * ★ 상승 컷은 점프 그림이 **웅크린 자세**라 몸이 1도트 왼쪽·3도트 아래에 있다
     * (`CHAR.jumpNudge*`). **몸에 붙는 것만** 따라 옮긴다 — `sideDx` 가 있는 것은
     * 계단을 기준으로 자리를 잡으므로(반려견) 몸을 따라가면 안 된다.
     */
    const 몸에붙음 = cut === 'jump' && it.sideDx == null;
    const relX = off.x - WEAR.charX + (몸에붙음 ? CHAR.jumpNudgeX : 0);
    const relY = off.y - WEAR.charY + (몸에붙음 ? CHAR.jumpNudgeY : 0);
    // ★ 뒤집기는 **원본 도트 단위**에서 (위 주석)
    const rx = flip ? CHAR.w - relX - it.w : relX;
    const dx = left + Math.round(rx * scale);
    const dy = top + Math.round(relY * scale);

    if (flip) drawFrameAtFlipped(sprite, 0, 0, it.w, it.h, dx, dy, scale);
    else drawFrameAt(sprite, 0, 0, it.w, it.h, dx, dy, scale);
  }
}
