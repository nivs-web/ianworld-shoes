/**
 * 아이템 쇼핑 — **화면을 실제로 띄워서** 확인한다. (2026-08-21 26차)
 *
 * 사용자 지정을 브라우저에게 묻는다:
 *   ① 타이틀 `아이템 쇼핑`, 그 바로 아래 카테고리 셋 `[악세사리][날개][반려견]`
 *   ② 스물한 가지의 이름과 값이 사용자가 준 그대로 (30차에 박쥐날개·다람쥐 추가)
 *   ③ 아래에 `아이템 착용 모습` — **미리보기 · 현재 모습 두 컷(둘 다 정면)**
 *   ④ 고르면 그 자리에서 캐릭터가 입는다 (사기 **전에도** 보인다 — 값이 최대 1만이다)
 *   ⑤ 날개·반려견은 캐릭터 **뒤**에 그려진다
 *   ⑥ 확대가 **정수배**다 (§3-1 — 1.93배면 도트가 뭉갠다)
 *   ⑦ 버튼 하나가 **세 얼굴**을 한다 — 구매하기 / 착용하기 / 착용해제
 *   ⑧ 맨 아래는 `[나가기]` — 28차에 `[모든 아이템 착용 해제]` 를 **뺐다**(사용자 지정:
 *      *"착용 여러번 눌러서 착용 해제 하면 되기 때문이고, 아이템이 없는 사람도 많을
 *      것인데"*). 큰 버튼이 이미 착용/해제를 토글하므로 기능이 겹쳤다.
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

/**
 * ★ **시각을 못 박고 연다** (2026-08-21 32차).
 *
 * 하루 5분(19:30~19:35 KST) 동안 배트맨마스크가 500켤레가 되므로, 시각을 안 정하면
 * **하필 그 5분에 돌린 검사만 실패한다** — 코드는 멀쩡한데 값이 다르다고 하는,
 * 원인을 알 수 없는 종류의 실패다. 기본은 창 **밖**이고, 창 안을 보고 싶은 검사만
 * `nowms` 를 직접 넘긴다.
 */
const 기본시각 = Date.parse('2026-08-21T12:00:00+09:00');

const open = async (qs = '', w = 390) => {
  if (!/(^|&)nowms=/.test(qs)) qs += `${qs ? '&' : ''}nowms=${기본시각}`;
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
  eq('★ 악세사리 일곱 (이름·값 사용자 지정 그대로)', r.rows, [
    ['중절모', '신발 1,000개'],
    ['야구모자', '신발 1,000개'],
    ['베레모', '신발 2,000개'],
    ['레게머리가발', '신발 3,000개'],
    ['왕관', '신발 5,000개'],
    ['아이언맨마스크', '신발 7,000개'],
    ['배트맨마스크', '신발 7,000개'],
  ]);
  eq('★ 착용 모습 타이틀', r.wearTitle, '아이템 착용 모습');
  // 둘 다 정면이고 **하는 일이 다르다** — 왼쪽은 입어 본 모습, 오른쪽은 실제 착용
  eq('★ 미리보기 · 현재 모습 두 컷', r.cuts, ['미리보기', '현재 모습']);
  await p.screenshot({ path: 'tools/_out/shop_acc.png' });

  await pickTab(p, '날개');
  /**
   * 28차: 색 날개 셋이 **비둘기 바로 아래**에 이어 붙는다 — 순서까지 사용자 지정이다.
   * 30차: 박쥐날개가 **맨 위**(사용자 지정).
   */
  eq('★ 날개 일곱 (박쥐가 맨 위 · 색 셋은 비둘기 아래)', await p.evaluate(() => [...document.querySelectorAll('.shop-row')].map((x) => [
    x.querySelector('.shop-name').textContent, x.querySelector('.shop-cost')?.textContent ?? ''])), [
    ['박쥐날개', '신발 1,000개'],
    ['비둘기날개', '신발 3,000개'],
    ['파랑날개', '신발 3,000개'],
    ['노랑날개', '신발 3,000개'],
    ['초록날개', '신발 3,000개'],
    ['천사날개', '신발 5,000개'],
    ['악마날개', '신발 10,000개'],
  ]);
  await p.screenshot({ path: 'tools/_out/shop_wing.png' });

  await pickTab(p, '반려견');
  /**
   * 28차: 사자·호랑이는 **고양이 다음**, 무서운호랑이는 맨 끝(사용자 지정).
   * 30차: 다람쥐가 **맨 위**(사용자 지정).
   */
  eq('★ 반려견 일곱 (다람쥐가 맨 위)', await p.evaluate(() => [...document.querySelectorAll('.shop-row')].map((x) => [
    x.querySelector('.shop-name').textContent, x.querySelector('.shop-cost')?.textContent ?? ''])), [
    ['다람쥐', '신발 2,000개'],
    ['강아지', '신발 5,000개'],
    ['고양이', '신발 5,000개'],
    ['귀여운사자', '신발 7,000개'],
    ['귀여운호랑이', '신발 7,000개'],
    ['따라다니는별', '신발 10,000개'],
    ['무서운호랑이', '신발 10,000개'],
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
  eq('안 산 것은 구매 버튼', crown.btn, '구매하기 (신발 5,000개)');

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
    btn: [...document.querySelectorAll('.screen .pbtn')].map((x) => x.textContent).find((t) => t === '착용해제' || t === '착용하기'),
  }));
  console.log('\n③-b 사면 바로 입는다');
  eq('★ 값 대신 착용 뱃지', r.have, '착용 중인 아이템');
  eq('값 표시는 사라진다', r.cost, '');
  eq('★ 지갑에서 2,000 빠진다', r.wallet, '보유신발 10,000켤레');
  eq('버튼이 [착용해제] 로 바뀐다', r.btn, '착용해제');
  await p.close();
}

