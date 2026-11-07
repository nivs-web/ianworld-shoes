/**
 * 줄넘기 챔피언 — 표(데이터)만 있는 파일. (2026-11-07, 이안오락실 5번째 게임)
 *
 * 스테이지 10 · 배경 10 · 줄넘기 27 · 꾸미기 부품 · 아이템 · 난이도.
 * 화면(로비·상점)과 게임이 같이 읽는다 — 그림·소리는 여기 없다.
 * 기획·스펙: `docs/JUMPROPE_PLAN.md`
 */

export const GAME_NAME = '줄넘기 챔피언';

/* ---------- 난이도 (스테이지 · 무한 줄넘기 공통) ---------- */
/**
 * 쉬움 · 보통 · 어려움 — 판정 여유 · 빠르기 · 하트 · 도우미 링 · 보상 배율.
 * 기본 스테이지는 난이도를 따르고, «내가 만든 스테이지»는 만든 사람이 정한 값을 그대로 쓴다.
 */
export const DIFFS = {
  easy: { label: '쉬움', judge: 'e', speed: -1, hearts: 1, ring: true, reward: 1 },
  normal: { label: '보통', judge: 'n', speed: 0, hearts: 0, ring: null, reward: 1.5 },
  hard: { label: '어려움', judge: 'h', speed: 1, hearts: -1, ring: false, reward: 2 },
};
export const DIFF_KEYS = ['easy', 'normal', 'hard'];

/* ---------- 배경 10 ---------- */
export const THEMES = [
  { name: '동네 운동장' },
  { name: '놀이터' },
  { name: '학교 체육관' },
  { name: '분수 공원' },
  { name: '여름 바닷가' },
  { name: '노을 옥상' },
  { name: '비 오는 날' },
  { name: '별빛 밤하늘' },
  { name: '눈 오는 마을' },
  { name: '줄넘기 대회' },
];

/* ---------- 스테이지 10 ---------- */
/**
 * 조각: s 같은 박자{v} · r 랜덤{a~b} · u 빨라지기/느려지기{a→b} · f 멈칫{v} · d 2단 뛰기{v}
 * 빠르기 1 = 한 바퀴 1.00초 … 10 = 0.55초 (`engine.rotT`)
 */
export const STAGES = [
  { no: 1, name: '동네 운동장', theme: 0, hearts: 3, ring: true, intro: '같은 박자로 20번! 줄이 발밑에 올 때 뛰어요.',
    segs: [{ k: 's', n: 20, v: 2 }] },
  { no: 2, name: '놀이터', theme: 1, hearts: 3, ring: true, intro: '박자가 살짝 흔들려요. 줄을 끝까지 보고 뛰어요.',
    segs: [{ k: 's', n: 10, v: 2 }, { k: 'r', n: 15, a: 2, b: 3 }] },
  { no: 3, name: '학교 체육관', theme: 2, hearts: 3, ring: true, intro: '줄이 점점 빨라져요!',
    segs: [{ k: 's', n: 8, v: 2 }, { k: 'u', n: 12, a: 2, b: 5 }, { k: 's', n: 10, v: 5 }] },
  { no: 4, name: '분수 공원', theme: 3, hearts: 3, ring: true, intro: '빨라졌다 느려졌다, 넓은 랜덤 박자.',
    segs: [{ k: 's', n: 6, v: 3 }, { k: 'u', n: 8, a: 5, b: 2 }, { k: 'r', n: 18, a: 2, b: 5 }] },
  { no: 5, name: '여름 바닷가', theme: 4, hearts: 3, ring: true, intro: '«멈칫!» 줄이 머리 위에서 멈췄다 내려와요. 기다렸다 뛰어요.',
    segs: [{ k: 's', n: 8, v: 3 }, { k: 'f', n: 3, v: 3 }, { k: 's', n: 8, v: 3 }, { k: 'f', n: 4, v: 4 }, { k: 'r', n: 12, a: 3, b: 5 }] },
  { no: 6, name: '노을 옥상', theme: 5, hearts: 3, ring: true, intro: '«2단 뛰기!» 버튼을 꾹 눌러 높이 뛰면 줄이 두 번 지나가요.',
    segs: [{ k: 's', n: 8, v: 3 }, { k: 'd', n: 3, v: 3 }, { k: 's', n: 8, v: 4 }, { k: 'd', n: 4, v: 4 }, { k: 'r', n: 6, a: 3, b: 5 }] },
  { no: 7, name: '비 오는 날', theme: 6, hearts: 3, ring: false, intro: '도우미 링이 꺼져요. 랜덤 박자와 멈칫이 섞여요.',
    segs: [{ k: 's', n: 6, v: 4 }, { k: 'r', n: 10, a: 3, b: 6 }, { k: 'f', n: 4, v: 4 }, { k: 'r', n: 10, a: 4, b: 7 }, { k: 'f', n: 4, v: 5 }, { k: 's', n: 6, v: 5 }] },
  { no: 8, name: '별빛 밤하늘', theme: 7, hearts: 3, ring: false, intro: '빠르게 빨라지고, 2단 뛰기까지!',
    segs: [{ k: 's', n: 6, v: 4 }, { k: 'u', n: 10, a: 3, b: 7 }, { k: 'd', n: 3, v: 5 }, { k: 's', n: 6, v: 6 }, { k: 'u', n: 8, a: 6, b: 8 }, { k: 'd', n: 3, v: 6 }] },
  { no: 9, name: '눈 오는 마을', theme: 8, hearts: 3, ring: false, intro: '지금까지 나온 것이 전부 섞여요.',
    segs: [{ k: 's', n: 6, v: 5 }, { k: 'r', n: 8, a: 4, b: 7 }, { k: 'f', n: 3, v: 5 }, { k: 'd', n: 3, v: 5 }, { k: 'u', n: 8, a: 5, b: 8 }, { k: 'r', n: 8, a: 5, b: 8 }, { k: 'f', n: 3, v: 6 }, { k: 'd', n: 2, v: 6 }] },
  { no: 10, name: '줄넘기 대회', theme: 9, hearts: 3, ring: false, intro: '마지막 무대! 관중 앞에서 52번을 넘어요.',
    segs: [{ k: 's', n: 8, v: 5 }, { k: 'u', n: 8, a: 5, b: 8 }, { k: 'd', n: 3, v: 6 }, { k: 'f', n: 3, v: 6 }, { k: 'r', n: 10, a: 6, b: 9 }, { k: 'd', n: 3, v: 7 }, { k: 'u', n: 6, a: 9, b: 6 }, { k: 'f', n: 3, v: 7 }, { k: 's', n: 2, v: 8 }] },
];

