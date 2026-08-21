/**
 * 아이템 쇼핑 — **화면을 실제로 띄워서** 확인한다. (2026-08-21 26차)
 *
 * 사용자 지정을 브라우저에게 묻는다:
 *   ① 타이틀 `아이템 쇼핑`, 그 바로 아래 카테고리 셋 `[악세사리][날개][반려견]`
 *   ② 열한 가지의 이름과 값이 사용자가 준 그대로
 *   ③ 아래에 `아이템 착용 모습` — **정면과 옆모습 두 컷**
 *   ④ 고르면 그 자리에서 캐릭터가 입는다 (사기 **전에도** 보인다 — 값이 최대 1만이다)
 *   ⑤ 날개는 캐릭터 **뒤**에 그려진다
 *   ⑥ 확대가 **정수배**다 (§3-1 — 1.93배면 도트가 뭉갠다)
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { ITEMS } from '../src/data/items.js';

const PORT = 5254;
/** ⚠ npx 아래의 vite 는 kill() 로 안 죽는다 — 그룹째, 터졌을 때도 (§9-0-53) */
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
const killVite = () => { try { process.kill(-vite.pid, 'SIGKILL'); } catch { vite.kill('SIGKILL'); } };
process.on('uncaughtException', (e) => { console.error(e); killVite(); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(e); killVite(); process.exit(1); });
await sleep(4000);
const b = await chromium
  .launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  .catch(() => chromium.launch());

let bad = 0;
const errs = [];
const eq = (label, got, want) => {
  const a = JSON.stringify(got), c = JSON.stringify(want);
  if (a === c) return console.log(`  ok   ${label}`);
  bad++;
  console.log(`  FAIL ${label}\n       got  ${a}\n       want ${c}`);
};

const open = async (qs = '', w = 390) => {
  const p = await b.newPage({ viewport: { width: w, height: 980 } });
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|status of 404/.test(m.text())) errs.push('console: ' + m.text());
  });
  await p.goto(`http://127.0.0.1:${PORT}/tools/_shopscreen-preview.html?${qs}`, { waitUntil: 'networkidle' });
  await p.locator('.shop-row').first().waitFor({ timeout: 15000 });
  await sleep(350);
  return p;
};

const pickTab = async (p, label) => {
  await p.locator(`.seg .pbtn:has-text("${label}")`).click();
  await p.locator('.shop-row').first().waitFor({ timeout: 15000 });
  await sleep(250);
};

// ── ①② 탭 셋 · 이름과 값 ─────────────
{
  const p = await open('shoes=12000');
  const r = await p.evaluate(() => ({
    title: document.querySelector('.screen-title')?.textContent ?? '',
    tabs: [...document.querySelectorAll('.seg .pbtn')].map((x) => x.textContent),
    on: document.querySelector('.seg .pbtn.on')?.textContent ?? '',
    rows: [...document.querySelectorAll('.shop-row')].map((x) => [
      x.querySelector('.shop-name').textContent,
      x.querySelector('.shop-cost')?.textContent ?? '',
    ]),
    wearTitle: document.querySelector('.wear-title')?.textContent ?? '',
    cuts: [...document.querySelectorAll('.wear-cut figcaption')].map((x) => x.textContent),
  }));
  console.log('①② 타이틀 · 카테고리 셋 · 악세사리 다섯');
  eq('제목', r.title, '아이템 쇼핑');
  eq('★ 카테고리 셋', r.tabs, ['악세사리', '날개', '반려견']);
  eq('처음엔 악세사리', r.on, '악세사리');
  eq('★ 악세사리 다섯 (이름·값 사용자 지정 그대로)', r.rows, [
    ['중절모', '신발 1,000개'],
    ['야구모자', '신발 1,000개'],
    ['베레모', '신발 2,000개'],
    ['레게머리가발', '신발 3,000개'],
    ['왕관', '신발 4,000개'],
  ]);
  eq('★ 착용 모습 타이틀', r.wearTitle, '아이템 착용 모습');
  eq('★ 정면·옆모습 두 컷', r.cuts, ['정면', '옆모습']);
  await p.screenshot({ path: 'tools/_out/shop_acc.png' });

  await pickTab(p, '날개');
  eq('★ 날개 셋', await p.evaluate(() => [...document.querySelectorAll('.shop-row')].map((x) => [
    x.querySelector('.shop-name').textContent, x.querySelector('.shop-cost')?.textContent ?? ''])), [
    ['비둘기날개', '신발 3,000개'],
    ['천사날개', '신발 5,000개'],
    ['악마날개', '신발 10,000개'],
  ]);
  await p.screenshot({ path: 'tools/_out/shop_wing.png' });

  await pickTab(p, '반려견');
  eq('★ 반려견 셋', await p.evaluate(() => [...document.querySelectorAll('.shop-row')].map((x) => [
    x.querySelector('.shop-name').textContent, x.querySelector('.shop-cost')?.textContent ?? ''])), [
    ['강아지', '신발 5,000개'],
    ['고양이', '신발 5,000개'],
    ['따라다니는별', '신발 5,000개'],
  ]);
  await p.screenshot({ path: 'tools/_out/shop_pet.png' });
  await p.close();
}

