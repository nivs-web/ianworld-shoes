/**
 * 좀비와 드래곤 — 꾸미기 · 드래곤 도감 목록 (샵 · 꾸미기 창 · 도감 · 레벨 선물용 · 따로 묶음) — 2026-11-13 핵심 보조 ④
 * 기획 : IDG_COLLECTION_PLAN §1 · §2 · §3 · §8 · §10(우선) · IDG_ART_BRIEF §4 · 저장 설계 : iandragon/docs/IDG_UPGRADES_SPEC.md
 *
 * - 꾸미기 **184개** (모자 30 · 목 24 · 브레스 색 16 · 오라 18 · 펫 18 · 깃발 24 · 지붕 18 · 성문 18 · 앞마당 18)
 *   등급 : 보통 34 · 고급 40 · 희귀 40 · 영웅 20 · 전설 30 · 신화 20. 옛 26개는 id 그대로(옛 젬 품목 4개 = 영웅 · 보통에서도 판매).
 * - 전투는 이 파일을 부르지 않는다 (효과는 `lookFx.js` · 같은 id). 이 파일은 샵 · 도감을 열 때 받는다(동적 import).
 * - 값은 `tools/idg-econ-check.mjs` 로 맞춘 표(아래 PRICE). 보통 · 고급 = 코인 · 희귀 = 젬 + 코인 조금 · 영웅 = 젬 · 전설 · 신화 = 판매 안 함.
 * - 신화 · 초고수 보상은 vis 'master' — 보통 10-10 을 못 깬 계정에는 목록 · 개수 · % 어디에도 안 나온다(`visibleLooks`).
 *   이름에 «초고수» 글자를 쓰지 않는다. 파일 · id 에도 master 를 쓰지 않는다(myth).
 *
 * 열 : id · slot · tier · theme(월드 테마 10 중 하나 | null) · name · price{coin,gem}|null · from(얻는 곳 코드) · w(월드 | null) · vis('all'|'master')
 * 얻는 곳 코드 :
 *   'start'            처음부터 샵                       'normalW3'     보통 월드 3 을 깨면 샵 (보통 3-10)
 *   'normalW3x5'       보통 3-5 를 깨면 샵                'hardW3x5'     어려움 3-5 를 깨면 샵 (희귀 «붉은» 묶음)
 *   'hardW3x10'        어려움 3-10 을 깨면 샵 (영웅)       'hardFirstX5'  어려움 w-5 첫 클리어 확정 보상 (전설)
 *   'hardFirstX10'     어려움 w-10 첫 클리어 확정 보상     'hardReplay'   어려움 보스 판 다시 깨기 3% + 보물 게이지 (전설)
 *   'masterFirstX10'   초고수 w-10 첫 클리어 확정 보상     'masterReplay' 초고수 보스 판 다시 깨기 1% + 보물 게이지 (신화)
 *   'stars900'         별 900개 (신화 «별의 왕관»)
 * (레벨 선물은 얻는 곳이 아니라 «열린 것 중에서» 뽑는다 — giftCandidates)
 */
import { LEADERS } from './leaders.js';
import { TIERS, TIER_KO, LOOK_FX, SLOT_IDS } from './lookFx.js';
import { MASTER_ON } from './features.js';
import { BLOCKED, BLOCK_TEXT } from './blocked.js';   /* 잠시 잠근 꾸미기 (11/14) */

export { TIERS, TIER_KO };
/** 큰 칸 → 작은 칸 (샵 · 꾸미기 창 메뉴) */
export const SLOT_KO = { hat: '모자', neck: '목 장식', breath: '브레스 색', aura: '발밑 오라', pet: '동행 펫', flag: '드래곤캐슬 깃발', roof: '지붕 장식', gate: '성문 장식', yard: '앞마당 장식' };
export const GROUPS = [
  { id: 'dragon', name: '드래곤', slots: ['hat', 'neck', 'breath', 'aura', 'pet'] },
  { id: 'castle', name: '드래곤캐슬', slots: ['flag', 'roof', 'gate', 'yard'] },
];
/** 월드 테마 10 (월드 번호 순) */
export const THEMES = [
  { id: 'hill', name: '달밤 언덕', w: 1 }, { id: 'volcano', name: '부글 화산', w: 2 }, { id: 'sky', name: '구름 하늘섬', w: 3 }, { id: 'ice', name: '꽁꽁 얼음골', w: 4 }, { id: 'mine', name: '덜컹 쇠 광산', w: 5 },
  { id: 'grave', name: '으스스 묘지', w: 6 }, { id: 'desert', name: '모래바람 사막', w: 7 }, { id: 'swamp', name: '끈적 독 늪', w: 8 }, { id: 'crystal', name: '반짝 수정 동굴', w: 9 }, { id: 'castle', name: '좀비 드래곤캐슬', w: 10 },
];

/**
 * 값 표 (tools/idg-econ-check.mjs 로 맞춤 · 11/13)
 * - 보통 · 고급(월드 테마) : 한 월드 묶음(보통 2 · 고급 2 + x-5 고급 1, 월드 10 은 고급 3 + 1) 합 = 그 월드 보통 벌이(별 평균 2)의 약 30%
 *   (별 전부 3 기준으로는 약 26%) → 코인 [보통, 고급]
 * - 희귀 : 젬 60 ~ 80 + 코인 1,000 ~ 4,600 / 영웅 : 젬 150 ~ 230
 * - 옛 26개 : 지금 값 그대로 (옛 젬 품목 4개도 그대로)
 */
