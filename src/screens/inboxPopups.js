/**
 * 받은 쪽지·대결신청을 **팝업으로** 띄운다. (2026-08-19 11차, 사용자 지정)
 *
 * *"게임에 접속하거나, 게임 결과 창에서는 이 메세지가 팝업을 뜨고 답장보내기, 닫기
 * 버튼이 뜨게 만들어"*
 *
 * ## 인게임에서는 절대 안 띄운다
 *
 * 인게임은 전부 캔버스다(CLAUDE.md §6-3). 계단을 오르는 중에 DOM 다이얼로그가 튀어나오면
 * 입력이 통째로 막히고 그 판이 끝난다. 그래서 **DOM 화면일 때만**(`body.ui-mode`) 띄우고,
 * 아니면 서버에 그대로 둔다 — 지우지 않으므로 나오는 순간 다시 보인다.
 * "게임중인 사람은 메세지 못받고 게임 끝내고 나오면 팝업으로" 가 정확히 이 동작이다.
 *
 * ## 한 번에 하나씩
 *
 * 여러 통이 쌓여 있어도 겹쳐 띄우지 않는다. 겹치면 뒤에 깔린 것의 '수락(10초)' 이
 * 보이지 않는 채로 흘러간다.
 */

import S from '../config/strings.ko.js';
import { el, button, presentOverlay, toast } from './ui.js';
import * as Presence from '../services/presence.js';
import * as Room from '../services/multiplayer.js';
import { get as getProfile } from '../services/profile.js';
import { openComposer } from './UserCard.js';
import { stamp } from './timeText.js';

/** 대결 신청 수락 제한 (초) — 사용자 지정: "10초안에 수락을 누르지 않으면 자동 거절" */
export const CHALLENGE_SECONDS = 10;

let queue = [];
let showing = false;
let stop = null;
let navRef = null;
/**
 * 이미 띄운(또는 띄우는 중인) 쪽지 id.
 *
 * 구독은 **목록 전체**를 다시 준다. 지우기가 서버에 닿기 전에 스냅샷이 한 번 더 오면
 * 방금 띄운 그 쪽지가 목록에 그대로 있어서 **같은 팝업이 두 번 뜬다.**
 */
const handled = new Set();

/** DOM 화면인가 — 인게임(캔버스)에서는 팝업을 띄우지 않는다 */
const uiMode = () => document.body.classList.contains('ui-mode');

export function start(navigator) {
  navRef = navigator ?? navRef;
  if (stop) return;
  stop = Presence.subscribeInbox((items) => {
    /**
     * ★ **안 읽은 것 · 내가 받은 것만** 띄운다. (2026-08-19 12차)
     * 쪽지함이 이력이 되면서 읽은 쪽지도 서버에 남는다 — 거르지 않으면 로비에 들어갈
     * 때마다 예전 쪽지가 전부 다시 뜬다. 보낸 사본(`out`)은 애초에 내 것이다.
     */
    if (!items) { queue = []; return; }   // 못 붙었다 — 띄울 것도 없다
    queue = items.filter((m) => !m.out && !m.read);
    // 서버에서 사라진 것은 기억에서도 지운다 (안 그러면 Set 이 계속 커진다)
    const live = new Set(items.map((m) => m.id));
    for (const id of [...handled]) if (!live.has(id)) handled.delete(id);
    pump();
  });
}

export function stopAll() {
  stop?.();
  stop = null;
  queue = [];
  handled.clear();
}

/** 화면이 DOM 으로 돌아왔다 — 밀린 쪽지가 있으면 지금 띄운다 (router.mount 가 부른다) */
export function flush() { pump(); }

function pump() {
  if (showing || !uiMode()) return;
  const item = queue.find((m) => !handled.has(m.id));
  if (!item) return;
  handled.add(item.id);
  /**
   * 오래된 대결 신청은 조용히 버린다. 앱을 껐다 몇 시간 뒤에 켰는데 "참여하시겠습니까"가
   * 뜨면, 수락해도 상대는 이미 그 방에 없다 — 빈 방에서 혼자 기다리게 된다.
   */
  if (item.kind === 'challenge' && Date.now() - (item.at ?? 0) > Presence.CHALLENGE_TTL_MS) {
    Presence.drop(item.id).catch(() => {});
    return pump();
  }
  showing = true;
  const done = () => {
    showing = false;
    /**
     * 쪽지는 **지우지 않고 읽음만 찍는다** — 받은 메세지함이 이력을 보여 줘야 한다.
     * 대결 신청은 다르다. 지나간 신청이 목록에 남아 봐야 아무 쓸모가 없다.
     */
    if (item.kind === 'challenge') Presence.drop(item.id).catch(() => {});
    else Presence.markRead(item.id).catch(() => {});
    // 다음 통은 한 박자 쉬고 — 팝업이 연달아 튀면 앞엣것을 못 읽는다
    setTimeout(pump, 350);
  };
  if (item.kind === 'challenge') showChallenge(item, done);
  else showMessage(item, done);
}

