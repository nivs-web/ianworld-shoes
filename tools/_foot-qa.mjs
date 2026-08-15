/** 착용 신발 QA — 여러 신발/캐릭터에서 맨발이 보이는지 눈으로 확인 (진단 전용) */
import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:540,height:960}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://127.0.0.1:4173/'); await p.waitForTimeout(2400);
await p.mouse.click(270,480); await p.waitForTimeout(1500);
const bx=await p.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return{x:r.x,y:r.y,s:r.width/180};});
const tap=async(sd)=>{await p.mouse.click(bx.x+(sd==='L'?30:150)*bx.s, bx.y+290*bx.s);};
const st=async()=>p.evaluate(()=>{const g=window.__dbg.scene;return{floor:g.floor,need:g.stairs.nextDir(g.floor),facing:g.player.facing,dead:g.player.dead};});
let s=await st();
for(let i=0;i<40&&!s.dead;i++){ await tap(s.need===s.facing?'R':'L'); await p.waitForTimeout(50); s=await st(); if(s.floor>=6) break; }

const chars=['ian','lisa','tony','rose'];
const shoes=[0,60,120];
let n=0;
for(const ch of chars){
  await p.evaluate((c)=>{const {GameScene}=window.__gameModule;
    const sc=new GameScene({difficulty:'normal',charId:c,controlMode:1});
    window.__dbg.Scene.reset(sc); window.__dbg.scene=sc;},ch);
  await p.waitForTimeout(1500);
  for(const sh of shoes){
    for(const f of [1]){
      await p.evaluate(([i,fc])=>{const g=window.__dbg.scene;g.player.shoe=i;g.player.popLeft=0;g.player.facing=fc;g.player.state=1;},[sh,f]);
      await p.waitForTimeout(120);
      await p.screenshot({path:`/tmp/foot_${ch}_${sh}_${f>0?'R':'L'}.png`, clip:{x:bx.x+62*bx.s,y:bx.y+128*bx.s,width:56*bx.s,height:92*bx.s}});
      n++;
    }
  }
}
console.log('shots',n,'errors',errs.slice(0,3));
await b.close();
