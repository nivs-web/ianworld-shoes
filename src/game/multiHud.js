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
const RACE_CY = 150;                     // **나는 여기서 절대 안 움직인다**
const TICK_GAP = 9;                      // 눈금 간격

/** 등수 글씨는 얼굴 상자 왼쪽에 */
const RANK_X = RACE_CX - (CELL >> 1) - 3;
/** 1등 말풍선 */
const BUBBLE = { w: 38, h: 24 };

/** 판돈 줄 — 조작 버튼(266~314) 위 */
const POT_Y = 252;
/** 알림은 판돈 바로 위에서 위로 쌓인다 */
const TICKER_Y = 232;
/**
 * 알림은 **레이스 게이지를 피해** 왼쪽에만 쓴다.
 * 게이지는 오른쪽 세로 기둥(150~178)을 위아래로 통째로 쓰기 때문에,
 * 가운데 정렬로 두면 글자가 눈금·얼굴 위로 올라탄다(미리보기로 확인).
 */
const TICKER_W = RACE_CX - (CELL >> 1) - 6;
const TICKER_CX = TICKER_W >> 1;

/** 상대 캐릭터 스프라이트는 내 것과 다르다 — 처음 보이는 순간에 받아 둔다 */
const requested = new Set();
function ensureAssets(list) {
  const want = [];
  // 1등 말풍선 — 멀티에서만 쓰는 그림이라 여기서 같이 받는다
  if (!requested.has('bubble')) {
    requested.add('bubble');
    want.push({ key: 'bubble_first', url: '/assets/ui/bubble_first.png' });
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
export function multiHud(scene) {
  if (!smallReady()) loadSmallFont();
  const list = (scene.opponents ?? []).slice(0, 3);
  // 상대 목록 객체는 방 갱신 때만 새로 만들어진다 — 그때만 에셋을 확인하면 된다
  if (scene.assetsFor !== scene.opponents) { scene.assetsFor = scene.opponents; ensureAssets(list); }

  drawGhosts(scene, list);
  drawFirstBubble(scene, list);
  drawRaceGauge(scene, list);
  drawPot(scene);
  drawTicker(scene);
  drawCountdown(scene);
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
   * ★ **겹치면 왼쪽으로 비켜 세운다.** (2026-08-19)
   * 눈금 간격은 9도트인데 얼굴 상자는 22도트다 — 20칸 안쪽으로 붙으면 서로를 가린다.
   * 자리는 **내가 항상 맨 오른쪽**이고, 늦게 놓이는 사람이 한 칸씩 왼쪽으로 물러난다.
   */
  const 놓인자리 = [{ y: RACE_CY }];
  const 비켜서기 = (y) => {
    const n = 놓인자리.filter((p) => Math.abs(p.y - y) < CELL).length;
    놓인자리.push({ y });
    return n * (CELL - 4);
  };

  // 상대 먼저, 나는 마지막에 — 겹치면 내가 위에 보여야 한다
  const tags = [];
  for (const o of list) {
    const cy = yOf(o.stairs | 0);
    tags.push(drawRacer({
      charId: o.characterId, slot: o.slot, revives: o.revives | 0,
      cy, dx: -비켜서기(cy), alive: o.alive !== false, rank: rank[o.id],
      countdown: reviveLeft(o, now),
    }));
  }
  tags.push(drawRacer({
    charId: scene.charId, slot: scene.mySlot, revives: scene.myRevives | 0,
    cy: RACE_CY, alive: true, rank: rank[scene.multi?.myUid], isMe: true,
  }));
  /**
   * 등수는 **얼굴을 다 그린 뒤에** 찍는다. 가까이 붙은 사람들은 서로 비켜서 있어서
   * 먼저 찍으면 옆 사람 상자에 깔린다(미리보기로 확인).
   */
  for (const t of tags) drawRankTag(t.rank, t.x, t.y, t.dx !== 0);
}

/**
 * 지금 순위 — **인게임 표시는 정산과 같은 계산을 써야** 한다.
 * 화면에서 1등이던 사람이 결과에서 2등이면 그건 그냥 거짓말이다.
 */
function rankOf(scene) {
  const players = scene.room?.players ?? {};
  const order = rankPlayers(
    Object.entries(players).filter(([, v]) => !v?.waiting).map(([uid, v]) => ({ uid, ...v })),
    Date.now() + serverOffsetSync()
  );
  const out = {};
  order.forEach((uid, i) => { out[uid] = i + 1; });
  return out;
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
  const on = SLOT_COLORS[i];
  const off = SLOT_DIM[i];
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
  const half = CELL >> 1;                       // 11
  const segs = [
    [x, y, half, BORDER],                              // 위 왼쪽
    [x + half, y, CELL - half, BORDER],                // 위 오른쪽
    [x + CELL - BORDER, y, BORDER, CELL],              // 오른쪽
    [x + half, y + CELL - BORDER, CELL - half, BORDER],// 아래 오른쪽
    [x, y + CELL - BORDER, half, BORDER],              // 아래 왼쪽
    [x, y, BORDER, CELL],                              // 왼쪽
  ];
  const 남은칸 = Math.max(0, MULTI.maxRevives - revives);
  segs.forEach(([sx, sy, sw, sh], n) => rect(sx, sy, sw, sh, n < 남은칸 ? on : off));
  /**
   * 칸 사이 1도트 구분선. 없으면 테두리가 그냥 한 줄로 보여서 **몇 칸 남았는지 셀 수가 없다**
   * (미리보기로 확인했다). 이 구분선이 "6칸짜리 목숨"이라는 걸 읽히게 만든다.
   */
  const cut = PAL.textShadow;
  rect(x + half, y, 1, BORDER, cut);
  rect(x + half, y + CELL - BORDER, 1, BORDER, cut);
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
      color: PAL.text, outline: PAL.textShadow, align: 'center', mono: true, scale: 1,
    });
  }

  return { rank, x, y, dx };
}

