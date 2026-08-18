/** 좁은 폰에서 로비 패널이 두 줄로 안 깨지는지 측정 (진단 전용) */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = 5202;
const vite = spawn('npx',['vite','preview','--port',String(PORT),'--host','127.0.0.1'],{stdio:'ignore'});
await sleep(4500);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}).catch(()=>chromium.launch());
let bad=0;
for (const w of [320, 360, 390, 412]) {
  const p=await b.newPage({viewport:{width:w,height:760}});
  await p.goto(`http://127.0.0.1:${PORT}/`);
  await p.evaluate(()=>localStorage.setItem('sf_profile',JSON.stringify({uid:'d',nickname:'이안',shoesOwned:1460,shoesByIndex:{0:1460},selectedCharacter:'ian',difficulty:'normal',bestStairs:5432,multiWins:17,multiLosses:33,ownedCharacters:['ian'],walletVersion:2,dexBadgeAt:1})));
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
    };
  });
  const sameRow = Math.abs(r.badgeTop - r.charTop) < 40;
  const ok = sameRow && r.overflow <= 0 && r.statsRight <= r.badgeLeft + 1;
  if (!ok) bad++;
  console.log(`  ${w}px  높이=${r.panelH}  뱃지같은줄=${sameRow?'O':'X'}  넘침=${r.overflow}  이름="${r.name}"  ${ok?'✅':'❌'}`);
  await p.close();
}
await b.close(); vite.kill();
console.log(bad? `\n❌ ${bad}개 폭에서 실패` : '\n✅ 320~412px 전부 한 줄 유지 · 넘침 없음');
process.exit(bad?1:0);
