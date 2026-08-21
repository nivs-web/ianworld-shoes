/**
 * 방 채팅 — **화면을 실제로 띄워서** 확인한다. (2026-08-21 26차)
 *
 * 사용자 지정을 브라우저에게 묻는다:
 *   ① **8줄 정도** 보인다 (줄 수로 못 박는다 — `vh` 면 폰마다 6줄이 되기도 11줄이 되기도)
 *   ② 위아래 **스크롤**이 된다
 *   ③ 입력하면 **바로** 목록에 붙는다
 *   ④ 못 붙었을 때 "대화가 없다"고 **거짓말하지 않는다** (§9-0-6)
 *   ⑤ 전송 버튼이 입력칸을 밀어내지 않는다 (`.pbtn` 은 width:100% 다 — §9-0-20 의 그 함정)
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 5253;
/** ⚠ npx 아래의 vite 는 kill() 로 안 죽는다 — 그룹째, 그리고 **터졌을 때도** (§9-0-53) */
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
const killVite = () => { try { process.kill(-vite.pid, 'SIGKILL'); } catch { vite.kill('SIGKILL'); } };
process.on('uncaughtException', (e) => { console.error(e); killVite(); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(e); killVite(); process.exit(1); });
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

const open = async (qs, w = 390) => {
  const p = await b.newPage({ viewport: { width: w, height: 820 } });
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|status of 404/.test(m.text())) errs.push('console: ' + m.text());
  });
  await p.goto(`http://127.0.0.1:${PORT}/tools/_chatscreen-preview.html?${qs}`, { waitUntil: 'networkidle' });
  await p.locator('.chat-panel').waitFor({ timeout: 15000 });
  await sleep(250);
  return p;
};

// ── ①② 여덟 줄 · 스크롤 ─────────────
{
  const p = await open('rows=24');
  const r = await p.evaluate(() => {
    const list = document.querySelector('.chat-list');
    /**
     * 줄 높이는 **`line-height`** 로 잰다. 긴 말은 두 줄로 접히므로 첫 행의 높이를
     * 그대로 쓰면 "몇 줄 보이나"가 그때그때 달라진다 — 8줄은 말 8개가 아니라 줄 8칸이다.
     */
    const rh = parseFloat(getComputedStyle(document.querySelector('.chat-row')).lineHeight);
    return {
      rows: document.querySelectorAll('.chat-row').length,
      보이는줄: Math.round(list.clientHeight / rh),
      스크롤됨: list.scrollHeight > list.clientHeight,
      // 새 줄이 오면 맨 아래가 보여야 한다 — 위에 붙어 있으면 최근 대화를 못 본다
      바닥에: list.scrollHeight - list.scrollTop - list.clientHeight < 24,
      넘침: list.scrollWidth - list.clientWidth,
    };
  });
  console.log('①② 여덟 줄 · 위아래 스크롤');
  eq('★ 한 화면에 8줄', r.보이는줄, 8);
  eq('스물네 줄이 다 들어 있다', r.rows, 24);
  eq('★ 세로 스크롤이 생긴다', r.스크롤됨, true);
  eq('처음엔 맨 아래(최근)를 본다', r.바닥에, true);
  eq('가로로는 안 넘친다', r.넘침, 0);
  await p.screenshot({ path: 'tools/_out/chat.png' });

  // 위로 올려 두면 새 줄이 와도 **끌어내리지 않는다** (읽던 자리를 뺏으면 안 된다)
  await p.evaluate(() => { document.querySelector('.chat-list').scrollTop = 0; });
  await p.fill('.chat-input', '위로 올려 둔 채로 보낸다');
  await p.click('.chat-send');
  await sleep(200);
  const keep = await p.evaluate(() => document.querySelector('.chat-list').scrollTop);
  eq('★ 위로 올려 읽는 중이면 안 끌어내린다', keep, 0);
  await p.close();
}