export const PRICE = {
  normal: { 1: [500, 1000], 2: [1000, 2000], 3: [1400, 2800], 4: [1900, 3800], 5: [2400, 4800], 6: [2900, 5800], 7: [3400, 6800], 8: [3800, 7600], 9: [4300, 8600], 10: [4400, 8800] },
  rare: { 1: [1000, 60], 2: [1400, 60], 3: [1800, 65], 4: [2200, 65], 5: [2600, 70], 6: [3000, 70], 7: [3400, 75], 8: [3800, 75], 9: [4200, 80], 10: [4600, 80] },   // [코인, 젬]
  hero: { 1: 150, 2: 160, 3: 170, 4: 180, 5: 190, 7: 210, 8: 220, 9: 230 },                                                                                         // 젬
  start: { 'aura:grass': 1000 },
  old: {   // 옛 26개 (looks.js 값 그대로 · gem = 젬 품목)
    'hat:crown': { gem: 150 }, 'hat:pirate': { coin: 8000 }, 'hat:wizard': { coin: 12000 }, 'hat:pumpkin': { coin: 3000 }, 'hat:helmet': { coin: 6000 }, 'hat:ribbon': { coin: 3000 }, 'hat:party': { coin: 4000 }, 'hat:viking': { coin: 10000 },
    'neck:cape': { coin: 8000 }, 'neck:scarf': { coin: 3000 }, 'neck:medal': { coin: 10000 }, 'neck:skull': { gem: 80 }, 'neck:bow': { coin: 3000 }, 'neck:bell': { coin: 4000 },
    'breath:rainbow': { coin: 15000 }, 'breath:ghost': { coin: 12000 }, 'breath:gold': { gem: 200 }, 'breath:ice': { coin: 10000 },
    'flag:dragon': { coin: 6000 }, 'flag:moon': { coin: 4000 }, 'flag:skull': { gem: 50 }, 'flag:star': { coin: 4000 }, 'flag:heart': { coin: 3000 }, 'flag:flame': { coin: 5000 }, 'flag:crown': { coin: 8000 }, 'flag:rainbow': { coin: 5000 },
  },
};

