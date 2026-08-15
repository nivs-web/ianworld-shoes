/**
 * 배경 렌더 — 도로(1회) + 건물 1층(1회) + 2·3층 무한 반복 + 층수별 풀스크린 교체.
 * 스크롤은 계단 상승량과 정확히 같은 정수 픽셀. (기획서 §9-5)
 */

import { VIEW_W, VIEW_H, BG, CHAR, STAIR } from '../config/layout.js';
import { FLOOR_EVENTS } from '../config/balance.js';
import { img } from '../core/assets.js';
import { getCtx } from '../core/canvas.js';
import { rect } from '../core/sprite.js';
import { floorBackgroundAt, cloudsVisible } from '../data/backgrounds.js';
import { PAL } from './palette.js';

export class Background {
  /** @param {string} buildingId 'build_01' … */
  constructor(buildingId) {
    this.buildingId = buildingId;
  }

  /**
   * @param {number} floor 현재 계단 수 (스크롤 기준)
   */
  render(floor) {
    const ctx = getCtx();
    const swap = floorBackgroundAt(floor);

    if (swap) {
      // 200층↑: 풀스크린 배경으로 교체
      const f = img(swap);
      if (f) ctx.drawImage(f, 0, 0);
      else rect(0, 0, VIEW_W, VIEW_H, '#101020');
      return;
    }

    rect(0, 0, VIEW_W, VIEW_H, PAL.skyFallback);

    // 월드 y=0 (계단 0 높이) 이 화면에서 어디인가
    const baseY = CHAR.footY + floor * STAIR.gapY;

    // 반복 타일 (월드 y 180 위로 무한 반복, 화면을 덮을 때까지)
    const tile = img(`${this.buildingId}_tile`);
    if (tile) {
      // 타일 k의 화면 top = baseY - 180 - (k+1)*360
      let k = Math.max(0, Math.floor((baseY - BG.floor1H - VIEW_H) / BG.tileH));
      for (; ; k++) {
        const top = baseY - BG.floor1H - (k + 1) * BG.tileH;
        if (top > VIEW_H) continue;
        if (top + BG.tileH < 0) break;
        ctx.drawImage(tile, 0, top);
      }
    }

    // 건물 1층 (월드 y 0~180)
    const f1 = img(`${this.buildingId}_floor1`);
    if (f1) {
      const top = baseY - BG.floor1H;
      if (top < VIEW_H && top + BG.floor1H > 0) ctx.drawImage(f1, 0, top);
    }

    // 도로 (월드 y 0 아래 120)
    const road = img(`${this.buildingId}_road`);
    if (road) {
      if (baseY < VIEW_H && baseY + BG.roadH > 0) ctx.drawImage(road, 0, baseY);
      // 도로보다 더 아래는 어둡게
      if (baseY + BG.roadH < VIEW_H) rect(0, baseY + BG.roadH, VIEW_W, VIEW_H - baseY - BG.roadH, '#3A3A42');
    }

    // 100층↑ 구름 (프로시저럴, 스크롤 동기)
    if (cloudsVisible(floor)) this.renderClouds(floor);
  }

  /** 구름: 200층마다 반복되는 고정 패턴, 계단 스크롤의 절반 속도(원거리감·정수) */
  renderClouds(floor) {
    const scroll = (floor * STAIR.gapY) >> 1;
    const spots = [
      [20, 60], [120, 150], [60, 260], [150, 380], [30, 470], [110, 560],
    ];
    const PERIOD = 640;
    for (const [cx, base] of spots) {
      let y = ((base + scroll) % PERIOD) - 160;
      if (y < -20 || y > VIEW_H + 20) continue;
      this.cloud(cx, y);
    }
  }

  cloud(x, y) {
    rect(x - 10, y, 20, 6, PAL.cloud);
    rect(x - 4, y - 4, 12, 4, PAL.cloud);
    rect(x - 14, y + 2, 28, 4, PAL.cloud);
    rect(x - 12, y + 6, 24, 2, PAL.cloudShade);
  }
}

/** 구름/배경 교체가 일어나는 층인지 (BGM 전환 등에 활용) */
export function backgroundPhase(floor) {
  for (const e of FLOOR_EVENTS.bgSwap) if (floor >= e.from) return e.key;
  return cloudsVisible(floor) ? 'clouds' : 'building';
}
