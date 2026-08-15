/**
 * 플레이어 상태머신.
 *
 * INTRO  게임 시작 연출 — 정면 0.5초 → 1.2배 팝 → 0.3초 대기 → 계단 방향으로 전환
 * IDLE   계단 위에서 방향 컷으로 대기
 * EFFECT 상승 직후 — 번개 이펙트 컷 + 3단 스텝 상승 (기획서 §9-2 "이펙트 캐릭터 컷")
 * STARE  사망 확정 — 정면 보고 잠깐 커짐
 * FALL   신발이 좌우로 튕겨나가고 맨발로 낙하
 * DEAD   낙하 종료
 *
 * 스프라이트는 CHAR.scale(=2) 정수 배율로 확대해 그린다. 좌표는 전부 정수, 보간 없음.
 */

import { ANIM } from '../config/balance.js';
import { CHAR, CENTER_X, SHOE } from '../config/layout.js';
import { img } from '../core/assets.js';
import { getCtx } from '../core/canvas.js';
import { drawScaled, drawScaledFlipped, drawFrameAt, drawFrameAtFlipped } from '../core/sprite.js';
import shoesData from '../data/shoes.json';

export const P_STATE = { INTRO: 0, IDLE: 1, EFFECT: 2, STARE: 3, FALL: 4, DEAD: 5 };

/** 인트로 타임라인 (프레임, 60fps) */
const INTRO = {
  frontHold: 30, // 0.5초 정면
  popUp: 5, // 1.2배
  popDown: 4, // 원래 크기로
  wait: 18, // 0.3초 대기
};
const INTRO_TOTAL = INTRO.frontHold + INTRO.popUp + INTRO.popDown + INTRO.wait;

export class Player {
  /** @param {string} charId */
  constructor(charId) {
    this.charId = charId;
    this.facing = 1;
    this.state = P_STATE.INTRO;
    this.introT = 0;
    this.timer = 0;
    this.shoe = null;
    this.popLeft = 0;
    this.fallY = 0;
    this.fallVy = 0;
    this.flyL = { x: 0, y: 0, vx: 0, vy: 0 };
    this.flyR = { x: 0, y: 0, vx: 0, vy: 0 };
    this.deadShoe = null;
    /** 인트로가 끝나면 이 방향을 본다 (GameScene이 설정) */
    this.introFacing = 1;
  }

  get inIntro() {
    return this.state === P_STATE.INTRO;
  }

  /**
   * 방향 전환. 이펙트 컷 재생 중에도 받아야 한다 —
   * 막으면 이펙트 길이만큼 입력이 씹혀서 "착착착" 리듬이 끊긴다.
   */
  turn() {
    if (this.state !== P_STATE.IDLE && this.state !== P_STATE.EFFECT) return;
    this.facing = -this.facing;
  }

  climb(newFacing) {
    this.facing = newFacing;
    this.state = P_STATE.EFFECT;
    this.timer = ANIM.effectFrames;
  }

  die() {
    if (this.state === P_STATE.STARE || this.state === P_STATE.FALL) return;
    this.state = P_STATE.STARE;
    this.timer = ANIM.deathStareFrames;
    this.deadShoe = this.shoe;
    this.shoe = null;
  }

  wear(shoeIdx) {
    this.shoe = shoeIdx;
    this.popLeft = 9;
  }

  update() {
    if (this.popLeft > 0) this.popLeft--;

    switch (this.state) {
      case P_STATE.INTRO:
        if (++this.introT >= INTRO_TOTAL) {
          this.state = P_STATE.IDLE;
          this.facing = this.introFacing;
        }
        break;
      case P_STATE.EFFECT:
        if (--this.timer <= 0) this.state = P_STATE.IDLE;
        break;
      case P_STATE.STARE:
        if (--this.timer <= 0) {
          this.state = P_STATE.FALL;
          this.fallY = 0;
          this.fallVy = 2;
          this.flyL = { x: -10, y: -8, vx: -ANIM.shoeFlySpeedX, vy: ANIM.shoeFlySpeedY };
          this.flyR = { x: 10, y: -8, vx: ANIM.shoeFlySpeedX, vy: ANIM.shoeFlySpeedY };
        }
        break;
      case P_STATE.FALL: {
        this.fallVy = Math.min(ANIM.fallSpeed, this.fallVy + 1);
        this.fallY += this.fallVy;
        for (const f of [this.flyL, this.flyR]) {
          f.x += f.vx;
          f.vy = Math.min(8, f.vy + 1);
          f.y += f.vy;
        }
        if (this.fallY > 380) this.state = P_STATE.DEAD;
        break;
      }
    }
  }

  get dead() {
    return this.state === P_STATE.DEAD;
  }

  get dying() {
    return this.state === P_STATE.STARE || this.state === P_STATE.FALL || this.state === P_STATE.DEAD;
  }

  /**
   * 상승 중 y 오프셋.
   * 스텝 상승 연출을 넣어봤으나 "착착착" 리듬을 해쳐서 제거했다 (2026-08-14).
   * 계단 이동은 즉시 스냅되고, 이펙트 컷만 3프레임 스치듯 지나간다.
   */
  climbOffsetY() {
    return 0;
  }