// ── ⑦ 뱃지 두 가지 · 버튼 세 얼굴 ─────────────
{
  const p = await open('shoes=12000&own=hat_crown,hat_beret&wear=hat_crown');
  console.log('\n⑦ 산 것 / 입은 것 뱃지 · 버튼 세 얼굴');
  const badges = await p.evaluate(() => [...document.querySelectorAll('.shop-row')].map((x) => [
    x.querySelector('.shop-name').textContent,
    x.querySelector('.shop-have')?.textContent ?? x.querySelector('.shop-cost').textContent,
    x.querySelector('.shop-have')?.classList.contains('on') ?? null,
  ]));
  eq('★ 안 산 것은 값', badges[0], ['중절모', '신발 1,000개', null]);
  eq('★ 샀지만 안 입은 것', badges[2], ['베레모', '착용 가능 아이템', false]);
  eq('★ 입은 것', badges[4], ['왕관', '착용 중인 아이템', true]);
  // 뱃지는 "떴다"가 아니라 "읽힌다"가 통과 조건이다 — 색을 계산값으로 본다 (§9-0-50)
  const 색 = await p.evaluate(() => {
    const on = document.querySelector('.shop-row:nth-child(5) .shop-have');
    const off = document.querySelector('.shop-row:nth-child(3) .shop-have');
    const g = (e) => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor];
    return { on: g(on), off: g(off) };
  });
  eq('★ 착용중은 채운 초록', 색.on[1] !== 'rgba(0, 0, 0, 0)' && 색.on[0] !== 색.on[1], true);
  eq('★ 보유중은 테두리만', 색.off[1], 'rgba(0, 0, 0, 0)');

  // 버튼 세 얼굴 — 입은 것 → 착용해제
  // ⚠ `.seg` 의 카테고리 탭도 `.pbtn` 이다 — 걸러내지 않으면 '악세사리'가 잡힌다
  eq('★ 입은 것: 착용해제', await p.evaluate(() =>
    [...document.querySelectorAll('.screen .pbtn')].filter((b) => !b.closest('.seg'))[0].textContent), '착용해제');
  await p.locator('.shop-row:has-text("베레모")').click();
  await sleep(200);
  eq('★ 샀지만 안 입은 것: 착용하기',
    await p.evaluate(() => [...document.querySelectorAll('.screen .pbtn')].map((b) => b.textContent).find((t) => t === '착용하기' || t === '착용해제')), '착용하기');
  await p.close();
}

