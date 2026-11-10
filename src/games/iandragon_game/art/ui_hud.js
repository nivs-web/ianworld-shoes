/**
 * 이안 드래곤 게임 — 전투 HUD 아이콘 (겜팀장 보조 · 도트, 전부 코드로 그림 · 오리지널)
 * 32칸 + 작은 24칸(_s). 밤색 HUD 위에서 밝게 보이도록 따뜻한 불빛 · 맑은 하늘색 위주.
 * 한 아이콘 = 32칸 기준 좌표로 한 번 그리고, 작은 판은 같은 그림을 0.75배로 다시 그린다(k).
 * 프레임 이름: ui/hud/<이름> · 작은 판 ui/hud/<이름>_s · 버튼 ui/hud/btn_{round,square}[_pressed|_disabled]
 */
import { Pix, part } from './kit.js';
import { RAMP, OUT } from './palette.js';

const FIRE = ['#ffc27a', '#ff8a3a', '#c4521f'];
const CORE = ['#fff6c0', '#ffd23f', '#f2a020'];
const GOLD = ['#fff1a0', '#f2c230', '#a8780e'];
const WHITE = ['#ffffff', '#f4ecff', '#c9b3f0'];
const HEART = ['#ffb0c4', '#ff4a6a', '#b81f45'];

/** 32칸 좌표로 그리는 붓 — k 배로 줄여서 판에 얹는다 */
function brush(p, k) {
  const r0 = (v) => Math.round(v * k);
  return {
    k,
    ell: (cx, cy, rx, ry, ramp, o) => part.ell(p, cx * k, cy * k, Math.max(1, rx * k), Math.max(1, ry * k), ramp, o),
    poly: (pts, ramp, o) => part.poly(p, pts.map(([x, y]) => [x * k, y * k]), ramp, o),
    rect(x, y, w, h, col) {
      const x0 = r0(x), y0 = r0(y);
      p.rect(x0, y0, Math.max(1, r0(x + w) - x0), Math.max(1, r0(y + h) - y0), col);
    },
    dot: (x, y, col) => p.set(r0(x), r0(y), col),
  };
}

/** 글자 · 무늬 도트 — rows 문자열 배열(# = 칸) 을 s 배로 키워 칠하고 1칸 외곽선을 두른다 */
function glyph(p, rows, x, y, s, colFn) {
  const cells = new Map();
  rows.forEach((row, j) => [...row].forEach((c, i) => {
    if (c !== '#') return;
    for (let b = 0; b < s; b++) for (let a = 0; a < s; a++) cells.set(`${x + i * s + a},${y + j * s + b}`, [i * s + a, j * s + b]);
  }));
  const H = rows.length * s, W = rows[0].length * s;
  for (const key of cells.keys()) {
    const [cx, cy] = key.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!cells.has(`${cx + dx},${cy + dy}`)) p.set(cx + dx, cy + dy, OUT);
  }
  for (const [key, [lx, ly]] of cells) { const [cx, cy] = key.split(',').map(Number); p.set(cx, cy, colFn(lx, ly, W, H)); }
}

/** 둥근 네모 꼭짓점 (모서리를 3칸 깎아 둥글게) */
function roundRect(x, y, w, h) {
  const a = x, b = y, c = x + w, d = y + h;
  return [[a + 4, b], [c - 4, b], [c - 2, b + 1], [c - 1, b + 2], [c, b + 4], [c, d - 4], [c - 1, d - 2], [c - 2, d - 1], [c - 4, d],
    [a + 4, d], [a + 2, d - 1], [a + 1, d - 2], [a, d - 4], [a, b + 4], [a + 1, b + 2], [a + 2, b + 1]];
}

/* ───────── 전투 불씨 (재화) — 얼굴 있는 불꽃 씨앗 ───────── */
function ember(p, k) {
  const g = brush(p, k);
  g.poly([[16, 2], [19, 7], [23, 12], [26, 18], [25, 24], [21, 28], [16, 29], [11, 28], [7, 24], [6, 18], [9, 12], [13, 7]], FIRE);
  g.poly([[7, 9], [11, 4], [12, 11]], CORE, { outline: false });                                 // 옆 불꽃 혀
  g.ell(16, 21, 7, 6.5, CORE, { outline: false });                                              // 밝은 속
  g.rect(12, 18, 2, 4, OUT); g.rect(18, 18, 2, 4, OUT);                                          // 눈
  g.dot(12, 18, '#ffffff'); g.dot(18, 18, '#ffffff');
  g.rect(14, 24, 4, 1, OUT); g.dot(13, 23, OUT); g.dot(18, 23, OUT);                             // 웃는 입
  g.dot(10, 23, '#ff9a8a'); g.dot(21, 23, '#ff9a8a');                                            // 볼터치
}

