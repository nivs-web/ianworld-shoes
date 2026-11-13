/* 생성 파일 — tools/idg-import-data.mjs 가 계산기(stages.hard/master.generated.json)에서 만든다. 손으로 고치지 말 것. */
/** 어려움 · 초고수 판 100개를 따로 묶음으로 불러온다 : d = 'hard' | 'master' (그 밖은 null). 판 g = 배열 [g - 1].
 *  판의 mag · atkMag 는 최종값 — 난이도 배율을 또 곱하지 않는다. */
export const loadDiffStages = (d) => d === 'hard' ? import('./hard.js').then((m) => m.default) : d === 'master' ? import('./master.js').then((m) => m.default) : Promise.resolve(null);
