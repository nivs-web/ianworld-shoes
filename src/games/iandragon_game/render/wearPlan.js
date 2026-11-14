/**
 * 좀비와 드래곤 — 꾸미기 착용 «계획» (표 읽기 · 폭 · 자리 계산) — Pixi 없이 쓰는 부분 (겜보조 1 · 2026-11-13)
 * 그리는 쪽 : 전투 · 로비 · 꾸미기 창(Pixi) = wearKit.js · 2D 그림(idgDressed) = 이 계획을 그대로 캔버스에 그린다.
 * 표 : ai/meta/wear_anchor.json (드래곤별 head · neck · back 점 + size) · ai/meta/wear_items.json (물건별 w · anchor · layer · cover)
 *
 * 모자 «씌우기» (11/14 겜보조 1 · 대표님 «왕관이 머리 위 공중에 떠 있다 · 실제로 쓴 듯이» 반복 지적) — 표의 손 숫자 대신 머리 그림에서 잰다 :
 *  두개골 = «모자용 머리»(뿔 · 볏을 지운 머리)에서 5칸보다 가는 가시 · 볏을 걷어낸 덩어리 (skullBox)
 *   - 가로 : 두개골 맨 윗줄부터 5칸 아래까지의 가로 범위 가운데 + 이마 쪽 1칸 (뒤통수 갈기 · 불꽃까지 넓게 잡히면 머리 폭의 72% 로, 이마 쪽 끝 기준)
 *   - 크기 : 그 범위 폭 × HAT_K(모자 종류별 · 왕관 0.88) · 최소 22칸 — 그림은 상점 원본을 그 자리에서 굽기 도구와 같은 방법으로 줄인다(bakeHat)
 *   - 기울기 : 두개골 윗면 기울기(직선 맞춤)만큼 모자를 기울인다 · 최대 ±15° (아랫단 가운데를 축으로)
 *   - 왕관 · 티아라처럼 속이 빈 띠 모자(BEHIND · 뿔을 지운 모자용 머리를 쓰는 것만) : 머리 «뒤» 층에 그리고, 아랫단이 머리 윗면에 가려지게 내린다 → 머리가 왕관 안에 들어간 «푹 쓴» 모양
 *     (정면 그림 = 아랫단 30% · 옆모습 새 왕관 hat_crown_side.png = 밑단 3칸)
 *     (앞 띠를 머리 앞에 따로 그리는 방법도 비교했지만 띠가 눈 위에 줄처럼 그어져 뺐다 · 사진 crown/after2/p3-AB-zoom.png)
 *   - 나머지 모자(고깔 · 호박 · 헬멧 · 비행모자 …) : 머리 «앞» 층 · 아랫단이 두개골 윗면 아래로 3~6칸 겹치게 · 속 구멍이 머리 위면 지워 머리가 보이게
 *     · 눈을 가리지 않게 모자 밑동은 두개골 윗면 + 머리 키의 22% 까지만
 *  세 화면(로비 · 꾸미기 · 전투) + 2D 그림(정지 그림 · 얼굴)이 전부 이 파일의 hatWidth · bakeHat · hatFit 하나를 쓴다.
 */
import { BLOCKED } from '../data/blocked.js';   /* 잠시 잠근 꾸미기 (11/14) */

