/**
 * 멀티 전용 인게임 표시 — **상대가 어디까지 올라갔는지 눈으로 보게 한다.** (2026-08-18)
 *
 * 인게임은 전부 캔버스다 (CLAUDE.md §6-3). DOM 오버레이를 얹으면 도트가 깨진다.
 *
 * ## 왜 숫자만으로는 부족했나
 *
 * 예전에는 상대를 **이름 + 숫자 두 개**로만 보여 줬다. 정보로는 충분한데 **역전당하는
 * 순간이 안 보인다.** 이 게임의 재미는 "쟤가 내 앞으로 튀어나왔다 → 다시 뒤집는다" 인데,
 * 숫자가 조용히 바뀌는 걸로는 그 감정이 안 생긴다.
 *
 * ## 세 겹으로 보여 준다
 *
 * 멀티는 **전원이 같은 시드**로 계단을 만든다. 그래서 상대의 층수 하나만 알면
 * **그 사람이 서 있는 계단의 좌표를 내 화면에서 그대로 계산할 수 있다** —
 * 서버에서 좌표를 받을 필요가 전혀 없다.
 *
 *   1. 화면 안이면        → 반투명 **고스트 캐릭터** + 머리 위 이름표
 *   2. 세로는 보이는데 가로가 밖 → 좌/우 가장자리에 **화살표 + 이름**
 *   3. 세로도 밖이면      → 오른쪽 **레이스 바**에 점으로 (항상 보인다)
 *
 * 레이스 바가 핵심이다 — 화면 밖에 있어도 "지금 누가 앞이냐"가 한눈에 들어온다.
 *
 * ## 글자는 7px 폰트로
 *
 * 11px 하나뿐이던 시절에는 상대 줄 세 개면 계단이 안 보였다. 그리고 그 폰트는
 * **코드에 등장하는 한글만** 굽기 때문에 닉네임이 `??` 로 나왔다(실측). 7px 폰트는
 * 상용 한글 2,350자를 통째로 담고 있고, 멀티에 들어올 때만 받는다.
 */

import { text, textCached, loadSmallFont, smallReady } from '../core/pixelfont.js';
import { rect } from '../core/sprite.js';
import { img, loadAll } from '../core/assets.js';
import { getCtx } from '../core/canvas.js';
import { PAL } from './palette.js';
import { VIEW_W, VIEW_H, STAIR, CENTER_X, CHAR } from '../config/layout.js';
import { MULTI } from '../config/balance.js';
import { potShoes } from '../services/matchRules.js';
import S from '../config/strings.ko.js';

/** 알림 한 줄이 떠 있는 시간 */
export const TICKER_MS = 3000;

/** 상대 줄 (얼굴 16px + 7px 글자) */
const ROW_Y = 66;
const ROW_H = 17;
/** 레이스 바 */
const BAR_X = VIEW_W - 5;
const BAR_TOP = 70;
const BAR_BOTTOM = 250;
/** 판돈 줄 */
const POT_Y = VIEW_H - 10;

/** 상대 색 — 이름·점·이름표에 같은 색을 써야 누가 누군지 이어진다 */
const TINT = [PAL.goRed, '#6ec6ff', '#ffd24a'];

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
  ensureAssets(list);

  drawGhosts(scene, list);
  drawRaceBar(scene, list);
  drawRows(scene, list);
  drawPot(scene);
  drawTicker(scene);
  drawCountdown(scene);
}

// ─────────────────────────────────────────────
// 1) 계단 위의 상대 — 고스트 + 가장자리 화살표
// ─────────────────────────────────────────────

function drawGhosts(scene, list) {
  if (scene.countdownMs > 0) return;
  const stairs = scene.stairs;
  if (!stairs) return;
  const camX = stairs.worldX(scene.floor) + ((stairs.nextDir(scene.floor) * STAIR.gapX) >> 1);
  const ctx = getCtx2d();

  list.forEach((o, i) => {
    const floor = o.stairs | 0;
    const color = TINT[i % TINT.length];
    const dy = (floor - scene.floor) * STAIR.gapY;
    const footY = CHAR.footY - dy;

    // 세로로 화면 밖이면 레이스 바가 맡는다
    if (footY < -20 || footY > VIEW_H + 20) return;

    stairs.ensure?.(floor + 1);
    const cx = stairs.worldX(floor) - camX + CENTER_X;
    const sprite = img(`${o.characterId}_front`);

    if (cx > 8 && cx < VIEW_W - 8) {
      // 화면 안 — 반투명 고스트. 내 캐릭터보다 작게(1×) 그려 "저기 있다"가 바로 읽힌다
      if (sprite && ctx) {
        const w = CHAR.w, h = CHAR.h;
        const dx = Math.round(cx - (w >> 1));
        const top = Math.round(footY - h);
        ctx.save();
        ctx.globalAlpha = o.alive === false ? 0.25 : 0.6;
        ctx.drawImage(sprite, 0, 0, w, h, dx, top, w, h);
        ctx.restore();
        nameTag(o.nickname, Math.round(cx), top - 8, color);
      } else {
        rect(Math.round(cx) - 3, Math.round(footY) - 6, 6, 6, color);
        nameTag(o.nickname, Math.round(cx), Math.round(footY) - 16, color);
      }
    } else {
      // 가로로 밖 — 가장자리에 화살표만 (어느 쪽에 있는지가 정보다)
      const left = cx <= 8;
      const ax = left ? 3 : VIEW_W - 4;
      const ay = Math.max(8, Math.min(VIEW_H - 12, Math.round(footY) - 8));
      rect(ax - 2, ay, 5, 5, color);
      text(left ? '<' : '>', left ? ax + 5 : ax - 5, ay - 1, {
        color, small: true, align: left ? 'left' : 'right',
      });
    }
  });
}

