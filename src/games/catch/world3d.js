/**
 * 3D캐치볼 — 3D 화면 (2026-10-29, 오락실 4번째 게임)
 *
 * > 사용자: *"원래 2d 게임은 이안월드 3번째 게임이고 이건 '3D캐치볼' 이라는 이름으로 4번째 게임으로 개발해서 넣어"*
 *
 * 게임 규칙 · 입력 · HUD · 꾸미기 · 소리는 2D 캐치볼(`catchball.js`)과 **같은 코드**다.
 * 이 파일은 그 게임 상태를 받아 **그리기만** 한다 (`catchball.js` 의 `opts.world3d`).
 * 조준경 · 타이밍 링 · 글자 효과는 2D 캔버스가 이 3D 화면 **위에** 그대로 그린다 —
 * 그래서 카메라를 2D 원근(`proj`)과 수학적으로 똑같이 맞춘다(`resize`).
 *
 * ## 좌표
 * 게임은 2D 화면 기준 x(오른쪽 +)를 쓴다. three.js 에서 뒤에서 +Z 를 바라보면 화면 오른쪽이 -X 라
 * **X = -x** 로 뒤집는다. y(위) · z(친구 쪽)는 같다.
 *
 * ## 인형
 * 진짜 관절(어깨 · 팔꿈치 · 손목 · 골반 · 무릎)이 있다. 팔다리는 두 마디 IK 로 손 · 발 자리를 맞추고,
 * 던질 때는 골반이 먼저 열리고 가슴이 늦게 따라 도는 순서(꼬임)를 자세표(`THROW`)에 담았다.
 * 자세 좌표는 아이 기준: +Z = 상대 쪽, +X = 아이의 왼쪽(글러브 쪽), +Y = 위.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as Art from './art.js';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const GLOVE_Z = 0.35;           // catchball.js 와 같은 값 (글러브 면)
const UA = 0.265, FA = 0.24, TH = 0.375, SH = 0.365, ANK = 0.065;

/* ======================================================================
   도구
   ====================================================================== */
const _up = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _f = new THREE.Vector3(), _g = new THREE.Vector3(), _h = new THREE.Vector3(), _k = new THREE.Vector3(), _p = new THREE.Vector3();
const _m4 = new THREE.Matrix4(), ID = new THREE.Quaternion();

function canvasTex(w, h, draw, aniso = 4, repeat = 0) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const M = (color, rough = 0.7, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 14);
const sph = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
function shadowAll(o) { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); }
function disposeTree(o) {
  o.traverse((m) => {
    if (m.geometry) m.geometry.dispose();
    if (m.material) for (const mt of [].concat(m.material)) { if (mt.map) mt.map.dispose(); if (mt.emissiveMap) mt.emissiveMap.dispose(); mt.dispose(); }
  });
}
/** 캡슐(길이 방향 Y)을 a→b 사이에 놓는다 */
function placeSeg(mesh, a, b) {
  _p.subVectors(b, a);
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(_up, _p.normalize());
}
/** 두 마디 IK — 어깨(엉덩이) S → 손(발) 목표 T, 팔꿈치(무릎)는 pole 쪽. outE 팔꿈치 · outT 실제 손 */
function ik2(S, T, a, b, pole, outE, outT) {
  _d.subVectors(T, S);
  let len = _d.length();
  const dir = _d.normalize();
  len = clamp(len, Math.abs(a - b) + 0.01, a + b - 0.002);
  outT.copy(S).addScaledVector(dir, len);
  const cosA = clamp((a * a + len * len - b * b) / (2 * a * len), -1, 1);
  const along = a * cosA, hgt = a * Math.sqrt(1 - cosA * cosA);
  _k.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (_k.lengthSq() < 1e-6) _k.set(0, -1, 0);
  _k.normalize();
  outE.copy(S).addScaledVector(dir, along).addScaledVector(_k, hgt);
}

/* ======================================================================
   자세표
   ====================================================================== */
const NUM = ['px', 'py', 'pz', 'pyaw', 'ppitch', 'proll', 'cyaw', 'cpitch', 'croll', 'gclose', 'lfyaw', 'lfpitch', 'rfyaw', 'rfpitch', 'lift'];
const VEC = ['rh', 'rpole', 'lh', 'lpole', 'gface', 'gup', 'lf', 'rf'];
const BASE = {
  px: 0, py: 0.79, pz: 0, pyaw: 0, ppitch: 4, proll: 0, cyaw: 0, cpitch: 3, croll: 0, lift: 0,
  rh: [-0.12, 0.95, 0.3], rpole: [-1, -0.5, 0], lh: [0.14, 1.0, 0.36], lpole: [1, -0.5, 0],
  gface: [0, 0, 1], gup: [0, 1, 0], gclose: 0,
  lf: [0.18, 0, 0.02], lfyaw: 10, lfpitch: 0, rf: [-0.18, 0, -0.02], rfyaw: -10, rfpitch: 0,
};
const P = (o) => { const p = { ...BASE, ...o }; for (const k of VEC) p[k] = p[k].slice(); return p; };
function lerpPose(a, b, t) {
  const o = {};
  for (const k of NUM) o[k] = a[k] + (b[k] - a[k]) * t;
  for (const k of VEC) { const A = a[k], B = b[k]; o[k] = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; }
  return o;
}
const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
function keyPose(keys, u) {
  u = clamp(u, 0, 1);
  let i = 0; while (i < keys.length - 2 && u > keys[i + 1].u) i++;
  const k1 = keys[i], k2 = keys[i + 1], k0 = keys[Math.max(0, i - 1)], k3 = keys[Math.min(keys.length - 1, i + 2)];
  const t = clamp((u - k1.u) / (k2.u - k1.u), 0, 1);
  const o = {};
  for (const k of NUM) o[k] = cr(k0[k], k1[k], k2[k], k3[k], t);
  for (const k of VEC) o[k] = [0, 1, 2].map((j) => cr(k0[k][j], k1[k][j], k2[k][j], k3[k][j], t));
  return o;
}

/**
 * ★ 던지기 6단계 (오른손잡이) — catchball.js 의 THROW_STEPS 와 같은 순서 · 같은 u.
 * ① 준비 0 · ② 다리 들기 .2 · ③ 팔 벌리기 .4 · ④ L자 .55 · ⑤ 던지기(공 놓기) .66 · ⑥ 팔로스루 .82~1
 * 골반(pyaw)이 먼저 열리고 가슴(cyaw)이 늦게 따라 돈다. 무게는 뒷발 → 앞발(pz).
 */