/**
 * 일반 쪽지 — 답장보내기 / 닫기.
 *
 * **뒷정리는 `presentOverlay` 의 onClose 한 곳에서만** 한다. 화면이 바뀌면
 * `router.draw()` 가 팝업을 강제로 치우는데(`closeAllOverlays`), 버튼 핸들러에만
 * 정리를 두면 그때 `showing` 이 참으로 굳어 **그 뒤로 어떤 쪽지도 안 뜬다.**
 */
function showMessage(item, done) {
  let settled = false;
  let reply = false;
  let dismiss = () => {};
  const finish = () => {
    if (settled) return;
    settled = true;
    done();
    if (reply) openComposer({ uid: item.from, nickname: item.fromName });
  };
  const overlay = el('div.dialog-overlay', null, [
    el('div.dialog', null, [
      el('div.dialog-msg', S.messageFrom(item.fromName || '???')),
      // 언제 온 쪽지인지 (사용자 요청) — 게임 한 판 하고 나오면 몇 분이 지나 있다
      el('div.inbox-when', stamp(item.at)),
      el('div.inbox-text', item.text || ''),
      el('div.row', null, [
        button(S.close, () => dismiss(), { sfx: 'sfx_menu_back' }),
        // 시스템 알림(거절 통보)에는 답장할 상대가 없다
        item.kind === 'system' ? null : button(S.replyMessage, () => { reply = true; dismiss(); },
          { primary: true }),
      ].filter(Boolean)),
    ]),
  ]);
  dismiss = presentOverlay(overlay, finish);
}

/**
 * 대결 신청 — 수락(10초) / 거절. **10초가 지나면 자동 거절**이다.
 *
 * 남은 초를 버튼 글자에 넣는 이유: 따로 숫자를 두면 어느 버튼에 걸린 시간인지 흐려진다.
 * 화면이 바뀌어 팝업이 강제로 닫히면 **거절로 본다** — 신청자를 무한정 기다리게 두느니
 * 거절 통보라도 가는 편이 낫다.
 */
function showChallenge(item, done) {
  let settled = false;
  let picked = false;
  let timer = null;
  let left = CHALLENGE_SECONDS;
  let dismiss = () => {};

  const finish = () => {
    if (settled) return;
    settled = true;
    clearInterval(timer);
    done();
    if (picked) return join(item.code);
    // 거절은 **알려 준다.** 신청자는 그 방 대기실에서 기다리고 있다
    const me = getProfile();
    Presence.sendSystem(item.from, S.challengeRefused(me.nickname || '???')).catch(() => {});
  };
  const choose = (v) => { picked = v; dismiss(); };

  const accept = button(S.challengeAccept(left), () => choose(true), { primary: true });
  const overlay = el('div.dialog-overlay', null, [
    el('div.dialog', null, [
      el('div.dialog-msg', S.messageFrom(item.fromName || '???')),
      el('div.inbox-when', stamp(item.at)),
      el('div.dialog-detail', S.challengeAsk),
      el('div.row', null, [
        button(S.challengeDecline, () => choose(false), { sfx: 'sfx_menu_back' }),
        accept,
      ]),
    ]),
  ]);
  dismiss = presentOverlay(overlay, finish);

  timer = setInterval(() => {
    left -= 1;
    if (left <= 0) return choose(false);
    accept.textContent = S.challengeAccept(left);
  }, 1000);
}

async function join(code) {
  if (!code) return toast(S.challengeGone, 2000);
  const r = await Room.joinRoom(code).catch(() => 'error');
  if (r !== 'ok' && r !== 'waiting') return toast(S.challengeGone, 2000);
  const m = await import('./multi/WaitingRoom.js');
  navRef?.push(m.default, { code });
}
