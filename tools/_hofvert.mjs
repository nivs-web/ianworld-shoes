/**
 * 명예의 전당이 **세로 공간을 다 쓰는지** 자로 잰다. (2026-08-19 16차, 사용자 신고)
 *
 * *"1위에서 7.5위까지 표기 되는데 그 밑으로는 표기가 안 되는 느낌이야,
 *   내 순위 부분 영역 설정이 잘못된 느낌이야"*
 *
 * 원인은 `iframe` 같은 것이 아니라 CSS 두 줄이었다:
 *   · `.rank-list { max-height: 48vh }`  — 목록이 화면 절반에서 멈춘다
 *   · 그 아래 `.spacer { flex: 1 }`      — 목록이 못 쓴 공간을 **여백이 통째로 먹는다**
 * 그래서 목록 아래가 검게 비었다(실측 390x780 에서 173px, 412x915 에서 243px).
 *
 * 세 가지를 본다:
 *   · 목록과 '내 순위' 사이 **빈틈이 30px 이하**인가 (여백이 다시 끼어들면 커진다)
 *   · 화면이 클수록 **보이는 줄 수가 늘어나는가** (max-height 가 살아나면 고정된다)
 *   · 페이지 자체가 스크롤되지 않는가 (내 순위·뒤로가 화면 밖으로 밀리면 안 된다)
 *
 * 실제 `HallOfFame.js` 를 그대로 띄운다 — 순위 데이터만 `tools/_hof-stub.js` 로 바꾼다
 * (import map). 미리보기용으로 화면을 다시 짜면 정작 제품 화면은 안 재게 된다.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 5211;
/**
 * ⚠ vite 는 `npx` 아래에서 돌아 `kill()` 이 껍데기만 죽인다 — 서버가 살아남아 다음
 *   실행에서 포트를 빼앗고, 그러면 검사가 **엉뚱한 이유로 실패한다**(16차에 실제로
 *   qa:hoffit 이 '줄이 0개' 로 실패했다). 프로세스 **그룹째** 죽인다.
 */
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
await sleep(4000);
const b = await chromium
  .launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  .catch(() => chromium.launch());

const SIZES = [[360, 640], [390, 780], [412, 915], [360, 800]];
const seen = [];
let bad = 0;
for (const [w, h] of SIZES) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(`http://127.0.0.1:${PORT}/tools/_hofscreen-preview.html?rows=40&mine=11`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => {
    const ui = document.getElementById('ui');
    const list = document.querySelector('.rank-list');
    const mine = document.querySelector('.rank-mine');
    const back = [...document.querySelectorAll('.pbtn')].pop();
    const row = document.querySelector('.rank-row');
    if (!list) return { err: document.querySelector('.hint')?.textContent ?? '목록 없음' };
    const lb = list.getBoundingClientRect(), mb = mine?.getBoundingClientRect();
    const rh = row.getBoundingClientRect().height;
    return {
      listH: Math.round(lb.height),
      보이는줄: Math.floor(lb.height / (rh + 3)),
      빈틈: mb ? Math.round(mb.top - lb.bottom) : 9999,
      내순위바닥: mb ? Math.round(mb.bottom) : 0,
      뒤로바닥: Math.round(back.getBoundingClientRect().bottom),
      페이지스크롤: ui.scrollHeight - ui.clientHeight,
      // 내 순위 줄은 스크롤되면 안 된다 — 높이가 고정이어야 한다
      내순위높이: mb ? Math.round(mb.height) : 0,
    };
  });
  if (r.err) { console.log(`  ${w}x${h}  ❌ ${r.err}`); bad++; await p.close(); continue; }
  /**
   * ★ 사용자가 본 **검은 공백**은 바로 이 값이다 — 마지막 요소(뒤로) 아래로 남는 공간.
   * `max-height` 만 되돌려 봤더니 '빈틈'(목록↔내 순위)은 14px 로 멀쩡한데 이 값이
   * 173px 로 튀었다. 즉 여기를 안 재면 고친 걸 되돌려도 검사가 통과한다.
   */
  const 화면아래빈칸 = h - r.뒤로바닥;
  const ok = r.빈틈 <= 30 && r.페이지스크롤 <= 1 && r.뒤로바닥 <= h && 화면아래빈칸 <= 40;
  if (!ok) bad++;
  seen.push({ h, 줄: r.보이는줄 });
  // 사람 눈으로도 확인할 수 있게 대표 크기 한 장은 남긴다
  if (w === 390 && h === 780) await p.screenshot({ path: 'tools/_out/hof_vert.png' });
  console.log(`  ${w}x${h}  목록높이=${r.listH} 보이는줄=${r.보이는줄} 빈틈=${r.빈틈}px 내순위바닥=${r.내순위바닥} 뒤로바닥=${r.뒤로바닥} 페이지스크롤=${r.페이지스크롤} 화면아래빈칸=${화면아래빈칸}px ${ok ? '✅' : '❌'}`);
  await p.close();
}

/** 화면이 커지면 줄도 늘어야 한다 — 고정되면 max-height 가 돌아온 것이다 */
const 늘어남 = seen.length >= 2 && Math.max(...seen.map((x) => x.줄)) > Math.min(...seen.map((x) => x.줄));
if (!늘어남) { bad++; console.log('  ❌ 화면을 키워도 보이는 줄 수가 그대로 — max-height 가 다시 붙었는지 확인'); }

await b.close();
try { process.kill(-vite.pid); } catch { vite.kill(); }
console.log(bad ? `\n❌ ${bad}건 실패` : '\n✅ 목록이 세로를 다 쓴다 · 내 순위/뒤로 고정 · 페이지 스크롤 없음');
process.exit(bad ? 1 : 0);
