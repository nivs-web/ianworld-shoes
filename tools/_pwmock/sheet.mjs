import { chromium } from 'playwright';
const D = 'C:/Users/ARIANC~1/AppData/Local/Temp/claude/C--Users-ariancepc-Desktop-cowork-iandragon/5339b06b-10e0-463d-b750-5be29792c438/scratchpad/shots_ca/';
const u = (n) => 'file:///' + D.replace(/~/g, '~') + n + '.png';
const cell = (t, n, w) => `<figure><figcaption>${t}</figcaption><img src="${u(n)}" style="width:${w}px"></figure>`;
const html = `<body style="margin:0;background:#1a1226;color:#fff;font:700 14px sans-serif;padding:12px"><style>figure{margin:0 0 4px}figcaption{padding:2px 0 4px;color:#ffd45a}img{display:block;border:1px solid #555}.r{display:flex;gap:10px;align-items:flex-start;margin-bottom:14px}</style>
<div class="r">${cell('가로 · 전투 사이 — 고치기 전', 'before_battle_land-0', 640)}${cell('고친 뒤 · 불씨 ▼ (싼 순서)', 'after_battle_land-1', 640)}${cell('고친 뒤 · 체력 ▲ (높은 순서)', 'after_battle_land-2', 640)}</div>
<div class="r">${cell('가로 · 로비 — 고치기 전', 'before_lobby_land-0', 640)}${cell('고친 뒤 · 불씨 ▼ (싼 순서)', 'after_lobby_land-1', 640)}${cell('고친 뒤 · 체력 ▲ (높은 순서)', 'after_lobby_land-2', 640)}</div>
<div class="r">${cell('세로 390×844 전', 'before_port390-0', 300)}${cell('세로 390×844 후', 'after_port390-0', 300)}${cell('세로 360×640 전', 'before_port360-0', 300)}${cell('세로 360×640 후', 'after_port360-0', 300)}</div></body>`;
const fs = await import('node:fs'); const tmp = D + '_sheet.html'; fs.writeFileSync(tmp, html);
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 1980, height: 1200 }, deviceScaleFactor: 1 })).newPage();
await p.goto('file:///' + tmp); await p.waitForTimeout(800);
await p.screenshot({ path: D + '_모음.png', fullPage: true });
await b.close();
