/**
 * 캐치볼 1:1 대결 검사 (진단 전용) — `npm run qa:catch`
 *
 * 두 판(`_catch-harness.html?mode=duel`)을 한 페이지에 띄워 BroadcastChannel 로 잇고,
 * 자동으로 끝까지 주고받게 한다. Firebase 없이 **주고받는 규약**만 검사한다:
 *   · 두 화면의 점수 · 공(목숨) · 순번이 서로 맞는가
 *   · 한쪽만 이기고 한쪽만 지는가 (둘 다 이기거나 둘 다 지면 실패)
 *   · 끝난 뒤 결과 창이 실제로 뜨는가
 *   · 판 도중 오류가 없는가
 *
 * 정적 서버로 띄운다(번들 없이 모듈을 그대로 읽는다). `node tools/_catch-duel-qa.mjs [판수]`
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const ROUNDS = Number(process.argv[2] || 3);
const exe = process.env.CHROME_PATH;
/* 플레이우라이트 전용 브라우저가 없으면 PC 에 깔린 크롬·엣지로 돈다 */
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
  .catch(() => chromium.launch({ channel: 'chrome' }))
  .catch(() => chromium.launch({ channel: 'msedge' }));
let failed = 0;

for (let round = 1; round <= ROUNDS; round++) {
  const page = await browser.newPage({ viewport: { width: 820, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const hit = [0.85, 0.6, 0.4][(round - 1) % 3];
  const diff = ['easy', 'normal', 'hard'][(round - 1) % 3];
  await page.goto(`http://127.0.0.1:${PORT}/tools/_catch-duel.html?auto=1&hit=${hit}&diff=${diff}`);

  const read = () => page.evaluate(() => ['a', 'b'].map((k) => {
    const d = document.getElementById(k).contentDocument;
    const s = d?.body?.dataset?.state;
    const over = d?.querySelector('[data-cb="over"]');
    return { st: s ? JSON.parse(s) : null, err: d?.body?.dataset?.err || '', overShown: !!over && !over.hidden,
      title: d?.querySelector('[data-cb="overTitle"]')?.textContent || '' };
  }));

  let r = null;
  const t0 = Date.now();
  for (;;) {
    await page.waitForTimeout(1000);
    r = await read();
    const done = r.every((x) => x.st?.ended) && r.every((x) => x.overShown);
    if (done || Date.now() - t0 > 240000) break;
  }
  const [a, b] = r;
  const problems = [];
  if (!a.st || !b.st) problems.push('상태를 못 읽었다');
  else {
    if (!a.st.ended || !b.st.ended) problems.push(`안 끝났다 (a:${a.st.phase} b:${b.st.phase})`);
    if (a.st.win === b.st.win) problems.push(`승패가 겹친다 (a:${a.st.win} b:${b.st.win})`);
    if (a.st.diff !== diff || b.st.diff !== diff) problems.push(`난이도가 안 들어갔다 (a:${a.st.diff} b:${b.st.diff})`);
    if (a.st.score !== b.st.oppScore || b.st.score !== a.st.oppScore) problems.push(`점수가 어긋난다 a:${a.st.score}/${b.st.oppScore} b:${b.st.score}/${a.st.oppScore}`);
    if (a.st.lives !== b.st.oppLives || b.st.lives !== a.st.oppLives) problems.push(`공 수가 어긋난다 a:${a.st.lives}/${b.st.oppLives} b:${b.st.lives}/${a.st.oppLives}`);
    const loser = a.st.win ? b : a;
    if (loser.st.lives !== 0) problems.push(`진 쪽 공이 0이 아니다 (${loser.st.lives})`);
    if (!a.overShown || !b.overShown) problems.push(`결과 창이 안 떴다 (a:${a.overShown} b:${b.overShown})`);
  }
  for (const x of [a, b]) if (x.err) problems.push('오류: ' + x.err);
  for (const e of errors) problems.push('오류: ' + e);

  const sec = Math.round((Date.now() - t0) / 1000);
  const line = a.st && b.st
    ? `점수 ${a.st.score}:${b.st.score} · 공 ${a.st.lives}:${b.st.lives} · 던지기 ${Math.max(a.st.seq, b.st.seq)}번 · ${a.st.win ? 'a' : 'b'} 승 · ${sec}초 · 결과창 "${a.title}" / "${b.title}"`
    : '';
  if (problems.length) { failed++; console.log(`✗ ${round}판 (${diff} · 잡기 ${hit}) ${line}`); for (const p of problems) console.log('    ' + p); }
  else console.log(`✓ ${round}판 (${diff} · 잡기 ${hit}) ${line}`);
  if (round === 1) await page.screenshot({ path: join(ROOT, 'tools/_out/catch-duel.png') }).catch(() => {});
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `\n${failed}판 실패` : '\n대결 규약이 두 화면에서 맞는다');
process.exit(failed ? 1 : 0);
