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
import { el, button, presentOverlay, toast, confirmDialog } from './ui.js';
import { characterById, characterSprite } from '../data/characters.js';
import { SLOT_COLORS } from '../game/palette.js';
import { currentUser } from '../services/auth.js';
import * as Presence from '../services/presence.js';
import * as Room from '../services/multiplayer.js';
import { get as getProfile } from '../services/profile.js';
import { stampFull } from './timeText.js';
import { replyInput } from './replyInput.js';

/**
 * ★ **못 보낸 이유를 구분해서 말한다.** (2026-08-19 12차, 사용자 지정)
 *   off     — 상대가 수신을 꺼 뒀다 (`prefs/accept`, 미리 읽어서 안다)
 *   blocked — 상대가 나를 차단했다 (규칙이 거부한다. 차단 목록은 못 읽는다)
 * 둘을 "실패"로 뭉뚱그리면 사용자는 자기 네트워크를 의심하게 된다.
 *
 * 쪽지와 대결신청이 **같은 표**를 쓴다 — 실패 이유가 같기 때문이다(15차).
 */
const REASON = {
  ok: S.messageSent,
  off: S.peerRecvOff,
  blocked: S.peerBlocked,
  error: S.networkError,
};

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
  /**
   * ★★ **드래곤 화면에서 연 카드는 드래곤 것을 보여준다.** (2026-08-27, 사용자 지적)
   *
   * *"제발 이건 신발을 찾아서가 아니야, 착각하지마, 신발을 찾아서를 참고만 하라고 했지
   *   링크를 그걸로 걸어버리면 진짜 난해하다"*
   *
   * `game:'dragon'` 은 부르는 쪽에서 이미 넘기고 있었는데 **이 함수가 안 봤다.**
   * 그래서 드래곤 순위표에서 아이디를 눌러도 신발 캐릭터 얼굴과
   * `보유신발 0켤레` 가 떴다. 같은 부품을 쓰는 것은 맞지만
   * **입는 옷은 게임마다 달라야 한다.**
   *
   * 드래곤 카드에 뜨는 것: 드래곤 얼굴 / 드래곤 이름 / **보유중인 금화** /
   * 최고 스테이지 / 결투 전적.
   */
  const isDragon = opt.game === 'dragon';
  const games = isDragon
    ? (p.dragonMultiWins ?? 0) + (p.dragonMultiLosses ?? 0)
    : (p.multiWins ?? 0) + (p.multiLosses ?? 0);
  const ch = characterById(p.characterId);
  /** 드래곤 그림은 게임 모듈에 있다 — 신발 화면에서는 안 받는다 */
  let dragonMod = null;

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
  /**
   * ★★ **현재위치.** (2026-08-27, 사용자 지정)
   *
   * *"현재위치 : 드래곤 스트라이커 로비 (...) 즉, 뭐하고 있는지, 어디에 있는지"*
   *
   * `현재상태` 는 게임중/대기중까지만 말한다. 게임이 둘이 되면서 그것만으로는
   * **어느 게임 앞에 앉아 있는지**를 알 수 없다 — 드래곤 대결을 신청하려는데
   * 상대가 신발게임 로비에 있으면 그걸 알고 눌러야 한다.
   * 상태 줄과 같은 이유로 **자리를 먼저 잡아 두고** 값이 오면 글자만 바꾼다.
   */
  const placeLine = el('div.user-card-place', S.whereAt(S.whereUnknown));
  /** presence 의 (state, game) 을 사람이 읽는 한 줄로 */
  function placeText(state, game){
    if (state === 'offline') return S.whereUnknown;
    if (game === 'dragon') return state === 'playing' ? S.whereDragonPlay : S.whereDragonLobby;
    if (game === 'shoes') return state === 'playing' ? S.whereShoesPlay : S.whereShoesLobby;
    return state === 'playing' ? S.whereUnknown : S.whereArcade;
  }
  const paintPlace = () => {
    placeLine.textContent = S.whereAt(placeText(status, where));
  };
  const row = el('div.row.user-card-actions');
  const face = el('div.player-card-face',
    { style: { '--slot': SLOT_COLORS[opt.slot ?? 0] ?? SLOT_COLORS[0] } },
    (!isDragon && ch) ? [el('img', { src: characterSprite(ch.id, 'front'), alt: ch.ko })] : []);
  const charLine = el('div.player-card-char', (!isDragon && ch) ? ch.ko : '');
  /* 보유 금화는 전적 줄 안에 들어간다 — 신발의 `보유신발 N켤레` 와 같은 자리다 */
  const coinLine = null;
  /* ★ 두 게임이 **같은 자리·같은 모양**이다 — 신발은 켤레, 드래곤은 금화 (2026-08-27) */
  const statLine = el('div.dialog-detail', isDragon
    ? S.playerStatDragon(p.dragonMultiWins ?? 0, games, p.dragonCoins ?? 0)
    : S.playerStatPopup(p.multiWins ?? 0, games, p.shoesOwned ?? 0));

  /** 드래곤 얼굴과 이름을 지금 아는 값으로 다시 칠한다 */
  function paintDragon(v) {
    if (!isDragon || !dragonMod) return;
    const idx = v.dragonCharacter | 0;
    face.textContent = '';
    const art = dragonMod.dragonPortrait(idx, 3);
    if (art) face.append(art);
    charLine.textContent = dragonMod.dragonList()[idx]?.ko ?? '';
  }
  if (isDragon) {
    import('./DragonGame.js')
      .then((m) => m.loadDragon())
      .then((m) => { dragonMod = m; paintDragon(p); })
      .catch(() => {});   // 못 받아도 이름·금화·전적은 나온다
  }

  /**
   * ★ **아이디를 눌렀다는 건 대개 말을 걸려는 것이다.** (2026-08-19 19차, 사용자 지정)
   *
   * *"메세지 보내기를 눌러서 보낼 메세지를 입력하는 것이 아니라 (…) 유저상태창이 뜨면
   *   하단에 (…) text입력칸을 만들고 (…) 그 아래 [메세지 보내기] 버튼을 큼직하고 길게"*
   *
   * 예전에는 `메세지 보내기` → 창을 닫고 → 입력 팝업을 새로 여는 **두 단계**였다.
   * 그 사이에 화면이 바뀌면 입력이 통째로 날아가고, 무엇보다 한 번 더 눌러야 했다.
   * 입력칸은 받은 쪽지 팝업과 **같은 부품**(`replyInput`)을 쓴다 — 각자 만들면
   * 언젠가 둘이 다른 말을 한다(§9-0-44 에서 같은 이유로 뺐다).
   */
  /**
   * ★ **입력칸과 버튼은 한 세트다.** (2026-08-27, 사용자 지정)
   *
   * *"[보낼 메세지를 입력하세요] 메세지 보내기 [1:1대결신청][닫기]
   *   이런 버튼이 뜨거든, 무조건 이 버튼은 셋트야"*
   *
   * 예전에는 화면마다 `actions:false` 로 꺼서 어떤 카드는 입력칸이 있고 어떤
   * 카드는 없었다 — **같은 창인데 열리는 곳마다 다르면** 무엇을 할 수 있는지
   * 매번 다시 봐야 한다. 내 카드에서만 뺀다(나에게 쪽지를 보낼 일은 없다).
   */
  const compose = (isMe || !p.uid) ? null : replyInput(p, close);

  const overlay = el('div.dialog-overlay', { onclick: close }, [
    el('div.dialog', { onclick: (e) => e.stopPropagation() }, [
      // 자리 색 테두리 — 인게임 레이스 게이지와 같은 신호를 쓴다 (없으면 기본색)
      face,
      el('div.dialog-msg', p.nickname || '???'),
      charLine,
      coinLine,
      statLine,
      statusLine,
      placeLine,
      loginLine,
      compose?.node ?? null,
      // 큼직하고 긴 빨간 버튼 — 이 창에서 제일 자주 누르는 것이라 눈에 먼저 들어와야 한다
      compose ? button(S.sendMessage, compose.send, { class: 'danger wide' }) : null,
      row,
    ].filter(Boolean)),
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
      if (full.lastLoginAt) lastLoginAt = full.lastLoginAt;
      paintLogin();
      if (isDragon) {
        const dg = (full.dragonMultiWins ?? 0) + (full.dragonMultiLosses ?? 0);
        statLine.textContent = S.playerStatDragon(full.dragonMultiWins ?? 0, dg, full.dragonCoins ?? 0);
        paintDragon(full);
        return;
      }
      const g = (full.multiWins ?? 0) + (full.multiLosses ?? 0);
      statLine.textContent = S.playerStatPopup(full.multiWins ?? 0, g, full.shoesOwned ?? 0);
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
  let where = p.game ?? '';          // presence 의 game — 현재위치를 만드는 값
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
  paintPlace();

  /**
   * 아래 줄은 **`[1:1대결신청] [닫기]` 두 개, 색 없이**다(19차 사용자 지정).
   * 보내기는 위의 빨간 버튼이 맡으므로 여기서 빠졌다.
   * 대결 버튼을 못 붙이는 자리(대기방처럼 이미 같은 방)에서는 `닫기` 만 남는다.
   */
  function paintActions() {
    row.textContent = '';
    /* ★ 대결신청도 세트다 — 같은 방에 이미 앉아 있는 경우(challenge:false)만 뺀다 */
    const canChallenge = !isMe && p.uid && opt.challenge !== false;
    if (canChallenge) {
      row.append(button(S.challengeUser, () => {
        /**
         * 게임 중·미접속에는 안 보낸다. 사용자 문구 그대로 알린다 —
         * *"게임중 상태에선 메세지를 보낼 수 없습니다"*.
         */
        if (status !== 'lobby') return toast(S.cantChallengeNow, 2200);
        close();
        startChallenge(p, opt.nav, isDragon ? 'dragon' : 'shoes');
      }));
    }
    row.append(button(S.close, close, { sfx: 'sfx_menu_back' }));
  }
  paintActions();

  /**
   * ★ **마지막 로그인을 이 창이 직접 받아 온다.** (2026-08-19 14차)
   *
   * 12차에 줄은 만들었는데 값을 채우는 길이 `opt.load` 하나뿐이었고 **그걸 넘기는 화면은
   * 명예의 전당뿐**이었다. 그래서 대기방·게임 결과·현재접속자에서 접속이 끊긴 사람을 열면
   * 늘 `마지막로그인: 기록 없음` 이었다 — 사용자가 "처리한거 맞아?" 라고 물은 자리가 여기다.
   *
   * 조회는 **정말 필요할 때만** 한다: 접속 중이면 어차피 `현재로그인중` 이라 읽을 이유가 없고,
   * 이미 값을 들고 왔으면(`p.lastLoginAt`) 그것으로 끝이다. 남는 경우 — **접속이 끊긴
   * 사람의 카드** — 에만 계정 문서를 한 번 읽는다.
   *
   * `leaderboard.js` 를 정적으로 물지 않는 이유는 부팅 무게다(§9-0-43) — 이 창은
   * 로비에서도 열리는데 Firestore 코드를 같이 끌고 올 이유가 없다.
   */
  let fetched = false;
  function fetchLastLogin() {
    if (fetched || opt.load || lastLoginAt || !p.uid || isMe) return;
    if (status !== 'offline') return;   // 접속 중이면 날짜가 필요 없다
    fetched = true;
    import('../services/leaderboard.js')
      .then((m) => m.fetchUserCard(p.uid))
      .then((full) => {
        if (!full?.lastLoginAt) return;
        lastLoginAt = full.lastLoginAt;
        paintLogin();
      })
      .catch(() => {});
  }

  if (p.uid && !isMe) {
    /**
     * ★ 상태를 이미 알아도 **위치는 물어봐야 한다.** (2026-08-27)
     * 부르는 화면이 넘겨 주는 것은 `playing/lobby` 까지이고,
     * 어느 게임인지는 presence 에만 있다.
     */
    Presence.readOne(p.uid).then((v) => {
      if (!opt.status) {
        status = v?.state === 'playing' ? 'playing' : (v ? 'lobby' : 'offline');
        statusLine.textContent = STATUS_TEXT[status];
        paintLogin();
        paintActions();
      }
      /**
       * ★ **모르면 지우지 말고 알던 것을 둔다.** (2026-08-27)
       * `where = v?.game || ''` 이라 접속 정보가 없을 때 부르는 화면이 알려 준
       * 게임까지 지워져서 "오락실" 로 떨어졌다. 아는 것이 없을 때만 비운다.
       */
      if (v && v.game) where = v.game;
      else if (!v) status = status ?? 'offline';
      paintPlace();
    }).catch(() => {});
    fetchLastLogin();
  } else {
    fetchLastLogin();
  }

  dismiss = presentOverlay(overlay);
  /**
   * 창이 붙자마자 커서를 입력칸에 넣는다 (2026-08-19 20차, 사용자 지정) —
   * *"유저 상태창 뜨면 바로 내용 입력하고 바로 보내기 누르면 보내지는거야"*.
   * `presentOverlay` 가 노드를 붙인 **직후**여야 한다. 그 전에는 문서에 없는 노드라
   * `focus()` 가 조용히 아무 일도 하지 않는다.
   *
   * 메뉴 커서(`menuNav`)가 팝업이 열릴 때 첫 버튼을 잡으려 하는데, 그쪽은 입력 중이면
   * (`typing()`) 물러난다 — 그래서 여기서 **먼저** 잡아 두면 뺏기지 않는다.
   */
  compose?.focus();
}

/**
 * ~~쪽지 쓰기 팝업~~ — **19차에 없앴다.**
 *
 * 유저상태창 안에 입력칸이 들어가면서(사용자 지정) 이 창을 열 자리가 사라졌다.
 * 지우지 않고 자리만 남기면 다음 사람이 "왜 안 쓰이지?" 하고 되살리게 되므로
 * 함수째 지운다 — 되살릴 일이 생기면 `replyInput` 을 팝업에 감싸면 그만이다.
 */


/**
 * 대결 신청 — **방을 먼저 만들고** 그 코드를 실어 보낸다.
 *
 * 순서가 중요하다. "수락하면 그때 방을 만든다"로 하면 수락한 사람이 빈 화면에서
 * 상대를 기다리게 되고, 신청자가 그 사이에 앱을 닫으면 방이 영영 안 생긴다.
 * 방을 먼저 파면 **신청자는 곧장 그 방 대기실로 들어가** 기다린다 — 상대가 거절해도
 * 그냥 평범한 비밀방 하나가 남을 뿐이다.
 */
/**
 * @param {object} p 상대 카드
 * @param {object} nav
 * @param {'shoes'|'dragon'} [game] 어느 게임의 대결인가
 */
const GAME_KO = { shoes: '신발을 찾아서', dragon: '드래곤 스트라이커' };

export async function startChallenge(p, nav, game = 'shoes') {
  const prof = getProfile();

  /**
   * ★ **상대가 다른 게임 중이면 한 번 되묻는다.** (2026-08-26, 사용자 지정)
   * 신발게임을 하고 있는 사람에게 드래곤 대결을 걸면 그 사람은 하던 판을
   * 접고 와야 한다 — 걸기 전에 알고 걸어야 한다.
   */
  const theirGame = p.game || '';
  if (theirGame && theirGame !== game) {
    const go = await confirmDialog({
      message: S.challengeBusyOther(p.nickname || '???', GAME_KO[theirGame] ?? theirGame),
      yes: S.yes, no: S.no,
    });
    if (!go) return;
  }

  const code = await Room.createRoom({ isPrivate: true, difficulty: prof.difficulty, game }).catch(() => null);
  if (!code) return toast(S.networkError, 2000);

  /**
   * ★ **돌려받는 값은 boolean 이 아니라 상태 문자열이다.** (2026-08-19 15차, 사용자 신고)
   *
   * `sendChallenge` 는 `'ok' | 'off' | 'blocked' | 'error'` 를 준다. 예전 코드는
   * `if (!ok)` 로 봤는데 **빈 문자열이 아닌 모든 문자열은 참**이라 `'error'` 도 `'blocked'`
   * 도 전부 성공으로 읽혔다. 그래서 신청이 아예 안 갔는데도
   * **"대결 신청을 보냈습니다"** 가 뜨고 신청자는 아무도 안 오는 빈 방에서 기다렸다 —
   * 사용자가 말한 "대결신청이 안된다"가 정확히 이 그림이다.
   */
  const r = await Presence.sendChallenge(p.uid, code, game);
  if (r !== 'ok') {
    /**
     * 신청이 못 갔으면 **방을 남기지 않는다.** 빈 방은 자동 매칭이 훑는 12칸을
     * 갉아먹어 남들의 매칭까지 굶긴다(§9-0-17·§9-0-21 ②에서 두 번 데인 자리다).
     */
    Room.leaveRoom(code).catch(() => {});
    return toast(REASON[r] ?? S.networkError, 2400);
  }
  toast(S.challengeSent, 1800);
  if (nav) {
    /**
     * ★★ **`game` 을 안 넘겼었다.** (2026-08-28, 사용자 신고 — "절대로 신발을
     *   찾아서랑 섞이면 안됨")
     * `WaitingRoom` 은 `params.game` 이 `'dragon'` 이 아니면 조용히 신발
     * 모드로 그린다. 방금 만든 `code` 는 이미 `game`(위에서 받은 값) 그대로
     * `createRoom` 에 실려 갔으니, 여기서도 같은 값을 넘겨야 화면과 방이
     * 어긋나지 않는다 — 드래곤에서 대결을 걸었는데 신발 대기방이 뜨던 자리다.
     */
    // 순환 참조를 피해 여기서 늦게 부른다 (WaitingRoom → UserCard → WaitingRoom)
    import('./multi/WaitingRoom.js').then((m) => nav.push(m.default, { code, game })).catch(() => {});
  }
}
