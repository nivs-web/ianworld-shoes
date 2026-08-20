/**
 * S20 받은 메세지함 — 주고받은 쪽지 **전부**. (2026-08-19 12차, 사용자 지정)
 *
 * *"다른 사람에게 메시지 주고, 받은거 전부다 이력 뜨게끔하자 (…) 받은 메세지에 답변도
 * 바로 바로 할 수 있게 해서 게임 하는 유저들끼리 원활하게 소통이 가능하도록"*
 *
 * ## 팝업과 다른 점
 *
 * 팝업(`inboxPopups.js`)은 **안 읽은 것 하나**를 들이민다. 여기는 **읽은 것까지 전부**
 * 시간순으로 늘어놓는다. 그래서 읽은 쪽지를 지우지 않고 `read: true` 만 찍게 바꿨다 —
 * 지우면 이력이 사라진다.
 *
 * 줄을 누르면 위에 긴 `[이 사용자 차단하기 / 차단해제]`, 아래에 `[닫기][삭제][답장]`.
 * 차단은 화면이 막는 게 아니라 **규칙이 막는다**
 * (`prefs/$uid/blocked`, docs/FIREBASE_RULES.md) — 차단당한 쪽은 알 방법이 없다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title, toast, presentOverlay, confirmDialog } from './ui.js';
import * as Presence from '../services/presence.js';
import { replyInput, replyButton } from './replyInput.js';
import { stamp } from './timeText.js';

/**
 * 쪽지 팝업의 알맹이. **미리보기(`preview:msg`)가 이 함수를 그대로 부른다** —
 * 마크업을 손으로 베낀 미리보기는 언젠가 거짓말을 한다(§9-0-33).
 *
 * 버튼 배치는 사용자 지정 그대로다:
 * 긴 `[이 사용자 차단하기 / 차단해제]` 한 줄, 그 아래 `[닫기][삭제][답장]`.
 */
export function inboxCard(m, { rep, blocked, close, onBlock, onDelete }) {
  const otherUid = m.out ? m.to : m.from;
  const otherName = (m.out ? m.toName : m.fromName) || '???';
  return el('div.dialog', { onclick: (e) => e.stopPropagation() }, [
    el('div.dialog-msg', m.out ? otherName : S.messageFrom(otherName)),
    el('div.inbox-when', stamp(m.at)),
    el('div.inbox-text', m.text || ''),
    rep?.node,
    // 긴 버튼 하나 — 세 버튼 줄과 섞이지 않게 자기 줄을 갖는다
    otherUid ? el('div.row.row-wide', null, [
      button(blocked ? S.unblockUserLong : S.blockUserLong, onBlock,
        { class: blocked ? 'unblock' : 'block' }),
    ]) : null,
    el('div.row', null, [
      button(S.close, close, { sfx: 'sfx_menu_back' }),
      button(S.deleteMessage, onDelete, { sfx: 'sfx_menu_back' }),
      rep ? replyButton(rep.send, S.replyShort) : null,
    ].filter(Boolean)),
  ].filter(Boolean));
}

