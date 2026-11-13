/**
 * 꾸민 리더 드래곤 한 장 (2026-11-11 대표님 «로비 프로필에 내가 꾸민 드래곤 — 왕관을 썼으면 왕관, 목도리를 골랐으면 목도리»)
 *
 * 전투의 성 위 리더(battleView wear · wearRig)와 같은 계획(render/wearPlan.js · ai/meta/wear_anchor.json · wear_items.json)으로 캔버스에 겹쳐 그린다 (도트 그대로 · 확대 K).
 *  - 덮는 모자 : 그 용의 머리 그림을 «모자용 머리»(뿔 · 볏 지운 것)로 바꾸고 모자를 머리 부품 기준 붙는 점에
 *  - 목 장식 : front = 몸통 위 · back(망토) = 몸통 뒤 — 몸통 부품 기준 붙는 점에
 * 로비 상태판(세로)과 가로 로비 «리더 무대»가 함께 쓴다.
 */
import { decodeLook } from '../games/iandragon_game/data/looks.js';
import { applyRigFix, rigFixTable, rigJson } from '../games/iandragon_game/render/rig.js';
import { wearTables, wearPlan } from '../games/iandragon_game/render/wearPlan.js';

const BASE = '/assets/iandragon_game/';
/* 같은 그림은 한 번만 받는다 (로비가 세로 · 가로 프로필을 다시 그릴 때 · 11/12 속도) — 실패는 기억하지 않아 다음에 다시 시도 */
const imgs = new Map();
const img = (src) => {
  if (!imgs.has(src)) imgs.set(src, new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => { imgs.delete(src); ok(null); }; i.src = src; }));
  return imgs.get(src);
};

/** art = 리더 id · lookStr = 저장 글자('h3.n1…') · K = 확대 · W×H = 캔버스 크기 */
export async function dressedCanvas(art, lookStr = '', { K = 1.7, W = 300, H = 250, fit = false, pad = 4 } = {}) {
  const lk = decodeLook(lookStr || '');
  /* rig.json · wear_anchor.json · 자리 보정 표를 동시에 (11/12 속도) — rig.json 은 캐릭터마다 한 번만 받아 전투 · 로비가 같이 쓴다 (rig.js rigJson) */
  const [rig, T] = await Promise.all([rigJson(art), wearTables(), rigFixTable()]);
  const files = await applyRigFix(art, rig);   /* 날개 · 꼬리 자리 표 (전투와 같게) */
  const plan = wearPlan(art, lk, T);
  const src = (n) => (plan.hat?.heads?.[n] ? BASE + plan.hat.heads[n] : `${BASE}ai/${art}/${files[n] || n}.png`);   /* 덮는 모자 → 모자용 머리 */
  const parts = await Promise.all(rig.parts.map((q) => img(src(q.n))));
  const [hatImg, neckImg] = await Promise.all([plan.hat ? img(BASE + plan.hat.file) : null, plan.neck ? img(BASE + plan.neck.file) : null]);
  const spot = (e, im) => [Math.round(e.x - e.ax * im.width), Math.round(e.y - e.ay * im.height)];   /* 그림 왼쪽 위 = 붙는 점 − 그림 안 붙는 점 */
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  if (fit) {   /* 칸에 꼭 맞게 : 부품 · 모자 · 목 장식 전체 크기를 재서 가운데에 (뿔 · 날개 · 왕관이 잘리지 않게 · 대표님 11/11) */
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const add = (ax, ay, w, h) => { x0 = Math.min(x0, ax); y0 = Math.min(y0, ay); x1 = Math.max(x1, ax + w); y1 = Math.max(y1, ay + h); };
    rig.parts.forEach((q, k) => { const im = parts[k]; if (!im) return; const lx = q.flip ? q.p[0] - (1 - q.a[0]) * im.width : q.p[0] - q.a[0] * im.width; add(lx, q.p[1] - q.a[1] * im.height, im.width, im.height);
      if (q.n === 'head' && hatImg) { const [sx, sy] = spot(plan.hat, hatImg); add(q.p[0] + sx, q.p[1] + sy, hatImg.width, hatImg.height); }
      if (q.n === 'torso' && neckImg) { const [sx, sy] = spot(plan.neck, neckImg); add(q.p[0] + sx, q.p[1] + sy, neckImg.width, neckImg.height); } });
    const kk = Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    x.translate(W / 2, H / 2); x.scale(kk, kk); if (rig.face === -1) x.scale(-1, 1); x.translate(-cx, -cy);
  } else { x.translate(W / 2, H - 14); x.scale(K, K); if (rig.face === -1) x.scale(-1, 1); }
  const neckAt = (tp) => { if (!neckImg) return; const [sx, sy] = spot(plan.neck, neckImg); x.drawImage(neckImg, tp[0] + sx, tp[1] + sy); };
  rig.parts.forEach((q, k) => {
    const im = parts[k];
    if (q.n === 'torso' && plan.neck?.layer === 'back') neckAt(q.p);   /* 몸통 뒤 층 (망토) */
    if (im) { x.save(); x.translate(q.p[0], q.p[1]); if (q.flip) x.scale(-1, 1); x.drawImage(im, -q.a[0] * im.width, -q.a[1] * im.height); x.restore(); }
    if (q.n === 'torso' && plan.neck?.layer === 'front') neckAt(q.p);   /* 몸통 위 층 */
    if (q.n === 'head' && hatImg) { const [sx, sy] = spot(plan.hat, hatImg); x.drawImage(hatImg, q.p[0] + sx, q.p[1] + sy); }   /* 모자 (머리 기준) */
  });
  return c;
}

