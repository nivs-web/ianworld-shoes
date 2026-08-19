/**
 * 접속 속도 계측 (진단 전용) — `npm run perf:boot`
 *
 * "느려진 것 같다"는 신고는 **숫자 없이 못 고친다.** 프레임 비용은 `perf:frame` 이
 * 재고, 이쪽은 **부팅에서 첫 화면까지**와 그 동안 실제로 받은 바이트를 잰다.
 *
 * 재는 것:
 *   · 첫 화면(#ui 에 내용이 생기는 순간)까지 걸린 시간
 *   · 그 시점까지 받은 요청 수·바이트 (JS·CSS·그림을 나눠서)
 *   · 부팅 3초 안에 추가로 받은 것 (뒤에서 조용히 받는 것들 — RTDB SDK 등)
 *   · DOM 노드 수 (화면이 무거워졌는지)
 *
 * 반드시 `npm run build` 뒤에 돌린다 — dist 를 실제 서버로 띄운다.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4188;
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'],
  { stdio: 'ignore' });
await sleep(4000);

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe }).catch(() => chromium.launch());

/** 회선을 흉내 내야 "몇 KB 가 몇 ms"인지 감이 잡힌다 (4G 정도) */
const THROTTLE = { downloadThroughput: (4 * 1024 * 1024) / 8, uploadThroughput: (1024 * 1024) / 8, latency: 60 };

async function run(label) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  // 닉네임이 있는 재방문자 = 로비 직행. 로그인 화면에서 멈추면 잴 것이 없다
  await page.addInitScript(() => {
    localStorage.setItem('sf_profile', JSON.stringify({
      nickname: '이안', uid: 'tester', selectedCharacter: 'ian',
      unlockedCharacters: ['ian'], difficulty: 'easy', controlMode: 1,
      walletVersion: 1, shoesByIndex: {},
    }));
  });

  /**
   * 바이트는 **`content-length` 로 세면 안 된다.** 압축 전송(chunked)에는 그 헤더가
   * 아예 없어서 전부 0으로 잡힌다 — 처음에 그렇게 재서 "44KB" 라는 거짓 숫자를 봤다.
   * `request.sizes()` 가 실제로 선을 타고 온 바이트를 준다.
   */
  const got = [];
  page.on('response', (r) => { got.push({ url: r.url(), at: Date.now(), req: r.request(), size: 0 }); });

  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, ...THROTTLE });

  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'commit' });
  // 첫 화면 = #ui 에 자식이 생기는 순간 (부트 오버레이가 아니라 진짜 화면)
  await page.waitForFunction(() => {
    const ui = document.getElementById('ui');
    return !!ui && ui.children.length > 0;
  }, null, { timeout: 30000 }).catch(() => {});
  const firstScreen = Date.now() - t0;
  const atFirst = got.length;

  await sleep(4000);   // 뒤에서 조용히 받는 것까지 본다
  for (const r of got) {
    try { r.size = (await r.req.sizes()).responseBodySize ?? 0; } catch { /* 무시 */ }
  }
  const bytesFirst = got.slice(0, atFirst).reduce((s, r) => s + r.size, 0);
  const bytesAll = got.reduce((s, r) => s + r.size, 0);
  const nodes = await page.evaluate(() => document.getElementsByTagName('*').length);
  const rtdb = got.some((r) => /firebase-rtdb/.test(r.url));

  console.log(`\n[${label}]`);
  console.log(`  첫 화면까지        ${firstScreen} ms`);
  console.log(`  그때까지 요청/바이트  ${atFirst}건 / ${(bytesFirst / 1024).toFixed(1)} KB`);
  console.log(`  4초까지 총 바이트    ${(bytesAll / 1024).toFixed(1)} KB (요청 ${got.length}건)`);
  console.log(`  RTDB SDK 받았나     ${rtdb ? '예' : '아니오'}`);
  console.log(`  DOM 노드            ${nodes}`);
  if (process.env.PERF_VERBOSE) {
    for (const r of got) console.log(`     +${r.at - t0}ms  ${(r.size / 1024).toFixed(1)}KB  ${r.url.replace(/^http:\/\/[^/]+/, '')}`);
  }

  /**
   * ★ **로비 → 싱글게임 시작**까지도 잰다. (2026-08-19 13차)
   * 사용자가 "느리다"고 할 때 부팅만큼 자주 가리키는 자리다 — 판 에셋(146KB)을
   * 받는 동안 다른 것(RTDB SDK 등)이 회선을 다투면 그대로 여기서 드러난다.
   */
  /**
   * 이 하네스에는 진짜 세션이 없으므로 세션 확인이 끝나면 로그인 화면으로 되돌아간다
   * (그게 정상 동작이다 — 13차 '미리 로비' 참고). 판 시작을 재려면 로비를 다시 세운다.
   */
  let gameStart = null;
  await page.evaluate(() => window.__dbg?.nav?.reset?.(window.__dbg.screens.Lobby)).catch(() => {});
  await page.waitForTimeout(400);
  const btn = page.locator('button:has-text("싱글게임")').first();
  if (await btn.count()) {
    const g0 = Date.now();
    await btn.click();
    await page.waitForFunction(() => {
      const s = window.__dbg?.Scene?.current?.();
      return !!s && s.ready === true;
    }, null, { timeout: 30000 }).catch(() => {});
    gameStart = Date.now() - g0;
    for (const r of got) {
      try { r.size = (await r.req.sizes()).responseBodySize ?? 0; } catch { /* 무시 */ }
    }
    const during = got.filter((r) => r.at >= g0);
    console.log(`  로비 → 판 시작      ${gameStart} ms`);
    // 캐시에서 온 것은 크기가 음수로 온다 — 선을 탄 것만 센다
    const 선 = during.filter((r) => r.size > 0);
    console.log(`  그동안 받은 것       ${during.length}건 (선 ${선.length}건 / ${(선.reduce((s, r) => s + r.size, 0) / 1024).toFixed(1)} KB, 나머지는 캐시)`);
    if (process.env.PERF_VERBOSE) {
      for (const r of during) console.log(`     +${r.at - g0}ms  ${(r.size / 1024).toFixed(1)}KB  ${r.url.replace(/^http:\/\/[^/]+/, '')}`);
    }
  }

  await ctx.close();
  return { firstScreen, bytesFirst, bytesAll, nodes, rtdb, gameStart };
}

await run('부팅 → 로비');
await browser.close();
preview.kill();
