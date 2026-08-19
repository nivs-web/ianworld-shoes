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

/** 구름 자리 — 고정 패턴이라 모듈 상수다 (프레임당 배열 7개를 새로 만들던 것) */
const CLOUD_SPOTS = [
  [20, 60], [120, 150], [60, 260], [150, 380], [30, 470], [110, 560],
];
const CLOUD_PERIOD = 640;

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

    /**
     * ★ **에셋이 다 로드됐으면 하늘을 칠하지 않는다.** (2026-08-19 8차)
     *
     * 타일 + 1층 + 도로가 화면을 빈틈없이 덮으므로 이 `fillRect` 는 **1픽셀도
     * 살아남지 못한다** — 매 프레임 57,600px(180×320 전체)를 헛되이 칠하고 있었다.
     * 로딩 중에는 여전히 필요하다(그때는 덮을 그림이 없다).
     *
     * 키 문자열도 매 프레임 새로 만들지 않는다 — 건물 id 는 판 내내 안 바뀐다.
     */
    if (!this.keys) {
      this.keys = {
        tile: `${this.buildingId}_tile`,
        floor1: `${this.buildingId}_floor1`,
        road: `${this.buildingId}_road`,
      };
    }
    const tile = img(this.keys.tile);
    const f1 = img(this.keys.floor1);
    const road = img(this.keys.road);
    if (!tile || !f1 || !road) rect(0, 0, VIEW_W, VIEW_H, PAL.skyFallback);

    // 월드 y=0 (계단 0 높이) 이 화면에서 어디인가
    const baseY = CHAR.footY + floor * STAIR.gapY;

    // 반복 타일 (월드 y 180 위로 무한 반복, 화면을 덮을 때까지)
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
    if (f1) {
      const top = baseY - BG.floor1H;
      if (top < VIEW_H && top + BG.floor1H > 0) ctx.drawImage(f1, 0, top);
    }

    // 도로 (월드 y 0 아래 120)
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
    for (const [cx, base] of CLOUD_SPOTS) {
      let y = ((base + scroll) % CLOUD_PERIOD) - 160;
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
