/**
 * 멀티 전용 인게임 표시 — **누가 몇 칸 앞서는지 한눈에.** (2026-08-19 전면 개편)
 *
 * 인게임은 전부 캔버스다 (CLAUDE.md §6-3). DOM 오버레이를 얹으면 도트가 깨진다.
 *
 * ## 글자를 지우고 그림으로 바꿨다
 *
 * 예전에는 상대를 **이름 + 숫자**로 보여 줬다. 정보로는 충분한데 180×320 화면에서
 * 세 줄이면 계단이 안 보이고, 무엇보다 **읽어야** 알 수 있다. 뛰면서 글자를 읽을 수는 없다.
 * 그래서 인게임에서 아이디를 통째로 없애고 **오른쪽 레이스 게이지** 하나로 모았다.
 *
 * ## 레이스 게이지 (이 파일의 핵심)
 *
 *   · **나는 항상 정중앙**이고 절대 움직이지 않는다. 상대만 위아래로 움직인다 —
 *     보여 줄 것은 절대 층수가 아니라 **나와의 차이**이기 때문이다.
 *   · 눈금은 위로 10칸, 아래로 10칸. **한 칸 = 계단 10칸.**
 *     상대가 30칸 앞이면 3칸 위, 100칸 넘게 앞이면 맨 위에 붙는다.
 *   · 각자 **얼굴 아이콘**으로 그린다(아이디 없음). 얼굴을 두른 **3도트 테두리**는
 *     자리 색(1번 빨강·2번 노랑·3번 파랑·4번 초록)이고, **6칸으로 나뉘어 있다.**
 *     부활을 한 번 쓸 때마다 한 칸씩 지워진다.
 *
 * 마지막 칸이 곧 마지막 목숨이라, **부활을 아꼈다가 늦게 쓰는 쪽이 유리하다** —
 * 이 게임의 승부처가 게이지 하나에 전부 들어간다.
 *
 * ## 상대 캐릭터는 계단 위에도 그린다
 *
 * 멀티는 **전원이 같은 시드**로 계단을 만든다. 그래서 상대의 층수 하나만 알면
 * 그 사람이 선 계단 좌표를 내 화면에서 그대로 계산할 수 있다 — 서버에서 좌표를 받을
 * 필요가 없다. 화면 안이면 반투명 고스트로 지나간다(이름표는 없앴다).
 */

import { textCached, measure, loadSmallFont, smallReady } from '../core/pixelfont.js';
import { rect } from '../core/sprite.js';
import { img, loadAll } from '../core/assets.js';
import { getCtx } from '../core/canvas.js';
import { PAL, SLOT_COLORS, SLOT_DIM } from './palette.js';
import { VIEW_W, VIEW_H, STAIR, CENTER_X, CHAR } from '../config/layout.js';
import { MULTI } from '../config/balance.js';
import { potShoes, slotIndex, rankPlayers, canRevive } from '../services/matchRules.js';
import { serverOffsetSync } from '../services/multiplayer.js';
import S from '../config/strings.ko.js';

/** 알림 한 줄이 떠 있는 시간 */
export const TICKER_MS = 3000;

/**
 * ── 레이스 게이지 좌표 ──
 * 얼굴 16 + 테두리 3×2 = 22. 오른쪽 끝에 붙이되 화면(180) 밖으로 나가지 않게.
 */
const FACE = 16;
const BORDER = 3;
const CELL = FACE + BORDER * 2;          // 22
/** 게이지 세로선 (오른쪽 끝) */
const LINE_X = VIEW_W - 2;               // 178
/** 눈금은 선 왼쪽으로 뻗는다 */
const TICK_W = 5;
const TICK_X = LINE_X - TICK_W;          // 173~177
/** 얼굴 상자 중심 x — 눈금과 겹치지 않게 왼쪽으로 (상자 150~172) */
const RACE_CX = 161;
/**
 * 내 자리 — **여기서 절대 안 움직인다.**
 * 눈금 21칸이 26~240 을 쓰도록 가운데를 133 으로 잡았다. 위로는 부활 하트 자리까지
 * 올라가고(멀티에는 하트가 없다), 아래로는 알림 줄 바로 위까지 내려온다.
 */
const RACE_CY = 133;
/**
 * 눈금 간격 — 위아래로 10칸씩이라 세로로 2×10×GAP 을 쓴다.
 * 화면에서 쓸 수 있는 세로 폭은 26~240 (그 아래는 알림·판돈·조작 버튼) → 10.
 */
const TICK_GAP = 10;

/**
 * 6칸 테두리의 칸 좌표(상자 왼쪽 위 기준). 위 2칸 · 오른쪽 1칸 · 아래 2칸 · 왼쪽 1칸을
 * 시계 방향으로 **왼쪽 위부터** 채운다 — 남은 칸이 앞쪽에 몰려 있어야 세기 쉽다.
 */
