/**
 * 유저상태창 — 사람 하나를 보여 주는 **하나뿐인** 카드. (2026-08-19 11차, 사용자 지정)
 *
 * 원래는 대기방(`multi/WaitingRoom.js`)에만 있던 팝업이다. 사용자가 명예의 전당과
 * 현재접속자 목록에서도 **같은 창**을 요구했으므로 여기로 떼어냈다 —
 * *"그 창엔 캐릭터이미지/아이디/캐릭터이름/승률/보유신발 뜨는 그 창 이제부터
 * '유저상태창' 뜨게끔 해줘"*.
 *
 * 세 화면이 각자 팝업을 만들면 언젠가 셋이 서로 다른 말을 한다. 실제로 대기방 카드만
 * 캐릭터 그림이 있고 나머지는 없었다.
 *
 * ## 하단 두 버튼
 *
 * `메세지 보내기` 는 **누구에게나** 보낼 수 있다(게임 중이든 미접속이든 — 나올 때
 * 팝업으로 뜬다). `대결신청` 은 **접속 중 + 대기중**일 때만이다. 게임 중인 사람에게는
 * 신청을 띄울 화면이 없고(인게임은 캔버스다), 미접속이면 아예 못 받는다.
 */

import S from '../config/strings.ko.js';
import { el, button, presentOverlay, toast } from './ui.js';
import { characterById, characterSprite } from '../data/characters.js';
import { SLOT_COLORS } from '../game/palette.js';
import { currentUser } from '../services/auth.js';
import * as Presence from '../services/presence.js';
import * as Room from '../services/multiplayer.js';
import { get as getProfile } from '../services/profile.js';
import { stampFull } from './timeText.js';

const STATUS_TEXT = {
  playing: S.statusPlaying,
  lobby: S.statusIdle,
  offline: S.statusOffline,
};

/**
 * @param {{uid?:string, nickname?:string, characterId?:string, shoesOwned?:number,
 *          multiWins?:number, multiLosses?:number}} p
 * @param {{slot?:number, status?:'playing'|'lobby'|'offline', nav?:object,
 *          actions?:boolean}} [opt]
 *   `status` 를 안 주면 서버에 물어본다(현재접속자 목록처럼 이미 아는 화면은 넘긴다).
 */
export function openUserCard(p, opt = {}) {
  let dismiss = () => {};
  const close = () => dismiss();
  const me = currentUser()?.uid;
  const isMe = !!p.uid && p.uid === me;
  const games = (p.multiWins ?? 0) + (p.multiLosses ?? 0);
  const ch = characterById(p.characterId);

  /**
   * 상태 줄은 **자리를 먼저 잡아 두고** 값이 오면 글자만 바꾼다.
   * 나중에 끼워 넣으면 팝업 높이가 툭 튀어 버튼 위치가 바뀐다 — 그 순간 누른 사람은
   * 엉뚱한 버튼을 누른다.
   */
  const statusLine = el('div.user-card-status', STATUS_TEXT[opt.status] ?? S.statusOffline);
  /**
   * ★ **마지막 로그인.** (2026-08-19 12차, 사용자 지정)
   * 접속 중이면 `현재로그인중`. 아니면 계정 문서의 `lastLoginAt` 을 날짜로 찍는다.
   * 값이 늦게 오므로 자리를 먼저 잡아 둔다(상태 줄과 같은 이유 — 높이가 튀면 안 된다).
   */
  const loginLine = el('div.user-card-login', S.lastLogin(S.lastLoginNone));
  const row = el('div.row.user-card-actions');
  const face = el('div.player-card-face',
    { style: { '--slot': SLOT_COLORS[opt.slot ?? 0] ?? SLOT_COLORS[0] } },
    ch ? [el('img', { src: characterSprite(ch.id, 'front'), alt: ch.ko })] : []);
  const charLine = el('div.player-card-char', ch ? ch.ko : '');
  const statLine = el('div.dialog-detail', S.playerStatPopup(p.multiWins ?? 0, games, p.shoesOwned ?? 0));

  const overlay = el('div.dialog-overlay', { onclick: close }, [
    el('div.dialog', { onclick: (e) => e.stopPropagation() }, [
      // 자리 색 테두리 — 인게임 레이스 게이지와 같은 신호를 쓴다 (없으면 기본색)
      face,
      el('div.dialog-msg', p.nickname || '???'),
      charLine,
      statLine,
      statusLine,
      loginLine,
      row,
      button(S.close, close, { sfx: 'sfx_menu_back' }),
    ]),
  ]);

  /**
   * ★ **늦게 온 값으로 카드를 채운다.** (2026-08-19 11차)
   *
   * 명예의 전당의 주간·월간·연간 줄은 `scores` 에서 와서 **계단 수밖에 없다.**
   * 그대로 띄우면 `승률 0승 / 0게임 · 보유신발 0켤레` 라고 **거짓말을 한다.**
   * 그래서 아는 값으로 먼저 띄우고, 계정 문서가 도착하면 그 줄만 갈아 끼운다.
   */
  if (opt.load) {
    opt.load.then((full) => {
      if (!full) return;
      const g = (full.multiWins ?? 0) + (full.multiLosses ?? 0);
      statLine.textContent = S.playerStatPopup(full.multiWins ?? 0, g, full.shoesOwned ?? 0);
      if (full.lastLoginAt) lastLoginAt = full.lastLoginAt;
      paintLogin();
      const c = characterById(full.characterId);
      if (c) {
        charLine.textContent = c.ko;
        face.textContent = '';
        face.append(el('img', { src: characterSprite(c.id, 'front'), alt: c.ko }));
      }
    }).catch(() => {});
  }

  /** 지금 아는 상태로 버튼을 다시 만든다 */
  let status = opt.status ?? null;
  let lastLoginAt = p.lastLoginAt ?? 0;

  function paintLogin() {
    // 접속 중이면 날짜보다 "지금 여기 있다"가 훨씬 쓸모 있는 정보다
    if (status === 'playing' || status === 'lobby') {
      loginLine.textContent = S.lastLogin(S.lastLoginNow);
      return;
    }
    loginLine.textContent = S.lastLogin(lastLoginAt ? stampFull(lastLoginAt) : S.lastLoginNone);
  }
  paintLogin();

  function paintActions() {
    row.textContent = '';
    if (isMe || !p.uid || opt.actions === false) return;
    row.append(button(S.sendMessage, () => { close(); openComposer(p); }));
    // 대기방처럼 이미 같은 방에 앉아 있는 곳에서는 대결 버튼을 안 붙인다
    if (opt.challenge === false) return;
    row.append(button(S.challengeUser, () => {
      /**
       * 게임 중·미접속에는 안 보낸다. 사용자 문구 그대로 알린다 —
       * *"게임중 상태에선 메세지를 보낼 수 없습니다"*.
       */
      if (status !== 'lobby') return toast(S.cantChallengeNow, 2200);
      close();
      startChallenge(p, opt.nav);
    }, { primary: true }));
  }
  paintActions();

  if (!opt.status && p.uid && !isMe) {
    Presence.readOne(p.uid).then((v) => {
      status = v?.state === 'playing' ? 'playing' : (v ? 'lobby' : 'offline');
      statusLine.textContent = STATUS_TEXT[status];
      paintLogin();
      paintActions();
    }).catch(() => {});
  }

  dismiss = presentOverlay(overlay);
}

