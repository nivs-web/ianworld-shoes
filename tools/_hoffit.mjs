/**
 * 명예의 전당 신발왕 줄이 **좁은 폰에서 안 터지는지** 자로 잰다. (2026-08-19 11차)
 *
 * 승률 칸이 붙으면서 한 줄에 등수·얼굴·이름·승률·값 다섯 칸이 들어간다. 눈으로 보면
 * "괜찮아 보이는" 폭에서도 320px 짜리 폰에서는 넘친다 — §9-0-33 에서 방 목록이
 * 정확히 그렇게 터졌다(가로 스크롤바가 생길 때까지 아무도 몰랐다).
 *
 * 두 가지를 본다:
 *   · 넘침(`scrollWidth - clientWidth`)이 0인가
 *   · 승률 칸의 **오른쪽 끝이 줄마다 같은가** (사용자 요청: "줄 정렬해서 써줘")
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 5203;
/**
 * ⚠ vite 는 `npx` 아래에서 돌아 `kill()` 이 껍데기만 죽인다 — 서버가 살아남아 다음
 *   실행에서 포트를 빼앗고, 그러면 검사가 **엉뚱한 이유로 실패한다**(2026-08-19 16차에
 *   qa:hoffit 이 '줄이 0개' 로 실패했다 — 코드는 멀쩡했다). 프로세스 **그룹째** 죽인다.
 */
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
await sleep(4000);
const b = await chromium
  .launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  .catch(() => chromium.launch());

const WIDTHS = [320, 360, 390, 412];
let ok = true;
for (const w of WIDTHS) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(`http://127.0.0.1:${PORT}/tools/_hof-preview.html`, { waitUntil: 'networkidle' });
  /**
   * 미리보기 프레임은 360 고정이라 폭을 **실제 화면과 같은 내용 폭**으로 맞춘다.
   * 실제 `.screen` 은 좌우 12px 패딩이고 프레임은 10px 이므로 `vw - 4` 가 같은 값이다.
   * (예전엔 `vw - 28` 로 재서 실제보다 24px 좁게 보고 있었다 — 없던 넘침이 잡혔다)
   */
  await p.evaluate((vw) => {
    for (const f of document.querySelectorAll('.frame')) f.style.width = `${vw - 4}px`;
  }, w);
  const r = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.rank-list .rank-row')];
    return rows.map((el) => ({
      over: el.scrollWidth - el.clientWidth,
      rateRight: Math.round(el.querySelector('.rank-rate').getBoundingClientRect().right),
      nameW: Math.round(el.querySelector('.rank-name').getBoundingClientRect().width),
      // 승률 글자가 칸 밖으로 잘리지는 않는지 (overflow: hidden 이라 눈에는 안 보인다)
      rateCut: el.querySelector('.rank-rate').scrollWidth - el.querySelector('.rank-rate').clientWidth,
    }));
  });
  const over = r.filter((x) => x.over > 0).length;
  const cut = r.filter((x) => x.rateCut > 0).length;
  const rights = [...new Set(r.map((x) => x.rateRight))];
  const good = over === 0 && cut === 0 && rights.length === 1;
  if (!good) ok = false;
  console.log(`  ${w}px  넘침 ${over}건 · 승률칸 오른끝 ${rights.join(',')} ${rights.length === 1 ? '(정렬)' : '(어긋남!)'} · 승률잘림 ${cut}건 · 이름폭 ${r.map((x) => x.nameW).join('/')}`);
  await p.close();
}

console.log(ok ? '\n✅ 넘침 0 · 승률 칸이 줄마다 같은 자리' : '\n❌ 실패');
await b.close();
(() => { try { process.kill(-vite.pid); } catch { vite.kill(); } })();
process.exit(ok ? 0 : 1);
