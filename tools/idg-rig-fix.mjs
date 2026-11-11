/**
 * 그림 담당 — 용 · 리더 날개 · 꼬리 자리 고치기 (2026-11-11 · 대표님 «꼬리가 이상한 데서 꼬여 있고 날개도 날개 같지 않다 ·
 *   고치라고 하면 하나만 말고 전부 · 프로필의 파란 리더 정도 비율과 느낌을 전체에 · 파란 리더도 날개가 살짝 높으니 조금 내리면» · 겜부장 전달)
 *
 *   node tools/idg-rig-fix.mjs propose            몸통(torso) 크기에 맞춘 날개 · 꼬리 자리를 계산해 ai/meta/rigfix.json 에 (손으로 고친 값은 MANUAL 이 이김)
 *   node tools/idg-rig-fix.mjs sheet <출력.png> [before|after] [id …]   점검 시트 (빨강 = 기준점 · 초록 = 날개 · 하늘 = 꼬리)
 *
 * 기준 = 파란 리더 novart : 몸통 칸 안 비율로 날개 뿌리(가로 0.25 · 세로 0.45 = 게임 보정값보다 조금 낮게) · 꼬리 뿌리(가로 0.2 · 세로 0.77).
 * rig.json 은 그대로 두고(R2 1년 캐시) 고친 자리만 ai/meta/rigfix.json = { id: { wing: [x, y], tail: [x, y], files?: { wing: 'wing_v2' } } } → 겜부장이 rig.js RIG_FIX 로 읽음.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const AI = path.join(ROOT, 'public/assets/iandragon_game/ai');
const FIX = path.join(AI, 'meta/rigfix.json');
const GAME_FIX = { novart: { wing: [-10, -47] } };                                  // 지금 게임 rig.js 에 들어 있는 보정 (전 시트용)
const TEMPLATE = { wing: [0.25, 0.45], tail: [0.2, 0.77] };
/** 사람이 보고 정한 값 (계산값보다 우선) — 아래 sheet 로 확인하며 채움 */
const MANUAL = JSON.parse(fs.existsSync(path.join(ROOT, 'tools/idg-rig-manual.json')) ? fs.readFileSync(path.join(ROOT, 'tools/idg-rig-manual.json'), 'utf8') : '{}');

const ids = () => fs.readdirSync(AI).filter((d) => { const f = path.join(AI, d, 'rig.json'); if (!fs.existsSync(f)) return false; const r = JSON.parse(fs.readFileSync(f, 'utf8')); return r.kind !== 'zombie' && r.parts.some((p) => p.n === 'wing') && !/^boss|^bat$|wingz|shard/.test(d); });
const rigOf = (id) => JSON.parse(fs.readFileSync(path.join(AI, id, 'rig.json'), 'utf8'));
const size = async (id, n) => sharp(path.join(AI, id, n + '.png')).metadata();

async function torsoBox(id) {
  const t = rigOf(id).parts.find((p) => p.n === 'torso'), m = await size(id, 'torso');
  const x0 = t.p[0] - t.a[0] * m.width, y0 = t.p[1] - t.a[1] * m.height;
  return { x0, y0, w: m.width, h: m.height };
}

if (process.argv[2] === 'propose') {
  const out = {};
  for (const id of ids()) {
    const b = await torsoBox(id), e = {};
    for (const n of ['wing', 'tail']) if (rigOf(id).parts.some((p) => p.n === n)) e[n] = [Math.round(b.x0 + TEMPLATE[n][0] * b.w), Math.round(b.y0 + TEMPLATE[n][1] * b.h)];
    out[id] = { ...e, ...(MANUAL[id] || {}) };
  }
  fs.writeFileSync(FIX, JSON.stringify(out, null, 1) + '\n');
  console.log(`→ ai/meta/rigfix.json ${Object.keys(out).length}종`);
}

if (process.argv[2] === 'sheet') {
  const [, , , outFile, mode = 'after', ...want] = process.argv;
  const fix = mode === 'after' && fs.existsSync(FIX) ? JSON.parse(fs.readFileSync(FIX, 'utf8')) : GAME_FIX;
  const list = want.length ? want : ids(), CW = 170, CH = 140, K = 2, COLS = 7, tiles = [];
  for (const id of list) {
    const rig = rigOf(id), F = fix[id] || {}, comp = [], dots = [];
    for (const p of rig.parts) {
      const file = F.files?.[p.n] || p.n, f = path.join(AI, id, file + '.png'); if (!fs.existsSync(f)) continue;
      const m = await sharp(f).metadata(), pos = F[p.n] || p.p, ax = p.flip ? 1 - p.a[0] : p.a[0];
      let img = sharp(f).resize(m.width * K, m.height * K, { kernel: 'nearest' }); if (p.flip) img = img.flop();
      comp.push({ input: await img.png().toBuffer(), left: Math.max(0, Math.round((CW / 2 + pos[0] - ax * m.width) * K)), top: Math.max(0, Math.round((CH - 12 + pos[1] - p.a[1] * m.height) * K)) });
      dots.push([(CW / 2 + pos[0]) * K, (CH - 12 + pos[1]) * K, p.n]);
    }
    const svg = `<svg width="${CW * K}" height="${CH * K}" xmlns="http://www.w3.org/2000/svg">${dots.map(([x, y, n]) => `<circle cx="${x}" cy="${y}" r="3" fill="${n === 'wing' ? '#0f0' : n === 'tail' ? '#0ff' : 'red'}"/>`).join('')}<text x="6" y="22" font-size="20" fill="#fff" font-family="Arial">${id}</text></svg>`;
    tiles.push(await sharp({ create: { width: CW * K, height: CH * K, channels: 4, background: { r: 40, g: 30, b: 70, alpha: 1 } } }).composite([...comp, { input: Buffer.from(svg) }]).png().toBuffer());
  }
  const rows = Math.ceil(tiles.length / COLS);
  await sharp({ create: { width: Math.min(COLS, tiles.length) * CW * K, height: rows * CH * K, channels: 3, background: '#1a1430' } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i % COLS) * CW * K, top: Math.floor(i / COLS) * CH * K }))).png().toFile(outFile);
  console.log('→', outFile);
}