const HALF = CELL >> 1;                        // 11
const SEGS = (() => {
  const half = HALF;
  return [
    [0, 0, half, BORDER],                               // 위 왼쪽
    [half, 0, CELL - half, BORDER],                     // 위 오른쪽
    [CELL - BORDER, 0, BORDER, CELL],                   // 오른쪽
    [half, CELL - BORDER, CELL - half, BORDER],         // 아래 오른쪽
    [0, CELL - BORDER, half, BORDER],                   // 아래 왼쪽
    [0, 0, BORDER, CELL],                               // 왼쪽
  ];
})();

/** 등수 글씨는 얼굴 상자 왼쪽에 */
const RANK_X = RACE_CX - (CELL >> 1) - 3;

/**
 * ★ **판돈 줄은 계단 숫자 바로 위다.** (2026-08-19 11차, 사용자 요청)
 *
 * 예전에는 화면 맨 아래(252)였다. 거기는 조작 버튼(266~)과 알림 줄 사이라 눈이
 * 가지 않는 자리다 — *"화면 아래쪽에 있는데 이걸 위로 올리자"*. 지금은 계단 숫자
 * 바로 위에 붙어 있어서 **얼마가 걸렸는지와 지금 몇 계단인지가 한 덩어리로 읽힌다.**
 *
 * 숫자는 그만큼 내려갔다(`layout.HUD.scoreMulti`, 55~77). 아이콘 행(23~38)에 끼워
 * 넣지 않은 이유는 폭이다 — 최대 `1등하면 신발 523켤레!` = **128px**(11px 폰트 실측)라
 * 왼쪽 신발 아이콘·개수와 물리적으로 겹친다.
 */
const POT_Y = 41;
/** 계단 숫자(55~77) 바로 아래 */
const GAP_Y = 80;
/**
 * 판돈 줄의 중심 x — **계단 숫자와 같은 화면 정중앙(90)**이다. (2026-08-19 14차)
 *
 * 예전에는 82 였다. 11px 로 그리면 최대 폭이 128(`1등하면 신발 523켤레!`)이라
 * 정중앙에 두면 오른쪽 레이스 게이지(150~178, 얼굴이 비켜서면 132까지)를 침범해서,
 * **일부러 왼쪽으로 8도트 밀어 둔 값**이었다. 그래서 큰 숫자와 축이 어긋나 보였다 —
 * *"'1등하면 신발 0켤레!' 멘트가 글 가운데 정렬이 아닌거 같아"*.
 *
 * 이번에 글자를 7px 로 낮추면서 최대 폭이 **83** 으로 줄었다(폰트 데이터 실측).
 * 정중앙에 두면 48~132 에 들어가 게이지 왼쪽 끝(132)에 닿기만 하고 넘지 않는다 —
 * **가운데 정렬과 게이지 회피가 이제 동시에 성립한다.** 옛 값(18~146)보다 오히려 안전하다.
 */
const POT_CX = CENTER_X;
/**
 * 알림 줄의 **맨 윗줄** y. 여기서 **아래로** 쌓인다. (2026-08-19 14차)
 *
 * 예전에는 232 를 마지막 줄로 두고 **위로** 쌓았다. 그래서 알림이 늘어날수록
 * 글자가 계단·캐릭터(발끝 212) 쪽으로 기어올라 판을 가렸다 —
 * *"게임에 방해되고 너무 복잡해서 줄 바꿈 해서 한칸 아래 떴으면 좋겠어"*.
 *
 * 지금은 윗줄이 238 에 못 박혀 있고 **새 알림이 그 한 칸 아래(251)** 에 붙는다.
 * 두 줄이면 238~262 로, 조작 버튼 윗변(266) 바로 앞에서 멈춘다. 위로는 절대 안 올라간다.
 */
const TICKER_TOP = 238;
const LINE_H = 13;   // 11px 글자 기준 (7px 시절 9)
/** 알림은 **두 줄까지만**. 3~4인 판에서 낙사·부활이 겹치면 화면이 글자로 덮인다 */
const TICKER_ROWS = 2;
/**
 * 알림은 **레이스 게이지를 피해** 왼쪽에만 쓴다.
 * 게이지는 오른쪽 세로 기둥(150~178)을 위아래로 통째로 쓰기 때문에,
 * 가운데 정렬로 두면 글자가 눈금·얼굴 위로 올라탄다(미리보기로 확인).
 */
// 알림은 오른쪽 레이스 게이지(150~178)를 피해 왼쪽에 쓴다
const TICKER_W = RACE_CX - (CELL >> 1) - 4;
const TICKER_CX = TICKER_W >> 1;

/** 상대 캐릭터 스프라이트는 내 것과 다르다 — 처음 보이는 순간에 받아 둔다 */
const requested = new Set();
function ensureAssets(list, myCharId) {
  const want = [];
  /**
   * ★ **내 얼굴도 받아야 한다.** (2026-08-19)
   * `GameScene` 은 내 캐릭터의 front·side·jump 만 받는다. 얼굴(`_face`)은 상대용으로만
   * 받고 있어서 **레이스 게이지에서 내 칸만 비어 있었다** — 사용자가 지적한 그 버그다.
   */
  if (myCharId && !requested.has(myCharId)) {
    requested.add(myCharId);
    want.push({ key: `${myCharId}_face`, url: `/assets/characters/${myCharId}_face.png` });
  }
  for (const o of list) {
    const id = o.characterId;
    if (!id || requested.has(id)) continue;
    requested.add(id);
    want.push(
      { key: `${id}_front`, url: `/assets/characters/${id}_front.png` },
      { key: `${id}_face`, url: `/assets/characters/${id}_face.png` }
    );
  }
  if (want.length) loadAll(want).catch(() => {});
}