/* ---------- 줄넘기 27 ---------- */
/**
 * 모양만 다르다 — 판정 · 점수는 그대로라 명예의 전당이 공평하다.
 * pattern: solid · stripe · dots · rainbow · glow · gradient · beads
 * trail(꼬리 효과): spark · star · heart · fire · bubble · snow · note · leaf · thunder · candy
 * get: { start } 처음부터 · { lv } 레벨 보상 · { price } 상점(별사탕) · { stage10 } · { endless100 } · { stars30 }
 * snd: 줄 소리 높낮이(1 = 보통)
 */
export const ROPES = [
  { id: 'red', name: '빨강 줄넘기', c1: '#e8423a', c2: '#ff9a8a', handle: '#7a1d14', pattern: 'solid', get: { start: true }, snd: 1 },
  { id: 'blue', name: '파랑 줄넘기', c1: '#3a7be8', c2: '#9cc4ff', handle: '#1a3a7a', pattern: 'solid', get: { start: true }, snd: 0.95 },
  { id: 'green', name: '초록 줄넘기', c1: '#3fbf5a', c2: '#a8f0b8', handle: '#1d5e2a', pattern: 'solid', get: { start: true }, snd: 1.05 },
  { id: 'yellow', name: '노랑 줄넘기', c1: '#f5c518', c2: '#fff1a0', handle: '#8a6a00', pattern: 'solid', get: { lv: 2 }, snd: 1.1 },
  { id: 'pink', name: '분홍 줄넘기', c1: '#ff6fb1', c2: '#ffd0e6', handle: '#9a2a62', pattern: 'solid', get: { lv: 3 }, snd: 1.15 },
  { id: 'purple', name: '보라 줄넘기', c1: '#9b5de5', c2: '#d9c2ff', handle: '#4a2380', pattern: 'gradient', get: { lv: 4 }, snd: 0.9 },
  { id: 'rainbow', name: '무지개 줄넘기', c1: '#ff4d4d', c2: '#4d79ff', handle: '#ffffff', pattern: 'rainbow', get: { lv: 5 }, snd: 1.2 },
  { id: 'cane', name: '사탕 줄무늬', c1: '#ffffff', c2: '#e8423a', handle: '#e8423a', pattern: 'stripe', get: { lv: 6 }, snd: 1.1 },
  { id: 'mint', name: '민트 초코', c1: '#7fe0c8', c2: '#6b3f1d', handle: '#3f2310', pattern: 'dots', get: { lv: 7 }, snd: 1 },
  { id: 'ocean', name: '바다 물결', c1: '#1fa2ff', c2: '#a6ffcb', handle: '#0b4f7a', pattern: 'gradient', trail: 'bubble', get: { lv: 8 }, snd: 0.85 },
  { id: 'star', name: '별빛 줄넘기', c1: '#28307a', c2: '#ffe066', handle: '#141a4a', pattern: 'dots', trail: 'star', get: { lv: 9 }, snd: 1.25 },
  { id: 'heart', name: '하트 줄넘기', c1: '#ff4f8b', c2: '#ffc2d8', handle: '#ffffff', pattern: 'stripe', trail: 'heart', get: { lv: 10 }, snd: 1.15 },
  { id: 'fire', name: '불꽃 줄넘기', c1: '#ff7a1a', c2: '#ffd23f', handle: '#5a1a00', pattern: 'glow', trail: 'fire', get: { lv: 12 }, snd: 0.8 },
  { id: 'snow', name: '눈송이 줄넘기', c1: '#e8f6ff', c2: '#8fd3ff', handle: '#5b8db8', pattern: 'glow', trail: 'snow', get: { lv: 13 }, snd: 1.3 },
  { id: 'gold', name: '황금 줄넘기', c1: '#ffcc33', c2: '#fff4b0', handle: '#8a5a00', pattern: 'glow', trail: 'spark', get: { lv: 14 }, snd: 1.05 },
  { id: 'thunder', name: '번개 줄넘기', c1: '#ffe14d', c2: '#222222', handle: '#222222', pattern: 'stripe', trail: 'thunder', get: { lv: 16 }, snd: 0.75 },
  { id: 'galaxy', name: '은하수 줄넘기', c1: '#3a0ca3', c2: '#f72585', handle: '#10002b', pattern: 'gradient', trail: 'star', get: { lv: 18 }, snd: 0.9 },
  { id: 'legend', name: '전설의 무지개', c1: '#ff4d4d', c2: '#ffffff', handle: '#ffd700', pattern: 'rainbow', trail: 'spark', glow: true, get: { lv: 20 }, snd: 1.2 },
  { id: 'lemon', name: '레몬 줄넘기', c1: '#fff35c', c2: '#7ac74f', handle: '#3f7a1d', pattern: 'dots', get: { price: 150 }, snd: 1.15 },
  { id: 'beads', name: '구슬 줄넘기', c1: '#ff6b6b', c2: '#4ecdc4', handle: '#2a2a2a', pattern: 'beads', get: { price: 300 }, snd: 1.35 },
  { id: 'leaf', name: '나뭇잎 줄넘기', c1: '#5cb85c', c2: '#c9f29b', handle: '#6b3f1d', pattern: 'gradient', trail: 'leaf', get: { price: 400 }, snd: 0.95 },
  { id: 'music', name: '음표 줄넘기', c1: '#222222', c2: '#ffffff', handle: '#ffffff', pattern: 'stripe', trail: 'note', get: { price: 600 }, snd: 1.4 },
  { id: 'neon', name: '네온 줄넘기', c1: '#00f5ff', c2: '#b8ffff', handle: '#003a40', pattern: 'glow', get: { price: 800 }, snd: 1.25 },
  { id: 'candy', name: '별사탕 줄넘기', c1: '#ffb3de', c2: '#b3e5ff', handle: '#ffffff', pattern: 'beads', trail: 'candy', get: { price: 1200 }, snd: 1.3 },
  { id: 'champion', name: '챔피언 줄넘기', c1: '#ffd700', c2: '#d7263d', handle: '#d7263d', pattern: 'stripe', trail: 'spark', get: { stage10: true }, snd: 1 },
  { id: 'hundred', name: '백 번 줄넘기', c1: '#ff3d00', c2: '#ffea00', handle: '#212121', pattern: 'rainbow', trail: 'fire', get: { endless100: true }, snd: 0.85 },
  { id: 'allstar', name: '올스타 줄넘기', c1: '#ffffff', c2: '#ffd23f', handle: '#3a7be8', pattern: 'glow', trail: 'star', get: { stars30: true }, snd: 1.2 },
];
export const ROPE_BY_ID = Object.fromEntries(ROPES.map((r) => [r.id, r]));

