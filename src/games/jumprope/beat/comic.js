/**
 * 줄넘기 챔피언 · ROPE BEAT — 코믹 연출 엔진. **픽셀아트(도트) 전용.** (2026-11-07, 코믹 연출 도트 아티스트)
 *
 * > 권반장: «재밌으라고 만든 게임인데 너무 재미가 없어 … 1초에 한 번씩 여기저기서 재밌는 요소들이 나와야 해»
 *
 * 규칙: 정수 좌표 fillRect 도트만(벡터 · 안티앨리어싱 · 이미지 없음). 진한 외곽선 OUT + 2~3단 명암.
 * 반투명은 번개 번쩍(한두 프레임)에만. 실존 캐릭터 · 브랜드 없음 — 동물 · 사람 전부 오리지널.
 *
 * ## 쓰는 법 (본체 rhythm.js)
 *   const comic = createComic({ seed, arena, look });       // look(선택) = 선수 모습 객체 · 모습 한 줄 — 피부색 · 가면을 바로 안다
 *   comic.update(dt, ctx)        // 매 프레임. ctx = { t, songT, beat, bpm, phase, W, H, hudH, floorY, kx, K, xL, xR, laneW, jumpOnly, combo, hp, fever, lift, theta }
 *   comic.event(name, data)      // 'perfect' 'great' 'good' 'miss' 'trip' 'combo'(data.n) 'fever' 'speedup' 'slowdown' 'start' 'clear' 'fail'
 *   comic.drawBack(c)            // 배경 바로 뒤 — 하늘 · 날씨 · 관중 소동 · 뒤에 나타나는 동물/꼬마
 *   comic.drawFront(c)           // 노트 · 판정 원 다음 — 비 · 눈 · 번쩍 · 줄 가까이 온 새 · 의성어 · 줄 바닥 «탁!» · 착지 «퍽»  (레인은 잘라 내고 그린다)
 *   comic.drawFace(k, x, fy, pose)  // 선수 1배 캔버스에 drawKid 바로 뒤 — 땀 · 김 · 빨간 얼굴 · 화난 눈썹 · 검어진 얼굴 · 표정 순환 …
 *   comic.bob()   → {dx, dy}     // 고개 까딱 — **버퍼 도트** 단위(0 · ±1, 드물게 ±2). 본체가 선수 전체를 옮긴다
 *   comic.shake() → 0~2          // 화면 흔들림 세기(버퍼 도트). 프레임마다 2·0·1·0… 처럼 출렁이니 본체는 그대로 더하면 된다
 *   comic.force(type)            // (미리보기용) 연출 하나를 바로 시작 · comic.types() = 연출 이름 목록
 *
 * 스케줄러: 평균 1초에 하나씩(0.6~1.4초) 무언가 새로 시작한다. 갈래(하늘 · 날씨 · 땅 · 관중 · 앞 · 얼굴)마다 동시에 나올 수 있는 수가 있고,
 * 같은 연출은 최근 7개 안에 다시 안 나온다. 게임 상황(MISS · 걸림 · 콤보 · 빨라짐 · 피버 · 체력)에 반응해 바로 끼어드는 연출도 있다.
 */

import { rect, px, oval, rbox, line, tone, canvas, OUT, spinView, BEAT_POSES } from '../art.js';
import { SKINS, decodeLook } from '../data.js';
import { setCrowdMood, ptext, textW } from './beatArt.js';

const ro = Math.round, fl = Math.floor;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const BEAT_SET = new Set(BEAT_POSES);
const MC = '#7a2a1a';                 // 입 선 (art.js 와 같은 색)
const WATER = '#7fd0ff', WATER_L = '#d8f4ff';
const RAIN7 = ['#ff4d4d', '#ff9a1a', '#ffe14d', '#4dd27a', '#4dc3ff', '#5a6dff', '#c45cff'];

/** 위치마다 같은 값이 나오는 난수 */
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; }
function rng(seed) { let a = (seed | 0) || 0x9e3779b9; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- 바둑판 디더링 패턴 ---------- */
const patCache = new WeakMap();
function pat(c, col, n = 2) {
  let m = patCache.get(c);
  if (!m) { m = new Map(); patCache.set(c, m); }
  const k = col + n;
  let p = m.get(k);
  if (!p) {
    /* 2 = 바둑판(50%) · 3 = 두 칸마다 한 점(25%) · 4 = 네 칸 격자에 두 점(12.5%) — 사선 무늬가 안 생기게 */
    const sz = n === 2 ? 2 : n === 3 ? 2 : 4;
    const tile = canvas(sz, sz);
    const g = tile.getContext('2d');
    g.fillStyle = col;
    if (n === 2) { g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1); }
    else if (n === 3) g.fillRect(0, 0, 1, 1);
    else { g.fillRect(0, 0, 1, 1); g.fillRect(2, 2, 1, 1); }
    p = c.createPattern(tile, 'repeat');
    m.set(k, p);
  }
  return p;
}

/* ---------- 문자열 도트 그림 — 한 번 구워 두고 drawImage (flip = 좌우 뒤집기) ---------- */
const sprCv = new Map();
function spr(c, key, rows, pal, x, y, flip = false, sc = 1) {
  const k = key + (flip ? '<' : '>') + sc;
  let cv = sprCv.get(k);
  if (!cv) {
    const w = rows[0].length, h = rows.length;
    cv = canvas(w * sc, h * sc);
    const g = cv.getContext('2d');
    for (let j = 0; j < h; j++) {
      const r = rows[j];
      for (let i = 0; i < w; i++) {
        const ch = r[flip ? w - 1 - i : i];
        const col = ch === '.' ? null : pal[ch];
        if (col) { g.fillStyle = col; g.fillRect(i * sc, j * sc, sc, sc); }
      }
    }
    sprCv.set(k, cv);
  }
  c.drawImage(cv, ro(x), ro(y));
}

/* =====================================================================
 * 한글 도트 글자 (9줄 높이) — 의성어 전용. 외곽선 + 오른쪽 아래 그림자, 아래 4줄은 한 톤 어둡게
 * ===================================================================== */
const HG = {
  '탁': ['###.#.', '#...#.', '###.##', '#...#.', '###.#.', '......', '######', '.....#', '.....#'],
  '착': ['.#..#.', '###.#.', '.#..##', '#.#.#.', '#.#.#.', '......', '######', '.....#', '.....#'],
  '퍽': ['#####..#', '.#.#...#', '.#.#..##', '.#.#...#', '#####..#', '........', '########', '.......#', '.......#'],
  '휙': ['.#...#', '###..#', '.#...#', '#.#..#', '.#...#', '####.#', '.#...#', '######', '.....#'],
  '쿵': ['####.', '...#.', '.###.', '...#.', '#####', '..#..', '.###.', '#...#', '.###.'],
  '쾅': ['####.#.', '...#.#.', '.###.##', '...#.#.', '.#...#.', '####.#.', '.###...', '#...#..', '.###...'],
  '헉': ['.#...#', '###..#', '.#..##', '#.#..#', '.#...#', '......', '######', '.....#', '.....#'],
  '와': ['.###..#.', '#...#.#.', '#...#.#.', '.###..##', '..#...#.', '#####.#.', '......#.', '......#.', '......#.'],
  '아': ['......#.', '......#.', '.###..#.', '#...#.#.', '#...#.##', '#...#.#.', '.###..#.', '......#.', '......#.'],
  '멍': ['####..#', '#..#..#', '#..#.##', '#..#..#', '####..#', '.......', '..###..', '.#...#.', '..###..'],
  '야': ['......#.', '.###..#.', '#...#.##', '#...#.#.', '#...#.##', '.###..#.', '......#.', '......#.', '......#.'],
  '옹': ['.###.', '#...#', '.###.', '..#..', '#####', '.....', '.###.', '#...#', '.###.'],
  '휴': ['..#..', '#####', '.###.', '#...#', '.###.', '.....', '#####', '.#.#.', '.#.#.'],
  '하': ['.....#.', '.#...#.', '###..#.', '.#...#.', '#.#..##', '.#...#.', '.....#.', '.....#.', '.....#.'],
  '암': ['.#...#.', '#.#..#.', '.#...##', '.....#.', '.......', '#####..', '#...#..', '#...#..', '#####..'],
  '에': ['.....#.#', '.....#.#', '.#...#.#', '#.#.##.#', '.#...#.#', '.....#.#', '.....#.#', '.....#.#', '.....#.#'],
  '취': ['.#...#', '###..#', '.#...#', '#.#..#', '.....#', '####.#', '.#...#', '.#...#', '.....#'],
  '앗': ['.#...#.', '#.#..#.', '.#...##', '.....#.', '.......', '...#...', '..#.#..', '.#...#.', '#.....#'],
  '펑': ['#####..#', '.#.#...#', '.#.#..##', '.#.#...#', '#####..#', '........', '..###...', '.#...#..', '..###...'],
  '슝': ['..#..', '.#.#.', '#...#', '#####', '.#.#.', '.....', '.###.', '#...#', '.###.'],
  '오': ['.....', '.###.', '#...#', '#...#', '.###.', '..#..', '..#..', '#####', '.....'],
  '냠': ['#...#.', '#...##', '#...#.', '###.##', '....#.', '......', '#####.', '#...#.', '#####.'],
  '흥': ['..#..', '.###.', '..#..', '.#.#.', '..#..', '#####', '.###.', '#...#', '.###.'],
  '짝': ['###.###.#.', '.#...#..#.', '#.#.#.#.##', '........#.', '........#.', '..........', '#########.', '........#.', '........#.'],
  '!': ['##', '##', '##', '##', '##', '..', '##', '##', '..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '..#..', '.....', '..#..', '..#..'],
  '~': ['.....', '.....', '.....', '.#...', '#.#.#', '...#.', '.....', '.....', '.....'],
  '.': ['..', '..', '..', '..', '..', '..', '..', '##', '##'],
  ' ': ['..', '..', '..', '..', '..', '..', '..', '..', '..'],
};
function hgW(s) { let w = 0; for (const ch of s) w += (HG[ch] || HG[' '])[0].length + 1; return Math.max(0, w - 1); }
const textCache = new Map();
function textCv(s, col, sc) {
  const key = s + '|' + col + '|' + sc;
  let cv = textCache.get(key);
  if (cv) return cv;
  if (textCache.size > 160) textCache.clear();
  const w = Math.max(1, hgW(s)), h = 9;
  const bits = new Uint8Array(w * h);
  let ox = 0;
  for (const ch of s) {
    const G = HG[ch] || HG[' '];
    for (let j = 0; j < h; j++) { const r = G[j]; for (let i = 0; i < r.length; i++) if (r[i] === '#') bits[j * w + ox + i] = 1; }
    ox += G[0].length + 1;
  }
  cv = canvas((w + 3) * sc, (h + 3) * sc);
  const g = cv.getContext('2d');
  g.fillStyle = OUT;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (bits[j * w + i]) { g.fillRect(i * sc, j * sc, sc * 3, sc * 3); g.fillRect((i + 1) * sc, (j + 1) * sc, sc * 3, sc * 3); }
  const dark = tone(col, col === '#ffffff' ? -0.12 : -0.25), lite = tone(col, 0.5);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (!bits[j * w + i]) continue;
    g.fillStyle = j >= 5 ? dark : (j === 0 || !bits[(j - 1) * w + i]) && j < 5 ? lite : col;
    g.fillRect((i + 1) * sc, (j + 1) * sc, sc, sc);
  }
  textCache.set(key, cv);
  return cv;
}
/** 의성어 — (x, y) = 글자 왼쪽 위. 너비(도트)를 돌려준다 */
function htext(c, s, x, y, col, sc = 1) { c.drawImage(textCv(s, col, sc), ro(x) - sc, ro(y) - sc); return hgW(s) * sc; }

/* =====================================================================
 * 스프라이트 (1배 버퍼 도트) — o 외곽선 · 그 밖은 팔레트
 * ===================================================================== */
const BIRD_A = [
  '...oo.......',
  '..oLLo......',
  '..oLLLoooo..',
  '..oLLBBBBBo.',
  '.ooBBBBBkBo.',
  'oBoBBBBBBByy',
  '.ooBwwwwwBo.',
  '...oBwwwBo..',
  '....ooooo...',
];
const BIRD_B = [
  '............',
  '............',
  '......oooo..',
  '....ooBBBBo.',
  '.oooBBBBkBo.',
  'oBoLLLBBBByy',
  '.ooLLLwwwBo.',
  '...oLLowBo..',
  '....ooooo...',
];
const BIRD_PAL = [
  { o: OUT, k: OUT, B: '#4d9cff', L: '#a8d8ff', w: '#fff3dc', y: '#ffb020' },
  { o: OUT, k: OUT, B: '#ff6a4a', L: '#ffb09a', w: '#fff3dc', y: '#ffd23f' },
  { o: OUT, k: OUT, B: '#ffd23f', L: '#fff6b0', w: '#ffffff', y: '#ff8a1a' },
  { o: OUT, k: OUT, B: '#5fc35f', L: '#b8f0a0', w: '#fff3dc', y: '#ffb020' },
];
const FLOCK_A = ['o...o', '.o.o.', '..o..'];
const FLOCK_B = ['.....', 'oo.oo', '..o..'];
const CAT_HEAD = [
  'o........o',
  'oo......oo',
  'ojo....ojo',
  'occoooocco',
  'occcddccco',
  'ockcccckco',
  'occcnnccco',
  'occkcckcco',
  '.occcccco.',
  '..oooooo..',
];
const CAT_YAWN = [
  'o........o',
  'oo......oo',
  'ojo....ojo',
  'occoooocco',
  'occcddccco',
  'okkcccckko',
  'occcnnccco',
  'occcmmccco',
  '.occmmcco.',
  '..oooooo..',
];
const CAT_PAL = { o: OUT, k: OUT, c: '#f0a040', d: '#c86f1e', j: '#ffb3c6', n: '#ff7a9a', m: '#a01830' };
const DOG_A = [
  '........oo..',
  'o......oDdo.',
  'do....odkddo',
  '.do..oddddwn',
  '..ooodddddp.',
  '..oddddddo..',
  '..owwwwwdo..',
  '..odo..odo..',
  '..oo...oo...',
];
const DOG_B = [
  '........oo..',
  '.......oDdo.',
  '.o....odkddo',
  'odo..oddddwn',
  '.dooodddddp.',
  '..oddddddo..',
  '..owwwwwdo..',
  '.odo....odo.',
  '.oo......oo.',
];
const DOG_PAL = { o: OUT, k: OUT, n: OUT, d: '#d08a3a', D: '#8a4a1a', w: '#fff3dc', p: '#ff6a8a' };
const KID_STAND = [
  '..ooooo..',
  '.ohhhhho.',
  'ohhhhhhho',
  'ohsksksho',
  'oosssssoo',
  '.ossmsso.',
  '..ooooo..',
  '.ottttto.',
  'ostttttso',
  '.opppppo.',
  '.opo.opo.',
  '.oso.oso.',
  'ozzo.ozzo',
  'oooo.oooo',
];
const KID_JUMP = [
  's.ooooo.s',
  'sohhhhhos',
  'ohhhhhhho',
  'ohsksksho',
  'oosssssoo',
  '.ossMsso.',
  '..ooooo..',
  '.ottttto.',
  '.ottttto.',
  '.opppppo.',
  '.oso.oso.',
  'ozzo.ozzo',
  'oooo.oooo',
];
const KID_SIT = [
  '..ooooo..',
  '.ohhhhho.',
  'ohhhhhhho',
  'ohsksksho',
  'oosssssoo',
  '.ossmsso.',
  '..ooooo..',
  '.ottttto.',
  'ostttttso',
  'oopppppoo',
  'ozzpppzzo',
  'ooooooooo',
];
const SQ_A = [
  '.ooo.......',
  'oTTTo...oo.',
  'oTTTTo.occo',
  '.oTTTooccko',
  '..oTTocccco',
  '..oTocccwo.',
  '...oocccwo.',
  '....occcco.',
  '....oo.oo..',
];
const SQ_B = [
  '.ooo.......',
  'oTTTo...oo.',
  'oTTTTo.occo',
  '.oTTTooccko',
  '..oTTocccco',
  '..oTocccwo.',
  '...oocccwo.',
  '...occccoo.',
  '...o.o..oo.',
];
const SQ_PAL = { o: OUT, k: OUT, T: '#c8864a', c: '#b0602a', w: '#ffe6c0' };
const SNAIL = [
  '...oooo..o.o.',
  '..oSSSSo.o.o.',
  '.oSsooSSoyyo.',
  '.oSoSsoSoyyyo',
  '.oSsooSSoyyyo',
  'oyoSSSSoyyyyo',
  'oyyyyyyyyyyo.',
  '.ooooooooooo.',
];
const SNAIL_PAL = { o: OUT, S: '#c8703a', s: '#f0b070', y: '#c8dc78' };
const MOLE = [
  '..oooo..',
  '.oddddo.',
  'oddddddo',
  'odkddkdo',
  'oddppddo',
  'oddddddo',
  'oooooooo',
];
const MOLE_PAL = { o: OUT, k: OUT, d: '#6a4a3a', p: '#ff8aa0' };
const FROG = [
  '.oo...oo.',
  'owko.okwo',
  'oggoooggo',
  'ogggggggo',
  'ogkkkkkgo',
  'oogggggoo',
  'oo.....oo',
];
const FROG_PAL = { o: OUT, k: OUT, w: '#ffffff', g: '#5fc35f' };
const BFLY_A = ['oo.o.oo', 'opyoypo', 'oppoppo', '.opopo.', '..o.o..'];
const BFLY_B = ['...o...', '..ooo..', '.oopoo.', '..opo..', '...o...'];
const UMB = ['...ooo...', '.ooUUUoo.', 'oUUUUUUUo', 'oUoUoUoUo', '....o....', '...oo....'];
const HAT = ['.ooo.', 'oHHHo', 'ooooo'];
const NOTE = ['..ooo.', '..oyyo', '..oyoo', '..oyo.', '.ooyo.', 'oyyyo.', 'oyyyo.', '.ooo..'];
const HEART7 = ['.oo.oo.', 'orrorro', 'orrrrro', '.orrro.', '..oro..', '...o...'];
const STAR5S = ['..o..', '.oyo.', 'oyyyo', '.oyo.', 'o.o.o'];
const SWEAT = ['..o..', '.obo.', 'obbbo', 'owbbo', 'obbbo', '.ooo.'];
const SWEAT_PAL = { o: OUT, b: WATER, w: '#ffffff' };
const SPIRAL = ['ooooo', '....o', 'ooo.o', 'o...o', 'ooooo'];
const HEART5 = ['rr.rr', 'rrrrr', 'rrrrr', '.rrr.', '..r..'];
const PLANE = [
  'oo................',
  'oRo......ooo......',
  'oRRoooooowwwoooo..',
  'oRRRRRRRRRRRRRRRRo',
  '.ooRRRRRRRRRRRRRo.',
  '...ooRRRRoooooo...',
  '.....oooo.........',
];
const PLANE_PAL = { o: OUT, R: '#e8423a', w: '#bfe8ff' };
const LEAF_A = ['.o.', 'oGo', '.oo'];
const VEIN_A = ['..r.r..', '.rr.rr.', 'rr...rr', '.......', 'rr...rr', '.rr.rr.', '..r.r..'];
const VEIN_B = ['.r.r.', 'rr.rr', '.....', 'rr.rr', '.r.r.'];
const LEAF_B = ['oo.', 'oGo', '.o.'];