/* ───────── 화덕 강화 — 돌 화덕 + 불 + 올림 화살표 배지 ───────── */
function brazier(p, k) {
  const g = brush(p, k);
  g.poly([[12, 1], [16, 6], [19, 10], [19, 13], [20, 16], [4, 16], [5, 12], [8, 7], [9, 10]], FIRE);   // 불꽃
  g.poly([[12, 7], [15, 11], [16, 16], [8, 16], [9, 11]], CORE, { outline: false });
  g.poly([[7, 28], [17, 28], [18, 31], [6, 31]], RAMP.rock);                                      // 받침
  g.poly([[4, 19], [20, 19], [17, 29], [7, 29]], RAMP.stone);                                     // 돌 그릇
  g.poly([[2, 14], [22, 14], [22, 20], [2, 20]], RAMP.rock);                                      // 넓은 테두리
  g.rect(6, 23, 2, 1, RAMP.rock[2]); g.rect(11, 25, 2, 1, RAMP.rock[2]); g.rect(14, 22, 1, 1, RAMP.rock[2]);
  g.rect(5, 16, 3, 1, RAMP.rock[0]); g.rect(11, 16, 2, 1, RAMP.rock[0]);
  g.ell(25, 8, 6.2, 6.2, RAMP.leaf);                                                              // 배지
  g.poly([[25, 3.5], [29.5, 8.5], [26.8, 8.5], [26.8, 12.5], [23.2, 12.5], [23.2, 8.5], [20.5, 8.5]], WHITE, { outline: false, flat: 1 });
}

/* ───────── 숨결 — 불을 뿜는 용 머리 (오른쪽을 본다) · ready = 빛 무리 + 더 큰 불길 ───────── */
function breathBody(p, k, ready) {
  const g = brush(p, k);
  if (ready) {                                                                                   // 준비 완료: 빛 무리 (바둑판 디더 고리)
    const S = p.w, c = (S - 1) / 2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > S * 0.42 && d < S * 0.5 && (x + y) % 2 === 0) p.set(x, y, '#ffe680');
    }
  }
  g.poly([[8, 9], [5, 1], [13, 7]], RAMP.bone);                                                   // 뿔
  g.poly([[3, 15], [1, 11], [6, 12]], RAMP.leaf, { lo: -0.1 });                                   // 뒤통수 볏
  g.poly([[7, 21], [22, 22], [23, 25], [19, 28], [10, 29], [5, 26]], RAMP.leaf, { light: [-0.3, -0.9] });   // 아래턱
  g.rect(11, 18, 11, 5, '#8e2a3a'); g.rect(13, 21, 7, 1, '#ff6a7a');                              // 입 안 · 혀
  g.poly([[3, 15], [5, 10], [11, 8], [18, 9], [23, 12], [24, 16], [12, 18], [6, 20], [3, 20]], RAMP.leaf);   // 머리 + 윗주둥이
  g.dot(16, 18, '#fff6dc'); g.dot(16, 19, '#fff6dc'); g.dot(21, 18, '#fff6dc'); g.dot(21, 19, '#fff6dc'); g.dot(18, 21, '#fff6dc');   // 송곳니
  g.dot(21, 13, OUT); g.dot(22, 13, OUT);                                                         // 콧구멍
  g.ell(10.5, 13, 2, 2.6, ['#ffffff', '#ffffff', '#e6e2f2'], { hi: 0.2, lo: -0.6 });              // 눈
  g.rect(11, 13, 2, 3, ready ? '#c4300f' : OUT); g.dot(11, 12, '#ffffff');
  g.rect(8, 9, 6, 1, OUT); g.dot(14, 10, OUT);                                                    // 사나운 눈썹
  /* 불길 */
  g.poly(ready ? [[22, 18], [25, 10], [27, 13], [29, 4], [30, 11], [31, 18], [31, 25], [28, 30], [25, 27], [23, 24]]
    : [[22, 18], [25, 12], [27, 14], [29, 8], [30, 14], [31, 19], [29, 25], [26, 25], [23, 23]], FIRE);
  g.poly(ready ? [[25, 19], [27, 14], [28, 15], [29, 12], [30, 19], [29, 24], [27, 25], [25, 23]]
    : [[25, 19], [27, 15], [28, 16], [29, 14], [29, 19], [28, 23], [26, 23], [25, 22]], CORE, { outline: false });
  if (ready) for (const [x, y] of [[4, 28], [27, 2], [3, 8]]) { g.dot(x, y, '#ffffff'); g.dot(x - 1, y, '#ffe680'); g.dot(x + 1, y, '#ffe680'); g.dot(x, y - 1, '#ffe680'); g.dot(x, y + 1, '#ffe680'); }
}

