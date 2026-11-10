/**
 * 재미있는 요소 확인 그림 (겜부장 · 2026-11-11) — node tools/idg-fun-preview.mjs <출력.png>
 * 월드 1 배경 위에 추천 10개를 한꺼번에 올리고 번호를 붙인다 (실제 게임에서는 1~1.5초마다 하나씩 나온다).
 */
import sharp from 'sharp';
const A = 'public/assets/iandragon_game/ai/';
const F = A + 'fun/';
const out = process.argv[2];
const W = 1260, H = 540;
const bgMeta = await sharp(A + 'bg/w01_panel.png').metadata();
const k = H / bgMeta.height;
const bg = await sharp(A + 'bg/w01_panel.png').resize(Math.round(bgMeta.width * k), H, { kernel: 'nearest' }).extract({ left: 0, top: 0, width: W, height: H }).png().toBuffer();
const comps = [];
const put = async (file, x, y, { sil = false, alpha = 1, scale = 1, flop = false } = {}) => {
  let img = sharp(F + file + '.png');
  const m = await img.metadata();
  if (scale !== 1) img = img.resize(Math.round(m.width * scale), Math.round(m.height * scale), { kernel: 'nearest' });
  if (flop) img = img.flop();
  let { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) { if (sil) { data[i] = 22; data[i + 1] = 12; data[i + 2] = 44; } data[i + 3] = Math.round(data[i + 3] * alpha); }
  comps.push({ input: await sharp(data, { raw: info }).png().toBuffer(), left: Math.round(x - info.width / 2), top: Math.round(y - info.height / 2) });
};
const tag = (n, x, y) => comps.push({ input: Buffer.from(`<svg width="34" height="34" xmlns="http://www.w3.org/2000/svg"><circle cx="17" cy="17" r="15" fill="#FF3D6E" stroke="#fff" stroke-width="3"/><text x="17" y="23" font-size="17" font-family="Arial" font-weight="900" fill="#fff" text-anchor="middle">${n}</text></svg>`), left: x - 17, top: y - 17 });
// 7 달님 윙크 (배경 달 위)
await put('moon_wink', 790, 136, { alpha: 0.92, scale: 241 / 247 });
// 1 달 앞 자전거 (그림자)
await put('bike', 760, 160, { sil: true }); await put('wheel', 760 - 50 + 17, 160 - 49 + 79, { sil: true }); await put('wheel', 760 - 50 + 81, 160 - 49 + 77, { sil: true });
// 3 해골 구름 + 번개
await put('skull_cloud', 470, 95, { alpha: 0.95 });
comps.push({ input: Buffer.from('<svg width="60" height="150" xmlns="http://www.w3.org/2000/svg"><polyline points="30,0 18,55 34,60 14,150 46,50 30,46 42,0" fill="#fffbe0" stroke="#a6f" stroke-width="3"/></svg>'), left: 452, top: 140 });
// 6 빗자루 마녀
await put('witch', 230, 120);
// 4 박쥐 떼 V
for (const [dx, dy, f] of [[0, 0, 'bat_up'], [-34, -18, 'bat_down'], [-34, 18, 'bat_up'], [-68, -34, 'bat_up'], [-68, 34, 'bat_down'], [-130, 10, 'bat_down']]) await put(f, 1080 + dx, 110 + dy);
// 9 별똥별
comps.push({ input: Buffer.from('<svg width="200" height="90" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff8c0"/></linearGradient></defs><line x1="0" y1="0" x2="180" y2="75" stroke="url(#g)" stroke-width="5" stroke-linecap="round"/><circle cx="182" cy="76" r="6" fill="#fff"/></svg>'), left: 960, top: 20 });
// 2 도깨비불
await put('wisp1', 600, 345, { alpha: 0.9 }); await put('wisp2', 640, 325, { alpha: 0.9 }); await put('wisp3', 675, 350, { alpha: 0.9 });
// 5 무덤 손 (꽃)
await put('hand_flower', 545, 412);
// 8 유령 까꿍
await put('boo', 930, 380);
// 10 유령 고양이 (울타리 위)
await put('cat', 1120, 345, { alpha: 0.8 }); await put('cat_tail', 1085, 330, { alpha: 0.8, flop: true });
for (const [n, x, y] of [[1, 760, 95], [2, 640, 290], [3, 470, 40], [4, 1090, 65], [5, 545, 365], [6, 230, 65], [7, 860, 40], [8, 930, 340], [9, 1170, 115], [10, 1150, 305]]) tag(n, x, y);
await sharp(bg).composite(comps).png().toFile(out);
console.log('→', out);