/** 얻는 법 한 줄 */
export function ropeHow(r) {
  const g = r.get || {};
  if (g.start) return '처음부터';
  if (g.lv) return `레벨 ${g.lv} 보상`;
  if (g.price) return `상점 · 별사탕 ${g.price}`;
  if (g.stage10) return '세계 선수권(대회 5) 완주';
  if (g.endless100) return '무한 줄넘기 100개 넘기';
  if (g.stars30) return '한 난이도에서 별 15개 모으기';
  return '';
}

/* ---------- 꾸미기 ---------- */
/**
 * 부품마다 { id(번호=배열 자리), name, get } — get 이 없으면 처음부터.
 * 모습 한 줄(`encodeLook`)은 번호를 36진수 한 글자씩 이어 붙인 것 — 명예의 전당에 그대로 싣는다.
 */
export const SKINS = [
  { name: '밝은 피부', c: '#ffe0c2', s: '#f2bf98' },
  { name: '보통 피부', c: '#f5c99b', s: '#d9a273' },
  { name: '구릿빛 피부', c: '#d69a6a', s: '#b57a4c' },
  { name: '진한 피부', c: '#8d5a3b', s: '#6e432a' },
];
export const HAIR_STYLES = [
  { name: '짧은 머리' }, { name: '단발' }, { name: '양갈래' }, { name: '포니테일' }, { name: '곱슬머리' }, { name: '뾰족머리' },
];
export const HAIR_COLORS = [
  { name: '검정', c: '#2a1d15' }, { name: '갈색', c: '#6b3f1d' }, { name: '금발', c: '#e8c35a' },
  { name: '빨강', c: '#c8402e' }, { name: '파랑', c: '#3a6fd8', get: { lv: 3 } }, { name: '분홍', c: '#ff7fbf', get: { lv: 5 } },
];
export const EYES = [{ name: '동글 눈' }, { name: '웃는 눈' }, { name: '윙크' }, { name: '반짝 눈', get: { lv: 4 } }];
export const SHIRTS = [
  { name: '빨강 티셔츠', c: '#e8423a', p: 'plain' },
  { name: '파랑 티셔츠', c: '#3a7be8', p: 'plain' },
  { name: '노랑 티셔츠', c: '#f5c518', p: 'plain' },
  { name: '초록 티셔츠', c: '#3fbf5a', p: 'plain' },
  { name: '줄무늬 티셔츠', c: '#ffffff', c2: '#3a7be8', p: 'stripe', get: { lv: 3 } },
  { name: '별 티셔츠', c: '#28307a', c2: '#ffe066', p: 'star', get: { price: 200 } },
  { name: '하트 티셔츠', c: '#ffd0e6', c2: '#ff4f8b', p: 'heart', get: { price: 200 } },
  { name: '체육복', c: '#1d3f8a', c2: '#ffffff', p: 'sport', get: { lv: 6 } },
  { name: '등번호 유니폼', c: '#d7263d', c2: '#ffffff', p: 'number', get: { price: 300 } },
  { name: '황금 조끼', c: '#ffcc33', c2: '#8a5a00', p: 'sport', get: { lv: 15 } },
];
export const PANTS = [
  { name: '파랑 반바지', c: '#2f5fb3', p: 'shorts' },
  { name: '검정 반바지', c: '#2a2a2a', p: 'shorts' },
  { name: '분홍 치마', c: '#ff7fbf', p: 'skirt' },
  { name: '청바지', c: '#4a6fa5', p: 'long', get: { lv: 4 } },
  { name: '체육복 바지', c: '#1d3f8a', c2: '#ffffff', p: 'long', get: { lv: 6 } },
  { name: '무지개 치마', c: '#ff4d4d', p: 'rainbow', get: { price: 250 } },
];
export const SHOES = [
  { name: '흰 운동화', c: '#f4f4f4', s: '#c9c9c9' },
  { name: '빨강 운동화', c: '#e8423a', s: '#9a2017' },
  { name: '파랑 운동화', c: '#3a7be8', s: '#1d3f8a', get: { lv: 2 } },
  { name: '반짝 금 운동화', c: '#ffcc33', s: '#b8860b', fx: 'spark', get: { price: 300 } },
  { name: '별 운동화', c: '#28307a', s: '#141a4a', fx: 'star', get: { price: 500 } },
  { name: '로켓 운동화', c: '#9aa7b8', s: '#5a6678', fx: 'rocket', get: { lv: 15 } },
];
export const HATS = [
  { name: '모자 없음' },
  { name: '야구 모자', c: '#e8423a' },
  { name: '헤드밴드', c: '#ffffff' },
  { name: '리본', c: '#ff4f8b' },
  { name: '비니', c: '#3fbf5a', get: { lv: 5 } },
  { name: '꽃핀', c: '#ffd23f', get: { lv: 8 } },
  { name: '고양이 귀', c: '#2a2a2a', get: { price: 250 } },
  { name: '토끼 귀', c: '#ffffff', get: { price: 250 } },
  { name: '왕관', c: '#ffd700', get: { lv: 20 } },
];
export const EMOJIS = ['😀', '😎', '🤩', '😆', '🥳', '😺', '🐰', '🔥', '⭐', '💪'];

