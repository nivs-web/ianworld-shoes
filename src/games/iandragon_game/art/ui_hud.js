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
export const HUD_ICONS = {};
for (const [id, fn] of Object.entries(ICONS)) {
  HUD_ICONS[`ui/hud/${id}`] = entry(mk(32, fn));
  HUD_ICONS[`ui/hud/${id}_s`] = entry(mk(24, fn));
}
for (const shape of ['round', 'square']) for (const state of ['normal', 'pressed', 'disabled']) {
  HUD_ICONS[`ui/hud/btn_${shape}${state === 'normal' ? '' : '_' + state}`] = entry(() => { const p = new Pix(32, 32); btn(p, shape, state); return p; });
}
