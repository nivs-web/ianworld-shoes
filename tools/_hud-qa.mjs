/** HUD 극단값 스크린샷 — 자릿수가 늘어나도 안 겹치는지 확인 (진단 전용) */
import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:540,height:960}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://127.0.0.1:4173/'); await p.waitForTimeout(2400);
await p.mouse.click(270,480); await p.waitForTimeout(1400);
const cases=[[26,3,0],[268,27,3],[1024,99,9]];
const shots=[];
for(const [floor,shoes,rev] of cases){
  await p.evaluate(([f,s,r])=>{const g=window.__dbg.scene;g.floor=f;g.shoesFound=s;g.revives=r;g.gauge=88;},[floor,shoes,rev]);
  await p.waitForTimeout(250);
  const f=`/tmp/hud_${floor}.png`; await p.screenshot({path:f, clip:{x:0,y:0,width:540,height:210}});
  shots.push(f);
}
console.log(shots.join(' '), 'errors', errs.slice(0,3));
await b.close();