/* ---------- 작은 도구 ---------- */
/** 먼지 한 덩이 — f 0(크게) → 3(점) */
function dust(c, x, y, f, col = '#f4ead8', sh = '#c9b89a', s = 1) {
  x = ro(x); y = ro(y);
  if (f <= 0) { rect(c, x - 2 * s, y - s, 4 * s, 2 * s, col); rect(c, x - s, y - 2 * s, 2 * s, s, col); rect(c, x - 2 * s, y + s, 4 * s, s, sh); }
  else if (f === 1) { rect(c, x - s, y - s, 3 * s, 2 * s, col); rect(c, x - s, y + s, 3 * s, s, sh); }
  else if (f === 2) { rect(c, x, y, 2 * s, s, col); rect(c, x, y + s, s, s, sh); }
  else rect(c, x, y, s, s, col);
}
/** 반짝 — f 0 큰 십자 · 1 작은 십자 · 2 점 */
function twinkle(c, x, y, f, col = '#ffffff') {
  x = ro(x); y = ro(y);
  if (f === 0) { rect(c, x - 2, y, 5, 1, col); rect(c, x, y - 2, 1, 5, col); }
  else if (f === 1) { rect(c, x - 1, y, 3, 1, col); rect(c, x, y - 1, 1, 3, col); }
  else px(c, x, y, col);
}
/** 동그래진 눈 (새 · 동물) — (ex, ey) = 원래 눈 자리 */
function bigEye(c, ex, ey, ld = 0) { rect(c, ex - 2, ey - 2, 5, 5, OUT); rect(c, ex - 1, ey - 1, 3, 3, '#ffffff'); px(c, ex + ld, ey, OUT); }
/** 새 한 마리 — (x, y) = 몸 가운데. dir 1 오른쪽 봄 */
function bird(c, x, y, dir, t, ci, big = false, fast = false, glide = false) {
  const f = glide ? 1 : fl(t * (fast ? 18 : 9)) % 2;
  const X = ro(x) - 6, Y = ro(y) - 5;
  spr(c, (f ? 'bB' : 'bA') + ci, f ? BIRD_B : BIRD_A, BIRD_PAL[ci], X, Y, dir < 0);
  if (big) bigEye(c, dir < 0 ? X + 3 : X + 8, Y + 4, dir < 0 ? -1 : 1);
}
/** 뭉게구름 한 덩이 (외곽선 있음) — 위 밝게 · 아래 그늘 */
function puffCloud(c, x, y, w, col, colS, ol = true) {
  x = ro(x); y = ro(y); w = ro(w);
  const h = 4 + fl(w / 7);
  if (ol) {
    rbox(c, x - 1, y + 1, w + 2, h + 2, OUT, 3);
    rbox(c, x + ro(w * 0.2) - 1, y - 2, ro(w * 0.45) + 2, h, OUT, 3);
    rbox(c, x + ro(w * 0.5) - 1, y - 4, ro(w * 0.35) + 2, h, OUT, 3);
  }
  rbox(c, x, y + 2, w, h, col, 2);
  rbox(c, x + ro(w * 0.2), y - 1, ro(w * 0.45), h, col, 2);
  rbox(c, x + ro(w * 0.5), y - 3, ro(w * 0.35), h, col, 2);
  rect(c, x + 2, y + h, w - 4, 2, colS);
}
/** 타원 고리(바닥 충격파) — 줄마다 양 끝 두 칸 · 위아래 줄은 바둑판 */
function flatRing(c, cx, cy, rx, ry, col) {
  rx = Math.max(1, rx); ry = Math.max(1, ry);
  for (let j = -ry; j <= ry; j++) {
    const k = j / (ry + 0.5);
    const hw = ro(rx * Math.sqrt(Math.max(0, 1 - k * k)));
    if (Math.abs(j) === ry) { for (let i = -hw; i <= hw; i += 2) px(c, cx + i, cy + j, col); continue; }
    rect(c, cx - hw - 1, cy + j, 2, 1, col); rect(c, cx + hw, cy + j, 2, 1, col);
  }
}
/** 작은 사람(관중 크기) */
function tinyFan(c, x, y, sk, hr, sh, arms) {
  rect(c, x + 1, y, 3, 1, hr); rect(c, x, y + 1, 5, 1, hr); rect(c, x + 1, y + 1, 3, 2, sk);
  px(c, x + 1, y + 2, '#3a2418'); px(c, x + 3, y + 2, '#3a2418');
  rect(c, x, y + 3, 5, 3, sh);
  if (arms) { rect(c, x - 1, y - 1, 1, 4, sh); rect(c, x + 5, y - 1, 1, 4, sh); px(c, x - 1, y - 2, sk); px(c, x + 5, y - 2, sk); }
}

/* ---------- 얼굴 칠 (선수 1배 캔버스) — 머리 타원 안에만 디더링. 한 번 구워 둔다 ---------- */
const tintCache = new Map();
function faceTint(kind) {
  let cv = tintCache.get(kind);
  if (cv) return cv;
  cv = canvas(24, 22);
  const g = cv.getContext('2d');
  /* (12, 11) = 머리 가운데 (x − 0.5 → 11.5) */
  for (let r = -10; r <= 10; r++) {
    const dy = (r + 0.5 + 0.7) / 8.6;
    if (Math.abs(dy) > 1) continue;
    const hw = 9.4 * Math.sqrt(1 - dy * dy);
    const a = ro(11.5 - hw), b = ro(11.5 + hw);
    for (let i = a; i < b; i++) {
      const cx = i - 12;
      let col = null;
      if (kind === 'gloom') {
        if (r <= -3 && (i + r) % 2 === 0) col = '#2a1640';
        if (i % 2 === 0 && r <= 1 - (Math.abs(cx * 5) % 3)) col = '#2a1640';
      } else if (kind === 'soot') {
        if ((i + r) % 2 === 0 || hash(i * 31 + r * 7) < 0.25) col = r > 5 ? '#4a4a4a' : '#2a2a2a';
      } else if (kind === 'red') {
        if (r >= 1 && r <= 3 && i > a && i < b - 1 && Math.abs(cx + 0.5) > 1.5) col = r === 3 ? '#ff6a5a' : '#ff8a78';   // 볼부터 코까지 발그레 (가운데 한 줄은 비워 코 자리)
        else if ((r === -4 || r === -3 || r === 6 || r === 7) && (i + r) % 2 === 0 && i > a && i < b - 1) col = '#ff5a4a';
      } else if (kind === 'pale') {
        if (r >= -6 && r <= -2 && i % 2 === 1 && i > a + 1 && i < b - 2) col = '#6a7aff';
      }
      if (col) { g.fillStyle = col; g.fillRect(i, r + 11, 1, 1); }
    }
  }
  tintCache.set(kind, cv);
  return cv;
}

/* =====================================================================
 * 표정 순환 — 이벤트와 별개로 늘 돈다. (F, 나이, 길이) → 얼굴 모양
 * ===================================================================== */
const BASE = {
  normal: () => {},
  normal2: () => {},
  blink2: (F, a) => { const q = a % 1.4; if (q < 0.09 || (q > 0.2 && q < 0.29)) F.eyes = 'line'; },
  yawn: (F, a, d) => { const u = a / d; if (u > 0.08 && u < 0.86) { F.mouth = 'yawn'; F.mk = clamp(Math.min((u - 0.08) * 5, (0.86 - u) * 6), 0, 1); F.eyes = F.mk > 0.5 ? 'shut' : 'line'; if (u > 0.45) F.tear = 1; } },
  drool: (F, a) => { F.mouth = 'drool'; F.drool = Math.min(1, a / 1.6); F.eyes = 'half'; },
  teary: (F) => { F.eyes = 'teary'; F.tear = 1; F.mouth = 'wavy'; },
  frown: (F) => { F.brows = 'furrow'; F.mouth = 'flat'; F.eyes = 'angry'; },
  tongue: (F, a) => { F.mouth = 'tongue'; if (a % 1.2 < 0.7) F.eyes = 'happy'; },
  puff: (F) => { F.cheeks = 'puff'; F.mouth = 'tight'; F.blush = Math.max(F.blush, 1); },
  surprise: (F) => { F.eyes = 'round'; F.mouth = 'o'; },
  wink: (F, a) => { F.eyes = 'wink'; F.mouth = 'grin'; F.sparkle = a < 0.5 ? 1 : 0; },
  smug: (F) => { F.eyes = 'half'; F.mouth = 'smirk'; },
  whistle: (F) => { F.mouth = 'whistle'; F.eyes = 'line'; F.note = 1; },
  cross: (F) => { F.eyes = 'cross'; F.mouth = 'wavy'; },
  sleepy: (F, a) => { F.eyes = 'line'; F.mouth = 'o'; F.snot = a; F.zzz = 1; },
  look: (F, a) => { F.eyes = 'look'; F.eyeDx = fl(a / 0.55) % 2 ? 1 : -1; },
  grin: (F) => { F.eyes = 'happy'; F.mouth = 'bigGrin'; },
  pout: (F) => { F.mouth = 'pout'; F.cheeks = 'puffL'; F.eyes = 'half'; },
  groove: (F) => { F.eyes = 'happy'; F.groove = 1; },
};
const BASE_IDS = Object.keys(BASE);
/** 점프 순간 표정 5가지 — 점프마다 돌아가며 */
const JUMP_FACE = [
  (F) => { F.mouth = 'clench'; F.eyes = 'shut'; },             // 이 악물고 눈 질끈
  (F) => { F.cheeks = 'puff'; F.mouth = 'tight'; F.eyes = 'line'; },   // 숨 참기
  (F) => { F.mouth = 'tongueSide'; F.eyes = 'angry'; F.brows = 'angry'; }, // 혀 빼물고 집중
  (F) => { F.mouth = 'O'; F.eyes = 'round'; },                 // 우와 높다
  (F) => { F.mouth = 'clench'; F.eyes = 'line'; F.brows = 'angry'; },
];

/* =====================================================================
 * 연출 목록 — cat 갈래 · dur 길이(초) · w 무게 · cool 다시 나오기까지(초)
 * init(a, S) · back(c, a, S) · front(c, a, S) · face(F, a, S) · mood(M, a, S)  — a.age · a.u(0~1) 는 엔진이 넣는다
 * ===================================================================== */
const CAT_CAP = { sky: 2, weather: 1, ground: 2, crowd: 1, front: 1, face: 1 };
const CAT_W = { sky: 3, weather: 1.2, ground: 2.4, crowd: 2, front: 1.7, face: 2.6 };

