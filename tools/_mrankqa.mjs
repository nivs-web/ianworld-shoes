/**
 * 멀티게임순위 — **화면을 실제로 띄워서** 확인한다. (2026-08-19 23차)
 *
 * 사용자 지정을 브라우저에게 묻는다:
 *   ① 탭 다섯: 승리왕 / 승률왕 / 오늘 / 주간 / 월간, 처음엔 승리왕
 *   ② 등수는 `N위`, 1·2·3위에만 금·은·동 왕관 (내 순위 줄에도)
 *   ③ 승률왕은 맨 위에 규칙 안내, 값 칸에 `총 N게임중 M승으로 P% 승률`
 *   ④ 320~412px 어디서도 줄이 넘치거나 잘리지 않는다
 *
 * 왕관 색은 클래스가 아니라 **실제 이미지 경로**로 본다 — 파일이 없거나 경로가
 * 틀리면 클래스는 그대로 붙어 있고 화면만 깨진다(23차에 실제로 상대 경로 때문에
 * 왕관이 전부 깨진 그림으로 떴다).
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 5252;
/** ⚠ npx 아래의 vite 는 kill() 로 안 죽는다 — 그룹째 죽인다 (§9-0-46) */
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
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

const open = async (w = 390) => {
  const p = await b.newPage({ viewport: { width: w, height: 820 } });
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => {
    // 파비콘 404 는 이 저장소에 favicon.ico 가 없어서 늘 뜬다 — 진짜 오류가 그 뒤에 묻힌다
    if (m.type() === 'error' && !/favicon|status of 404/.test(m.text())) errs.push('console: ' + m.text());
  });
  await p.goto(`http://127.0.0.1:${PORT}/tools/_mrankscreen-preview.html?rows=12&mine=2`, { waitUntil: 'networkidle' });
  /**
   * ★ 줄이 실제로 생길 때까지 기다린다. 고정 시간(500ms)으로는 dev 서버가 처음
   * 의존성을 굽는 실행에서 **빈 화면을 재고** "왕관이 없다"로 실패한다 —
   * 코드가 멀쩡한데 검사만 실패하는 종류라 원인을 찾는 데 시간을 버린다(§9-0-46).
   */
  await p.locator('.rank-list .rank-row').first().waitFor({ timeout: 15000 });
  await sleep(300);
  return p;
};

const pick = async (p, label) => {
  await p.locator(`.hof-tabs .pbtn:has-text("${label}")`).click();
  await p.locator('.rank-list .rank-row').first().waitFor({ timeout: 15000 });
  await sleep(300);
};

// ── ①② 승리왕 (기본 탭) ─────────────
{
  const p = await open();
  const r = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.rank-list .rank-row')];
    return {
      title: document.querySelector('.screen-title')?.textContent ?? '',
      tabs: [...document.querySelectorAll('.hof-tabs .pbtn')].map((x) => x.textContent),
      on: document.querySelector('.hof-tabs .pbtn.on')?.textContent ?? '',
      places: rows.slice(0, 4).map((x) => x.querySelector('.rank-no').textContent),
      crowns: rows.map((x) => x.querySelector('.crown')?.getAttribute('src') ?? ''),
      values: rows.slice(0, 2).map((x) => x.querySelector('.rank-value').textContent),
      // 내 순위 줄(하단 고정)에도 왕관이 붙어야 한다 — 2위로 세워 뒀다
      mineCrown: document.querySelector('.rank-mine .crown')?.getAttribute('src') ?? '',
      /**
       * ★ 24차: 왕관과 `1위` **사이 간격**. 사용자 신고 "간격이 너무 넓어" —
       * 23차에는 숫자가 칸 오른쪽 끝에 붙어 있어서 22px 넘게 벌어졌다.
       */
      crownGap: (() => {
        const row = rows[0];
        const c = row.querySelector('.crown').getBoundingClientRect();
        const n = row.querySelector('.rank-no').getBoundingClientRect();
        return Math.round(n.left - c.right);
      })(),
      minePlace: document.querySelector('.rank-mine .rank-no')?.textContent ?? '',
      notice: !!document.querySelector('.rank-notice'),
      broken: [...document.querySelectorAll('.crown')].filter((i) => i.naturalWidth === 0).length,
    };
  });
  console.log('①② 멀티게임순위 — 탭 다섯 · 등수 · 왕관');
  eq('제목', r.title, '멀티게임순위');
  eq('★ 탭 다섯', r.tabs, ['승리왕', '승률왕', '오늘', '주간', '월간']);
  eq('★ 처음엔 승리왕', r.on, '승리왕');
  eq('★ 등수는 N위', r.places, ['1위', '2위', '3위', '4위']);
  eq('★ 금·은·동은 1~3위에만', r.crowns.slice(0, 4),
    ['/assets/ui/crown_1.png', '/assets/ui/crown_2.png', '/assets/ui/crown_3.png', '']);
  eq('4위부터는 왕관 없음', r.crowns.slice(3).every((s) => s === ''), true);
  eq('★ 왕관 그림이 실제로 뜬다', r.broken, 0);
  eq('★ 내 순위 줄에도 왕관', r.mineCrown, '/assets/ui/crown_2.png');
  eq('내 순위 줄 등수', r.minePlace, '2위');
  eq('값은 승수', r.values, ['128승', '121승']);
  eq('★ 왕관과 등수가 붙어 있다 (≤3px)', r.crownGap >= 0 && r.crownGap <= 3, true);
  eq('승리왕에는 규칙 안내가 없다', r.notice, false);
  await p.screenshot({ path: 'tools/_out/mrank_wins.png' });
  await p.close();
}

