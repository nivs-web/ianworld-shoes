/**
 * 이안 드래곤 게임 — 배경 · 양쪽 성 · 분위기 그림 (겜부장 담당 폴더, 그림 v3 · 960×540)
 * 겜팀장 캐릭터 시트(atlas)와 따로 굽는다 : `npm run assets:idg-env` → public/assets/iandragon_game/env/{common,w01}.png/json
 * (배경이 커서 한 장에 다 넣으면 일부 폰의 텍스처 한계 4096칸을 넘는다)
 */
import { BG_W01_SKY, LIGHTS_W01 } from './bg_w01.js';
import { BG_W01_LAND, LIGHTS_W01_LAND } from './bg_w01_land.js';
import { BASES, BASE_LIGHTS } from './bases.js';
import { AMB } from './amb.js';

export { NEST_FEET_Y, BASE_W, BASE_H, BASE_LIGHTS } from './bases.js';
export { TW } from './envkit.js';

/** 시트별 그림 목록 */
export const ENV_SHEETS = {
  common: { ...BASES, ...AMB },
  w01: { ...BG_W01_SKY, ...BG_W01_LAND },
};

/** 겹 배치 (화면 칸 · 위에서부터) — par = 카메라를 따라 움직이는 비율 (0 = 고정 · 1 = 땅과 같이) · tile = 가로로 이어 붙임 */
export const LAYERS = {
  w01: [
    { name: 'bg/w01/sky', y: 0, par: 0, tile: true },
    { name: 'bg/w01/moon', x: 640, y: 110, par: 0.02 },
    { name: 'bg/w01/clouds', y: 30, par: 0.06, tile: true, drift: 4 },
    { name: 'bg/w01/castle', x: 560, y: 392, par: 0.1 },
    { name: 'bg/w01/far', y: 250, par: 0.18, tile: true },
    { name: 'amb/fog', y: 330, par: 0.25, tile: true, drift: 8, fog: true },
    { name: 'bg/w01/mid', y: 268, par: 0.4, tile: true },
    { name: 'bg/w01/near', y: 360, par: 0.7, tile: true },
    { name: 'bg/w01/ground', y: 450, par: 1, tile: true },
  ],
};
/** 화면 아래 모서리에 붙는 앞 장식 (캐릭터보다 앞) */
export const FRONT = { w01: [{ name: 'fg/w01/left', side: 'left' }, { name: 'fg/w01/right', side: 'right' }] };
export const GROUND_Y = 452;   // 캐릭터 발이 닿는 줄 (화면 칸)

/** 겹마다 빛 나는 자리 (그 겹의 판 좌표) — 그림을 그린 뒤에 채워진다 */
export const LIGHTS = {
  'bg/w01/castle': LIGHTS_W01.castle, 'bg/w01/far': LIGHTS_W01.far,
  'bg/w01/mid': LIGHTS_W01_LAND.mid, 'bg/w01/near': LIGHTS_W01_LAND.near, 'bg/w01/ground': LIGHTS_W01_LAND.ground,
  'fg/w01/left': LIGHTS_W01_LAND.fgLeft, 'fg/w01/right': LIGHTS_W01_LAND.fgRight,
};