const DEFS = {
  /* ------------------------------ 하늘 ------------------------------ */
  birdPass: { // 지나가는 새 — 선수를 보고 눈이 동그래져 멈칫(공중 정지) → 후다닥
    cat: 'sky', dur: 5, w: 1.3,
    init(a, S) { const L = S.L; a.dir = S.rand() < 0.5 ? 1 : -1; a.y = S.skyY(); a.ci = fl(S.rand() * 4); a.sp = 50; const tgt = L.kx + a.dir * (8 + S.rand() * 30); a.t1 = Math.abs(tgt - (a.dir > 0 ? -20 : L.W + 20)) / a.sp; a.dur = a.t1 + 0.9 + (L.W + 50) / (a.sp * 1.7); },
    back(c, a, S) {
      const L = S.L, age = a.age;
      const t2 = a.t1 + 0.9;
      const e = age < a.t1 ? age : age < t2 ? a.t1 : a.t1 + (age - t2) * 1.7;
      const x = ro(a.dir > 0 ? -20 + e * a.sp : L.W + 20 - e * a.sp);
      const stop = age >= a.t1 && age < t2;
      const yy = ro(a.y + (stop ? Math.sin(age * 20) : Math.sin(age * 4) * 2));
      S.zoom(c, x, yy);
      bird(c, x, yy, a.dir, S.T, a.ci, stop, stop);
      if (stop) { htext(c, '!', x - 1, yy - 19, '#ffe14d'); if (age - a.t1 < 0.18) for (const s of [-1, 1]) { line(c, x + s * 8, yy - 8, x + s * 11, yy - 11, 1, '#ffffff'); line(c, x + s * 9, yy - 4, x + s * 12, yy - 5, 1, '#ffffff'); } }
      if (age > t2 && age < t2 + 0.7) for (let i = 0; i < 3; i++) rect(c, x - a.dir * (10 + i * 5) - (a.dir > 0 ? 4 : 0), yy - 2 + i * 2, 4, 1, '#ffffff');
      c.restore();
    },
  },
  flock: { // 새 떼 V자
    cat: 'sky', dur: 6, w: 0.9,
    init(a, S) { a.dir = S.rand() < 0.5 ? 1 : -1; a.y = S.skyY(); a.dur = (S.L.W + 80 * S.A) / 36; },
    back(c, a, S) {
      const L = S.L;
      const lx = ro(a.dir > 0 ? -10 + a.age * 36 : L.W + 10 - a.age * 36);
      S.zoom(c, lx, a.y);
      for (let i = 0; i < 7; i++) {
        const row = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
        const bx = ro(lx - a.dir * row * 7), by = ro(a.y + (i ? side * row * 4 : 0) + Math.sin(a.age * 3 + i) * 1.2);
        const fb = fl(S.T * 7 + i * 0.5) % 2;
        spr(c, (fb ? 'fB' : 'fA') + (L.dark ? 'd' : 'l'), fb ? FLOCK_B : FLOCK_A, { o: L.dark ? '#d8e0ff' : OUT }, bx - 2, by - 1);
      }
      c.restore();
    },
  },
  plane: { // 현수막 끄는 비행기
    cat: 'sky', dur: 6, w: 1,
    init(a, S) { a.dir = S.rand() < 0.5 ? 1 : -1; a.y = S.L.skyTop + 4 + fl(S.rand() * Math.max(4, (S.L.skyBot - S.L.skyTop) * 0.45)); a.msg = ['NICE JUMP!', 'GO GO GO!', 'ROPE STAR', 'WOW!', 'JUMP JUMP!', 'BEAT IT!', 'YOU ROCK!'][fl(S.rand() * 7)]; a.bw = textW(a.msg) + 8; a.dur = (S.L.W + (a.bw + 50) * S.A) / 46; },
    back(c, a, S) {
      const L = S.L, d = a.dir;
      const nose = ro(d > 0 ? -18 * S.A + a.age * 46 : L.W + 18 * S.A - a.age * 46);
      const x0 = d > 0 ? nose - 18 : nose;
      const y = ro(a.y + Math.sin(a.age * 2.2) * 1.5);
      S.zoom(c, nose, y + 3);
      spr(c, 'plane', PLANE, PLANE_PAL, x0, y, d < 0);
      const prop = fl(S.T * 30) % 2;
      const pxx = d > 0 ? x0 + 18 : x0 - 1;
      rect(c, pxx, y + (prop ? 1 : 3), 1, prop ? 5 : 2, '#d8d8e0');
      const tail = d > 0 ? x0 : x0 + 18;
      const bx = d > 0 ? tail - 10 - a.bw : tail + 10;
      for (let i = 0; i < 10; i++) px(c, d > 0 ? tail - 1 - i : tail + i, y + 3 + (i > 4 ? 1 : 0), OUT);
      const by = y + 1;
      rect(c, bx - 1, by - 1, a.bw + 2, 10, OUT);
      for (let i = 0; i < a.bw; i++) { const wv = fl(i / 6 + S.T * 6) % 2; rect(c, bx + i, by + wv, 1, 8 - wv, i % 12 < 6 ? '#fff3dc' : '#ffe6b8'); }
      ptext(c, a.msg, bx + 4, by + 2, '#e8423a', null);
      c.restore();
    },
  },
  hotair: { // 열기구 — 관중 뒤에서 둥실 떠올라 바구니 속 사람이 손 흔든다
    cat: 'sky', dur: 7.5, w: 0.8,
    init(a, S) { const L = S.L; a.x0 = S.freeX(L.W * (S.rand() < 0.5 ? 0.25 : 0.75) - 8 * S.A, 16 * S.A) + 8 * S.A; a.dx = (S.rand() < 0.5 ? -1 : 1) * 14; a.cols = [['#e8423a', '#ffd23f'], ['#3a7be8', '#ffffff'], ['#3fbf5a', '#ffe14d'], ['#ff7fbf', '#9b5de5']][fl(S.rand() * 4)]; },
    back(c, a, S) {
      const L = S.L, u = a.u;
      const x = ro(a.x0 + a.dx * u), y = ro(L.skyBot + 20 - u * (L.skyBot - L.skyTop + 80));
      const [c1, c2] = a.cols;
      S.zoom(c, x, y);
      oval(c, x - 0.5, y, 8, 9, OUT);
      for (let r = -8; r <= 8; r++) {
        const k = (r + 0.5) / 8.4; if (Math.abs(k) > 1) continue;
        const hw = 7 * Math.sqrt(1 - k * k);
        for (let i = ro(-0.5 - hw); i < ro(-0.5 + hw); i++) px(c, x + i, y + r, (fl((i + 8) / 3) % 2 ? c1 : c2));
      }
      rect(c, x - 4, y - 7, 2, 2, '#ffffff');
      rect(c, x - 3, y + 9, 1, 3, OUT); rect(c, x + 2, y + 9, 1, 3, OUT);
      rect(c, x - 4, y + 11, 8, 5, OUT); rect(c, x - 3, y + 12, 6, 3, '#a8703c'); rect(c, x - 3, y + 12, 6, 1, '#d09a5a');
      rect(c, x - 1, y + 9, 3, 3, '#ffe0c2'); px(c, x, y + 10, OUT);
      const wv = fl(S.T * 5) % 2;
      px(c, x + 2 + wv, y + 8, '#ffe0c2'); px(c, x + 2, y + 9, '#ffe0c2');
      c.restore();
    },
  },
  balloon: { // 누가 놓친 풍선 — «앗!»
    cat: 'sky', dur: 4.5, w: 1,
    init(a, S) { const L = S.L; a.x0 = S.freeX(L.kx + (S.rand() < 0.5 ? -1 : 1) * (L.W * 0.3), 10 * S.A) + 4 * S.A; a.col = RAIN7[fl(S.rand() * 7)]; a.y0 = L.floorY - 50 * L.K; S.say('앗!', a.x0 - 8, a.y0 + 6, '#ffffff', 1, 0.8); },
    back(c, a, S) {
      const L = S.L, age = a.age;
      const x = ro(a.x0 + Math.sin(age * 2.4) * 5 + age * 4), y = ro(a.y0 - age * ((a.y0 - L.skyTop + 40) / a.dur));
      S.zoom(c, x, y);
      oval(c, x - 0.5, y, 4, 5, OUT); oval(c, x - 0.5, y, 3, 4, a.col); rect(c, x - 2, y - 3, 1, 2, '#ffffff');
      px(c, x - 1, y + 5, a.col);
      for (let i = 0; i < 9; i++) px(c, x - 1 + ro(Math.sin(age * 6 + i * 0.7)), y + 6 + i, OUT);
      c.restore();
    },
  },
  ufo: { // UFO — 관중 한 명을 빔으로 띄웠다 «앗!» 떨어뜨리고 «슝»
    cat: 'sky', dur: 5.2, w: 0.7, cool: 25,
    init(a, S) { const L = S.L; a.tx = S.freeX(L.W * (0.2 + S.rand() * 0.6), 20 * S.A) + 10 * S.A; a.ty = ro(Math.min(L.floorY - 50 * L.K + 10, L.skyBot + 6)); a.hy = Math.max(L.skyTop + 8 * S.A, a.ty - 60); a.side = S.rand() < 0.5 ? -1 : 1; },
    back(c, a, S) {
      const L = S.L, age = a.age;
      let x = a.tx, y = a.hy;
      if (age < 0.9) { const k = 1 - age / 0.9; x = a.tx + a.side * k * (L.W * 0.6); y = a.hy - k * 30; }
      else if (age > 4.1) { const k = (age - 4.1) / 1.1; x = a.tx - a.side * k * k * L.W; y = a.hy - k * 40; }
      x = ro(x); y = ro(y + Math.sin(age * 5) * 1.5);
      if (age > 1.1 && age < 3.7) {
        const top = y + 5 * S.A, bot = a.ty + 6;
        for (let yy = top; yy < bot; yy++) { const hw = 3 * S.A + ro((yy - top) * 0.3); rect(c, x - hw, yy, hw * 2, 1, pat(c, (yy + fl(S.T * 20)) % 4 < 2 ? '#fff3a0' : '#c8ff9a', 2)); }
        const lift = age < 1.6 ? 0 : age < 3.0 ? Math.min(16, (age - 1.6) * 14) : Math.max(0, 16 - (age - 3.0) * 60);
        tinyFan(c, x - 2, ro(a.ty - lift), '#ffe0c2', '#6b3f1d', '#3a7be8', lift > 2);
        if (age > 3.0 && !a.s1) { a.s1 = 1; S.say('앗!', x - 8, a.ty - 24, '#ffffff', 1, 0.7); }
      }
      S.zoom(c, x, y);
      rect(c, x - 9, y + 1, 18, 4, OUT); rect(c, x - 8, y + 2, 16, 2, '#9aa5b8'); rect(c, x - 8, y + 2, 16, 1, '#d8e0f0');
      rect(c, x - 6, y + 5, 12, 1, OUT);
      oval(c, x - 0.5, y, 4, 3, OUT, y); oval(c, x - 0.5, y, 3, 2, '#9fe8ff', y); px(c, x - 2, y - 2, '#ffffff');
      for (let i = 0; i < 4; i++) px(c, x - 6 + i * 4, y + 3, (fl(S.T * 8) + i) % 2 ? '#ff4d4d' : '#ffe14d');
      c.restore();
      if (age > 4.1 && !a.said) { a.said = 1; S.say('슝', x - 4, y - 16 * S.A, '#c8ff9a', 1, 0.7); }
    },
  },
  meteor: { // 별똥별
    cat: 'sky', dur: 1.3, w: 0.9,
    init(a, S) { const L = S.L; a.dir = S.rand() < 0.5 ? 1 : -1; a.x0 = a.dir > 0 ? L.W * 0.05 : L.W * 0.95; a.y0 = L.skyTop + 2 + S.rand() * 10; },
    back(c, a, S) {
      const u = a.u, L = S.L;
      const len = L.W * 0.8;
      const hx = a.x0 + a.dir * u * len, hy = a.y0 + u * len * 0.35;
      for (let i = 0; i < 16; i++) { const k = i * 2.5; rect(c, ro(hx - a.dir * k), ro(hy - k * 0.35), i < 6 ? 2 : 1, 1, i < 3 ? '#ffffff' : i < 8 ? '#fff3a0' : '#c8a8ff'); }
      rect(c, ro(hx) - 1, ro(hy) - 1, 3, 3, '#ffffff');
      twinkle(c, hx, hy, u > 0.8 ? 0 : 1, '#ffffff');
    },
  },
  wire: { // 전깃줄 참새들 — 박에 까딱, 환호 땐 날개로 박수 «♪»
    cat: 'sky', dur: 7, w: 0.9, cool: 20,
    init(a, S) { const L = S.L; a.y = L.skyTop + 14 * S.A + fl(S.rand() * 8); a.xs = []; for (let i = 0; i < 4; i++) a.xs.push(S.freeX(L.W * (0.15 + 0.23 * i) - 6 * S.A, 12 * S.A) + 6 * S.A); a.ci = fl(S.rand() * 4); },
    back(c, a, S) {
      const L = S.L, age = a.age;
      const sag = (x) => ro(Math.sin((x / L.W) * Math.PI) * 6);
      for (let x = 0; x < L.W; x++) px(c, x, a.y + sag(x), '#3a3a48');
      const clap = S.T - S.cheerAt < 1.6;
      a.xs.forEach((bx, i) => {
        const land = clamp((age - i * 0.15) / 0.5, 0, 1), leave = age > a.dur - 1 ? (age - (a.dur - 1)) : 0;
        const x = ro(bx + leave * 30 * (i % 2 ? 1 : -1));
        const by = ro(a.y + sag(bx) - 4 * S.A - (1 - land) * 40 - leave * leave * 70);
        const flap = clap || land < 1 || leave > 0;
        const hop = !flap && (S.beat - fl(S.beat)) < 0.2 && (fl(S.beat) + i) % 2 ? -1 : 0;
        S.zoom(c, x, by + hop);
        bird(c, x, by + hop, i % 2 ? -1 : 1, S.T + i * 0.1, (a.ci + i) % 4, false, clap, !flap);
        if (clap && (fl(S.T * 3) + i) % 4 === 0) spr(c, 'note', NOTE, { o: OUT, y: '#ffe14d' }, x - 3, by - 16);
        c.restore();
      });
    },
  },
  cloudFace: { // 얼굴 있는 구름이 볼을 부풀려 «후~» — 나뭇잎이 날린다
    cat: 'sky', dur: 4.8, w: 0.9, cool: 18,
    init(a, S) { const L = S.L; a.dir = S.rand() < 0.5 ? 1 : -1; a.y = L.skyTop + 4 * S.A; const [m0, m1] = S.midFree(); a.cx = a.dir > 0 ? m0 + 17 * S.A : m1 - 17 * S.A; },
    back(c, a, S) {
      const age = a.age;
      let cx = a.cx;
      if (age < 0.8) cx = a.cx - a.dir * (1 - age / 0.8) * 70;
      else if (age > 4) cx = a.cx - a.dir * ((age - 4) / 0.8) * 70;
      cx = ro(cx);
      const x = cx - 16, y = a.y;
      const blow = age > 1.8 && age < 3.6, puffC = age > 1.2 && age <= 1.8;
      S.zoom(c, cx, y + 8);
      puffCloud(c, x, y + 4, 32, '#ffffff', '#cfe0f0');
      const fx = cx + a.dir * 3, fy = y + 9;
      if (blow) { rect(c, fx - 6, fy, 3, 1, OUT); rect(c, fx + 3, fy, 3, 1, OUT); }
      else { rect(c, fx - 5, fy - 1, 2, 3, OUT); rect(c, fx + 3, fy - 1, 2, 3, OUT); }
      if (puffC || blow) { oval(c, fx - 7.5, fy + 4, 3, 2, '#ffc0c8'); oval(c, fx + 6.5, fy + 4, 3, 2, '#ffc0c8'); }
      if (blow) { rect(c, fx + a.dir * 4 - 1, fy + 3, 3, 3, OUT); px(c, fx + a.dir * 4, fy + 4, '#5a1010'); }
      else rect(c, fx - 1, fy + 4, 2, 1, OUT);
      if (blow) {
        for (let i = 0; i < 5; i++) {
          const k = ((age - 1.8) * 60 + i * 17) % 60;
          const lx = fx + a.dir * (8 + k), ly = fy + 2 + i * 3 - 6 + ro(Math.sin(k * 0.2 + i) * 2);
          rect(c, ro(lx) - (a.dir < 0 ? 5 : 0), ro(ly), 5, 1, '#ffffff');
          if (i % 2) spr(c, fl(S.T * 8 + i) % 2 ? 'lfA' : 'lfB', fl(S.T * 8 + i) % 2 ? LEAF_A : LEAF_B, { o: OUT, G: i % 4 === 1 ? '#5fc35f' : '#ff9a3a' }, ro(lx + a.dir * 6), ro(ly + 2));
        }
      }
      c.restore();
      if (blow && !a.said) { a.said = 1; S.say('휴~', cx + a.dir * 20 * S.A - 10, y + 20 * S.A, '#bfe8ff', 1, 1.4); }
    },
    face(F, a) { if (a.age > 2 && a.age < 3.6) { F.eyes = 'half'; F.mouth = 'wavy'; } },
  },

  /* ------------------------------ 날씨 ------------------------------ */
  rain: { // 갑자기 소나기 — 먹구름 · 빗줄기 · 관중 우산 · 선수 머리에서 물 뚝뚝 → 끝나면 무지개(가끔)
    cat: 'weather', dur: 6.5, w: 1.1,
    init(a, S) { const L = S.L, top = S.crowdTop(); a.umb = []; for (let i = 0; i < 10; i++) a.umb.push([S.freeX(L.W * (0.04 + i * 0.1) + (S.rand() - 0.5) * 8, 9), ro(top + S.rand() * Math.max(4, L.floorY - 18 - top)), S.rand(), RAIN7[fl(S.rand() * 7)]]); },
    end(a, S) { if (S.rand() < 0.6) S.spawn('rainbow', true); },
    back(c, a, S) {
      const L = S.L, age = a.age;
      const k = clamp(Math.min(age / 0.6, (a.dur - age) / 0.6), 0, 1);
      if (k > 0.3) rect(c, 0, 0, L.W, L.floorY - 6, pat(c, '#0a0e28', k > 0.8 ? 2 : 3));
      darkClouds(c, S, k);
      for (const [ux, uy, d, col] of a.umb) {
        const t0 = 0.5 + d * 1.2;
        if (age < t0 || age > a.dur - 0.4 - d * 0.5) continue;
        spr(c, 'umb' + col, UMB, { o: OUT, U: col }, ux, uy - 6 - (age - t0 < 0.1 ? 1 : 0));
      }
    },
    front(c, a, S) {
      const L = S.L, age = a.age;
      const k = clamp(Math.min((age - 0.4) / 0.5, (a.dur - 0.3 - age) / 0.5), 0, 1);
      if (k <= 0) return;
      const n = ro((L.W * L.H) / 240 * k);
      const P = new Path2D(), P2 = new Path2D();
      for (let i = 0; i < n; i++) {
        const sp = 260 + (i % 5) * 30;
        const x = ro((hash(i * 7 + 1) * (L.W + 40) + S.T * 60) % (L.W + 40)) - 20;
        const y = ro((hash(i * 7 + 2) * L.H + S.T * sp) % (L.floorY + 20));
        const Q = i % 3 ? P : P2;
        Q.rect(x, y, 1, 3); Q.rect(x - 1, y + 3, 1, 3);
      }
      c.fillStyle = '#9fd8ff'; c.fill(P); c.fillStyle = '#e8f8ff'; c.fill(P2);
      for (let i = 0; i < 12; i++) {
        const q = (S.T * 3 + hash(i * 13) * 7) % 1;
        const sx = ro(hash(i * 13 + fl(S.T * 3 + hash(i * 13) * 7)) * L.W), sy = L.floorY + 4 + ro(hash(i * 5) * 18);
        if (q < 0.25) { px(c, sx - 2, sy - 1, '#bfe8ff'); px(c, sx + 2, sy - 1, '#bfe8ff'); px(c, sx - 1, sy - 2, '#ffffff'); px(c, sx + 1, sy - 2, '#ffffff'); }
        else if (q < 0.45) flatRing(c, sx, sy, 3, 1, '#7fbfe0');
      }
    },
    face(F, a) { F.drip = 1; if (a.age > 0.5 && a.age < 2.2) { F.eyes = 'half'; F.mouth = 'flat'; } },
  },
  snow: { // 눈 펑펑 — 바닥에 쌓이고 눈사람이 생기고 선수는 덜덜 → 마지막에 «에취!»
    cat: 'weather', dur: 7, w: 0.9,
    init(a, S) { const L = S.L; a.sx = S.freeX(L.kx + (S.rand() < 0.5 ? -1 : 1) * L.W * 0.3 - 6 * S.A, 12 * S.A) + 6 * S.A; },
    end(a, S) { S.spawn('sneeze', true); },
    back(c, a, S) {
      const L = S.L, age = a.age;
      const k = clamp(Math.min(age / 0.8, (a.dur - age) / 0.8), 0, 1);
      if (k > 0.3) rect(c, 0, 0, L.W, L.floorY - 6, pat(c, '#d8e4ff', 4));
      const h = ro(Math.min(3, age * 0.8) * k);
      if (h > 0) {
        rect(c, 0, L.floorY - 7 - h, L.W, h, '#ffffff'); rect(c, 0, L.floorY - 7, L.W, 1, '#d0e0f8');
        rect(c, 0, L.floorY + 25 - h, L.W, h, '#ffffff');
      }
      if (age > 1.4) {
        const x = ro(a.sx), fy = L.floorY + 24;
        const st = age > a.dur - 0.5 ? 0 : Math.min(4, fl((age - 1.4) / 0.35));
        S.zoom(c, x, fy);
        oval(c, x - 0.5, fy - 5, 6, 5, OUT); oval(c, x - 0.5, fy - 5, 5, 4, '#ffffff'); rect(c, x - 4, fy - 2, 8, 1, '#d0e0f8');
        if (st >= 1) { oval(c, x - 0.5, fy - 13, 4.5, 4, OUT); oval(c, x - 0.5, fy - 13, 3.5, 3, '#ffffff'); }
        if (st >= 2) { px(c, x - 2, fy - 14, OUT); px(c, x + 1, fy - 14, OUT); rect(c, x, fy - 13, 3, 1, '#ff8a1a'); px(c, x - 1, fy - 6, OUT); px(c, x - 1, fy - 4, OUT); }
        if (st >= 3) { line(c, x - 5, fy - 8, x - 9, fy - 11, 1, '#6b3f1d'); line(c, x + 4, fy - 8, x + 8, fy - 11, 1, '#6b3f1d'); }
        if (st >= 4) { rect(c, x - 3, fy - 20, 6, 4, OUT); rect(c, x - 2, fy - 19, 4, 2, '#3a7be8'); rect(c, x - 4, fy - 17, 8, 1, OUT); }
        c.restore();
      }
    },
    front(c, a, S) {
      const L = S.L, age = a.age;
      const k = clamp(Math.min((age - 0.2) / 0.6, (a.dur - age) / 0.6), 0, 1);
      const n = ro((L.W * L.H) / 600 * k);
      for (let i = 0; i < n; i++) {
        const sp = 20 + (i % 4) * 9;
        const x = ro((hash(i * 9 + 3) * L.W + Math.sin(S.T * 1.5 + i) * 6 + L.W) % L.W);
        const y = ro((hash(i * 9 + 4) * L.H + S.T * sp) % (L.floorY + 24));
        if (i % 4 === 0) { rect(c, x - 1, y, 3, 1, '#ffffff'); rect(c, x, y - 1, 1, 3, '#ffffff'); }
        else rect(c, x, y, i % 3 ? 1 : 2, i % 3 ? 1 : 2, i % 5 ? '#ffffff' : '#d8e8ff');
      }
    },
    face(F) { F.shiver = 1; F.mouth = 'chatter'; F.pale = 1; F.blush = Math.max(F.blush, 1); },
  },
  thunder: { // 번개 «쾅!» — 머리털 쭈뼛 → 얼굴 검댕 + 연기
    cat: 'weather', dur: 2.8, w: 0.8, cool: 25,
    init(a, S) {
      const L = S.L;
      const tx = S.freeX(L.kx + (S.rand() < 0.5 ? -1 : 1) * (12 * L.K + 6), 8) + 4;
      const ty = L.floorY - 8;
      a.pts = [];
      let x = tx + (S.rand() - 0.5) * 40;
      const y = L.hudH, n = 8;
      for (let i = 0; i <= n; i++) { const u = i / n; a.pts.push([ro(x + (tx - x) * u + (i && i < n ? (S.rand() - 0.5) * 22 : 0)), ro(y + (ty - y) * u)]); }
      a.br = [a.pts[3], [a.pts[3][0] + (S.rand() < 0.5 ? -1 : 1) * 16, a.pts[3][1] + 22], [a.pts[3][0] + (S.rand() < 0.5 ? -1 : 1) * 10, a.pts[3][1] + 40]];
      a.tx = tx; a.ty = ty;
    },
    back(c, a, S) {
      const L = S.L, age = a.age;
      const k = clamp(Math.min(age / 0.25, (a.dur - age) / 0.5), 0, 1);
      rect(c, 0, 0, L.W, L.floorY - 6, pat(c, '#060818', k > 0.6 ? 2 : 3));
      darkClouds(c, S, k);
      if ((age > 0.3 && age < 0.34) || (age > 0.47 && age < 0.5)) rect(c, 0, 0, L.W, L.floorY - 6, age < 0.4 ? '#ffffff' : pat(c, '#ffffff', 2));
      if (age > 0.3 && age < 0.66 && !(age > 0.4 && age < 0.46)) {          // 번개 줄기 — 굵은 외곽선 + 노랑 + 흰 심
        const P = a.pts, B = a.br;
        for (const [w, col] of [[5, OUT], [3, '#ffe14d'], [1, '#ffffff']]) {
          for (let i = 0; i < P.length - 1; i++) line(c, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], w, col);
          for (let i = 0; i < B.length - 1; i++) line(c, B[i][0], B[i][1], B[i + 1][0], B[i + 1][1], Math.max(1, w - 2), col);
        }
        twinkle(c, a.tx, a.ty, 0, '#ffffff'); twinkle(c, a.tx - 4, a.ty - 3, 1, '#ffe14d'); twinkle(c, a.tx + 4, a.ty - 2, 1, '#ffe14d');
      }
      if (age > 0.3 && age < 1.8) {
        const q = age - 0.3;
        oval(c, a.tx - 0.5, a.ty + 3, 7, 2, '#2a2a2a');
        for (let i = 0; i < 3; i++) dust(c, a.tx - 4 + i * 4, a.ty - q * 20 - i * 3, fl(q * 3 + i * 0.5), '#8a8a90', '#5a5a60', S.A);
      }
    },
    front(c, a, S) {
      const L = S.L, age = a.age;
      if ((age > 0.3 && age < 0.34) || (age > 0.47 && age < 0.5)) { c.globalAlpha = 0.45; rect(c, 0, 0, L.W, L.H, '#ffffff'); c.globalAlpha = 1; }
      if (age > 0.3 && !a.said) { a.said = 1; S.say('쾅!', S.freeX(L.W / 2 - 18, 36), L.skyTop + 10, '#ffe14d', 2, 1.0); S.shakeFor(0.3, 2); S.crowdGroan = S.T; }
    },
    face(F, a) {
      if (a.age > 0.3 && a.age < 1.3) { F.hairUp = 1; F.eyes = 'pop'; F.mouth = 'scream'; F.pale = 1; }
      else if (a.age >= 1.3) { F.soot = 1; F.eyes = 'blank'; F.mouth = 'flat'; F.smoke = 1; }
    },
    mood(M, a) { if (a.age > 0.3 && a.age < 1.2) M.groan = 1; },
  },
  wind: { // 바람 쌩 — 나뭇잎 · 신문지가 날아가고 관중 모자가 휙
    cat: 'weather', dur: 4.2, w: 1,
    init(a, S) { a.dir = S.rand() < 0.5 ? 1 : -1; a.hx = S.freeX(S.L.W * (0.2 + S.rand() * 0.6), 8); a.hy = S.crowdY() + 20; },
    back(c, a, S) {
      const L = S.L, age = a.age, d = a.dir;
      const k = clamp(Math.min(age / 0.4, (a.dur - age) / 0.4), 0, 1);
      for (let i = 0; i < ro(14 * k); i++) {
        const len = 8 + (i % 4) * 5;
        const x = ((hash(i * 17) * (L.W + 60) + age * (240 + (i % 3) * 40)) % (L.W + 60)) - 30;
        const y = L.skyTop + ro(hash(i * 17 + 1) * (L.floorY - L.skyTop - 20));
        const X = ro(d > 0 ? x : L.W - x - len);
        rect(c, X, y, len, 1, '#ffffff'); rect(c, X + (d > 0 ? len : -3), y, 3, 1, pat(c, '#ffffff', 2));
      }
      if (age > 0.6 && age < 3.2) {
        const q = age - 0.6;
        const x = ro(a.hx + d * q * 70), y = ro(a.hy - q * 50 + q * q * 8);
        S.zoom(c, x, y);
        spr(c, 'hatR', HAT, { o: OUT, H: '#e8423a' }, x - 2, y - 1, fl(q * 8) % 2 === 1);
        c.restore();
        if (q < 0.1 && !a.s1) { a.s1 = 1; S.say('앗!', a.hx - 6, a.hy - 16, '#ffffff', 1, 0.6); }
      }
    },
    front(c, a, S) {
      const L = S.L, age = a.age, d = a.dir;
      for (let i = 0; i < 8; i++) {
        const x = ((age * (110 + i * 9) + hash(i * 23) * (L.W + 30)) % (L.W + 30)) - 15;
        const y = ro(L.floorY - 20 - hash(i * 23 + 1) * (L.floorY - L.skyBot) + Math.sin(age * 6 + i) * 6);
        const X = ro(d > 0 ? x : L.W - x);
        const f = fl(S.T * 10 + i) % 2;
        S.zoom(c, X, y);
        spr(c, (f ? 'lfA' : 'lfB') + (i % 3), f ? LEAF_A : LEAF_B, { o: OUT, G: ['#5fc35f', '#ff9a3a', '#ffd23f'][i % 3] }, X - 1, y - 1);
        c.restore();
      }
      const nx = ((age * 70) % (L.W + 40)) - 20, ny = ro(L.floorY - 16 - Math.abs(Math.sin(age * 4)) * 30);
      const X = ro(d > 0 ? nx : L.W - nx), f = fl(S.T * 8) % 2;
      S.zoom(c, X, ny);
      rect(c, X - 4, ny - 3, 9, f ? 7 : 5, OUT); rect(c, X - 3, ny - 2, 7, f ? 5 : 3, '#f0ece0');
      rect(c, X - 2, ny - 1, 5, 1, '#8a8a8a'); if (f) rect(c, X - 2, ny + 1, 3, 1, '#8a8a8a');
      c.restore();
    },
    face(F, a) { F.eyes = 'half'; F.mouth = 'wavy'; F.lean = a.dir; },
  },
  sun: { // 햇살 쨍 — 해가 슬쩍 내려와 선글라스를 척, 선수는 땀 뻘뻘
    cat: 'weather', dur: 5.6, w: 1,
    init(a, S) { const L = S.L; a.right = S.rand() < 0.5; const [m0, m1] = S.midFree(); a.sx = a.right ? m1 - 15 * S.A : m0 + 15 * S.A; a.sy = L.skyTop + 14 * S.A; },
    back(c, a, S) {
      const L = S.L, age = a.age;
      const k = clamp(Math.min(age / 0.6, (a.dur - age) / 0.6), 0, 1);
      if (k > 0.4) rect(c, 0, 0, L.W, L.floorY - 6, pat(c, '#ffb040', 4));
      const x = ro(a.sx), y = ro(a.sy - (1 - k) * 40 * S.A);
      S.zoom(c, x, y);
      const alt = fl(S.T * 4) % 2;
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * TAU + (alt ? TAU / 16 : 0);
        for (let r = 10; r < 15; r++) px(c, ro(x + Math.cos(an) * r), ro(y + Math.sin(an) * r), r < 13 ? '#ffe14d' : '#ffb03a');
      }
      oval(c, x - 0.5, y, 9, 9, OUT); oval(c, x - 0.5, y, 8, 8, '#ffcc22'); oval(c, x - 1.5, y - 1, 6, 6, '#ffe66a'); rect(c, x - 5, y - 5, 2, 2, '#fff6c0');
      const glasses = age > 1.4 ? Math.min(1, (age - 1.4) / 0.35) : 0;
      if (glasses < 1) { rect(c, x - 4, y - 2, 2, 2, OUT); rect(c, x + 2, y - 2, 2, 2, OUT); }
      if (glasses > 0) {
        const gy = ro(y - 2 - (1 - glasses) * 12);
        rect(c, x - 7, gy - 1, 15, 1, OUT); rect(c, x - 6, gy - 1, 5, 4, OUT); rect(c, x + 1, gy - 1, 5, 4, OUT);
        rect(c, x - 5, gy, 2, 1, '#6a7aff'); rect(c, x + 2, gy, 2, 1, '#6a7aff');
      }
      if (age > 1.8) { rect(c, x - 3, y + 3, 6, 1, OUT); rect(c, x - 2, y + 4, 4, 1, '#d9485a'); px(c, x - 4, y + 2, OUT); px(c, x + 3, y + 2, OUT); }
      else rect(c, x - 1, y + 3, 2, 1, OUT);
      if (age > 2.2 && age < 3.6) twinkle(c, x + (a.right ? -11 : 11), y - 9, fl(age * 6) % 3, '#ffffff');
      c.restore();
    },
    face(F) { F.sweat = Math.max(F.sweat, 2); F.blush = Math.max(F.blush, 1); },
  },
  rainbow: { // 무지개 (비 그친 뒤 · 피버 때 잘 나온다)
    cat: 'weather', dur: 5, w: 0.5,
    back(c, a, S) {
      const L = S.L, age = a.age;
      const cv = S.rainbowCv();
      const wipe = age < 1.2 ? age / 1.2 : age > a.dur - 1 ? 1 - (age - (a.dur - 1)) : 1;
      if (age > a.dur - 1) { const x0 = ro(L.W * (1 - wipe)); if (L.W - x0 > 0) c.drawImage(cv, x0, 0, L.W - x0, L.H, x0, 0, L.W - x0, L.H); }
      else { const w = ro(L.W * wipe); if (w > 0) c.drawImage(cv, 0, 0, w, L.H, 0, 0, w, L.H); }
    },
  },
  fireworks: { // 불꽃놀이 «펑»
    cat: 'weather', dur: 3.6, w: 0.7,
    init(a, S) { const [m0, m1] = S.midFree(); a.b = []; for (let i = 0; i < 4; i++) a.b.push([m0 + 14 + S.rand() * Math.max(4, m1 - m0 - 28), S.L.skyTop + 18 + S.rand() * Math.max(10, (S.L.skyBot - S.L.skyTop) * 0.55), i * 0.6 + S.rand() * 0.2, RAIN7[fl(S.rand() * 7)]]); },
    back(c, a, S) {
      const L = S.L;
      a.b.forEach(([bx, by, t0, col], j) => {
        const q = a.age - t0;
        if (q < 0) return;
        if (q < 0.35) { const yy = ro(L.floorY - 30 - (L.floorY - 30 - by) * (q / 0.35)); rect(c, ro(bx), yy, 1, 2, '#fff3a0'); px(c, ro(bx), yy + 3, '#ff9a3a'); px(c, ro(bx), yy + 5, '#c43a0a'); return; }
        const u = (q - 0.35) / 1.2;
        if (u > 1 || (u > 0.78 && fl(S.T * 20) % 2)) return;
        const r = 3 + Math.sqrt(u) * 30;
        for (let i = 0; i < 16; i++) {
          const an = (i / 16) * TAU;
          const x = ro(bx + Math.cos(an) * r), y = ro(by + Math.sin(an) * r + u * u * 8);
          const big = u < 0.45;
          rect(c, x, y, big ? 2 : 1, big ? 2 : 1, i % 2 ? col : '#ffffff');
          if (u < 0.6) px(c, ro(bx + Math.cos(an) * r * 0.65), ro(by + Math.sin(an) * r * 0.65 + u * u * 5), tone(col, 0.45));
          if (u > 0.3 && u < 0.8) px(c, ro(bx + Math.cos(an) * r * 0.85), ro(by + Math.sin(an) * r * 0.85 + u * u * 12 + 3), tone(col, -0.2));
        }
        if (u < 0.15) { twinkle(c, bx, by, 0, '#ffffff'); rect(c, ro(bx) - 1, ro(by) - 1, 3, 3, '#ffffff'); }
        if (!a['s' + j] && j % 2 === 0) { a['s' + j] = 1; S.say('펑!', ro(bx) - 10, ro(by) - 24, col, 1, 0.8); }
      });
    },
    mood(M) { M.stand = Math.max(M.stand, 0.6); },
    face(F, a) { if (a.age > 0.5 && a.age < 2.4) { F.eyes = fl(a.age * 2) % 2 ? 'star' : 'round'; F.mouth = 'O'; F.sparkle = 1; } },
  },

  /* ------------------------------ 땅 (선수 뒤 · 앞 바닥) ------------------------------ */
  cat: { // 고양이가 무대 끝에서 빼꼼 → 두리번 → 하품 → «야옹»
    cat: 'ground', dur: 4.8, w: 1.2,
    init(a, S) {
      const sl = S.slot(10 * S.A);
      if (sl.wide || S.rand() < 0.3) { a.x = sl.x + 5 * S.A; a.edge = sl.y; }
      else { const L = S.L; a.x = S.freeX(L.kx + (S.rand() < 0.5 ? -1 : 1) * (L.K * 11 + 8 * S.A) - 5 * S.A, 10 * S.A) + 5 * S.A; a.edge = L.floorY + 25; }   // 앞 바닥 아래에서 빼꼼
    },
    back(c, a, S) {
      const age = a.age, A = S.A;
      const rise = age < 0.5 ? age / 0.5 : age > a.dur - 0.5 ? (a.dur - age) / 0.5 : 1;
      const ax = ro(a.x), base = a.edge;
      const x = ax - 5, y = base - ro(rise * 9);
      S.zoom(c, ax, base);
      c.save(); c.beginPath(); c.rect(x - 4, y - 4, 18, base - y + 4); c.clip();
      const yawn = age > 2.0 && age < 2.9;
      spr(c, yawn ? 'catY' : 'catH', yawn ? CAT_YAWN : CAT_HEAD, CAT_PAL, x, y);
      if (!yawn && age > 0.7 && age < 1.9) { const look = fl((age - 0.7) / 0.4) % 2 ? 1 : -1; px(c, x + 2, y + 5, CAT_PAL.c); px(c, x + 7, y + 5, CAT_PAL.c); px(c, x + 2 + look, y + 5, OUT); px(c, x + 7 + look, y + 5, OUT); }
      c.restore();
      if (rise > 0.8) for (const ox of [1, 6]) { rect(c, x + ox, base - 1, 3, 2, OUT); rect(c, x + ox, base - 1, 3, 1, CAT_PAL.c); }
      if (rise > 0.6) { px(c, x - 1, y + 6, OUT); px(c, x - 2, y + 7, OUT); px(c, x + 10, y + 6, OUT); px(c, x + 11, y + 7, OUT); }
      c.restore();
      if (age > 3.0 && !a.said) { a.said = 1; S.say('야옹', ax - 10, base - 14 * A - 12, '#ffd8a0', 1, 1.0); }
      if (yawn && age > 2.3 && !a.said2) { a.said2 = 1; S.say('하암', ax - 10, base - 14 * A - 12, '#ffffff', 1, 0.6); }
    },
  },
  dog: { // 강아지가 뛰어와서 박자에 맞춰 같이 펄쩍 · 꼬리 살랑 · «멍!» → 쌩
    cat: 'ground', dur: 5.8, w: 1.2,
    init(a, S) { const L = S.L; a.dir = S.rand() < 0.5 ? 1 : -1; a.stop = S.freeX(L.kx - a.dir * (L.K * 10 + 6 * S.A) - 6 * S.A, 12 * S.A) + 6 * S.A; a.y = L.floorY + 23; },
    back(c, a, S) {
      const L = S.L, age = a.age, A = S.A;
      const start = a.dir > 0 ? -8 * A : L.W + 8 * A;
      let x, run = true, d = a.dir;
      if (age < 1.2) x = start + (a.stop - start) * (age / 1.2);
      else if (age < 4.2) { x = a.stop; run = false; }
      else { d = -a.dir; x = a.stop + (start - a.stop) * ((age - 4.2) / 1.6); }
      x = ro(x);
      const ph = S.beat - fl(S.beat);
      const hop = run ? (fl(S.T * 10) % 2) : ph < 0.3 ? ro(Math.sin((ph / 0.3) * Math.PI) * 5) : 0;
      const f = run ? fl(S.T * 12) % 2 : fl(S.T * 8) % 2;
      S.zoom(c, x, a.y);
      spr(c, f ? 'dogB' : 'dogA', f ? DOG_B : DOG_A, DOG_PAL, x - 6, a.y - 9 - hop, d < 0);
      if (run && fl(S.T * 12) % 3 === 0) dust(c, x + (d > 0 ? -8 : 7), a.y - 1, 2);
      c.restore();
      if (!run && ((age > 2.0 && !a.s1 && (a.s1 = 1)) || (age > 3.3 && !a.s2 && (a.s2 = 1)))) S.say('멍!', x + (d > 0 ? 8 * A : -8 * A - 14), a.y - 12 * A - 10, '#ffffff', 1, 0.6);
    },
  },
  mimic: { // 뒤에서 따라 뛰는 꼬마 → 꽈당 «쿵» → 머리 긁적 → 뿅 사라짐
    cat: 'ground', dur: 6.2, w: 1.4, cool: 14,
    init(a, S) { const sl = S.slot(10 * S.A); a.x = sl.x + 4 * S.A; a.y = sl.y; a.hc = ['#2a1d15', '#6b3f1d', '#e8c35a', '#c8402e'][fl(S.rand() * 4)]; a.tc = ['#3fbf5a', '#ff7fbf', '#3a7be8', '#ffd23f'][fl(S.rand() * 4)]; },
    back(c, a, S) {
      const age = a.age, ax = ro(a.x), base = a.y, A = S.A;
      const x = ax - 4;
      const pal = { o: OUT, k: OUT, h: a.hc, s: '#ffe0c2', m: MC, M: '#5a1010', t: a.tc, p: '#1d3f8a', z: '#e8423a' };
      if (age > a.dur - 0.7 && fl(S.T * 16) % 2) return;
      S.zoom(c, ax, base);
      if (age < 0.35) {
        const k = age / 0.35;
        c.save(); c.beginPath(); c.rect(x - 2, base - 20, 14, 20); c.clip();
        spr(c, 'mkS' + a.hc + a.tc, KID_STAND, pal, x, base - 14 + ro((1 - k) * 14));
        c.restore();
      } else if (age < 3.0) {
        const ph = S.beat - fl(S.beat);
        const up = ph < 0.35 ? ro(Math.sin((ph / 0.35) * Math.PI) * 6) : 0;
        if (up > 1) spr(c, 'mkJ' + a.hc + a.tc, KID_JUMP, pal, x, base - 13 - up);
        else spr(c, 'mkS' + a.hc + a.tc, KID_STAND, pal, x, base - 14);
        const th = (S.beat % 1) * TAU;
        const ry = ro(Math.cos(th) * 9);
        for (let i = -5; i <= 5; i++) px(c, x + 4 + i, base - 7 - up + ro(ry * (1 - (i * i) / 30)), '#ff4f8b');
      } else {
        spr(c, 'mkT' + a.hc + a.tc, KID_SIT, pal, x, base - 12);
        if (age < 3.9) {
          for (let i = 0; i < 3; i++) { const an = S.T * 7 + (i * TAU) / 3; spr(c, 'st5', STAR5S, { o: OUT, y: '#ffe14d' }, ro(x + 4 + Math.cos(an) * 7) - 2, ro(base - 17 + Math.sin(an) * 2) - 2); }
          rect(c, x + 2, base - 9, 2, 1, OUT); rect(c, x + 5, base - 9, 2, 1, OUT); px(c, x + 3, base - 10, '#ffe0c2'); px(c, x + 5, base - 10, '#ffe0c2');
        } else {
          const sc = fl(S.T * 10) % 2;
          rect(c, x + 8, base - 12 + sc, 3, 3, OUT); px(c, x + 9, base - 11 + sc, '#ffe0c2');
          rect(c, x + 7, base - 9, 1, 3, a.tc);
          px(c, x + 3, base - 9, OUT); px(c, x + 5, base - 9, OUT); px(c, x + 3, base - 10, '#ffe0c2');
          spr(c, 'sw', SWEAT, SWEAT_PAL, x - 4, base - 15);
        }
      }
      c.restore();
      if (age >= 3.0 && !a.said) { a.said = 1; S.say('쿵!', ax - 10, base - 18 * A - 10, '#ffffff', 1, 0.7); S.dustAt(ax, base); }
      if (age >= 3.9 && !a.said2) { a.said2 = 1; S.say('?', ax - 2, base - 18 * A - 10, '#ffe14d', 1, 1.2); }
    },
  },
  squirrel: { // 다람쥐가 쪼르르 → 앉아서 도토리 «냠냠» → 쪼르르
    cat: 'ground', dur: 5.2, w: 1,
    init(a, S) { const L = S.L; a.dir = S.rand() < 0.5 ? 1 : -1; a.stop = S.freeX(L.kx + a.dir * (L.K * 12 + 4 * S.A) - 5 * S.A, 11 * S.A) + 5 * S.A; a.y = L.floorY + 23; },
    back(c, a, S) {
      const L = S.L, age = a.age, A = S.A;
      const start = a.dir > 0 ? -8 * A : L.W + 8 * A;
      let x, run = true;
      if (age < 1) x = start + (a.stop - start) * age;
      else if (age < 3.8) { x = a.stop; run = false; }
      else x = a.stop + (L.W * 0.8) * a.dir * ((age - 3.8) / 1.4);
      x = ro(x);
      const f = run ? fl(S.T * 14) % 2 : 0;
      S.zoom(c, x, a.y);
      spr(c, f ? 'sqB' : 'sqA', f ? SQ_B : SQ_A, SQ_PAL, x - 5, a.y - 9 - (run ? f : 0), a.dir < 0);
      if (!run) {
        const axx = a.dir > 0 ? x + 3 : x - 6, chew = fl(S.T * 8) % 2;
        rect(c, axx - 1, a.y - 6 - chew, 4, 4, OUT); rect(c, axx, a.y - 5 - chew, 2, 2, '#a8703c'); rect(c, axx, a.y - 6 - chew, 2, 1, '#6b3f1d');
      }
      c.restore();
      if (!run && age > 1.4 && !a.said) { a.said = 1; S.say('냠냠', x - 14, a.y - 10 * A - 12, '#ffd8a0', 1, 1.4); }
    },
  },
  snail: { // 달팽이 — 아주아주 느리게 « . . . »
    cat: 'ground', dur: 9, w: 0.7, cool: 30,
    init(a, S) { const L = S.L; a.dir = S.rand() < 0.5 ? 1 : -1; a.x0 = S.freeX(a.dir > 0 ? L.kx - L.W * 0.38 : L.kx + L.W * 0.38 - 13 * S.A, 13 * S.A) + 6 * S.A; a.y = L.floorY + 23; },
    back(c, a, S) {
      const age = a.age;
      const vis = age < 0.4 ? age / 0.4 : age > a.dur - 0.4 ? (a.dur - age) / 0.4 : 1;
      if (vis < 0.5 && fl(S.T * 12) % 2) return;
      const ax = ro(a.x0 + a.dir * age * 3), x = ax - 6;
      S.zoom(c, ax, a.y);
      for (let i = 1; i < 12; i++) px(c, x + (a.dir > 0 ? -i : 12 + i), a.y - 1, i % 2 ? '#d8f0ff' : '#a8c8e0');
      spr(c, 'snail', SNAIL, SNAIL_PAL, x, a.y - 8, a.dir < 0);
      const dots = fl(age / 0.7) % 4;
      for (let i = 0; i < dots; i++) rect(c, x + 2 + i * 3, a.y - 13, 2, 2, '#ffffff');
      c.restore();
    },
  },
  mole: { // 두더지가 바닥에서 쏙 → 두리번 «?» → 쏙
    cat: 'ground', dur: 3.6, w: 1,
    init(a, S) { const L = S.L; a.x = S.freeX(L.kx + (S.rand() < 0.5 ? -1 : 1) * (L.K * 11 + 6 * S.A) - 4 * S.A, 10 * S.A) + 4 * S.A; a.y = L.floorY + 22; },
    back(c, a, S) {
      const age = a.age, ax = ro(a.x), y = a.y, x = ax - 4;
      S.zoom(c, ax, y);
      const hole = age < 0.2 ? age / 0.2 : age > 3.0 ? Math.max(0, 1 - (age - 3.0) / 0.4) : 1;
      if (hole > 0) { oval(c, x + 3.5, y, 5 * hole, 2 * hole, OUT); oval(c, x + 3.5, y, 4 * hole, 1.2 * hole, '#2a1a10'); }
      const up = age < 0.2 ? 0 : age < 0.45 ? (age - 0.2) / 0.25 : age < 2.6 ? 1 : age < 2.9 ? 1 - (age - 2.6) / 0.3 : 0;
      if (up > 0) {
        c.save(); c.beginPath(); c.rect(x - 2, y - 12, 12, 12); c.clip();
        spr(c, 'mole', MOLE, MOLE_PAL, x, y - ro(up * 7));
        if (age > 0.7 && age < 2.4) { const lk = fl(age / 0.35) % 2 ? 1 : -1; const yy = y - ro(up * 7) + 3; px(c, x + 2, yy, MOLE_PAL.d); px(c, x + 5, yy, MOLE_PAL.d); px(c, x + 2 + lk, yy, OUT); px(c, x + 5 + lk, yy, OUT); }
        c.restore();
        rect(c, x - 2, y - 1, 3, 2, OUT); rect(c, x + 7, y - 1, 3, 2, OUT); rect(c, x - 1, y - 1, 2, 1, '#ff8aa0'); rect(c, x + 7, y - 1, 2, 1, '#ff8aa0');
      }
      if (age > 2.9) for (let i = 0; i < 3; i++) dust(c, x + 1 + i * 3, y - 1, 1, '#c09a64', '#8a6a44');
      c.restore();
      if (age > 1.0 && !a.said) { a.said = 1; S.say('?', ax - 2, y - 10 * S.A - 12, '#ffe14d', 1, 1.0); }
    },
  },
  cheer: { // 응원단 꼬마 — 폼폼을 박에 맞춰 번쩍번쩍
    cat: 'ground', dur: 5, w: 1,
    init(a, S) {
      const L = S.L, sl = S.slot(14 * S.A);
      if (sl.wide) { a.x = sl.x + 6 * S.A; a.y = sl.y; }
      else { a.x = S.freeX(L.kx + (S.rand() < 0.5 ? -1 : 1) * (L.K * 12 + 8 * S.A) - 7 * S.A, 14 * S.A) + 6 * S.A; a.y = L.floorY + 23; }   // 앞 바닥, 선수 발 옆
      a.pc = ['#ffd23f', '#ff4f8b', '#4dc3ff'][fl(S.rand() * 3)];
    },
    back(c, a, S) {
      const age = a.age, ax = ro(a.x), base = a.y, x = ax - 4;
      if (age > a.dur - 0.5 && fl(S.T * 16) % 2) return;
      const ph = S.beat - fl(S.beat), up = (fl(S.beat) % 2 === 0) === (ph < 0.5);
      const pal = { o: OUT, k: OUT, h: '#c8402e', s: '#ffe0c2', m: MC, M: '#5a1010', t: '#ffffff', p: '#e8423a', z: '#ffffff' };
      const hop = ph < 0.25 ? 2 : 0;
      S.zoom(c, ax, base);
      spr(c, 'chS', KID_STAND, pal, x, base - 14 - hop);
      for (const s of [-1, 1]) {
        const hx = s < 0 ? x - 3 : x + 9, hy = base - 14 - hop + ((s < 0) === up ? -3 : 7);
        oval(c, hx + 0.5, hy + 1.5, 3, 3, OUT); oval(c, hx + 0.5, hy + 1.5, 2, 2, a.pc); px(c, hx, hy + 1, '#ffffff');
      }
      if (age > 0.6) ptext(c, 'GO!', x - 1, base - 26 - (fl(S.beat) % 2), a.pc, 'outline');
      c.restore();
    },
  },
  ball: { // 공이 통통 굴러 지나간다
    cat: 'ground', dur: 3, w: 0.8,
    init(a, S) { a.dir = S.rand() < 0.5 ? 1 : -1; a.y = S.L.floorY + 23; },
    back(c, a, S) {
      const L = S.L, u = a.u;
      const X = ro(a.dir > 0 ? -6 + u * (L.W + 12) : L.W + 6 - u * (L.W + 12));
      const b = Math.abs(Math.sin(u * Math.PI * 5)) * 7 * (1 - u * 0.6);
      S.zoom(c, X, a.y);
      const Y = ro(a.y - 4 - b);
      oval(c, X - 0.5, Y, 3.5, 3.5, OUT); oval(c, X - 0.5, Y, 2.5, 2.5, '#ffffff');
      const sp = fl(S.T * 10) % 2;
      px(c, X - 1 + sp, Y - 1, OUT); px(c, X + 1 - sp, Y + 1, OUT); px(c, X - 2, Y + sp, OUT);
      if (b < 1.5) dust(c, X, a.y - 1, 2);
      c.restore();
    },
  },
  frog: { // 개구리가 박에 맞춰 폴짝 «♪» (비 올 때 잘 나온다)
    cat: 'ground', dur: 4.5, w: 0.7,
    init(a, S) { const L = S.L; a.dir = S.rand() < 0.5 ? 1 : -1; a.x0 = S.freeX(a.dir > 0 ? L.kx - L.W * 0.36 : L.kx + L.W * 0.36 - 9 * S.A, 9 * S.A) + 4 * S.A; a.y = L.floorY + 23; a.b0 = S.beat; },
    back(c, a, S) {
      const age = a.age;
      if (age > a.dur - 0.4 && fl(S.T * 16) % 2) return;
      const ph = S.beat - fl(S.beat);
      const hop = ph < 0.4 ? ro(Math.sin((ph / 0.4) * Math.PI) * 7) : 0;
      const ax = ro(a.x0 + a.dir * Math.min(fl(S.beat - a.b0) + (ph < 0.4 ? ph / 0.4 : 1), 6) * 3 * S.A);
      S.zoom(c, ax, a.y);
      spr(c, 'frog', FROG, FROG_PAL, ax - 4, a.y - 7 - hop, a.dir < 0);
      if (hop > 3 && fl(S.beat) % 2) spr(c, 'noteG', NOTE, { o: OUT, y: '#b8f0a0' }, ax - 2, a.y - 22 - hop);
      c.restore();
    },
  },

  /* ------------------------------ 관중 ------------------------------ */
  wave: { // 관중 파도타기 «와~»
    cat: 'crowd', dur: 2.6, w: 1.2,
    init(a, S) { a.dir = S.rand() < 0.5 ? 1 : -1; S.say('와~', S.freeX(S.L.W * 0.5 - 12, 24), S.crowdY(), '#ffe14d', 1, 1.0); },
    mood(M, a, S) { const L = S.L; const x = -30 + (L.W + 60) * a.u; M.wave = a.dir > 0 ? x : L.W - x; M.stand = Math.max(M.stand, 0.3); },
  },
  roar: { // 크게 환호 — 팔 번쩍 펄쩍 · 모자 휙휙 «와~!»
    cat: 'crowd', dur: 1.9, w: 1.1,
    init(a, S) { a.hats = []; for (let i = 0; i < 6; i++) a.hats.push([S.freeX(S.L.W * (0.08 + S.rand() * 0.84), 6), S.rand() * 0.4, RAIN7[fl(S.rand() * 7)]]); S.say('와~!', S.freeX(S.L.W * 0.5 - 16, 30), S.crowdY(), '#ffffff', 2, 1.1); S.cheerAt = S.T; },
    back(c, a, S) {
      for (const [hx, d, col] of a.hats) {
        const q = a.age - d; if (q < 0 || q > 1.3) continue;
        const y = S.crowdY() + 26 - q * 70 + q * q * 50, x = hx + Math.sin(q * 5 + hx) * 6;
        spr(c, 'hat' + col, HAT, { o: OUT, H: col }, ro(x) - 2, ro(y), fl(q * 10) % 2 === 1);
      }
    },
    mood(M, a) { M.cheer = Math.max(M.cheer, clamp(Math.min(a.age / 0.1, (a.dur - a.age) / 0.4), 0, 1)); },
  },
  groan: { // «아~» — 관중이 머리를 감싸고 털썩
    cat: 'crowd', dur: 1.5, w: 0.5,
    init(a, S) { S.say('아~', S.freeX(S.L.W * 0.5 - 12, 24), S.crowdY(), '#c8ccd4', 1, 1.2); },
    mood(M) { M.groan = 1; },
  },
  flash: { // 카메라 플래시 세례 — 번쩍번쩍
    cat: 'crowd', dur: 1.4, w: 1,
    back(c, a, S) {
      const L = S.L, top = S.crowdTop();
      for (let i = 0; i < 6; i++) {
        const k = fl(a.age * 14) * 6 + i + a.seed;
        if (hash(k) < 0.3) continue;
        const x = S.freeX(ro(hash(k + 1) * L.W), 4) + 2, y = ro(top + hash(k + 2) * Math.max(10, L.floorY - 20 - top));
        const big = hash(k + 3) < 0.45;
        rect(c, x - (big ? 4 : 2), y, big ? 9 : 5, 1, '#ffffff'); rect(c, x, y - (big ? 4 : 2), 1, big ? 9 : 5, '#ffffff');
        if (big) { rect(c, x - 1, y - 1, 3, 3, '#ffffff'); for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) px(c, x + dx, y + dy, '#bfe8ff'); }
      }
    },
    mood(M) { M.stand = Math.max(M.stand, 0.4); },
  },
  pickets: { // 응원 피켓이 쑥쑥 — 하트 · 별 · GO · 웃는 얼굴 (관중이 머리 위로 높이)
    cat: 'crowd', dur: 4.2, w: 1.1,
    init(a, S) { const [m0, m1] = S.midFree(); a.p = []; const n = Math.max(2, Math.min(4, fl((m1 - m0) / 24))); for (let i = 0; i < n; i++) a.p.push([ro(m0 + 2 + (m1 - m0 - 17) * (n > 1 ? i / (n - 1) : 0.5)), i % 4, S.rand() * 0.4]); },
    back(c, a, S) {
      const L = S.L, age = a.age;
      const ph = S.beat - fl(S.beat);
      a.p.forEach(([px0, kind, d], i) => {
        const q = age - d; if (q < 0) return;
        const up = Math.min(1, q / 0.3) * (age > a.dur - 0.3 ? (a.dur - age) / 0.3 : 1);
        const bob = (fl(S.beat) + i) % 2 && ph < 0.3 ? -3 : 0;
        const x = px0, y = ro(L.skyBot - 4 - (i % 2) * 10 + (1 - up) * 50 + bob);
        rect(c, x + 6, y + 8, 2, L.floorY - y - 20, '#8a5a30');
        rect(c, x - 1, y - 1, 15, 10, OUT); rect(c, x, y, 13, 8, '#fff8e8'); rect(c, x, y + 7, 13, 1, '#e0d0b0');
        if (kind === 0) spr(c, 'h7', HEART7, { o: OUT, r: '#ff4f6d' }, x + 3, y + 1);
        else if (kind === 1) spr(c, 'st5y', STAR5S, { o: OUT, y: '#ffcc22' }, x + 4, y + 1);
        else if (kind === 2) ptext(c, 'GO', x + 3, y + 1, '#e8423a', null);
        else { rect(c, x + 4, y + 2, 1, 2, OUT); rect(c, x + 8, y + 2, 1, 2, OUT); rect(c, x + 4, y + 5, 5, 1, OUT); px(c, x + 3, y + 4, OUT); px(c, x + 9, y + 4, OUT); }
      });
    },
    mood(M) { M.stand = Math.max(M.stand, 0.5); },
  },
  bigflag: { // 커다란 응원 깃발 펄럭펄럭 (선수 머리 위 하늘까지 높이)
    cat: 'crowd', dur: 3.6, w: 1,
    init(a, S) { const [m0, m1] = S.midFree(); a.x = S.rand() < 0.5 ? m0 + 2 : Math.max(m0 + 2, m1 - 24); a.cols = [['#e8423a', '#ffffff'], ['#3a7be8', '#ffd23f'], ['#3fbf5a', '#ffffff'], ['#9b5de5', '#ffe14d']][fl(S.rand() * 4)]; },
    back(c, a, S) {
      const L = S.L, age = a.age;
      const up = Math.min(1, age / 0.4) * (age > a.dur - 0.4 ? (a.dur - age) / 0.4 : 1);
      const x = ro(a.x), top = ro(L.skyBot - 30 + (1 - up) * 60);
      rect(c, x - 1, top - 1, 3, L.floorY - 14 - top, OUT); rect(c, x, top, 1, L.floorY - 16 - top, '#c8a060');
      rect(c, x - 1, top - 3, 3, 2, '#ffd23f');
      const [c1, c2] = a.cols;
      for (let i = 0; i < 22; i++) {
        const wv = ro(Math.sin(age * 9 - i * 0.5) * 2);
        const yy = top + 1 + wv;
        rect(c, x + 1 + i, yy - 1, 1, 15, OUT);
        rect(c, x + 1 + i, yy, 1, 13, i < 7 ? c2 : c1);
        rect(c, x + 1 + i, yy + 5, 1, 3, i < 7 ? c1 : c2);
      }
      const sx = x + 14, sy = top + 3 + ro(Math.sin(age * 9 - 13 * 0.5) * 2);
      spr(c, 'st5f', STAR5S, { o: OUT, y: c2 }, sx - 2, sy);
    },
    mood(M) { M.stand = Math.max(M.stand, 0.4); },
  },
  confetti: { // 꽃가루 펑펑
    cat: 'crowd', dur: 3, w: 0.9,
    front(c, a, S) {
      const L = S.L;
      const n = ro(L.W / 2.2);
      for (let i = 0; i < n; i++) {
        const t0 = hash(i * 11 + a.seed) * 0.8;
        const q = a.age - t0; if (q < 0) continue;
        const x = ro(hash(i * 11 + 1) * L.W + Math.sin(q * 4 + i) * 5), y = ro(L.hudH - 4 + q * (40 + (i % 5) * 12));
        if (y > L.floorY + 20) continue;
        const col = RAIN7[i % 7];
        if ((fl(S.T * 10) + i) % 2) rect(c, x, y, 3, 2, col); else rect(c, x, y, 2, 3, tone(col, -0.2));
      }
    },
    mood(M) { M.cheer = Math.max(M.cheer, 0.4); },
  },
  clap: { // 다 같이 박수 «짝짝»
    cat: 'crowd', dur: 2.6, w: 1,
    back(c, a, S) {
      const b = fl(S.beat);
      if (b !== a.lb) { a.lb = b; S.say('짝', S.freeX(S.L.W * (0.15 + hash(b * 7 + a.seed) * 0.7) - 6, 14), S.crowdY() - 4 + ro(hash(b * 7 + 1) * 14), '#ffe14d', 1, 0.35); }
    },
    mood(M) { M.clap = 1; },
  },

  /* ------------------------------ 앞 (줄 근처 · 선수 얼굴 근처) ------------------------------ */
  birdDive: { // 새가 줄 가까이 내려왔다가 눈 동그래져서 «휙!» 도망 — 깃털 두 장 팔랑
    cat: 'front', dur: 2.8, w: 1.4,
    init(a, S) { a.side = S.rand() < 0.5 ? -1 : 1; a.ci = fl(S.rand() * 4); },
    front(c, a, S) {
      const L = S.L, age = a.age, s = a.side;
      const P = { x: L.kx + s * (13 * L.K), y: L.floorY - 50 * L.K };
      const S0 = { x: s < 0 ? -14 : L.W + 14, y: L.skyTop + 4 };
      let x, y, big = false, fast = false, dir = -s;
      if (age < 0.9) { const k = age / 0.9, e = 1 - (1 - k) * (1 - k); x = S0.x + (P.x - S0.x) * e; y = S0.y + (P.y - S0.y) * e + Math.sin(k * Math.PI) * 10; }
      else if (age < 1.3) { x = P.x + Math.sin(age * 30); y = P.y; big = age > 1.0; fast = true; }
      else { const k = (age - 1.3) / 0.6; x = P.x + s * k * k * L.W * 0.8; y = P.y - k * 90; fast = true; dir = s; }
      x = ro(x); y = ro(y);
      if (age < 1.9) {
        S.zoom(c, x, y);
        bird(c, x, y, dir, S.T, a.ci, big, fast);
        if (age > 1.0 && age < 1.3) htext(c, '!', x - 1, y - 20, '#ffe14d');
        if (age >= 1.3 && age < 1.75) for (let i = 0; i < 4; i++) rect(c, x - s * (8 + i * 6) - (s > 0 ? 5 : 0), y + 4 + i * 2, 5, 1, '#ffffff');
        c.restore();
      }
      if (age >= 1.3 && !a.said) { a.said = 1; S.say('휙!', P.x - 12, P.y - 14 * S.A - 10, '#ffffff', 1, 0.8); }
      if (age > 1.3) for (let i = 0; i < 2; i++) {
        const q = age - 1.3, fx = ro(P.x + (i ? 6 : -4) * S.A + Math.sin(q * 5 + i * 2) * 6), fyy = ro(P.y + q * 24);
        S.zoom(c, fx, fyy);
        rect(c, fx - 1, fyy, 4, 1, OUT); rect(c, fx, fyy, 2, 1, i ? '#ffffff' : BIRD_PAL[a.ci].L); px(c, fx + 2 - (fl(q * 6) % 2) * 3, fyy - 1, OUT);
        c.restore();
      }
    },
    face(F, a) { if (a.age > 0.8 && a.age < 1.6) { F.eyes = 'round'; F.mouth = 'o'; } },
  },
  butterfly: { // 나비가 팔랑팔랑 머리 둘레를 돌다 → 코에 앉는다 → 사팔눈 → «에취!» → 팔랑
    cat: 'front', dur: 5, w: 1.1,
    init(a, S) { a.side = S.rand() < 0.5 ? -1 : 1; a.col = ['#ff7fbf', '#ffd23f', '#9fe8ff', '#c45cff'][fl(S.rand() * 4)]; },
    front(c, a, S) {
      const L = S.L, H = S.head, age = a.age, A = S.A;
      const nose = { x: H.x - 1, y: H.y + 2 * L.K - 2 * A };
      let x, y;
      if (age < 2.4) { const k = age / 2.4, r = (1 - k) * 40 + 3, an = age * 3.4 * a.side; x = nose.x + Math.cos(an) * r * 1.2; y = nose.y - (1 - k) * 18 + Math.sin(an) * r * 0.6 + Math.sin(age * 13) * 2; }
      else if (age < 3.6) { x = nose.x; y = nose.y; }
      else { const k = (age - 3.6) / 1.4; x = nose.x - a.side * k * 80 + Math.sin(age * 9) * 4; y = nose.y - k * 90; }
      x = ro(x); y = ro(y);
      const open = age >= 2.4 && age < 3.6 ? fl(S.T * 3) % 2 : fl(S.T * 12) % 2;
      S.zoom(c, x, y);
      spr(c, (open ? 'bfA' : 'bfB') + a.col, open ? BFLY_A : BFLY_B, { o: OUT, p: a.col, y: '#ffffff' }, x - 3, y - 2);
      c.restore();
      if (age >= 3.6 && !a.said) { a.said = 1; S.say('에취!', H.x + 10 * L.K / 3 + 8, H.y - 12 * L.K, '#ffffff', 1, 0.9); S.shakeFor(0.1, 1); }
    },
    face(F, a) {
      if (a.age > 2.2 && a.age < 3.6) { F.eyes = 'cross'; F.mouth = a.age > 3.0 ? 'O' : 'wavy'; F.mk = 0.4; F.jerk = a.age > 3.2 ? -1 : 0; }
      else if (a.age >= 3.6 && a.age < 4.2) { F.eyes = 'shut'; F.mouth = 'scream'; F.spray = a.age - 3.6; F.jerk = a.age < 3.7 ? 2 : 0; }
    },
  },
  birdHead: { // 작은 새가 머리 위에 앉아 같이 들썩 «♪» → 포르르
    cat: 'front', dur: 5.6, w: 1.1,
    init(a, S) { a.side = S.rand() < 0.5 ? -1 : 1; a.ci = fl(S.rand() * 4); },
    front(c, a, S) {
      const L = S.L, H = S.head, age = a.age;
      const top = { x: H.x + 2, y: H.y - 11 * L.K - 4 * S.A };
      let x, y, sit = false, dir = -a.side;
      if (a.leave && a.leaveAt == null) a.leaveAt = age;
      const lv = a.leaveAt != null ? Math.min(age - a.leaveAt, age - (a.dur - 0.9)) : age - (a.dur - 0.9);
      if (age < 0.9) { const k = age / 0.9; x = top.x + a.side * (1 - k) * L.W * 0.6; y = top.y - (1 - k) * 50 - Math.sin(k * Math.PI) * 10; }
      else if (lv < 0) { x = top.x; y = top.y; sit = true; }
      else { x = top.x + a.side * lv * 90; y = top.y - lv * 70; dir = a.side; }
      x = ro(x); y = ro(y);
      S.zoom(c, x, y);
      bird(c, x, y, dir, S.T, a.ci, false, !sit, sit);
      if (sit && fl(S.T * 2) % 3 === 0) spr(c, 'note', NOTE, { o: OUT, y: '#ffe14d' }, x + 4, y - 16);
      c.restore();
    },
    face(F, a) { if (a.age > 0.8 && a.age < 2.0) { F.eyes = 'lookUp'; F.mouth = 'o'; } },
  },
  bubbles: { // 비눗방울이 둥실둥실 · 하나씩 «펑»
    cat: 'front', dur: 4.6, w: 1,
    init(a, S) { a.b = []; for (let i = 0; i < 6; i++) a.b.push([S.freeX(S.L.kx + (S.rand() - 0.5) * S.L.W * 0.8, 8 * S.A) + 4 * S.A, S.rand() * 0.8, 2.2 + S.rand() * 2.2, 2 + fl(S.rand() * 3)]); },
    front(c, a, S) {
      const L = S.L;
      a.b.forEach(([bx, t0, tp, r], i) => {
        const q = a.age - t0; if (q < 0) return;
        const x = ro(bx + Math.sin(q * 2.5 + i) * 6), y = ro(L.floorY - 16 - q * 28);
        S.zoom(c, x, y);
        if (q > tp) {
          if (q < tp + 0.18) { const f = fl((q - tp) / 0.06); for (let k = 0; k < 6; k++) { const an = (k / 6) * TAU; px(c, ro(x + Math.cos(an) * (r + f * 2)), ro(y + Math.sin(an) * (r + f * 2)), '#ffffff'); } }
        } else {
          oval(c, x - 0.5, y, r + 1, r + 1, '#9fd8ff'); oval(c, x - 0.5, y, r, r, RAIN7[(i + fl(S.T * 4)) % 7]); oval(c, x - 0.5, y, r - 0.6, r - 0.6, '#e8f8ff');
          px(c, x - ro(r / 2) - 1, y - ro(r / 2), '#ffffff');
        }
        c.restore();
        if (q > tp && i % 2 === 0 && !a['p' + i]) { a['p' + i] = 1; S.say('펑', x - 6, y - 8 * S.A - 6, '#bfe8ff', 1, 0.4); }
      });
    },
    face(F, a) { if (a.age > 0.6 && a.age < 2.0) { F.eyes = 'round'; F.mouth = 'o'; } },
  },
  fly: { // 파리가 윙윙 — 선수 눈이 졸졸 따라간다
    cat: 'front', dur: 3.6, w: 0.9,
    front(c, a, S) {
      const L = S.L, H = S.head, age = a.age;
      const w = 4.2, R = 16 * L.K / 3;
      const ent = Math.min(1, age / 0.5), ex = age > a.dur - 0.5 ? (age - (a.dur - 0.5)) / 0.5 : 0;
      const pos = (q) => [H.x + Math.cos(q * w) * R * (0.7 + 0.3 * ent) * 2 + ex * 80, H.y - 4 * L.K + Math.sin(q * w * 2) * 10 - ex * 60];
      const [x0, y0] = pos(age);
      const x = ro(x0), y = ro(y0);
      a.fx = x - H.x;
      for (let i = 1; i < 5; i++) { const [qx, qy] = pos(age - i * 0.04); px(c, ro(qx), ro(qy), '#9aa0b0'); }
      S.zoom(c, x, y);
      const wg = fl(S.T * 30) % 2;
      rect(c, x - 2, y - 1, 5, 4, OUT); rect(c, x - 1, y, 3, 2, '#3a4a3a'); px(c, x + 1, y, '#ff4d4d');    // 몸 · 빨간 눈
      rect(c, x - 2 + (wg ? 0 : 1), y - 3, 2, 2, '#d8e8ff'); rect(c, x + 1 - (wg ? 0 : 1), y - 3, 2, 2, '#d8e8ff');   // 날개 파닥
      c.restore();
      if (fl(age * 3) % 2 && age < a.dur - 0.5) { px(c, x + 6, y - 4, '#ffffff'); px(c, x + 8, y - 6, '#ffffff'); px(c, x + 10, y - 5, '#ffffff'); }
    },
    face(F, a) { F.eyes = 'look'; F.eyeDx = (a.fx || 0) > 8 ? 1 : (a.fx || 0) < -8 ? -1 : 0; F.mouth = 'wavy'; },
  },

  /* ------------------------------ 얼굴 (선수 표정 이벤트) ------------------------------ */
  sweat: { cat: 'face', dur: 2, w: 1, face(F) { F.sweat = 3; F.mouth = 'wavy'; F.eyes = 'round'; }, init(a, S) { S.say('헉', S.head.x + 10, S.head.y - 12 * S.L.K, '#bfe8ff', 1, 0.7); } },
  steam: { cat: 'face', dur: 2.2, w: 1, face(F) { F.steam = 2; F.blush = 2; F.mouth = 'clench'; F.eyes = 'shut'; } },
  red: { cat: 'face', dur: 2, w: 1, face(F) { F.blush = 2; F.eyes = 'shut'; F.mouth = 'wavy'; F.steam = Math.max(F.steam, 1); } },
  angry: { cat: 'face', dur: 2, w: 0.9, face(F, a) { F.eyes = 'angry'; F.brows = 'angry'; F.vein = 1; F.mouth = a.age < 0.6 ? 'scream' : 'clench'; F.blush = Math.max(F.blush, 1); F.steam = Math.max(F.steam, 1); }, init(a, S) { S.say('흥!', S.head.x - 30, S.head.y - 12 * S.L.K, '#ff7a7a', 1, 0.8); } },
  gloom: { cat: 'face', dur: 2.4, w: 0.8, face(F) { F.gloom = 1; F.eyes = 'blank'; F.mouth = 'wavy'; F.slump = 1; } },
  sigh: { cat: 'face', dur: 2.2, w: 1, face(F, a) { F.eyes = 'half'; F.mouth = 'sigh'; F.sigh = a.age; }, init(a, S) { S.say('휴~', S.head.x + 14, S.head.y - 4 * S.L.K, '#ffffff', 1, 1.3); } },
  shock: { cat: 'face', dur: 1.6, w: 0.9, face(F) { F.eyes = 'pop'; F.mouth = 'scream'; F.pale = 1; F.hairUp = 1; }, init(a, S) { S.say('헉!', S.head.x - 34, S.head.y - 12 * S.L.K, '#ffffff', 1, 0.9); S.shakeFor(0.12, 1); } },
  sneeze: { // 코가 간질 → 크게 «에취!» → 콧물 찔끔
    cat: 'face', dur: 2.2, w: 0.9,
    face(F, a, S) {
      if (a.age < 0.9) { F.eyes = a.age > 0.4 ? 'half' : 'line'; F.mouth = 'O'; F.mk = a.age / 0.9; F.jerk = a.age > 0.5 ? -1 : 0; }
      else if (a.age < 1.4) { F.eyes = 'shut'; F.mouth = 'scream'; F.spray = a.age - 0.9; F.jerk = a.age < 1.0 ? 2 : 0; if (!a.said) { a.said = 1; S.say('에취!', S.head.x + 12, S.head.y - 10 * S.L.K, '#ffffff', 1, 0.9); S.shakeFor(0.1, 1); } }
      else { F.eyes = 'line'; F.mouth = 'wavy'; F.snot = 0.6; }
    },
  },
  laugh: { cat: 'face', dur: 2, w: 1, face(F, a) { F.eyes = 'happy'; F.mouth = 'bigGrin'; F.tear = 1; F.jerk = fl(a.age * 10) % 2; }, init(a, S) { S.say('하하', S.head.x + 14, S.head.y - 12 * S.L.K, '#ffe14d', 1, 1.2); } },
  proud: { cat: 'face', dur: 1.8, w: 1, face(F) { F.eyes = 'half'; F.mouth = 'smirk'; F.sparkle = 1; F.blush = Math.max(F.blush, 1); } },
  starEyes: { cat: 'face', dur: 2.2, w: 0.6, face(F) { F.eyes = 'star'; F.mouth = 'bigGrin'; F.sparkle = 1; } },
  heartEyes: { cat: 'face', dur: 2.2, w: 0.5, face(F) { F.eyes = 'heart'; F.mouth = 'grin'; F.blush = Math.max(F.blush, 1); } },
  dizzy: { cat: 'face', dur: 1.8, w: 0.3, face(F) { F.eyes = 'spiral'; F.mouth = 'wavy'; } },
  cry: { cat: 'face', dur: 2.2, w: 0.6, face(F) { F.eyes = 'shut'; F.tear = 2; F.mouth = 'scream'; } },
};