const TIER_OF = { c: 'common', f: 'fine', r: 'rare', h: 'hero', L: 'legend', M: 'myth' };
/* [slot, id, 등급(c 보통 · f 고급 · r 희귀 · h 영웅 · L 전설 · M 신화), theme, 이름, 얻는 곳, 월드] — 순서는 화면 순서(저장 번호는 lookFx) */
const ROWS = [
  // hat
  ['hat', 'crown', 'h', 'castle', '왕관', 'start', null],
  ['hat', 'pirate', 'f', null, '해적 모자', 'start', null],
  ['hat', 'wizard', 'f', null, '마법사 고깔', 'start', null],
  ['hat', 'pumpkin', 'c', null, '호박 모자', 'start', null],
  ['hat', 'helmet', 'c', null, '헬멧', 'start', null],
  ['hat', 'ribbon', 'c', null, '리본', 'start', null],
  ['hat', 'party', 'c', null, '파티 고깔', 'start', null],
  ['hat', 'viking', 'f', null, '바이킹 투구', 'start', null],
  ['hat', 'acorn', 'c', 'hill', '도토리 모자', 'normalW1', 1],
  ['hat', 'nightcap', 'r', 'hill', '달빛 잠꾸러기 모자', 'hardW1x5', 1],
  ['hat', 'moonhelm', 'h', 'hill', '초승달 투구', 'hardW1x10', 1],
  ['hat', 'moonstar', 'M', 'hill', '은하 달 왕관', 'masterFirstX10', 1],
  ['hat', 'lavacone', 'f', 'volcano', '용암 고깔', 'normalW2', 2],
  ['hat', 'phoenixcrest', 'L', 'volcano', '불사조 볏', 'hardFirstX5', 2],
  ['hat', 'aviator', 'f', 'sky', '비행 모자', 'normalW3', 3],
  ['hat', 'wingcap', 'r', 'sky', '날개 모자', 'hardW3x5', 3],
  ['hat', 'stormcrown', 'L', 'sky', '번개 왕관', 'hardFirstX10', 3],
  ['hat', 'earmuff', 'c', 'ice', '털 귀마개', 'normalW4', 4],
  ['hat', 'minerhelm', 'f', 'mine', '광부 헬멧', 'normalW5', 5],
  ['hat', 'drillhat', 'r', 'mine', '드릴 모자', 'hardW5x5', 5],
  ['hat', 'jewelhelm', 'h', 'mine', '보석 광부 투구', 'hardW5x10', 5],
  ['hat', 'turban', 'f', 'desert', '사막 두건', 'normalW7', 7],
  ['hat', 'pharaoh', 'r', 'desert', '파라오 모자', 'hardW7x5', 7],
  ['hat', 'lilypad', 'c', 'swamp', '연잎 모자', 'normalW8', 8],
  ['hat', 'witchhat', 'L', 'swamp', '늪 마녀 모자', 'hardFirstX10', 8],
  ['hat', 'crystalcap', 'f', 'crystal', '수정 고깔', 'normalW9', 9],
  ['hat', 'gemtiara', 'r', 'crystal', '보석 머리띠', 'hardW9x5', 9],
  ['hat', 'flamecrown', 'L', null, '불꽃 왕관', 'hardReplay', null],
  ['hat', 'cometcrown', 'M', null, '혜성 왕관', 'masterReplay', null],
  ['hat', 'starcrown', 'M', null, '별의 왕관', 'stars900', null],
  // neck
  ['neck', 'cape', 'f', null, '망토', 'start', null],
  ['neck', 'scarf', 'c', null, '목도리', 'start', null],
  ['neck', 'medal', 'f', null, '메달', 'start', null],
  ['neck', 'skull', 'h', 'grave', '해골 목걸이', 'start', null],
  ['neck', 'bow', 'c', null, '나비 리본', 'start', null],
  ['neck', 'bell', 'c', null, '방울', 'start', null],
  ['neck', 'leafscarf', 'f', 'hill', '나뭇잎 목도리', 'normalW1', 1],
  ['neck', 'emberscarf', 'c', 'volcano', '숯불 목도리', 'normalW2', 2],
  ['neck', 'lavachain', 'r', 'volcano', '용암 목걸이', 'hardW2x5', 2],
  ['neck', 'cloudscarf', 'f', 'sky', '구름 목도리', 'normalW3', 3],
  ['neck', 'featherboa', 'h', 'sky', '깃털 목도리', 'hardW3x10', 3],
  ['neck', 'icescarf', 'r', 'ice', '얼음 목도리', 'hardW4x5', 4],
  ['neck', 'frostmedal', 'L', 'ice', '서리 훈장', 'hardFirstX10', 4],
  ['neck', 'coalpouch', 'c', 'mine', '석탄 주머니', 'normalW5', 5],
  ['neck', 'rubyamulet', 'L', 'mine', '루비 목걸이', 'hardFirstX5', 5],
  ['neck', 'bonechain', 'f', 'grave', '뼈다귀 목걸이', 'normalW6', 6],
  ['neck', 'ghostcape', 'r', 'grave', '유령 망토', 'hardW6x5', 6],
  ['neck', 'sunscarab', 'M', 'desert', '태양 풍뎅이 목걸이', 'masterFirstX10', 7],
  ['neck', 'frogbead', 'r', 'swamp', '개구리 구슬 목걸이', 'hardW8x5', 8],
  ['neck', 'vinecape', 'h', 'swamp', '덩굴 망토', 'hardW8x10', 8],
  ['neck', 'crystalbead', 'c', 'crystal', '수정 구슬 목걸이', 'normalW9', 9],
  ['neck', 'knightcape', 'f', 'castle', '기사 망토', 'normalW10', 10],
  ['neck', 'dragonheart', 'L', null, '드래곤 하트 목걸이', 'hardReplay', null],
  ['neck', 'starnecklace', 'M', null, '별자리 목걸이', 'masterReplay', null],
  // breath
  ['breath', 'rainbow', 'f', null, '무지개 브레스', 'start', null],
  ['breath', 'ghost', 'f', null, '보라 유령불', 'start', null],
  ['breath', 'gold', 'h', 'castle', '황금 브레스', 'start', null],
  ['breath', 'ice', 'f', null, '얼음 파랑', 'start', null],
  ['breath', 'magma', 'f', 'volcano', '마그마 브레스', 'normalW2x5', 2],
  ['breath', 'skyblue', 'r', 'sky', '하늘빛 브레스', 'hardW3x5', 3],
  ['breath', 'copper', 'h', 'mine', '구리빛 불꽃', 'hardW5x10', 5],
  ['breath', 'starforge', 'M', 'mine', '별 대장간 불꽃', 'masterFirstX10', 5],
  ['breath', 'soulfire', 'r', 'grave', '도깨비불 브레스', 'hardW6x5', 6],
  ['breath', 'sand', 'c', 'desert', '모래빛 브레스', 'normalW7', 7],
  ['breath', 'toxic', 'f', 'swamp', '초록 독 브레스', 'normalW8', 8],
  ['breath', 'amethyst', 'r', 'crystal', '자수정 브레스', 'hardW9x5', 9],
  ['breath', 'royal', 'f', 'castle', '왕실 브레스', 'normalW10', 10],
  ['breath', 'blackfire', 'L', null, '검은 불꽃', 'hardReplay', null],
  ['breath', 'whitefire', 'L', null, '하얀 불꽃', 'hardReplay', null],
  ['breath', 'cosmic', 'M', null, '우주 불꽃', 'masterReplay', null],
  // aura
  ['aura', 'grass', 'c', null, '풀잎 오라', 'start', null],
  ['aura', 'firefly', 'r', 'hill', '반딧불 오라', 'hardW1x5', 1],
  ['aura', 'fullmoon', 'L', 'hill', '보름달 오라', 'hardFirstX5', 1],
  ['aura', 'lavaring', 'h', 'volcano', '용암 고리 오라', 'hardW2x10', 2],
  ['aura', 'sunflare', 'M', 'volcano', '태양 불꽃 오라', 'masterFirstX10', 2],
  ['aura', 'breeze', 'c', 'sky', '산들바람 오라', 'normalW3', 3],
  ['aura', 'snowflake', 'f', 'ice', '눈송이 오라', 'normalW4', 4],
  ['aura', 'gearaura', 'r', 'mine', '톱니 오라', 'hardW5x5', 5],
  ['aura', 'fog', 'c', 'grave', '으스스 안개 오라', 'normalW6', 6],
  ['aura', 'spiritring', 'L', 'grave', '영혼 고리 오라', 'hardFirstX10', 6],
  ['aura', 'sandstorm', 'f', 'desert', '모래바람 오라', 'normalW7', 7],
  ['aura', 'bubbles', 'r', 'swamp', '방울방울 오라', 'hardW8x5', 8],
  ['aura', 'spores', 'h', 'swamp', '버섯 포자 오라', 'hardW8x10', 8],
  ['aura', 'prism', 'f', 'crystal', '무지개 프리즘 오라', 'normalW9', 9],
  ['aura', 'gemring', 'r', 'crystal', '보석 고리 오라', 'hardW9x5', 9],
  ['aura', 'galaxy', 'M', 'crystal', '은하수 오라', 'masterFirstX10', 9],
  ['aura', 'goldring', 'L', null, '황금 고리 오라', 'hardReplay', null],
  ['aura', 'nebula', 'M', null, '성운 오라', 'masterReplay', null],
  // pet
  ['pet', 'owl', 'f', 'hill', '아기 부엉이', 'normalW1x5', 1],
  ['pet', 'moonbunny', 'h', 'hill', '달토끼', 'hardW1x10', 1],
  ['pet', 'emberpup', 'c', 'volcano', '불씨 강아지', 'normalW2', 2],
  ['pet', 'salamander', 'r', 'volcano', '아기 불도마뱀', 'hardW2x5', 2],
  ['pet', 'firebird', 'L', 'volcano', '꼬마 불새', 'hardFirstX10', 2],
  ['pet', 'cloudwhale', 'L', 'sky', '구름 고래', 'hardFirstX5', 3],
  ['pet', 'skyspirit', 'M', 'sky', '하늘 정령', 'masterFirstX10', 3],
  ['pet', 'penguin', 'r', 'ice', '아기 펭귄', 'hardW4x5', 4],
  ['pet', 'mole', 'f', 'mine', '아기 두더지', 'normalW5', 5],
  ['pet', 'scarab', 'r', 'desert', '꼬마 풍뎅이', 'hardW7x5', 7],
  ['pet', 'camel', 'h', 'desert', '아기 낙타', 'hardW7x10', 7],
  ['pet', 'froggy', 'c', 'swamp', '아기 개구리', 'normalW8', 8],
  ['pet', 'gemfairy', 'L', 'crystal', '보석 요정', 'hardFirstX5', 9],
  ['pet', 'minidragon', 'f', 'castle', '꼬마 드래곤', 'normalW10', 10],
  ['pet', 'griffin', 'r', 'castle', '아기 그리핀', 'hardW10x5', 10],
  ['pet', 'goldegg', 'L', null, '황금알 친구', 'hardReplay', null],
  ['pet', 'starcat', 'M', null, '별고양이', 'masterReplay', null],
  ['pet', 'cometfox', 'M', null, '혜성 여우', 'masterReplay', null],
  // flag
  ['flag', 'dragon', 'c', null, '드래곤 깃발', 'start', null],
  ['flag', 'moon', 'c', null, '달 깃발', 'start', null],
  ['flag', 'skull', 'h', 'grave', '해골 깃발', 'start', null],
  ['flag', 'star', 'c', null, '별 깃발', 'start', null],
  ['flag', 'heart', 'c', null, '하트 깃발', 'start', null],
  ['flag', 'flame', 'c', null, '불꽃 깃발', 'start', null],
  ['flag', 'crown', 'f', null, '왕관 깃발', 'start', null],
  ['flag', 'rainbow', 'c', null, '무지개 깃발', 'start', null],
  ['flag', 'moonhill', 'f', 'hill', '달밤 언덕 깃발', 'normalW1', 1],
  ['flag', 'volcano', 'f', 'volcano', '화산 깃발', 'normalW2', 2],
  ['flag', 'kite', 'r', 'sky', '방패연 깃발', 'hardW3x5', 3],
  ['flag', 'aurora', 'h', 'ice', '오로라 깃발', 'hardW4x10', 4],
  ['flag', 'pickflag', 'r', 'mine', '곡괭이 깃발', 'hardW5x5', 5],
  ['flag', 'batflag', 'c', 'grave', '박쥐 깃발', 'normalW6', 6],
  ['flag', 'nightking', 'M', 'grave', '한밤의 깃발', 'masterFirstX10', 6],
  ['flag', 'oasis', 'f', 'desert', '오아시스 깃발', 'normalW7x5', 7],
  ['flag', 'sunflag', 'r', 'desert', '태양 깃발', 'hardW7x5', 7],
  ['flag', 'froglord', 'L', 'swamp', '개구리 왕 깃발', 'hardFirstX5', 8],
  ['flag', 'gemflag', 'h', 'crystal', '보석 깃발', 'hardW9x10', 9],
  ['flag', 'banner', 'c', 'castle', '기사 깃발', 'normalW10', 10],
  ['flag', 'lionflag', 'r', 'castle', '사자 깃발', 'hardW10x5', 10],
  ['flag', 'dragonking', 'L', 'castle', '드래곤 왕 깃발', 'hardFirstX10', 10],
  ['flag', 'legendflag', 'L', null, '전설의 깃발', 'hardReplay', null],
  ['flag', 'rainbowstar', 'M', null, '무지개별 깃발', 'masterReplay', null],
  // roof
  ['roof', 'windmill', 'r', 'hill', '꼬마 풍차', 'hardW1x5', 1],
  ['roof', 'moontower', 'L', 'hill', '달빛 종탑', 'hardFirstX10', 1],
  ['roof', 'weathervane', 'c', 'sky', '바람개비', 'normalW3', 3],
  ['roof', 'balloon', 'r', 'sky', '꼬마 열기구', 'hardW3x5', 3],
  ['roof', 'skyship', 'h', 'sky', '하늘 배', 'hardW3x10', 3],
  ['roof', 'icicle', 'f', 'ice', '고드름 지붕', 'normalW4', 4],
  ['roof', 'starfrost', 'M', 'ice', '별서리 첨탑', 'masterFirstX10', 4],
  ['roof', 'chimney', 'r', 'mine', '칙칙폭폭 굴뚝', 'hardW5x5', 5],
  ['roof', 'crowroof', 'f', 'grave', '까마귀 지붕', 'normalW6', 6],
  ['roof', 'belltower', 'L', 'grave', '유령 종탑', 'hardFirstX5', 6],
  ['roof', 'pyramid', 'r', 'desert', '꼬마 피라미드', 'hardW7x5', 7],
  ['roof', 'sundome', 'L', 'desert', '태양 돔', 'hardFirstX10', 7],
  ['roof', 'shardroof', 'c', 'crystal', '수정 조각 지붕', 'normalW9', 9],
  ['roof', 'crystalspire', 'f', 'crystal', '수정 첨탑', 'normalW9x5', 9],
  ['roof', 'geode', 'r', 'crystal', '자수정 지붕', 'hardW9x5', 9],
  ['roof', 'diamondroof', 'h', 'crystal', '다이아 지붕', 'hardW9x10', 9],
  ['roof', 'dragonstatue', 'L', null, '드래곤 석상', 'hardReplay', null],
  ['roof', 'starwing', 'M', null, '별 날개 지붕', 'masterReplay', null],
  // gate
  ['gate', 'vinegate', 'r', 'hill', '덩굴 성문', 'hardW1x5', 1],
  ['gate', 'lavagate', 'r', 'volcano', '용암 성문', 'hardW2x5', 2],
  ['gate', 'firegate', 'h', 'volcano', '불꽃 철문', 'hardW2x10', 2],
  ['gate', 'cloudgate', 'f', 'sky', '구름 성문', 'normalW3x5', 3],
  ['gate', 'snowarch', 'c', 'ice', '눈 아치', 'normalW4', 4],
  ['gate', 'icegate', 'r', 'ice', '얼음 성문', 'hardW4x5', 4],
  ['gate', 'glaciergate', 'L', 'ice', '빙하 성문', 'hardFirstX5', 4],
  ['gate', 'geargate', 'f', 'mine', '톱니 성문', 'normalW5x5', 5],
  ['gate', 'irongate', 'L', 'mine', '거인의 쇠문', 'hardFirstX10', 5],
  ['gate', 'tombgate', 'r', 'grave', '무덤 철문', 'hardW6x5', 6],
  ['gate', 'sandarch', 'c', 'desert', '모래 아치', 'normalW7', 7],
  ['gate', 'sphinxgate', 'h', 'desert', '스핑크스 성문', 'hardW7x10', 7],
  ['gate', 'reedgate', 'f', 'swamp', '갈대 성문', 'normalW8', 8],
  ['gate', 'mossgate', 'r', 'swamp', '이끼 성문', 'hardW8x5', 8],
  ['gate', 'portcullis', 'r', 'castle', '쇠창살 성문', 'hardW10x5', 10],
  ['gate', 'royalgate', 'L', 'castle', '황금 왕성 문', 'hardFirstX5', 10],
  ['gate', 'stargate', 'M', 'castle', '별빛 성문', 'masterFirstX10', 10],
  ['gate', 'dragongate', 'L', null, '드래곤 입 성문', 'hardReplay', null],
  // yard
  ['yard', 'haystack', 'c', 'hill', '폭신 짚더미', 'normalW1', 1],
  ['yard', 'brazier', 'r', 'volcano', '활활 화로', 'hardW2x5', 2],
  ['yard', 'snowman', 'f', 'ice', '눈사람', 'normalW4x5', 4],
  ['yard', 'igloo', 'r', 'ice', '이글루', 'hardW4x5', 4],
  ['yard', 'icestatue', 'h', 'ice', '얼음 드래곤 조각', 'hardW4x10', 4],
  ['yard', 'minecart', 'c', 'mine', '꼬마 광차', 'normalW5', 5],
  ['yard', 'pumpkinlamp', 'f', 'grave', '호박 등불', 'normalW6x5', 6],
  ['yard', 'gravestone', 'r', 'grave', '웃는 비석', 'hardW6x5', 6],
  ['yard', 'obelisk', 'L', 'desert', '황금 오벨리스크', 'hardFirstX5', 7],
  ['yard', 'mushrooms', 'f', 'swamp', '버섯 마을', 'normalW8x5', 8],
  ['yard', 'lotuspond', 'r', 'swamp', '연꽃 연못', 'hardW8x5', 8],
  ['yard', 'lotusthrone', 'M', 'swamp', '황금 연꽃', 'masterFirstX10', 8],
  ['yard', 'crystaltree', 'L', 'crystal', '수정 나무', 'hardFirstX10', 9],
  ['yard', 'torches', 'c', 'castle', '쌍둥이 횃불', 'normalW10', 10],
  ['yard', 'fountain', 'f', 'castle', '분수대', 'normalW10x5', 10],
  ['yard', 'knightstatue', 'r', 'castle', '기사 동상', 'hardW10x5', 10],
  ['yard', 'treasure', 'L', null, '보물 상자 더미', 'hardReplay', null],
  ['yard', 'starfountain', 'M', null, '별빛 분수', 'masterReplay', null],
];

