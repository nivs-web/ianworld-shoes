/**
 * 이안 드래곤 게임 — 저장 묶음 `idg` 읽기 · 쓰기. (2026-11-10)
 *
 * 화면은 Firebase 를 직접 부르지 않고 여기를 거친다 (오락실 규칙).
 * 쓰기는 `profile.patch` — 기기에 먼저 쓰고 서버에는 뒤에서 병합(`setDoc merge`)으로 올린다.
 * 서버 값 이름은 묶음 하나(`idg`)뿐이다 (기획서 14장).
 */

import * as L from './storageLocal.js';
import { patch } from './profile.js';
import { normIdg } from './iandragonGameState.js';

/** 지금 값 (항상 안전한 모양) */
export const idg = () => normIdg(L.loadProfile().idg);

/** 일부만 바꿔 저장 — 바뀐 전체 묶음을 돌려준다 */
export function saveIdg(part) {
  const next = normIdg({ ...idg(), ...part });
  patch({ idg: next });
  return next;
}

/** 별 개수 합 (로비 · 카드 표시용) */
export const totalStars = (g = idg()) => [...g.stars].reduce((a, c) => a + (Number(c) || 0), 0);

/** 지금 도전할 스테이지 순번 (1~) — 깬 마지막 다음 */
export const nextStage = (g = idg()) => g.cleared + 1;

/** 순번 → "월드-번호" (1 → "1-1", 15 → "2-5") */
export const stageLabel = (no) => `${Math.floor((no - 1) / 10) + 1}-${((no - 1) % 10) + 1}`;
