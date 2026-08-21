/**
 * 방 채팅 패널 — **대기방에 붙는 8줄짜리 대화창.** (2026-08-21 26차, 사용자 지정)
 *
 * *"모든 멀티게임 방에 들어온 유저들 끼리 실시간 채팅이 가능하게 (…) 메세지는 8줄 정도
 *   보여주면 될거 같아, 그리고 스크롤을 위 아래로 (…) 게임에 들어왔다가 다시 나오고
 *   반복되는데, 그래도 채팅 기록은 전부 그대로 있었으면 좋겠어"*
 *
 * ## ★ 이 파일이 화면 밖에 있는 이유 — **다시 그리면 입력이 죽는다**
 *
 * 대기방은 방 스냅샷이 올 때마다 `nav.refresh()` 로 **화면을 통째로 다시 세운다**
 * (`innerHTML = ''` 뒤 render). 채팅을 render 안에서 만들면 그때마다 노드가 새로
 * 만들어져 **치던 글자와 스크롤 위치가 사라진다** — §9-0-45 에서 팝업이 같은 이유로
 * 죽었던 그 자리다.
 *
 * 그래서 패널을 **화면 인스턴스당 한 번만** 만들고, render 는 **같은 노드를 다시
 * 붙이기만** 한다. `innerHTML = ''` 는 자식을 떼어낼 뿐 없애지 않으므로, 참조를 들고
 * 있으면 입력값도 스크롤도 그대로 살아 돌아온다.
 *
 * 목록 갱신도 `nav.refresh()` 를 **부르지 않는다.** 자기 구독으로 자기 노드만 고친다.
 */

import S from '../../config/strings.ko.js';
import { el } from '../ui.js';
import * as Room from '../../services/multiplayer.js';
import { currentUser } from '../../services/auth.js';
import { stamp } from '../timeText.js';

/** 한 번에 보여 주는 줄 수 — 사용자 지정 "8줄 정도" */
export const CHAT_ROWS = 8;

/**
 * @param {string} code 방 번호
 * @returns {{node: HTMLElement, stop: () => void}}
 */
export function roomChat(code) {
  const myUid = currentUser()?.uid;
  const list = el('div.chat-list');
  const input = el('input.chat-input', {
    type: 'text',
    maxLength: Room.CHAT_MAX,
    placeholder: S.chatPlaceholder,
    autocomplete: 'off',
    /**
     * `enterkeyhint` 는 모바일 키보드의 오른쪽 아래 키를 '전송' 으로 바꾼다.
     * 안 주면 '완료' 가 떠서 키보드만 닫히고 아무 일도 안 일어난다.
     */
    enterkeyhint: 'send',
  });
  const sendBtn = el('button.chat-send.pbtn', { type: 'button', text: S.chatSend });
  let rows = null;
  let busy = false;

  /** 맨 아래에 붙어 있었나 — 위로 올려 옛 대화를 읽는 중이면 끌어내리지 않는다 */
  const atBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 24;

  /**
   * ★ **스크롤 위치를 우리가 들고 있는다.** (2026-08-21 26차)
   *
   * 두 가지 때문에 브라우저의 `scrollTop` 만 믿을 수 없다.
   *   ① 목록을 처음 그릴 때는 **아직 화면에 안 붙어 있어서** `scrollHeight` 가 0이다 —
   *      그 자리에서 내려 봐야 아무 일도 안 일어나고, 붙고 나면 맨 위에 걸린다.
   *   ② 대기방이 `refresh()` 로 화면을 다시 세우면 이 노드가 잠깐 떨어졌다 붙는데,
   *      **떨어지는 순간 `scrollTop` 이 0으로 초기화된다.**
   *
   * 그래서 "맨 아래에 붙어 있었나(`stick`)" 와 마지막 위치를 기억해 두고, 다시 붙을
   * 때마다 되돌린다. 입력값은 노드의 속성이라 떨어져도 살아남는다.
   */
  let stick = true;
  let savedTop = 0;
  function restore() {
    if (!list.isConnected) return;
    list.scrollTop = stick ? list.scrollHeight : savedTop;
  }
  list.addEventListener('scroll', () => {
    if (!list.isConnected) return;
    stick = atBottom();
    savedTop = list.scrollTop;
  });
  /**
   * 라우터는 `#ui` 의 **자식을 통째로 갈아 끼운다**(`innerHTML = ''` → append).
   * 그 한 가지 신호만 보면 되므로 `subtree` 는 켜지 않는다 — 토스트 하나가 뜨고 지는
   * 것까지 콜백을 깨우면 그게 곧 §9-0-43 에서 고친 그 낭비다.
   */
  const host = document.getElementById('ui');
  const mo = host ? new MutationObserver(() => restore()) : null;
  mo?.observe(host, { childList: true });

  function draw() {
    /**
     * ★ 스크롤을 **읽는 사람 기준**으로 다룬다. 새 줄이 올 때마다 무조건 내리면
     * 위로 올려 지난 대화를 보던 사람의 화면이 계속 튕겨 내려간다.
     */
    const 따라내린다 = !list.isConnected || atBottom();
    list.innerHTML = '';
    if (rows === null) {
      // ★ 못 붙었을 때 "대화가 없다"고 하지 않는다 — 그건 사실이 아니다 (§9-0-6)
      list.append(el('div.chat-empty', S.networkError));
    } else if (!rows.length) {
      list.append(el('div.chat-empty', S.chatEmpty));
    } else {
      for (const m of rows) {
        list.append(el('div.chat-row', { class: m.uid === myUid ? 'mine' : '' }, [
          el('span.chat-name', m.name || '???'),
          el('span.chat-text', m.text ?? ''),
          el('span.chat-at', stamp(m.at)),
        ]));
      }
    }
    stick = 따라내린다;
    restore();
  }

  async function send() {
    const text = input.value;
    if (busy || !text.trim()) return;
    busy = true;
    sendBtn.disabled = true;
    /**
     * 입력칸을 **먼저** 비운다. 서버 왕복(최대 12초)을 기다렸다 비우면 그 사이에 친
     * 글자가 통째로 날아간다 — 그리고 실패해도 되돌려 주므로 잃는 것이 없다.
     */
    input.value = '';
    const r = await Room.sendChat(code, text).catch(() => 'error');
    busy = false;
    sendBtn.disabled = false;
    if (r !== 'ok' && r !== 'empty') {
      input.value = text;
      list.append(el('div.chat-empty.chat-failed', S.chatFailed));
      list.scrollTop = list.scrollHeight;
    }
    input.focus();
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    // 한글 조합 중 Enter 는 글자를 확정하는 키다 — 여기서 보내면 마지막 글자가 잘린다
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    send();
  });

  const unsub = Room.subscribeChat(code, (v) => { rows = v; draw(); });
  draw();
  // 오래된 줄은 한가할 때 한 번 솎는다 — 서버 잡이 없으므로 보는 사람이 치운다
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1200));
  idle(() => Room.trimChat(code).catch(() => {}));

  const node = el('div.chat-panel', null, [
    el('div.chat-title', S.chatTitle),
    list,
    el('div.chat-form', null, [input, sendBtn]),
  ]);

  // 붙는 순간 맨 아래(최근 대화)를 보여 준다 — 위쪽 옛 대화부터 보여 줄 이유가 없다
  restore();

  return { node, stop: () => { unsub(); mo?.disconnect(); } };
}