/* ───────── 일시정지 — 둥근 버튼 안에 두 막대 ───────── */
function pause(p, k) {
  const g = brush(p, k);
  g.ell(16, 16, 14, 14, RAMP.sky);
  g.ell(16, 16, 11, 11, ['#d8f4ff', '#8fd6f6', '#4aa0d8'], { outline: false });
  g.poly([[10, 9], [14, 9], [14, 23], [10, 23]], WHITE);
  g.poly([[18, 9], [22, 9], [22, 23], [18, 23]], WHITE);
}

/* ───────── 속도 — 겹꺾쇠(>>) + 숫자 ───────── */
const D1 = ['.#.', '##.', '.#.', '.#.', '###'], D2 = ['###', '..#', '###', '#..', '###'];
function speed(p, k, level) {
  const g = brush(p, k);
  const chev = (dx, ramp) => g.poly([[2 + dx, 8], [7 + dx, 8], [13 + dx, 16], [7 + dx, 24], [2 + dx, 24], [8 + dx, 16]], ramp);
  if (level === 2) { chev(0, ['#fff6a0', '#ffd23f', '#c99a1f']); chev(7, ['#ffc27a', '#ff8a3a', '#c4521f']); }
  else chev(5, ['#fff6a0', '#ffd23f', '#c99a1f']);
  const s = k < 1 ? 2 : 3, w = 3 * s, h = 5 * s, x = Math.round(p.w - 2 - w), y = Math.round((p.h - h) / 2);
  glyph(p, level === 2 ? D2 : D1, x, y, s, (lx, ly, W, H) => (ly < H * 0.3 ? '#ffffff' : ly > H * 0.7 ? '#c9b3f0' : '#e6e2f2'));
}

/* ───────── 기지 체력 — 성 + 하트 ───────── */
function baseHp(p, k) {
  const g = brush(p, k);
  g.poly([[9, 11], [23, 11], [23, 28], [9, 28]], RAMP.stone);                                    // 가운데 성벽
  for (const x of [9, 14, 19]) g.poly([[x, 7], [x + 4, 7], [x + 4, 12], [x, 12]], RAMP.stone);   // 성가퀴
  g.poly([[2, 9], [10, 9], [10, 28], [2, 28]], RAMP.rock);                                       // 왼 탑
  g.poly([[22, 9], [30, 9], [30, 28], [22, 28]], RAMP.rock);                                     // 오른 탑
  for (const x of [2, 6.5, 22, 26.5]) g.poly([[x, 5], [x + 3.5, 5], [x + 3.5, 10], [x, 10]], RAMP.rock);
  g.poly([[14, 22], [18, 22], [18, 28], [14, 28]], RAMP.bark, { lo: -0.2 });                     // 성문
  g.rect(5, 15, 2, 4, OUT); g.rect(25, 15, 2, 4, OUT);                                            // 활구멍
  g.poly([[16, 5], [16, 1]], RAMP.bone, { outline: false });
  /* 하트 */
  g.poly([[16, 20], [12, 17], [11, 13], [13, 11], [16, 13], [19, 11], [21, 13], [20, 17]], HEART);
  g.dot(13, 12.5, '#ffffff');
}

/* ───────── 물결 · 좀비 수 — 작은 좀비 머리 ───────── */
function wave(p, k) {
  const g = brush(p, k);
  g.poly([[11, 8], [13, 3], [16, 7], [19, 2], [21, 8]], ['#6b5038', '#43311f', '#2a1c14']);       // 삐죽 머리카락
  g.ell(16, 17, 12, 11, RAMP.rot);                                                               // 머리
  g.ell(24, 21, 3, 3, RAMP.bruise, { outline: false });                                          // 멍
  g.ell(11.5, 15, 3.4, 3.8, ['#ffffff', '#e9f27a', '#b8c050'], { hi: 0.2, lo: -0.5 });           // 눈 (노랗다)
  g.ell(21, 15, 2.6, 3, ['#ffffff', '#e9f27a', '#b8c050'], { hi: 0.2, lo: -0.5 });
  g.rect(12, 15, 2, 3, '#5a1a2a'); g.rect(21, 15, 2, 3, '#5a1a2a');
  g.rect(14, 22, 9, 4, '#4a1a2a');                                                               // 입
  g.rect(15, 22, 2, 2, '#fff6dc'); g.rect(19, 22, 2, 2, '#fff6dc'); g.rect(17, 24, 2, 2, '#fff6dc');
  g.rect(24, 8, 1, 4, '#2a1c22'); g.dot(23, 9, '#2a1c22'); g.dot(25, 10, '#2a1c22');             // 이마 꿰맨 자국
}

