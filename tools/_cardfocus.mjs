/**
 * 유저상태창을 열면 **커서가 입력칸 안에 있는가.** (2026-08-19 20차, 사용자 신고)
 *
 * *"왜 커서가 '보낼 메세지를 입력하세요' 라고 써 있는 text입력창 안에 없어?"*
 *
 * ## 왜 검사로 못 박나
 *
 * 이건 **한 번 조용히 사라진 적이 있는 동작**이다. 19차에 쪽지 입력칸을 부품
 * (`replyInput`)으로 합치면서, 옛 팝업에 있던 `input.focus()` 한 줄이 같이 딸려오지
 * 않았다. 화면은 멀쩡히 뜨고 글자도 잘 보내지므로 **소스만 봐서는 아무 문제가 없다** —
 * 실제로 창을 열고 `document.activeElement` 를 봐야만 드러난다.
 *
 * 그래서 눈이 아니라 **브라우저에게 묻는다**: 창이 뜬 뒤 포커스가 그 칸에 있는지,
 * 그리고 아무 키나 쳤을 때 그 글자가 정말 그 칸에 들어가는지.
 *
 * 미리보기(`tools/_hof-preview.html`)는 **진짜 `UserCard.js` 를 부른다** — 흉내 낸
 * 마크업을 검사하면 통과도 실패도 의미가 없다(§9-0-33·§9-0-44 에서 두 번 데인 함정).
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 5241;
/**
 * ⚠ vite 는 `npx` 아래에서 돌아 `kill()` 이 껍데기만 죽인다 — 서버가 남아 다음
 *   실행에서 포트를 빼앗고, 그러면 검사가 **엉뚱한 이유로 실패한다**(§9-0-46).
 */
const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
await sleep(4000);
const b = await chromium
  .launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  .catch(() => chromium.launch());

const p = await b.newPage({ viewport: { width: 390, height: 780 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(`http://127.0.0.1:${PORT}/tools/_hof-preview.html`, { waitUntil: 'networkidle' });
/** 넉넉히 기다린다 — 메뉴 커서(`menuNav`)가 다음 프레임에 포커스를 뺏어갈 수도 있다 */
await sleep(900);

const r = await p.evaluate(() => {
  const input = document.querySelector('.dialog .msg-input');
  const a = document.activeElement;
  const dialog = document.querySelector('.dialog');
  const kids = dialog ? [...dialog.children] : [];
  const at = (sel) => kids.findIndex((k) => k.matches(sel));
  return {
    inputExists: !!input,
    focused: a === input,
    placeholder: input?.placeholder ?? '',
    // 순서: 입력칸 → 빨간 보내기 → [1:1대결신청][닫기]  (사용자 지정)
    iInput: at('.msg-input'),
    iSend: at('.pbtn.danger.wide'),
    iRow: at('.user-card-actions'),
    rowButtons: [...(dialog?.querySelectorAll('.user-card-actions .pbtn') ?? [])].map((x) => x.textContent),
    rowPlain: [...(dialog?.querySelectorAll('.user-card-actions .pbtn') ?? [])]
      .every((x) => !x.classList.contains('danger') && !x.classList.contains('primary')),
  };
});

await p.keyboard.type('안녕');
const typed = await p.evaluate(() => document.querySelector('.dialog .msg-input')?.value ?? '');

let bad = 0;
const check = (label, got, want) => {
  const a = JSON.stringify(got), b2 = JSON.stringify(want);
  if (a === b2) return console.log(`  ok   ${label}`);
  bad++;
  console.log(`  FAIL ${label}\n       got  ${a}\n       want ${b2}`);
};

check('입력칸이 있다', r.inputExists, true);
check('안내 문구', r.placeholder, '보낼 메세지를 입력하세요');
check('★ 열자마자 커서가 입력칸 안에', r.focused, true);
check('★ 그대로 타이핑하면 그 칸에 들어간다', typed, '안녕');
check('순서 — 입력칸 → 보내기 → 버튼 줄', r.iInput < r.iSend && r.iSend < r.iRow, true);
check('아래 줄은 [1:1대결신청][닫기]', r.rowButtons, ['1:1대결신청', '닫기']);
check('아래 줄 버튼에는 색을 안 넣는다', r.rowPlain, true);
check('콘솔 오류 없음', errs, []);

await b.close();
try { process.kill(-vite.pid); } catch { vite.kill(); }
console.log(bad ? `\n❌ ${bad}건 실패` : '\n✅ 유저상태창 — 커서·순서·버튼 이상 없음');
process.exit(bad ? 1 : 0);
