/**
 * 이안 드래곤 게임 — 배경 · 양쪽 성 (겜부장 담당 폴더, 2026-11-10 대표님 지시로 겜팀장에게서 넘겨받음)
 * 겜팀장 굽기 목록(art/index.js)이 맨 끝에 `Object.assign(FRAMES, ENV_FRAMES)` 한 줄로 합친다 → 같은 이름을 덮어쓴다.
 * 모양은 art/index.js 의 FRAMES 와 같다 : 접두 → { anims, draw(anim) → Pix, anchor? }
 */
import { BG_W01 } from './bg_w01.js';
import { BASES } from './bases.js';

export { NEST_FEET_Y, BASE_W, BASE_H } from './bases.js';
export const ENV_FRAMES = { ...BG_W01, ...BASES };