function priceFor(slot, id, tier, from, w) {
  const key = `${slot}:${id}`, old = PRICE.old[key];
  if (old) return { coin: old.coin || 0, gem: old.gem || 0 };
  if (PRICE.start[key]) return { coin: PRICE.start[key], gem: 0 };
  if (tier === 'common' || tier === 'fine') return { coin: PRICE.normal[w][tier === 'common' ? 0 : 1], gem: 0 };
  if (tier === 'rare') return { coin: PRICE.rare[w][0], gem: PRICE.rare[w][1] };
  if (tier === 'hero') return { coin: 0, gem: PRICE.hero[w] };
  return null;   // 전설 · 신화 = 판매 안 함
}

/** 꾸미기 184개 (화면 순서) */
export const CATALOG = ROWS.map(([slot, id, t, theme, name, from, w]) => {
  const tier = TIER_OF[t];
  return { id, slot, key: `${slot}:${id}`, tier, star: TIERS.indexOf(tier) + 1, theme, name, price: priceFor(slot, id, tier, from, w), from, w, vis: tier === 'myth' ? 'master' : 'all' };
});
export const CATALOG_BY_KEY = Object.fromEntries(CATALOG.map((r) => [r.key, r]));
export const itemOf = (key) => CATALOG_BY_KEY[key] || null;
/** 등급 → 테 색 (도트) · 별 수 — 화면은 색 테 + ★ 수를 크게, 등급 이름은 작게 (§10) */
export const TIER_COLOR = { common: '#9aa0a8', fine: '#5ac85a', rare: '#4a9cff', hero: '#a86cff', legend: '#ff9a2e', myth: 'rainbow' };