/**
 * 가면 — 상점에서 팔지 않는다. **최고 콤보 기록**이 combo 에 닿으면 선물로 받는다(2026-11-07 권반장).
 * 뒤로 갈수록 화려하다: 천(1~3) → 광택 검정 · 박쥐 귀(4) → 금속(5) → 흐르는 무지개(6) → 뿔 · 왕관 · 오라(7).
 * 실존 영웅 디자인 · 로고는 쓰지 않는다 — 전부 이안오락실 오리지널.
 * get.combo 는 hasPart 가 모르는 조건이라 기본은 «잠김» — 콤보 기록으로 여는 건 총괄이 붙인다.
 */
export const MASKS = [
  { id: 'none', name: '없음', combo: 0 },
  { id: 'eye', name: '눈복면', combo: 30, get: { combo: 30 }, desc: '눈만 쏙 가린 빨간 천 복면 — 끈이 바람에 펄럭!' },
  { id: 'mask', name: '마스크', combo: 60, get: { combo: 60 }, desc: '상어 이빨이 씨익 웃는 남색 천 마스크' },
  { id: 'ninja', name: '얼굴복면', combo: 90, get: { combo: 90 }, desc: '눈만 빼고 꽁꽁 — 빨간 머리띠가 길게 휘날리는 닌자 복면' },
  { id: 'bat', name: '박쥐 가면', combo: 150, get: { combo: 150 }, desc: '반짝반짝 검은 광택에 뾰족한 박쥐 귀, 하얗게 빛나는 눈' },
  { id: 'steel', name: '강철 가면', combo: 200, get: { combo: 200 }, desc: '빨강·금 강철 얼굴판, 눈에서 파란 빛이 번쩍' },
  { id: 'rainbow', name: '무지개 가면', combo: 250, get: { combo: 250 }, desc: '무지개가 쉬지 않고 흐르는 날개 가면' },
  { id: 'boss', name: '최종보스 가면', combo: 300, get: { combo: 300 }, desc: '뿔 · 왕관 · 보석에 보랏빛 불꽃 오라 — 콤보 300의 최종 보스!' },
];