/* ───────── 별 — 스테이지 결과 ───────── */
function star(p, k) {
  const g = brush(p, k), pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 6.2 : 14.2;
    pts.push([16 + Math.cos(a) * r, 17.4 + Math.sin(a) * r]);
  }
  g.poly(pts, ['#fff6a0', '#ffd23f', '#c99a1f']);
  g.rect(12, 12, 2, 2, '#ffffff'); g.dot(14, 10, '#ffffff');                                      // 반짝
}

/* ───────── 동전 · 골드 ───────── */
function coin(p, k) {
  const g = brush(p, k);
  g.ell(16, 16, 13.5, 13.5, GOLD);
  g.ell(16, 16, 9.5, 9.5, ['#ffe680', '#ffd23f', '#e0aa20'], { lineCol: '#a8780e', hi: 0.2, lo: -0.1 });   // 안쪽 테
  g.poly([[16, 9], [18, 14], [23, 14], [19, 17.5], [20.5, 23], [16, 20], [11.5, 23], [13, 17.5], [9, 14], [14, 14]], ['#fff6c0', '#fff1a0', '#f2c230'], { lineCol: '#c99a1f', outline: false });
  g.rect(7, 9, 1, 3, '#ffffff'); g.dot(8, 8, '#ffffff');                                         // 테두리 반짝
}

/* ───────── 버튼 판 (빈 판) ───────── */
const BTN = {
  normal: { rim: RAMP.sky, face: ['#d8f4ff', '#8fd6f6', '#4aa0d8'], light: [-0.55, -0.83] },
  pressed: { rim: ['#5fc3f0', '#2f7fb8', '#1f4f80'], face: ['#4aa0d8', '#3a86c0', '#2a68a0'], light: [0.55, 0.83] },
  disabled: { rim: ['#b8b4c4', '#8a8698', '#5e5a70'], face: ['#c4c0d0', '#a09cb0', '#7c7890'], light: [-0.55, -0.83] },
};
function btn(p, shape, state) {
  const c = BTN[state], o = { light: c.light };
  const inner = state === 'pressed' ? 1 : 0;
  if (shape === 'round') {
    part.ell(p, 16, 16, 14, 14, c.rim, o);
    part.ell(p, 16, 16 + inner * 0.5, 10.5, 10.5, c.face, { ...o, outline: true, lineCol: c.rim[2], hi: 0.3 });
  } else {
    part.poly(p, roundRect(2, 2, 28, 28), c.rim, o);
    part.poly(p, roundRect(5, 5 + inner, 22, 22 - inner), c.face, { ...o, outline: true, lineCol: c.rim[2], hi: 0.3 });
  }
  if (state === 'disabled') for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (x % 2 === 0 && y % 2 === 0 && p.get(x, y)) { const q = p.get(x, y); if (q[0] !== 0x14) p.set(x, y, '#6e6a80'); }
}

/* ═════════ 2차(월드 6~10) 아이콘 — 속성 · 상태 · 기능 ═════════ */
const fac = (g, pts, col) => g.poly(pts, [col, col, col], { outline: false, flat: 1 });          // 면 하나 (외곽선 없음)
const sil = (g, pts, col) => g.poly(pts, [col, col, col], { flat: 1 });                          // 윤곽 (외곽선 있음)
const PURPLE = ['#e8c8ff', '#a858e8', '#5a2a9a'];
const GREEN = ['#d4ff8a', '#6fd83a', '#2f9a2a'];
const STEEL = ['#dfe8ff', '#8fa4d0', '#4f6290'];
/** 네 꼭짓점 반짝이 (cx, cy, 반지름) */
const sparkPts = (cx, cy, r, t = 0.28) => [[cx, cy - r], [cx + r * t, cy - r * t], [cx + r, cy], [cx + r * t, cy + r * t], [cx, cy + r], [cx - r * t, cy + r * t], [cx - r, cy], [cx - r * t, cy - r * t]];
const mirror = (pts) => pts.map(([x, y]) => [32 - x, y]);