/* ───────── 대장 드래곤 변신 모습 20 (붉은 10 · 보라 10) ───────── */
/** 대장 드래곤 순서 = 월드 번호 순 (어려움 / 초고수 w-10 첫 클리어에 w번째 대장 드래곤의 모습) */
export const LEAD_ORDER = ['novart', 'aquantis', 'forestia', 'crimsonde', 'volttail', 'solaris', 'sandscale', 'shadowfen', 'frostwing', 'goldrex'];
export const LEAD_FORMS = LEAD_ORDER.flatMap((lead, i) => [
  { id: `red_${lead}`, lead, kind: 'red', name: `붉은 ${LEADERS[lead]?.ko || lead}`, from: 'hardFirstX10', w: i + 1, vis: 'all' },
  { id: `purple_${lead}`, lead, kind: 'purple', name: `보라 ${LEADERS[lead]?.ko || lead}`, from: 'masterFirstX10', w: i + 1, vis: 'master' },
]);

/* ───────── «?» 비밀 드래곤 6 (§8 · 지시서 §4) — 부화장 뽑기에서 빠진다(rar 'secret' · 'myth') ───────── */
/**
 * card = 숫자 카드 초안 (지금 전설 3마리와 같은 힘의 띠 · 이미 있는 효과만) — 전투 코어 반영은 ⑤ 에서 계산기 data.js 로 옮긴다.
 * span = 실루엣이 밝아지는 판 범위 (그 난이도에서 이 판들을 깰 때마다 한 조각씩)
 */
