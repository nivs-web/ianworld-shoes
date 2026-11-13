/**
 * 그림 담당 — 조립 점검 (2026-11-12 · 대표님 «보스 조립이 피카소 그림 같다 · 턱 앞에 팔 · 순서 엉망 · 다리가 A자로 몰림 · 하나하나 점검하는 걸 만들어»)
 *
 *   node tools/idg-rigcheck.mjs ids                              점검 화면(tools/idg-gallery/rigcheck.html)이 읽는 캐릭터 목록을 만든다
 *   node tools/idg-rigcheck.mjs audit [id …]                      자동 검사 (턱 · 머리 앞의 팔 · 몸통 뒤에 묻힌 머리 · A자 다리 · 몸통에서 떨어진 부품)
 *   node tools/idg-rigcheck.mjs shot <출력.png> <before|after> <id> [--k 4] [--label]   조립 그림 한 장 (after = 보정 표 적용 · 게임 방향 = 좀비 왼쪽)
 *
 * 보정 표 = public/assets/iandragon_game/ai/meta/ 의 세 장을 겹친다 (rig.json 은 R2 1년 캐시라 덮어쓰지 않는다)
 *   rigfix.json (용 · 리더 날개 · 꼬리 자리 { id: { wing, tail, files } }) → rigfix_boss.json (보스) → rigfix_zombie.json (일반 좀비 · 용 몸통)
 *   → rigfix_dragon_v2.json (용 날개 방향 · 크기 배수 scale · 고친 그림 files · 11/12)
 *   { id: { order?: [부품 이름 …](뒤 → 앞), parts?: { 이름: { p?, a?, flip?, move? } }, files?: { 이름: '새 그림 이름' } } }
 * 규칙은 게임 render/rig.js 와 같다 : parts 순서 = 그리는 순서 · a = 그림 안 기준점 비율 · p = 발밑 가운데에서의 자리 · flip = 좌우 뒤집기.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const AI = path.join(ROOT, 'public/assets/iandragon_game/ai');
const IDS = path.join(ROOT, 'tools/idg-gallery/rigcheck-ids.json');
const readFix = (n) => { const f = path.join(AI, 'meta', n); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}; };

/** 날개 · 꼬리 표(rigfix.json)를 같은 꼴 { parts: { wing: { p } }, files } 로 바꾼다 */
export function wingTailFix(W = {}) {
  const out = {};
  for (const [id, v] of Object.entries(W)) {
    const F = (out[id] = {});
    for (const n of ['wing', 'tail']) if (v[n]) (F.parts ||= {})[n] = { p: v[n] };
    if (v.files) F.files = { ...v.files };
  }
  return out;
}

/** 여러 표를 캐릭터마다 겹친다 (뒤 표가 이긴다 · 부품은 키 단위로 합침) */
export function mergeFix(...tables) {
  const out = {};
  for (const T of tables) for (const [id, F] of Object.entries(T || {})) {
    const M = (out[id] ||= {});
    if (F.order) M.order = [...F.order];
    if (F.files) M.files = { ...M.files, ...F.files };
    if (typeof F.scale === 'number') M.scale = F.scale;
    for (const [n, d] of Object.entries(F.parts || {})) (M.parts ||= {})[n] = { ...M.parts?.[n], ...d };
  }
  return out;
}

export const fixTable = () => mergeFix(wingTailFix(readFix('rigfix.json')), readFix('rigfix_boss.json'), readFix('rigfix_zombie.json'), readFix('rigfix_dragon_v2.json'));
export const rigOf = (id) => JSON.parse(fs.readFileSync(path.join(AI, id, 'rig.json'), 'utf8'));

/** 점검 화면 rigcheck.js 의 applyFix 와 같은 규칙 */
export function applyFix(rig, F = {}) {
  let parts = rig.parts.map((p) => ({ ...p, file: p.n, ...(F.parts?.[p.n] || {}) }));
  for (const p of parts) if (F.files?.[p.n]) p.file = F.files[p.n];
  if (F.order) parts = [...F.order.map((n) => parts.find((p) => p.n === n)).filter(Boolean), ...parts.filter((p) => !F.order.includes(p.n))];
  return { ...rig, parts, ...(F.scale > 0 ? { scale: (rig.scale || 1) * F.scale } : {}) };
}