// ── ③ 입력 즉시 전송 ─────────────
{
  const p = await open('rows=3');
  await p.fill('.chat-input', '바로 보내진다');
  await p.press('.chat-input', 'Enter');
  await sleep(250);
  const r = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.chat-row')];
    const last = rows[rows.length - 1];
    const list = document.querySelector('.chat-list');
    return {
      n: rows.length,
      text: last.querySelector('.chat-text').textContent,
      mine: last.classList.contains('mine'),
      비웠나: document.querySelector('.chat-input').value,
      바닥에: list.scrollHeight - list.scrollTop - list.clientHeight < 24,
      focus: document.activeElement?.classList.contains('chat-input') ?? false,
    };
  });
  console.log('\n③ 입력 즉시 전송 (엔터)');
  eq('줄이 하나 늘었다', r.n, 4);
  eq('★ 방금 친 말이 그대로', r.text, '바로 보내진다');
  eq('내 줄로 표시된다', r.mine, true);
  eq('입력칸이 비워진다', r.비웠나, '');
  eq('보낸 뒤에는 맨 아래로', r.바닥에, true);
  eq('커서가 입력칸에 남는다', r.focus, true);
  await p.close();
}

// ── ③-b 전송 실패는 **되돌려 준다** ─────────────
{
  const p = await open('rows=2&fail=1');
  await p.fill('.chat-input', '못 보내는 말');
  await p.click('.chat-send');
  await sleep(250);
  const r = await p.evaluate(() => ({
    value: document.querySelector('.chat-input').value,
    warn: document.querySelector('.chat-failed')?.textContent ?? '',
    rows: document.querySelectorAll('.chat-row').length,
  }));
  console.log('\n③-b 전송 실패 — 친 글자를 잃지 않는다');
  eq('★ 입력칸에 되돌아온다', r.value, '못 보내는 말');
  eq('실패를 말해 준다', r.warn, '메세지를 보내지 못했습니다');
  eq('목록에는 안 붙는다', r.rows, 2);
  await p.close();
}

// ── ④ 못 붙었을 때 거짓말하지 않는다 ─────────────
{
  const p = await open('off=1');
  const r = await p.evaluate(() => ({
    empty: document.querySelector('.chat-empty')?.textContent ?? '',
    rows: document.querySelectorAll('.chat-row').length,
  }));
  console.log('\n④ 못 붙었을 때');
  eq('★ "대화가 없다"고 하지 않는다', r.empty, '네트워크 연결을 확인해주세요');
  eq('줄은 없다', r.rows, 0);
  await p.close();
}

// ── ⑤ 좁은 폰에서 전송 버튼이 입력칸을 안 밀어낸다 ─────────────
console.log('\n⑤ 폭별 — 전송 버튼이 입력칸을 밀어내지 않는가');
for (const w of [320, 360, 390, 412]) {
  const p = await open('rows=8', w);
  const r = await p.evaluate(() => {
    const form = document.querySelector('.chat-form');
    const input = document.querySelector('.chat-input');
    const send = document.querySelector('.chat-send');
    return {
      over: form.scrollWidth - form.clientWidth,
      inputW: Math.round(input.getBoundingClientRect().width),
      sendW: Math.round(send.getBoundingClientRect().width),
      panelOver: (() => {
        const n = document.querySelector('.chat-panel');
        return n.scrollWidth - n.clientWidth;
      })(),
    };
  });
  const good = r.over === 0 && r.panelOver === 0 && r.inputW >= 140 && r.sendW <= 80;
  if (!good) bad++;
  console.log(`  ${w}px  입력칸 ${r.inputW} · 전송 ${r.sendW} · 넘침 ${r.over}/${r.panelOver} ${good ? '✅' : '❌'}`);
  await p.close();
}

eq('\n콘솔 오류 없음', errs, []);
await b.close();
killVite();
console.log(bad ? `\n❌ ${bad}건 실패` : '\n✅ 방 채팅 이상 없음');
process.exit(bad ? 1 : 0);