/**
 * @param {object} scene GameScene
 */
/** 공통 준비 — 폰트·에셋. 두 진입점 중 먼저 불린 쪽에서 한 번만 실제로 일한다. */
function prepare(scene) {
  if (!smallReady()) loadSmallFont();
  const list = (scene.opponents ?? []).slice(0, 3);
  // 상대 목록 객체는 방 갱신 때만 새로 만들어진다 — 그때만 에셋을 확인하면 된다
  if (scene.assetsFor !== scene.opponents) { scene.assetsFor = scene.opponents; ensureAssets(list, scene.charId); }
  return list;
}

/**
 * ★ **상대 고스트만 따로 그린다 — 내 캐릭터보다 *먼저*.** (2026-08-19, 사용자 요청)
 *
 * 예전에는 고스트가 `multiHud()` 안에 있었고, 그건 `player.render()` **뒤에** 불렸다.
 * 그래서 상대와 같은 계단에 서면 **반투명한 남이 내 캐릭터를 덮어** 내가 어디 있는지
 * 순간 헷갈렸다. 캔버스는 나중에 그린 것이 위에 얹히므로, 순서를 갈라서 고친다.
 * (`GameScene.render` 가 이걸 player 앞에, `multiHud` 를 뒤에 부른다)
 */
export function multiGhosts(scene) {
  drawGhosts(scene, prepare(scene));
}

/** 게이지·문구 등 **항상 맨 위**에 있어야 하는 것들 (고스트는 여기 없다 — 위 참조) */
export function multiHud(scene) {
  const list = prepare(scene);
  drawRaceGauge(scene, list);
  drawGapLine(scene);
  drawPot(scene);
  drawTicker(scene);
  drawCountdown(scene);
  /**
   * 출발 경고는 **맨 마지막**에 그린다 — 레이스 게이지 위에 얹혀야 한다.
   * `출발하지 않으면 패배합니다` 는 11px 로 154px 라 게이지를 피해 왼쪽에만 쓸 수 없다.
   * 5초짜리 경고가 게이지를 잠깐 가리는 것과, 경고 글자가 얼굴 위에서 뭉개지는 것
   * 중에는 전자가 낫다 — 이 순간 사용자가 봐야 하는 건 게이지가 아니다.
   */
  drawStartWarn(scene);
}

// ─────────────────────────────────────────────
// 1) 계단 위의 상대 — 고스트 + 가장자리 화살표
// ─────────────────────────────────────────────

/**
 * 계단 위의 상대 — 반투명 고스트.
 *
 * ★ **이름표를 없앴다.** (2026-08-19) 인게임에서 아이디는 아예 안 쓴다.
 * 누가 누군지는 **자리 색**으로 안다 — 고스트 발밑에 자리 색 점을 하나 찍어
 * 오른쪽 게이지의 테두리 색과 이어 준다. 글자보다 눈이 훨씬 빠르다.
 */
function drawGhosts(scene, list) {
  if (scene.countdownMs > 0) return;
  const stairs = scene.stairs;
  if (!stairs) return;
  const camX = stairs.worldX(scene.floor) + ((stairs.nextDir(scene.floor) * STAIR.gapX) >> 1);
  const ctx = getCtx2d();

  for (const o of list) {
    const floor = o.stairs | 0;
    const color = SLOT_COLORS[Math.max(0, Math.min(SLOT_COLORS.length - 1, o.slot | 0))];
    const dy = (floor - scene.floor) * STAIR.gapY;
    const footY = CHAR.footY - dy;

    // 세로로 화면 밖이면 오른쪽 레이스 게이지가 맡는다
    if (footY < -20 || footY > VIEW_H + 20) continue;

    stairs.ensure?.(floor + 1);
    const cx = stairs.worldX(floor) - camX + CENTER_X;
    const sprite = img(`${o.characterId}_front`);

    if (cx > 8 && cx < VIEW_W - 8) {
      if (sprite && ctx) {
        const w = CHAR.w, h = CHAR.h;
        const dx = Math.round(cx - (w >> 1));
        const top = Math.round(footY - h);
        ctx.save();
        ctx.globalAlpha = o.alive === false ? 0.25 : 0.6;
        ctx.drawImage(sprite, 0, 0, w, h, dx, top, w, h);
        ctx.restore();
      }
      // 자리 색 점 — 오른쪽 게이지의 테두리 색과 같은 색이다
      rect(Math.round(cx) - 3, Math.round(footY) + 1, 6, 3, color);
    } else {
      // 가로로 밖 — 가장자리에 자리 색 화살표만 (어느 쪽에 있는지가 정보다)
      const left = cx <= 8;
      const ax = left ? 3 : VIEW_W - 4;
      const ay = Math.max(8, Math.min(VIEW_H - 12, Math.round(footY) - 8));
      rect(ax - 2, ay, 5, 5, color);
    }
  }
}

