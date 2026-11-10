/* 생성 파일 — tools/idg-import-data.mjs 가 계산기(stages.generated.json)에서 만든다. 손으로 고치지 말 것. */
import w01 from './w01.js';
import w02 from './w02.js';
import w03 from './w03.js';
import w04 from './w04.js';
import w05 from './w05.js';
import w06 from './w06.js';
import w07 from './w07.js';
import w08 from './w08.js';
import w09 from './w09.js';
import w10 from './w10.js';

/** 스테이지 전부 (순번 g 순서) — 객체는 전투 코어 createBattle/simulate 에 그대로 들어간다 */
export const STAGES = [...w01, ...w02, ...w03, ...w04, ...w05, ...w06, ...w07, ...w08, ...w09, ...w10];
export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));
