/**
 * 쪽지 팝업 **안에 그대로 들어가는 답장 입력칸**. (2026-08-19 14차, 사용자 지정)
 *
 * *"[답장하기] 눌러서 '보낼 메세지를 입력하세요'라는 text항목이 뜨면 그곳에 텍스트를
 * 입력하는데 그렇게 하지말고 'ㅇㅇ님의 메세지' 라고 메세지 내용이 온 순간 바로 그 아래
 * 칸에 '보낼 메세지를 입력하세요'라는 text 입력 칸이 뜨는거야"*
 *
 * ## 왜 따로 뺐나
 *
 * 같은 입력칸이 **두 곳**에 붙는다 — 받는 순간 뜨는 팝업(`inboxPopups`)과
 * 받은 메세지함의 쪽지 팝업(`Inbox`). 각자 만들면 언젠가 둘이 다른 말을 한다
 * (§9-0-41 의 유저상태창과 같은 이유). 화면이 아니라 **부품**이라 `screens/` 안에
 * 두되 다른 화면을 import 하지 않는다 — 그래야 순환 참조가 생기지 않는다.
 *
 * ## 보내고 나서 팝업을 닫는 이유
 *
 * 남겨 두면 방금 보낸 글자가 칸에 그대로 있어 "안 갔나?" 싶어 한 번 더 누르게 된다.
 * 닫고 토스트로 결과를 알리는 쪽이 짧고 분명하다.
 */

import S from '../config/strings.ko.js';
import { el, button, toast } from './ui.js';
import * as Presence from '../services/presence.js';

/**
 * ★ **못 보낸 이유를 구분해서 말한다.** (§9-0-42)
 *   off     — 상대가 수신을 꺼 뒀다 (`prefs/accept`, 미리 읽어서 안다)
 *   blocked — 상대가 나를 차단했다 (규칙이 거부한다. 차단 목록은 못 읽는다)
 * 둘을 "실패"로 뭉뚱그리면 사용자는 애먼 자기 네트워크를 의심한다.
 */
const REASON = {
  ok: S.messageSent,
  off: S.peerRecvOff,
  blocked: S.peerBlocked,
  error: S.networkError,
};

/**
 * @param {{uid: string, nickname?: string}} peer 답장 받을 사람
 * @param {() => void} close 보내고 나서 팝업을 닫는다
 * @returns {{node: HTMLElement, input: HTMLInputElement, send: () => Promise<void>}}
 */
export function replyInput(peer, close) {
  /** `maxlength` 100 은 **규칙과 같은 숫자**다 — 다르면 규칙이 거부하는데 화면에는
   *  "보내기를 눌렀는데 아무 일도 안 났다"로만 보인다 (`qa:rules` 가 둘을 대조한다) */
  const input = el('input.nick-input.msg-input', {
    type: 'text', maxlength: '100',
    placeholder: S.messageHint, autocomplete: 'off',
  });

  let busy = false;
  async function send() {
    const text = input.value.trim();
    if (!text) return toast(S.messageEmpty, 1600);
    if (busy) return;
    busy = true;
    close();
    const r = await Presence.sendMessage(peer.uid, text, peer.nickname ?? '');
    toast(REASON[r] ?? S.networkError, r === 'ok' ? 1800 : 2400);
  }

  // 한글 조합 중 엔터는 무시한다 — 조합을 끝내는 엔터까지 전송으로 먹으면 글자가 잘린다
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(); }
  });

  /**
   * ★ **커서를 칸 안에 넣는다.** (2026-08-19 20차, 사용자 지정)
   *
   * *"왜 커서가 '보낼 메세지를 입력하세요' 라고 써 있는 text입력창 안에 없어?
   *   커서가 자동으로 들어가 있으면 바로 타이핑 할 수 있도록 하고 싶은데?"*
   *
   * **부르는 쪽이 직접 부른다** — 이 부품은 자기가 언제 화면에 붙는지 모른다.
   * 아직 안 붙은 노드에 `focus()` 를 걸면 조용히 아무 일도 일어나지 않는다.
   * 그래서 팝업을 붙인 **직후**에 부르는 것은 부르는 쪽의 몫이다.
   *
   * 받은 쪽지 팝업(`inboxPopups`)도 14차부터 같은 일을 하고 있었는데 **자기만의
   * `setTimeout(…focus(), 30)`** 을 들고 있었다. 두 곳이 각자 방법을 가지면 언젠가
   * 한쪽만 고쳐진다 — 실제로 19차에 유저상태창 쪽이 통째로 빠졌다. 여기로 합쳤다.
   *
   * 두 번 거는 이유:
   *  · 첫 번째(동기) — 아이폰은 **탭 처리와 같은 작업 안**에서 불러야 키보드를 올려 준다.
   *    `setTimeout` 으로 미루면 제스처 맥락을 벗어나 키보드가 안 올라온다
   *    (전체화면 요청이 같은 이유로 클릭 핸들러 안에 있다 — §9-0-2).
   *  · 두 번째(다음 프레임) — 그 사이 다른 코드가 포커스를 가져갔거나 노드가 아직
   *    안 붙었을 때를 위한 보험. 이미 잡혀 있으면 아무 일도 안 한다.
   *
   * `preventScroll` 은 배경이 덜컥 스크롤되는 것을 막는다(팝업은 어차피 화면 고정이다).
   */
  function focus() {
    const go = () => {
      if (!input.isConnected || document.activeElement === input) return;
      try { input.focus({ preventScroll: true }); } catch { input.focus(); }
    };
    go();
    requestAnimationFrame(go);
  }

  return { node: input, input, send, focus };
}

/**
 * 버튼 줄에 붙일 전송 버튼.
 *
 * 라벨이 자리마다 다르다 — 받는 순간 뜨는 팝업에서는 `보내기`,
 * 받은 메세지함에서는 사용자가 지정한 `답장` 이다(`[닫기][삭제][답장]`).
 */
export function replyButton(send, label = S.send) {
  return button(label, send, { primary: true });
}