// ─────────────────────────────────────────────
// 2) 레이스 게이지 — 나는 정중앙, 상대는 나와의 차이만큼 위아래로
// ─────────────────────────────────────────────

/**
 * 오른쪽 세로 눈금.
 *
 * **절대 층수를 그리지 않는다.** 위로 10칸·아래로 10칸이 전부이고 한 칸은 계단 10칸이다.
 * 상대가 30칸 앞이면 3칸 위, 100칸을 넘게 앞서면 맨 위에 붙어 더 안 올라간다 —
 * "얼마나 앞서는가"는 어차피 손으로 좁힐 수 있는 범위 안에서만 의미가 있다.
 */
function drawRaceGauge(scene, list) {
  const 나 = scene.floor | 0;

  // 세로선 + 눈금자 — 가운데 눈금만 밝게 (내 자리)
  const 위 = RACE_CY - MULTI.raceTicks * TICK_GAP;
  const 아래 = RACE_CY + MULTI.raceTicks * TICK_GAP;
  rect(LINE_X, 위, 2, 아래 - 위 + 1, PAL.textShadow);
  for (let t = -MULTI.raceTicks; t <= MULTI.raceTicks; t++) {
    const y = RACE_CY + t * TICK_GAP;
    const 가운데 = t === 0;
    rect(가운데 ? TICK_X - 3 : TICK_X, y, 가운데 ? TICK_W + 3 : TICK_W, 1, 가운데 ? PAL.text : PAL.textShadow);
  }

  /** 계단 차이 → 눈금 y (10칸을 넘어가면 끝에 붙는다) */
  const yOf = (floor) => {
    const 칸 = Math.round((floor - 나) / MULTI.raceStairsPerTick);
    const clamped = Math.max(-MULTI.raceTicks, Math.min(MULTI.raceTicks, 칸));
    return RACE_CY - clamped * TICK_GAP;
  };

  const rank = rankOf(scene);
  const now = Date.now() + serverOffsetSync();

  /**
   * ★ **겹치면 왼쪽으로 비켜 세우되, 최대 2명까지만.** (2026-08-19)
   *
   * 눈금 간격은 9도트인데 얼굴 상자는 22도트다 — 20칸 안쪽으로 붙으면 서로를 가린다.
   * 자리는 **내가 항상 맨 오른쪽**이고, 늦게 놓이는 사람이 한 칸씩 왼쪽으로 물러난다.
   *
   * 그런데 셋이 겹치면 세 번째가 **화면 안쪽으로 44도트나 튀어나와** 계단과 캐릭터를
   * 가렸다(사용자 신고 — "가로로 길게 튀어나와서 게임에 방해"). 그래서 비켜서는 건
   * **한 칸까지만** 허용하고, 그 이상 겹치는 사람은 아예 그리지 않는다 —
   * 앞사람 뒤에 가려진 것으로 본다. 어차피 정보는 등수 숫자가 들고 있고,
   * 이 자리는 "누가 앞서는가"를 한눈에 보는 곳이지 전원 명부가 아니다.
   */
  const MAX_STACK = 2;
  const 놓인자리 = [{ y: RACE_CY }];
  const 자리잡기 = (y) => {
    const n = 놓인자리.filter((p) => Math.abs(p.y - y) < CELL).length;
    놓인자리.push({ y });
    // n = 0 제자리 / 1 한 칸 왼쪽 / 2 이상은 뒤에 숨는다
    return n >= MAX_STACK ? null : -n * (CELL - 4);
  };

  // 상대 먼저, 나는 마지막에 — 겹치면 내가 위에 보여야 한다
  const tags = [];
  for (const o of list) {
    const cy = yOf(o.stairs | 0);
    const dx = 자리잡기(cy);
    if (dx === null) continue;                 // 앞사람 뒤에 완전히 가려진다
    tags.push(drawRacer({
      charId: o.characterId, slot: o.slot, revives: o.revives | 0,
      cy, dx, alive: o.alive !== false, rank: rank[o.id],
      countdown: reviveLeft(o, now) }));
  }
  tags.push(drawRacer({
    charId: scene.charId, slot: scene.mySlot, revives: scene.myRevives | 0,
    cy: RACE_CY, alive: true, rank: rank[scene.multi?.myUid], isMe: true }));
  /**
   * 등수는 **얼굴을 다 그린 뒤에** 찍는다. 가까이 붙은 사람들은 서로 비켜서 있어서
   * 먼저 찍으면 옆 사람 상자에 깔린다(미리보기로 확인).
   */
  for (const t of tags) drawRankTag(t.rank, t.x, t.y, t.dx !== 0, t.dead);
}