/* ── 속성: 유령 ── */
function attrGhost(p, k) {
  const g = brush(p, k);
  g.poly([[27, 26], [24, 30], [20, 26], [16, 30], [12, 26], [8, 30], [5, 26], [5, 13], [7, 7], [11, 3], [16, 2], [21, 3], [25, 7], [27, 13]], RAMP.attrGhost);
  g.rect(10, 12, 4, 6, OUT); g.rect(18, 12, 4, 6, OUT);                                          // 눈
  g.rect(10, 12, 2, 2, '#ffffff'); g.rect(18, 12, 2, 2, '#ffffff');
  g.ell(16, 21, 2.2, 2.8, ['#8e2a3a', '#8e2a3a', '#5a1a2a'], { flat: 1 });                       // 동그란 입
  g.dot(8, 19, '#ff9ab0'); g.dot(9, 19, '#ff9ab0'); g.dot(23, 19, '#ff9ab0'); g.dot(24, 19, '#ff9ab0');   // 볼터치
  g.dot(9, 7, '#ffffff'); g.dot(10, 6, '#ffffff'); g.dot(8, 9, '#ffffff');                       // 윗머리 반짝
}

/* ── 속성: 거대 — 커다란 발자국 + 흙먼지 ── */
function attrGiant(p, k) {
  const g = brush(p, k);
  g.ell(4.5, 27, 3.4, 2.4, RAMP.belly, { outline: false }); g.ell(27.5, 27, 3.4, 2.4, RAMP.belly, { outline: false });   // 흙먼지
  g.ell(7, 12, 3.2, 3.4, RAMP.stone); g.ell(11.5, 7.5, 2.9, 3.1, RAMP.stone); g.ell(16.8, 5.4, 2.7, 3, RAMP.stone);
  g.ell(21.8, 7, 2.5, 2.9, RAMP.stone); g.ell(25.8, 11.5, 2.3, 2.7, RAMP.stone);                // 발가락 5개
  g.poly([[8, 17], [12, 14], [20, 14], [24, 17], [26, 23], [22, 29], [16, 30], [10, 29], [6, 23]], RAMP.rock);   // 발바닥
  g.rect(10, 21, 3, 1, RAMP.rock[2]); g.rect(17, 24, 3, 1, RAMP.rock[2]); g.rect(15, 18, 2, 1, RAMP.rock[0]);   // 갈라진 무늬
}

/* ── 속성: 그림자 · 독 — 보라 해골 물방울 ── */
function attrShadow(p, k) {
  const g = brush(p, k);
  g.poly([[16, 1], [20, 8], [25, 14], [27, 20], [26, 25], [22, 29], [16, 31], [10, 29], [6, 25], [5, 20], [7, 14], [12, 8]], PURPLE);
  g.ell(16, 19.5, 6, 5.2, RAMP.bone);                                                           // 해골 머리뼈
  g.poly([[12, 23], [20, 23], [19, 28], [13, 28]], RAMP.bone);                                   // 턱
  g.rect(11.5, 17.5, 3, 3, OUT); g.rect(17.5, 17.5, 3, 3, OUT);                                  // 눈구멍
  g.dot(16, 22, OUT); g.rect(15, 25, 1, 3, OUT); g.rect(17, 25, 1, 3, OUT);                      // 코 · 이빨 틈
  g.rect(10, 8, 2, 4, '#ffffff'); g.dot(12, 6, '#ffffff');                                       // 물방울 빛
}

/* ── 속성: 수정 — 큰 수정 하나 + 작은 분홍 수정 둘 ── */
function attrCrystal(p, k) {
  const g = brush(p, k);
  const PK = ['#ffd0f0', '#ff8ad8', '#c04a9a'];
  g.poly([[7, 14], [11, 18], [11, 29], [3, 29], [3, 18]], PK);
  g.poly([[26, 17], [30, 21], [30, 29], [22, 29], [22, 21]], PK);
  fac(g, [[7, 15], [10, 18], [7, 20], [4, 18]], PK[0]); fac(g, [[26, 18], [29, 21], [26, 23], [23, 21]], PK[0]);
  sil(g, [[16, 1], [23, 7], [24, 26], [16, 30], [8, 26], [9, 7]], '#6fe0f4');
  fac(g, [[16, 2], [22, 7], [16, 11], [10, 7]], '#d4f8ff');                                      // 윗면
  fac(g, [[9, 8], [16, 11], [16, 29], [9, 25]], '#6fe0f4');                                      // 왼면
  fac(g, [[16, 11], [23, 8], [23, 25], [16, 29]], '#2f9ac0');                                    // 오른면
  g.rect(11.5, 13, 1, 7, '#ffffff'); g.dot(12.5, 12, '#ffffff');                                 // 반짝
}

