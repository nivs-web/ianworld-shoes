/**
 * 화면에 보이는 모든 한국어 문구. 다른 파일에 한글을 직접 쓰지 않는다.
 * 기획서에 명시된 문구는 토씨 하나 바꾸지 않는다. (CLAUDE.md §6-2)
 */

export const S = {
  // ── 브랜드 ────────────────────────────────
  portalTitle: '오락실 이안월드',
  gameTitle: '신발을 찾아서',

  // ── S01 로그인 ────────────────────────────
  touchToStart: '터치해서 시작',
  loginGoogle: 'Google로 시작하기',
  loginRequired: '이 게임은 멀티플레이입니다. Google 계정으로 시작해주세요',
  loginUnavailable: '지금은 로그인 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요',
  /** 팝업이 막혔는데 리다이렉트도 못 쓰는 환경 — 헛걸음 대신 사실대로 알린다 */
  loginPopupBlocked: '브라우저가 로그인 창을 막았습니다. 팝업을 허용하고 다시 눌러주세요',
  installShortcut: '앱 바로가기 만들기',
  installIosGuide: '공유 버튼 → "홈 화면에 추가"를 눌러주세요',
  installDone: '홈 화면에 추가되었습니다',
  /**
   * 안드로이드 크롬인데 설치 프롬프트가 아직 안 왔을 때 (2026-08-19).
   * 예전엔 이 경우에도 PC용 Ctrl+D 안내가 나가서 폰 사용자가 막혔다.
   */
  installAndroidGuide: '브라우저 메뉴(⋮) → "홈 화면에 추가"를 눌러주세요',
  /** PC — 설치 프롬프트도 모바일도 아닌 브라우저(파이어폭스 등)의 마지막 수단 */
  installBookmarkGuide: 'Ctrl+D (Mac은 Cmd+D)를 눌러 즐겨찾기에 추가해주세요',
  loginFailed: '로그인에 실패했습니다. 다시 시도해주세요',
  logout: '로그아웃',
  logoutConfirm: '로그아웃 하시겠습니까?',
  loginWhy: '기록과 도감은 계정에 저장되어 어느 기기에서든 이어집니다',

  // ── S02 닉네임 ────────────────────────────
  nicknamePrompt: '캐릭터 이름을 입력하세요',
  nicknameRule: '한글 2자~5자로 입력해주세요',
  nicknameTaken: '이미 사용 중인 이름입니다',
  renameTitle: '캐릭터 닉네임 변경하기',
  renamePrompt: '변경할 이름을 입력하세요',
  renameCost: (n) => `* 닉네임 변경은 신발 ${n}개가 필요합니다`,
  renameNeedShoes: (n) => `신발이 부족합니다 (${n}개 필요)`,
  renameSame: '지금 쓰는 이름과 같습니다',
  renameDone: '닉네임을 바꿨습니다',
  nicknameInvalid: '한글 2자~5자만 사용할 수 있습니다',
  confirm: '확인',

  // ── S04 로비 ──────────────────────────────
  backToPortal: '오락실 화면으로 돌아가기',
  bestRecord: '최고기록',
  bestRecordUnit: '계단',
  myCollection: '내 신발 도감',
  collectionUnit: '켤레',
  playerName: '플레이어 이름',
  /** 로비 — 캐릭터 이름 자리에 있던 줄을 멀티 전적으로 바꿨다 (2026-08-19) */
  myMultiRecord: (wins, games) => `멀티게임 ${wins}승 / ${games}게임`,
  /** 로비 통계 — '나의' 를 뺐다 (2026-08-19 12차). 내 화면이라는 건 이미 안다 */
  myShoesOwned: (n) => `신발 보유량 ${n}켤레`,
  myDexProgress: (have, all) => `신발 도감 ${have}/${all}켤레`,
  difficultyTitle: '게임난이도를 높이면, 신발도 많이 등장합니다',
  difficultyEasy: '쉬움',
  difficultyNormal: '보통',
  difficultyHard: '어려움',
  menuCollection: '신발 도감',
  menuCharacter: '캐릭터 변경',
  menuRename: '닉네임 변경하기',
  menuHallOfFame: '명예의 전당',
  menuControls: '조작법 변경',
  /** 로비 메뉴 표기 — 안에 조작법 변경 + 음향 설정을 담는다 (2026-08-19) */
  menuSettings: '설정',
  playSingle: '싱글게임',
  playMulti: '멀티게임',

  // ── S04 엘리베이터 (기획서 §5-8-1) ─────────
  elevatorButton: '엘리베이터 (500층부터)',
  elevatorLocked: '500층 이상 도달 시 이용할 수 있습니다',
  elevatorConfirm: '엘리베이터를 타고 500층부터 시작합니다',
  /** @param {number} n 차감 켤레 수 */
  elevatorCost: (n) => `신발 ${n}켤레가 사라집니다`,

  // ── S05 캐릭터 선택 ────────────────────────
  select: '선택',
  buyCharacter: '캐릭터 구매하기',
  /** @param {number} n 필요한 신발 수 */
  needShoes: (n) => `* 신발 ${n}개 필요 *`,
  purchaseWarning: '티어가 높은 신발부터 사라집니다',
  purchaseConfirm: '구매하시겠습니까?',
  purchaseDone: '구매 완료!',
  purchaseFailed: '신발이 부족합니다',

  // ── S06 신발 도감 ──────────────────────────
  collectionTitle: '신발 도감',
  totalShoes: '총 신발 갯수',
  /** 같은 신발을 여러 켤레 들고 있을 때만 표기한다 (1켤레는 아무것도 안 쓴다) */
  ownedPairs: (n) => `${n}켤레 보유`,
  /** 주운 횟수 — 보유 켤레와 다르다. 신발을 써도 이 숫자는 줄지 않는다 */
  foundTimes: (n) => `${n}회 획득`,
  /** 중복 포함 보유 켤레 — 130으로 나누면 안 된다 */
  totalShoesCount: (n) => `총 신발 갯수 ${n}개`,
  /** 종류 수 — 이쪽이 130 기준이다 */
  dexProgress: (have, all) => `신발 종류 도감 ${have}/${all}개 완성`,

  // ── 뱃지 ───────────────────────────────────
  badgeDexTop: '도감',
  badgeDexBottom: '완성',
  badgeStairsUnit: '계단',
  badgeEmptyHint: '뱃지 진열대',
  /** @param {number} t 티어 @param {number} have 보유 @param {number} all 전체 */
  tierCount: (t, have, all) => `${t}티어 신발(${have}/${all}개)`,
  tierTab: (t) => `${t}티어`,
  notFoundYet: '???',

  // ── S07 명예의 전당 ────────────────────────
  hallTitle: '명예의 전당',
  tabShoeKing: '신발왕',
  tabWeekly: '주간',
  tabMonthly: '월간',
  tabYearly: '연간',
  tabAllTime: '역대',
  myRank: '내 순위',
  noRankYet: '아직 기록이 없습니다',
  /**
   * 순위표가 비어 보이는 이유는 셋인데 예전에는 전부 '아직 기록이 없습니다' 였다.
   * 그래서 로그인이 덜 됐는지·연결이 막혔는지·진짜 아무도 안 했는지 알 수가 없었다.
   */
  rankNeedLogin: '로그인이 풀렸습니다. 오락실 화면에서 다시 로그인해주세요',
  rankLoadFailed: '순위를 불러오지 못했습니다. 잠시 후 다시 시도해주세요',
  rankUnitStairs: '칸',
  rankUnitShoes: '켤레',

  // ── S08 조작법 ─────────────────────────────
  controlsTitle: '조작법 변경',
  controlMode1: '방향전환 - 상승',
  controlMode2: '상승 - 방향전환',
  controlMode3: '우상승 - 좌상승',

  // ── S08b 설정 (2026-08-19) ──────────────────
  settingsTitle: '설정',
  /** 설정 하위 메뉴명 — 사용자가 지정한 표기 (2026-08-19) */
  menuSound: '사운드 설정',
  soundBgm: '배경음악',
  soundSfx: '효과음',
  settingsOn: '켜짐',
  settingsOff: '꺼짐',
  /** 설정 하위 메뉴 (2026-08-19) */
  menuSingleBg: '싱글게임 배경설정',
  /**
   * ★ 두 줄이다 (2026-08-19 사용자 요청 — 원문의 '(엔터)'는 줄바꿈을 뜻한다).
   * 한 줄로 붙이면 좁은 폰에서 세 줄로 접혀 어디가 끊기는지 사용자가 정할 수 없다.
   * `.hint` 에 `white-space: pre-line` 을 줘서 이 `\n` 이 그대로 살아난다.
   */
  singleBgHint: '싱글게임에서 사용할 배경을 선택하세요\n멀티게임은 배경이 랜덤입니다',
  /** 고른 배경을 한 번 더 누르면 뜨는 큰 그림 — 도로+1층+2·3층을 이어 붙인 한 컷 */
  bgPreviewHint: '한 번 더 누르면 크게 볼 수 있습니다',
  bgPreviewClose: '닫기',
  bgRandom: '랜덤',
  soundHint: '끄면 이 기기에서만 적용됩니다',

  // ── S09 인게임 HUD ─────────────────────────
  /** @param {number} n */
  hudShoes: (n) => `찾은신발 ${n}`,
  /** @param {number} n */
  hudRevive: (n) => `부활 ${n}`,

  // ── S10 일시정지 ───────────────────────────
  // 캔버스에 그리는 문구도 전부 여기에 있어야 한다.
  // tools/build-font.mjs 가 **문자열 리터럴의 한글만** 골라 비트맵으로 굽기 때문에,
  // 다른 파일에 한글을 직접 쓰면 그 글자는 화면에서 조용히 안 그려진다.
  paused: '일시정지',
  resume: '재개',
  restart: '다시하기',
  toLobby: '로비로나가기',

  // ── S11 게임 오버 ──────────────────────────
  gameOver: '게임오버',
  score: '계단수',
  best: '최고계단',
  /** @param {number} n 이번 판에 주운 켤레 수 */
  shoesFound: (n) => `신발획득 ${n}`,

  // ── S12 부활 ───────────────────────────────
  reviveTitle: '부활하시겠습니까?',
  reviveYes: '부활하기',
  reviveNo: '포기',

  // ── S13~S18 멀티 ───────────────────────────
  multiTitle: '멀티게임 로비',
  createRoom: '방 만들기',
  joinRoom: '방 입장',
  createPrivateRoom: '비밀방 생성',
  enterByCode: '비밀방 입장',
  enterCode: '4자리 코드를 입력하세요',
  multiBetHint: '멀티 게임을 위해서는, 신발 1켤레가 필요합니다',
  publicRoomHint: '자동으로 만들어진 방입니다. 다른 사람이 곧 들어옵니다',
  host: '방장',
  roomSlots: (n, max) => `참가자 ${n}/${max}명`,
  /** 대기방 참가자 카드 — 이름 옆 보유량, 클릭하면 승률까지 (2026-08-19, §11) */
  playerShoesOwned: (n) => `보유신발 ${n}켤레`,
  /**
   * 방 목록용 짧은 표기 (2026-08-19). 한 줄에 상태·방번호·이름·인원·입장 버튼이
   * 다 들어가야 해서 "보유"를 뺐다 — 신발 아이콘이 이미 붙어 있어 뜻은 안 흐려진다.
   */
  roomShoes: (n) => `신발 ${n}켤레`,
  playerStatPopup: (wins, games, shoes) =>
    `승률 ${wins}승 / ${games}게임\n보유신발 ${shoes}켤레`,
  needMorePlayers: '2명 이상이어야 시작할 수 있습니다',
  notEveryoneReady: '아직 레디하지 않은 사람이 있습니다',
  waitingHostSelf: '모두 레디하면 시작할 수 있습니다',
  /**
   * 30초 넘게 자리를 비워 판에서 빠졌을 때 (2026-08-19 10차).
   * 이유를 말하지 않으면 사용자는 "갑자기 튕겼다"로 받아들인다 — 같은 현상이라도
   * 설명이 있으면 규칙이고 없으면 버그다.
   */
  kickedAbsent: (sec) => `${sec}초 넘게 자리를 비워 게임에서 나왔습니다`,
  roomClosed: '방이 사라졌습니다',
  roomAlreadyStarted: '이미 시작한 방입니다',
  multiResultTitle: '게임 결과',
  multiRowStat: (shoes, stairs) => `신발${shoes} · ${stairs}계단`,
  multiOpponentStat: (shoes, stairs) => `${shoes}/${stairs}`,
  playAgain: '한 판 더',
  /** 결과 화면에서 로비로 나가는 유일한 길 — 인게임 '나가기'는 이 화면까지만 온다 */
  leaveToLobby: '대기하지 않고 나가기',
  rewardPending: (n) => `${n}명의 신발은 잠시 후 들어옵니다`,
  settleLater: '정산은 다음 접속 때 반영됩니다',
  roomCode: '방 코드',
  multiRoomTitle: (n) => `멀티게임 ${n}번 방`,
  ready: '레디',
  cancelReady: '레디 취소',
  startGame: '시작하기',
  waitingHost: '방장이 시작하기를 기다리는 중',
  waitingPlayers: '다른 플레이어를 기다리는 중',
  hostOnlyDifficulty: '방장만 난이도를 설정할 수 있습니다',
  roomNotFound: '방을 찾을 수 없습니다',

  // ── 방 목록 (2026-08-16) ───────────────────
  roomListTitle: '방 목록',
  roomListEmpty: '지금 열려 있는 방이 없습니다',
  roomListEmptyHint: '방을 새로 만들면 다른 사람이 들어옵니다',
  roomListRefresh: '새로 고치기',
  roomListLoading: '방을 찾는 중...',
  roomStateWaiting: '대기중',
  roomStatePlaying: '게임중',
  /** 방 번호를 넣는다 (2026-08-19) — 목록만 보고는 어느 방인지 알 수 없었다 */
  roomRow: (code, name, n, max) => `${code}번 · ${name || '???'} · ${n}/${max}`,
  roomEnter: '입장',
  roomFullShort: '만원',
  roomJoinedAsWaiter: '게임이 끝나면 다음 판부터 함께합니다',
  waitingForNextRound: '다음 판을 기다리는 중',
  nextRound: '다음 판 준비',
  stayInRoom: '계속하기',

  // ── 역전 배틀 (2026-08-18) ─────────────────────
  /** 인게임 하단 고정 — 지금까지 이 판에 걸린 신발 총량 */
  /** 인게임 하단 — 이 판에 걸린 신발 */
  potLine: (n) => `1등하면 신발 ${n}켤레!`,
  /** 사망 화면 — 이겼을 때 가져갈 양을 크게 */
  /** 사망 화면 상금 — 인게임 하단과 **같은 문구**로 통일한다 (2026-08-19) */
  potWin: (n) => `1등하면 신발 ${n}켤레!`,
  /** 레이스 게이지 등수 — 1등만 크게·희게, 나머지는 노랗게 */
  rankTag: (n) => `${n}등`,
  /** 계단 숫자 아래 — 따라잡아야 할 거리 */
  gapFromFirst: (n) => `1등까지 ${n}계단 남음`,
  keepingFirst: '현재 1등 유지중!',
  /** 사망 후 부활 선택 화면 */
  fellTitle: '계단에서 떨어졌습니다',
  /** 부활 버튼은 두 줄이다 — 7px 폰트로도 한 줄이면 170px 라 패널(148)을 넘는다 */
  /** 사망 화면 부활 버튼 — 한 줄, 큰 글씨 (2026-08-19 사용자 요청) */
  reviveWith: (n) => `신발 ${n}개로 부활`,
  reviveShort: (n) => `부활 (신발 ${n})`,
  reviveNeed: (need, have) => `신발 ${need}켤레가 필요합니다 (지금 ${have}켤레)`,
  reviveMaxed: '부활을 모두 썼습니다',
  /** 부활 화면에서 내 지갑 — 숫자만 있으면 무슨 숫자인지 모른다 */
  myShoes: (n) => `나의 남은 신발 ${n}켤레`,
  quitRound: '나가기',
  /** 다른 사람에게 뜨는 알림 (작은 글씨, 몇 초) */
  /**
   * ── 인게임 알림 ──
   *
   * ★ **이름 대신 자리 색으로 부른다.** (2026-08-19)
   * 인게임에는 아이디를 아예 안 쓰고(레이스 게이지의 얼굴 테두리 색이 전부다),
   * 16px 폰트로는 긴 문장이 한 줄에 안 들어간다. 색 이름 세 글자면 충분하다 —
   * 게이지에서 그 색 테두리를 찾으면 그게 그 사람이다.
   */
  slotColorName: ['빨강색', '노란색', '파랑색', '초록색'],
  /** 부활 알림 전용 — "노랑, 1등 부활" 처럼 짧게(2026-08-19) */
  someoneFell: (color) => `${color}이 떨어졌다!`,
  /** 부활 알림 — 자리 색 + 간결하게. 인게임엔 아이디가 없어 색이 곧 신원이다 */
  someoneRevived: (colorName) => `${colorName} 1등 부활!`,
  someoneOut: (color) => `${color}이 포기했다!`,
  /** 결과 화면 */
  waitingOthers: '다른 사람들이 아직 오르고 있습니다',
  lostShoes: (n) => `이번 게임에서 신발 ${n}켤레를 잃었습니다`,
  /** ── 결과 화면 (2026-08-19 개편) ── */
  winBig: '승리하셨습니다 !',
  winSub: '1등을 축하합니다',
  wonPotPre: '걸린',
  wonPotShoes: (n) => `신발 ${n}개`,
  wonPotPost: '를 모두 가져왔습니다',
  loseBig: '게임에서 패배하였습니다',
  /** 승리창의 '1등을 축하합니다' 와 짝을 이루는 줄 — 좌우 대칭을 맞춘다 (2026-08-19) */
  loseSub: '다음 판에 다시 도전해보세요',
  /** 기획서 §5-7 문구 그대로 */
  loseTaken: (n) => `내 소중한 신발 ${n}켤레를 뺏겼습니다`,
  tipTitle: '부활을 아껴쓰세요.',
  tipBody1: '상대방이 부활을 다 쓰고 나면',
  tipBody2: '아껴둔 부활을 써서 역전하세요!',
  wonPot: (n) => `걸린 신발 ${n}켤레를 모두 가져왔습니다`,
  /** 패자가 낸 신발을 승자가 아직 못 걷었다 — 지금 방을 되돌리면 그 신발이 증발한다 */
  resetPending: '신발 정산 중입니다 — 잠시만요',
  /** 멀티 일시정지: 나가면 곧 패배다. 한 번 더 눌러야 나간다 */
  forfeit: '기권하고 나가기',
  forfeitConfirm: '정말 기권할까요? (한 번 더)',
  roomFull: '방이 가득 찼습니다',
  go: 'GO!',

  notEnoughShoesToPlay: '신발이 1켤레 이하면 게임에 참가할 수 없습니다',
  notEnoughShoesGuide: '신발을 모아서 게임에 참여하세요',

  won: '1등을 하셨습니다',
  /** @param {number} n 뺏어온 켤레 수 */
  wonReward: (n) => `게임의 승리로 ${n}켤레의 신발을 뺏어왔습니다`,
  lost: '내 소중한 신발 1켤레를 뺏겼습니다',

  // ── 출발 제한 (2026-08-19 11차) ─────────────
  /**
   * 판이 시작됐는데 가만히 서 있는 사람에게. **두 줄로 나눠 둔다** — 한 줄로 붙이면
   * 11px 로 180px 를 넘어 화면 밖으로 나간다(실측). 사용자가 준 문구 그대로다:
   * *"5초 안에 출발하세요(엔터) 출발하지 않으면 패배합니다"*
   */
  startWithin: (sec) => `${sec}초 안에 출발하세요`,
  startOrLose: '출발하지 않으면 패배합니다',

  // ── 유저상태창 · 메세지 · 대결신청 (2026-08-19 11차) ──
  /** 명예의 전당 신발왕 탭에만 붙는 칸 — 신발 많은 사람이 몇 승 했나 */
  rankWinRate: (wins, games) => `멀티승률 ${wins}승/${games}게임`,
  userCardTitle: '유저상태창',
  /** 유저상태창 하단 — 지금 무엇을 하고 있는가 */
  statusPlaying: '현재상태:게임중',
  statusIdle: '현재상태:대기중',
  statusOffline: '현재상태:미접속',
  sendMessage: '메세지 보내기',
  challengeUser: '대결신청',
  messageHint: '보낼 메세지를 입력하세요',
  send: '보내기',
  messageSent: '메세지를 보냈습니다',
  messageEmpty: '메세지를 입력해주세요',
  /**
   * 대결 신청은 **접속 중이고 대기중일 때만** 된다. 게임 중인 사람에게 신청하면
   * 그 사람 화면에는 판이 도는 중이라 팝업을 띄울 자리가 없고, 미접속이면 아예 못 받는다.
   * 메세지는 둘 다에게 보낼 수 있다 — 받는 사람이 나올 때 팝업으로 뜬다.
   */
  cantChallengeNow: '게임중 상태에선 메세지를 보낼 수 없습니다',
  challengeSent: '대결 신청을 보냈습니다',
  challengeWaiting: '상대의 응답을 기다리는 중입니다',
  challengeAsk: '대결 신청이 들어왔습니다. 참여하시겠습니까?',
  challengeAccept: (sec) => `수락(${sec})`,
  challengeDecline: '거절',
  challengeRefused: (name) => `${name}님이 대결 신청을 거절했습니다`,
  challengeGone: '대결 신청이 취소되었습니다',
  messageFrom: (name) => `${name}님의 메세지`,

  // ── 현재접속자 (2026-08-19 11차) ────────────
  onlineUsers: '현재접속자',
  /** 목록을 다시 받는다 (2026-08-19 13차, 사용자 요청) */
  refreshList: '새로고침',
  /** 목록 줄에는 짧게 — '현재상태:' 를 열 줄마다 되풀이할 이유가 없다 */
  stateShortPlaying: '게임중',
  stateShortIdle: '대기중',
  onlineCount: (n) => `현재 ${n}명 접속중`,
  noOneOnline: '접속 중인 사람이 없습니다',
  meTag: '나',

  // ── 받은 메세지함 · 수신 설정 · 차단 (2026-08-19 12차) ──
  menuInbox: '받은 메세지함',
  inboxTitle: '받은 메세지함',
  inboxEmpty: '주고받은 메세지가 없습니다',
  /** 목록 줄 앞머리 — 내가 보낸 것인지 받은 것인지 */
  inboxSent: '보냄',
  inboxRecv: '받음',
  /** 목록 줄에 붙는 시각. 오늘 것은 시:분만, 지난 것은 날짜까지 */
  msgTimeToday: (hh, mm) => `${hh}:${mm}`,
  msgTimeFull: (mo, dd, hh, mm) => `${mo}.${dd} ${hh}:${mm}`,
  /** 팝업 버튼 (사용자 지정 문구) */
  replyMessage: '답장하기',
  blockUser: '차단',
  unblockUser: '차단 해제',
  blockedDone: '차단했습니다',
  unblockedDone: '차단을 해제했습니다',
  blockConfirm: (name) => `${name}님을 차단할까요?`,
  blockConfirmDetail: '차단하면 이 사람이 보내는 메세지가 오지 않습니다',
  blockedTag: '차단됨',

  menuMsgAccept: '메세지 수신 설정',
  msgAcceptTitle: '메세지 수신 설정',
  msgAcceptOn: '켜짐',
  msgAcceptOff: '꺼짐',
  msgAcceptHintOn: '메세지와 대결 신청을 받습니다',
  msgAcceptHintOff: '아무도 나에게 메세지와 대결 신청을 보낼 수 없습니다',
  /** 보내는 쪽에 뜨는 이유 — 둘을 구분해야 사용자가 상황을 안다 */
  peerRecvOff: '상대방에 메세지 수신 거부중',
  peerBlocked: '상대방이 차단 설정을 했습니다',

  /** 유저상태창 맨 아래 (2026-08-19 12차) */
  lastLogin: (when) => `마지막로그인: ${when}`,
  lastLoginNow: '현재로그인중',
  lastLoginNone: '기록 없음',

  // ── 공통 ───────────────────────────────────
  loading: '불러오는 중...',
  comingSoon: '준비 중입니다',
  back: '뒤로',
  close: '닫기',
  cancel: '취소',
  yes: '예',
  no: '아니오',
  networkError: '네트워크 연결을 확인해주세요',
  saveFailed: '저장에 실패했습니다. 다시 접속하면 자동으로 반영됩니다',
};

export default S;