export const THROW = [
  P({ u: 0.0, py: 0.79, pz: 0, pyaw: -88, ppitch: 4, cyaw: 0, cpitch: 4,
    rh: [-0.21, 1.02, -0.03], rpole: [0.2, -1, -0.6], lh: [-0.19, 0.95, 0.05], lpole: [0.2, -1, 0.6],
    gface: [0, 0.1, -1], gup: [0, 1, 0], gclose: 0.3,
    lf: [0, 0, 0.25], lfyaw: -75, rf: [0, 0, -0.26], rfyaw: -90 }),
  P({ u: 0.2, py: 0.81, pz: -0.06, pyaw: -98, ppitch: 0, cyaw: -8, cpitch: 0,
    rh: [-0.19, 1.09, -0.07], rpole: [0.2, -1, -0.6], lh: [-0.17, 1.02, 0.0], lpole: [0.2, -1, 0.6],
    gface: [0, 0.1, -1], gup: [0, 1, 0], gclose: 0.3,
    lf: [-0.10, 0.38, -0.04], lfyaw: -80, lfpitch: 35, rf: [0, 0, -0.26], rfyaw: -90 }),
  P({ u: 0.4, py: 0.72, pz: 0.10, pyaw: -84, ppitch: 6, proll: 3, cyaw: -10, cpitch: 2, croll: 6,
    rh: [0.03, 0.86, -0.50], rpole: [0.3, -1, 0.2], lh: [-0.03, 1.16, 0.60], lpole: [0, -1, 0],
    gface: [-0.3, 0, 1], gup: [0, 1, 0], gclose: 0.1,
    lf: [-0.02, 0.04, 0.62], lfyaw: -55, lfpitch: 10, rf: [0, 0, -0.26], rfyaw: -88, rfpitch: 5 }),
  P({ u: 0.55, py: 0.70, pz: 0.24, pyaw: -55, ppitch: 8, cyaw: -35, cpitch: 0, croll: 10,
    rh: [0.03, 1.34, -0.21], rpole: [0, -0.3, -1], lh: [-0.04, 1.18, 0.68], lpole: [0, -1, 0.2],
    gface: [-0.2, -0.4, 1], gup: [0, 1, 0.2], gclose: 0.1,
    lf: [-0.02, 0, 0.74], lfyaw: -40, rf: [0, 0.02, -0.26], rfyaw: -75, rfpitch: 18 }),
  P({ u: 0.66, py: 0.68, pz: 0.36, pyaw: -8, ppitch: 15, cyaw: 12, cpitch: 12, croll: -10,
    rh: [-0.27, 1.32, 0.96], rpole: [-1, -0.2, 0], lh: [0.20, 1.0, 0.52], lpole: [1, -0.5, -0.3],
    gface: [-1, 0, 0], gup: [0, 1, 0], gclose: 0.6,
    lf: [-0.02, 0, 0.74], lfyaw: -25, rf: [0.04, 0.05, -0.20], rfyaw: -35, rfpitch: 45 }),
  P({ u: 0.82, py: 0.64, pz: 0.44, pyaw: 15, ppitch: 28, cyaw: 20, cpitch: 30, croll: -8,
    rh: [0.15, 0.85, 0.80], rpole: [-0.8, 0.3, 0], lh: [0.17, 0.88, 0.80], lpole: [1, -0.6, 0],
    gface: [-0.2, 0, -1], gup: [0, 1, 0], gclose: 0.6,
    lf: [-0.02, 0, 0.74], lfyaw: -15, rf: [0, 0.14, -0.05], rfyaw: -10, rfpitch: 60 }),
  P({ u: 1.0, py: 0.66, pz: 0.50, pyaw: 25, ppitch: 30, cyaw: 20, cpitch: 32, croll: -5,
    rh: [0.32, 0.58, 0.70], rpole: [-0.5, 0.6, 0.2], lh: [0.2, 0.86, 0.82], lpole: [1, -0.6, 0],
    gface: [-0.2, 0, -1], gup: [0, 1, 0], gclose: 0.5,
    lf: [-0.02, 0, 0.74], lfyaw: -10, rf: [-0.30, 0.04, 0.40], rfyaw: 10, rfpitch: 15 }),
];
export const RELEASE_U = 0.66;
const READY = P({ py: 0.74, ppitch: 14, cpitch: 6, rh: [-0.13, 0.98, 0.34], rpole: [-1, -0.6, 0], lh: [0.12, 1.02, 0.36], lpole: [1, -0.6, 0],
  gface: [0, 0.05, 1], gup: [0, 1, 0], gclose: 0.05, lf: [0.19, 0, 0.03], lfyaw: 12, rf: [-0.19, 0, -0.02], rfyaw: -12 });
const RELAX = P({ py: 0.78, ppitch: 4, cpitch: 2, rh: [-0.2, 0.78, 0.08], rpole: [-1, -0.3, -0.3], lh: [0.22, 0.82, 0.14], lpole: [1, -0.3, -0.3],
  gface: [0, 0, 1], gup: [0, 1, 0.2], lf: [0.13, 0, 0.02], lfyaw: 8, rf: [-0.13, 0, -0.02], rfyaw: -8 });

/** 글러브 주머니가 C(아이 기준)에 오도록 손목 자리를 정한다 — 글러브 방향(gface·gup)을 반영 */
function gloveAt(p, C) {
  const f = _a.set(p.gface[0], p.gface[1], p.gface[2]).normalize();
  const u = _b.set(p.gup[0], p.gup[1], p.gup[2]); u.addScaledVector(f, -u.dot(f)).normalize();
  p.lh = [C[0] - u.x * 0.066 - f.x * 0.05, C[1] - u.y * 0.066 - f.y * 0.05, C[2] - u.z * 0.066 - f.z * 0.05];
  return p;
}
/** 잡을 자리로 손을 뻗는 자세 (C = 주머니 자리) */
function reachPose(C, o = {}) {
  const p = P(READY);
  const low = C[1] < 0.62;
  p.gface = low ? [0, 0.35, 1] : [0, 0.05, 1];
  p.gup = low ? [0, -0.6, 0.4] : [0, 1, 0];
  gloveAt(p, C);
  const sx = C[0] - 0.3;
  p.px = clamp(sx * 0.45, -0.25, 0.3);
  p.proll = clamp(-sx * 16, -24, 24); p.croll = clamp(-sx * 10, -16, 16);
  p.py = C[1] < 0.95 ? 0.74 - clamp(0.95 - C[1], 0, 0.6) * 0.32 : 0.75;
  p.ppitch = C[1] < 0.95 ? 14 + clamp(0.95 - C[1], 0, 0.7) * 30 : 10;
  p.lpole = [1, -0.6, -0.2];
  if (C[1] > 0.55 && C[1] < 1.9) { p.rh = [C[0] - 0.17, C[1] - 0.06, C[2] - 0.06]; p.rpole = [-1, -0.4, 0]; }
  else { p.rh = [-0.22, 0.86, 0.16]; p.rpole = [-1, -0.3, -0.2]; }
  const wide = clamp(0.95 - C[1], 0, 0.6) * 0.15;
  p.lf = [0.19 + wide + p.px * 0.6, 0, 0.03]; p.rf = [-0.19 - wide + p.px * 0.6, 0, -0.02];
  return Object.assign(p, o);
}
/** 잡은 뒤 — 몸 쪽으로 당기며 다른 손으로 덮는다 */
function absorbPose(C) {
  const p = reachPose([C[0] * 0.7, Math.max(0.8, C[1] - 0.05), C[2] - 0.12]);
  const pk = [C[0] * 0.7, Math.max(0.8, C[1] - 0.05), C[2] - 0.12];
  p.rh = [pk[0] - 0.03, pk[1] + 0.02, pk[2] + 0.07]; p.rpole = [-1, -0.6, -0.2];
  p.gclose = 1;
  return p;
}
/** 달리기 한 걸음 (ph = 걸음 위상) */
function runPose(ph, base = RELAX) {
  const p = P(base);
  const s = Math.sin(ph), c = Math.cos(ph);
  p.py = 0.74 + Math.abs(c) * 0.03; p.ppitch = 14; p.cpitch = 6; p.cyaw = s * 8;
  p.lf = [0.1, Math.max(0, s) * 0.2, c * 0.28]; p.lfpitch = Math.max(0, s) * 25;
  p.rf = [-0.1, Math.max(0, -s) * 0.2, -c * 0.28]; p.rfpitch = Math.max(0, -s) * 25;
  p.lfyaw = 0; p.rfyaw = 0;
  p.rh = [-0.2, 0.92 + s * 0.08, 0.1 + s * 0.22]; p.rpole = [-0.3, -1, -0.5];
  p.lh = [0.2, 0.92 - s * 0.08, 0.1 - s * 0.22]; p.lpole = [0.3, -1, -0.5];
  return p;
}

/* ======================================================================
   꾸미기 → 3D 재질
   ====================================================================== */