/**
 * 지금 순위 — **인게임 표시는 정산과 같은 계산을 써야** 한다.
 * 화면에서 1등이던 사람이 결과에서 2등이면 그건 그냥 거짓말이다.
 */
function rankOf(scene) {
  const room = scene.room;
  /**
   * ★ **방 스냅샷마다 한 번만 센다.** (2026-08-19 8차)
   *
   * `rankPlayers` 는 정렬 + `outOfRound`/`isStale`/`reviveExpired` 판정까지 도는
   * **정산 로직**이다. 그게 렌더 안에 있어서 초당 60번 돌았다 — 그런데 방 스냅샷은
   * 초당 최대 13회만 온다(진행도 300ms 스로틀). 나머지 47번은 같은 답을 다시 구한 것이다.
   * 인당 객체 스프레드까지 하므로 GC 압력도 여기서 제일 컸다.
   */
  if (scene.rankRoom !== room) {
    scene.rankRoom = room;
    const players = room?.players ?? {};
    const order = rankPlayers(
      Object.entries(players).filter(([, v]) => !v?.waiting).map(([uid, v]) => ({ uid, ...v })),
      Date.now() + serverOffsetSync()
    );
    const out = {};
    order.forEach((uid, i) => { out[uid] = i + 1; });
    scene.rankMap = out;
  }
  return scene.rankMap;
}

/**
 * 죽은 사람의 남은 부활 시간(초). 살아 있거나 이미 포기했으면 `null`.
 *
 * 이 숫자가 있어야 **"쟤가 곧 20칸 앞에서 튀어나온다"**는 긴장이 생긴다.
 * 기준은 서버가 찍은 `deadAt` 이라 모두의 화면에서 같은 초가 흐른다.
 */
function reviveLeft(p, now) {
  if (p.alive !== false || p.out || !p.deadAt) return null;
  if (!canRevive(p)) return null;
  const 남음 = Math.ceil((p.deadAt + MULTI.reviveWindowSeconds * 1000 - now) / 1000);
  return 남음 > 0 ? Math.min(MULTI.reviveWindowSeconds, 남음) : null;
}

/**
 * 한 사람 — 얼굴 + **6칸으로 나뉜 3도트 테두리** + 등수.
 *
 * 테두리 칸이 곧 남은 부활 횟수다. 한 번 쓸 때마다 한 칸이 어두워지므로,
 * 상대의 테두리만 봐도 "쟤는 이제 두 번 남았다"가 읽힌다.
 * 죽어 있는 동안에는 **얼굴이 회색이 되고 그 위에 남은 초가 뜬다.**
 */
function drawRacer({ charId, slot, revives, cy, alive, rank, isMe = false, countdown = null, dx = 0 }) {
  const i = Math.max(0, Math.min(SLOT_COLORS.length - 1, slot | 0));
  /**
   * ★ **죽어서 부활을 고르는 동안은 자리 색을 버리고 회색이 된다.** (2026-08-19, 사용자 요청)
   *
   * 예전에는 얼굴만 흐려지고 테두리는 여전히 쨍한 자리 색이라 **죽은 티가 안 났다.**
   * 이 게이지에서 색은 "살아서 뛰는 사람"의 표시다 — 색이 빠지면 그 자체로 신호가 된다.
   * 부활하면 `countdown` 이 사라지면서 제 색이 곧바로 돌아온다.
   */
  const 죽음 = countdown != null;
  const on = 죽음 ? PAL.deadGray : SLOT_COLORS[i];
  const off = 죽음 ? PAL.textShadow : SLOT_DIM[i];
  const x = RACE_CX - (CELL >> 1) + dx;
  const y = Math.round(cy) - (CELL >> 1);

  /**
   * ★ **남의 상자에는 1도트 검은 테두리를 더 두른다.** (2026-08-19)
   * 배경(하늘·건물)이 밝으면 노랑·초록이 묻힌다. 내 상자는 흰 테두리라 이미 또렷하다.
   */
  if (!isMe) {
    rect(x - 1, y - 1, CELL + 2, 1, PAL.textShadow);
    rect(x - 1, y + CELL, CELL + 2, 1, PAL.textShadow);
    rect(x - 1, y, 1, CELL, PAL.textShadow);
    rect(x + CELL, y, 1, CELL, PAL.textShadow);
  }

  // 바탕 — 얼굴이 없을 때도 자리가 보여야 한다
  rect(x + BORDER, y + BORDER, FACE, FACE, PAL.panelDark);
  const face = img(`${charId}_face`);
  const ctx = getCtx2d();
  if (face && ctx) {
    ctx.save();
    ctx.globalAlpha = alive ? 1 : 0.35;
    ctx.drawImage(face, x + BORDER, y + BORDER);
    ctx.restore();
  }
  // 죽어 있으면 얼굴을 회색으로 덮는다 — "지금 부활을 고르는 중"이 한눈에 보인다
  if (!alive) fadeRect(x + BORDER, y + BORDER, FACE, FACE, PAL.textShadow, 0.55);

  /**
   * 6칸 테두리 — 위 2칸, 오른쪽 1칸, 아래 2칸, 왼쪽 1칸.
   * 시계 방향으로 **왼쪽 위부터** 채운다(남은 칸이 앞쪽에 몰려 있어야 세기 쉽다).
   */
  /**
   * 칸 좌표는 **상자 기준 상대값**이라 사람마다 같다 — 모듈 상수로 한 번만 만든다.
   * (예전엔 인당 배열 7개를 새로 만들어 4인이면 프레임당 28개였다)
   */
  const 남은칸 = Math.max(0, MULTI.maxRevives - revives);
  for (let n = 0; n < SEGS.length; n++) {
    const [dx0, dy0, sw, sh] = SEGS[n];
    rect(x + dx0, y + dy0, sw, sh, n < 남은칸 ? on : off);
  }
  /**
   * 칸 사이 1도트 구분선. 없으면 테두리가 그냥 한 줄로 보여서 **몇 칸 남았는지 셀 수가 없다**
   * (미리보기로 확인했다). 이 구분선이 "6칸짜리 목숨"이라는 걸 읽히게 만든다.
   */
  const cut = PAL.textShadow;
  rect(x + HALF, y, 1, BORDER, cut);
  rect(x + HALF, y + CELL - BORDER, 1, BORDER, cut);
  rect(x + CELL - BORDER, y, BORDER, 1, cut);
  rect(x + CELL - BORDER, y + CELL - 1, BORDER, 1, cut);
  rect(x, y, BORDER, 1, cut);
  rect(x, y + CELL - 1, BORDER, 1, cut);

  // 내 얼굴은 한 도트 더 밝은 테두리를 덧대 "이게 나"를 못 놓치게
  if (isMe) {
    rect(x - 1, y - 1, CELL + 2, 1, PAL.text);
    rect(x - 1, y + CELL, CELL + 2, 1, PAL.text);
    rect(x - 1, y, 1, CELL, PAL.text);
    rect(x + CELL, y, 1, CELL, PAL.text);
  }

  // 남은 부활 시간 — 얼굴 위에 크게
  if (countdown != null) {
    textCached(String(countdown), x + (CELL >> 1), y + 6, {
      color: PAL.text, outline: PAL.textShadow, align: 'center', mono: true, scale: 1 });
  }

  return { rank, x, y, dx, dead: countdown != null };
}