export const MYSTERY = [
  { id: 'secret01', name: '붉은별', rar: 'secret', from: 'hardFirstX10', w: 3, span: [1, 30], vis: 'all', line: '하늘에서 작은 별똥을 떨어뜨려요',
    card: { cost: 1000, cd: 18, hp: 700, atk: 260, range: 360, ld: [180, 480], speed: 62, fore: 0.9, back: 1.8, kb: 2, area: true, splash: 40, poison: 0.02,
      forms: { 1: { name: '쌍붉은별', ld: [160, 520] }, 2: { name: '붉은 유성우', weaken: { chance: 0.4, time: 3 } } } } },
  { id: 'secret02', name: '쇠사슬룡', rar: 'secret', from: 'hardFirstX10', w: 6, span: [31, 60], vis: 'all', line: '사슬로 묶어 좀비 무리를 밀어내요',
    card: { cost: 900, cd: 15, hp: 1800, atk: 100, range: 90, speed: 60, fore: 0.5, back: 1.0, kbImmune: true, area: true, splash: 40, knock: 0.45, slow: { chance: 0.5, time: 2 },
      forms: { 1: { name: '쇠사슬 대장', knock: 0.55 }, 2: { name: '강철 사슬룡', freeze: { chance: 0.2, time: 1.5 } } } } },
  { id: 'secret03', name: '불새룡', rar: 'secret', from: 'hardFirstX10', w: 9, span: [61, 90], vis: 'all', line: '쓰러져도 한 번 불꽃 속에서 되살아나요',
    card: { cost: 950, cd: 16, hp: 700, atk: 120, range: 160, speed: 80, fore: 0.35, back: 0.6, kb: 2, area: true, splash: 40, purify: true, revive: { delay: 3, hp: 0.5 },
      forms: { 1: { name: '불사조룡', revive: { delay: 2.5, hp: 0.6 } }, 2: { name: '황금 불새룡', crit: 0.1 } } } },
  { id: 'myth01', name: '별자리룡', rar: 'myth', from: 'masterFirstX10', w: 4, span: [1, 40], vis: 'master', line: '별빛 방패를 두르고 좀비를 약하게 해요',
    card: { cost: 1000, cd: 17, hp: 1000, atk: 130, range: 200, speed: 70, fore: 0.5, back: 0.9, kb: 2, area: true, splash: 50, weaken: { chance: 0.4, time: 3 }, barrier: 300,
      forms: { 1: { name: '큰곰자리룡', weaken: { chance: 0.5, time: 3 } }, 2: { name: '은하수룡', barrier: 500 } } } },
  { id: 'myth02', name: '무지개룡', rar: 'myth', from: 'masterFirstX10', w: 7, span: [41, 70], vis: 'master', line: '무지개 불이 뒤의 좀비까지 꿰뚫고 번져요',
    card: { cost: 1050, cd: 18, hp: 750, atk: 200, range: 240, speed: 70, fore: 0.6, back: 1.2, kb: 3, wave: 200, poison: 0.02,
      forms: { 1: { name: '쌍무지개룡', wave: 280 }, 2: { name: '일곱빛 무지개룡', crit: 0.15 } } } },
  { id: 'myth03', name: '째깍룡', rar: 'myth', from: 'masterFirstX10', w: 10, span: [71, 100], vis: 'master', line: '째깍! 좀비들을 잠깐 멈춰 세워요',
    card: { cost: 1100, cd: 20, hp: 1100, atk: 110, range: 220, speed: 60, fore: 0.6, back: 1.2, kb: 2, area: true, splash: 60, freeze: { chance: 0.35, time: 2 }, survive: true,
      forms: { 1: { name: '모래시계룡', freeze: { chance: 0.45, time: 2 } }, 2: { name: '시간의 째깍룡', splash: 90 } } } },
];
export const MYSTERY_IDS = MYSTERY.map((m) => m.id);
/** 부화장 뽑기 · 확률 · «부화장에서 태어나요» 에 넣지 않는 등급 */
export const NO_HATCH_RAR = ['secret', 'myth'];