/**
 * 등수 — 얼굴 왼쪽. **1등만 다르게 생겼다.**
 *
 * 1등은 11px 볼드 흰색 + 검은 외곽선 + 머리 위 왕관, 나머지는 7px 노랑.
 * 크기와 색이 다르면 숫자를 읽기 전에 "쟤가 1등"이 먼저 보인다.
 */
function drawRankTag(rank, x, y, 겹침) {
  if (!rank) return;
  const 일등 = rank === 1;
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
  } else {
    textCached(label, px, py, {
      color: PAL.gaugeWarn, outline: PAL.textShadow, align, small: true, scale: 1,
    });
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

// ─────────────────────────────────────────────
// 3) 1등 말풍선 — 계단 위 1등 머리 위에 따라다닌다
// ─────────────────────────────────────────────

/**
 * ★ **1등 머리 위에만 "1등이닷".** (2026-08-19)
 *
 * 오른쪽 게이지가 "몇 칸 차이"를 알려 준다면, 이 말풍선은 **지금 이 순간 누가
 * 앞서는가**를 계단 위에서 바로 알려 준다. 1등을 빼앗기는 순간 사라지므로,
 * 말풍선이 내 머리에서 떨어져 나가는 것만으로 역전당한 걸 안다.
 *
 * 그림은 사용자가 준 `etc/1등이닷.png` 를 빌드 타임에 도트로 구운 것이다
 * (`tools/build-bubble.mjs`). 글씨까지 구워져 있어 매 프레임 글자를 찍지 않는다.
 */
function drawFirstBubble(scene, list) {
  if (scene.countdownMs > 0) return;
  const bubble = img('bubble_first');
  if (!bubble) return;
  const ctx = getCtx2d();
  if (!ctx) return;

  const rank = rankOf(scene);
  const myUid = scene.multi?.myUid;
  if (rank[myUid] === 1) {
    // 내 캐릭터는 항상 화면 가운데 발끝 기준이다
    return drawBubbleAt(ctx, bubble, CENTER_X, CHAR.footY - CHAR.h);
  }
  const 일등 = list.find((o) => rank[o.id] === 1);
  if (!일등) return;

  const stairs = scene.stairs;
  if (!stairs) return;
  const camX = stairs.worldX(scene.floor) + ((stairs.nextDir(scene.floor) * STAIR.gapX) >> 1);
  const floor = 일등.stairs | 0;
  const footY = CHAR.footY - (floor - scene.floor) * STAIR.gapY;
  if (footY < 0 || footY > VIEW_H) return;          // 화면 밖이면 게이지가 맡는다
  stairs.ensure?.(floor + 1);
  const cx = stairs.worldX(floor) - camX + CENTER_X;
  drawBubbleAt(ctx, bubble, cx, footY - CHAR.h);
}

/** 머리 위 왼쪽 — 꼬리가 머리를 가리키게 (참고 이미지와 같은 배치) */
function drawBubbleAt(ctx, bubble, headCx, headTop) {
  const x = Math.round(headCx) - BUBBLE.w + 6;
  const y = Math.round(headTop) - BUBBLE.h - 1;
  ctx.drawImage(bubble, Math.max(1, Math.min(VIEW_W - BUBBLE.w - 1, x)), Math.max(1, y));
}

// ─────────────────────────────────────────────
// 4) 판돈 · 알림 · 카운트다운
// ─────────────────────────────────────────────

/**
 * 화면 하단 고정 — 지금 이 판에 얼마가 걸려 있는지.
 * 값은 **방이 바뀔 때만** 다시 센다(매 프레임 세면 참가자·항아리를 60번/초 훑는다).
 */
function drawPot(scene) {
  const room = scene.room;
  if (!room) return;
  if (scene.potRoom !== room) { scene.potRoom = room; scene.potText = S.potLine(potShoes(room)); }
  if (!scene.potText) return;
  textCached(scene.potText, CENTER_X, POT_Y, {
    color: PAL.text, align: 'center', small: true, shadow: PAL.textShadow,
  });
}

/**
 * 낙사·부활 알림 — 판돈 줄 위에서 **아래에서 위로** 쌓이고 시간이 지나면 사라진다.
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
    lines.push(...t.lines);
  }
  lines.slice(-3).forEach((line, i, arr) => {
    textCached(line, TICKER_CX, TICKER_Y - (arr.length - 1 - i) * 9, {
      color: PAL.text, align: 'center', small: true, shadow: PAL.textShadow,
    });
  });
}

/** 글자 폭을 재서 접는다 (띄어쓰기 우선, 없으면 글자 단위) */
function wrap(msg, maxW) {
  const words = String(msg).split(' ');
  const out = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next, 1, false, true) <= maxW) { cur = next; continue; }
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
    scale: n > 0 ? 6 : 4, color: PAL.text, outline: PAL.textShadow, align: 'center', mono: true,
  });
}

/**
 * 알파 블렌딩이 필요한 곳만 컨텍스트를 직접 만진다.
 * **스무딩은 절대 건드리지 않는다** — `globalAlpha` 는 도트 경계를 흐리지 않는다(§3-1).
 */
const getCtx2d = () => getCtx();