// ── ③ 승률왕 ─────────────
{
  const p = await open();
  await pick(p, '승률왕');
  const r = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.rank-list .rank-row')];
    const pctOf = (row) => {
      const box = row.querySelector('.rank-pct');
      return [...box.childNodes].map((n) => n.dataset?.text ?? n.textContent).join('');
    };
    return {
      notice: document.querySelector('.rank-notice')?.textContent ?? '',
      // 안내는 목록보다 **위**에 있어야 한다
      order: (() => {
        const kids = [...document.querySelectorAll('.screen > *')];
        return kids.findIndex((k) => k.matches('.rank-notice')) < kids.findIndex((k) => k.matches('.rank-list, .hint'));
      })(),
      subs: rows.slice(0, 2).map((x) => x.querySelector('.rank-sub').textContent),
      pcts: rows.slice(0, 2).map(pctOf),
      // 승률 숫자는 **비트맵**이라 DOM 글자가 아니다 — 그게 "다른 글꼴"의 증거다
      pctCanvas: rows.slice(0, 2).map((x) => x.querySelector('.rank-pct canvas')?.height ?? 0),
      rows: rows.length,
      on: document.querySelector('.hof-tabs .pbtn.on')?.textContent ?? '',
    };
  });
  console.log('\n③ 승률왕 — 규칙 안내 · 근거와 값 분리 · 잠든 사람 제외');
  eq('탭이 바뀐다', r.on, '승률왕');
  eq('★ 규칙 안내', r.notice,
    '승률왕은 멀티게임을 최소 10게임 이상 진행해야 합니다. 만약 1주일 동안 1게임도 하지 않으면, 승률왕 리스트에서 제외 됩니다.');
  eq('안내가 목록보다 위', r.order, true);
  eq('★ 근거는 판수와 승수만', r.subs, ['168게임중 128승', '164게임중 121승']);
  eq('★ 값은 승률 N%', r.pcts, ['승률76%', '승률74%']);
  eq('★ 승률 숫자는 비트맵 18px', r.pctCanvas, [18, 18]);
  // 대역의 마지막 한 명은 3주째 잠들었다 — 12명 중 11명만 나와야 한다
  eq('★ 일주일 넘게 안 한 사람은 빠진다', r.rows, 11);
  await p.screenshot({ path: 'tools/_out/mrank_rate.png' });
  await p.close();
}

// ── ④ 좁은 폰에서 줄이 안 터지는가 ─────────────
console.log('\n④ 폭별 넘침·잘림');
for (const w of [320, 360, 390, 412]) {
  const p = await open(w);
  const wins = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.rank-list .rank-row')];
    return {
      over: rows.filter((x) => x.scrollWidth - x.clientWidth > 0).length,
      cut: rows.filter((x) => {
        const v = x.querySelector('.rank-value');
        return v.scrollWidth - v.clientWidth > 0;
      }).length,
    };
  });
  await pick(p, '승률왕');
  const rate = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.rank-list .rank-row')];
    return {
      over: rows.filter((x) => x.scrollWidth - x.clientWidth > 0).length,
      // 승률왕 줄은 값이 둘이다 — 근거 칸이 잘리는지 본다(값은 비트맵이라 안 줄어든다)
      cut: rows.filter((x) => {
        const v = x.querySelector('.rank-sub');
        return v.scrollWidth - v.clientWidth > 0;
      }).length,
    };
  });
  const good = wins.over === 0 && wins.cut === 0 && rate.over === 0 && rate.cut === 0;
  if (!good) bad++;
  console.log(`  ${w}px  승리왕 넘침 ${wins.over}·잘림 ${wins.cut} / 승률왕 넘침 ${rate.over}·잘림 ${rate.cut} ${good ? '✅' : '❌'}`);
  await p.close();
}

eq('\n콘솔 오류 없음', errs, []);
await b.close();
try { process.kill(-vite.pid); } catch { vite.kill(); }
console.log(bad ? `\n❌ ${bad}건 실패` : '\n✅ 멀티게임순위 이상 없음');
process.exit(bad ? 1 : 0);
