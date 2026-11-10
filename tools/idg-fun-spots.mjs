/**
 * 재미 요소 «자리 확인 그림» (겜부장 · 2026-11-11) — 배경 위에 자리표를 겹쳐 그린다.
 *   node tools/idg-fun-spots.mjs <월드번호> <배경.png> <출력.png> [--grid]
 * 배경을 540 높이로 맞춰(게임과 같은 배율) 왼쪽 1260 칸을 자르고, 자리표의 점 · 선 · 상자를 색으로 표시한다.
 *  노랑=달 · 초록=땅 줄/무덤 자리 · 하늘색=울타리 · 주황=부엉이/호박 · 분홍=창문 · 청록=도깨비불 · 갈색=흙 띠 · 빨강 빗금=금지(성 앞)
 * --grid : 50칸 격자 (새 배경의 자리를 잴 때)
 */
import sharp from 'sharp';
import { SPOTS } from '../src/games/iandragon_game/render/funSpots.js';

const [world, bgPath, out, flag] = process.argv.slice(2);
const S = SPOTS[world] || {};
const W = 1260, H = 540;
const m = await sharp(bgPath).metadata();
const k = H / m.height;
const bg = await sharp(bgPath).resize(Math.max(W, Math.round(m.width * k)), H, { kernel: 'nearest' }).extract({ left: 0, top: 0, width: W, height: H }).png().toBuffer();
let s = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" font-family="Arial" font-size="12" font-weight="700">`;
if (flag === '--grid') for (let x = 0; x <= W; x += 50) s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${x % 100 ? '#ffffff40' : '#ffff00a0'}"/>${x % 100 ? '' : `<text x="${x + 2}" y="12" fill="yellow">${x}</text>`}`;
if (flag === '--grid') for (let y = 0; y <= H; y += 50) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${y % 100 ? '#ffffff40' : '#00ffffa0'}"/><text x="2" y="${y - 2}" fill="cyan">${y}</text>`;
const lab = (x, y, t, c) => `<text x="${x + 6}" y="${y - 6}" fill="${c}" stroke="#000" stroke-width="3" paint-order="stroke">${t}</text>`;
if (S.safe) { s += `<rect x="0" y="${(S.ground || 437) - 60}" width="${S.safe[0]}" height="60" fill="#ff000040"/><rect x="${S.safe[1]}" y="${(S.ground || 437) - 60}" width="${W - S.safe[1]}" height="60" fill="#ff000040"/>`; }
if (S.moon) s += `<circle cx="${S.moon.x}" cy="${S.moon.y}" r="${S.moon.d / 2}" fill="none" stroke="yellow" stroke-width="3"/>` + lab(S.moon.x, S.moon.y - S.moon.d / 2, `달 ${S.moonFace ? '(얼굴 OK)' : '(얼굴 X)'}`, 'yellow');
if (S.ground) s += `<line x1="0" y1="${S.ground}" x2="${W}" y2="${S.ground}" stroke="#4f4" stroke-width="2"/>` + lab(4, S.ground, '땅 줄', '#4f4');
for (const x of S.graves || []) s += `<circle cx="${x}" cy="${S.ground}" r="6" fill="#4f4"/>`;
if (S.fence) s += `<line x1="${S.fence.x0}" y1="${S.fence.y}" x2="${S.fence.x1}" y2="${S.fence.y}" stroke="#4cf" stroke-width="4"/>` + lab(S.fence.x0, S.fence.y, '울타리(고양이)', '#4cf');
if (S.owl) s += `<circle cx="${S.owl.x}" cy="${S.owl.y}" r="7" fill="orange"/>` + lab(S.owl.x, S.owl.y, '부엉이', 'orange');
if (S.pumpkin) s += `<circle cx="${S.pumpkin.x}" cy="${S.pumpkin.y}" r="7" fill="orange"/>` + lab(S.pumpkin.x, S.pumpkin.y, '호박', 'orange');
if (S.window) s += `<rect x="${S.window.x - 11}" y="${S.window.y - 14}" width="22" height="28" fill="none" stroke="#f6c" stroke-width="3"/>` + lab(S.window.x, S.window.y - 14, '창문', '#f6c');
for (const p of S.wisps || []) s += `<circle cx="${p.x}" cy="${p.y}" r="6" fill="#3fd"/>`;
if (S.dirtY) s += `<line x1="0" y1="${S.dirtY}" x2="${W}" y2="${S.dirtY}" stroke="#c84" stroke-width="2" stroke-dasharray="8 6"/>` + lab(4, S.dirtY + 18, '흙 띠(두더지)', '#c84');
if (S.sky) s += `<rect x="2" y="${S.sky[0]}" width="8" height="${S.sky[1] - S.sky[0]}" fill="#9cf"/>` + lab(10, S.sky[0] + 12, '하늘 띠', '#9cf');
s += '</svg>';
await sharp(bg).composite([{ input: Buffer.from(s) }]).png().toFile(out);
console.log('→ ' + out);