/** 부품마다 그림 크기 · 화면 상자 (발밑 가운데 = 0,0) */
async function layout(id, rig) {
  const out = [];
  for (const p of rig.parts) {
    const f = path.join(AI, id, p.file + '.png');
    if (!fs.existsSync(f)) continue;
    const m = await sharp(f).metadata();
    const ax = p.flip ? 1 - p.a[0] : p.a[0];
    out.push({ ...p, f, w: m.width, h: m.height, x0: p.p[0] - ax * m.width, y0: p.p[1] - p.a[1] * m.height });
  }
  return out;
}

/** 불투명 픽셀 → 화면 좌표 점 목록 (검사용) */
async function opaque(L) {
  let img = sharp(L.f).ensureAlpha(); if (L.flip) img = img.flop();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const pts = [];
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 128) pts.push([L.x0 + x, L.y0 + y]);
  return pts;
}

export async function render(id, mode = 'after', k = 4, label = false) {
  const rig = applyFix(rigOf(id), mode === 'after' ? fixTable()[id] : undefined);
  const L = await layout(id, rig);
  const minX = Math.floor(Math.min(...L.map((l) => l.x0))) - 6, maxX = Math.ceil(Math.max(...L.map((l) => l.x0 + l.w))) + 6;
  const minY = Math.floor(Math.min(...L.map((l) => l.y0))) - 6, maxY = Math.max(6, Math.ceil(Math.max(...L.map((l) => l.y0 + l.h))) + 6);
  const W = (maxX - minX) * k, H = (maxY - minY) * k + (label ? 30 : 0), top = label ? 30 : 0, comp = [];
  for (const l of L) {
    let img = sharp(l.f).resize(l.w * k, l.h * k, { kernel: 'nearest' }); if (l.flip) img = img.flop();
    comp.push({ input: await img.png().toBuffer(), left: Math.round((l.x0 - minX) * k), top: Math.round((l.y0 - minY) * k) + top });
  }
  const ground = `<line x1="0" x2="${W}" y1="${-minY * k + top}" y2="${-minY * k + top}" stroke="#ffb347" stroke-width="2" stroke-dasharray="6 6"/>`;
  const txt = label ? `<text x="8" y="22" font-size="20" font-family="Malgun Gothic,Arial" fill="#fff">${id} · ${mode === 'after' ? '고친 뒤' : '고치기 전'}</text>` : '';
  /* 게임 방향으로 (좀비 · 보스는 왼쪽 · 대표님 11/12 «무조건 왼쪽») — 그림 방향과 다르면 통째로 뒤집는다 */
  let pic = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 42, g: 33, b: 64, alpha: 1 } } }).composite(comp).png().toBuffer();
  if ((rig.kind === 'zombie' ? -1 : 1) !== (rig.face || 1)) pic = await sharp(pic).flop().png().toBuffer();
  return sharp(pic).composite([{ input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${ground}${txt}</svg>`), left: 0, top: 0 }]).png().toBuffer();
}

/** 자동 검사 — 사람이 볼 곳을 짚어 준다 (최종 판정은 점검 화면에서 눈으로) */
export async function audit(id, mode = 'after') {
  const rig = applyFix(rigOf(id), mode === 'after' ? fixTable()[id] : undefined);
  const L = await layout(id, rig), at = (n) => L.findIndex((l) => l.n === n), get = (n) => L[at(n)];
  const pts = {}; for (const l of L) pts[l.n] = await opaque(l);
  const overlap = (a, b) => { const s = new Set(pts[b].map(([x, y]) => (x | 0) + ',' + (y | 0))); return pts[a].filter(([x, y]) => s.has((x | 0) + ',' + (y | 0))).length; };
  const warn = [], face = rig.face || 1;
  for (const arm of ['arm_f', 'arm_b']) for (const fc of ['jaw', 'head']) {
    if (at(arm) < 0 || at(fc) < 0 || at(arm) < at(fc)) continue;
    const o = overlap(arm, fc); if (o > 20) warn.push(`${arm} 가 ${fc} 앞에 그려져 ${o}px 를 가린다`);
  }
  for (const fc of ['head', 'jaw']) if (at(fc) >= 0 && at('torso') > at(fc)) { const o = overlap('torso', fc); if (o > 40) warn.push(`${fc} 가 몸통 뒤에 깔려 ${o}px 가 묻힌다`); }
  if (at('jaw') >= 0 && at('head') >= 0) {
    const cx = (n) => pts[n].reduce((s, [x]) => s + x, 0) / Math.max(1, pts[n].length);
    if ((cx('jaw') - cx('head')) * face < -4) warn.push(`턱이 머리보다 뒤쪽(${Math.round(cx('jaw') - cx('head'))}px)`);
    const jy = Math.max(...pts.jaw.map(([, y]) => y)), hy = Math.max(...pts.head.map(([, y]) => y));
    if (jy < hy - 2) warn.push(`턱 아래끝이 머리 아래끝보다 위(${Math.round(jy - hy)}px) — 턱이 보이지 않는다`);
  }
  /* A자 : 발끝(아래 6줄)의 가운데가 엉덩이(위 6줄) 가운데보다 몸 안쪽으로 들어가고, 두 발이 엉덩이 간격보다 가까우면 */
  const lf = get('leg_f'), lb = get('leg_b');
  if (lf && lb) {
    const band = (n, fromTop) => { const ys = pts[n].map(([, y]) => y), y0 = fromTop ? Math.min(...ys) : Math.max(...ys) - 6, y1 = fromTop ? Math.min(...ys) + 6 : Math.max(...ys); const b = pts[n].filter(([, y]) => y >= y0 && y <= y1); return b.reduce((s, [x]) => s + x, 0) / Math.max(1, b.length); };
    const hipGap = (band('leg_f', true) - band('leg_b', true)) * face, footGap = (band('leg_f', false) - band('leg_b', false)) * face;
    if (footGap < hipGap - 6) warn.push(`${footGap < hipGap - 10 ? '' : '(가벼움) '}다리가 아래로 갈수록 모인다 (엉덩이 간격 ${Math.round(hipGap)} → 발 간격 ${Math.round(footGap)}) — A자`);
    const feet = Math.max(...pts.leg_f.map(([, y]) => y), ...pts.leg_b.map(([, y]) => y));
    if (Math.abs(feet) > 3) warn.push(`발밑이 땅(0)에서 ${Math.round(feet)}px 떨어짐`);
  }
  const t = get('torso');
  if (t) for (const l of L) {
    if (l.n === 'torso' || /wing|tail|hat|rider|saddle/.test(l.n)) continue;
    const near = pts[l.n].some(([x, y]) => x >= t.x0 - 2 && x <= t.x0 + t.w + 2 && y >= t.y0 - 6 && y <= t.y0 + t.h + 2);
    if (!near) warn.push(`${l.n} 가 몸통 상자에서 떨어져 있다`);
  }
  return { id, order: L.map((l) => l.n), warn };
}

const [cmd, ...rest] = process.argv.slice(2);
const list = () => fs.readdirSync(AI).filter((d) => fs.existsSync(path.join(AI, d, 'rig.json')));
if (cmd === 'ids') {
  const rows = list().map((id) => { const r = rigOf(id); return { id, kind: r.kind, boss: /^boss/.test(id), parts: r.parts.length }; });
  rows.sort((a, b) => (b.boss - a.boss) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  fs.writeFileSync(IDS, JSON.stringify(rows) + '\n');
  console.log(`→ ${path.relative(ROOT, IDS)} ${rows.length}종 (보스 ${rows.filter((r) => r.boss).length})`);
}
if (cmd === 'audit') {
  const mode = rest.includes('--before') ? 'before' : 'after';
  for (const id of rest.filter((a) => !a.startsWith('--')).length ? rest.filter((a) => !a.startsWith('--')) : list()) {
    const r = await audit(id, mode);
    console.log(`${r.warn.length ? '✗' : '✓'} ${id}  [${r.order.join(' ')}]`); for (const w of r.warn) console.log('    · ' + w);
  }
}
if (cmd === 'shot') {
  const [out, mode, id] = rest, k = rest.includes('--k') ? Number(rest[rest.indexOf('--k') + 1]) : 4;
  fs.writeFileSync(out, await render(id, mode, k, rest.includes('--label')));
  console.log('→', out);
}