/**
 * 쪽지 쓰기. 입력칸 하나짜리 다이얼로그다.
 *
 * `maxlength` 를 100 으로 두는 건 규칙과 같은 숫자다 — 규칙에서 잘리면 쓰기가 통째로
 * 거부되는데, 사용자에게는 "보내기를 눌렀는데 아무 일도 안 났다"로 보인다.
 */
export function openComposer(p, prefill = '') {
  let dismiss = () => {};
  const close = () => dismiss();
  const input = el('input.nick-input.msg-input', {
    type: 'text', maxlength: '100', value: prefill,
    placeholder: S.messageHint, autocomplete: 'off',
  });

  /**
   * ★ **못 보낸 이유를 구분해서 말한다.** (2026-08-19 12차, 사용자 지정)
   *   off     — 상대가 수신을 꺼 뒀다 (`prefs/accept`, 미리 읽어서 안다)
   *   blocked — 상대가 나를 차단했다 (규칙이 거부한다. 차단 목록은 못 읽는다)
   * 둘을 "실패"로 뭉뚱그리면 사용자는 자기 네트워크를 의심하게 된다.
   */
  const REASON = {
    ok: S.messageSent,
    off: S.peerRecvOff,
    blocked: S.peerBlocked,
    error: S.networkError,
  };

  async function send() {
    const text = input.value.trim();
    if (!text) return toast(S.messageEmpty, 1600);
    close();
    const r = await Presence.sendMessage(p.uid, text, p.nickname ?? '');
    toast(REASON[r] ?? S.networkError, r === 'ok' ? 1800 : 2400);
  }

  const overlay = el('div.dialog-overlay', { onclick: close }, [
    el('div.dialog', { onclick: (e) => e.stopPropagation() }, [
      el('div.dialog-msg', p.nickname || '???'),
      input,
      el('div.row', null, [
        button(S.cancel, close, { sfx: 'sfx_menu_back' }),
        button(S.send, send, { primary: true }),
      ]),
    ]),
  ]);
  dismiss = presentOverlay(overlay);
  // 한글 조합 중 엔터는 무시한다 — 조합을 끝내는 엔터까지 전송으로 먹으면 글자가 잘린다
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(); }
  });
  setTimeout(() => input.focus(), 30);
}

/**
 * 대결 신청 — **방을 먼저 만들고** 그 코드를 실어 보낸다.
 *
 * 순서가 중요하다. "수락하면 그때 방을 만든다"로 하면 수락한 사람이 빈 화면에서
 * 상대를 기다리게 되고, 신청자가 그 사이에 앱을 닫으면 방이 영영 안 생긴다.
 * 방을 먼저 파면 **신청자는 곧장 그 방 대기실로 들어가** 기다린다 — 상대가 거절해도
 * 그냥 평범한 비밀방 하나가 남을 뿐이다.
 */
export async function startChallenge(p, nav) {
  const prof = getProfile();
  const code = await Room.createRoom({ isPrivate: true, difficulty: prof.difficulty }).catch(() => null);
  if (!code) return toast(S.networkError, 2000);
  const ok = await Presence.sendChallenge(p.uid, code);
  if (!ok) toast(S.networkError, 2000);
  else toast(S.challengeSent, 1800);
  if (nav) {
    // 순환 참조를 피해 여기서 늦게 부른다 (WaitingRoom → UserCard → WaitingRoom)
    import('./multi/WaitingRoom.js').then((m) => nav.push(m.default, { code })).catch(() => {});
  }
}