/** 먹구름 줄 — 위쪽에 회색 구름 덩이가 줄줄이 (k 0~1 내려온 정도) */
const cloudStrip = new Map();
function darkClouds(c, S, k) {
  if (k <= 0) return;
  const L = S.L;
  let cv = cloudStrip.get(L.W);
  if (!cv) {
    cv = canvas(L.W, 34);
    const g = cv.getContext('2d');
    for (let i = 0, x = -6; x < L.W + 6; i++) {
      const w = 22 + fl(hash(i * 7 + 3) * 14), yy = 8 + fl(hash(i * 7) * 5);
      puffCloud(g, x, yy, w, '#5a5e72', '#3a3e52');
      rect(g, x + 3, yy + 1, w - 8, 1, '#7a7e92');
      x += w - 6;
    }
    cloudStrip.set(L.W, cv);
  }
  c.drawImage(cv, 0, ro(L.hudH - 22 + k * 12));
}

/* =====================================================================
 * 엔진
 * ===================================================================== */
export function createComic(opts = {}) {
  const rand = rng(opts.seed ?? (Date.now() & 0xffffff));
  const S = {
    T: 0, frame: 0, beat: 0, rand,
    arena: opts.arena | 0,
    L: { W: 195, H: 422, hudH: 36, floorY: 332, kx: 97, K: 3, laneW: 26, xL: 12, xR: 156, jumpOnly: false, key: '', free: [[0, 195]], slots: [], skyTop: 42, skyBot: 160, clip: null, dark: false },
    acts: [], next: 1.0, recent: [], lastRun: Object.create(null), weatherEnd: -99,
    texts: [], syms: [], impacts: [], lands: [], puffs: [],
    prevK: null, hiK: 0, prevLift: 0, maxLift: 0, jumpN: 0, jumpAt: -9, landAt: -9, impN: 0, landN: 0,
    perfAt: -9, missAt: -9, tripAt: -9, cheerAt: -9, sneezeAt: -9, hotUntil: -9, crowdGroan: -9, missN: 0,
    combo: 0, hp: 100, fever: false, phase: 'ready',
    shakeEnd: -9, shakeAmp: 0,
    mood: { cheer: 0, groan: 0, wave: -1e9, clap: 0, stand: 0 },
    F: {}, base: { id: 'normal', t0: 0, dur: 2 }, blinkAt: 1.5, nextSym: 0,
    skin: null, skinS: null, skinOK: false, masked: false,
    bobv: { dx: 0, dy: 0 }, head: { x: 97, y: 239 },
    rbCv: null, rbKey: '',
  };
  /* 모습을 알면 피부 · 가면을 바로 쓴다 (없으면 첫 얼굴을 그릴 때 캔버스에서 한 번 읽는다) */
  if (opts.look) {
    const look = typeof opts.look === 'string' ? decodeLook(opts.look) : opts.look;
    const sk = SKINS[look.skin | 0] || SKINS[0];
    S.skin = sk.c; S.skinS = sk.s; S.skinOK = true; S.masked = (look.mask | 0) > 0;
  }
  if ([2, 3, 4].includes(S.arena)) S.L.dark = true;

  /* ---------- 배치 ---------- */
  function layout(ctx) {
    const L = S.L;
    const W = ro(ctx.W ?? L.W), H = ro(ctx.H ?? L.H), floorY = ro(ctx.floorY ?? H - 90), K = ctx.K || 3;
    const hudH = ctx.hudH ?? 36, laneW = ctx.laneW || 26, kx = ro(ctx.kx ?? W / 2);
    const xL = ro(ctx.xL ?? 0), xR = ro(ctx.xR ?? W - laneW), jumpOnly = !!ctx.jumpOnly;
    const key = `${W}x${H}:${floorY}:${K}:${hudH}:${laneW}:${kx}:${xL}:${xR}:${jumpOnly}`;
    Object.assign(L, { W, H, floorY, K, hudH, laneW, kx, xL, xR, jumpOnly });
    if (key === L.key) return;
    L.key = key;
    const lanes = jumpOnly ? [[xR - 3, xR + laneW + 3]] : [[xL - 3, xL + laneW + 3], [xR - 3, xR + laneW + 3]];
    lanes.sort((p, q) => p[0] - q[0]);
    const free = [];
    let x = 0;
    for (const [a, b] of lanes) { if (a > x) free.push([x, a]); x = Math.max(x, b); }
    if (x < W) free.push([x, W]);
    L.free = free.filter(([a, b]) => b - a >= 4);
    L.lanes = lanes;
    /* 앞 그림 잘라 내기 — 레인 기둥(HUD 아래 ~ 판정 원 아래)은 빼고 */
    const laneBot = floorY + ro(laneW / 2) + 8;
    const P = new Path2D();
    for (const [a, b] of L.free) P.rect(a, 0, b - a, H);
    for (const [a, b] of lanes) { P.rect(a, 0, b - a, hudH); P.rect(a, laneBot, b - a, H - laneBot); }
    L.clip = P;
    L.skyTop = hudH + 6;
    L.skyBot = Math.max(L.skyTop + 36, Math.min(floorY - 70, floorY - 50 * K - 2));
    /* 선수 뒤 자리 — 무대 뒤끝(발 = floorY − 6)에서 레인 · 선수 몸을 피한 틈 */
    const body = [kx - 12 * K, kx + 12 * K];
    L.slots = [];
    for (const [a, b] of L.free) {
      if (b <= body[0] || a >= body[1]) L.slots.push([a + 1, b - 1]);
      else { if (body[0] - a >= 8) L.slots.push([a + 1, body[0]]); if (b - body[1] >= 8) L.slots.push([body[1], b - 1]); }
    }
    S.rbCv = null;
    S.A = K >= 3 ? 2 : 1;
  }
  /** x 근처에서 폭 w 가 레인에 안 걸리는 왼쪽 끝 */
  S.freeX = (x, w) => {
    let best = x, bd = 1e9;
    for (const [a, b] of S.L.free) { if (b - a < w) continue; const cx = clamp(x, a, b - w); const d = Math.abs(cx - x); if (d < bd) { bd = d; best = cx; } }
    return ro(best);
  };
  /** 조연 배율 — 선수가 3배(폰)면 동물 · 새 · 소품은 2배 도트로 (기준점을 가운데 두고 키운다) */
  S.A = 2;
  S.zoom = (c, ax, ay) => { c.save(); const A = S.A; if (A > 1) { c.translate(ro(ax) * (1 - A), ro(ay) * (1 - A)); c.scale(A, A); } };
  /** 제일 넓은 «레인 안 걸리는» 구간 [a, b] (보통 두 레인 사이) */
  S.midFree = () => { let best = S.L.free[0] || [0, S.L.W]; for (const f of S.L.free) if (f[1] - f[0] > best[1] - best[0]) best = f; return best; };
  /** 관중석 맨 위 (대회장마다 대충) — 우산 · 플래시가 여기부터 바닥까지 */
  S.crowdTop = () => { const L = S.L; return S.arena === 0 ? L.floorY - 26 : S.arena === 1 ? L.floorY - 50 : ro(Math.max(L.hudH + 40, L.floorY * 0.32)); };
  S.skyY = () => ro(S.L.skyTop + 6 + S.rand() * Math.max(4, S.L.skyBot - S.L.skyTop - 16));
  S.crowdY = () => ro(Math.min(S.L.floorY - 40, Math.max(S.L.skyBot - 30, S.L.skyTop + 20)));
  /** 선수 뒤 자리 하나 — 폭 w(넓은 틈 우선, 좁으면 선수 몸 뒤로 반쯤 숨는다) */
  S.slot = (w) => {
    const L = S.L;
    const ok = L.slots.filter(([a, b]) => b - a >= w * 0.7);
    const pick = ok.length ? ok[fl(S.rand() * ok.length)] : (L.slots[0] || [L.kx - 30, L.kx - 10]);
    const [a, b] = pick;
    const nearKid = Math.abs(b - L.kx) < Math.abs(a - L.kx);
    const x = b - a >= w ? (a + b - w) / 2 : nearKid ? (a + b - w) / 2 + (w - (b - a)) * 0.25 : (a + b - w) / 2;   // 들어가면 가운데, 좁으면 선수 몸 뒤로 조금 숨는다
    return { x: ro(x), y: L.floorY - 6, wide: b - a >= w };
  };
  S.say = (s, x, y, col = '#ffffff', sc0 = 1, dur = 0.8) => {
    const sc = Math.min(3, sc0 * S.A);
    const w = hgW(s) * sc + 3 * sc;
    S.texts.push({ s, x: S.freeX(ro(x), w), y: ro(clamp(y, S.L.hudH + 2, S.L.H - 12 * sc)), t0: S.T, dur, col, sc });
    if (S.texts.length > 14) S.texts.shift();
  };
  S.shakeFor = (sec, amp) => { if (S.T >= S.shakeEnd) S.shakeAmp = 0; S.shakeEnd = Math.max(S.shakeEnd, S.T + sec); S.shakeAmp = Math.max(S.shakeAmp, amp); };
  S.dustAt = (x, y) => { for (let i = 0; i < 4; i++) S.puffs.push({ x, y, vx: (i < 2 ? -1 : 1) * (14 + i * 6), t0: S.T }); if (S.puffs.length > 30) S.puffs.splice(0, S.puffs.length - 30); };
  /** 무지개 — 한 번 구워 둔다 */
  S.rainbowCv = () => {
    const L = S.L;
    if (S.rbCv) return S.rbCv;
    const cv = canvas(L.W, L.H), g = cv.getContext('2d');
    const cx = L.W / 2, cy = L.skyBot + 26, R0 = Math.min(L.W * 0.46, cy - L.skyTop + 4);
    const cols = ['#ff4d4d', '#ff9a1a', '#ffe14d', '#4dd27a', '#4dc3ff', '#5a6dff', '#c45cff'];
    for (let y = ro(cy - R0 - 1); y <= cy; y++) {
      if (y < L.skyTop - 4) continue;
      for (let bI = 0; bI < 7; bI++) {
        const ro1 = R0 - bI * 2, ri = ro1 - 2;
        const k1 = (y + 0.5 - cy) / ro1; if (Math.abs(k1) > 1) continue;
        const hw = ro1 * Math.sqrt(1 - k1 * k1);
        const ki = (y + 0.5 - cy) / ri;
        const hi = Math.abs(ki) < 1 ? ri * Math.sqrt(1 - ki * ki) : 0;
        g.fillStyle = cols[bI];
        const a = ro(cx - hw), ia = ro(cx - hi), ib = ro(cx + hi), b = ro(cx + hw);
        if (ia > a) g.fillRect(a, y, ia - a, 1);
        if (b > ib) g.fillRect(ib, y, b - ib, 1);
      }
    }
    S.rbCv = cv;
    return cv;
  };

  /* ---------- 연출 시작 ---------- */
  function spawn(type, force = false) {
    const def = DEFS[type];
    if (!def) return null;
    const same = S.acts.find((a) => a.type === type);
    if (same) { if (force && (def.cat === 'crowd' || def.cat === 'face')) { same.t0 = S.T; same.said = 0; } return same; }
    const cnt = S.acts.reduce((n, a) => n + (a.def.cat === def.cat ? 1 : 0), 0);
    if (cnt >= CAT_CAP[def.cat]) {
      if (!force) return null;
      if (def.cat === 'face' || def.cat === 'crowd' || def.cat === 'weather') { const i = S.acts.findIndex((a) => a.def.cat === def.cat); S.acts[i].def.end?.(S.acts[i], S, true); S.acts.splice(i, 1); }
      else return null;
    }
    const a = { type, def, t0: S.T, dur: def.dur, seed: fl(S.rand() * 1e6), age: 0, u: 0 };
    def.init?.(a, S);
    def.init2?.(a, S);
    S.acts.push(a);
    S.recent.push(type); if (S.recent.length > 7) S.recent.shift();
    S.lastRun[type] = S.T;
    return a;
  }
  S.spawn = spawn;
  function boost(type) {
    const rain = S.acts.some((a) => a.type === 'rain');
    const night = S.L.dark;
    switch (type) {
      case 'frog': return rain ? 5 : 0.6;
      case 'meteor': return night ? 1.6 : 0.5;
      case 'fireworks': case 'starEyes': case 'rainbow': return S.fever ? 3 : 1;
      case 'roar': case 'wave': case 'confetti': case 'pickets': return S.combo >= 20 ? 1.6 : 1;
      case 'sweat': case 'steam': case 'red': return S.hp < 50 || S.T < S.hotUntil ? 2.5 : 1;
      case 'gloom': case 'sigh': case 'angry': return S.T - S.missAt < 4 ? 2 : 0.8;
      case 'sun': return S.arena === 0 ? 1.6 : 0.8;
      default: return 1;
    }
  }
  function spawnRandom() {
    const cnt = {};
    for (const a of S.acts) cnt[a.def.cat] = (cnt[a.def.cat] || 0) + 1;
    const nCat = {};
    for (const k in DEFS) nCat[DEFS[k].cat] = (nCat[DEFS[k].cat] || 0) + 1;
    const cand = [];
    let tot = 0;
    for (const k in DEFS) {
      const d = DEFS[k];
      if ((cnt[d.cat] || 0) >= CAT_CAP[d.cat]) continue;
      if (S.recent.includes(k)) continue;
      if (S.T - (S.lastRun[k] ?? -99) < (d.cool ?? 9)) continue;
      if (d.cat === 'weather' && S.T - S.weatherEnd < 3) continue;
      if (d.cat === 'weather' && k !== 'fireworks' && k !== 'rainbow') continue;   // 2026-11-07 날씨(비 · 눈 · 번개 · 바람 · 해) 끔
      if (k === 'dizzy') continue;                                 // 넘어졌을 때만
      const w = (CAT_W[d.cat] / nCat[d.cat]) * (d.w ?? 1) * boost(k);
      if (w <= 0) continue;
      cand.push(k, w); tot += w;
    }
    if (!tot) return;
    let r = S.rand() * tot;
    for (let i = 0; i < cand.length; i += 2) { r -= cand[i + 1]; if (r <= 0) { spawn(cand[i]); return; } }
  }

  /* ---------- 줄 바닥 «탁!» · 착지 «퍽» ---------- */
  function ropeHit() {
    const L = S.L;
    S.impN++;
    const strong = S.T - S.perfAt < 0.35;
    const side = S.impN % 2 ? 1 : -1;
    const big = S.combo >= 50 || (strong && S.combo >= 20);
    const sc = Math.min(3, S.A + (big ? 1 : 0));
    const txt = '';                                     // 2026-11-07 «탁/착» 글자는 뺌 — 먼지만
    const col = S.combo >= 30 ? '#ff9a3a' : S.combo >= 10 ? '#ffe14d' : '#ffffff';
    const w = hgW(txt) * sc;
    const tx = S.freeX(L.kx + side * 13 * L.K - w / 2, w + 3 * sc);
    S.impacts.push({ t0: S.T, strong, side, txt, col, sc, tx, ty: L.floorY - 7 - 10 * sc, seed: S.impN * 13 });
    if (S.impacts.length > 6) S.impacts.shift();
    if (strong) S.shakeFor(0.1, S.combo >= 50 ? 2 : 1);
  }
  function onLand() {
    S.landAt = S.T;
    S.landN++;
    const high = S.maxLift >= 12;
    S.lands.push({ t0: S.T, high, txt: high || S.landN % 4 === 0 });
    if (S.lands.length > 4) S.lands.shift();
    if (high) S.shakeFor(0.06, 1);
  }

  /* ---------- 표정 짜기 ---------- */
  const F = S.F;
  function resetF() {
    F.eyes = null; F.eyeDx = 0; F.mouth = null; F.mk = 0.5; F.brows = null; F.cheeks = null; F.bounce = 0;
    F.blush = 0; F.gloom = 0; F.soot = 0; F.pale = 0; F.sweat = 0; F.steam = 0; F.vein = 0; F.tear = 0; F.drool = 0;
    F.snot = -1; F.zzz = 0; F.note = 0; F.hairUp = 0; F.smoke = 0; F.sigh = -1; F.spray = -1; F.sparkle = 0; F.drip = 0;
    F.groove = 0; F.shiver = 0; F.jerk = 0; F.slump = 0; F.lean = 0;
  }
  function composeFace(lift) {
    resetF();
    const T = S.T;
    /* 표정 순환 */
    if (T >= S.base.t0 + S.base.dur) {
      let id;
      for (let i = 0; i < 6; i++) { id = BASE_IDS[fl(S.rand() * BASE_IDS.length)]; if (id !== S.base.id) break; }
      S.base = { id, t0: T, dur: id.startsWith('normal') ? 1.2 + S.rand() * 1.2 : 1.8 + S.rand() * 1.8 };
    }
    BASE[S.base.id](F, T - S.base.t0, S.base.dur);
    /* 저절로 깜박 (2~4초마다) */
    if (T >= S.blinkAt) { if (!F.eyes || F.eyes === 'look') F.eyes = 'line'; if (T >= S.blinkAt + 0.1) S.blinkAt = T + 2 + S.rand() * 2; }
    /* 점프 — 힘주는 얼굴 · 착지 — 볼 출렁 */
    if (lift > 0) JUMP_FACE[S.jumpN % JUMP_FACE.length](F);
    const la = T - S.landAt;
    if (la < 0.16) { F.cheeks = 'bounce'; F.bounce = la; if (la < 0.08) F.eyes = 'line'; F.mouth = 'o'; }
    /* 게임 상황 */
    if (S.hp < 40) { F.blush = Math.max(F.blush, S.hp < 25 ? 2 : 1); F.sweat = Math.max(F.sweat, S.hp < 25 ? 3 : 2); }
    if (T < S.hotUntil) { F.sweat = Math.max(F.sweat, 2); F.steam = Math.max(F.steam, 1); }
    if (S.fever) F.sparkle = 1;
    /* 이벤트 표정 (제일 나중 — 이긴다) */
    for (const a of S.acts) a.def.face?.(F, a, S);
    if (S.phase === 'end' && S.endWin != null) { if (S.endWin) { F.eyes = F.eyes || 'happy'; } else { F.gloom = F.gloom || 1; } }
    /* 떠오르는 기호 — zzz · ♪ */
    if ((F.zzz || F.note) && T >= S.nextSym) {
      S.nextSym = T + 0.7;
      S.syms.push({ k: F.zzz ? 'z' : 'n', x: S.head.x + 9 * S.L.K, y: S.head.y - 8 * S.L.K, t0: T });
      if (S.syms.length > 8) S.syms.shift();
    }
  }
  function composeMood() {
    const M = S.mood;
    M.cheer = 0; M.groan = 0; M.wave = -1e9; M.clap = 0; M.stand = S.fever ? 0.5 : S.combo >= 30 ? 0.3 : 0;
    for (const a of S.acts) a.def.mood?.(M, a, S);
    if (S.T - S.crowdGroan < 0.9) M.groan = Math.max(M.groan, 1);
    setCrowdMood(M);
  }
  function composeBob(lift) {
    let dx = 0, dy = 0;
    const ph = S.phase;
    if (lift <= 0 && ph !== 'pause' && S.T - S.tripAt > 0.6) {
      const f = S.beat - fl(S.beat);
      if (ph === 'play' || ph === 'ready' || ph === 'resume') dy = f < 0.16 ? 1 : 0;   // 박마다 까딱
      if (F.groove) dx = fl(S.beat) % 2 ? 1 : -1;
      if (F.shiver) dx = fl(S.T * 28) % 2 ? 1 : -1;
      if (F.lean) dx = F.lean > 0 ? 1 : -1;
      if (F.jerk) dy += F.jerk;
      if (F.slump) dy += 1;
      if (S.T - S.landAt < 0.07) dy += 1;
    }
    S.bobv.dx = clamp(dx, -2, 2); S.bobv.dy = clamp(dy, -2, 2);
  }

  /* ---------- update ---------- */
  function update(dt, ctx) {
    if (!ctx) return;
    dt = Math.min(0.1, Math.max(0, +dt || 0));
    layout(ctx);
    const ph = ctx.phase || 'play';
    S.phase = ph;
    const paused = ph === 'pause';
    S.frame++;
    if (!paused) S.T += dt;
    S.beat = ctx.beat ?? S.T * 2;
    S.combo = ctx.combo | 0; S.hp = ctx.hp ?? 100; S.fever = !!ctx.fever;
    const L = S.L;
    const lift = ctx.lift || 0;
    if (!paused) {
      /* 줄이 발밑(θ = π + 2πk)을 지나는 순간 */
      const th = ctx.theta;
      if (ph === 'play' && typeof th === 'number' && isFinite(th)) {
        /* 줄 각도는 늘 커진다(chart.js 단조 3차 보간) — 발밑 칸 번호가 «새로» 커질 때만 센다. 1e-6 = 키 값(π+2πk)의 부동소수 오차 */
        const k = Math.floor((th - Math.PI) / TAU + 1e-6);
        if (S.prevK == null || k < S.hiK - 2) S.hiK = k;               // 처음 · 새 곡(각도가 되돌아감)
        else if (k > S.hiK) { if (k - S.hiK <= 2) ropeHit(); S.hiK = k; }
        S.prevK = k;
      } else S.prevK = null;
      /* 점프 · 착지 */
      if (lift > 0) { if (S.prevLift <= 0) { S.jumpN++; S.jumpAt = S.T; S.maxLift = 0; } S.maxLift = Math.max(S.maxLift, lift); }
      else if (S.prevLift > 0) onLand();
      S.prevLift = lift;
      /* 스케줄러 — 평균 1초에 하나 */
      if (S.T >= S.next) { spawnRandom(); S.next = S.T + 2.2 + S.rand() * 1.6; }   // 2026-11-07 덜 북적이게(1초 → 2~4초)
      /* 끝난 연출 정리 */
      let j = 0, ended = null;
      for (let i = 0; i < S.acts.length; i++) {
        const a = S.acts[i];
        a.age = S.T - a.t0; a.u = clamp(a.age / a.dur, 0, 1);
        if (a.age >= a.dur) { (ended || (ended = [])).push(a); continue; }
        S.acts[j++] = a;
      }
      S.acts.length = j;
      if (ended) for (const a of ended) { if (a.def.cat === 'weather') S.weatherEnd = S.T; a.def.end?.(a, S); }
      let n = 0;
      for (const t of S.texts) if (S.T - t.t0 < t.dur) S.texts[n++] = t;
      S.texts.length = n;
    }
    /* 머리 자리(버퍼) — 앞 그림이 얼굴 근처에 붙는다 */
    S.head.x = L.kx + S.bobv.dx;
    S.head.y = L.floorY - (31 + lift) * L.K + S.bobv.dy;
    composeFace(lift);
    composeMood();
    composeBob(lift);
  }

  /* ---------- event ---------- */
  function event(name, data = {}) {
    const T = S.T;
    switch (name) {
      case 'perfect': S.perfAt = T; break;
      case 'great': case 'good': break;
      case 'miss': {
        S.missAt = T; S.missN++;
        const R = ['angry', 'gloom', 'sigh', 'shock', 'red'];
        spawn(R[S.missN % R.length], true);
        if (S.rand() < 0.5) spawn('groan', true);
        break;
      }
      case 'trip':
        S.tripAt = T;
        spawn('dizzy', true);
        spawn('groan', true);
        S.say('쿵!', S.L.kx - 12, S.L.floorY - 30, '#ffffff', 2, 0.9);
        S.dustAt(S.L.kx, S.L.floorY);
        S.shakeFor(0.25, 2);
        for (const a of S.acts) if (a.type === 'birdHead') a.leave = true;
        break;
      case 'combo': {
        const n = data.n | 0;
        S.cheerAt = T;
        spawn(n % 20 === 0 ? 'wave' : 'roar', true);
        if (n >= 30 && n % 30 === 0) spawn('confetti', true);
        spawn(n % 50 === 0 ? (S.rand() < 0.5 ? 'starEyes' : 'heartEyes') : S.rand() < 0.5 ? 'proud' : 'laugh', true);
        if (n >= 50 && n % 50 === 0) spawn('fireworks', true);
        break;
      }
      case 'fever':
        spawn('starEyes', true); spawn('wave', true);
        if (!spawn('fireworks', true)) spawn('rainbow', true);
        break;
      case 'speedup':
        S.hotUntil = T + 5;
        spawn(S.rand() < 0.5 ? 'steam' : 'sweat', true);
        S.say('헉!', S.head.x - 36, S.head.y - 12 * S.L.K, '#ffffff', 1, 0.8);
        break;
      case 'slowdown': spawn('sigh', true); break;
      case 'start': spawn('roar', true); S.next = T + 1.2; break;
      case 'clear': S.endWin = true; spawn('fireworks', true); spawn('confetti', true) || spawn('roar', true); spawn('heartEyes', true); break;
      case 'fail': S.endWin = false; spawn('gloom', true); spawn('groan', true); break;
      default: break;
    }
  }

  /* ---------- 그리기 ---------- */
  function drawBack(c) {
    if (!c) return;
    for (const a of S.acts) if (a.def.cat === 'weather' && a.def.back) a.def.back(c, a, S);
    for (const a of S.acts) if (a.def.cat !== 'weather' && a.def.back) a.def.back(c, a, S);
  }
  function drawFront(c) {
    if (!c) return;
    const L = S.L, T = S.T;
    c.save();
    if (L.clip) c.clip(L.clip);
    /* 착지 — 먼지 «퍽» + 충격파 고리 */
    for (const d of S.lands) {
      const age = T - d.t0; if (age > 0.3) continue;
      const u = age / 0.24;
      if (u < 1) flatRing(c, L.kx, L.floorY + 1, ro(8 + u * 26), ro(1 + u * 3), u < 0.5 ? '#ffffff' : '#c8d8e8');
      for (const s of [-1, 1]) for (let i = 0; i < 2; i++) dust(c, L.kx + s * (5 * L.K + i * 6 * S.A + age * (50 + i * 30)), L.floorY - 1 - age * (20 + i * 10), fl(age / 0.08) + i, '#f4ead8', '#c9b89a', S.A);
      if (d.txt && age < 0.28) htext(c, '퍽', S.freeX(L.kx - 9 * L.K - 9 * S.A, 11 * S.A), L.floorY - 8 - 10 * S.A - fl(age * 16), '#ffd8a0', S.A);
    }
    /* 줄 바닥 «탁!» — 먼지 · 섬광 줄 · 의성어 · (강하면) 파편 */
    for (const m of S.impacts) {
      const age = T - m.t0; if (age > 0.4) continue;
      const Lw = 10 * L.K / 3 * 3 + Math.min(20, S.combo / 2);
      if (age < 0.05) rect(c, ro(L.kx - Lw), L.floorY + 1, ro(Lw * 2), 1, '#ffffff');
      else if (age < 0.1) rect(c, ro(L.kx - Lw * 0.7), L.floorY + 1, ro(Lw * 1.4), 1, pat(c, '#ffffff', 2));
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        const d = 6 + i * 6 + age * (34 + i * 18);
        dust(c, L.kx + s * d * (S.A > 1 ? 1.3 : 1), L.floorY + 1 - age * (14 + i * 6) - (i === 1 ? 2 : 0), fl(age / 0.07) + (i === 2 ? 1 : 0), '#f4ead8', '#c9b89a', S.A);
      }
      if (m.strong) for (let i = 0; i < 5; i++) {
        const s = i % 2 ? 1 : -1, sp = 30 + hash(m.seed + i) * 50;
        const x = L.kx + s * (4 + age * sp), y = L.floorY - age * (110 + i * 20) + age * age * 520;
        if (y < L.floorY + 2) rect(c, ro(x), ro(y), i % 3 ? 2 : 1, 1, i % 2 ? '#ffffff' : '#ffd23f');
      }
      if (age < 0.32 && !(age > 0.24 && fl(T * 30) % 2)) htext(c, m.txt, m.tx, m.ty - fl(age * 14), m.col, m.sc);
    }
    /* 넘어짐 등 먼지 */
    for (const p of S.puffs) { const age = T - p.t0; if (age > 0.4) continue; dust(c, p.x + p.vx * age, p.y - 2 - age * 12, fl(age / 0.1), '#f4ead8', '#c9b89a', S.A); }
    /* 앞 연출 */
    for (const a of S.acts) if (a.def.front) a.def.front(c, a, S);
    /* 떠오르는 기호 */
    for (const s of S.syms) {
      const age = T - s.t0; if (age > 1.4) continue;
      const x = ro(s.x + Math.sin(age * 4) * 3 + age * 6), y = ro(s.y - age * 14);
      if (s.k === 'z') ptext(c, 'Z', x, y, '#ffffff', 'outline');
      else spr(c, 'note', NOTE, { o: OUT, y: '#ffe14d' }, x, y);
    }
    /* 의성어 · 말 */
    for (const t of S.texts) {
      const age = T - t.t0;
      if (age > t.dur - 0.18 && fl(T * 24) % 2) continue;
      const pop = age < 0.05 ? 2 : age < 0.1 ? -1 : 0;
      htext(c, t.s, t.x, t.y - pop - fl(age * 4), t.col, t.sc);
    }
    c.restore();
  }

  /* ---------- 얼굴 (선수 1배 캔버스) ---------- */
  /** 선수 피부색을 한 번 읽는다 — (x−1, cy+1) 볼 · (x, cy−1) 두 눈 사이 · (x−1, cy+8) 턱 그늘. 둘 중 하나라도 피부색이 아니면 가면을 쓴 것 */
  function sampleSkin(k, x, cy) {
    try {
      const d = k.getImageData(x - 1, cy - 1, 2, 10).data;
      const at = (col, row) => (row * 2 + col) * 4;
      const hex = (i) => '#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
      const iS = at(0, 2), iE = at(1, 0), iD = at(0, 9);
      if (d[iS + 3] < 200) return;
      const near = (i) => SKINS.some((s) => { const n = parseInt(s.c.slice(1), 16); return Math.abs(((n >> 16) & 255) - d[i]) + Math.abs(((n >> 8) & 255) - d[i + 1]) + Math.abs((n & 255) - d[i + 2]) < 24; });
      S.skin = hex(iS); S.skinS = d[iD + 3] > 200 ? hex(iD) : tone(S.skin, -0.15);
      S.masked = !near(iS) || !near(iE);
      S.skinOK = true;
    } catch { S.skinOK = true; }
  }
  function drawFace(k, xIn, fy, pose = {}) {
    if (!k) return;
    pose = pose || {};
    const st = pose.state || 'stand';
    const lift = pose.lift || 0;
    const drop = st === 'trip' || st === 'sit' ? 8 : BEAT_SET.has(st) ? (st === 'ready' ? 2 : 0) : ((pose.crouch || 0) > 0.5 ? 2 : 0);
    const x = ro(xIn), cy = ro(fy - lift) - 31 + drop;
    const view = st === 'spin' ? spinView(pose.spin || 0) : 0;
    const front = view === 0;
    if (front && st !== 'trip' && st !== 'sit' && !S.skinOK) sampleSkin(k, x, cy);
    const sk = S.skin || '#ffe0c2';
    const ok = front && st !== 'trip' && !S.masked;
    const T = S.T;
    /* 1. 검어진 얼굴 · 검댕 (눈 · 입 밑에 깐다) */
    if (ok && (F.gloom || F.soot)) k.drawImage(faceTint(F.soot ? 'soot' : 'gloom'), x - 12, cy - 11);
    /* 2. 볼 — 부풀림 · 착지 출렁 */
    if (ok && F.cheeks) cheeks(k, x, cy, sk);
    /* 3. 눈 · 눈썹 · 입 */
    if (ok && F.eyes) eyes(k, x, cy, sk);
    if (ok && F.brows) brows(k, x, cy);
    if (ok && F.mouth) mouth(k, x, cy, sk);
    /* 4. 빨개진 얼굴 · 창백 */
    if (ok && F.blush >= 2) k.drawImage(faceTint('red'), x - 12, cy - 11);
    if (ok && F.blush >= 1) { for (const bx of [x - 10, x + 7]) { rect(k, bx, cy + 2, 3, 2, '#ff6a8a'); px(k, bx + (bx < x ? 0 : 2), cy + 2, '#ffb0c0'); } }
    if (ok && F.pale && !F.soot) k.drawImage(faceTint('pale'), x - 12, cy - 11);
    /* 5. 얼굴에 붙는 것들 */
    if (ok && F.tear) tears(k, x, cy);
    if (ok && F.snot >= 0) snot(k, x, cy);
    if (ok && F.sigh >= 0) sighPuff(k, x, cy, F.sigh);
    if (ok && F.spray >= 0 && F.spray < 0.35) { for (let i = 0; i < 7; i++) { const q = F.spray * (40 + i * 12); px(k, ro(x + 1 + q * 0.6 + i), ro(cy + 2 + q * (i % 3 - 1) * 0.3), i % 2 ? WATER : '#ffffff'); } }
    if (F.sparkle) twinkle(k, x + 13, cy - 9, fl(T * 6) % 3, '#ffffff');
    /* 6. 머리 쪽 (어느 방향이든) */
    if (F.sweat) sweat(k, x, cy, F.sweat);
    if (F.drip) for (const s of [-1, 1]) { const q = (T * 1.4 + (s > 0 ? 0.5 : 0)) % 1; rect(k, s < 0 ? x - 12 : x + 11, ro(cy - 3 + q * 13), 1, 2, WATER); }
    if (F.steam) steamPuffs(k, x, cy, F.steam, '#ffffff', '#c8ccd8');
    if (F.smoke) steamPuffs(k, x, cy, 1, '#8a8a92', '#5a5a62');
    if (F.hairUp) hairUp(k, x, cy);
    if (F.vein) vein(k, x + 8, cy - 14);
    if (F.shiver && front) for (const s of [-1, 1]) if (fl(T * 12) % 2) rect(k, s < 0 ? x - 15 : x + 14, cy - 3, 1, 4, '#bfe8ff');
  }

  /* 눈 — 왼눈 기준 칸(o, dy)으로 그리면 오른눈은 거울로 (가운데 x − 0.5) */
  function E(k, x, cy, side, o, dy, w, h, col) {
    if (side < 0) rect(k, x - 6 + o, cy + dy, w, h, col);
    else rect(k, x + 5 - o - (w - 1), cy + dy, w, h, col);
  }
  function eyes(k, x, cy, sk) {
    const e = F.eyes, T = S.T;
    if (e === 'wink') {
      rect(k, x + 3, cy - 2, 4, 3, sk);
      E(k, x, cy, 1, -1, -2, 1, 1, OUT); E(k, x, cy, 1, 0, -1, 2, 1, OUT); E(k, x, cy, 1, -1, 0, 1, 1, OUT);
      return;
    }
    rect(k, x - 7, cy - 2, 4, 3, sk); rect(k, x + 3, cy - 2, 4, 3, sk);
    for (const s of [-1, 1]) {
      switch (e) {
        case 'line': E(k, x, cy, s, -1, -1, 3, 1, OUT); break;
        case 'shut': E(k, x, cy, s, -1, -2, 1, 1, OUT); E(k, x, cy, s, 0, -1, 2, 1, OUT); E(k, x, cy, s, -1, 0, 1, 1, OUT); break;
        case 'happy': E(k, x, cy, s, -1, 0, 1, 1, OUT); E(k, x, cy, s, 0, -1, 2, 1, OUT); E(k, x, cy, s, 2, 0, 1, 1, OUT); break;
        case 'half': E(k, x, cy, s, -2, -1, 4, 1, OUT); E(k, x, cy, s, -1, 0, 2, 1, OUT); break;
        case 'angry': E(k, x, cy, s, 0, -1, 2, 2, OUT); break;
        case 'blank': E(k, x, cy, s, -1, -1, 3, 2, OUT); E(k, x, cy, s, 0, -1, 1, 1, '#ffffff'); break;
        case 'dots': E(k, x, cy, s, 0, -1, 1, 1, OUT); break;
        case 'x': E(k, x, cy, s, -1, -2, 1, 1, OUT); E(k, x, cy, s, 1, -2, 1, 1, OUT); E(k, x, cy, s, 0, -1, 1, 1, OUT); E(k, x, cy, s, -1, 0, 1, 1, OUT); E(k, x, cy, s, 1, 0, 1, 1, OUT); break;
        case 'round': case 'cross': case 'look': case 'lookUp': case 'teary': {
          E(k, x, cy, s, -2, -2, 5, 3, OUT); E(k, x, cy, s, -1, -3, 3, 5, OUT); E(k, x, cy, s, -1, -2, 3, 3, '#ffffff');
          if (e === 'round') E(k, x, cy, s, 0, -1, 1, 1, OUT);
          else if (e === 'cross') E(k, x, cy, s, 1, -1, 1, 1, OUT);
          else if (e === 'lookUp') E(k, x, cy, s, 0, -2, 1, 1, OUT);
          else if (e === 'teary') { E(k, x, cy, s, -1, -1, 2, 2, OUT); E(k, x, cy, s, -1, -1, 1, 1, fl(T * 8) % 2 ? '#ffffff' : '#bfe8ff'); E(k, x, cy, s, -1, 0, 3, 1, WATER); }
          else { const dx = clamp(F.eyeDx | 0, -1, 1); rect(k, (s < 0 ? x - 6 : x + 5) + dx, cy - 1, 1, 1, OUT); }
          break;
        }
        case 'pop': {   // 눈이 튀어나온다
          E(k, x, cy, s, -3, -3, 7, 5, OUT); E(k, x, cy, s, -2, -4, 5, 7, OUT); E(k, x, cy, s, -2, -3, 5, 5, '#ffffff');
          E(k, x, cy, s, 0 + (fl(T * 20) % 2), -1, 1, 1, OUT);
          break;
        }
        case 'star': spr(k, 'fst', STAR5S, { o: OUT, y: '#ffe14d' }, s < 0 ? x - 8 : x + 3, cy - 3); break;
        case 'heart': spr(k, 'fht', HEART5, { r: '#ff3a6a' }, s < 0 ? x - 8 : x + 3, cy - 3); break;
        case 'spiral': spr(k, 'fsp', SPIRAL, { o: OUT }, s < 0 ? x - 8 : x + 3, cy - 3, (fl(T * 8) % 2 === 0) !== (s > 0)); break;
        default: break;
      }
    }
  }
  function brows(k, x, cy) {
    for (const s of [-1, 1]) {
      if (F.brows === 'angry') { E(k, x, cy, s, -2, -4, 2, 1, OUT); E(k, x, cy, s, 0, -3, 2, 1, OUT); E(k, x, cy, s, 2, -2, 1, 1, OUT); }
      else if (F.brows === 'worried') { E(k, x, cy, s, -2, -2, 1, 1, OUT); E(k, x, cy, s, -1, -3, 2, 1, OUT); E(k, x, cy, s, 1, -4, 2, 1, OUT); }
      else if (F.brows === 'furrow') { E(k, x, cy, s, -1, -3, 3, 1, OUT); E(k, x, cy, s, 2, -3, 1, 2, OUT); }
    }
    if (F.brows === 'furrow') { rect(k, x - 2, cy - 4, 1, 3, S.skinS || '#f2bf98'); rect(k, x + 1, cy - 4, 1, 3, S.skinS || '#f2bf98'); px(k, x - 2, cy - 3, OUT); px(k, x + 1, cy - 3, OUT); }
  }
  function mouth(k, x, cy, sk) {
    let m = F.mouth;
    const T = S.T, my = cy + 4;
    if (m === 'chatter') m = fl(T * 16) % 2 ? 'clench' : 'wavy';
    rect(k, x - 3, my, 6, 2, sk);
    switch (m) {
      case 'clench':
        rect(k, x - 4, my - 1, 8, 4, OUT); rect(k, x - 3, my, 6, 2, '#ffffff');
        for (const ox of [-2, 0, 2]) px(k, x + ox, my, '#b8b0a8');
        for (const ox of [-1, 1]) px(k, x + ox, my + 1, '#b8b0a8');
        break;
      case 'yawn': case 'O': {
        const q = m === 'O' ? 0.55 : F.mk;
        const hw = 1 + ro(q), h = 2 + ro(q * 3);
        rect(k, x - hw - 1, my - 1, hw * 2 + 2, h + 2, OUT); rect(k, x - hw, my, hw * 2, h, '#5a1010'); rect(k, x - hw, my + h - 1, hw * 2, 1, '#ff6a8a');
        break;
      }
      case 'o': rect(k, x - 1, my, 2, 2, MC); break;
      case 'tongue': {
        const w = fl(T * 6) % 2;
        rect(k, x - 2, my, 4, 1, MC);
        rect(k, x - 2 + w, my + 1, 3, 3, OUT); rect(k, x - 1 + w, my + 1, 1, 2, '#ff6a8a'); px(k, x - 2 + w, my + 1, MC);
        rect(k, x - 1 + w, my + 1, 1, 2, '#ff6a8a'); px(k, x + w, my + 1, '#ff8aa0');
        break;
      }
      case 'tongueSide': rect(k, x - 2, my, 4, 1, MC); rect(k, x + 1, my, 3, 3, OUT); rect(k, x + 2, my + 1, 1, 1, '#ff6a8a'); px(k, x + 1, my, MC); break;
      case 'tight': rect(k, x - 1, my + 1, 2, 1, MC); break;
      case 'wavy': for (let i = -3; i < 3; i++) px(k, x + i, my + ((i + 3) % 2 ? 0 : 1), MC); break;
      case 'grin': rect(k, x - 3, my, 6, 1, MC); rect(k, x - 2, my, 4, 1, '#ffffff'); rect(k, x - 2, my + 1, 4, 1, '#d9485a'); break;
      case 'bigGrin': rect(k, x - 4, my - 1, 8, 4, OUT); rect(k, x - 3, my, 6, 1, '#ffffff'); rect(k, x - 3, my + 1, 6, 1, '#d9485a'); px(k, x - 4, my + 2, sk); px(k, x + 3, my + 2, sk); break;
      case 'sad': rect(k, x - 1, my, 2, 1, MC); px(k, x - 2, my + 1, MC); px(k, x + 1, my + 1, MC); break;
      case 'flat': rect(k, x - 2, my + 1, 4, 1, MC); break;
      case 'smirk': px(k, x - 2, my + 1, MC); rect(k, x - 1, my + 1, 3, 1, MC); px(k, x + 2, my, MC); break;
      case 'scream': rect(k, x - 3, my - 1, 6, 5, OUT); rect(k, x - 2, my, 4, 3, '#5a1010'); rect(k, x - 2, my, 4, 1, '#ffffff'); rect(k, x - 1, my + 2, 2, 1, '#ff6a8a'); break;
      case 'whistle': rect(k, x, my - 1, 3, 3, OUT); px(k, x + 1, my, '#5a1010'); break;
      case 'sigh': rect(k, x + 1, my, 2, 2, MC); break;
      case 'pout': rect(k, x - 1, my, 2, 1, '#d9485a'); rect(k, x - 1, my + 1, 2, 1, MC); break;
      case 'drool': {
        rect(k, x - 2, my, 3, 2, MC);
        const len = ro(F.drool * 5);
        rect(k, x + 1, my + 1, 1, len, WATER);
        rect(k, x, my + 1 + len, 2, 2, WATER); px(k, x, my + 1 + len, '#ffffff');
        break;
      }
      default: break;
    }
  }
  function cheeks(k, x, cy, sk) {
    let r = 3, oy = 3;
    if (F.cheeks === 'bounce') { const f = fl(F.bounce / 0.05); r = f === 0 ? 3 : f === 1 ? 2 : 1; oy = 5 - (f === 0 ? 0 : 1); }
    for (const s of [-1, 1]) {
      if (F.cheeks === 'puffL' && s > 0) continue;
      const cxp = s < 0 ? x - 10 : x + 9, cyp = cy + oy;
      oval(k, cxp, cyp, r + 0.6, r, OUT);
      oval(k, cxp, cyp, r - 0.4, r - 1, sk);
      rect(k, s < 0 ? x - 9 : x + 6, cyp - r + 1, 3, r * 2 - 1, sk);
      if (r >= 2) rect(k, s < 0 ? cxp - 1 : cxp, cyp, 2, 1, '#ff8fa3');
    }
  }
  function sweat(k, x, cy, n) {
    const T = S.T;
    const sl = fl((T * 5) % 5);
    spr(k, 'swt', SWEAT, SWEAT_PAL, x + 9, cy - 10 + sl);            // 관자놀이 큰 땀방울 (만화식)
    if (n >= 2) for (let i = 0; i < 4; i++) {
      const s = i % 2 ? 1 : -1, q = (T * 2.2 + i * 0.27) % 1;
      const dx = s * (12 + q * 9), dy = -7 + q * q * 16 - (1 - q) * 3;
      rect(k, ro(x + dx), ro(cy + dy), 2, 2, WATER); px(k, ro(x + dx), ro(cy + dy), '#ffffff');
    }
    if (n >= 3) { for (const ox of [-5, 2]) { const q = (T * 1.7 + (ox > 0 ? 0.4 : 0)) % 1; rect(k, x + ox, ro(cy - 4 + q * 6), 1, 2, WATER); } }
  }
  function steamPuffs(k, x, cy, n, col, sh) {
    const T = S.T;
    const cnt = n >= 2 ? 4 : 2;
    for (let i = 0; i < cnt; i++) {
      const q = (T * 1.5 + i / cnt) % 1;
      const bx = ro(x - 6 + (i % 2) * 11 + Math.sin(T * 3 + i) * 2 + (i > 1 ? (i % 2 ? 4 : -4) : 0)), by = ro(cy - 13 - q * 14);
      if (q < 0.35) { rect(k, bx - 2, by, 5, 2, col); rect(k, bx - 1, by - 1, 3, 1, col); rect(k, bx - 2, by + 2, 5, 1, sh); }
      else if (q < 0.7) { rect(k, bx - 1, by, 3, 2, col); rect(k, bx - 1, by + 2, 3, 1, sh); }
      else if (fl(T * 20) % 2) px(k, bx, by, col);
    }
  }
  function hairUp(k, x, cy) {
    const T = S.T;
    for (const ox of [-8, -4, 0, 4, 8]) {
      const h = 5 + (Math.abs(ox) < 5 ? 2 : 0);
      for (let i = 0; i < h; i++) px(k, x + ox + (fl(i / 2) % 2 ? 1 : 0), cy - 11 - i, OUT);
      if ((fl(T * 12) + ox) % 3 === 0) px(k, x + ox, cy - 12 - h, '#ffe14d');
    }
  }
  /** 핏대 💢 — 두 크기가 번갈아 펄떡 (그림자 한 칸) */
  function vein(k, x, y) {
    const big = fl(S.T * 7) % 2;
    const rows = big ? VEIN_A : VEIN_B, o = big ? 3 : 2;
    spr(k, big ? 'vAo' : 'vBo', rows, { r: OUT }, x - o + 1, y - o + 1);
    spr(k, big ? 'vA' : 'vB', rows, { r: '#ff2a2a' }, x - o, y - o);
  }
  function tears(k, x, cy) {
    const T = S.T;
    if (F.tear >= 2) {
      for (const s of [-1, 1]) {
        const tx = s < 0 ? x - 7 : x + 6;
        rect(k, tx, cy + 1, 1, 9, WATER);
        for (let i = 0; i < 9; i += 3) px(k, tx, cy + 1 + ((i + fl(T * 12)) % 9), '#ffffff');
        const q = (T * 3 + (s > 0 ? 0.5 : 0)) % 1;
        rect(k, tx - 1 + s, cy + 10 + ro(q * 4), 2, 2, WATER);
      }
    } else {
      const q = (T * 1.2) % 1;
      rect(k, x - 8, ro(cy + 1 + q * 6), 2, 2, WATER); px(k, x - 8, ro(cy + 1 + q * 6), '#ffffff');
    }
  }
  function snot(k, x, cy) {
    const a = F.snot, per = 2.4;
    const q = (a % per) / per;
    const r = 1 + q * 3.2;
    const bx = x + 1 + r, by = cy + 2;
    if (q > 0.94) { twinkle(k, bx, by, 1, '#ffffff'); return; }
    oval(k, bx, by, r + 0.5, r + 0.5, '#7fbfe0'); oval(k, bx, by, r - 0.4, r - 0.4, WATER_L);
    px(k, ro(bx - r / 2), ro(by - r / 2), '#ffffff');
  }
  function sighPuff(k, x, cy, age) {
    const q = Math.min(1.4, age);
    if (q > 1.3) return;
    const bx = ro(x + 4 + q * 16), by = ro(cy + 5 + q * 4), w = 3 + ro(q * 6), h = 2 + ro(q * 3);
    rbox(k, bx - 1, by - 1, w + 2, h + 2, OUT, 1); rbox(k, bx, by, w, h, '#ffffff', 1); rect(k, bx, by + h - 1, w, 1, '#d0d8e8');
    if (q > 0.3) { rect(k, bx - 4, by + 1, 2, 1, '#ffffff'); }
  }

  return {
    update, event, drawBack, drawFront, drawFace,
    bob: () => S.bobv,
    shake: () => {
      if (S.T >= S.shakeEnd) { S.shakeAmp = 0; return 0; }
      const p = S.frame % 4;
      return p === 0 ? S.shakeAmp : p === 2 ? Math.max(0, S.shakeAmp - 1) : 0;
    },
    /* 미리보기 · 점검용 */
    force: (type) => !!spawn(type, true),
    types: () => Object.keys(DEFS),
    baseFaces: () => BASE_IDS.slice(),
    setBase: (id, dur = 3) => { if (BASE[id]) S.base = { id, t0: S.T, dur }; },
    state: S,
  };
}