/* ───────── 진행 읽기 (저장값 g = idg) ───────── */
const starAt = (s, g) => Number((typeof s === 'string' ? s : '')[g - 1]) || 0;
const bitAt = (s, g) => (typeof s === 'string' ? s : '')[g - 1] === '1';
const run = (s) => { let n = 0; while (n < 100 && starAt(s, n + 1) > 0) n++; return n; };
const sumStr = (s) => [...(typeof s === 'string' ? s : '')].reduce((a, c) => a + (Number(c) || 0), 0);
/** 초고수 관련(신화 · 보라 모습 · 초고수 «?»)을 보여도 되는 계정 = 보통 10-10 깸 */
export const seesMaster = (g) => MASTER_ON && (g?.cleared || 0) >= 100;   // 초고수 꺼짐 (11/13)
/** 초고수가 열린 계정 = 어려움 10-10 깸 (난이도 §A-1 · diffUnlocked 와 같은 셈) */
export const masterOpen = (g) => MASTER_ON && run(g?.hardStars) >= 100;
const stageNo = (w, s) => (w - 1) * 10 + s;
const label = (w, s) => `${w}-${s}`;
/** 숫자 뒤 을/를 (끝 숫자 읽기 : 0 영/십 · 1 일 · 3 삼 · 6 육 · 7 칠 · 8 팔 → 을) */
const eul = (n) => ([0, 1, 3, 6, 7, 8].includes(Number(String(n).slice(-1))) ? '을' : '를');
const owns = (g, key) => Array.isArray(g?.owned) && g.owned.includes(key);

/** 이 물건의 조건이 채워졌나 — 샵 품목이면 «샵에 열림», 보상 품목이면 «받을 자격» */
export function condMet(row, g) {
  const f = row.from;
  if (f === 'start') return true;
  let m = /^normalW(\d+)(x5)?$/.exec(f);
  if (m) return (g?.cleared || 0) >= (m[2] ? stageNo(+m[1], 5) : stageNo(+m[1], 10));
  m = /^hardW(\d+)x(5|10)$/.exec(f);
  if (m) return starAt(g?.hardStars, stageNo(+m[1], +m[2])) > 0;
  if (f === 'hardFirstX5') return bitAt(g?.hardWon, stageNo(row.w, 5));
  if (f === 'hardFirstX10') return bitAt(g?.hardWon, stageNo(row.w, 10));
  if (f === 'masterFirstX10') return starAt(g?.masterStars, stageNo(row.w, 10)) > 0;
  if (f === 'stars900') return sumStr(g?.stars) + sumStr(g?.hardStars) + sumStr(g?.masterStars) >= 900;
  return false;   // 다시 깨기 전용 = 떨어질 때만
}
/** 샵에서 살 수 있게 열렸나 (판매 품목 + 조건) */
export const isOpen = (row, g) => !BLOCKED.has(row.key) && !!row.price && condMet(row, g) && (row.vis === 'all' || seesMaster(g));

/** 잠긴 카드 한 줄 (vis 'master' 물건은 초고수가 열리기 전까지 «어려움 10-10 뒤의 도전» 으로만) */
export function lockText(row, g) {
  if (BLOCKED.has(row.key)) return BLOCK_TEXT;
  const f = row.from;
  let m = /^normalW(\d+)$/.exec(f);
  if (m) return `보통 월드 ${m[1]}${eul(m[1])} 깨면 열려요`;
  m = /^normalW(\d+)x5$/.exec(f);
  if (m) return `보통 ${label(m[1], 5)}${eul(5)} 깨면 열려요`;
  m = /^hardW(\d+)x(5|10)$/.exec(f);
  if (m) return `어려움 ${label(m[1], m[2])}${eul(m[2])} 깨면 열려요`;
  if (f === 'hardFirstX5' || f === 'hardFirstX10') { const s = f === 'hardFirstX5' ? 5 : 10; return `어려움 ${label(row.w, s)}${eul(s)} 처음 깨면 받아요`; }
  if (f === 'hardReplay') return '어려움 보스에게서 나와요';
  if (f === 'masterFirstX10') return masterOpen(g) ? `초고수 ${label(row.w, 10)}${eul(10)} 처음 깨면 받아요` : '어려움 10-10 뒤의 도전에서 나와요';
  if (f === 'masterReplay') return masterOpen(g) ? '초고수 보스에게서 나와요' : '어려움 10-10 뒤의 도전에서 나와요';
  if (f === 'stars900') return '별 900개를 모으면 받아요';
  return '';
}

