/**
 * 꾸민 리더 드래곤 한 장 (2026-11-11 대표님 «로비 프로필에 내가 꾸민 드래곤 — 왕관을 썼으면 왕관, 목도리를 골랐으면 목도리»)
 *
 * 전투의 성 위 리더(battleView wear · wearRig)와 같은 자료(ai/meta/wear.json)로 캔버스에 겹쳐 그린다 (도트 그대로 · 확대 K).
 *  - 덮는 모자 : 그 용의 머리 그림을 «모자용 머리»(뿔 · 볏 지운 것)로 바꾸고 모자를 머리 기준 (x, y) 에
 *  - 목 장식 : behind = 몸통 뒤(목덜미 nape) · split = 뒤 조각은 몸통 뒤 · 앞 조각은 몸통 위 · 기준점 anchor
 * 로비 상태판(세로)과 가로 로비 «리더 무대»가 함께 쓴다.
 */
import { decodeLook } from '../games/iandragon_game/data/looks.js';

const BASE = '/assets/iandragon_game/';
const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
let wearP = null;
const wearJson = () => (wearP ||= fetch(`${BASE}ai/meta/wear.json`).then((r) => r.json()).catch(() => null));

/** art = 리더 id · lookStr = 저장 글자('h3.n1…') · K = 확대 · W×H = 캔버스 크기 */
export async function dressedCanvas(art, lookStr = '', { K = 1.7, W = 300, H = 250 } = {}) {
  const lk = decodeLook(lookStr || '');
  const [rig, Wr] = await Promise.all([fetch(`${BASE}ai/${art}/rig.json`).then((r) => r.json()), wearJson()]);
  const L = Wr?.leaders?.[art], hk = lk.hat && `hat_${lk.hat}`, nk = lk.neck && `neck_${lk.neck}`;
  const hatE = hk && Wr?.items?.[hk] && L?.hat?.[hk] ? L.hat[hk] : null, neckI = nk && Wr?.items?.[nk] && L ? Wr.items[nk] : null;
  const src = (n) => (hatE?.head?.[n] ? BASE + hatE.head[n] : `${BASE}ai/${art}/${n}.png`);   /* 덮는 모자 → 모자용 머리 */
  const parts = await Promise.all(rig.parts.map((q) => img(src(q.n))));
  const [hatImg, neckFront, neckBack] = await Promise.all([
    hatE ? img(BASE + Wr.items[hk].file) : null,
    neckI ? img(BASE + (neckI.layer === 'split' ? neckI.files.front : neckI.layer === 'behind' ? '' : neckI.file)) : null,
    neckI && (neckI.layer === 'split' || neckI.layer === 'behind') ? img(BASE + (neckI.layer === 'split' ? neckI.files.back : neckI.file)) : null,
  ]);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.translate(W / 2, H - 14); x.scale(K, K); if (rig.face === -1) x.scale(-1, 1);
  const at = neckI ? (neckI.layer === 'behind' ? L.nape : L.neck) : null;
  const neckAt = (im, tp) => { if (!im || !at) return; x.drawImage(im, tp[0] + at.x - neckI.anchor[0] * im.width, tp[1] + at.y - neckI.anchor[1] * im.height); };
  rig.parts.forEach((q, k) => {
    const im = parts[k];
    if (q.n === 'torso') neckAt(neckBack, q.p);   /* 몸통 뒤 조각 */
    if (im) { x.save(); x.translate(q.p[0], q.p[1]); if (q.flip) x.scale(-1, 1); x.drawImage(im, -q.a[0] * im.width, -q.a[1] * im.height); x.restore(); }
    if (q.n === 'torso' && neckI?.layer !== 'behind') neckAt(neckFront, q.p);   /* 몸통 위 조각 */
    if (q.n === 'head' && hatImg) x.drawImage(hatImg, q.p[0] + hatE.x, q.p[1] + hatE.y);   /* 모자 (머리 기준) */
  });
  return c;
}
