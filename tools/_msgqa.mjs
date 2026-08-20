/**
 * 받은 메세지함 · 메세지 수신 설정 — **화면을 실제로 띄워서** 확인한다. (2026-08-19 21차)
 *
 * 사용자 지정 네 가지를 눈이 아니라 브라우저에게 묻는다:
 *   ① 차단한 사람의 줄에 **빨간 바탕 + 흰 글씨** `[차단]` 배지
 *   ② 수신 설정이 `[수신차단] [수신허용]` **그 순서**
 *   ③ 버튼 위 `현재상태 : ○○` 한 줄
 *   ④ **수신차단일 때만** 받은 메세지함 맨 위에 빨간 경고
 *
 * 색은 클래스 이름이 아니라 **계산된 값**으로 본다 — CSS 를 옮기다 규칙이 죽어도
 * 클래스는 그대로 붙어 있어서, 이름만 보면 통과처럼 보인다(§9-0-33 의 그 함정).
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 5251;
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

/** 눈으로도 확인할 수 있게 한 장씩 남긴다 — 이 화면은 실기기에서 보기가 번거롭다 */
const shot = async (p, name) => p.screenshot({ path: `tools/_out/msg_${name}.png` });

const open = async (qs) => {
  const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/tools/_msgscreen-preview.html?${qs}`, { waitUntil: 'networkidle' });
  await sleep(500);
  return p;
};

// ── ① 목록의 차단 배지 (수신허용 상태로 연다) ─────────────
{
  const p = await open('accept=1');
  const r = await p.evaluate(() => {
    const badges = [...document.querySelectorAll('.inbox-blocked')];
    const b0 = badges[0];
    const cs = b0 ? getComputedStyle(b0) : null;
    const rowOf = (n) => n.closest('.inbox-row')?.querySelector('.inbox-name')?.textContent;
    return {
      count: badges.length,
      text: b0?.textContent ?? '',
      who: b0 ? rowOf(b0) : '',
      bg: cs?.backgroundColor ?? '',
      fg: cs?.color ?? '',
      rows: document.querySelectorAll('.inbox-row').length,
      notice: !!document.querySelector('.inbox-notice'),
    };
  });
  console.log('① 받은 메세지함 — 차단 배지');
  eq('줄은 네 개', r.rows, 4);
  eq('배지는 차단한 한 사람에게만', r.count, 1);
  eq('그 사람이 맞다', r.who, '로');
  eq('문구', r.text, '차단');
  eq('★ 빨간 바탕', r.bg, 'rgb(178, 58, 46)');
  eq('★ 흰 글씨', r.fg, 'rgb(255, 244, 214)');
  eq('수신허용이면 위 경고는 없다', r.notice, false);
  await shot(p, 'inbox_ok');
  await p.close();
}

// ── ④ 수신차단 상태의 받은 메세지함 ─────────────
{
  const p = await open('accept=0');
  const r = await p.evaluate(() => {
    const n = document.querySelector('.inbox-notice');
    const cs = n ? getComputedStyle(n) : null;
    const kids = [...document.querySelectorAll('.screen > *')];
    return {
      exists: !!n,
      text: n?.textContent ?? '',
      color: cs?.color ?? '',
      // 맨 위여야 한다 — 제목 바로 다음, 목록보다 앞
      iNotice: kids.findIndex((k) => k.matches('.inbox-notice')),
      iList: kids.findIndex((k) => k.matches('.inbox-list, .hint')),
    };
  });
  console.log('\n④ 수신차단 상태 — 받은 메세지함 맨 위 경고');
  eq('★ 경고가 뜬다', r.exists, true);
  eq('문구 그대로', r.text,
    '회원님은 메세지를 받으실 수 없는 수신차단 상태입니다. 메세지 수신 설정 메뉴에서 수신허용을 누르시면 다시 메세지를 받으실 수 있습니다');
  eq('빨간 글씨', r.color, 'rgb(255, 154, 138)');
  eq('목록보다 위', r.iNotice >= 0 && r.iNotice < r.iList, true);
  await shot(p, 'inbox_blocked');
  await p.close();
}

// ── ②③ 메세지 수신 설정 ─────────────
for (const [label, qs, want] of [['수신허용', 'screen=settings&accept=1', '수신허용'],
                                 ['수신차단', 'screen=settings&accept=0', '수신차단']]) {
  const p = await open(qs);
  const r = await p.evaluate(() => {
    const now = document.querySelector('.msg-accept-now');
    const btns = [...document.querySelectorAll('.seg .pbtn')];
    const kids = [...document.querySelectorAll('.screen > *')];
    return {
      nowText: now?.textContent ?? '',
      nowOff: now?.classList.contains('off') ?? false,
      labels: btns.map((x) => x.textContent),
      onIndex: btns.findIndex((x) => x.classList.contains('on')),
      hint: document.querySelector('.hint')?.textContent ?? '',
      iNow: kids.findIndex((k) => k.matches('.msg-accept-now')),
      iSeg: kids.findIndex((k) => k.matches('.seg')),
      iHint: kids.findIndex((k) => k.matches('.hint')),
    };
  });
  console.log(`\n②③ 메세지 수신 설정 — ${label}`);
  eq('★ 버튼 순서', r.labels, ['수신차단', '수신허용']);
  eq('★ 현재상태 줄', r.nowText, `현재상태 : ${want}`);
  eq('지금 상태가 켜진 버튼', r.labels[r.onIndex], want);
  eq('차단이면 글씨도 빨강', r.nowOff, want === '수신차단');
  eq('★ 안내 문구', r.hint, '수신차단 버튼을 누르면, 메세지 받기, 대결신청 등의 기능이 모두 중지됩니다.');
  eq('순서 — 현재상태 → 버튼 → 안내', r.iNow < r.iSeg && r.iSeg < r.iHint, true);
  await shot(p, `settings_${want === '수신차단' ? 'off' : 'on'}`);
  await p.close();
}

// ── ⑤ 22차 — 현재상태 줄 · 탭 셋 · 받음/보냄 색 ─────────────
{
  const p = await open('accept=1');
  const r = await p.evaluate(() => {
    const kids = [...document.querySelectorAll('.screen > *')];
    const tabs = [...document.querySelectorAll('.inbox-tabs .pbtn')];
    const rows = [...document.querySelectorAll('.inbox-row')];
    const dirOf = (row) => {
      const d = row.querySelector('.inbox-dir');
      return { text: d.textContent, color: getComputedStyle(d).color,
        border: getComputedStyle(row).borderTopColor };
    };
    return {
      // 타이틀 → 현재상태 → (경고) → 탭 → 목록
      iTitle: kids.findIndex((k) => k.matches('.screen-title')),
      iNow: kids.findIndex((k) => k.matches('.msg-accept-now')),
      iTabs: kids.findIndex((k) => k.matches('.inbox-tabs')),
      iList: kids.findIndex((k) => k.matches('.inbox-list, .hint')),
      nowText: document.querySelector('.msg-accept-now')?.textContent ?? '',
      labels: tabs.map((x) => x.textContent),
      onIndex: tabs.findIndex((x) => x.classList.contains('on')),
      rows: rows.length,
      recv: rows.filter((x) => x.classList.contains('in')).map(dirOf)[0],
      sent: rows.filter((x) => x.classList.contains('out')).map(dirOf)[0],
    };
  });
  console.log('\n⑤ 22차 — 현재상태 줄 · 탭 셋 · 받음(파랑)/보냄(빨강)');
  eq('★ 현재상태 줄이 타이틀 바로 아래', r.iNow, r.iTitle + 1);
  eq('현재상태 문구', r.nowText, '현재상태 : 수신허용');
  eq('★ 탭 셋', r.labels, ['전체보기', '받은 메세지', '보낸 메세지']);
  eq('★ 처음엔 전체보기', r.labels[r.onIndex], '전체보기');
  eq('탭은 목록보다 위', r.iTabs > r.iNow && r.iTabs < r.iList, true);
  eq('전체보기는 네 줄 전부', r.rows, 4);
  eq('받음 글씨', r.recv.text, '받음');
  eq('★ 받음은 파란 글씨', r.recv.color, 'rgb(143, 192, 255)');
  eq('★ 받음은 파란 테두리', r.recv.border, 'rgb(76, 141, 224)');
  eq('보냄 글씨', r.sent.text, '보냄');
  eq('★ 보냄은 빨간 글씨', r.sent.color, 'rgb(255, 154, 138)');
  eq('★ 보냄은 빨간 테두리', r.sent.border, 'rgb(198, 64, 46)');

  /** 탭을 누르면 **그쪽만** 남는다 — 서버를 다시 부르지 않고 손에 있는 목록을 거른다 */
  const pick = async (label) => {
    await p.locator(`.inbox-tabs .pbtn:has-text("${label}")`).click();
    await sleep(250);
    return p.evaluate(() => {
      const rows = [...document.querySelectorAll('.inbox-row')];
      return {
        n: rows.length,
        kinds: [...new Set(rows.map((x) => (x.classList.contains('out') ? 'out' : 'in')))],
        on: document.querySelector('.inbox-tabs .pbtn.on')?.textContent ?? '',
        empty: document.querySelector('.hint')?.textContent ?? '',
      };
    });
  };
  const inOnly = await pick('받은 메세지');
  eq('★ 받은 메세지만', inOnly.kinds, ['in']);
  eq('받은 것 세 통', inOnly.n, 3);
  eq('탭이 켜진다', inOnly.on, '받은 메세지');
  await shot(p, 'inbox_in');

  const outOnly = await pick('보낸 메세지');
  eq('★ 보낸 메세지만', outOnly.kinds, ['out']);
  eq('보낸 것 한 통', outOnly.n, 1);
  await shot(p, 'inbox_out');

  const all = await pick('전체보기');
  eq('전체보기로 돌아온다', all.n, 4);
  await p.close();
}

eq('\n콘솔 오류 없음', errs, []);
await b.close();
try { process.kill(-vite.pid); } catch { vite.kill(); }
console.log(bad ? `\n❌ ${bad}건 실패` : '\n✅ 받은 메세지함 · 수신 설정 이상 없음');
process.exit(bad ? 1 : 0);