/** 꾸미기 칸 — 순서가 곧 모습 한 줄의 글자 순서다(바꾸면 예전 모습이 틀어진다) */
export const LOOK_PARTS = [
  { key: 'skin', name: '피부', list: SKINS },
  { key: 'hair', name: '머리 모양', list: HAIR_STYLES },
  { key: 'hairColor', name: '머리 색', list: HAIR_COLORS },
  { key: 'eyes', name: '눈', list: EYES },
  { key: 'shirt', name: '윗옷', list: SHIRTS },
  { key: 'pants', name: '아래옷', list: PANTS },
  { key: 'shoes', name: '신발', list: SHOES },
  { key: 'hat', name: '모자', list: HATS },
  { key: 'emoji', name: '표정', list: EMOJIS.map((e) => ({ name: e })) },
  { key: 'mask', name: '가면', list: MASKS },     // 맨 끝 — 예전 모습 한 줄(가면 글자 없음)은 0 으로 읽힌다
];
export const DEFAULT_LOOK = { skin: 0, hair: 0, hairColor: 0, eyes: 0, shirt: 0, pants: 0, shoes: 0, hat: 1, emoji: 0, mask: 0 };

export function encodeLook(look) {
  const L = { ...DEFAULT_LOOK, ...(look || {}) };
  return 'j' + LOOK_PARTS.map((p) => Math.max(0, Math.min(35, L[p.key] | 0)).toString(36)).join('');
}
export function decodeLook(code) {
  const out = { ...DEFAULT_LOOK };
  const s = typeof code === 'string' && code[0] === 'j' ? code.slice(1) : '';
  LOOK_PARTS.forEach((p, i) => {
    const v = parseInt(s[i] ?? '', 36);
    if (Number.isInteger(v) && v >= 0 && v < p.list.length) out[p.key] = v;
  });
  return out;
}

/* ---------- 아이템 (한 판에 하나씩 쓴다) ---------- */
export const ITEMS = [
  { id: 'shield', name: '보호막', desc: '한 번 걸려도 하트를 잃지 않아요', price: 30 },
  { id: 'heart', name: '하트 하나 더', desc: '하트 하나를 더 들고 시작해요', price: 40 },
  { id: 'candy2', name: '별사탕 두 배', desc: '이번 판에 받는 별사탕이 두 배', price: 50 },
];
export const ITEM_MAX = 9;