/* ── 속성: 모든 — 무지개 별 ── */
function attrAll(p, k) {
  const g = brush(p, k), pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 6.4 : 14.8;
    pts.push([16 + Math.cos(a) * r, 17.2 + Math.sin(a) * r]);
  }
  sil(g, pts, '#ffffff');
  const BAND = ['#ff5a5a', '#ff9a3a', '#ffd23f', '#6fd83a', '#3fb4ff', '#a870ff'];
  const fill = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const c = p.get(x, y);
    if (c && !(c[0] === 0x14 && c[1] === 0x08 && c[2] === 0x2a)) fill.push([x, y, x + y * 0.8]);   // 비스듬한 줄무늬 값
  }
  const lo = Math.min(...fill.map((f) => f[2])), hi = Math.max(...fill.map((f) => f[2]));
  for (const [x, y, t] of fill) p.set(x, y, BAND[Math.min(5, Math.floor(((t - lo) / (hi - lo + 0.001)) * 6))]);
  g.rect(11, 11, 2, 2, '#ffffff'); g.dot(13, 9, '#ffffff'); g.dot(9, 13, '#ffffff');              // 반짝
}

/* ── 상태: 독 — 초록 방울 + 거품 ── */
function stPoison(p, k) {
  const g = brush(p, k);
  g.poly([[15, 4], [19, 10], [23, 16], [25, 22], [23, 27], [19, 30], [14, 30], [9, 27], [7, 22], [9, 16], [12, 10]], GREEN);
  g.ell(25, 8, 2.8, 2.8, GREEN); g.ell(5.5, 7, 1.8, 1.8, GREEN);
  g.rect(10, 19, 2, 5, '#ffffff'); g.dot(11, 17, '#ffffff');                                     // 빛
  g.rect(18, 24, 3, 1, GREEN[2]);
}

/* ── 상태: 방어막 — 파란 육각 ── */
function stShield(p, k) {
  const g = brush(p, k);
  g.poly([[16, 2], [28, 8], [28, 22], [16, 30], [4, 22], [4, 8]], RAMP.aqua);
  g.poly([[16, 7], [23, 11], [23, 20], [16, 25], [9, 20], [9, 11]], ['#d8f4ff', '#6fd0f6', '#3a86c0'], { lineCol: '#1f4fa8' });
  g.rect(11.5, 12, 2, 5, '#ffffff'); g.dot(13.5, 11, '#ffffff');
}

/* ── 상태: 약화 — 아래로 꺾이는 굵은 화살표 ── */
function stWeaken(p, k) {
  const g = brush(p, k);
  g.poly([[10, 3], [22, 3], [22, 14], [28, 14], [16, 29], [4, 14], [10, 14]], RAMP.attrRed);
  g.rect(12, 6, 2, 7, '#ffffff'); g.dot(12, 4, '#ffffff');
}

/* ── 상태: 되살아남 — 날개 달린 하트 ── */
function stRevive(p, k) {
  const g = brush(p, k);
  const wing = [[12, 16], [8, 11], [2, 8], [1, 14], [1, 19], [4, 19], [3, 23], [7, 22], [7, 25], [12, 23]];
  g.poly(wing, WHITE); g.poly(mirror(wing), WHITE);
  g.poly([[16, 28], [9, 21], [7, 14], [10, 10], [16, 13], [22, 10], [25, 14], [23, 21]], HEART);
  g.rect(11, 13, 2, 2, '#ffffff');
}

/* ── 상태: 정화 — 반짝 별 ── */
function stPurify(p, k) {
  const g = brush(p, k), C = ['#ffffff', '#bdf6ff', '#6fd0f0'];
  g.poly(sparkPts(14.5, 17, 13), C);
  g.poly(sparkPts(26.5, 5.5, 4.5), C); g.poly(sparkPts(5.5, 27.5, 3.5), C);
  g.rect(13, 14, 2, 2, '#ffffff');
}

/* ── 상태: 안 밀림 — 닻 ── */
function stNoknock(p, k) {
  const g = brush(p, k);
  g.poly([[2, 15], [7, 15], [8, 21], [13, 25], [16, 26], [19, 25], [24, 21], [25, 15], [30, 15], [29, 23], [23, 29], [16, 31], [9, 29], [3, 23]], STEEL);
  g.poly([[14, 8], [18, 8], [18, 27], [14, 27]], STEEL);
  g.poly([[8, 11], [24, 11], [24, 14], [8, 14]], STEEL);
  g.ell(16, 5, 3.6, 3.6, STEEL); g.ell(16, 5, 1.2, 1.2, [OUT, OUT, OUT], { flat: 1, outline: false });
}

/* ── 보스 큰 공격 경고 — 빨간 느낌표 삼각 ── */
function bossWarn(p, k) {
  const g = brush(p, k);
  g.poly([[16, 2], [30, 28], [2, 28]], ['#ff8a7a', '#e8301f', '#8e1010']);
  g.poly([[16, 9], [25, 25], [7, 25]], ['#ff9a8a', '#ff4a3a', '#c4301f'], { outline: false });
  g.rect(14, 12, 4, 7, '#fff6c0'); g.rect(14, 21, 4, 3, '#fff6c0');
}