/**
 * 머리만 (명예의 전당 줄 얼굴 · 11/11 대표님 «왕관이 공중에 떠 있다 · 얼굴이 오른쪽 아래로 치우쳤다»)
 * 전투와 같은 자리표로 모자를 머리에 씌우고(덮는 모자 = 모자용 머리), 머리 + 모자 전체를 S×S 칸 가운데에 맞춰 그린다.
 */
export async function headCanvas(art, lookStr = '', S = 44) {
  const lk = decodeLook(lookStr || '');
  const [rig, T] = await Promise.all([rigJson(art), wearTables(), rigFixTable()]);
  const files = await applyRigFix(art, rig);
  const q = rig.parts.find((p) => p.n === 'head'), plan = wearPlan(art, lk, T), hatE = plan.hat;
  const [head, hat] = await Promise.all([img(hatE?.heads?.head ? BASE + hatE.heads.head : `${BASE}ai/${art}/${files.head || 'head'}.png`), hatE ? img(BASE + hatE.file) : null]);
  const c = document.createElement('canvas'); c.width = c.height = S * 2;
  if (!head) return c;
  const hx = -q.a[0] * head.width, hy = -q.a[1] * head.height;   /* 머리 기준점(목) = 0,0 */
  let x0 = hx, y0 = hy, x1 = hx + head.width, y1 = hy + head.height;
  const hx2 = hat ? Math.round(hatE.x - hatE.ax * hat.width) : 0, hy2 = hat ? Math.round(hatE.y - hatE.ay * hat.height) : 0;   /* 모자 왼쪽 위 (머리 기준) */
  if (hat) { x0 = Math.min(x0, hx2); y0 = Math.min(y0, hy2); x1 = Math.max(x1, hx2 + hat.width); y1 = Math.max(y1, hy2 + hat.height); }
  const k = Math.min((S * 2 - 4) / (x1 - x0), (S * 2 - 4) / (y1 - y0)), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.translate(S - ((x0 + x1) / 2) * k, S - ((y0 + y1) / 2) * k); x.scale(k, k);
  if (rig.face === -1) { x.scale(-1, 1); }
  x.drawImage(head, hx, hy); if (hat) x.drawImage(hat, hx2, hy2);
  return c;
}