// ── ⑧ 현재 모습은 **착용한 것 전부** · 미리보기는 고른 것을 입어 본 모습 ─────────────
{
  const p = await open('shoes=99999&own=hat_crown,wing_angel,pet_dog,hat_beret&wear=hat_crown,wing_angel,pet_dog');
  console.log('\n⑧ 미리보기 vs 현재 모습');
  const 컷 = await p.evaluate(() => [...document.querySelectorAll('.wear-cut')].map((c) =>
    [...c.querySelectorAll('.wear-part')].map((i) => i.getAttribute('src').split('/').pop())));
  eq('★ 현재 모습에 셋이 다 있다 (캐릭터 포함 네 장)', 컷[1].length, 4);
  eq('★ 날개가 맨 먼저(= 뒤에)', 컷[1][0], 'wing_angel_front.png');
  eq('★ 두 컷 다 정면 그림', 컷.flat().every((f) => f.endsWith('_front.png')), true);
  // 베레모를 고르면 **모자 자리만** 갈린다 — 날개·반려견은 그대로 있어야 한다
  await p.locator('.shop-row:has-text("베레모")').click();
  await sleep(250);
  const 미리 = await p.evaluate(() => [...document.querySelectorAll('.wear-cut')[0].querySelectorAll('.wear-part')].map((i) => i.getAttribute('src').split('/').pop()));
  eq('★ 미리보기: 고른 모자로 갈린다', 미리.includes('hat_beret_front.png'), true);
  eq('★ 미리보기: 날개·반려견은 그대로', 미리.includes('wing_angel_front.png') && 미리.includes('pet_dog_front.png'), true);
  const 현재 = await p.evaluate(() => [...document.querySelectorAll('.wear-cut')[1].querySelectorAll('.wear-part')].map((i) => i.getAttribute('src').split('/').pop()));
  eq('★ 현재 모습은 안 바뀐다 (착용하기를 눌러야 바뀐다)', 현재.includes('hat_crown_front.png'), true);
  await p.close();
}

// ── ⑨ 맨 아래는 [나가기] 하나뿐이다 ─────────────
{
  /**
   * ★ 28차: `[모든 아이템 착용 해제]` 를 **뺐다**(사용자 지정). 검사도 "있는가"에서
   * **"없는가"** 로 뒤집는다 — 지워 놓고 검사만 남겨 두면 다음 사람이 되살린다.
   */
  console.log('\n⑨ 맨 아래 [나가기] — 모두 벗기 버튼은 없다');
  const p0 = await open('shoes=9999&own=hat_crown&wear=hat_crown');
  const btns = await p0.evaluate(() =>
    [...document.querySelectorAll('.screen .pbtn')].filter((b) => !b.closest('.seg')).map((b) => b.textContent));
  eq('★ 맨 아래는 [나가기]', btns.pop(), '나가기');
  eq('★ [모든 아이템 착용 해제] 는 없다', btns.some((t) => t.includes('착용 해제')), false);
  /** 대신 큰 버튼을 두 번 누르면 벗겨진다 — 그래서 없어도 된다는 것이 사용자의 판단이다 */
  await p0.locator('.pbtn:has-text("착용해제")').click();
  await sleep(350);
  const after = await p0.evaluate(() => ({
    parts: [...document.querySelectorAll('.wear-cut')[1].querySelectorAll('.wear-part')].length,
    badges: [...document.querySelectorAll('.shop-have.on')].length,
  }));
  eq('★ 현재 모습이 캐릭터 한 장만 남는다', after.parts, 1);
  eq('★ 착용중 뱃지가 사라진다', after.badges, 0);
  await p0.close();
}

/**
 * ── ⑩ 뱃지 문구는 **둘 다 일곱 글자** · 글자는 한 단계 크게 ── (28차, 사용자 지정)
 *
 * *"착용 중인 아이템 / 착용 가능 아이템 이렇게 (…) 문구를 똑같이 7글자로 바꿔,
 *   그리고 폰트를 딱 1단계 키워도 될거 같아"*
 *
 * 길이가 다르면 목록을 훑을 때 뱃지 왼쪽 끝이 줄마다 들쭉날쭉해 **다른 종류의 표시**로
 * 보인다. 글자 크기는 DOM 사다리 한 칸이 2px 이라 10 → 12px 이 "딱 1단계"다(§3-3).
 */
{
  console.log('\n⑩ 뱃지 — 일곱 글자 · 12px');
  const p = await open('shoes=9999&own=hat_crown,hat_beret&wear=hat_crown');
  const r = await p.evaluate(() => {
    const on = document.querySelector('.shop-have.on');
    const off = [...document.querySelectorAll('.shop-have')].find((n) => !n.classList.contains('on'));
    const px = (n) => getComputedStyle(n).fontSize;
    return { on: on.textContent, off: off.textContent, onPx: px(on), offPx: px(off) };
  });
  const 글자수 = (t) => t.replace(/\s/g, '').length;
  eq('★ 착용중 문구', r.on, '착용 중인 아이템');
  eq('★ 착용가능 문구', r.off, '착용 가능 아이템');
  eq('★ 둘 다 일곱 글자', [글자수(r.on), 글자수(r.off)], [7, 7]);
  eq('★ 한 단계 큰 12px', [r.onPx, r.offPx], ['12px', '12px']);
  await p.screenshot({ path: 'tools/_out/shop_badge.png' });
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
  }, ITEMS.flatMap((it) => [
    `/assets/items/${it.id}_front.png`,
    `/assets/items/${it.id}_side.png`,
    ...(it.jumpCut ? [`/assets/items/${it.id}_jump.png`] : []),
  ]));
  console.log('\n⑩ 그림이 전부 있는가 (정면·옆 + 날개 상승 컷)');
  eq('★ 빠진 그림 없음', missing, []);
  await p.close();
}

