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
import { drawWornItems } from './wornItems.js';
import shoesData from '../data/shoes.json';
import charMeta from '../data/characters.generated.json';

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
    /**
     * 착용 아이템 id 들 (모자·날개·반려견). GameScene 이 프로필에서 넣어 준다.
     * 비어 있으면 아래 `drawItems` 가 곧바로 돌아가므로 싱글·멀티 모두 비용이 0이다.
     */
    this.items = [];
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
          this.drawItems(cx, CHAR.footY, 'front', true);
          this.drawCut(front, cx - (CHAR.dw >> 1), CHAR.footY - CHAR.dh, CHAR.w, CHAR.h, S, 'front');
          this.drawItems(cx, CHAR.footY, 'front', false);
        }
        this.renderWornShoe(cx, CHAR.footY, 'front');
        break;
      }
      case P_STATE.IDLE: {
        if (!side) break;
        const x = cx - (CHAR.dw >> 1);
        const y = CHAR.footY - CHAR.dh;
        this.drawItems(cx, CHAR.footY, 'side', true);
        this.drawCut(side, x, y, CHAR.w, CHAR.h, S, 'side');
        this.drawItems(cx, CHAR.footY, 'side', false);
        this.renderWornShoe(cx, CHAR.footY, 'side');
        break;
      }
      case P_STATE.EFFECT: {
        if (!jump) break;
        const off = this.climbOffsetY();
        const x = cx - (CHAR.jumpDw >> 1);
        const y = CHAR.footY - CHAR.jumpDh + off;
        this.drawItems(cx, CHAR.footY + off, 'side', true);
        this.drawCut(jump, x, y, CHAR.jumpW, CHAR.jumpH, S, 'jump');
        this.drawItems(cx, CHAR.footY + off, 'side', false);
        this.renderWornShoe(cx, CHAR.footY + off, 'jump');
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
   * 착용 아이템 한 겹.
   *
   * **살아 있는 컷에만 그린다**(INTRO·IDLE·EFFECT). 사망 연출(STARE·FALL)은 캐릭터를
   * 1.15배로 늘리거나 낙하시키는데, 아이템만 제자리에 남으면 몸에서 떨어져 나온 것처럼
   * 보인다 — 그 순간 사용자가 봐야 하는 건 모자가 아니라 "죽었다"는 사실이다.
   *
   * @param {'front'|'side'} cut
   * @param {boolean} behind 날개처럼 캐릭터보다 뒤에 오는 것만 그릴지
   */
  drawItems(cx, footY, cut, behind) {
    if (!this.items?.length) return;
    drawWornItems(this.items, cx, footY, CHAR.scale, this.facing, cut, behind);
  }

  /**
   * 캐릭터 컷을 그린다. **신발을 신고 있으면 맨발 영역을 통째로 잘라내고 그린다.**
   *
   * 신발 스프라이트로 발을 "덮는" 방식은 신발 실루엣이 발보다 작거나 좁으면
   * 발가락·발등·발목이 삐져나온다(= 버그). 반대로 발 자체를 안 그리면
   * 어떤 신발이든 맨발이 1도트도 나올 수 없다. 잘린 단면은 신발이 더 위에서
   * 시작하므로 가려진다.
   *
   * @param {'front'|'side'|'jump'} cut
   */
  drawCut(image, x, y, w, h, scale, cut) {
    const flip = cut !== 'front' && this.facing !== 1;
    if (this.shoe === null) {
      if (flip) drawScaledFlipped(image, x, y, w, h, scale);
      else drawScaled(image, x, y, w, h, scale);
      return;
    }
    const rows = this.footCut(cut); // 이 행부터 아래는 발 → 그리지 않는다
    if (flip) drawFrameAtFlipped(image, 0, 0, w, rows, x, y, scale);
    else drawFrameAt(image, 0, 0, w, rows, x, y, scale);
  }

  /** 발이 시작하는 원본 행. 슬라이서 측정값을 쓰되 최소 7행은 반드시 잘라낸다. */
  footCut(cut) {
    const srcH = cut === 'jump' ? CHAR.jumpH : CHAR.h;
    const m = charMeta[this.charId]?.cuts?.[cut]?.foot;
    return Math.min(m ? m.top : srcH - 7, srcH - 7);
  }

  /**
   * 컷 안에서 발이 있는 x(원본 스프라이트 좌표)를 화면 x로 환산한다.
   * 캐릭터마다 발 위치가 미세하게 다르므로 슬라이서가 기록한 foot.cx 를 쓴다.
   * (characters.generated.json — tools/slice-characters.mjs footAnchor())
   * @param {'front'|'side'|'jump'} cut
   * @param {number} cx 캐릭터 중심 화면 x
   */
  footScreenX(cut, cx) {
    const S = CHAR.scale;
    const isJump = cut === 'jump';
    const srcW = isJump ? CHAR.jumpW : CHAR.w;
    const dw = isJump ? CHAR.jumpDw : CHAR.dw;
    const left = cx - (dw >> 1);
    const meta = charMeta[this.charId]?.cuts?.[cut]?.foot;
    const fcx = meta ? meta.cx : srcW >> 1;
    // 반전 렌더는 translate(left+dw) 후 scale(-1,1) 이므로 x가 뒤집힌다
    const flipped = cut !== 'front' && this.facing !== 1;
    return flipped ? left + dw - Math.round(fcx * S) : left + Math.round(fcx * S);
  }

  /**
   * 착용 신발 — **전용 아틀라스 `shoes_worn`(31×19, 1도트 진회색 외곽선)** 을 1:1로 그린다.
   * (2026-08-15: game 아틀라스를 0.7배로 줄여 그리던 방식은 가장자리가 들쭉날쭉했다.
   *  원본에서 직접 렌더한 착용 전용 크기 + 외곽선으로 바꿔 "장착된" 느낌을 준다.)
   * 원본 신발은 **오른쪽을 향하므로** 왼쪽을 볼 때만 반전한다.
   * @param {'front'|'side'|'jump'} cut 현재 그려진 캐릭터 컷
   */
  renderWornShoe(cx, footY, cut = 'side') {
    if (this.shoe === null) return;
    const w = img('shoes_worn');
    if (!w) return;
    const m = shoesData.worn;
    const S = SHOE.wornRenderScale;
    const col = this.shoe % 10;
    const row = (this.shoe / 10) | 0;
    const sx = col * m.cellW + 1;
    const sy = row * m.cellH + 1;
    const dw = Math.round(m.shoeW * S);
    const dh = Math.round(m.shoeH * S);
    // 신발 중심을 발 중심에 맞추되, 발끝(진행 방향)이 살짝 더 나오게 1px 민다
    const fx = this.footScreenX(cut, cx);
    const lean = cut === 'front' ? 0 : this.facing === 1 ? 1 : -1;
    const dx = fx - (dw >> 1) + lean;
    // 신발 밑창이 발끝 라인(=계단 윗면)에 닿는다 (외곽선 1도트만큼 아래로)
    const dy = footY - dh + SHOE.wornOffsetY;

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
    const w = img('shoes_worn');
    if (!w || this.deadShoe === null) return;
    const m = shoesData.worn;
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