function nameTag(name, cx, y, color) {
  const s = String(name ?? '').slice(0, 5);
  if (!s) return;
  text(s, cx, Math.max(2, y), { color, align: 'center', small: true, shadow: PAL.textShadow });
}

// ─────────────────────────────────────────────
// 2) 레이스 바 — 화면 밖이어도 순위가 보인다
// ─────────────────────────────────────────────

/**
 * 오른쪽 세로 막대에 **나와 상대의 상대 위치**를 점으로 찍는다.
 * 절대 층수가 아니라 **이번 판의 최저~최고 구간**을 늘려 그린다 —
 * 격차가 3칸이든 300칸이든 "누가 위냐"가 같은 크기로 보여야 한다.
 */
function drawRaceBar(scene, list) {
  if (!list.length) return;
  const floors = [scene.floor, ...list.map((o) => o.stairs | 0)];
  const lo = Math.min(...floors);
  const hi = Math.max(...floors);
  const span = Math.max(1, hi - lo);

  rect(BAR_X, BAR_TOP, 2, BAR_BOTTOM - BAR_TOP, PAL.textShadow);

  const yOf = (f) => BAR_BOTTOM - Math.round(((f - lo) / span) * (BAR_BOTTOM - BAR_TOP));

  list.forEach((o, i) => {
    const y = yOf(o.stairs | 0);
    rect(BAR_X - 2, y - 1, 6, 3, TINT[i % TINT.length]);
  });
  // 내 점은 흰색 + 한 도트 크게 — 내가 어디 있는지 먼저 보여야 한다
  const my = yOf(scene.floor);
  rect(BAR_X - 3, my - 2, 8, 5, PAL.text);
}

// ─────────────────────────────────────────────
// 3) 상대 줄 — 얼굴 + 작은 이름 + 층수
// ─────────────────────────────────────────────

function drawRows(scene, list) {
  if (!list.length) return;
  // 계단이 높은 순 — 지금 누가 앞서는지가 한눈에 보여야 한다
  const sorted = list.map((o, i) => ({ ...o, tint: TINT[i % TINT.length] }))
    .sort((a, b) => (b.stairs ?? 0) - (a.stairs ?? 0));

  sorted.forEach((o, i) => {
    const y = ROW_Y + i * ROW_H;
    const 살아있다 = o.alive !== false;
    const color = 살아있다 ? o.tint : PAL.textShadow;

    const face = img(`${o.characterId}_face`);
    if (face) drawFace(face, 3, y, 살아있다);
    else rect(3, y, 16, 16, PAL.panelDark);

    // 이름은 7px — 예전 11px 로는 세 줄이 화면을 다 먹었다
    text(String(o.nickname ?? '').slice(0, 5), 22, y + 1, { scale: 1, color, small: true });
    textCached(S.multiOpponentStat(o.shoesFound ?? 0, o.stairs ?? 0), VIEW_W - 10, y + 1, {
      scale: 1, color, align: 'right', mono: true, small: true,
    });
    // 부활 횟수 — 저 사람이 이 판에 얼마를 걸었는지가 곧 위협의 크기다
    if (o.revives) {
      text(`+${o.revives * MULTI.reviveCost}`, 22, y + 9, { scale: 1, color: PAL.goRed, small: true });
    }
  });
}

/** 죽은 사람 얼굴은 어둡게 — 지금 누가 부활을 고민 중인지 보인다 */
function drawFace(face, x, y, alive) {
  const ctx = getCtx2d();
  if (!ctx) return;
  ctx.save();
  ctx.globalAlpha = alive ? 1 : 0.35;
  ctx.drawImage(face, x, y);
  ctx.restore();
}

// ─────────────────────────────────────────────
// 4) 판돈 · 알림 · 카운트다운
// ─────────────────────────────────────────────

/** 화면 맨 아래 고정 — 지금 이 판에 얼마가 걸려 있는지 */
function drawPot(scene) {
  const room = scene.room;
  if (!room) return;
  const n = potShoes(room);
  if (!n) return;
  text(S.potLine(n), CENTER_X, POT_Y, {
    color: PAL.text, align: 'center', small: true, shadow: PAL.textShadow,
  });
}

/** 낙사·부활 알림 — 위에서부터 쌓이고 시간이 지나면 사라진다 */
function drawTicker(scene) {
  const now = Date.now();
  const live = (scene.ticker ?? []).filter((t) => t.until > now);
  if (live.length !== (scene.ticker ?? []).length) scene.ticker = live;
  live.slice(-2).forEach((t, i) => {
    text(t.msg, CENTER_X, POT_Y - 22 + i * 9, {
      color: PAL.text, align: 'center', small: true, shadow: PAL.textShadow,
    });
  });
}

function drawCountdown(scene) {
  const ms = scene.countdownMs ?? 0;
  if (ms <= 0) return;
  const n = Math.ceil(ms / 1000);
  /**
   * 3·2·1 은 숫자로, 0 이 되는 순간만 'GO!'. 기획서 §7 S16 그대로다.
   * 화면 한가운데 크게 — 이때는 계단을 볼 게 아니라 출발 타이밍만 보면 된다.
   */
  text(n > 0 ? String(n) : S.go, VIEW_W >> 1, 130, {
    scale: n > 0 ? 6 : 4, color: PAL.text, outline: PAL.textShadow, align: 'center', mono: true,
  });
}

/**
 * 알파 블렌딩이 필요한 곳만 컨텍스트를 직접 만진다.
 * **스무딩은 절대 건드리지 않는다** — `globalAlpha` 는 도트 경계를 흐리지 않는다(§3-1).
 */
const getCtx2d = () => getCtx();
