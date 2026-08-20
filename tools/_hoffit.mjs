/**
 * 명예의 전당 신발왕 줄이 **좁은 폰에서 안 터지는지** 자로 잰다. (2026-08-19 11차)
 *
 * 승률 칸이 붙으면서 한 줄에 등수·얼굴·이름·승률·값 다섯 칸이 들어간다. 눈으로 보면
 * "괜찮아 보이는" 폭에서도 320px 짜리 폰에서는 넘친다 — §9-0-33 에서 방 목록이
 * 정확히 그렇게 터졌다(가로 스크롤바가 생길 때까지 아무도 몰랐다).
 *
 * 두 가지를 본다:
 *   · 넘침(`scrollWidth - clientWidth`)이 0인가
 *   · 승률 칸의 **왼쪽 끝이 줄마다 같은가** (23차 사용자 지정: 이름 옆에 바로, 왼쪽 정렬)
 *
 * ★ 23차: 재는 대상을 **손으로 베낀 미리보기에서 진짜 화면으로** 옮겼다
 *   (`_hofscreen-preview.html` — 데이터만 대역이고 `HallOfFame.js` 는 진짜다).
 *   왕관·등수 칸이 붙는 이번 변경에서 베낀 마크업은 그 칸을 아예 모른다 —
 *   그러면 검사는 **없는 화면을 재고 통과**한다(§9-0-33 의 그 함정).
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
  await p.goto(`http://127.0.0.1:${PORT}/tools/_hofscreen-preview.html?rows=12&mine=2`, { waitUntil: 'networkidle' });
  /**
   * 미리보기 프레임은 360 고정이라 폭을 **실제 화면과 같은 내용 폭**으로 맞춘다.
   * 실제 `.screen` 은 좌우 12px 패딩이고 프레임은 10px 이므로 `vw - 4` 가 같은 값이다.
   * (예전엔 `vw - 28` 로 재서 실제보다 24px 좁게 보고 있었다 — 없던 넘침이 잡혔다)
   */
  // 진짜 화면이라 뷰포트 폭이 곧 화면 폭이다 — 미리보기 프레임을 맞출 일이 없다
  const r = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.rank-list .rank-row')];
    return rows.map((el) => ({
      over: el.scrollWidth - el.clientWidth,
      rateLeft: Math.round(el.querySelector('.rank-rate').getBoundingClientRect().left),
      // 왕관이 붙은 줄과 안 붙은 줄의 등수 숫자가 같은 자리에 서는가
      noLeft: Math.round(el.querySelector('.rank-no').getBoundingClientRect().left),
      crown: !!el.querySelector('.crown'),
      place: el.querySelector('.rank-no')?.textContent ?? '',
      nameW: Math.round(el.querySelector('.rank-name').getBoundingClientRect().width),
      /**
       * ★ 25차: **아이디 5글자가 안 잘려야 한다** (사용자 지정).
       * 닉네임 상한이 5자이므로 이 값이 0이면 어떤 이름도 온전히 보인다.
       * 폭만 재던 예전 검사로는 `다섯글자…` 로 잘려도 통과했다.
       */
      nameCut: (() => {
        const n = el.querySelector('.rank-name');
        return n.scrollWidth - n.clientWidth;
      })(),
      // 승률 글자가 칸 밖으로 잘리지는 않는지 (overflow: hidden 이라 눈에는 안 보인다)
      rateCut: el.querySelector('.rank-rate').scrollWidth - el.querySelector('.rank-rate').clientWidth,
    }));
  });
  const over = r.filter((x) => x.over > 0).length;
  const cut = r.filter((x) => x.rateCut > 0).length;
  // 380px 이하에서는 승률이 아랫줄로 내려간다(의도한 동작) — 그때도 줄마다 같은 자리여야 한다
  const lefts = [...new Set(r.map((x) => x.rateLeft))];
  const nos = [...new Set(r.map((x) => x.noLeft))];
  // 1·2·3위에만 왕관이 있어야 한다 (목록은 1위부터 시작한다)
  const crowns = r.map((x) => x.crown);
  const crownOk = crowns.slice(0, 3).every(Boolean) && crowns.slice(3).every((c) => !c);
  const placeOk = r[0]?.place === '1위';
  const nameCut = r.filter((x) => x.nameCut > 0).length;
  const good = over === 0 && cut === 0 && nameCut === 0 && lefts.length === 1 && nos.length === 1 && crownOk && placeOk;
  if (!good) ok = false;
  console.log(`  ${w}px  넘침 ${over}건 · 승률칸 왼끝 ${lefts.join(',')} ${lefts.length === 1 ? '(정렬)' : '(어긋남!)'} · 등수 왼끝 ${nos.join(',')} · 승률잘림 ${cut}건 · 이름잘림 ${nameCut}건 · 왕관 ${crowns.filter(Boolean).length}개 ${crownOk ? 'ok' : '어긋남!'} · 첫줄 "${r[0]?.place}"`);
  await p.close();
}

console.log(ok ? '\n✅ 넘침 0 · 승률 칸이 줄마다 같은 자리 · 왕관은 1~3위에만' : '\n❌ 실패');
await b.close();
(() => { try { process.kill(-vite.pid); } catch { vite.kill(); } })();
process.exit(ok ? 0 : 1);