/**
 * 등수 — 얼굴 왼쪽. **1등만 다르게 생겼다.**
 *
 * 1등은 11px 볼드 흰색 + 검은 외곽선 + 머리 위 왕관, 나머지는 7px 노랑.
 * 크기와 색이 다르면 숫자를 읽기 전에 "쟤가 1등"이 먼저 보인다.
 */
function drawRankTag(rank, x, y, 겹침, dead = false) {
  if (!rank) return;
  /**
   * ★ **죽어서 카운트다운 중이면 등수 글자도 회색 + 2단계 더 작게.** (2026-08-19)
   * 얼굴이 이미 회색으로 죽었다는 걸 보여 주는데 등수만 11px 흰색으로 크게 남으면
   * "지금 부활을 고르는 중"이라는 신호가 약해진다. 7px 소문자 폰트가 이 저장소의
   * 최소 크기라 "2단계 작게"는 곧 1등 전용 11px 볼드를 포기하고 이 폰트로 내리는 것이다.
   */
  const 일등 = rank === 1 && !dead;
  const label = S.rankTag(rank);
  const cy = y + (CELL >> 1);
  /**
   * 옆으로 비켜선 사람은 **상자 위**에 붙인다 — 왼쪽에는 이미 다른 사람이 서 있다.
   */
  const px = 겹침 ? x + (CELL >> 1) : x - 2;
  const py = 겹침 ? y - (일등 ? 12 : 8) : cy - (일등 ? 5 : 3);
  const align = 겹침 ? 'center' : 'right';
  if (일등) {
    crown(겹침 ? px - 2 : x - 12, py - 7);
    textCached(label, px, py, { color: '#FFFFFF', outline: PAL.textShadow, align, scale: 1 });
  } else if (dead) {
    textCached(label, px, py, {
      color: PAL.deadGray, outline: PAL.textShadow, align, small: true, scale: 1 });
  } else {
    textCached(label, px, py, {
      color: PAL.gaugeWarn, outline: PAL.textShadow, align, small: true, scale: 1 });
  }
}

/** 왕관 5×4 — 1등 글씨 위 (도트로 직접 찍는다, 에셋 하나 더 받을 이유가 없다) */
function crown(x, y) {
  const gold = PAL.gaugeWarn;
  rect(x, y + 1, 1, 3, gold);
  rect(x + 4, y + 1, 1, 3, gold);
  rect(x + 2, y, 1, 4, gold);
  rect(x, y + 3, 5, 1, gold);
  rect(x + 1, y + 2, 1, 2, gold);
  rect(x + 3, y + 2, 1, 2, gold);
}

