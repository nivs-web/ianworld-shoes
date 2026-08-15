/**
 * 계단(신발 상자) 모델 + 신발 배치.
 * 시드 RNG로 생성한다 — 멀티에서 같은 시드면 같은 계단/신발. (기획서 §8-2 seed)
 */

import { Rng } from '../core/rng.js';
import { STAIR, CENTER_X, CHAR } from '../config/layout.js';
import { SHOE_TIERS } from '../config/balance.js';
import { SHOE } from '../config/layout.js';
import { rect, strokeRect, draw, drawFrameAt, drawFrameAtFlipped } from '../core/sprite.js';
import { img } from '../core/assets.js';
import { PAL } from './palette.js';
import shoesData from '../data/shoes.json';

const CHUNK = 256; // 계단을 이만큼씩 미리 생성

export class Stairs {
  /**
   * @param {number} seed
   * @param {{gapMin:number,gapMax:number}} shoeGap 신발 등장 간격
   */
  constructor(seed, shoeGap) {
    this.rng = new Rng(seed);
    this.shoeGap = shoeGap;
    /** @type {number[]} dirs[i] = 계단 i-1 → i 방향 (+1 오른쪽 / -1 왼쪽). dirs[0]은 미사용 */
    this.dirs = [0];
    /** @type {number[]} xs[i] = 계단 i의 월드 x (중심) */
    this.xs = [0];
    /** @type {Map<number, number>} 계단 index → 신발 index (0~129) */
    this.shoes = new Map();
    this.nextShoeAt = this.rng.int(shoeGap.gapMin, shoeGap.gapMax);
    this.ensure(CHUNK);
  }

  /** i번 계단까지 생성 보장 */
  ensure(upto) {
    while (this.xs.length <= upto) {
      const i = this.xs.length;
      const dir = this.rng.chance(0.5) ? -1 : 1;
      this.dirs.push(dir);
      this.xs.push(this.xs[i - 1] + dir * STAIR.gapX);

      if (i === this.nextShoeAt) {
        this.shoes.set(i, this.rollShoe());
        this.nextShoeAt = i + this.rng.int(this.shoeGap.gapMin, this.shoeGap.gapMax);
      }
    }
  }

  /** 티어 확률 → 티어 내 균등 (기획서 §5-5) */
  rollShoe() {
    const t = this.rng.weighted(SHOE_TIERS.map((x) => x.prob));
    const tier = SHOE_TIERS[t];
    return tier.offset + this.rng.int(0, tier.count - 1);
  }

  /** 계단 i+1의 방향 (다음 칸이 어느 쪽인가) */
  nextDir(floor) {
    this.ensure(floor + 2);
    return this.dirs[floor + 1];
  }

  worldX(i) {
    this.ensure(i);
    return this.xs[i];
  }

  /** 계단 i 위의 신발 index (없으면 undefined) */
  shoeAt(i) {
    return this.shoes.get(i);
  }

  takeShoe(i) {
    const s = this.shoes.get(i);
    this.shoes.delete(i);
    return s;
  }

  /**
   * 계단들을 그린다.
   * @param {number} floor 현재 계단
   * @param {number} camX 카메라 월드 x
   */
  render(floor, camX) {
    // 계단 위 신발 — game 아틀라스 40×24 (블록 32폭보다 살짝 커서 상자에 얹힌 느낌)
    const shoeImg = img('shoes_game');
    const st = shoesData.game;
    const S = SHOE.stairRenderScale;
    const block = img('stair');

    // 위에서 아래로 그린다 — 아래쪽(가까운) 계단과 신발이 위쪽 계단을 덮어야 한다
    for (let k = STAIR.drawAbove; k >= -STAIR.drawBelow; k--) {
      const i = floor + k;
      // i === 0 은 "출발 지점(도로)" — 계단 블록을 그리지 않는다.
      // 플레이어는 첫 계단 한 칸 아래에서 시작한다. (2026-08-14 개정)
      if (i < 1) continue;
      this.ensure(i + 1);

      const sx = this.xs[i] - camX + CENTER_X - (STAIR.w >> 1);
      const sy = CHAR.footY - k * STAIR.gapY;
      if (sy < -STAIR.h - 40 || sy > 340) continue;

      // 계단 블록 — 사용자 제작 돌블록 스프라이트 (에셋 로드 전에는 사각형 폴백)
      if (block) {
        draw(block, sx, sy);
      } else {
        rect(sx, sy, STAIR.w, STAIR.h, PAL.boxFace);
        rect(sx, sy + STAIR.h - 5, STAIR.w, 5, PAL.boxSide);
        strokeRect(sx, sy, STAIR.w, STAIR.h, PAL.boxLine);
      }

      // 계단 위 신발 — 원본은 **오른쪽을 향하므로** 왼쪽 계단일 때만 반전한다.
      const shoeIdx = this.shoes.get(i);
      if (shoeIdx !== undefined && shoeImg) {
        const col = shoeIdx % 10;
        const row = (shoeIdx / 10) | 0;
        const dw = st.shoeW * S;
        const dh = st.shoeH * S;
        const shx = this.xs[i] - camX + CENTER_X - (dw >> 1);
        const shy = sy - dh + 2;
        const sxA = col * st.cellW + 1;
        const syA = row * st.cellH + 1;
        if (this.dirs[i] === 1) {
          drawFrameAt(shoeImg, sxA, syA, st.shoeW, st.shoeH, shx, shy, S);
        } else {
          drawFrameAtFlipped(shoeImg, sxA, syA, st.shoeW, st.shoeH, shx, shy, S);
        }
      }
    }
  }
}