/* ── 알 — 크림색 바탕에 초록 점 + 금 ── */
function hatchEgg(p, k) {
  const g = brush(p, k);
  g.poly([[16, 2], [21, 5], [25, 11], [27, 18], [25, 25], [20, 29], [16, 30], [12, 29], [7, 25], [5, 18], [7, 11], [11, 5]], RAMP.belly);
  g.ell(11.5, 20, 2.6, 2.3, RAMP.leaf, { outline: false }); g.ell(21, 15, 2.2, 2, RAMP.leaf, { outline: false });
  g.ell(20.5, 24, 2.4, 2.2, RAMP.leaf, { outline: false }); g.ell(11.5, 12, 1.8, 1.8, RAMP.leaf, { outline: false });
  for (const [x, y] of [[8, 16], [10, 15], [12, 16], [14, 15]]) g.dot(x, y, OUT);                   // 갈라진 금
  g.rect(11, 6, 2, 1, '#ffffff'); g.dot(10, 8, '#ffffff');
}

/* ── 젬 — 보라 보석 ── */
function gem(p, k) {
  const g = brush(p, k);
  sil(g, [[8, 6], [24, 6], [29, 12], [16, 30], [3, 12]], '#a858e8');
  fac(g, [[11, 7], [21, 7], [19, 12], [13, 12]], '#e8c8ff');          // 윗면
  fac(g, [[8, 7], [11, 7], [13, 12], [4, 12]], '#c890ff');            // 왼 머리
  fac(g, [[21, 7], [24, 7], [28, 12], [19, 12]], '#8a40d0');          // 오른 머리
  fac(g, [[4, 13], [13, 13], [16, 29]], '#a858e8');                   // 왼 아래
  fac(g, [[14, 13], [19, 13], [16, 29]], '#d09aff');                  // 가운데 아래
  fac(g, [[19, 13], [28, 13], [16, 29]], '#6a2cb8');                  // 오른 아래
  g.rect(12, 8, 2, 2, '#ffffff'); g.dot(15, 8, '#ffffff');
}

/** 왼쪽 절반만 그려 두 판(색이 다른)으로 만들고, 오른쪽은 좌우로 뒤집어 붙인다 — 두 마리가 정확히 거울 모양이 된다 */
function twoSides(p, k, draw, left, right) {
  const W = Math.round(16 * k), a = new Pix(W, p.h), b = new Pix(W, p.h);
  draw(brush(a, k), left); draw(brush(b, k), right);
  p.blit(a, 0, 0); p.blit(b, p.w - W, 0, true);
}

/** 마주 보는 아기 용 한 마리 — 한 팔을 높이 들어 가운데에서 손바닥을 맞댄다 */
function coopHalf(g, ramp) {
  g.poly([[3, 8], [2, 2.5], [6.5, 6.5]], RAMP.bone);                                              // 뿔
  g.ell(6.5, 24.5, 5, 5.2, ramp);                                                                // 몸
  g.ell(7.6, 25.6, 2.7, 3.3, RAMP.belly, { outline: false });                                    // 배
  g.poly([[8.5, 25], [12.6, 25], [15.6, 13.5], [12.6, 11.5]], ramp);                                     // 든 팔
  g.ell(6.5, 13.5, 5.6, 5.3, ramp);                                                              // 머리
  g.rect(9, 12, 2, 3, OUT); g.dot(9, 12, '#ffffff');                                             // 눈
  g.rect(8, 17, 3, 1, OUT); g.dot(7, 16, OUT); g.dot(11, 16, OUT);                               // 웃는 입
  g.ell(13.7, 12, 2.1, 2.5, RAMP.belly);                                                         // 손
}
function coop(p, k) {
  twoSides(p, k, coopHalf, RAMP.leaf, RAMP.ember);
  const g = brush(p, k);
  g.poly(sparkPts(16, 5.5, 4.4, 0.3), ['#ffffff', '#fff3a0', '#ffd23f']);                         // 짝! 반짝
}

