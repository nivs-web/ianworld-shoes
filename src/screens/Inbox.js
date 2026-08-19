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
 * 줄을 누르면 `답장하기 / 차단 / 닫기`. 차단은 화면이 막는 게 아니라 **규칙이 막는다**
 * (`prefs/$uid/blocked`, docs/FIREBASE_RULES.md) — 차단당한 쪽은 알 방법이 없다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title, toast, presentOverlay, confirmDialog } from './ui.js';
import * as Presence from '../services/presence.js';
import { openComposer } from './UserCard.js';
import { stamp } from './timeText.js';

export default function Inbox(nav) {
  /** null = 아직 못 받았다 */
  let rows = null;
  /** 못 붙었다 — "메세지가 없다"와 다른 말을 해야 한다 */
  let failed = false;
  let prefs = { accept: true, blocked: {} };
  let unsub = () => {};
  let unsubPrefs = () => {};

  unsub = Presence.subscribeInbox((list) => {
    if (!list) { failed = true; rows = null; return nav.refresh(); }
    failed = false;
    // 대결 신청은 이력이 아니다 — 팝업이 처리하고 지운다
    rows = list.filter((m) => m.kind !== 'challenge').slice().reverse();
    nav.refresh();
  });
  unsubPrefs = Presence.subscribeMyPrefs((v) => {
    if (!v) return;
    prefs = v;
    nav.refresh();
  });

  /** 줄 하나를 누르면 뜨는 창 — 답장하기 / 차단 / 닫기 */
  function open(m) {
    const otherUid = m.out ? m.to : m.from;
    const otherName = (m.out ? m.toName : m.fromName) || '???';
    const blocked = !!prefs.blocked?.[otherUid];
    let dismiss = () => {};
    const close = () => dismiss();

    const overlay = el('div.dialog-overlay', { onclick: close }, [
      el('div.dialog', { onclick: (e) => e.stopPropagation() }, [
        el('div.dialog-msg', m.out ? otherName : S.messageFrom(otherName)),
        el('div.inbox-when', stamp(m.at)),
        el('div.inbox-text', m.text || ''),
        el('div.row', null, [
          button(S.close, close, { sfx: 'sfx_menu_back' }),
          otherUid ? button(blocked ? S.unblockUser : S.blockUser, async () => {
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
            toast(ok2 ? (blocked ? S.unblockedDone : S.blockedDone) : S.networkError, 1800);
          }) : null,
          otherUid ? button(S.replyMessage, () => {
            close();
            openComposer({ uid: otherUid, nickname: otherName });
          }, { primary: true }) : null,
        ].filter(Boolean)),
      ]),
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
      let body;
      if (failed) body = el('div.hint', S.networkError);
      else if (rows === null) body = el('div.hint', S.loading);
      else if (!rows.length) body = el('div.hint', S.inboxEmpty);
      else body = el('div.inbox-list', null, rows.map(row));

      return screen(
        title(S.inboxTitle),
        body,
        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