  render(camX, worldX) {
    const cx = worldX - camX + CENTER_X;
    const side = img(`${this.charId}_side`);
    const front = img(`${this.charId}_front`);
    const jump = img(`${this.charId}_jump`);
    const S = CHAR.scale;

    switch (this.state) {
      case P_STATE.INTRO: {
        if (!front) break;
        const t = this.introT;
        const popping = t >= INTRO.frontHold && t < INTRO.frontHold + INTRO.popUp;
        if (popping) {
          // 1.2배 팝 — 정지 프레임 한 컷이라 비정수 배율을 예외적으로 쓴다
          const w = Math.round(CHAR.dw * 1.2);
          const h = Math.round(CHAR.dh * 1.2);
          drawStretched(front, cx - (w >> 1), CHAR.footY - h, w, h);
        } else {
          drawScaled(front, cx - (CHAR.dw >> 1), CHAR.footY - CHAR.dh, CHAR.w, CHAR.h, S);
        }
        this.renderWornShoe(cx, CHAR.footY);
        break;
      }
      case P_STATE.IDLE: {
        if (!side) break;
        const x = cx - (CHAR.dw >> 1);
        const y = CHAR.footY - CHAR.dh;
        if (this.facing === 1) drawScaled(side, x, y, CHAR.w, CHAR.h, S);
        else drawScaledFlipped(side, x, y, CHAR.w, CHAR.h, S);
        this.renderWornShoe(cx, CHAR.footY);
        break;
      }
      case P_STATE.EFFECT: {
        if (!jump) break;
        const off = this.climbOffsetY();
        const x = cx - (CHAR.jumpDw >> 1);
        const y = CHAR.footY - CHAR.jumpDh + off;
        if (this.facing === 1) drawScaled(jump, x, y, CHAR.jumpW, CHAR.jumpH, S);
        else drawScaledFlipped(jump, x, y, CHAR.jumpW, CHAR.jumpH, S);
        this.renderWornShoe(cx, CHAR.footY + off);
        break;
      }
      case P_STATE.STARE: {
        if (!front) break;
        const big = this.timer > (ANIM.deathStareFrames >> 1);
        const w = big ? Math.round(CHAR.dw * 1.15) : CHAR.dw;
        const h = big ? Math.round(CHAR.dh * 1.15) : CHAR.dh;
        drawStretched(front, cx - (w >> 1), CHAR.footY - h, w, h);
        break;
      }
      case P_STATE.FALL:
      case P_STATE.DEAD: {
        if (!front) break;
        const x = cx - (CHAR.dw >> 1);
        const y = CHAR.footY - CHAR.dh + this.fallY;
        if (y < 340) drawScaled(front, x, y, CHAR.w, CHAR.h, S);
        if (this.deadShoe !== null) {
          this.renderFlyingShoe(cx + this.flyL.x, CHAR.footY + this.flyL.y, true);
          this.renderFlyingShoe(cx + this.flyR.x, CHAR.footY + this.flyR.y, false);
        }
        break;
      }
    }
  }

  /**
   * 착용 신발 — game 아틀라스 40×24 (2026-08-14: 이전 23×14의 약 1.7배로 확대).
   * 원본 신발은 **오른쪽을 향하므로** 왼쪽을 볼 때만 반전한다.
   */
  renderWornShoe(cx, footY) {
    if (this.shoe === null) return;
    const w = img('shoes_game');
    if (!w) return;
    const m = shoesData.game;
    const S = SHOE.wornRenderScale;
    const col = this.shoe % 10;
    const row = (this.shoe / 10) | 0;
    const sx = col * m.cellW + 1;
    const sy = row * m.cellH + 1;
    const dw = Math.round(m.shoeW * S);
    const dh = Math.round(m.shoeH * S);
    const dx = cx - (dw >> 1) + (this.facing === 1 ? 4 : -4);
    const dy = footY - dh + 2;

    if (this.popLeft > 0) {
      const mul = this.popLeft > 6 ? 1.5 : this.popLeft > 3 ? 1.25 : 1.0;
      const pw = Math.round(dw * mul);
      const ph = Math.round(dh * mul);
      drawStretchedFrame(w, sx, sy, m.shoeW, m.shoeH, dx - ((pw - dw) >> 1), dy - (ph - dh), pw, ph, this.facing !== 1);
      return;
    }
    if (this.facing === 1) drawFrameAt(w, sx, sy, m.shoeW, m.shoeH, dx, dy, S);
    else drawFrameAtFlipped(w, sx, sy, m.shoeW, m.shoeH, dx, dy, S);
  }

  renderFlyingShoe(x, y, flip) {
    const w = img('shoes_game');
    if (!w || this.deadShoe === null) return;
    const m = shoesData.game;
    const S = SHOE.wornRenderScale;
    const col = this.deadShoe % 10;
    const row = (this.deadShoe / 10) | 0;
    const sx = col * m.cellW + 1;
    const sy = row * m.cellH + 1;
    if (flip) drawFrameAtFlipped(w, sx, sy, m.shoeW, m.shoeH, x, y, S);
    else drawFrameAt(w, sx, sy, m.shoeW, m.shoeH, x, y, S);
  }
}

// ── 비정수 배율 헬퍼 (팝 연출 전용, 정지 프레임에만 쓴다) ──

function drawStretched(image, x, y, w, h) {
  getCtx().drawImage(image, Math.floor(x), Math.floor(y), Math.round(w), Math.round(h));
}

function drawStretchedFrame(image, sx, sy, sw, sh, dx, dy, dw, dh, flip) {
  const ctx = getCtx();
  if (!flip) {
    ctx.drawImage(image, sx, sy, sw, sh, Math.floor(dx), Math.floor(dy), Math.round(dw), Math.round(dh));
    return;
  }
  ctx.save();
  ctx.translate(Math.floor(dx) + Math.round(dw), Math.floor(dy));
  ctx.scale(-1, 1);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, Math.round(dw), Math.round(dh));
  ctx.restore();
}