/** 반투명 사각형 — 죽은 얼굴을 회색으로 덮을 때만 쓴다 */
function fadeRect(x, y, w, h, color, alpha) {
  const ctx = getCtx2d();
  if (!ctx) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  rect(x, y, w, h, color);
  ctx.restore();
}

/**
 * ★ **계단 숫자 바로 아래 — 1등과의 거리.** (2026-08-19)
 *
 * 오른쪽 게이지가 "누가 위냐"를 보여 준다면 이 줄은 **몇 칸을 따라잡아야 하는지**를
 * 숫자로 못 박는다. 1등이면 "1등 유지중" — 지켜야 할 것이 있다는 신호다.
 */
function drawGapLine(scene) {
  if (scene.countdownMs > 0) return;
  const room = scene.room;
  if (!room) return;
  /**
   * 1등 계단 수도 **방이 바뀔 때만** 다시 구한다 (판돈 줄과 같은 이유).
   * 내 계단 수는 매 프레임 바뀌므로 뺄셈만 남긴다 — 그건 공짜다.
   */
  if (scene.gapRoom !== room) {
    scene.gapRoom = room;
    let top = 0;
    for (const v of Object.values(room.players ?? {})) {
      if (v?.waiting) continue;
      if ((v?.stairs ?? 0) > top) top = v.stairs ?? 0;
    }
    scene.gapTop = top;
  }
  const 차이 = (scene.gapTop | 0) - (scene.floor | 0);
  /**
   * 7px + 그림자 → **11px + 외곽선** (2026-08-19 사용자 요청).
   * 외곽선은 글리프를 8방향으로 한 번 더 찍으므로 배경색이 무엇이든 글자가 뜬다.
   * 폭은 미리 쟀다: `1등까지 15계단 남음` = 112px < 180. (tools/_measure.mjs)
   */
  textCached(차이 > 0 ? S.gapFromFirst(차이) : S.keepingFirst, CENTER_X, GAP_Y, {
    color: 차이 > 0 ? PAL.gaugeWarn : PAL.text, align: 'center', outline: PAL.textShadow,
  });
}

// ─────────────────────────────────────────────
// 4) 판돈 · 알림 · 카운트다운
// ─────────────────────────────────────────────

/**
 * 계단 숫자 바로 위 — 지금 이 판에 얼마가 걸려 있는지.
 * 값은 **방이 바뀔 때만** 다시 센다(매 프레임 세면 참가자·항아리를 60번/초 훑는다).
 */
function drawPot(scene) {
  const room = scene.room;
  if (!room) return;
  /**
   * ★ 캐시 열쇠에 **내가 주운 수**도 넣는다. (2026-08-19)
   * 예전엔 `room` 객체가 바뀔 때만 다시 계산해서, **내가 신발을 주워도 방 스냅샷이
   * 올 때까지(최대 300ms + 왕복) 숫자가 안 움직였다.** 판이 커지는 걸 즉시 보여 주는 게
   * 이 줄의 존재 이유라 그 지연은 그대로 손해다.
   */
  const mine = scene.shoesFound | 0;
  if (scene.potRoom !== room || scene.potMine !== mine) {
    scene.potRoom = room;
    scene.potMine = mine;
    scene.potText = S.potLine(potShoes(room, { uid: scene.multi?.myUid, shoesFound: mine }));
  }
  if (!scene.potText) return;
  /**
   * ★ **7px + 외곽선**, 화면 정중앙. (2026-08-19 14차, 사용자 지정)
   * *"폰트 크기를 2단계만 줄여"* — 이 저장소의 글자 단계는 2px 이고(§9-0-31),
   * 인게임 폰트는 11px·7px 두 벌뿐이라(§3-1) **11 → 7 이 정확히 두 단계**다.
   * 외곽선은 그대로 둔다 — 하늘·건물 어느 배경 위에서도 획이 서야 한다.
   */
  textCached(scene.potText, POT_CX, POT_Y, {
    color: PAL.text, align: 'center', outline: PAL.textShadow, small: true });
}

/**
 * 낙사·부활 알림 — 화면 아래쪽 고정 자리에서 **위에서 아래로** 쌓인다.
 *
 * 문구가 화면(180)보다 길면 **잘리는 게 아니라 접힌다.** "상대폰님이 신발 20개를 걸고
 * 20칸 앞으로 부활했습니다" 는 7px 로도 206px 라 한 줄에 안 들어간다 —
 * 그렇다고 문구를 줄이면 무슨 일이 일어났는지가 흐려진다.
 */