/**
 * 보이는 법 — 모든 화면(샵 · 꾸미기 창 · 도감 · 다음 목표 · 레벨 선물 · 특가)이 이 함수 하나로 거른다 (§10 «숨김»).
 * 보통 10-10 을 못 깬 계정 : vis 'master' 물건은 아예 빠진다(목록 · 개수 · %).
 */
export const visibleLooks = (g) => CATALOG.filter((r) => r.vis === 'all' || seesMaster(g));
/** 물건 한 장의 모습 : 'owned' 가짐 · 'open' 살 수 있음 · 'locked' 자물쇠 + lockText · 'reward' 보스에게서(전설) · 'shadow' «???» 그림자(신화 · 초고수 전) · 'hidden' */
export function itemView(row, g) {
  if (row.vis === 'master' && !seesMaster(g)) return 'hidden';
  if (BLOCKED.has(row.key)) return 'locked';   /* 가졌어도 잠김 (11/14) */
  if (owns(g, row.key)) return 'owned';
  if (isOpen(row, g)) return 'open';
  if (row.vis === 'master' && !masterOpen(g)) return 'shadow';
  return row.price ? 'locked' : 'reward';
}
/** 꾸미기 도감 «모은 수 37 / 184» (못 보는 계정은 분모에서 신화를 뺀다) */
export function lookCount(g) {
  const list = visibleLooks(g);
  return { have: list.filter((r) => owns(g, r.key)).length, total: list.length };
}
/** 테마 세트 완성 (같은 테마를 다 가짐) — 칭호 · 로비 눈요기 색 */
export const themeDone = (g, theme) => visibleLooks(g).filter((r) => r.theme === theme).every((r) => owns(g, r.key));

/**
 * «?» 드래곤 보이는 법 (§8 표) — 도감 · 파워업 카드 목록 · 부화장 목록이 이 함수만 거친다.
 * 돌려줌 { show: 'hidden'|'card'|'silhouette'|'owned', name, text, lit(0~1, 실루엣 밝기 · 10조각) }
 * - 보통 10-10 전 : 어려움 «?» 는 카드 1장만(첫 마리) · 나머지 · 초고수 «?» 는 안 보임 (몇 마리인지 안 알려 줌)
 * - 어려움에 들어감 : 어려움 «?» = 실루엣 · 초고수 «?» = 카드 1장(첫 마리)만
 * - 초고수에 들어감 : 초고수 «?» = 실루엣
 */
export function mysteryView(g, id) {
  const m = MYSTERY.find((x) => x.id === id);
  if (!m) return { show: 'hidden' };
  if (g?.units?.[id]) return { show: 'owned', name: m.name, text: m.line, lit: 1 };
  const first = MYSTERY.find((x) => x.rar === m.rar) === m;
  const card = { show: 'card', name: '???', text: '아직 아무도 본 적 없는 드래곤', lit: 0 };
  if (m.rar === 'secret') {
    if (!seesMaster(g)) return first ? card : { show: 'hidden' };
    return { show: 'silhouette', name: '???', text: `어려움 ${label(m.w, 10)}에서 깨어나요`, lit: litOf(g?.hardWon, m.span, true) };
  }
  if (!seesMaster(g)) return { show: 'hidden' };
  if (!masterOpen(g)) return first ? { ...card, text: '어려움 10-10 뒤의 도전에서 깨어나요' } : { show: 'hidden' };
  return { show: 'silhouette', name: '???', text: `초고수 ${label(m.w, 10)}에서 깨어나요`, lit: litOf(g?.masterStars, m.span, false) };
}
function litOf(s, [a, b], isBits) {
  let n = 0;
  for (let i = a; i <= b; i++) if (isBits ? bitAt(s, i) : starAt(s, i) > 0) n++;
  return Math.floor((n / (b - a + 1)) * 10) / 10;
}

/* ───────── 레벨 선물 후보 (난이도 §C-5 · 모으기 §10) ───────── */
/** 레벨 선물 등급 · 확률 — «영웅 2»(옛 글의 «전설 2%» = 이 표의 영웅). 전설 · 신화 · 변신 모습은 후보에서 뺀다 */
export const GIFT_TIERS = [{ id: 'common', p: 60 }, { id: 'fine', p: 28 }, { id: 'rare', p: 10 }, { id: 'hero', p: 2 }];
/** 등급별 후보 열쇠 — 샵에 **열린 것** 중 안 가진 것만 (vis 'all' 만). 레벨 선물 전용 칭호 · 테두리는 looks.js 가 더한다 */
export function giftCandidates(g) {
  const P = { common: [], fine: [], rare: [], hero: [] };
  for (const r of CATALOG) if (P[r.tier] && r.vis === 'all' && isOpen(r, g) && !owns(g, r.key)) P[r.tier].push(r.key);
  return P;
}
/** 오늘의 특가 후보 — 열린 것 중 안 가진 것 (§10 특가) */
export const dealCandidates = (g) => CATALOG.filter((r) => isOpen(r, g) && !owns(g, r.key)).map((r) => r.key);

/* ───────── 자기 검사 (lookFx 와 같은 id · 등급) — 어긋나면 불러올 때 바로 알게 ───────── */
for (const r of CATALOG) {
  const f = LOOK_FX[r.key];
  if (!f || TIERS[f.tier - 1] !== r.tier) throw new Error(`[catalog] lookFx 와 다름 : ${r.key}`);
}
if (Object.keys(LOOK_FX).length !== CATALOG.length || Object.values(SLOT_IDS).flat().length !== CATALOG.length + 1) throw new Error('[catalog] lookFx 개수와 다름');