// ── ⑪ 이스터 에그 — 하루 5분만 열리는 할인 (32차 사용자 지정) ─────────────
/**
 * *"매일 오후 7시 30분 부터 35분 사이에 배트맨 마스크 신발 500개에 파는 이스터 에그"*
 *
 * 시각을 손에 쥐어야 검사할 수 있다 — 미리보기 페이지가 `?nowms=` 로 `Date.now` 를
 * 갈아 끼운다(검사 페이지에서만. 앱에는 그런 통로가 없다).
 * **창 밖과 창 안 두 상태를 같은 화면 코드로** 띄워 놓고 값·배지·버튼을 나란히 본다.
 */
{
  const 창밖 = Date.parse('2026-08-21T19:36:00+09:00');
  const 창안 = Date.parse('2026-08-21T19:31:00+09:00');
  const 읽기 = async (ms) => {
    const p = await open(`shoes=12000&nowms=${ms}`);
    await pickTab(p, '악세사리');
    // 배트맨마스크 줄을 눌러 큰 버튼까지 그 아이템으로 맞춘다
    await p.locator('.shop-row:has-text("배트맨마스크")').click();
    await sleep(250);
    const r = await p.evaluate(() => {
      const row = [...document.querySelectorAll('.shop-row')]
        .find((x) => x.querySelector('.shop-name').textContent === '배트맨마스크');
      const iron = [...document.querySelectorAll('.shop-row')]
        .find((x) => x.querySelector('.shop-name').textContent === '아이언맨마스크');
      const big = [...document.querySelectorAll('.pbtn')]
        .find((x) => /구매하기/.test(x.textContent));
      const tag = row.querySelector('.shop-sale');
      const cs = tag && getComputedStyle(tag);
      return {
        cost: row.querySelector('.shop-cost')?.textContent ?? '',
        ironCost: iron.querySelector('.shop-cost')?.textContent ?? '',
        tag: tag?.textContent ?? '',
        tagBg: cs?.backgroundColor ?? '',
        tagFg: cs?.color ?? '',
        others: document.querySelectorAll('.shop-sale').length,
        big: big?.textContent ?? '',
      };
    });
    await p.screenshot({ path: `tools/_out/shop_egg_${ms === 창안 ? 'open' : 'shut'}.png` });
    await p.close();
    return r;
  };

  console.log('\n⑪ 이스터 에그 — 19:30~19:35 (KST) 배트맨마스크 500켤레');
  const a = await 읽기(창밖);
  eq('창 밖 — 정가 그대로', a.cost, '신발 7,000개');
  eq('창 밖 — 큰 버튼도 정가', a.big, '구매하기 (신발 7,000개)');
  eq('★ 창 밖에는 배지가 없다', a.others, 0);

  const b2 = await 읽기(창안);
  eq('★ 창 안 — 500켤레', b2.cost, '신발 500개');
  eq('★ 창 안 — 큰 버튼도 500', b2.big, '구매하기 (신발 500개)');
  eq('★ 다른 아이템은 그대로', b2.ironCost, '신발 7,000개');
  eq('★ 배지는 그 줄에만 하나', b2.others, 1);
  eq('배지 문구', b2.tag, '깜짝 할인');
  /**
   * 배지는 **"떴다"가 아니라 "읽힌다"가 통과 조건**이다 — §9-0-37 에서 방 목록의
   * 보유신발 배지가 흰 글씨를 크림색 바탕에 얹어 사실상 안 보인 적이 있다.
   * 그래서 클래스가 아니라 **계산된 색**을 본다.
   */
  eq('★ 배지 바탕이 빨강', b2.tagBg, 'rgb(208, 52, 43)');
  eq('★ 배지 글씨가 밝다', b2.tagFg, 'rgb(255, 244, 214)');
}

eq('\n콘솔 오류 없음', errs, []);
await b.close();
killVite();
console.log(bad ? `\n❌ ${bad}건 실패` : '\n✅ 아이템 쇼핑 이상 없음');
process.exit(bad ? 1 : 0);
