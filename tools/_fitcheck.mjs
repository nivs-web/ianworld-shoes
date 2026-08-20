import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = 5201;
/**
 * ⚠ vite 는 `npx` 아래에서 돌아 `kill()` 이 껍데기만 죽인다 — 서버가 살아남아 다음
 *   실행에서 포트를 빼앗고, 그러면 검사가 **엉뚱한 이유로 실패한다**(2026-08-19 16차에
 *   qa:hoffit 이 '줄이 0개' 로 실패했다 — 코드는 멀쩡했다). 프로세스 **그룹째** 죽인다.
 */
const vite = spawn('npx',['vite','--port',String(PORT),'--host','127.0.0.1'],{stdio:'ignore',detached:true});
await sleep(4000);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}).catch(()=>chromium.launch());
// 실제 폰 폭으로 본다
const p=await b.newPage({viewport:{width:360,height:780}});
await p.goto(`http://127.0.0.1:${PORT}/tools/_room-preview.html`,{waitUntil:'networkidle'});
const r = await p.evaluate(() => [...document.querySelectorAll('.player-row')].map((el,i)=>({
  i, over: el.scrollWidth - el.clientWidth,
  tags: el.querySelector('.player-tags')?.getBoundingClientRect().right,
  rowRight: el.getBoundingClientRect().right,
  shoesLeft: Math.round(el.querySelector('.player-shoes').getBoundingClientRect().left),
})));
console.log('넘침(px) / 신발배지 x:');
for (const x of r) console.log(`  row${x.i}  over=${x.over}  shoesLeft=${x.shoesLeft}  tagsRight=${Math.round(x.tags)} rowRight=${Math.round(x.rowRight)}`);
// 패널(프레임)별로 묶어서 본다 — 두 프레임은 x 원점이 다르므로 통째로 비교하면 안 된다
const perPanel = [r.slice(0,4), r.slice(4)];
let ok = true;
perPanel.forEach((rows, i) => {
  const xs=[...new Set(rows.map(x=>x.shoesLeft))];
  const over = rows.filter(x=>x.over>0).length;
  if (xs.length!==1 || over) ok=false;
  console.log(`  패널${i+1}: 배지x=${xs.join(',')} ${xs.length===1?'(고정)':'(흔들림!)'} · 넘침 ${over}건`);
});
console.log(ok ? '\n✅ 레디 상태와 무관하게 배지 위치 고정 · 넘침 없음' : '\n❌ 실패');
process.exit(ok?0:1);
await b.close(); (() => { try { process.kill(-vite.pid); } catch { vite.kill(); } })();
