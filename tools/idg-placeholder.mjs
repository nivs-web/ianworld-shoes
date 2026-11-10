/**
 * 이안 드래곤 게임 — **자리표시 그림 시트** 만들기 (겜부장 담당 · 팀 계획서 2.1).
 *
 *   node tools/idg-placeholder.mjs
 *
 * 진짜 그림(겜팀장 `tools/idg-art-build.mjs`)과 **같은 이름 · 같은 크기 · 같은 기준점**의 색 네모를
 * `public/assets/iandragon_game/atlas.png` + `atlas.json` (PixiJS 스프라이트 시트) 으로 굽는다.
 * 그래서 코드는 그림을 기다리지 않고, 진짜 그림이 오면 파일만 바뀐다.
 *
 * 필요한 이름은 `src/games/iandragon_game/data/artManifest.js` (B1 데이터 변환이 만든다) 를 따르고,
 * 아직 없으면 아래 월드 1 최소 목록을 쓴다. **진짜 그림 시트가 이미 있으면 덮어쓰지 않는다**
 * (`meta.placeholder` 가 없는 시트 = 진짜). 다시 만들려면 `--force`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = process.env.IDG_OUT || path.join(ROOT, 'public/assets/iandragon_game');
const MANIFEST = path.join(ROOT, 'src/games/iandragon_game/data/artManifest.js');
const force = process.argv.includes('--force');
/* `--name _placeholder` → _placeholder.png/json 으로 (겜팀장 굽기 도구가 빠진 이름을 여기서 채운다) */
const nameArg = process.argv.indexOf('--name');
const BASE_NAME = nameArg > 0 ? process.argv[nameArg + 1] : 'atlas';

/** 월드 1 최소 목록 — [이름 접두, 가로, 세로, 동작들, 색] */
const FALLBACK = [
  ...[['kkomul', 32], ['doldeung', 40], ['bulttong', 40], ['twetwe', 40], ['ssaeng', 48]].flatMap(([id, s]) =>
    [1, 2].map((form) => [`dragon/${id}/${form}`, s + (form - 1) * 4, s + (form - 1) * 4, 'unit', 'dragon'])),
  ...[['walker', 36], ['pup', 32], ['chubby', 44], ['archer', 36], ['shield', 40], ['fart', 36]].map(([id, s]) =>
    [`zombie/${id}/0`, s, s, 'unit', 'zombie']),
  ['boss/bossFat/0', 128, 128, 'boss', 'boss'],
  ['leader/novart/0', 64, 56, 'idle', 'leader'],
  ['crown/0/0', 24, 16, 'idle', 'crown'],
];
const BASES = [['base/nest/0', 96, 160, 'ally'], ['base/tower/w01', 96, 160, 'enemy']];
const BGS = [['bg/w01/sky', 512, 360, 0x2a1c52], ['bg/w01/far', 512, 140, 0x3b2a6e], ['bg/w01/near', 512, 80, 0x2f5a3a], ['bg/w01/ground', 512, 60, 0x5a3d22]];
const ICONS = ['ember', 'coin', 'gem', 'star', 'attr_red', 'skill_meteor'];

const ANIMS = {
  unit: ['idle0', 'walk0', 'walk1', 'atk0', 'atk1', 'kb0'],
  boss: ['idle0', 'walk0', 'walk1', 'walk2', 'walk3', 'atk0', 'atk1', 'kb0'],
  idle: ['idle0'],
};
const COLORS = { dragon: [0xffb347, 0xff7f50], zombie: [0x7fb069, 0x8a6fb0], boss: [0x9b5de5, 0x9b5de5], leader: [0x4cc9f0, 0x4cc9f0], crown: [0xffd60a, 0xffd60a], ally: [0xe0a458, 0xe0a458], enemy: [0x6b4f7a, 0x6b4f7a] };
const OUTLINE = 0x14082a;

let WORLDS = 1, ICON_LIST = ICONS, FX_LIST = ['hit', 'dust', 'poof'];
async function loadList() {
  if (!fs.existsSync(MANIFEST)) return { list: FALLBACK, from: 'fallback' };
  const m = await import(pathToFileURL(MANIFEST).href);
  if (m.ART_ANIMS) Object.assign(ANIMS, m.ART_ANIMS);
  WORLDS = m.ART_WORLDS ?? 1;
  ICON_LIST = m.ART_ICONS ?? ICONS;
  FX_LIST = m.ART_FX ?? FX_LIST;
  return { list: m.ART_FRAMES ?? FALLBACK, from: 'artManifest.js', names: m.ART_NAMES };
}
const wk = (w) => 'w' + String(w).padStart(2, '0');

