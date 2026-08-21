/**
 * 테스트 계정(`토토`) — **진짜 앱을 띄워서** 확인한다. (2026-08-21 29차, 사용자 지정)
 *
 * *"아이디 '토토' 라는 아이디에게만 모든 아이템을 다 구매한걸로 만들어"*
 *
 * 이 검사가 `qa:shop` 과 따로 있는 이유: 쇼핑 검사는 `services/profile.js` 를 **대역**으로
 * 갈아 끼우고 화면만 본다(`tools/_shop-stub.js`). 그런데 이번 기능은 그 대역이 대신하는
 * 바로 그 자리, `storageLocal.loadProfile()` 에 있다 — 대역을 낀 채로는 영영 안 지나간다.
 * 그래서 여기서는 **아무것도 갈아 끼우지 않고** 진짜 프로필 경로로 로비→쇼핑을 연다.
 *
 * 보는 것 셋:
 *   ① `토토` 는 열아홉 가지가 전부 `착용 가능 아이템` — 값 표시(`구매하기`)가 하나도 없다
 *   ② **다른 아이디는 그대로다** — 하나도 안 가진 채 값이 보인다 (이게 "에게만" 의 뜻이다)
 *   ③ 신발·캐릭터·착용 상태는 **안 건드린다** — 다른 테스트를 방해하면 안 된다
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 5261;
/** ⚠ npx 아래의 vite 는 kill() 로 안 죽는다 — 그룹째, 터졌을 때도 (§9-0-53) */
const vite = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'],
  { stdio: 'ignore', detached: true });
const killVite = () => { try { process.kill(-vite.pid, 'SIGKILL'); } catch { vite.kill('SIGKILL'); } };
process.on('uncaughtException', (e) => { console.error(e); killVite(); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(e); killVite(); process.exit(1); });
await sleep(4500);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  .catch(() => chromium.launch());

let bad = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) console.log(`       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`);
};

/** 그 닉네임으로 로비 → 아이템 쇼핑까지 열고, 세 탭의 줄 상태를 읽어 온다 */
async function openShop(nickname) {
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|status of 404/.test(m.text())) errs.push(m.text());
  });
  await p.goto(`http://127.0.0.1:${PORT}/`);
  await p.evaluate((nick) => localStorage.setItem('sf_profile', JSON.stringify({
    uid: 'testuid', nickname: nick, selectedCharacter: 'ian', difficulty: 'normal',
    shoesOwned: 1200, shoesByIndex: { 0: 1200 }, ownedCharacters: ['ian'], walletVersion: 1,
  })), nickname);
  await p.reload();
  await sleep(1800);
  await p.evaluate(() => window.__dbg?.nav?.reset(window.__dbg.screens.Lobby));
  await sleep(500);
  await p.locator('.pbtn:has-text("아이템 쇼핑")').click();
  await p.locator('.shop-row').first().waitFor({ timeout: 15000 });
  await sleep(400);

  const rows = [];
  for (const tab of ['악세사리', '날개', '반려견']) {
    await p.locator(`.seg .pbtn:has-text("${tab}")`).click();
    await p.locator('.shop-row').first().waitFor({ timeout: 15000 });
    await sleep(250);
    rows.push(...await p.evaluate(() => [...document.querySelectorAll('.shop-row')].map((r) => ({
      ko: r.querySelector('.shop-name').textContent,
      have: r.querySelector('.shop-have')?.textContent ?? null,
      cost: r.querySelector('.shop-cost')?.textContent ?? null,
    }))));
  }
  const wallet = await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('sf_profile'));
    return {
      shoes: raw.shoesOwned, chars: raw.ownedCharacters, worn: raw.equippedItems ?? {},
      owned: Object.keys(raw.ownedItems ?? {}).length,
    };
  });
  return { p, rows, wallet, errs };
}

console.log('\n① 토토 — 열아홉 가지 전부 착용 가능');
{
  const { p, rows, wallet, errs } = await openShop('토토');
  eq('열아홉 줄', rows.length, 19);
  eq('★ 전부 산 것으로 보인다', rows.filter((r) => r.have === '착용 가능 아이템').length, 19);
  eq('★ 값(구매하기) 표시가 하나도 없다', rows.filter((r) => r.cost).map((r) => r.ko), []);
  eq('저장값에도 열아홉 가지', wallet.owned, 19);
  // ★ 아이템 말고는 아무것도 안 건드린다 — 다른 테스트를 방해하면 안 된다
  eq('★ 신발은 그대로', wallet.shoes, 1200);
  eq('★ 캐릭터도 그대로', wallet.chars, ['ian']);
  eq('★ 착용은 비어 있다 (직접 눌러 보는 것이 목적)', wallet.worn, {});
  eq('콘솔 오류 없음', errs, []);
  await p.screenshot({ path: 'tools/_out/testacct_toto.png' });
  await p.close();
}

console.log('\n② 다른 아이디 — 그대로 (아무것도 안 가진 상태)');
{
  const { p, rows, wallet, errs } = await openShop('이안');
  eq('★ 산 것이 하나도 없다', rows.filter((r) => r.have).length, 0);
  eq('★ 열아홉 줄 전부 값이 보인다', rows.filter((r) => r.cost).length, 19);
  eq('저장값도 비어 있다', wallet.owned, 0);
  eq('콘솔 오류 없음', errs, []);
  await p.close();
}

await b.close();
killVite();
console.log(bad ? `\n❌ ${bad}건 실패` : '\n✅ 테스트 계정 이상 없음');
process.exit(bad ? 1 : 0);
