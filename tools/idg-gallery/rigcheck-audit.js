/**
 * 조립 점검 — 자동 검사 (브라우저판 · tools/idg-rigcheck.mjs audit 과 같은 규칙)
 *  · 팔이 턱 · 머리보다 나중에(앞에) 그려져 얼굴을 가림
 *  · 머리 · 턱이 몸통보다 먼저(뒤에) 그려져 묻힘
 *  · 턱이 머리보다 뒤쪽 · 위쪽 (얼굴 밖으로 안 나옴)
 *  · 다리가 아래로 갈수록 모임 (A자)
 *  · 발밑이 땅에서 뜸 · 몸통에서 떨어진 부품
 * 정지 자세(움직임 0) 기준. 최종 판정은 사람이 화면을 보고 한다.
 */
const pix = new Map();
async function alphaOf(url) {
  if (!pix.has(url)) pix.set(url, new Promise((ok, no) => {
    const im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); ok({ w: im.width, h: im.height, d: g.getImageData(0, 0, im.width, im.height).data }); };
    im.onerror = no; im.src = url;
  }));
  return pix.get(url);
}

/** rig(보정 적용 뒤) 의 부품마다 화면 점 목록 (발밑 가운데 = 0,0) */
export async function layoutOf(rig, urlOf) {
  const out = [];
  for (const p of rig.parts) {
    let A; try { A = await alphaOf(urlOf(p)); } catch { continue; }
    const ax = p.flip ? 1 - p.a[0] : p.a[0], x0 = p.p[0] - ax * A.w, y0 = p.p[1] - p.a[1] * A.h, pts = [];
    for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) if (A.d[(y * A.w + x) * 4 + 3] > 128) pts.push([x0 + (p.flip ? A.w - 1 - x : x), y0 + y]);
    out.push({ n: p.n, w: A.w, h: A.h, x0, y0, pts, hidden: p.hidden });
  }
  return out;
}

export async function auditRig(rig, urlOf) {
  const L = (await layoutOf(rig, urlOf)).filter((l) => !l.hidden), at = (n) => L.findIndex((l) => l.n === n), get = (n) => L[at(n)];
  const key = ([x, y]) => (x | 0) + ',' + (y | 0);
  const overlap = (a, b) => { const s = new Set(get(b).pts.map(key)); return get(a).pts.filter((q) => s.has(key(q))).length; };
  const W = [], face = rig.face || 1;
  for (const arm of ['arm_f', 'arm_b']) for (const fc of ['jaw', 'head']) {
    if (at(arm) < 0 || at(fc) < 0 || at(arm) < at(fc)) continue;
    const o = overlap(arm, fc); if (o > 20) W.push({ lv: 'bad', parts: [arm, fc], t: `${arm} 가 ${fc} 앞에 그려져 ${o}px 를 가림` });
  }
  for (const fc of ['head', 'jaw']) if (at(fc) >= 0 && at('torso') > at(fc)) { const o = overlap('torso', fc); if (o > 40) W.push({ lv: 'bad', parts: [fc, 'torso'], t: `${fc} 가 몸통 뒤에 깔려 ${o}px 묻힘` }); }
  if (get('jaw') && get('head')) {
    const cx = (n) => get(n).pts.reduce((s, [x]) => s + x, 0) / Math.max(1, get(n).pts.length);
    if ((cx('jaw') - cx('head')) * face < -4) W.push({ lv: 'bad', parts: ['jaw', 'head'], t: `턱이 머리보다 뒤쪽 (${Math.round(cx('jaw') - cx('head'))}px)` });
    const by = (n) => Math.max(...get(n).pts.map(([, y]) => y));
    if (by('jaw') < by('head') - 2) W.push({ lv: 'warn', parts: ['jaw', 'head'], t: `턱 아래끝이 머리 아래끝보다 위 — 턱이 안 보임` });
  }
  const lf = get('leg_f'), lb = get('leg_b');
  if (lf && lb) {
    const band = (l, top) => { const ys = l.pts.map(([, y]) => y), lo = top ? Math.min(...ys) : Math.max(...ys) - 6, hi = top ? lo + 6 : Math.max(...ys); const b = l.pts.filter(([, y]) => y >= lo && y <= hi); return b.reduce((s, [x]) => s + x, 0) / Math.max(1, b.length); };
    const hip = (band(lf, true) - band(lb, true)) * face, foot = (band(lf, false) - band(lb, false)) * face;
    if (foot < hip - 6) W.push({ lv: foot < hip - 10 ? 'bad' : 'warn', parts: ['leg_f', 'leg_b'], t: `다리가 아래로 갈수록 모임 (엉덩이 간격 ${Math.round(hip)} → 발 간격 ${Math.round(foot)}) — A자` });
    const feet = Math.max(...lf.pts.map(([, y]) => y), ...lb.pts.map(([, y]) => y));
    if (Math.abs(feet + 0.5) > 3) W.push({ lv: 'warn', parts: ['leg_f', 'leg_b'], t: `발밑이 땅에서 ${Math.round(-feet)}px ${feet < 0 ? '뜸' : '파묻힘'}` });
  }
  const t = get('torso');
  if (t) for (const l of L) {
    if (l.n === 'torso' || /wing|tail|hat|rider|saddle/.test(l.n)) continue;
    if (!l.pts.some(([x, y]) => x >= t.x0 - 2 && x <= t.x0 + t.w + 2 && y >= t.y0 - 6 && y <= t.y0 + t.h + 2)) W.push({ lv: 'warn', parts: [l.n], t: `${l.n} 가 몸통에서 떨어져 있음` });
  }
  return W;
}
