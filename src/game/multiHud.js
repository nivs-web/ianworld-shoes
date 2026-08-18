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
import { potShoes, slotIndex } from '../services/matchRules.js';
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

  // 상대 먼저, 나는 마지막에 — 겹치면 내가 위에 보여야 한다
  for (const o of list) {
    drawRacer(o.characterId, o.slot, o.revives | 0, yOf(o.stairs | 0), o.alive !== false);
  }
  drawRacer(scene.charId, scene.mySlot, scene.myRevives | 0, RACE_CY, true, true);
}

/**
 * 한 사람 — 얼굴 + **6칸으로 나뉜 3도트 테두리.**
 *
 * 테두리 칸이 곧 남은 부활 횟수다. 한 번 쓸 때마다 한 칸이 어두워지므로,
 * 상대의 테두리만 봐도 "쟤는 이제 두 번 남았다"가 읽힌다. 숫자로 쓰면 읽는 데
 * 시간이 걸리고, 뛰면서는 아무도 안 읽는다.
 */
function drawRacer(charId, slot, revives, cy, alive, isMe = false) {
  const i = Math.max(0, Math.min(SLOT_COLORS.length - 1, slot | 0));
  const on = SLOT_COLORS[i];
  const off = SLOT_DIM[i];
  const x = RACE_CX - (CELL >> 1);
  const y = Math.round(cy) - (CELL >> 1);

  // 바탕 — 얼굴이 없을 때도 자리가 보여야 한다
  rect(x + BORDER, y + BORDER, FACE, FACE, PAL.panelDark);
  const face = img(`${charId}_face`);
  if (face) {
    const ctx = getCtx2d();
    if (ctx) {
      ctx.save();
      ctx.globalAlpha = alive ? 1 : 0.35;
      ctx.drawImage(face, x + BORDER, y + BORDER);
      ctx.restore();
    }
  }

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
