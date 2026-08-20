/**
 * 좁은 폰에서 로비 패널이 두 줄로 안 깨지는지 측정.
 *
 * ★ 프로필의 `walletVersion` 은 **반드시 storageLocal.js 의 WALLET_VERSION 과 같아야** 한다.
 *   (2026-08-19 16차) 여기가 2 로 박혀 있어서 앱이 켜질 때마다 `migrateWallet()` 이 돌았고,
 *   도감이 비어 있으니 지갑이 0 으로 복원돼 **화면에 늘 `보유신발 0 켤레` 가 찍혔다.**
 *   1460 켤레(네 자리)를 넣어 뒀는데 정작 재는 건 한 자리였던 것 — 숫자를 키우는 이번
 *   변경에서는 이 상태로 재면 아무 의미가 없다. 자릿수까지 확인하도록 검사를 넣었다.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = 5202;
/**
 * ⚠ vite 는 `npx` 아래에서 돌아 `kill()` 이 껍데기만 죽인다 — 서버가 살아남아 다음
 *   실행에서 포트를 빼앗고, 그러면 검사가 **엉뚱한 이유로 실패한다**(16차에 실제로
 *   qa:hoffit 이 '줄이 0개' 로 실패했다). 프로세스 **그룹째** 죽인다.
 */
const vite = spawn('npx', ['vite','preview','--port',String(PORT),'--host','127.0.0.1'],{stdio:'ignore',detached:true});
await sleep(4500);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}).catch(()=>chromium.launch());
let bad=0;
for (const w of [320, 360, 390, 412]) {
  const p=await b.newPage({viewport:{width:w,height:760}});
  await p.goto(`http://127.0.0.1:${PORT}/`);
  await p.evaluate(()=>localStorage.setItem('sf_profile',JSON.stringify({uid:'d',nickname:'이안',shoesOwned:1460,shoesByIndex:{0:1460},selectedCharacter:'ian',difficulty:'normal',bestStairs:5432,multiWins:17,multiLosses:33,ownedCharacters:['ian'],walletVersion:1,dexBadgeAt:1})));
  /**
   * 도감도 채워 둔다 — 비어 있으면 화면에 늘 `신발도감 0 / 130켤레` 가 찍혀서
   * **자릿수가 늘어났을 때 줄이 터지는지**를 못 본다(지갑 쪽에서 이미 한 번 데였다).
   */
  await p.evaluate(() => {
    const dex = {};
    for (let i = 0; i < 87; i++) dex[i] = { count: 3, at: 1 };
    localStorage.setItem('sf_collection', JSON.stringify(dex));
  });
  await p.reload(); await sleep(1600);
  await p.evaluate(()=>window.__dbg?.nav?.reset(window.__dbg.screens.Lobby));
  await sleep(500);
  const r = await p.evaluate(() => {
    const panel=document.querySelector('.panel');
    const img=panel.querySelector('.char-cell');
    const badges=panel.querySelector('.badges');
    const st=panel.querySelector('.stats');
    return {
      panelH: Math.round(panel.getBoundingClientRect().height),
      // 뱃지 top 이 캐릭터 top 과 비슷하면 같은 줄, 크게 아래면 밀린 것
      charTop: Math.round(img.getBoundingClientRect().top),
      badgeTop: Math.round(badges.getBoundingClientRect().top),
      overflow: panel.scrollWidth - panel.clientWidth,
      statsRight: Math.round(st.getBoundingClientRect().right),
      badgeLeft: Math.round(badges.getBoundingClientRect().left),
      name: panel.querySelector('.char-name')?.textContent,
      // 최고기록/보유신발 숫자 canvas 의 크기 — 두 숫자가 같은 크기여야 한다 (사용자 지정)
      bestH: panel.querySelector('.stat-best:not(.stat-shoes) canvas')?.height ?? 0,
      shoesH: panel.querySelector('.stat-shoes canvas')?.height ?? 0,
      shoesW: panel.querySelector('.stat-shoes canvas')?.width ?? 0,
      shoesTxt: panel.querySelector('.stat-shoes')?.textContent,
      dexTxt: [...panel.querySelectorAll('.stats div')].map((d) => d.textContent).find((t) => t.includes('신발도감')) ?? '',
      multiTxt: [...panel.querySelectorAll('.stats div')].map((d) => d.textContent).find((t) => t.includes('멀티게임')) ?? '',
      // 숫자 span 이 실제로 더 큰지 — 4곳 전부 (사용자 지정 "숫자부분만 2단계 크게")
      numCount: panel.querySelectorAll('.stats .stat-num').length,
      numSize: [...new Set([...panel.querySelectorAll('.stats .stat-num')].map((n) => getComputedStyle(n).fontSize))].join(','),
      baseSize: getComputedStyle(panel.querySelector('.stats')).fontSize,
    };
  });
  const sameRow = Math.abs(r.badgeTop - r.charTop) < 40;
  const sameSize = r.bestH > 0 && r.bestH === r.shoesH;
  // 네 자리(1460)가 실제로 그려졌는지 — 자리당 폭이 있으니 폭으로 확인한다
  const digits = r.shoesW >= 4 * 6; // 7px 폰트 mono 자리폭 × scale2 ≈ 12px/자
  // 17차 사용자 지정 문구 그대로인지 — 이름도 빗금도 **띄어쓰기 없이** 붙인다
  const dexOk = /^신발도감 \d+\/\d+켤레$/.test(r.dexTxt) && /^멀티게임 \d+승\/\d+게임$/.test(r.multiTxt);
  const ok = sameRow && r.overflow <= 0 && r.statsRight <= r.badgeLeft + 1 && sameSize && digits && dexOk
    && r.numCount === 4 && r.numSize === '17px' && r.baseSize === '13px';
  if (!ok) bad++;
  console.log(`  ${w}px  높이=${r.panelH}  뱃지같은줄=${sameRow?'O':'X'}  넘침=${r.overflow}  숫자높이 최고기록=${r.bestH}/보유신발=${r.shoesH}  보유칸폭=${r.shoesW}  "${r.shoesTxt}"  "${r.dexTxt} · ${r.multiTxt}"  숫자칸 ${r.numCount}개 ${r.numSize}(본문 ${r.baseSize})  ${ok?'✅':'❌'}`);
  if (w === 390) await p.locator('.panel').screenshot({ path: 'tools/_out/lobby_panel.png' });
  await p.close();
}
await b.close(); try { process.kill(-vite.pid); } catch { vite.kill(); }
console.log(bad? `\n❌ ${bad}개 폭에서 실패` : '\n✅ 320~412px 전부 한 줄 유지 · 넘침 없음');
process.exit(bad?1:0);