const texCache = new Map();
function cached(key, make) { if (!texCache.has(key)) texCache.set(key, make()); return texCache.get(key); }
/** 모자 무늬 (구 윗반쪽 UV: v 1→0.5 = 꼭대기→챙, u 0.25~0.75 = 아이의 왼쪽 반) */
function hatLook(id, team, aniso) {
  const T = Art.TEAMS[team] || Art.TEAMS.red;
  if (id === Art.TEAM_HAT || !Art.HATS[id]) return { main: T.cap, brim: T.dark, btn: T.dark };
  const H = Art.HATS[id];
  const o = { main: H.main || '#ffffff', brim: H.brim, btn: H.btn, sparkle: !!H.sparkle, crown: !!H.crown };
  if (H.pattern === 'pastel') o.map = cached('hat-pastel', () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = H.main; g.fillRect(0, 0, w, h);
    const cols = [H.brim, H.btn, '#fff3b0'];
    for (let y = 8; y < h / 2; y += 22) for (let x = (y / 22 % 2) * 14; x < w; x += 28) { g.fillStyle = cols[(x + y) % 3 | 0] || cols[0]; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); }
  }, aniso));
  else if (H.pattern === 'two') o.map = cached('hat-two', () => canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = H.main; g.fillRect(0, 0, w, h); g.fillStyle = H.alt; g.fillRect(w * 0.25, 0, w * 0.5, h);
  }, aniso));
  else if (H.pattern === 'bands') o.map = cached('hat-bands-' + id, () => canvasTex(8, 256, (g, w, h) => {
    const n = H.bands.length; H.bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, (i / n) * (h / 2), w, h / 2 / n + 1); });
    g.fillStyle = H.bands[n - 1]; g.fillRect(0, h / 2, w, h / 2);
  }, aniso));
  else if (H.pattern === 'metal') { o.metal = 0.9; o.rough = 0.22; }
  else if (H.pattern === 'gold') { o.metal = 1; o.rough = 0.2; o.brimMetal = 0.9; }
  else if (H.pattern === 'fire') {
    o.map = cached('hat-fire', () => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = H.main; g.fillRect(0, 0, w, h);
      const r = rnd(9);
      for (let i = 0; i < 26; i++) {
        const x = (i / 26) * w + r() * 6, top = h / 2 - 30 - r() * 70;
        const gr = g.createLinearGradient(0, h / 2, 0, top);
        gr.addColorStop(0, '#ff3d1f'); gr.addColorStop(0.55, '#ff9f2e'); gr.addColorStop(1, '#ffe66b');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - 9, h / 2); g.quadraticCurveTo(x - 6, top + 30, x + r() * 6, top); g.quadraticCurveTo(x + 8, top + 30, x + 9, h / 2); g.fill();
      }
    }, aniso));
    o.emissive = 0.35;
  } else if (H.pattern === 'legend') { o.metal = 0.25; o.rough = 0.35; o.brimMetal = 0.95; }
  if (o.map) o.main = '#ffffff';
  return o;
}
/** 야구공 무늬 */
function ballMaterial(id, aniso) {
  return cached('ball-' + id, () => {
    const B = Art.BALLS[id] || Art.BALLS[0];
    const map = canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = B.body || '#fbf7ee'; g.fillRect(0, 0, w, h);
      if (B.pattern === 'bands') { const n = B.bands.length; B.bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, (i / n) * h, w, h / n + 1); }); }
      if (B.pattern === 'half') { g.fillStyle = B.bands[0]; g.fillRect(0, 0, w / 2, h); g.fillStyle = B.bands[1]; g.fillRect(w / 2, 0, w / 2, h); }
      if (B.pattern === 'fire') { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffe066'); gr.addColorStop(0.5, '#ff7a1a'); gr.addColorStop(1, '#d6301a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
      g.strokeStyle = B.stitch || '#d2372c'; g.lineWidth = 6;
      for (const s of [1, -1]) {
        g.beginPath();
        for (let x = 0; x <= w; x += 4) { const y = h / 2 + s * 46 * Math.sin((x / w) * Math.PI * 4); x ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
      g.lineWidth = 3;
      for (const s of [1, -1]) for (let x = 0; x < w; x += 10) {
        const y = h / 2 + s * 46 * Math.sin((x / w) * Math.PI * 4);
        g.beginPath(); g.moveTo(x - 4, y - 6); g.lineTo(x + 4, y + 6); g.stroke();
      }
    }, aniso);
    const metal = B.pattern === 'metal' ? 0.85 : B.pattern === 'gold' ? 0.95 : 0;
    const m = new THREE.MeshStandardMaterial({ map, roughness: metal ? 0.25 : 0.55, metalness: metal });
    if (B.pattern === 'fire') { m.emissive = new THREE.Color('#ff6a1a'); m.emissiveIntensity = 0.6; }
    return m;
  });
}

/* ======================================================================
   인형
   ====================================================================== */