/** 그릴 프레임 하나하나 {name, w, h, draw(px, ox, oy)} */
function frames(list) {
  const out = [];
  list.forEach(([prefix, w, h, kind, colorKey], idx) => {
    const [c1, c2] = COLORS[colorKey] ?? [0xcccccc, 0xcccccc];
    const body = idx % 2 ? c2 : c1;
    for (const a of ANIMS[kind] ?? ANIMS.unit) {
      const bob = /walk1|walk3/.test(a) ? 1 : 0;
      const lean = a === 'atk1' ? 3 : a === 'atk0' ? -2 : a === 'kb0' ? -4 : 0;
      out.push({ name: `${prefix}/${a}`, w, h, draw: (px) => {
        const bw = Math.round(w * 0.8), bh = Math.round(h * 0.75);
        const x0 = Math.round((w - bw) / 2) + lean, y0 = h - bh - 2 - bob;
        px.rect(x0, y0, bw, bh, OUTLINE);
        px.rect(x0 + 1, y0 + 1, bw - 2, bh - 2, body);
        const face = colorKey === 'zombie' || colorKey === 'boss' ? -1 : 1;   // 아군은 오른쪽, 적은 왼쪽을 본다
        const ex = face > 0 ? x0 + bw - 6 : x0 + 3;
        px.rect(ex, y0 + 4, 3, 3, 0xffffff); px.rect(ex + (face > 0 ? 1 : 0), y0 + 5, 2, 2, OUTLINE);
        const legY = h - 2;
        const step = /walk0|walk2/.test(a) ? 2 : 0;
        px.rect(x0 + 2 + step, legY, 3, 2, OUTLINE); px.rect(x0 + bw - 5 - step, legY, 3, 2, OUTLINE);
      } });
    }
  });
  const bases = [BASES[0], ...Array.from({ length: WORLDS }, (_, i) => [`base/tower/${wk(i + 1)}`, 96, 160, 'enemy'])];
  const bgs = Array.from({ length: WORLDS }, (_, i) => BGS.map(([n, w, h, c]) => [n.replace('w01', wk(i + 1)), w, h, (c + i * 0x0a0306) & 0xffffff])).flat();
  for (const [prefix, w, h, key] of bases) for (let hp = 0; hp < 4; hp++) out.push({ name: `${prefix}/hp${hp}`, w, h, draw: (px) => {
    px.rect(8, 10, w - 16, h - 10, OUTLINE); px.rect(9, 11, w - 18, h - 12, COLORS[key][0]);
    px.rect(w / 2 - 10, h - 34, 20, 34, OUTLINE);
    for (let i = 0; i < hp; i++) px.rect(20 + i * 18, 30 + i * 22, 14, 2, OUTLINE);   // 금 (체력 단계)
  } });
  for (const [name, w, h, c] of bgs) out.push({ name, w, h, draw: (px) => {
    px.rect(0, 0, w, h, c);
    for (let x = 0; x < w; x += 32) px.rect(x, 0, 1, Math.min(6, h), (c + 0x101010) & 0xffffff);
  } });
  for (const id of ICON_LIST) out.push({ name: `icon/${id}`, w: 24, h: 24, draw: (px) => { px.rect(2, 2, 20, 20, OUTLINE); px.rect(3, 3, 18, 18, 0xffd166); } });
  for (const id of FX_LIST) for (let i = 0; i < 3; i++) out.push({ name: `fx/${id}/0/${i}`, w: 16, h: 16, draw: (px) => { const s = 4 + i * 4; px.rect(8 - s / 2, 8 - s / 2, s, s, 0xfff3b0); } });
  return out;
}

/** 줄 단위로 쌓는 단순 배치 (가로 2048 안) */
function pack(list) {
  const W = 2048, GAP = 2;
  let x = GAP, y = GAP, row = 0;
  const sorted = [...list].sort((a, b) => b.h - a.h);
  for (const f of sorted) {
    if (x + f.w + GAP > W) { x = GAP; y += row + GAP; row = 0; }
    f.x = x; f.y = y; x += f.w + GAP; row = Math.max(row, f.h);
  }
  return { W, H: y + row + GAP };
}

async function main() {
  const jsonPath = path.join(OUT, BASE_NAME + '.json');
  if (!force && fs.existsSync(jsonPath)) {
    const old = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!old.meta?.placeholder) { console.log('진짜 그림 시트가 있어 건너뜀 (--force 로 덮어쓰기)'); return; }
  }
  const { list, from, names } = await loadList();
  const fr = frames(list);
  if (names) {   // 목록(ART_NAMES)과 정확히 같은 이름을 만들었는지
    const made = new Set(fr.map((f) => f.name));
    const miss = names.filter((n) => !made.has(n)), extra = [...made].filter((n) => !names.includes(n));
    if (miss.length || extra.length) { console.error('이름 불일치', { miss: miss.slice(0, 5), extra: extra.slice(0, 5) }); process.exit(1); }
  }
  const { W, H } = pack(fr);
  const buf = Buffer.alloc(W * H * 4);
  const px = {
    ox: 0, oy: 0,
    rect(x, y, w, h, rgb) {
      for (let j = Math.max(0, y | 0); j < Math.min(this.fh, (y + h) | 0); j++) {
        for (let i = Math.max(0, x | 0); i < Math.min(this.fw, (x + w) | 0); i++) {
          const p = ((this.oy + j) * W + this.ox + i) * 4;
          buf[p] = (rgb >> 16) & 255; buf[p + 1] = (rgb >> 8) & 255; buf[p + 2] = rgb & 255; buf[p + 3] = 255;
        }
      }
    },
  };
  const json = { frames: {}, meta: { image: BASE_NAME + '.png', size: { w: W, h: H }, scale: 1, placeholder: true, from } };
  for (const f of fr) {
    px.ox = f.x; px.oy = f.y; px.fw = f.w; px.fh = f.h;
    f.draw(px);
    const isBg = f.name.startsWith('bg/');
    json.frames[f.name] = {
      frame: { x: f.x, y: f.y, w: f.w, h: f.h },
      sourceSize: { w: f.w, h: f.h },
      spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
      anchor: isBg ? { x: 0, y: 0 } : { x: 0.5, y: 1 },
    };
  }
  fs.mkdirSync(OUT, { recursive: true });
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(OUT, BASE_NAME + '.png'));
  fs.writeFileSync(jsonPath, JSON.stringify(json));
  console.log(`자리표시 시트 ${fr.length}프레임 · ${W}×${H} (${from})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