const BASE = '/assets/iandragon_game/';
let tabP = null;
/** 표 { A: 드래곤 표, I: 물건 표, S: 옆모습 모자 표(없으면 {}) } — 한 번만 받는다 (실패하면 null · 다음에 다시) */
export function wearTables() {
  if (!tabP) {
    tabP = Promise.all([fetch(`${BASE}ai/meta/wear_anchor.json`).then((r) => r.json()), fetch(`${BASE}ai/meta/wear_items.json`).then((r) => r.json()),
      fetch(`${BASE}ai/meta/hat_side.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))]).then(([A, I, S]) => ({ A, I, S }));   /* S = 머리에 씌운 채 그린 옆모습 모자 표 (11/14) */
    tabP.catch(() => { tabP = null; });
  }
  return tabP.catch(() => null);
}

/** 이 드래곤의 표 이름 — 색 바꾼 모습(_red · _violet)은 원래 용 줄을 같이 쓴다(부품 그림 크기 · 모양이 같다) */
export function wearArt(T, art) {
  const A = T?.A?.dragons;
  if (!A || !art) return null;
  if (A[art]) return art;
  const b = String(art).replace(/_(red|violet)$/, '');
  return A[b] ? b : null;
}

/** 물건 폭(칸) — tools/idg-wear-bake.mjs 와 같은 식 (목 장식 · 망토 · 모자 예비 그림) */
export function wearWidth(it, D, sizes) {
  const base = it.slot === 'hat' ? (D.head.w ?? sizes[D.size].head) : it.layer === 'back' ? D.back.w : D.neck.w;
  return Math.max(2, Math.round(it.w * base));
}

/**
 * 이 드래곤이 이 꾸미기(lk = decodeLook 결과)를 쓴 모습 계획
 *  hat  = { id, file, ax, ay, x, y, heads, mask, skull, src, hole }
 *         file = 굽어 둔 예비 그림(원본을 못 받을 때) · x · y = 표 자리(두개골을 못 잴 때만) · ax · ay = 그림 안 붙는 점 비율
 *         heads = 덮는 모자일 때 «모자용 머리» 그림 {부품이름: 주소} · mask = true 면 그 그림을 «모양만» 쓴다(색 바꾼 모습 : 자기 머리 색 그대로 뿔만 지움)
 *         skull = 두개골 모양 그림(모자용 머리) — 덮지 않는 모자도 이 모양으로 자리 · 폭 · 기울기를 잰다 · src = 상점 원본 그림 · hole = 굽을 때 머리 구멍을 뚫나
 *  neck = { file, ax, ay, x, y, layer } x · y = 몸통 부품 기준 · layer 'front'(몸통 앞) | 'back'(몸통 뒤)
 */
export function wearPlan(art, lk, T) {
  const key = wearArt(T, art), D = key && T.A.dragons[key], out = {};
  if (!D || !lk) return out;
  const part = (it, id, pt) => ({ id, file: `ai/meta/wear/fit/${id}_${wearWidth(it, D, T.A.sizes)}.png`, ax: it.anchor[0], ay: it.anchor[1], x: pt.x + (it.dx || 0), y: pt.y + (it.dy || 0) });
  const hid = lk.hat && !BLOCKED.has('hat:' + lk.hat) && 'hat_' + lk.hat, hi = hid && T.I.items[hid];   /* 잠긴 꾸미기는 몸에 안 그림 (11/14) */
  if (hi) {
    out.hat = part(hi, hid, D.head);
    out.hat.heads = hi.cover && D.cover ? { head: `${D.cover}.png`, head_blink: `${D.cover}_blink.png`, head_breath: `${D.cover}_breath.png` } : null;
    out.hat.mask = key !== art;
    out.hat.skull = D.cover ? `${D.cover}.png` : null;
    out.hat.eye = EYES[key] || null;
    out.hat.src = hi.src || null;
    out.hat.hole = hi.hole !== false;
    const sd = T.S?.[lk.hat];   /* 머리에 씌운 채 새로 그린 옆모습 그림 (hat_side.json) — 있으면 이것을 쓴다 (옛 그림 파일은 그대로) */
    if (sd?.file) {
      out.hat.src = `ai/meta/${sd.file}`; out.hat.hole = false;
      if ([sd.fx, sd.fy, sd.fsw].every((v) => typeof v === 'number')) out.hat.side = { x: sd.fx, y: sd.fy, sw: sd.fsw };   /* 시트에서 다시 잰 «진짜 머리 상자» 기준 값 (hat_side.json _fit_note) */
    }
  }
  const nid = lk.neck && !BLOCKED.has('neck:' + lk.neck) && 'neck_' + lk.neck, ni = nid && T.I.items[nid];
  if (ni) { out.neck = part(ni, nid, ni.layer === 'back' ? D.back : D.neck); out.neck.layer = ni.layer === 'back' ? 'back' : 'front'; }
  return out;
}

/* ───────── 모자 씌우기 (픽셀 = { w, h, d: RGBA }) ───────── */

/** 속이 빈 띠 모자 — 머리 뒤 층에 그리고 아랫단을 머리 윗면으로 가린다 */
export const BEHIND = new Set(['hat_crown', 'hat_gemtiara', 'hat_starcrown', 'hat_stormcrown', 'hat_flamecrown', 'hat_cometcrown']);   // 은하 달 왕관(moonstar)은 작아서 뒤에 두면 뾰족만 보여 앞 층
const HIDE = 0.3;   // 띠 모자 아랫단이 머리에 가려지는 몫 (정면 그림)
/** 옆모습으로 새로 그린 모자(11/14 대표님 · 제미나이 hat_crown_side.png) : 아랫단이 두개골 윗면에 앉고 머리가 밑단 아래 몇 칸만 가린다 · 그림이 이미 기울어 있어(노바트 머리 기준)
 *  추가로 기울이는 각 = 이 용 두개골 기울기 − PRE_TILT (라디안) */
const SEAT_PX = { hat_crown: 3 };
const PRE_TILT = { hat_crown: 0.061 };
const SIDE_TILT = 0.061;
/** 대장 용 눈 상자 [x0, y0, x1, y1] (머리 그림 칸 · 뿔 지운 모자용 머리도 같은 자리) — 모자가 눈을 덮으면 그만큼 올린다 (11/14 · 머리 그림 격자로 잼 · 색 바꾼 모습도 같음) */
const EYES = {
  novart: [21, 19, 29, 28], aquantis: [21, 18, 29, 26], forestia: [21, 18, 28, 26], crimsonde: [27, 14, 33, 21], volttail: [20, 14, 26, 21],
  solaris: [21, 20, 28, 27], sandscale: [19, 12, 26, 19], shadowfen: [21, 16, 26, 21], frostwing: [20, 17, 28, 25], goldrex: [20, 20, 27, 28],
};
const EYE_LIFT_MAX = 12;   // 눈 때문에 올리는 최대 칸 (그 이상이면 그대로 두고 표로 보고)   // 옆모습 모자 마네킹(노바트) 두개골 기울기 — 이 용과 차이만큼만 기울인다
/** 모자 종류별 폭 배율 (두개골 윗부분 폭 × 이 값) — 없으면 HAT_K_DEF · 사진 대조로 맞춘 값 (11/14) */
export const HAT_K_DEF = 0.92;
export const HAT_K = {
  hat_crown: 0.95, hat_gemtiara: 0.9, hat_starcrown: 0.88, hat_stormcrown: 0.9, hat_flamecrown: 0.88, hat_cometcrown: 0.9, hat_moonstar: 0.88,
  hat_party: 0.62, hat_wizard: 0.85, hat_witchhat: 0.9, hat_lavacone: 0.85, hat_drillhat: 0.85, hat_phoenixcrest: 0.7, hat_moonhelm: 0.78,
  hat_pirate: 1.0, hat_helmet: 1.0, hat_viking: 0.98, hat_aviator: 1.0, hat_earmuff: 1.02, hat_pharaoh: 1.02, hat_turban: 0.9, hat_jewelhelm: 0.98,
  hat_minerhelm: 0.98, hat_crystalcap: 0.95, hat_nightcap: 0.95, hat_acorn: 0.95, hat_pumpkin: 0.92, hat_ribbon: 0.85, hat_lilypad: 0.95,
};
const HAT_MIN = 22;
const EYE = 0.22;   // 앞 층 모자 밑동이 내려갈 수 있는 한계 = 두개골 윗면 + 머리 키 × 이 값 (눈 높은 용 · 샌드스케일 기준)
const TILT_MAX = (15 * Math.PI) / 180;

/** 구멍이 파이지 않은 «어두운 속»(밑동 안쪽 갈색 · 남색)을 가진 모자 — 이것만 어두운 속도 구멍으로 본다 (호박 입 같은 무늬를 구멍으로 잘못 보지 않게) */
const INNER = new Set(['hat_crown', 'hat_nightcap']);
const ON = 128;
const lumAt = (d, i) => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;

/** 붙어 있는 칸 덩어리 (상하좌우) */
function blobs(w, h, on) {
  const N = w * h, seen = new Uint8Array(N), out = [];
  for (let s = 0; s < N; s++) {
    if (!on[s] || seen[s]) continue;
    const st = [s], px = []; seen[s] = 1;
    let x0 = w, x1 = -1, y0 = h, y1 = -1, sy = 0;
    while (st.length) {
      const c = st.pop(), x = c % w, y = (c - x) / w; px.push(c); sy += y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const nb = [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1];
      for (const n of nb) if (n >= 0 && on[n] && !seen[n]) { seen[n] = 1; st.push(n); }
    }
    out.push({ px, x0, x1, y0, y1, my: sy / px.length });
  }
  return out;
}

/** 모자 «속»(머리가 들어갈 자리) 칸 표시 — 없으면 null. ① 굽기 때 뚫은 아래쪽 구멍 ② INNER 모자의 어두운 속 */
function hatInner(id, P) {
  const { w, h, d } = P, N = w * h, op = new Uint8Array(N), tr = new Uint8Array(N);
  let n = 0, X0 = w, X1 = -1;
  for (let i = 0; i < N; i++) { if (d[i * 4 + 3] >= ON) { op[i] = 1; n++; const x = i % w; if (x < X0) X0 = x; if (x > X1) X1 = x; } else tr[i] = 1; }
  if (n < 10) return null;
  const span = X1 - X0 + 1, m = new Uint8Array(N);
  let any = false;
  for (const b of blobs(w, h, tr)) {   /* 가장자리에 안 닿은(갇힌) 투명 덩어리 · 아래쪽 · 넓은 것 = 굽기 때 뚫은 머리 구멍 */
    if (b.y0 === 0 || b.x0 === 0 || b.y1 === h - 1 || b.x1 === w - 1) continue;
    if (b.px.length < n * 0.03 || b.my < h * 0.45 || b.x1 - b.x0 + 1 < span * 0.35) continue;
    for (const c of b.px) m[c] = 1;
    any = true;
  }
  if (INNER.has(id)) {   /* 밝은 띠(상위 25% 밝기)의 절반보다 어두운 칸 · 아래 절반 · 넓고 · 양옆과 밑에 금테가 남는 덩어리 */
    const L = [];
    for (let i = 0; i < N; i++) if (op[i]) L.push(lumAt(d, i * 4));
    L.sort((a, b) => a - b);
    const ref = L[Math.floor((L.length - 1) * 0.75)], cand = new Uint8Array(N), y0 = Math.floor(h * 0.5);
    for (let i = y0 * w; i < N; i++) if (op[i] && lumAt(d, i * 4) < ref * 0.5) cand[i] = 1;
    for (const b of blobs(w, h, cand)) {
      if (b.px.length < n * 0.04 || b.x1 - b.x0 + 1 < span * 0.35 || b.x0 <= X0 || b.x1 >= X1) continue;
      const cx = (b.x0 + b.x1) >> 1;
      let rim = false;
      for (let y = b.y1 + 1; y < h && !rim; y++) { const i = y * w + cx; if (op[i] && !cand[i]) rim = true; }
      if (!rim) continue;
      for (const c of b.px) m[c] = 1;
      any = true;
    }
  }
  return any ? m : null;
}

/**
 * 두개골 { top[x]: 열마다 윗면(가시 걷어낸 것 · 없으면 −1) · raw[x]: 열마다 실제 윗면(그려지는 그대로 · 세로 자리용), hb: 맨 아랫줄, t: 맨 윗줄, x0 · x1: 윗부분 가로 범위, cx: 모자 가운데, rot: 기울기(라디안) } · 못 재면 null
 * (머리말 규칙) — 같은 픽셀이면 한 번만 잰다
 */
const boxMemo = new WeakMap();
export function skullBox(S) {
  if (!S?.d) return null;
  if (boxMemo.has(S)) return boxMemo.get(S);
  const { w, h, d } = S, N = w * h, m = new Uint8Array(N), r = 2;
  let X0 = w, X1 = -1, hb = -1;
  for (let i = 0; i < N; i++) if (d[i * 4 + 3] >= ON) { m[i] = 1; const x = i % w; if (x < X0) X0 = x; if (x > X1) X1 = x; hb = (i - x) / w; }
  let out = null;
  if (X1 >= 0) {
    const pass = (src, cut, horiz) => {   /* 가로 · 세로 r칸 : cut = 깎기(하나라도 비면 빔) · 아니면 불리기(하나라도 차면 참) */
      const o = new Uint8Array(N);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let v = cut ? 1 : 0;
        for (let k = -r; k <= r; k++) {
          const xx = horiz ? x + k : x, yy = horiz ? y : y + k;
          const b = xx < 0 || xx >= w || yy < 0 || yy >= h ? 0 : src[yy * w + xx];
          if (cut ? !b : b) { v = cut ? 0 : 1; break; }
        }
        o[y * w + x] = v;
      }
      return o;
    };
    const op = pass(pass(pass(pass(m, true, true), true, false), false, true), false, false);
    for (let i = 0; i < N; i++) op[i] &= m[i];
    const top = new Array(w).fill(-1), raw = new Array(w).fill(-1);
    for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) { if (op[y * w + x]) top[x] = y; if (m[y * w + x]) raw[x] = y; }
    let t = h;
    for (const v of top) if (v >= 0 && v < t) t = v;
    if (t < h) {
      let x0 = w, x1 = -1;
      for (let x = 0; x < w; x++) if (top[x] >= 0 && top[x] <= t + 5) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
      const maxW = Math.round((X1 - X0 + 1) * 0.72);
      if (x1 - x0 + 1 > maxW) x0 = x1 - maxW + 1;   /* 대장 용은 모두 오른쪽을 본다 → 이마 쪽(오른쪽) 끝 기준 */
      let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;   /* 윗면 기울기 = 범위 안 윗면 점들의 직선 맞춤 */
      for (let x = x0; x <= x1; x++) if (top[x] >= 0) { n++; sx += x; sy += top[x]; sxx += x * x; sxy += x * top[x]; }
      const den = n * sxx - sx * sx, k = n > 3 && den ? (n * sxy - sx * sy) / den : 0;
      out = { top, raw, hb, t, X1, x0, x1, cx: (x0 + x1 + 1) / 2 + 1, rot: Math.max(-TILT_MAX, Math.min(TILT_MAX, Math.atan(k))) };
    }
  }
  boxMemo.set(S, out);
  return out;
}
/** 그림의 불투명 상자 { x0, y0, x1, y1, w } | null */
const bboxMemo = new WeakMap();
export function opaqueBox(P) {
  if (!P?.d) return null;
  if (bboxMemo.has(P)) return bboxMemo.get(P);
  let x0 = P.w, y0 = P.h, x1 = -1, y1 = -1;
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (P.d[(y * P.w + x) * 4 + 3] >= ON) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const b = x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1 };
  bboxMemo.set(P, b);
  return b;
}
/** 옆모습 모자 마네킹(노바트 머리)에서 두개골 윗면이 머리 상자 위에서 머리 폭의 몇 배 아래에 있나 (노바트 head 45 폭 · 모자용 머리 윗면 11 → 11/45) */
const MANNE_SKULL = 0.244;
/** 이 모자의 폭(칸) — 옆모습 모자 = 마네킹 폭 비(sw) × 그 용 «뿔 포함 머리 상자» 폭 · 나머지 = 두개골 윗부분 폭 × HAT_K · 못 재면 null(예비 그림 폭 그대로) */
export function hatWidth(e, skull, full = null) {
  const fb = e.side && opaqueBox(full);
  if (fb) return Math.max(8, Math.round(e.side.sw * fb.w));
  const b = skullBox(skull);
  return b ? Math.max(HAT_MIN, Math.round((b.x1 - b.x0 + 1) * (HAT_K[e.id] ?? HAT_K_DEF))) : null;
}

const median = (v) => { const s = [...v].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

/**
 * 모자를 머리에 «씌우는» 자리 (머리말 규칙)
 *  e = wearPlan(...).hat · hat = 모자 그림 픽셀(hatWidth 폭으로 굽은 것) · head = 지금 그리는 머리 그림 픽셀 · skull = 두개골 모양(모자용 머리) 픽셀(없으면 head)
 *  ha = 머리 그림 붙는 점 비율 [ax, ay]
 *  → { x, y, rot, behind, cut }  x · y = 머리 붙는 점(0,0) 기준 모자 왼쪽 위(기울이기 전 · 머리 그림 칸과 딱 맞게) · rot = 아랫단 가운데를 축으로 기울일 각(라디안)
 *     behind = 머리 뒤 층에 그린다 · cut = 지울 모자 칸(앞 층 모자의 속 중 머리 위 칸) Uint8Array | null
 *  픽셀을 못 읽으면 예전 표 자리 그대로.
 */
export function hatFit(e, hat, head, skull, ha, full = null) {
  const fall = { x: Math.round(e.x - e.ax * (hat?.w || 0)), y: Math.round(e.y - e.ay * (hat?.h || 0)), rot: 0, behind: false, cut: null };
  if (!hat?.d || !head?.d || !ha) return fall;
  const S = skull?.d && skull.w === head.w && skull.h === head.h ? skull : head, B = skullBox(S);
  if (!B) return fall;
  const fb = e.side && opaqueBox(full && full.w === head.w && full.h === head.h ? full : head);
  if (fb) {   /* 옆모습 모자 : 마네킹 머리 상자 → 이 용 «뿔 포함 머리 상자» (가로 폭 배율) · 세로는 두개골 윗면 기준으로 보정 · 머리 위에 덮어 그림 */
    const { x, y } = e.side, Wd = fb.w;
    const ix = Math.round(fb.x0 + x * Wd);
    let oy = Math.round(B.t + (y - MANNE_SKULL) * Wd);
    if (e.eye) {   /* 눈 상자(맨 윗줄 = 눈꺼풀은 봐줌) 안에 모자 칸이 하나도 없을 때까지 올린다 (최대 EYE_LIFT_MAX · 못 비우면 가장 적게 덮는 높이) */
      const [ex0, ey0, ex1, ey1] = e.eye;
      const over = (o) => { let n = 0; for (let gx = ex0; gx <= ex1; gx++) for (let gy = ey0 + 1; gy <= ey1; gy++) { const hx = gx - ix, hy = gy - o; if (hx >= 0 && hx < hat.w && hy >= 0 && hy < hat.h && hat.d[(hy * hat.w + hx) * 4 + 3] >= ON) n++; } return n; };
      let best = oy, bn = over(oy);
      for (let l = 1; l <= EYE_LIFT_MAX && bn > 0; l++) { const n = over(oy - l); if (n < bn) { bn = n; best = oy - l; } }
      oy = best;
    }
    return { x: ix - ha[0] * head.w, y: oy - ha[1] * head.h, rot: Math.max(-TILT_MAX, Math.min(TILT_MAX, B.rot - SIDE_TILT)), behind: false, cut: null };
  }
  const { w, h, d } = hat, W = head.w, H = head.h, top = B.raw;   /* 세로는 실제로 그려지는 윗면 (가는 볏이 모자를 가리는 몫까지 맞게) */
  const rot = Math.max(-TILT_MAX, Math.min(TILT_MAX, B.rot - (PRE_TILT[e.id] || 0)));
  /* 가로 : 두개골 윗부분 가운데 — 단, 볏이 두껍게 남은 용(볼트테일)은 윗부분이 뒤통수로 잡히므로 «목 붙는 점 → 이마 끝 30%» 어림값 근처(−1 ~ +3.5칸)로 붙잡는다 */
  const est = ha[0] * W + 0.3 * (B.X1 + 1 - ha[0] * W), cx = Math.max(est - 1, Math.min(est + 3.5, B.cx));
  const ix = Math.round(cx - w / 2), out = (oy, cut, behind) => ({ x: ix - ha[0] * W, y: oy - ha[1] * H, rot, behind, cut });
  const skullAt = (c) => { const gx = ix + c; return gx >= 0 && gx < W ? top[gx] : -1; };
  const cc = w >> 1, tc = skullAt(cc) >= 0 ? skullAt(cc) : B.t;
  const hop = (x, y) => d[(y * w + x) * 4 + 3] >= ON;
  const colTop = (f, c) => { for (let y = 0; y < h; y++) if (f(c, y)) return y; return -1; };
  const colBot = (f, c) => { for (let y = h - 1; y >= 0; y--) if (f(c, y)) return y; return -1; };
  if (BEHIND.has(e.id) && e.heads) {   /* 띠 모자(뿔 · 볏을 지운 모자용 머리를 쓸 때만 — 뿔이 남은 머리 뒤에 두면 뿔에 가려 안 보인다) : 머리 뒤 층 · 열마다 «모자 밑단 − 두개골 윗면» 을 맞춰(기운 그림도) 밑단이 머리에 hide 칸 가려지게 */
    const hide = SEAT_PX[e.id] ?? Math.round(HIDE * h), v = [];
    for (let c = Math.trunc(w * 0.2); c <= Math.trunc(w * 0.8); c++) { const t = skullAt(c), b = colBot(hop, c); if (t >= 0 && b >= 0) v.push(t + hide - b); }
    v.sort((a, b) => a - b);   /* 35% 지점 = 높은 쪽 윗면 기준 — 두꺼운 볏(볼트테일)이 왕관을 너무 가리지 않게 */
    return out(v.length ? v[Math.floor((v.length - 1) * 0.35)] : Math.round(tc + hide) - h, null, true);
  }
  let m = hatInner(e.id, hat);
  const vals = [];
  if (m) {
    const inn = (x, y) => m[y * w + x] === 1;
    let c0 = w, c1 = -1, r0 = h, r1 = -1;
    for (let i = 0; i < w * h; i++) if (m[i]) { const x = i % w, y = (i - x) / w; if (x < c0) c0 = x; if (x > c1) c1 = x; if (y < r0) r0 = y; if (y > r1) r1 = y; }
    const extra = Math.max(2, Math.round(0.4 * (r1 - r0 + 1))), k = (c1 - c0) * 0.2;
    for (let c = Math.trunc(c0 + k); c <= Math.trunc(c1 - k); c++) { const t = skullAt(c), it = colTop(inn, c); if (t >= 0 && it >= 0) vals.push(t - it + extra); }
  }
  if (!vals.length) {
    m = null;
    const depth = Math.min(6, Math.max(3, Math.round(h * 0.16)));
    for (let c = Math.trunc(w * 0.25); c <= Math.trunc(w * 0.75); c++) { const t = skullAt(c), b = colBot(hop, c); if (t >= 0 && b >= 0) vals.push(t + depth - b); }
  }
  if (!vals.length) return out(Math.round(tc + 4) - h, null, false);
  let oy = Math.round(median(vals));
  const bc = colBot(hop, cc);
  if (bc >= 0) { const lim = tc + Math.round(EYE * (B.hb - tc + 1)); if (oy + bc > lim) oy = lim - bc; }   /* 눈을 가리지 않게 */
  let cut = null;
  if (m) {
    for (let i = 0; i < w * h; i++) {
      if (!m[i]) continue;
      const x = i % w, y = (i - x) / w, gx = ix + x, gy = oy + y;
      if (gx >= 0 && gx < W && gy >= 0 && gy < H && head.d[(gy * W + gx) * 4 + 3] >= ON) (cut ||= new Uint8Array(w * h))[i] = 1;
    }
  }
  return out(oy, cut, false);
}

/* ───────── 캔버스 도우미 (브라우저 전용 · 2D 그림 · Pixi 둘 다) ───────── */

/** 그림(img · canvas · ImageBitmap)의 픽셀 — 못 읽으면 null */
export function pixOf(src) {
  try {
    const w = src?.naturalWidth || src?.width, h = src?.naturalHeight || src?.height;
    if (!w || !h || typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0);
    return { w, h, d: g.getImageData(0, 0, w, h).data };
  } catch { return null; }
}
/** 픽셀 → 캔버스 (cut 칸은 투명으로) */
export function pixCanvas(P, cut = null) {
  const c = document.createElement('canvas'); c.width = P.w; c.height = P.h;
  const g = c.getContext('2d'), im = g.createImageData(P.w, P.h);
  im.data.set(P.d);
  if (cut) for (let i = 0; i < cut.length; i++) if (cut[i]) im.data[i * 4 + 3] = 0;
  g.putImageData(im, 0, 0);
  return c;
}
/** 색 바꾼 모습의 «모자용 머리» : 자기 머리 그림에서 모자용 머리 모양 밖(뿔 · 볏)만 지운다 — 크기가 다르면 null */
export function maskedHead(own, shape) {
  if (!own?.d || !shape?.d || own.w !== shape.w || own.h !== shape.h) return null;
  const d = new Uint8ClampedArray(own.d);
  for (let i = 3; i < d.length; i += 4) if (shape.d[i] < ON) d[i - 3] = d[i - 2] = d[i - 1] = d[i] = 0;
  return pixCanvas({ w: own.w, h: own.h, d });
}

/* ───────── 모자 그림 굽기 (tools/idg-wear-bake.mjs 와 같은 방법을 그 자리에서 · 폭이 용마다 달라서) ───────── */

/** 모자 속 «머리가 들어가는 어두운 구멍»을 투명으로 (굽기 도구 punchHole 그대로) */
function punchHole(buf, w, h) {
  const R = Math.max(2, Math.round(w / 40)), N = w * h, DARK = 62;
  const dark = new Uint8Array(N);
  for (let i = 0; i < N; i++) dark[i] = buf[i * 4 + 3] > 200 && buf[i * 4] * 0.3 + buf[i * 4 + 1] * 0.59 + buf[i * 4 + 2] * 0.11 < DARK ? 1 : 0;
  const box = (src, min) => {
    const t = new Uint8Array(N), o = new Uint8Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = min ? 1 : 0; for (let k = -R; k <= R; k++) { const xx = x + k, b = xx < 0 || xx >= w ? 0 : src[y * w + xx]; v = min ? v & b : v | b; } t[y * w + x] = v; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = min ? 1 : 0; for (let k = -R; k <= R; k++) { const yy = y + k, b = yy < 0 || yy >= h ? 0 : t[yy * w + x]; v = min ? v & b : v | b; } o[y * w + x] = v; }
    return o;
  };
  const core = box(dark, true), seen = new Uint8Array(N);
  let best = null;
  for (let s = 0; s < N; s++) {
    if (!core[s] || seen[s]) continue;
    const q = [s], px = []; seen[s] = 1;
    let area = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    while (q.length) {
      const c = q.pop(), x = c % w, y = (c / w) | 0; px.push(c); area++;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const n of [c - 1, c + 1, c - w, c + w]) if (n >= 0 && n < N && core[n] && !seen[n] && !(Math.abs((n % w) - x) > 1)) { seen[n] = 1; q.push(n); }
    }
    if (area < N * 0.03 || (y0 + y1) / 2 < h * 0.5 || x0 <= 1 || x1 >= w - 2 || y0 <= 1) continue;
    if (!best || area > best.area) best = { area, px };
  }
  if (!best) return;
  const hole = new Uint8Array(N);
  for (const c of best.px) hole[c] = 1;
  const grown = box(hole, false);
  for (let i = 0; i < N; i++) if (grown[i] && dark[i]) buf[i * 4 + 3] = 0;
}
const baked = new WeakMap();   // 원본 픽셀 → { 폭: 픽셀 }
/** 상점 원본 모자 그림 픽셀 → 폭 w 칸으로 줄인 픽셀 (투명 가장자리 자르기 · 머리 구멍 · 반투명 없앰) — 못 하면 null */
export function bakeHat(src, w, hole) {
  if (!src?.d || !w || typeof document === 'undefined') return null;
  let memo = baked.get(src);
  if (!memo) baked.set(src, (memo = {}));
  const key = `${w}${hole ? 'h' : ''}`;
  if (key in memo) return memo[key];
  let out = null;
  try {
    const { w: W, h: H, d } = src;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 >= 0) {
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1, buf = new Uint8ClampedArray(cw * ch * 4);
      for (let y = 0; y < ch; y++) buf.set(d.subarray(((y0 + y) * W + x0) * 4, ((y0 + y) * W + x0 + cw) * 4), y * cw * 4);
      if (hole) punchHole(buf, cw, ch);
      const h = Math.max(1, Math.round((ch * w) / cw));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(pixCanvas({ w: cw, h: ch, d: buf }), 0, 0, w, h);
      const r = g.getImageData(0, 0, w, h).data;
      for (let i = 0; i < r.length; i += 4) { if (r[i + 3] < 120) r[i] = r[i + 1] = r[i + 2] = r[i + 3] = 0; else r[i + 3] = 255; }
      out = { w, h, d: r };
    }
  } catch { out = null; }
  memo[key] = out;
  return out;
}
