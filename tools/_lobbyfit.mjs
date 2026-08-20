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
  const p=await b.newPage({viewport:{width:w,height:w===320?568:760}});
  await p.goto(`http://127.0.0.1:${PORT}/`);
  await p.evaluate(()=>localStorage.setItem('sf_profile',JSON.stringify({uid:'d',nickname:'이안',shoesOwned:1460,shoesByIndex:{0:1460},selectedCharacter:'ian',difficulty:'normal',bestStairs:5432,multiWins:17,multiLosses:33,ownedCharacters:['ian'],walletVersion:1,dexBadgeAt:1})));
  /**
   * 도감도 채워 둔다 — 비어 있으면 화면에 늘 `신발도감 0켤레` 가 찍혀서
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
      /**
       * 통계 네 줄 — 순서·문구·숫자 크기·잘림을 한꺼번에 본다 (2026-08-19 18차).
       *
       * ★ **잘림(`scrollWidth > clientWidth`)이 이 검사의 핵심**이다. `.stats` 는
       *   `flex: 1 1 auto` 라 자리가 모자라면 **패널을 넘치는 대신 줄어들고**, 줄 안의
       *   글자는 `text-overflow: ellipsis` 로 잘린다. 즉 좁은 폰에서 문구가 통째로
       *   잘려도 '넘침'은 0 이다 — 그것만 보면 통과처럼 보인다.
       */
      statsW: Math.round(panel.querySelector('.stats').getBoundingClientRect().width),
      lines: [...panel.querySelectorAll('.stats .stat-line')].map((d) => ({
        // 캔버스는 textContent 에 안 잡힌다 — pixelText 가 남긴 dataset.text 로 합친다
        txt: [...d.childNodes].map((n) => (n.nodeType === 3 ? n.textContent : (n.dataset?.text ?? '#'))).join(''),
        want: d.scrollWidth,
        cut: d.scrollWidth - d.clientWidth,
        top: Math.round(d.getBoundingClientRect().top),
        h: Math.round(d.getBoundingClientRect().height),
        numH: [...new Set([...d.querySelectorAll('canvas')].map((c) => c.height))].join(','),
        nums: d.querySelectorAll('canvas').length,
        /**
         * ★ **숫자와 단위 사이의 실제 간격**(2026-08-19 18차 사용자 신고).
         *   *"계단과 켤레라는 글씨가 숫자 옆에 바로 붙어 있어야 하는데"*
         * 캔버스 오른끝 ~ 바로 뒤 글자 왼끝. 문구에 공백이 없으면 0이어야 한다 —
         * 눈으로는 "띄어쓰기한 것 같다" 로만 보이고 어디서 왔는지 알 수 없는 종류다.
         */
        gaps: (() => {
          const out = [];
          const kids = [...d.childNodes];
          for (let i = 0; i < kids.length - 1; i++) {
            const a = kids[i], b = kids[i + 1];
            if (a.nodeType === 3 || b.nodeType !== 3) continue;   // 캔버스 → 글자 경계만
            if (/^\s/.test(b.textContent)) continue;              // 문구에 진짜 공백이 있으면 제외
            const r = document.createRange(); r.selectNodeContents(b);
            out.push(Math.round(r.getBoundingClientRect().left - a.getBoundingClientRect().right));
          }
          return out;
        })(),
      })),
      charW: Math.round(panel.querySelector('.char-cell').getBoundingClientRect().width),
      imgW: Math.round(panel.querySelector('.char-cell img').getBoundingClientRect().width),
      imgH: Math.round(panel.querySelector('.char-cell img').getBoundingClientRect().height),
      // 그림 아래끝 ~ 이름 위끝
      nameGap: Math.round(panel.querySelector('.char-name').getBoundingClientRect().top
        - panel.querySelector('.char-cell img').getBoundingClientRect().bottom),
      pageScroll: document.getElementById('ui').scrollHeight - document.getElementById('ui').clientHeight,
    };
  });
  const sameRow = Math.abs(r.badgeTop - r.charTop) < 40;
  /** 18차 사용자 지정 — 순서(멀티게임이 신발도감보다 위)와 문구를 그대로 못 박는다 */
  const WANT = [
    /^최고기록 \d+계단$/,
    /^보유신발 \d+켤레$/,
    /^멀티게임 \d+승\/\d+게임$/,
    // 22차: 분모를 뺐다 (사용자 지정). 완성하면 뒤에 `, 도감완성` 이 붙는다
    /^신발도감 \d+켤레(, 도감완성)?$/,
  ];
  const txtOk = r.lines.length === 4 && WANT.every((re, i) => re.test(r.lines[i].txt));
  /**
   * 네 줄의 숫자가 **전부 같은 높이**여야 한다. 값은 **21** — 7px 글꼴 ×3 이고
   * 외곽선을 안 쓰므로 여백이 0이다(18차: 외곽선 여백이 곧 가짜 띄어쓰기였다).
   */
  const sizes = [...new Set(r.lines.flatMap((l) => l.numH.split(',')))];
  const sameSize = sizes.length === 1 && sizes[0] === '21';
  /** 줄 간격이 전부 같은가 — 사용자 지정 "모든 줄 간격이 똑같게" */
  const steps = r.lines.slice(1).map((l, i) => l.top - r.lines[i].top);
  const evenRows = new Set(steps).size === 1;
  /** 어느 줄도 잘리지 않았는가 (좁은 폰에서 이게 제일 먼저 깨진다) */
  const cut = r.lines.filter((l) => l.cut > 0);
  /** 붙어야 할 곳이 실제로 붙었는가 (1px 은 반올림 오차로 허용) */
  const allGaps = r.lines.flatMap((l) => l.gaps);
  const stuck = allGaps.every((g) => g <= 1);
  /**
   * 355px 아래에서는 뱃지가 **아랫줄로 내려간다**(의도한 동작) — 그때는 '같은 줄' 과
   * '통계 오른끝 < 뱃지 왼끝' 을 따지지 않는다. 그 대신 뱃지가 정말 아래로 갔는지 본다.
   */
  const wrapped = !sameRow;
  const layoutOk = wrapped ? (w <= 355 && r.badgeTop > r.charTop) : (r.statsRight <= r.badgeLeft + 1);
  /**
   * 로비는 원래 스크롤되는 메뉴 화면이다(`#ui { overflow-y: auto }`) — 페이지 스크롤은
   * 결함이 아니라 정보다. 값만 찍고 판정에는 넣지 않는다.
   */
  const ok = r.overflow <= 0 && layoutOk && txtOk && sameSize && evenRows && cut.length === 0 && stuck;
  if (!ok) bad++;
  console.log(`  ${w}px  패널높이=${r.panelH} 뱃지${sameRow?'같은줄':'아랫줄'} 넘침=${r.overflow} 캐릭터칸=${r.charW} 그림=${r.imgW}x${r.imgH} 이름간격=${r.nameGap} 줄간격=[${steps.join(',')}] 숫자높이=${sizes.join(',')} 단위붙음=[${allGaps.join(',')}] 통계칸=${r.statsW} 필요폭=[${r.lines.map((l)=>l.want).join(',')}] 잘림=${cut.length?cut.map((c)=>`"${c.txt}"+${c.cut}px`).join(' '):'없음'} 페이지스크롤=${r.pageScroll} ${ok?'✅':'❌'}`);
  if (!txtOk) console.log(`      문구/순서 어긋남: ${r.lines.map((l) => `"${l.txt}"`).join(' | ')}`);
  /**
   * ★ **도감을 다 모은 경우도 재 본다.** (2026-08-19 22차)
   * 완성하면 문구가 `신발도감 130켤레, 도감완성` 으로 **길어진다**(사용자 지정).
   * 87켤레 상태만 재면 그 줄이 좁은 폰에서 잘리는 걸 못 본다 — 이 검사는 원래
   * "잘림은 넘침으로 안 잡힌다"를 잡으려고 만든 것이다(18차).
   */
  {
    await p.evaluate(() => {
      const dex = {};
      for (let i = 0; i < 130; i++) dex[i] = { count: 3, at: 1 };
      localStorage.setItem('sf_collection', JSON.stringify(dex));
    });
    await p.reload(); await sleep(1600);
    await p.evaluate(() => window.__dbg?.nav?.reset(window.__dbg.screens.Lobby));
    await sleep(500);
    const d = await p.evaluate(() => {
      const line = [...document.querySelectorAll('.panel .stats .stat-line')].pop();
      return {
        // 캔버스는 dataset.text, 배지는 textContent — 둘 다 눈에 보이는 글자다
        txt: [...line.childNodes].map((n) => (n.nodeType === 3 ? n.textContent
          : (n.dataset?.text ?? n.textContent))).join(''),
        cut: line.scrollWidth - line.clientWidth,
        overflow: document.querySelector('.panel').scrollWidth - document.querySelector('.panel').clientWidth,
      };
    });
    const doneOk = d.txt === '신발도감 130켤레도감완성' && d.cut <= 0 && d.overflow <= 0;   // 배지라 사이에 공백이 없다
    if (!doneOk) bad++;
    console.log(`         도감완성 → "${d.txt}" 잘림=${d.cut}px 넘침=${d.overflow} ${doneOk ? '✅' : '❌'}`);
    if (w === 390) await p.locator('.panel').screenshot({ path: 'tools/_out/lobby_panel_dexdone.png' });
  }

  if (w === 390) await p.locator('.panel').screenshot({ path: 'tools/_out/lobby_panel.png' });
  // 좁은 폰의 접힌 배치도 한 장 남긴다 — 눈으로 확인할 길이 이것뿐이다
  if (w === 320) await p.locator('.panel').screenshot({ path: 'tools/_out/lobby_panel_320.png' });
  await p.close();
}
await b.close(); try { process.kill(-vite.pid); } catch { vite.kill(); }
console.log(bad? `\n❌ ${bad}개 폭에서 실패` : '\n✅ 320~412px 전부 한 줄 유지 · 넘침 없음');
process.exit(bad?1:0);