function drawTicker(scene) {
  const now = Date.now();
  const live = (scene.ticker ?? []).filter((t) => t.until > now);
  if (live.length !== (scene.ticker ?? []).length) scene.ticker = live;

  const lines = [];
  for (const t of live.slice(-2)) {
    // 접는 계산은 메시지당 한 번 — 폭 재기를 매 프레임 돌릴 이유가 없다
    if (!t.lines) t.lines = wrap(t.msg, TICKER_W);
    // 색은 줄마다 들고 다닌다 — 한 화면에 낙사(빨강)와 부활(노랑)이 같이 뜰 수 있다
    for (const line of t.lines) lines.push({ line, color: t.color ?? PAL.text });
  }
  /**
   * ★ **위에서 아래로** 쌓는다. (2026-08-19 14차, 사용자 지정)
   * 목록은 오래된 것이 앞이므로 `i` 를 그대로 더하면 **새 알림이 한 칸 아래**에 붙는다 —
   * *"아무튼 신규 메세지 한칸 아래 뜨게 만들어"*. 윗줄이 고정이라 줄이 몇 개든
   * 글자가 계단·캐릭터 쪽으로 올라오지 않는다.
   */
  lines.slice(-TICKER_ROWS).forEach((it, i) => {
    textCached(it.line, TICKER_CX, TICKER_TOP + i * LINE_H, {
      color: it.color, align: 'center', outline: PAL.textShadow });
  });
}

/** 글자 폭을 재서 접는다 (띄어쓰기 우선, 없으면 글자 단위) */
function wrap(msg, maxW) {
  const words = String(msg).split(' ');
  const out = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    // ★ 알림이 11px 로 커졌으므로 **재는 것도 11px** 이어야 한다 (2026-08-19).
    //   7px 로 재면 안 접히고 게이지 위로 올라탄다.
    if (measure(next, 1, false, false) <= maxW) { cur = next; continue; }
    if (cur) out.push(cur);
    cur = w;
  }
  if (cur) out.push(cur);
  return out;
}

function drawCountdown(scene) {
  const ms = scene.countdownMs ?? 0;
  if (ms <= 0) return;
  const n = Math.ceil(ms / 1000);
  /**
   * 3·2·1 은 숫자로, 0 이 되는 순간만 'GO!'. 기획서 §7 S16 그대로다.
   * 화면 한가운데 크게 — 이때는 계단을 볼 게 아니라 출발 타이밍만 보면 된다.
   */
  // 캐시를 태운다 — 배율 6 + 외곽선이면 글자 하나가 프레임당 fillRect 수백 번이다(§9-0-25)
  textCached(n > 0 ? String(n) : S.go, VIEW_W >> 1, 130, {
    scale: n > 0 ? 6 : 4, color: PAL.text, outline: PAL.textShadow, align: 'center', mono: true });
}

/**
 * ★ **5초 안에 출발하세요.** (2026-08-19 11차, 사용자 지정)
 *
 * 게이지는 **첫 입력부터** 줄기 시작한다(`GameScene.started`). 싱글에서는 "생각할 시간"
 * 이지만 멀티에서는 **가만히 서 있는 것이 공짜**다 — 그동안 상대는 오르다 죽고 부활을
 * 태운다. 부활은 1위보다 20칸 앞에서 살아나므로(`MULTI.reviveAhead`), 상대의 부활 6개가
 * 바닥난 뒤 0계단에서 출발해도 이기는 판이 나온다. 사용자가 신고한 그 전략이다.
 *
 * 그래서 판이 시작되면 곧바로 카운트다운을 보여 준다. **처음부터 보여 주는 이유**는
 * 규칙을 모르는 사람이 없어야 하기 때문이다 — 3초쯤 지나서 뜨면 이미 늦었다고 느낀다.
 * 첫 발을 떼면 그 프레임에 사라진다(`scene.startLeftMs = 0`).
 */
const WARN_BOX = { x: 2, y: 96, w: VIEW_W - 4, h: 64 };

function drawStartWarn(scene) {
  const left = scene.startLeftMs | 0;
  if (left <= 0) return;
  // 배경 위 아무 데나 뜨는 글자는 안 읽힌다 — 어두운 판을 깔고 테두리를 두른다
  rect(WARN_BOX.x, WARN_BOX.y, WARN_BOX.w, WARN_BOX.h, PAL.textShadow);
  rect(WARN_BOX.x, WARN_BOX.y, WARN_BOX.w, 1, PAL.gaugeWarn);
  rect(WARN_BOX.x, WARN_BOX.y + WARN_BOX.h - 1, WARN_BOX.w, 1, PAL.gaugeWarn);

  const cx = VIEW_W >> 1;
  textCached(S.startWithin(MULTI.startWithinSeconds), cx, WARN_BOX.y + 6, {
    color: PAL.gaugeWarn, align: 'center', outline: PAL.textShadow });
  textCached(S.startOrLose, cx, WARN_BOX.y + 20, {
    color: PAL.text, align: 'center', outline: PAL.textShadow });
  // 남은 초는 **올림**이다 — 4.2초 남았는데 4가 뜨면 1초를 손해 본 것처럼 보인다
  textCached(String(Math.ceil(left / 1000)), cx, WARN_BOX.y + 34, {
    scale: 2, color: PAL.gaugeWarn, align: 'center', outline: PAL.textShadow, mono: true });
}

/**
 * 알파 블렌딩이 필요한 곳만 컨텍스트를 직접 만진다.
 * **스무딩은 절대 건드리지 않는다** — `globalAlpha` 는 도트 경계를 흐리지 않는다(§3-1).
 */
const getCtx2d = () => getCtx();