class Kid {
  constructor(scene, look, aniso) {
    this.scene = scene; this.aniso = aniso;
    this.root = new THREE.Group(); scene.add(this.root);
    this.parts = new THREE.Group(); scene.add(this.parts);
    this.pelvis = new THREE.Group(); this.pelvis.rotation.order = 'YXZ'; this.root.add(this.pelvis);
    this.chest = new THREE.Group(); this.chest.rotation.order = 'YXZ'; this.chest.position.y = 0.06; this.pelvis.add(this.chest);
    this.head = new THREE.Group(); this.head.position.set(0, 0.545, 0.012); this.chest.add(this.head);
    const mk = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
    this.hipL = mk(this.pelvis, 0.088, -0.06, 0); this.hipR = mk(this.pelvis, -0.088, -0.06, 0);
    this.shL = mk(this.chest, 0.165, 0.34, 0); this.shR = mk(this.chest, -0.165, 0.34, 0);

    this.mJersey = M('#e23b2e', 0.78); this.mDark = M('#a3241b', 0.7);
    this.mSkin = M('#ffd3ae', 0.55); this.mSkinD = M('#e8b088', 0.6);
    this.mPants = M('#f4f1e8', 0.85); this.mBelt = M('#1f2433', 0.6);
    this.mShoe = M('#22252e', 0.5); this.mSole = M('#f2f2f2', 0.8);
    this.mHair = M('#3a281d', 0.65); this.mEye = M('#1b1d24', 0.25); this.mWhite = M('#ffffff', 0.2);
    this.mCheek = M('#f39a95', 0.7, 0, { transparent: true, opacity: 0.45 });
    this.mCrown = M('#999', 0.7); this.mBrim = M('#777', 0.7); this.mBtn = M('#777', 0.7);
    this.mNumB = M('#ffffff', 0.8, 0, { transparent: true }); this.mNumF = M('#ffffff', 0.8, 0, { transparent: true });

    /* 골반 · 가슴 */
    const hips = new THREE.Mesh(sph(1, 24, 16), this.mPants); hips.scale.set(0.155, 0.12, 0.115); hips.position.y = -0.02; this.pelvis.add(hips);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.147, 0.147, 0.035, 28), this.mBelt); belt.scale.z = 0.76; belt.position.y = 0.075; this.pelvis.add(belt);
    const torso = new THREE.Mesh(cap(0.14, 0.2), this.mJersey); torso.scale.set(1, 1, 0.7); torso.position.y = 0.2; this.chest.add(torso);
    const placket = new THREE.Mesh(cap(0.006, 0.26), this.mDark); placket.position.set(0, 0.19, 0.1); placket.rotation.x = -0.05; this.chest.add(placket);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20), this.mDark); collar.rotation.x = Math.PI / 2; collar.position.y = 0.42; this.chest.add(collar);
    const numB = new THREE.Mesh(new THREE.CylinderGeometry(0.1418, 0.1418, 0.16, 20, 1, true, Math.PI - 0.6, 1.2), this.mNumB); numB.scale.z = 0.7; numB.position.y = 0.21; this.chest.add(numB);
    const numF = new THREE.Mesh(new THREE.CylinderGeometry(0.1418, 0.1418, 0.08, 20, 1, true, -0.55, 1.1), this.mNumF); numF.scale.z = 0.7; numF.position.y = 0.29; this.chest.add(numF);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.09, 14), this.mSkin); neck.position.y = 0.45; this.chest.add(neck);

    /* 머리 (머리카락 · 눈은 꾸미기에 따라 다시 만든다) */
    const H = this.head;
    const skull = new THREE.Mesh(sph(0.125, 32, 24), this.mSkin); skull.scale.set(1, 1.05, 1); H.add(skull);
    const jaw = new THREE.Mesh(sph(0.1, 24, 16), this.mSkin); jaw.position.set(0, -0.045, 0.02); jaw.scale.set(1, 0.9, 1); H.add(jaw);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(sph(0.026, 12, 10), this.mSkin); ear.scale.set(0.55, 1, 0.9); ear.position.set(sx * 0.123, -0.01, 0); H.add(ear);
      const cheek = new THREE.Mesh(sph(0.02, 12, 8), this.mCheek); cheek.scale.set(1, 0.6, 0.3); cheek.position.set(sx * 0.074, -0.036, 0.1); H.add(cheek);
      (this.cheeks ||= []).push(cheek);
    }
    const nose = new THREE.Mesh(sph(0.012, 12, 8), this.mSkinD); nose.position.set(0, -0.018, 0.123); H.add(nose);
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 14, Math.PI), M('#8a2b2b', 0.6)); this.mouth.rotation.z = Math.PI; this.mouth.position.set(0, -0.052, 0.111); H.add(this.mouth);
    this.hairG = new THREE.Group(); H.add(this.hairG);
    this.eyeG = new THREE.Group(); H.add(this.eyeG);
    /* 모자 */
    this.capG = new THREE.Group(); H.add(this.capG);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.133, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), this.mCrown); crown.scale.set(1, 0.9, 1.02); crown.position.set(0, 0.024, -0.004);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.012, 32, 1, false, -Math.PI / 2, Math.PI), this.mBrim); brim.scale.set(1, 1, 1.28); brim.position.set(0, 0.03, 0.088); brim.rotation.x = 0.16;
    const btn = new THREE.Mesh(sph(0.012, 10, 8), this.mBtn); btn.position.set(0, 0.024 + 0.133 * 0.9, -0.004);
    const logo = new THREE.Mesh(new THREE.CircleGeometry(0.024, 20), M('#ffffff', 0.6)); logo.position.set(0, 0.075, 0.123); logo.rotation.x = -0.42;
    this.capG.add(crown, brim, btn, logo);
    this.extraG = new THREE.Group(); this.capG.add(this.extraG);   // 왕관 · 반짝이

    /* 팔다리 — 장면에 바로 둔다 (IK 로 매 프레임 자리를 정한다) */
    const add = (m) => { this.parts.add(m); return m; };
    this.shoulderBallL = add(new THREE.Mesh(sph(0.062), this.mJersey)); this.shoulderBallR = add(new THREE.Mesh(sph(0.062), this.mJersey));
    this.sleeveL = add(new THREE.Mesh(cap(0.058, UA * 0.42), this.mJersey)); this.sleeveR = add(new THREE.Mesh(cap(0.058, UA * 0.42), this.mJersey));
    this.uaL = add(new THREE.Mesh(cap(0.041, UA), this.mSkin)); this.uaR = add(new THREE.Mesh(cap(0.041, UA), this.mSkin));
    this.faL = add(new THREE.Mesh(cap(0.037, FA), this.mSkin)); this.faR = add(new THREE.Mesh(cap(0.037, FA), this.mSkin));
    this.handR = add(new THREE.Mesh(sph(0.046), this.mSkin)); this.handR.scale.set(1, 1.15, 0.8);
    this.thL = add(new THREE.Mesh(cap(0.068, TH), this.mPants)); this.thR = add(new THREE.Mesh(cap(0.068, TH), this.mPants));
    this.kneeL = add(new THREE.Mesh(sph(0.066), this.mPants)); this.kneeR = add(new THREE.Mesh(sph(0.066), this.mPants));
    this.shinL = add(new THREE.Mesh(cap(0.05, SH), this.mDark)); this.shinR = add(new THREE.Mesh(cap(0.05, SH), this.mDark));
    this.footL = add(this.makeFoot()); this.footR = add(this.makeFoot());
    this.glove = new THREE.Group(); add(this.glove);
    this.handTip = new THREE.Vector3();
    this.look = null; this.keys = {};
    this.blinkAt = 1 + Math.random() * 3;
    this.lookWorld = null;
    this.setLook(look);
    shadowAll(this.root); shadowAll(this.parts);
  }
  makeFoot() {
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    const shoe = new THREE.Mesh(sph(1, 20, 14), this.mShoe); shoe.scale.set(0.052, 0.045, 0.112); shoe.position.set(0, -0.022, 0.045);
    const sole = new THREE.Mesh(sph(1, 20, 10), this.mSole); sole.scale.set(0.056, 0.014, 0.118); sole.position.set(0, -0.055, 0.045);
    const lace = new THREE.Mesh(sph(1, 12, 8), this.mWhite); lace.scale.set(0.03, 0.012, 0.04); lace.position.set(0, 0.012, 0.075); lace.rotation.x = -0.35;
    g.add(shoe, sole, lace); return g;
  }
  /** 왼손 글러브 — 주머니가 +Z, 손가락이 +Y, 엄지가 -X. 종류마다 모양이 다르다 */
  buildGlove(type, color) {
    disposeTree(this.glove); this.glove.clear();
    const base = (Art.GLOVE_COLORS[color] || Art.GLOVE_COLORS[0]).base;
    const mL = M(base, 0.55), mD = M(Art.shade(base, -0.38), 0.6), mLace = M('#e8d2a8', 0.7);
    const inner = new THREE.Group(); this.glove.add(inner); this.gloveInner = inner;
    this.fingers = []; this.thumb = null; this.mitTop = null;
    const pocket = (sx, sy, y) => { const p = new THREE.Mesh(new THREE.CircleGeometry(1, 24), mD); p.scale.set(sx, sy, 1); p.position.set(0, y, 0.044); inner.add(p); };
    if (type === 2) {
      /* 포수 미트 — 동그랗고 두툼하다 */
      const pad = new THREE.Mesh(sph(1, 28, 18), mL); pad.scale.set(0.115, 0.12, 0.06); pad.position.set(0.005, 0.08, 0); inner.add(pad);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 10, 28), mL); rim.position.set(0.005, 0.08, 0.02); inner.add(rim);
      pocket(0.07, 0.075, 0.08);
      const lace = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.004, 6, 32), mLace); lace.position.set(0.005, 0.08, 0.028); inner.add(lace);
      this.mitTop = new THREE.Group(); this.mitTop.position.set(0, 0.12, 0); inner.add(this.mitTop);
      const top = new THREE.Mesh(sph(1, 20, 12), mL); top.scale.set(0.09, 0.045, 0.05); top.position.set(0.01, 0.06, 0); this.mitTop.add(top);
    } else if (type === 3) {
      /* 1루수 미트 — 길쭉하다 */
      const palm = new THREE.Mesh(sph(1, 24, 18), mL); palm.scale.set(0.085, 0.15, 0.045); palm.position.set(0.01, 0.1, 0); inner.add(palm);
      pocket(0.055, 0.1, 0.1);
      this.mitTop = new THREE.Group(); this.mitTop.position.set(0.01, 0.17, 0); inner.add(this.mitTop);
      const top = new THREE.Mesh(cap(0.05, 0.06), mL); top.scale.set(1.5, 1, 0.8); top.position.y = 0.05; this.mitTop.add(top);
    } else {
      /* 내야수 · 외야수 글러브 — 손가락 넷 (외야수는 길다) */
      const longK = type === 1 ? 1.32 : 1;
      const palm = new THREE.Mesh(sph(1, 24, 16), mL); palm.scale.set(0.088, 0.1 * (type === 1 ? 1.08 : 1), 0.042); palm.position.set(0.005, 0.06, 0); inner.add(palm);
      pocket(0.058, 0.068, 0.066);
      const fx = [0.062, 0.027, -0.009, -0.044], fl = [0.085, 0.1, 0.106, 0.098];
      fx.forEach((x, i) => {
        const L = fl[i] * longK;
        const piv = new THREE.Group(); piv.position.set(x, 0.135, 0); piv.rotation.z = (x - 0.01) * -0.9;
        const f = new THREE.Mesh(cap(0.021, L), mL); f.position.y = L / 2 + 0.01; piv.add(f);
        const tip = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12), mLace); tip.rotation.y = Math.PI / 2; tip.position.y = L * 0.95; piv.add(tip);
        inner.add(piv); this.fingers.push(piv);
      });
      const web = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.075 * longK, 0.012), mD); web.position.set(-0.07, 0.13, 0.012); web.rotation.z = 0.35; inner.add(web);
    }
    const heel = new THREE.Mesh(cap(0.032, 0.11), mL); heel.rotation.z = Math.PI / 2; heel.position.set(0.005, -0.005, 0.004); inner.add(heel);
    this.thumb = new THREE.Group(); this.thumb.position.set(-0.075, 0.03, 0.005);
    const th = new THREE.Mesh(cap(0.024, 0.085), mL); th.position.y = 0.055; this.thumb.add(th);
    inner.add(this.thumb);
    const lace = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 6, 24, Math.PI), mLace); lace.position.set(0.005, -0.02, 0.03); lace.rotation.z = Math.PI; inner.add(lace);
    shadowAll(this.glove);
  }
  buildHair(style) {
    disposeTree(this.hairG); this.hairG.clear();
    const add = (m) => { m.castShadow = true; this.hairG.add(m); return m; };
    add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 28, 16, Math.PI, Math.PI, 0, Math.PI * 0.6), this.mHair)).position.set(0, 0.008, -0.004);
    if (style === 1) {
      for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; const b = add(new THREE.Mesh(sph(0.034, 10, 8), this.mHair)); b.position.set(Math.cos(a) * 0.118, -0.025 - (i % 2) * 0.012, Math.sin(a) * 0.112 - 0.005); }
    } else if (style === 2) {
      const tail = add(new THREE.Mesh(cap(0.032, 0.13), this.mHair)); tail.position.set(0, -0.035, -0.15); tail.rotation.x = 0.55;
      const tie = add(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 14), this.mJersey)); tie.position.set(0, 0.03, -0.128); tie.rotation.x = Math.PI / 2 + 0.55;
    } else if (style === 3) {
      for (const sx of [-1, 1]) { const t = add(new THREE.Mesh(cap(0.03, 0.1), this.mHair)); t.position.set(sx * 0.13, -0.08, -0.03); t.rotation.z = sx * 0.35; }
    } else if (style === 4) {
      for (let i = 0; i < 6; i++) { const a = Math.PI + 0.25 + (i / 5) * (Math.PI - 0.5); const s = add(new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.075, 8), this.mHair)); s.position.set(Math.cos(a) * 0.12, -0.02, Math.sin(a) * 0.115); s.quaternion.setFromUnitVectors(_up, _a.set(Math.cos(a), -0.35, Math.sin(a)).normalize()); }
    }
  }
  buildEyes(kind) {
    disposeTree(this.eyeG); this.eyeG.clear();
    this.eyes = [];
    for (const sx of [-1, 1]) {
      let e;
      if (kind === 1) { e = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.004, 6, 12, Math.PI), this.mEye); e.position.set(sx * 0.042, -0.002, 0.114); }
      else {
        const r = kind === 2 ? 0.019 : 0.015;
        e = new THREE.Mesh(sph(r, 14, 10), this.mEye); e.scale.set(0.85, kind === 3 ? 0.42 : 1.25, 0.6); e.position.set(sx * 0.042, kind === 3 ? -0.004 : 0.0, 0.112);
        if (kind !== 3) {
          const hl = new THREE.Mesh(sph(kind === 2 ? 0.006 : 0.0045, 8, 6), this.mWhite); hl.position.set(sx * 0.042 + 0.005, 0.008, 0.121); this.eyeG.add(hl);
          if (kind === 2) { const h2 = new THREE.Mesh(sph(0.003, 6, 5), this.mWhite); h2.position.set(sx * 0.042 - 0.005, -0.006, 0.121); this.eyeG.add(h2); }
        }
        this.eyes.push(e);
      }
      this.eyeG.add(e);
      const brow = new THREE.Mesh(cap(0.0055, 0.028), this.mHair); brow.rotation.z = Math.PI / 2 + sx * 0.1; brow.position.set(sx * 0.043, 0.04, 0.113); this.eyeG.add(brow);
    }
    this.eyeKind = kind;
  }
  /** 꾸미기 적용 — 바뀐 부분만 다시 만든다 */
  setLook(look) {
    const L = Art.normalizeLook(look);
    const T = Art.TEAMS[L.team] || Art.TEAMS.red;
    const k = this.keys;
    this.look = L;
    this.mJersey.color.set(T.jersey); this.mDark.color.set(T.dark);
    this.mSkin.color.set((Art.SKINS[L.skin] || Art.SKINS[1]).base); this.mSkinD.color.set(Art.shade((Art.SKINS[L.skin] || Art.SKINS[1]).base, -0.12));
    this.mHair.color.set((Art.HAIR_COLORS[L.hairColor] || Art.HAIR_COLORS[0]).c);
    const shoe = (Art.SHOES[L.shoes] || Art.SHOES[0]).c;
    this.mShoe.color.set(shoe); this.mSole.color.set(L.shoes === 1 ? '#c9c4b8' : '#f2f2f2');
    for (const c of this.cheeks) c.visible = L.blush !== 0;
    if (k.hair !== L.hair) { this.buildHair(L.hair); k.hair = L.hair; }
    if (k.eyes !== L.eyes) { this.buildEyes(L.eyes); k.eyes = L.eyes; }
    const gk = `${L.glove.type}.${L.glove.color}`;
    if (k.glove !== gk) { this.buildGlove(L.glove.type, L.glove.color); k.glove = gk; }
    this.glove.scale.setScalar((Art.GLOVE_SIZES[L.glove.size] || Art.GLOVE_SIZES[1]).k);
    const nk = `${L.team}.${L.number}`;
    if (k.num !== nk) {
      k.num = nk;
      const font = '"Black Han Sans","Jua",sans-serif';
      for (const [m, txt, size, w, h] of [[this.mNumB, String(L.number), 190, 256, 256], [this.mNumF, '이안', 86, 256, 128]]) {
        if (m.map) m.map.dispose();
        m.map = canvasTex(w, h, (g) => {
          g.font = `${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.lineWidth = size * 0.09; g.strokeStyle = T.dark; g.lineJoin = 'round'; g.strokeText(txt, w / 2, h / 2 + size * 0.05);
          g.fillStyle = T.num; g.fillText(txt, w / 2, h / 2 + size * 0.05);
        }, this.aniso);
        m.needsUpdate = true;
      }
    }
    const hk = `${L.hat}.${L.team}`;
    if (k.hat !== hk) {
      k.hat = hk;
      const h = hatLook(L.hat, L.team, this.aniso);
      const set = (m, c, rough = 0.7, metal = 0, map = null, em = 0) => {
        m.color.set(c); m.roughness = rough; m.metalness = metal; m.map = map;
        m.emissive.set(em ? '#ff7a2a' : '#000000'); m.emissiveIntensity = em; m.emissiveMap = em ? map : null; m.needsUpdate = true;
      };
      set(this.mCrown, h.main, h.rough ?? 0.7, h.metal ?? 0, h.map || null, h.emissive || 0);
      set(this.mBrim, h.brim, h.brimMetal ? 0.25 : 0.7, h.brimMetal || (h.metal ? h.metal * 0.9 : 0));
      set(this.mBtn, h.btn, 0.5, h.brimMetal || 0);
      disposeTree(this.extraG); this.extraG.clear(); this.sparkles = [];
      if (h.crown) {
        const gold = M('#f2c94c', 0.2, 1);
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.035, 20, 1, true), gold); ring.position.set(0, 0.16, -0.004); this.extraG.add(ring);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const sp = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 8), gold); sp.position.set(Math.cos(a) * 0.075, 0.2, Math.sin(a) * 0.078 - 0.004); this.extraG.add(sp);
          const gem = new THREE.Mesh(sph(0.009, 8, 6), M(['#e23b2e', '#3fa9f5', '#4cd964', '#ff9f2e', '#ffffff'][i], 0.2)); gem.position.set(Math.cos(a) * 0.081, 0.162, Math.sin(a) * 0.084 - 0.004); this.extraG.add(gem);
        }
      }
      if (h.sparkle) {
        for (let i = 0; i < 4; i++) {
          const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.013), new THREE.MeshBasicMaterial({ color: 0xffffff }));
          const a = i * 1.7;
          s.position.set(Math.cos(a) * 0.12, 0.09 + (i % 2) * 0.04, Math.sin(a) * 0.12); this.extraG.add(s); this.sparkles.push(s);
        }
      }
    }
  }
  setRoot(x, z, yaw) { this.root.position.set(x, 0, z); this.root.rotation.y = yaw; }
  toWorld(arr, out) { return this.root.localToWorld(out.set(arr[0], arr[1], arr[2])); }
  toWorldDir(arr, out) { return out.set(arr[0], arr[1], arr[2]).applyQuaternion(this.root.quaternion).normalize(); }
  /** 자세 한 장을 몸에 입힌다 */
  apply(p, time) {
    const breathe = Math.sin(time * 2.1) * 0.6;
    const lift = p.lift || 0;
    this.pelvis.position.set(p.px, p.py + lift, p.pz);
    this.pelvis.rotation.set(p.ppitch * DEG, p.pyaw * DEG, p.proll * DEG);
    this.chest.rotation.set((p.cpitch + breathe) * DEG, p.cyaw * DEG, p.croll * DEG);
    this.root.updateMatrixWorld(true);
    /* 머리 — 보는 곳을 향한다 (조금 덜 돌려 자연스럽게) */
    if (this.lookWorld) { this.head.lookAt(this.lookWorld); this.head.quaternion.slerp(ID, 0.22); }
    else this.head.quaternion.identity();
    const cyc = time % 4.2, blink = cyc > this.blinkAt && cyc < this.blinkAt + 0.12;
    if (this.eyes) for (const e of this.eyes) e.scale.y = blink ? 0.12 : (this.eyeKind === 3 ? 0.42 : 1.25);
    if (this.sparkles) this.sparkles.forEach((s, i) => { const k = 0.4 + 0.6 * Math.abs(Math.sin(time * 3 + i * 1.3)); s.scale.setScalar(k); s.rotation.y = time * 2; });

    /* 오른팔 (던지는 팔) */
    const S = this.shR.getWorldPosition(_b);
    ik2(S, this.toWorld(p.rh, _c), UA, FA, this.toWorldDir(p.rpole, _e), _f, _g);
    this.shoulderBallR.position.copy(S);
    placeSeg(this.uaR, S, _f); placeSeg(this.faR, _f, _g);
    _h.lerpVectors(S, _f, 0.36); placeSeg(this.sleeveR, S, _h);
    _p.subVectors(_g, _f).normalize();
    this.handR.position.copy(_g).addScaledVector(_p, 0.03);
    this.handR.quaternion.copy(this.faR.quaternion);
    this.handTip.copy(_g).addScaledVector(_p, 0.07);

    /* 왼팔 → 글러브 */
    const SL = this.shL.getWorldPosition(_b);
    ik2(SL, this.toWorld(p.lh, _c), UA, FA, this.toWorldDir(p.lpole, _e), _f, _g);
    this.shoulderBallL.position.copy(SL);
    placeSeg(this.uaL, SL, _f); placeSeg(this.faL, _f, _g);
    _h.lerpVectors(SL, _f, 0.36); placeSeg(this.sleeveL, SL, _h);
    const face = this.toWorldDir(p.gface, _a);
    const up = this.toWorldDir(p.gup, _c); up.addScaledVector(face, -up.dot(face)).normalize();
    _m4.makeBasis(_h.crossVectors(up, face), up, face);
    this.glove.quaternion.setFromRotationMatrix(_m4);
    this.glove.position.copy(_g);
    const cl = clamp(p.gclose, 0, 1);
    for (const f of this.fingers) f.rotation.x = cl * 1.05;
    if (this.mitTop) this.mitTop.rotation.x = cl * 0.9;
    if (this.thumb) this.thumb.rotation.set(cl * 0.55, 0, 0.6 - cl * 0.5);

    /* 다리 */
    for (let i = 0; i < 2; i++) {
      const left = i === 0;
      const fp = left ? p.lf : p.rf, yaw = left ? p.lfyaw : p.rfyaw, pitch = left ? p.lfpitch : p.rfpitch;
      const heel = 0.085 * Math.sin(Math.max(0, pitch) * DEG);
      const H = (left ? this.hipL : this.hipR).getWorldPosition(_b);
      const A = this.toWorld([fp[0], fp[1] + ANK + heel + lift, fp[2]], _c);
      const pole = this.toWorldDir([Math.sin(yaw * DEG), 0.3, Math.cos(yaw * DEG)], _e);
      ik2(H, A, TH, SH, pole, _f, _g);
      placeSeg(left ? this.thL : this.thR, H, _f);
      placeSeg(left ? this.shinL : this.shinR, _f, _g);
      (left ? this.kneeL : this.kneeR).position.copy(_f);
      const foot = left ? this.footL : this.footR;
      foot.position.copy(_g);
      foot.rotation.set(pitch * DEG, this.root.rotation.y + yaw * DEG, 0);
    }
  }
  pocketWorld(out) { this.glove.updateMatrixWorld(true); return this.gloveInner.localToWorld(out.set(0, 0.07, 0.05)); }
  dispose() { disposeTree(this.root); disposeTree(this.parts); this.scene.remove(this.root); this.scene.remove(this.parts); }
}

/* ======================================================================
   경기장
   ====================================================================== */
function buildField(scene, renderer, aniso, small) {
  scene.background = canvasTex(4, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#2a86d8'); gr.addColorStop(0.55, '#7cc6f2'); gr.addColorStop(1, '#d9f1fb');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog(0xcde8f6, 34, 150);
  scene.add(new THREE.HemisphereLight(0xd8efff, 0x5d8a45, 0.55));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.6);
  sun.position.set(-7, 13, -2);
  sun.target.position.set(0, 0, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 11, bottom: -11, near: 1, far: 40 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);

  const r = rnd(5);
  const grass = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#5ea948'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#67b552'; g.fillRect(0, 0, w, h / 2);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(30,90,30,.25)' : 'rgba(190,240,150,.18)';
      g.fillRect(r() * w, r() * h, 1.2, 3 + r() * 3);
    }
  }, aniso, 22);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = 6; ground.receiveShadow = true;
  scene.add(ground);
  const dirt = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    gr.addColorStop(0, '#c89668'); gr.addColorStop(0.85, '#bf8a5c'); gr.addColorStop(1, 'rgba(191,138,92,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(120,80,50,.25)' : 'rgba(240,210,170,.25)'; g.fillRect(r() * w, r() * h, 2, 2); }
  }, aniso);
  for (const z of [0, 11]) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(1.9, 48), new THREE.MeshStandardMaterial({ map: dirt, transparent: true, roughness: 1 }));
    d.rotation.x = -Math.PI / 2; d.position.set(0, 0.004, z); d.receiveShadow = true; scene.add(d);
  }
  const fence = new THREE.Mesh(new THREE.CylinderGeometry(46, 46, 2.6, 128, 1, true), new THREE.MeshStandardMaterial({ color: 0x1f6b45, side: THREE.BackSide, roughness: 0.9 }));
  fence.position.set(0, 1.3, 6); scene.add(fence);
  const line = new THREE.Mesh(new THREE.TorusGeometry(45.95, 0.07, 6, 160), new THREE.MeshStandardMaterial({ color: 0xffd84a }));
  line.rotation.x = Math.PI / 2; line.position.set(0, 2.6, 6); scene.add(line);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.3), new THREE.MeshStandardMaterial({ map: canvasTex(256, 84, (g, w, h) => {
    g.fillStyle = '#1f6b45'; g.fillRect(0, 0, w, h); g.font = '56px "Black Han Sans","Jua",sans-serif'; g.fillStyle = '#fffaf0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('122m', w / 2, h / 2 + 3);
  }, aniso), roughness: 0.9 }));
  sign.position.set(0, 1.25, 51.9); sign.rotation.y = Math.PI; scene.add(sign);
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2f8048, roughness: 0.9 });
  const trunk = new THREE.MeshStandardMaterial({ color: 0x6b4a2f });
  const topG = new THREE.SphereGeometry(1, 10, 8), stG = new THREE.CylinderGeometry(0.25, 0.3, 1, 6);
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + r() * 0.05, rad = 51 + r() * 9, hgt = 4 + r() * 3, s = 1.8 + r() * 0.9;
    const top = new THREE.Mesh(topG, leaf); top.scale.setScalar(s); top.position.set(Math.cos(a) * rad, hgt, 6 + Math.sin(a) * rad);
    const st = new THREE.Mesh(stG, trunk); st.scale.y = hgt; st.position.set(Math.cos(a) * rad, hgt / 2, 6 + Math.sin(a) * rad);
    scene.add(top, st);
  }
  const hillM = new THREE.MeshStandardMaterial({ color: 0x8fc7a4, roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, h = new THREE.Mesh(new THREE.SphereGeometry(34 + r() * 14, 20, 12), hillM);
    h.scale.y = 0.32; h.position.set(Math.cos(a) * 118, 0, 6 + Math.sin(a) * 118); scene.add(h);
  }
  return sun;
}

function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  return renderer;
}

/* ======================================================================
   본 화면
   ====================================================================== */
/**
 * @param {{canvas: HTMLCanvasElement}} o
 * @returns 게임이 부르는 그리기 창구 (catchball.js 의 W3)
 */
export function createWorld3D({ canvas }) {
  const small = Math.min(innerWidth, innerHeight) < 700;
  const renderer = makeRenderer(canvas);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  buildField(scene, renderer, aniso, small);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 400);

  const me = new Kid(scene, Art.defaultLook('red'), aniso);
  const pal = new Kid(scene, Art.friendLook(Art.defaultLook('red')), aniso);
  me.pose = P(READY); pal.pose = P(RELAX);

  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.037, 28, 18), ballMaterial(0, aniso));
  ballMesh.castShadow = true; scene.add(ballMesh);
  let ballId = -1;
  const trail = [];
  const trailM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), trailM.clone()); m.visible = false; scene.add(m); trail.push(m); }
  const trailPts = [];

  let W = 1, H = 1, gameCam = { x: 0, y: 4.2, z: -6.3, pitch: 0.4, F: 500, CX: 0.5, CY: 0.5 };
  let lastT = 0, mode = '';

  function setGameCamera() {
    const { x, y, z, pitch, F, CX, CY } = gameCam;
    const fullW = 2 * Math.max(CX, W - CX), fullH = 2 * Math.max(CY, H - CY);
    camera.aspect = fullW / fullH;
    camera.fov = 2 * Math.atan(fullH / 2 / F) / DEG;
    camera.setViewOffset(fullW, fullH, fullW / 2 - CX, fullH / 2 - CY, W, H);
    camera.updateProjectionMatrix();
    camera.position.set(-x, y, z);
    camera.lookAt(-x, y - Math.sin(pitch), z + Math.cos(pitch));
  }
  /** 타이틀 — 아이가 카메라를 보고 서서, 화면의 무대 자리(rect)에 꼭 맞게 */
  function setTitleCamera(rect) {
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const fullW = 2 * Math.max(cx, W - cx), fullH = 2 * Math.max(cy, H - cy);
    const fov = 28;
    const d = (1.66 * fullH) / (2 * Math.tan((fov / 2) * DEG) * 0.86 * Math.max(60, rect.height));
    camera.aspect = fullW / fullH; camera.fov = fov;
    camera.setViewOffset(fullW, fullH, fullW / 2 - cx, fullH / 2 - cy, W, H);
    camera.updateProjectionMatrix();
    camera.position.set(0, 0.95, -d);
    camera.lookAt(0, 0.8, 0);
  }

  /* ---------- 자세 고르기 ---------- */
  function mePose(s, t) {
    if (s.u >= 0) return keyPose(THROW, s.u);
    if (s.mode === 'set') return P(THROW[0]);
    const C = [s.x - s.gx, s.gy, GLOVE_Z];
    if (s.mode === 'caught') return absorbPose(C);
    const p = reachPose(C);
    p.gclose = s.close;
    p.lift = s.lift;
    if (s.moving > 0.05 && s.lift < 0.05) {
      p.lf[1] += Math.max(0, Math.sin(s.runPh)) * 0.11 * s.moving;
      p.rf[1] += Math.max(0, -Math.sin(s.runPh)) * 0.11 * s.moving;
    }
    if (s.lift > 0.03) { p.lf[1] += Math.min(0.12, s.lift * 0.3); p.rf[1] += Math.min(0.16, s.lift * 0.4); p.lift = s.lift - Math.min(0.12, s.lift * 0.3); }
    void t;
    return p;
  }
  function titlePose(t) {
    const p = P(RELAX);
    const k = Math.pow((Math.sin(t * 6.5) + 1) / 2, 3);
    p.py = 0.79; p.ppitch = 2;
    p.lh = [0.1, 0.98, 0.3]; p.gface = [-1, 0.2, 0.3]; p.gup = [0, 1, 0]; p.lpole = [1, -0.6, 0];
    p.rh = [-0.05 + k * 0.08, 0.95 + k * 0.06, 0.32]; p.rpole = [-1, -0.5, 0];
    p.gclose = 0.18 * k;
    return p;
  }
  function palPose(s, t) {
    const pt = s.poseT, C = [s.cx, s.cy, 0.25];
    switch (s.pose) {
      case 'wave': { const p = P(RELAX); p.rh = [-0.28 + Math.sin(t * 9) * 0.06, 1.62, 0.12]; p.rpole = [-1, 0, 0]; return p; }
      case 'cheer': {
        const p = P(RELAX); const j = Math.abs(Math.sin(pt * 7));
        p.lift = j * 0.12; p.rh = [-0.25, 1.68, 0.1]; p.lh = [0.25, 1.68, 0.1]; p.rpole = [-1, 0, 0]; p.lpole = [1, 0, 0]; p.gface = [0, 0, 1];
        return p;
      }
      case 'cheerSmall': { const p = P(RELAX); p.rh = [-0.22, 1.6, 0.15]; p.rpole = [-1, 0, 0]; return p; }
      case 'shuffle': {
        const p = P(READY); const ph = s.runPh;
        p.lf = [0.19 + Math.sin(ph) * 0.05, Math.max(0, Math.sin(ph)) * 0.08, 0.03];
        p.rf = [-0.19 + Math.sin(ph) * 0.05, Math.max(0, -Math.sin(ph)) * 0.08, -0.02];
        return p;
      }
      case 'windup': return keyPose(THROW, clamp(pt / Math.max(0.1, s.windDur), 0, 1) * RELEASE_U);
      case 'follow': return keyPose(THROW, RELEASE_U + clamp(pt / 0.34, 0, 1) * (1 - RELEASE_U));
      case 'watch': return P(RELAX);
      case 'ready': {
        const gy = s.oppGy != null ? clamp(s.oppGy, 0.4, 1.9) : 1.0 + Math.sin(t * 3) * 0.01;
        return reachPose([0.18, gy, 0.3], { gclose: 0 });
      }
      case 'track': {
        const k = easeOut(clamp(1 - s.rem / 0.6, 0, 1));
        if (s.judge === 'dive') {
          const p = reachPose(C);
          p.px = s.dir * 0.5 * k; p.proll = -s.dir * 62 * k; p.croll = -s.dir * 18 * k;
          p.py = 0.74 - 0.3 * k; p.ppitch = 18;
          if (s.dir > 0) { p.lf = [0.45 * k + 0.19, 0.12 * k, 0.03]; } else { p.rf = [-0.45 * k - 0.19, 0.12 * k, -0.02]; }
          return lerpPose(P(READY), p, k);
        }
        if (s.judge === 'jump') {
          const jh = clamp(s.tgtY - 1.75, 0.25, 0.9) * Math.sin(k * Math.PI / 2);
          const p = reachPose([C[0], s.cy - jh, C[2]]); p.lift = jh;
          p.lf[1] += 0.12 * k; p.rf[1] += 0.08 * k;
          return lerpPose(P(READY), p, k);
        }
        if (s.judge === 'miss') return lerpPose(P(READY), reachPose([0.3, 1.1, 0.3]), k);
        return lerpPose(P(READY), reachPose(C), k);
      }
      case 'caught': return lerpPose(reachPose(C), absorbPose(C), easeOut(clamp((pt - 0.1) / 0.3, 0, 1)));
      case 'diveHold': {
        const d = 1 - ease(clamp((pt - 0.5) / 0.6, 0, 1));
        const p = absorbPose(C); p.px = s.dir * 0.5 * d; p.proll = -s.dir * 62 * d; p.py = 0.74 - 0.3 * d;
        return p;
      }
      case 'jumpLand': { const k = clamp(pt / 0.3, 0, 1); const p = absorbPose(C); p.lift = (1 - k) * 0.25; return p; }
      case 'oops': { const p = P(RELAX); p.rh = [-0.08, 1.5, 0.06]; p.rpole = [-1, 0.3, 0]; p.cpitch = -4; return p; }
      case 'runAway': case 'runBack': return runPose(s.runPh, s.pose === 'runBack' ? RELAX : RELAX);
      default: return P(RELAX);
    }
  }

  function placeBall(pos, id, spin) {
    if (id !== ballId) { ballId = id; ballMesh.material = ballMaterial(id, aniso); }
    ballMesh.visible = true; ballMesh.position.copy(pos); ballMesh.rotation.set(spin, spin * 0.3, 0);
  }

  const lookTmp = new THREE.Vector3(), lookTmp2 = new THREE.Vector3(), bpos = new THREE.Vector3();
  const api = {
    resize(w, h, dpr, cam) {
      W = Math.max(1, w); H = Math.max(1, h);
      renderer.setPixelRatio(Math.min(small ? 2 : 1.75, dpr || 1));
      renderer.setSize(W, H, false);
      if (cam) gameCam = { ...cam };
      mode = '';
    },
    setLooks(a, b) { if (a) me.setLook(a); if (b) pal.setLook(b); },
    /** 내가 던지는 손 (게임 좌표 x 오른쪽 +) */
    handPos() { return { x: -me.handTip.x, y: me.handTip.y, z: me.handTip.z }; },
    palHandPos() { return { x: -pal.handTip.x, y: pal.handTip.y, z: pal.handTip.z }; },
    palGlovePos() { pal.pocketWorld(_a); return { x: -_a.x, y: _a.y, z: _a.z }; },
    /**
     * 한 장면. S 는 catchball.js 의 snap3d() — 게임 좌표 그대로다.
     */
    frame(S) {
      const t = S.t, dt = clamp(t - lastT, 0, 0.1); lastT = t;
      const want = S.title ? 'title' : 'game';
      if (S.title) setTitleCamera(S.title);
      else if (mode !== 'game') setGameCamera();
      mode = want;
      const k = 1 - Math.exp(-dt * 16);

      /* 나 */
      let pm;
      if (S.title) { me.setRoot(0, 0, Math.PI); pm = titlePose(t); me.pose = pm; }
      else {
        me.setRoot(-S.me.x, 0, 0);
        pm = mePose(S.me, t);
        me.pose = S.me.u >= 0 ? pm : lerpPose(me.pose, pm, k);
      }
      me.lookWorld = null;
      if (S.title) me.lookWorld = lookTmp.copy(camera.position);
      else if (S.ball.show && S.ball.toMe) me.lookWorld = lookTmp.set(-S.ball.x, S.ball.y, S.ball.z);
      else me.lookWorld = lookTmp.set(-S.pal.x, 1.2, S.pal.z);
      me.apply(me.pose, t);

      /* 친구 */
      const running = S.pal.pose === 'runAway' || S.pal.pose === 'runBack';
      let yaw = Math.PI;
      const pvx = dt > 0 && pal.lastX != null ? (-S.pal.x - pal.lastX) / dt : 0, pvz = dt > 0 && pal.lastZ != null ? (S.pal.z - pal.lastZ) / dt : 0;
      pal.lastX = -S.pal.x; pal.lastZ = S.pal.z;
      if (running && Math.hypot(pvx, pvz) > 0.5) yaw = Math.atan2(pvx, pvz);
      else if (running) yaw = pal.yaw ?? Math.PI;
      pal.setRoot(-S.pal.x, S.pal.z, pal.yaw = pal.yaw == null ? yaw : pal.yaw + (((yaw - pal.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 10));
      const pp = palPose(S.pal, t);
      const direct = S.pal.pose === 'windup' || S.pal.pose === 'follow' || S.pal.pose === 'track';
      pal.pose = direct ? pp : lerpPose(pal.pose, pp, k);
      if (S.ball.show && !S.ball.toMe && !running) pal.lookWorld = lookTmp2.set(-S.ball.x, S.ball.y, S.ball.z);
      else if (S.ball.show && running) pal.lookWorld = lookTmp2.set(-S.ball.x, 0.1, S.ball.z);
      else pal.lookWorld = me.root.localToWorld(lookTmp2.set(0, 1.2, 0));
      pal.apply(pal.pose, t);

      /* 공 */
      if (S.ball.show) {
        placeBall(bpos.set(-S.ball.x, S.ball.y, S.ball.z), S.ball.id, S.ball.rot);
        if (S.ball.fly) { trailPts.unshift(bpos.clone()); if (trailPts.length > 8) trailPts.length = 8; }
      } else if (S.me.ball !== 'none') {
        placeBall(S.me.ball === 'hand' ? me.handTip : me.pocketWorld(bpos), S.me.ballId, 0);
      } else if (S.pal.ball !== 'none') {
        placeBall(S.pal.ball === 'hand' ? pal.handTip : pal.pocketWorld(bpos), S.pal.ballId, 0);
      } else ballMesh.visible = false;
      if (!S.ball.show || !S.ball.fly) trailPts.length = 0;
      const fire = (Art.BALLS[S.ball.id] || {}).trail;
      trail.forEach((m, i) => {
        const p = trailPts[i + 1];
        m.visible = !!p;
        if (p) { m.position.copy(p); m.material.opacity = (fire ? 0.55 : 0.28) * (1 - i / trail.length); m.material.color.set(fire ? (i < 3 ? '#ffd23a' : '#ff6a1a') : '#ffffff'); m.scale.setScalar(1 - i / 11); }
      });

      renderer.render(scene, camera);
    },
    /** 작은 3D 미리보기 (꾸미기 · 자세 배우기) */
    mini(cv, kind) { return createMini(cv, kind); },
    destroy() {
      me.dispose(); pal.dispose();
      scene.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) for (const mt of [].concat(m.material)) { if (mt.map) mt.map.dispose(); mt.dispose(); } });
      envTex.dispose(); pmrem.dispose();
      renderer.dispose();
    },
  };
  return api;
}

/* ======================================================================
   작은 3D 미리보기 — 꾸미기(빙글빙글 도는 내 캐릭터) · 자세 배우기(옆에서 본 느린 던지기)
   ====================================================================== */
function createMini(canvas, kind) {
  const renderer = makeRenderer(canvas);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.background = canvasTex(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#9fd8f7'); gr.addColorStop(0.7, '#e5f6ff'); gr.addColorStop(1, '#e5f6ff');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  scene.add(new THREE.HemisphereLight(0xe0f2ff, 0x6f9a50, 0.7));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.4);
  sun.position.set(-3, 6, -2); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 15 });
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const disk = new THREE.Mesh(new THREE.CircleGeometry(kind === 'lesson' ? 3 : 1.1, 48), new THREE.MeshStandardMaterial({ color: kind === 'lesson' ? 0x8fd06f : 0xd9c39a, roughness: 1 }));
  disk.rotation.x = -Math.PI / 2; disk.receiveShadow = true; scene.add(disk);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const kid = new Kid(scene, Art.defaultLook('red'), aniso);
  kid.pose = P(RELAX);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.037, 24, 16), ballMaterial(0, aniso)); ball.castShadow = true; scene.add(ball);
  let lookKey = '', ballIdNow = -1;
  const tmp = new THREE.Vector3();
  function size() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    return { w, h };
  }
  let sz = size();
  return {
    frame({ t, look, u }) {
      const r = canvas.getBoundingClientRect();
      if (Math.round(r.width) !== sz.w || Math.round(r.height) !== sz.h) sz = size();
      const key = Art.encodeLook(look);
      if (key !== lookKey) { lookKey = key; kid.setLook(look); }
      const bid = Art.normalizeLook(look).ball;
      if (bid !== ballIdNow) { ballIdNow = bid; ball.material = ballMaterial(bid, aniso); }
      if (kind === 'lesson') {
        kid.setRoot(0, 0, 0);
        const uu = u == null ? 0 : u;
        kid.pose = keyPose(THROW, uu);
        kid.lookWorld = tmp.set(0, 1.2, 12);
        kid.apply(kid.pose, t);
        /* 던지는 아이의 앞쪽 옆에서 (몸이 옆으로 서 있다) */
        const wide = camera.aspect < 1 ? 1.2 / camera.aspect : 1.15;
        camera.position.set(-3.6 * wide, 1.15, 0.5); camera.lookAt(0, 0.82, 0.45);
        if (uu < RELEASE_U) { ball.visible = true; ball.position.copy(kid.handTip); }
        else if (uu < 0.95) { const k = (uu - RELEASE_U) / 0.29; ball.visible = true; ball.position.set(-0.27 - k * 0.1, 1.32 + k * 0.25 - k * k * 0.3, 0.96 + k * 3.2); }
        else ball.visible = false;
      } else {
        /* 꾸미기 — 천천히 좌우로 돌며 공을 글러브에 톡톡 */
        kid.setRoot(0, 0, Math.PI + Math.sin(t * 0.7) * 0.75);
        const p = P(RELAX);
        const k = Math.pow((Math.sin(t * 4) + 1) / 2, 3);
        p.lh = [0.1, 0.98, 0.3]; p.gface = [-1, 0.2, 0.3]; p.lpole = [1, -0.6, 0];
        p.rh = [-0.05 + k * 0.08, 0.95 + k * 0.06, 0.32]; p.rpole = [-1, -0.5, 0]; p.gclose = 0.18 * k;
        kid.pose = p;
        kid.lookWorld = tmp.set(0, 1.3, -3);
        kid.apply(p, t);
        ball.visible = true; ball.position.copy(kid.handTip);
        camera.position.set(0, 0.95, -3.4); camera.lookAt(0, 0.8, 0);
      }
      renderer.render(scene, camera);
    },
    destroy() {
      kid.dispose();
      scene.traverse((m) => { if (m.geometry) m.geometry.dispose(); });
      envTex.dispose(); pmrem.dispose(); renderer.dispose();
    },
  };
}
