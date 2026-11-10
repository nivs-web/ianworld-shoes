/* 생성 파일 — tools/idg-import-data.mjs 가 계산기(data.js)에서 만든다. 손으로 고치지 말 것. */
import { UNITS } from './units.js';
import { ENEMIES } from './enemies.js';
import { LEADERS } from './leaders.js';
import { SKILLS } from './skills.js';
import { WALLET, START_MONEY, PLAYER_BASE_HP } from './wallet.js';

/** 전투 코어에 넣는 D (계산기 data.js 와 같은 모양) */
export const D = { units: UNITS, enemies: ENEMIES, wallet: WALLET, leaders: LEADERS, skills: SKILLS, startMoney: START_MONEY, playerBaseHp: PLAYER_BASE_HP };