/** 맞붙은 용 머리 — 사나운 눈 + 서로 향한 주둥이 */
function vsHalf(g, ramp) {
  g.poly([[4.5, 12], [2.5, 4], [9.5, 10]], RAMP.bone);                                            // 뿔
  g.ell(8, 18.5, 7, 6.8, ramp);                                                                  // 머리
  g.ell(12.8, 22, 3, 2.6, ramp);                                                                 // 주둥이
  g.ell(10, 17.5, 2.4, 2.8, ['#ffffff', '#ffffff', '#e6e2f2'], { hi: 0.2, lo: -0.6 });           // 눈
  g.rect(11, 17, 2, 3, '#c4300f');
  g.poly([[5.5, 11.5], [13.5, 15], [13.5, 16.5], [5.5, 13]], [OUT, OUT, OUT], { flat: 1, outline: false });   // 사나운 눈썹
  g.dot(13, 21, OUT); g.rect(9, 25, 5, 1, OUT);                                                  // 콧구멍 · 입
}
function versus(p, k) {
  twoSides(p, k, vsHalf, RAMP.leaf, RAMP.ember);
  const g = brush(p, k);
  g.poly(sparkPts(16, 22, 6.5, 0.3), ['#ffffff', '#fff3a0', '#ff8a3a'], { flat: 1 });                                 // 부딪힘 반짝
}

/** 손으로 찍은 16칸 도트 — O 외곽선 · . 투명 */
const XS_MAPS = {
  st_noknock: {
    legend: { O: OUT, a: '#dfe8ff', b: '#8fa4d0', c: '#4f6290' },
    rows: [
      '......OOOO......',
      '.....OabbcO.....',
      '.....ObOOcO.....',
      '.....OabbcO.....',
      '......OabO......',
      '...OOOOOOOOOO...',
      '...OaaaabbbcO...',
      '...OOOOabOOOO...',
      '......OabO......',
      '.OaO..OabO..OaO.',
      '.ObO..OabO..ObO.',
      '.ObbO.OabO.ObcO.',
      '.OObbOOabOObcOO.',
      '..OObbbbbbbcOO..',
      '...OOObbbbcOOO..',
      '.....OOOOOO.....',
    ],
  },
};
function mapPix(m) {
  const h = m.rows.length, w = m.rows[0].length, p = new Pix(w, h);
  m.rows.forEach((row, y) => { if (row.length !== w) throw new Error(`도트 줄 길이 ${y}`); [...row].forEach((c, x) => { if (c !== '.') p.set(x, y, m.legend[c]); }); });
  return p;
}

/* ───────── 내보내기 ───────── */
const mk = (size, fn) => () => { const p = new Pix(size, size); fn(p, size / 32); return p; };
const entry = (draw) => ({ anims: [], draw, anchor: { x: 0.5, y: 0.5 } });

const ICONS = {
  ember, brazier, pause, base_hp: baseHp, wave, star, coin,
  breath: (p, k) => breathBody(p, k, false),
  breath_ready: (p, k) => breathBody(p, k, true),
  speed_x1: (p, k) => speed(p, k, 1),
  speed_x2: (p, k) => speed(p, k, 2),
};
/** 2차(월드 6~10) 아이콘 — 32칸 · 24칸(_s), 상태 아이콘(st_)은 16칸(_xs)도 한 벌 */
const ICONS2 = {
  attr_ghost: attrGhost, attr_giant: attrGiant, attr_shadow: attrShadow, attr_crystal: attrCrystal, attr_all: attrAll,
  st_poison: stPoison, st_shield: stShield, st_weaken: stWeaken, st_revive: stRevive, st_purify: stPurify, st_noknock: stNoknock,
  boss_warn: bossWarn, hatch_egg: hatchEgg, gem, coop, versus,
};
export const HUD_ICONS = {};
for (const [id, fn] of Object.entries(ICONS)) {
  HUD_ICONS[`ui/hud/${id}`] = entry(mk(32, fn));
  HUD_ICONS[`ui/hud/${id}_s`] = entry(mk(24, fn));
}
for (const shape of ['round', 'square']) for (const state of ['normal', 'pressed', 'disabled']) {
  HUD_ICONS[`ui/hud/btn_${shape}${state === 'normal' ? '' : '_' + state}`] = entry(() => { const p = new Pix(32, 32); btn(p, shape, state); return p; });
}
/** 새 아이콘은 맨 뒤에 붙인다 (기존 이름 순서 · 픽셀은 그대로) — 16칸 판은 손으로 찍은 도트가 있으면 그것을 쓴다 */
export const HUD_ICONS2 = {};
for (const [id, fn] of Object.entries(ICONS2)) {
  HUD_ICONS2[`ui/hud/${id}`] = entry(mk(32, fn));
  HUD_ICONS2[`ui/hud/${id}_s`] = entry(mk(24, fn));
  if (id.startsWith('st_')) HUD_ICONS2[`ui/hud/${id}_xs`] = entry(XS_MAPS[id] ? () => mapPix(XS_MAPS[id]) : mk(16, fn));
}
Object.assign(HUD_ICONS, HUD_ICONS2);
