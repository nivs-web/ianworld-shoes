/**
 * 이안 드래곤 게임 — 그림 목록 (겜팀장). 굽기 스크립트(tools/idg-art-build.mjs)가 이 목록만 본다.
 * FRAMES: 프레임 이름 접두 → { anims: [...], draw(anim) → Pix, anchor? }
 *   접두 + '/' + 동작 = 시트의 프레임 이름 (팀 계획서 2.1). 배경(bg/…)은 동작 없이 접두가 곧 이름.
 */
import { UNITS, ANIMS } from './units.js';
import { DRAGONS_W1 } from './dragons_w1.js';
import { ZOMBIES_W1 } from './zombies_w1.js';
import { MISC_W1 } from './misc_w1.js';
import { BG_UI_W1 } from './bg_ui_w1.js';
import { DRAGONS_W25 } from './dragons_w25.js';
import { LEADERS_W25, ICONS_W25 } from './leaders_w25.js';
import { ZOMBIES_W25 } from './zombies_w25.js';
import { BOSSES_W25 } from './bosses_w25.js';
import { WORLD_W25 } from './world_w25.js';
import { HUD_ICONS } from './ui_hud.js';

export const FRAMES = {};
for (const [k, draw] of Object.entries({ ...UNITS, ...DRAGONS_W1, ...ZOMBIES_W1, ...DRAGONS_W25, ...ZOMBIES_W25 })) FRAMES[k] = { anims: ANIMS, draw };
Object.assign(FRAMES, MISC_W1);   // 보스 · 리더 · 왕관 · 기지 (동작 목록이 다르다)
Object.assign(FRAMES, BG_UI_W1);   // 배경 · 아이콘 · 이펙트
Object.assign(FRAMES, LEADERS_W25, ICONS_W25, BOSSES_W25, WORLD_W25);   // 월드 2~5 (A4 · A5)
Object.assign(FRAMES, HUD_ICONS);   // 전투 HUD 아이콘 · 버튼 판 (ui/hud/…)