// ── ③④⑤ 고르면 그 자리에서 입는다 · 날개는 뒤에 ─────────────
{
  const p = await open('shoes=12000');
  // 안 산 것을 골라도 미리보기는 나와야 한다 — 값이 최대 1만이라 사기 전에 봐야 한다
  await p.locator('.shop-row:has-text("왕관")').click();
  await sleep(250);
  const crown = await p.evaluate(() => {
    const parts = [...document.querySelectorAll('.wear-cut')[0].querySelectorAll('.wear-part')];
    return {
      n: parts.length,
      last: parts[parts.length - 1].getAttribute('src'),
      broken: parts.filter((i) => i.naturalWidth === 0).length,
      btn: document.querySelector('.screen .pbtn.primary')?.textContent ?? '',
    };
  });
  console.log('\n③④ 고르면 그 자리에서 입는다 (사기 전에도)');
  eq('캐릭터 + 아이템 두 장', crown.n, 2);
  eq('★ 왕관이 얹힌다', crown.last, '/assets/items/hat_crown_front.png');
  eq('★ 그림이 실제로 뜬다', crown.broken, 0);
  eq('안 산 것은 구매 버튼', crown.btn, '구매하기 (신발 4,000개)');

  await pickTab(p, '날개');
  await p.locator('.shop-row:has-text("천사날개")').click();
  await sleep(250);
  const wing = await p.evaluate(() => {
    const parts = [...document.querySelectorAll('.wear-cut')[0].querySelectorAll('.wear-part')];
    return {
      first: parts[0].getAttribute('src'),
      broken: parts.filter((i) => i.naturalWidth === 0).length,
    };
  });
  console.log('\n⑤ 날개는 캐릭터 **뒤**에 그려진다');
  eq('★ 날개가 먼저(= 뒤에) 붙는다', wing.first, '/assets/items/wing_angel_front.png');
  eq('그림이 실제로 뜬다', wing.broken, 0);
  await p.close();
}

// ── ③-b 사면 바로 입고, 딱지가 바뀐다 ─────────────
{
  const p = await open('shoes=12000');
  await p.locator('.shop-row:has-text("베레모")').click();
  await sleep(200);
  await p.locator('.screen .pbtn.primary').click();
  // 구매는 한 번 되묻는다 (`ui.confirmDialog`) — 값이 최대 1만이라 실수로 눌리면 안 된다
  await p.locator('.dialog .pbtn.primary').click();
  await sleep(400);
  const r = await p.evaluate(() => ({
    have: document.querySelector('.shop-row:nth-child(3) .shop-have')?.textContent ?? '',
    cost: document.querySelector('.shop-row:nth-child(3) .shop-cost')?.textContent ?? '',
    wallet: document.querySelector('.shop-wallet')?.textContent ?? '',
    btn: [...document.querySelectorAll('.screen .pbtn')].map((x) => x.textContent).find((t) => t === '벗기' || t === '착용하기'),
  }));
  console.log('\n③-b 사면 바로 입는다');
  eq('★ 값 대신 착용중 딱지', r.have, '착용중');
  eq('값 표시는 사라진다', r.cost, '');
  eq('★ 지갑에서 2,000 빠진다', r.wallet, '보유신발 10,000켤레');
  eq('버튼이 [벗기] 로 바뀐다', r.btn, '벗기');
  await p.close();
}

// ── ⑥ 확대는 정수배 · 좁은 폰에서 안 터진다 ─────────────
console.log('\n⑥ 폭별 — 정수배 확대 · 넘침');
for (const w of [320, 360, 390, 412]) {
  const p = await open('shoes=12000&own=hat_crown&wear=hat_crown', w);
  const r = await p.evaluate(() => {
    const stage = document.querySelector('.wear-stage');
    const inner = document.querySelector('.wear-inner');
    const cs = getComputedStyle(inner);
    const m = /matrix\(([-\d.]+)/.exec(cs.transform);
    const scale = m ? Number(m[1]) : 0;
    const box = stage.getBoundingClientRect();
    const rows = [...document.querySelectorAll('.shop-row')];
    return {
      scale,
      boxW: Math.round(box.width),
      rowOver: rows.filter((x) => x.scrollWidth - x.clientWidth > 0).length,
      nameCut: rows.filter((x) => {
        const n = x.querySelector('.shop-name');
        return n.scrollWidth - n.clientWidth > 0;
      }).length,
      pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  const good = Number.isInteger(r.scale) && r.scale >= 2 && r.rowOver === 0 && r.nameCut === 0 && r.pageOver === 0;
  if (!good) bad++;
  console.log(`  ${w}px  배율 ${r.scale} · 상자 ${r.boxW} · 줄넘침 ${r.rowOver} · 이름잘림 ${r.nameCut} · 가로 ${r.pageOver} ${good ? '✅' : '❌'}`);
  await p.close();
}

// ── 표와 그림이 다 있는가 (44장) ─────────────
{
  const p = await open('shoes=99999');
  const missing = await p.evaluate(async (ids) => {
    const bad = [];
    for (const src of ids) {
      const ok = await new Promise((res) => {
        const im = new Image();
        im.onload = () => res(im.naturalWidth > 0);
        im.onerror = () => res(false);
        im.src = src;
      });
      if (!ok) bad.push(src);
    }
    return bad;
  }, ITEMS.flatMap((it) => [`/assets/items/${it.id}_front.png`, `/assets/items/${it.id}_side.png`]));
  console.log('\n⑦ 그림 22장이 전부 있는가');
  eq('★ 빠진 그림 없음', missing, []);
  await p.close();
}

eq('\n콘솔 오류 없음', errs, []);
await b.close();
killVite();
console.log(bad ? `\n❌ ${bad}건 실패` : '\n✅ 아이템 쇼핑 이상 없음');
process.exit(bad ? 1 : 0);