export default function Inbox(nav) {
  /** null = 아직 못 받았다 */
  let rows = null;
  /** 못 붙었다 — "메세지가 없다"와 다른 말을 해야 한다 */
  let failed = false;
  /**
   * 목록 탭 (2026-08-19 22차, 사용자 지정). 기본은 **전체보기**.
   * 서버에서 다시 받아 오지 않는다 — 이미 손에 있는 목록을 거를 뿐이다.
   */
  let filter = 'all';   // 'all' | 'in' | 'out'
  let prefs = { accept: true, blocked: {} };
  /** 수신 설정을 **한 번이라도 읽었는가** — 못 읽었으면 상태를 단정하지 않는다 */
  let prefsKnown = false;
  let unsub = () => {};
  let unsubPrefs = () => {};

  unsub = Presence.subscribeInbox((list) => {
    if (!list) { failed = true; rows = null; return nav.refresh(); }
    failed = false;
    // 대결 신청은 이력이 아니다 — 팝업이 처리하고 지운다
    rows = list.filter((m) => m.kind !== 'challenge').slice().reverse();
    nav.refresh();
  });
  /**
   * ★ **서버 값이 안 와도 차단 상태를 잃지 않는다.** (2026-08-19 14차)
   *
   * 14차 전까지 `prefs/$uid` 에는 읽기 규칙이 없었다(잎에만 있었고 RTDB 읽기 권한은
   * 아래로만 흐른다). 그래서 이 구독이 **늘 권한 거부**로 떨어져 `blocked` 가 언제나
   * `{}` 였고, 버튼은 영원히 '차단하기' 로만 그려졌다 —
   * *"지금 차단은 가능한데 차단 푸는 기능이 없는거 같아"* 의 정체가 이것이다.
   *
   * 규칙은 고쳤지만(§9-0-44), **화면이 서버 한 곳에만 기대지 않게** 여기도 같이 고친다:
   * 못 읽으면 지금 값을 그대로 두고, 내가 차단/해제한 결과는 로컬에 바로 반영한다.
   */
  unsubPrefs = Presence.subscribeMyPrefs((v) => {
    // 못 읽었으면 **지금 값을 그대로 둔다** — 내가 방금 차단해 둔 것을 지우면 안 된다
    if (!v) {
      // 끝내 못 읽었으면 기본값(수신허용)으로 말한다 — 수신 설정 화면과 같은 판단이다
      if (!prefsKnown) { prefsKnown = true; nav.refresh(); }
      return;
    }
    prefs = v;
    prefsKnown = true;
    nav.refresh();
  });

  /** 내가 방금 누른 결과를 서버 응답을 기다리지 않고 반영한다 */
  function markBlocked(uid, on) {
    const next = { ...(prefs.blocked ?? {}) };
    if (on) next[uid] = true; else delete next[uid];
    prefs = { ...prefs, blocked: next };
    nav.refresh();
  }

  /**
   * 줄 하나를 누르면 뜨는 창.
   *
   * ★ (2026-08-19 14차, 사용자 지정) 버튼 구성이 바뀌었다 —
   * 긴 `[이 사용자 차단하기 / 차단해제]` 하나가 위에, 그 아래 `[닫기][삭제][답장]`.
   * 차단은 **누를 때마다 뒤집힌다**(한 번 더 누르면 풀린다).
   * 답장은 팝업 안의 입력칸에 그대로 쓴다 — 창을 하나 더 띄우지 않는다(§14차 ⑤와 같은 이유).
   */
  function open(m) {
    const otherUid = m.out ? m.to : m.from;
    const otherName = (m.out ? m.toName : m.fromName) || '???';
    const blocked = !!prefs.blocked?.[otherUid];
    let dismiss = () => {};
    const close = () => dismiss();

    const rep = otherUid
      ? replyInput({ uid: otherUid, nickname: otherName }, () => close())
      : null;

    /** 차단 → 되묻는다(실수로 누르면 그 사람 쪽지가 통째로 안 온다). 해제 → 바로 푼다 */
    async function toggleBlock() {
      if (!blocked) {
        const ok = await confirmDialog({
          message: S.blockConfirm(otherName),
          detail: S.blockConfirmDetail,
          yes: S.blockUser,
          no: S.cancel,
        });
        if (!ok) return;
      }
      close();
      const ok2 = await Presence.setBlocked(otherUid, !blocked);
      if (ok2) markBlocked(otherUid, !blocked);
      toast(ok2 ? (blocked ? S.unblockedDone : S.blockedDone) : S.networkError, 1800);
    }

    /** 이 쪽지 한 통만 서버에서 지운다 (이력에서 사라진다) */
    async function removeOne() {
      close();
      const ok = await Presence.drop(m.id).then(() => true).catch(() => false);
      if (!ok) return toast(S.networkError, 1800);
      toast(S.messageDeleted, 1500);
    }

    const overlay = el('div.dialog-overlay', { onclick: close }, [
      inboxCard(m, { rep, blocked, close, onBlock: toggleBlock, onDelete: removeOne }),
    ]);
    dismiss = presentOverlay(overlay);
    // 목록에서 열었으면 읽은 것이다
    if (!m.out && !m.read) Presence.markRead(m.id).catch(() => {});
  }

  function row(m) {
    const otherUid = m.out ? m.to : m.from;
    const otherName = (m.out ? m.toName : m.fromName) || '???';
    return el('div.inbox-row', {
      class: [m.out ? 'out' : 'in', !m.out && !m.read ? 'unread' : ''].filter(Boolean).join(' '),
      onclick: () => open(m),
    }, [
      el('div.inbox-dir', m.out ? S.inboxSent : S.inboxRecv),
      el('div.inbox-who', null, [
        el('span.inbox-name', otherName),
        prefs.blocked?.[otherUid] ? el('span.inbox-blocked', S.blockedTag) : null,
      ].filter(Boolean)),
      el('div.inbox-line', m.text || ''),
      el('div.inbox-when', stamp(m.at)),
    ]);
  }

  return {
    onLeave() { unsub(); unsubPrefs(); unsub = () => {}; unsubPrefs = () => {}; },

    render() {
      /**
       * ★ **탭은 거르기만 한다.** (2026-08-19 22차, 사용자 지정)
       * *"[전체보기][받은 메세지][보낸 메세지] (…) 일단 전체보기가 활성화 되어 있도록"*
       *
       * 서버 구독은 하나뿐이고 목록도 이미 손에 있다 — 탭마다 다시 받아 오면
       * 같은 데이터를 세 번 받게 되고, 탭을 옮길 때마다 화면이 비었다 채워진다.
       */
      const shown = rows === null ? null : rows.filter(
        (m) => (filter === 'all' ? true : filter === 'out' ? !!m.out : !m.out)
      );
      // 빈 목록의 문구는 탭마다 다르다 — 아래 `inboxEmptyIn` 주석 참고
      const emptyText = filter === 'in' ? S.inboxEmptyIn
        : filter === 'out' ? S.inboxEmptyOut : S.inboxEmpty;

      let body;
      let listed = false;   // 본문이 **스크롤되는 목록**인가 (로딩·오류·빈 목록은 아니다)
      if (failed) body = el('div.hint', S.networkError);
      else if (shown === null) body = el('div.hint', S.loading);
      else if (!shown.length) body = el('div.hint', emptyText);
      else { body = el('div.inbox-list', null, shown.map(row)); listed = true; }

      /**
       * 지금 어느 쪽인지 **타이틀 바로 아래에서** 말한다 (22차, 사용자 지정).
       * 수신 설정 화면과 **같은 부품·같은 문구**(`.msg-accept-now`)를 쓴다 —
       * 두 화면이 같은 상태를 다른 말로 표시하면 어느 쪽이 진짜인지 알 수 없다.
       *
       * 아직 못 읽었으면 단정하지 않는다: `현재상태 : 수신허용` 이라고 써 놓고
       * 잠시 뒤 뒤집히는 쪽이 제일 나쁘다(§9-0-6).
       */
      const blocked = prefs.accept === false;
      const stateWord = !prefsKnown ? S.loading : (blocked ? S.msgAcceptOff : S.msgAcceptOn);
      const stateLine = el('div.msg-accept-now', { class: blocked ? 'off' : '' },
        S.msgAcceptNow(stateWord));

      const tabs = el('div.seg.inbox-tabs', null, [
        [S.inboxTabAll, 'all'], [S.inboxTabIn, 'in'], [S.inboxTabOut, 'out'],
      ].map(([label, id]) => button(label, () => {
        if (filter === id) return;      // 같은 탭을 다시 눌러도 화면을 헛되이 다시 그리지 않는다
        filter = id;
        nav.refresh();
      }, { class: filter === id ? 'on' : '', sfx: 'sfx_menu_move' })));

      /**
       * ★ **수신차단 상태면 맨 위에서 먼저 알린다.** (2026-08-19 21차, 사용자 지정)
       *
       * *"아, 내가 수신거부 눌러서 아무런 메세지도 받을 수 없구나 라는 것을 한 눈에
       *   알 수 있도록 만들어"*
       *
       * 이 화면이 그 자리인 이유: 차단해 둔 사람이 "왜 아무 쪽지도 안 오지?" 하고
       * 들여다보는 곳이 바로 여기다. 그때 **빈 목록만 보이면 고장으로 읽힌다.**
       *
       * 허용 상태에서는 **아무것도 안 띄운다** — 늘 뜨는 안내는 곧 안 읽히는 안내다.
       * 값을 아직 못 받았을 때(`accept` 초기값 `true`)도 안 띄운다: 없는 상태를
       * 있다고 말하는 쪽이 훨씬 나쁘다.
       */
      const blockedNotice = blocked
        ? el('div.inbox-notice', S.inboxBlockedNotice)
        : null;

      // 목록이 있으면 여백을 넣지 않는다 — 그쪽이 남는 공간을 가져가면 목록 아래가 빈다
      return screen(
        title(S.inboxTitle),
        stateLine,
        blockedNotice,
        tabs,
        body,
        listed ? null : el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
