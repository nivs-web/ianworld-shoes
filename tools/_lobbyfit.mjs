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
      /**
       * 28차: 캐릭터 칸은 png 한 장이 아니라 **착용 모습 한 컷**이다(`wearFigure.js`).
       * 그림틀(`.char-figure`)의 크기와, 그 안의 캐릭터 그림이 실제로 몇 px 로 보이는지를
       * 따로 잰다 — 틀은 넓히고 캐릭터는 줄이는 것이 이번 요청이라 둘을 같이 봐야 한다.
       */
      figW: Math.round(panel.querySelector('.char-figure').getBoundingClientRect().width),
      figH: Math.round(panel.querySelector('.char-figure').getBoundingClientRect().height),
      imgW: Math.round(panel.querySelector('.char-figure .wear-part[src*="characters"]').getBoundingClientRect().width),
      imgH: Math.round(panel.querySelector('.char-figure .wear-part[src*="characters"]').getBoundingClientRect().height),
      // 그림틀 아래끝 ~ 이름 위끝
      nameGap: Math.round(panel.querySelector('.char-name').getBoundingClientRect().top
        - panel.querySelector('.char-figure').getBoundingClientRect().bottom),
      pageScroll: document.getElementById('ui').scrollHeight - document.getElementById('ui').clientHeight,
    };
  });
  const sameRow = Math.abs(r.badgeTop - r.charTop) < 40;
  /** 18차 사용자 지정 — 순서(멀티게임이 신발도감보다 위)와 문구를 그대로 못 박는다 */
  const WANT = [
    /^최고기록 \d+계단$/,
    /^보유신발 \d+켤레$/,
    /^멀티게임 \d+승\d+게임$/,
    // 22차: 분모를 뺐다 (사용자 지정). 완성하면 뒤에 `, 도감완성` 이 붙는다
    /^신발도감 \d+켤레(, 도감완성)?$/,
  ];
  const txtOk = r.lines.length === 4 && WANT.every((re, i) => re.test(r.lines[i].txt));
  /**
   * 네 줄의 숫자가 **전부 같은 높이**여야 한다. 값은 **18** — 9px 미니 글꼴 ×2 다
   * (23차 사용자 지정 "17~18px". 그 전에는 7px×3 = 21 이었다).
   * 외곽선을 안 쓰므로 여백이 0이다(18차: 외곽선 여백이 곧 가짜 띄어쓰기였다).
   */
  const sizes = [...new Set(r.lines.flatMap((l) => l.numH.split(',')))];
  const sameSize = sizes.length === 1 && sizes[0] === '18';
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

  /**
   * ★ **왕관 딱지가 붙은 상태도 재 본다.** (2026-08-19 23차)
   * 숫자를 21 → 18px 로 줄인 이유가 이 딱지 자리를 만들기 위해서다 — 딱지가 없는
   * 상태만 재면 정작 좁아지는 경우를 못 본다(22차의 도감완성에서 이미 한 번 데였다).
   */
  {
    await p.evaluate(() => localStorage.setItem('sf_crowns',
      JSON.stringify({ shoes: 1, wins: 2, at: Date.now() })));
    await p.reload(); await sleep(1600);
    await p.evaluate(() => window.__dbg?.nav?.reset(window.__dbg.screens.Lobby));
    await sleep(500);
    const c = await p.evaluate(() => {
      const lines = [...document.querySelectorAll('.panel .stats .stat-line')];
      const txt = (n) => [...n.childNodes].map((k) => (k.nodeType === 3 ? k.textContent
        : (k.dataset?.text ?? k.textContent))).join('');
      return {
        tags: lines.map((l) => l.querySelector('.stat-done')?.textContent ?? ''),
        cut: lines.map((l) => l.scrollWidth - l.clientWidth),
        lines: lines.map(txt),
        overflow: document.querySelector('.panel').scrollWidth - document.querySelector('.panel').clientWidth,
      };
    });
    // 딱지는 **보유신발(2번째)·멀티게임(3번째)** 두 줄에만. 최고기록에는 없다(사용자 지정)
    // 이 시점의 도감은 바로 위 단계에서 130종을 채워 뒀다 — 그 딱지도 그대로 있어야 한다
    const want = ['', '신발왕', '승리2위', '도감완성'];
    const tagOk = JSON.stringify(c.tags) === JSON.stringify(want);
    const fitOk = c.cut.every((x) => x <= 0) && c.overflow <= 0;
    if (!tagOk || !fitOk) bad++;
    console.log(`         왕관딱지 → [${c.tags.join('|')}] 잘림=[${c.cut.join(',')}] 넘침=${c.overflow} ${tagOk && fitOk ? '✅' : '❌'}`);
    if (w === 390) await p.locator('.panel').screenshot({ path: 'tools/_out/lobby_panel_crown.png' });
    await p.evaluate(() => localStorage.removeItem('sf_crowns'));
  }

  /**
   * ★ **아이템을 전부 착용한 상태를 잰다.** (2026-08-21 28차, 사용자 지정)
   *
   * *"이 부분의 표가 작은 스마트폰 화면에서 깨지지 않는지 테스트 해봐"*
   *
   * 가장 큰 조합을 고른다 — 배트맨 가면(머리 위로 7도트 솟는다) · 날개(52폭) ·
   * **무서운호랑이**(35×50, 캐릭터와 같은 크기). 아무것도 안 낀 상태만 재면
   * 정작 자리가 모자라는 경우를 못 본다(도감완성·왕관 딱지에서 두 번 데인 자리다).
   */
  {
    await p.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('sf_profile'));
      raw.ownedItems = { hat_batman: 1, wing_devil: 1, pet_tiger_big: 1 };
      raw.equippedItems = { hat: 'hat_batman', wing: 'wing_devil', pet: 'pet_tiger_big' };
      localStorage.setItem('sf_profile', JSON.stringify(raw));
    });
    await p.reload(); await sleep(1600);
    await p.evaluate(() => window.__dbg?.nav?.reset(window.__dbg.screens.Lobby));
    await sleep(700);
    const g = await p.evaluate(() => {
      const panel = document.querySelector('.panel');
      const fig = panel.querySelector('.char-figure');
      const parts = [...fig.querySelectorAll('img.wear-part')];
      return {
        // 그림이 **실제로 떴는지**는 클래스가 아니라 naturalWidth 로 본다(§9-0-52 왕관)
        parts: parts.map((i) => ({ src: i.getAttribute('src').split('/').pop(), ok: i.naturalWidth > 0 })),
        // 캐릭터보다 **먼저** 붙은 것이 뒤에 그려진다 — 날개·반려견이 앞에 오면 얼굴을 덮는다
        charIndex: parts.findIndex((i) => i.src.includes('/characters/')),
        overflow: panel.scrollWidth - panel.clientWidth,
        panelH: Math.round(panel.getBoundingClientRect().height),
        cut: [...panel.querySelectorAll('.stats .stat-line')].map((d) => d.scrollWidth - d.clientWidth),
        figH: Math.round(fig.getBoundingClientRect().height),
      };
    });
    const drawn = g.parts.every((x) => x.ok) && g.parts.length === 4;
    // 뒤에 그려질 둘(날개·반려견)이 캐릭터보다 앞 자리에 있어야 한다
    const order = g.charIndex === 2;
    const fit = g.overflow <= 0 && g.cut.every((x) => x <= 0);
    if (!drawn || !order || !fit) bad++;
    console.log(`         아이템착용 → 그림 ${g.parts.length}장 [${g.parts.map((x) => `${x.src}${x.ok ? '' : '✗'}`).join(' ')}] 캐릭터순서=${g.charIndex} 그림틀높이=${g.figH} 패널높이=${g.panelH} 넘침=${g.overflow} 잘림=[${g.cut.join(',')}] ${drawn && order && fit ? '✅' : '❌'}`);
    if (w === 390) await p.locator('.panel').screenshot({ path: 'tools/_out/lobby_panel_worn.png' });
    if (w === 320) await p.locator('.panel').screenshot({ path: 'tools/_out/lobby_panel_worn_320.png' });
    await p.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('sf_profile'));
      delete raw.ownedItems; delete raw.equippedItems;
      localStorage.setItem('sf_profile', JSON.stringify(raw));
    });
    await p.reload(); await sleep(1200);
    await p.evaluate(() => window.__dbg?.nav?.reset(window.__dbg.screens.Lobby));
    await sleep(400);
  }

  if (w === 390) await p.locator('.panel').screenshot({ path: 'tools/_out/lobby_panel.png' });
  // 좁은 폰의 접힌 배치도 한 장 남긴다 — 눈으로 확인할 길이 이것뿐이다
  if (w === 320) await p.locator('.panel').screenshot({ path: 'tools/_out/lobby_panel_320.png' });
  await p.close();
}
await b.close(); try { process.kill(-vite.pid); } catch { vite.kill(); }
console.log(bad? `\n❌ ${bad}개 폭에서 실패` : '\n✅ 320~412px 전부 한 줄 유지 · 넘침 없음');
process.exit(bad?1:0);
