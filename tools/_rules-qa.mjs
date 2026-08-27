/**
 * RTDB 규칙 ↔ 클라이언트 일치 검사 (진단 전용) — `node tools/_rules-qa.mjs`
 *
 * ## 왜 필요한가
 *
 * 새 규칙은 `"$other": { ".validate": false }` 로 **규칙에 없는 키를 통째로 거부**한다.
 * 오타나 미래의 실수를 막으려고 넣은 건데, 반대로 **클라이언트가 새 필드를 하나 추가하고
 * 규칙에 안 적으면 그 쓰기가 통째로 실패한다.** 그것도 조용히 — RTDB 는 거부를
 * `.catch(() => {})` 로 삼키는 코드 경로가 많아서, 증상은 "방에 못 들어간다" 로만 나타난다.
 *
 * 실제로 이 규칙을 쓰면서 `reachedAt`(reportDeath 가 쓴다)을 빠뜨릴 뻔했다.
 * 그래서 **코드가 실제로 쓰는 필드 이름**을 긁어서 규칙과 대조한다.
 */

import { readFileSync } from 'node:fs';

const rulesDoc = readFileSync('docs/FIREBASE_RULES.md', 'utf8');
const src = readFileSync('src/services/multiplayer.js', 'utf8');

// ── 규칙에서 허용 키 뽑기 ─────────────────────
/**
 * * 줄바꿈을 가리지 않는다 (2026-08-27).
 *
 * 예전에는 정규식으로 잘라냈는데 LF 만 봤다. 이 문서가 CRLF 로
 * 저장된 순간 블록을 못 찾아 **검사가 통째로 안 돌았다.**
 * 그것도 "규칙이 틀렸다" 가 아니라 "널의 속성을 읽을 수 없다" 로
 * 터져서 원인이 안 보였다.
 *
 * 정규식 대신 문자열로 자른다 — 줄바꿈이 무엇이든 상관없고,
 * 못 찾으면 무엇을 못 찾았는지 말하고 멈춘다.
 */
const FENCE = '`' + '`' + '`';
const head = rulesDoc.indexOf(FENCE + 'json', rulesDoc.indexOf('## Realtime Database'));
/* 여는 울타리 줄의 끝(줄바꿈 문자 10) 다음이 본문이다 */
const NL = String.fromCharCode(10);
const bodyAt = head < 0 ? -1 : rulesDoc.indexOf(NL, head) + 1;
const tailAt = bodyAt <= 0 ? -1 : rulesDoc.indexOf(FENCE, bodyAt);
if (tailAt < 0) {
  console.error('FIREBASE_RULES.md 의 "## Realtime Database" 아래에서 json 블록을 못 찾았다');
  process.exit(1);
}
const json = rulesDoc.slice(bodyAt, tailAt);
const rules = JSON.parse(json).rules;

const room = rules.rooms.$code;
const roomKeys = new Set(Object.keys(room).filter((k) => !k.startsWith('.') && k !== '$other'));
const playerKeys = new Set(Object.keys(room.players.$uid).filter((k) => !k.startsWith('.') && k !== '$other'));
const resultKeys = new Set(Object.keys(room.result).filter((k) => !k.startsWith('.') && k !== '$other'));

let fails = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const bad = (m) => { fails++; console.log(`  X    ${m}`); };

console.log('1) 규칙이 미지의 키를 막고 있는가');
for (const [label, node] of [['방', room], ['참가자', room.players.$uid], ['결과', room.result]]) {
  if (node.$other && node.$other['.validate'] === false) ok(`${label} — $other 차단`);
  else bad(`${label} — $other 차단이 없다 (오타가 조용히 통과한다)`);
}

console.log('\n2) 클라이언트가 쓰는 필드가 전부 규칙에 있는가');

/**
 * `createRoom` 이 만드는 방 객체의 최상위 키.
 * **함수 본문 안에서만** 뽑는다 — 예전엔 파일 전체를 훑어서 화면용 객체(`listRooms`)의
 * 필드까지 "방 필드"로 오인했다.
 */
const createBody = /export async function createRoom[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
const created = [...createBody.matchAll(/^\s{8}(\w+):/gm)].map((m) => m[1]);
for (const k of new Set(created)) {
  if (roomKeys.has(k) || k === 'players') ok(`방.${k}`);
  else bad(`방.${k} — 규칙에 없다 (방 만들기가 통째로 거부된다)`);
}

/** `meRecord()` 가 만드는 참가자 필드 */
const rec = /function meRecord\(profile,[^)]*\) \{\s*return \{([\s\S]*?)\};/.exec(src)[1];
for (const k of [...rec.matchAll(/(\w+):/g)].map((m) => m[1])) {
  if (playerKeys.has(k)) ok(`참가자.${k}`);
  else bad(`참가자.${k} — 규칙에 없다 (입장이 거부된다)`);
}

/** `update(... 'players', uid), { ... })` 로 나중에 쓰는 필드 (진행도·사망 보고) */
for (const m of src.matchAll(/'players', fb\.uid\)\), \{([^}]*)\}/g)) {
  for (const k of [...m[1].matchAll(/(\w+):/g)].map((x) => x[1])) {
    if (playerKeys.has(k)) ok(`참가자.${k} (갱신)`);
    else bad(`참가자.${k} — 규칙에 없다 (진행도·사망 보고가 거부된다)`);
  }
}

/**
 * ★ **잎 하나만 따로 쓰는 경로도 본다.** (2026-08-19 8차)
 * `path(ROOMS, code, 'players', fb.uid, 'offAt')` 처럼 필드를 직접 가리키는 쓰기는
 * 위의 `update({...})` 패턴에 안 걸린다 — 자리 지킴(`offAt`)이 그렇게 들어왔다.
 * 이런 건 `onDisconnect` 로 걸리는 경우가 많아 **실패해도 로그조차 안 남는다.**
 */
for (const m of src.matchAll(/'players', fb\.uid, '(\w+)'\)/g)) {
  const k = m[1];
  if (playerKeys.has(k)) ok(`참가자.${k} (잎 직접 쓰기)`);
  else bad(`참가자.${k} — 규칙에 없다 (자리 지킴 쓰기가 조용히 거부된다)`);
}

/** 방 노드에 직접 `update` 하는 필드 */
for (const m of src.matchAll(/path\(ROOMS, code\)\), \{([^}]*)\}/g)) {
  for (const k of [...m[1].matchAll(/(\w+):/g)].map((x) => x[1])) {
    if (roomKeys.has(k)) ok(`방.${k} (갱신)`);
    else bad(`방.${k} — 규칙에 없다`);
  }
}

/** 결과 하위 경로 */
for (const m of src.matchAll(/'result', '(\w+)'/g)) {
  const k = m[1];
  if (resultKeys.has(k)) ok(`결과.${k}`);
  else bad(`결과.${k} — 규칙에 없다`);
}
for (const k of ['rankings', 'endedAt']) {
  if (!src.includes(k)) continue;
  if (resultKeys.has(k)) ok(`결과.${k}`);
  else bad(`결과.${k} — 규칙에 없다 (순위 확정이 거부된다)`);
}

console.log('\n3) 잎마다 "내 것이거나 값이 그대로" 검증이 걸려 있는가');
const own = "$uid == auth.uid || newData.val() == data.val()";
for (const k of playerKeys) {
  const v = room.players.$uid[k]['.validate'] ?? '';
  if (v.includes(own)) ok(`참가자.${k}`);
  else bad(`참가자.${k} — 남이 고칠 수 있다`);
}
const givenLeaf = room.result.given.$uid.$i['.validate'] ?? '';
if (givenLeaf.includes(own)) ok('결과.given 값');
else bad('결과.given 값 — 남이 신발 목록을 대신 쓸 수 있다');
const settled = room.result.settled.$uid['.validate'] ?? '';
if (settled.includes(own)) ok('결과.settled 도장 (옛 비트마스크)');
else bad('결과.settled 도장 — 남이 도장을 지울 수 있다');
/**
 * 도장이 하나 더 생겼다 — **낸 사람별 '걷은 켤레 수'** (2026-08-19).
 * 한 사람이 두 번에 나눠 내면(부활 20 + 기본 1) 비트 하나로는 뒷돈을 놓친다.
 * 옛 비트를 **함께** 쓰는 이유는 배포 직후의 옛 클라이언트다 — 맵을 숫자로 읽으면
 * `NaN` 이 되어 이미 걷은 신발을 다시 걷는다(복제). 잃는 것보다 불어나는 게 더 나쁘다.
 */
const claims = room.result.claims?.$uid?.$from?.['.validate'] ?? '';
if (claims.includes(own) && claims.includes('isNumber')) ok('결과.claims 켤레 수 도장');
else bad('결과.claims — 나눠 낸 신발의 뒷부분이 영영 안 걷힌다');

console.log('\n4) 트랜잭션이 통째로 거부되지 않는가 (hostUid 함정)');
const host = room.hostUid['.validate'] ?? '';
if (host.includes('newData.val() == data.val()')) ok('hostUid — 값이 그대로면 통과 (입장·이탈·결과확정이 산다)');
else bad('hostUid — 값이 그대로여도 거부된다. 방장이 아니면 입장 자체가 막힌다');

console.log('\n5) 다음 판 준비(resetRoom)가 규칙에 막히지 않는가 (2026-08-18)');
/**
 * `resetRoom` 은 **남의 칸까지** 초기값으로 되돌린다. 규칙이 "내 것이거나 값이 그대로"
 * 뿐이면, 상대가 한 계단이라도 올랐을 때 리셋이 통째로 거부된다 → 같은 방에서
 * 두 번째 판을 영영 못 한다. (§9-0-19)
 */
const RESET_OK = {
  /**
   * ★ **`ready` 는 더 이상 초기값(false) 한 가지만 허용하지 않는다.** (2026-08-19)
   * '계속하기'를 누른 기존 참가자는 다음 판에 **레디가 자동으로 켜져야** 한다
   * (`multiplayer.js resetRoom`). 값 제약 없이 "waiting 전환 때만" 허용해서
   * true·false 둘 다 통과시킨다 — 어차피 `newData.isBoolean()` 이 위에서 막아 준다.
   */
  ready: null,
  stairs: 'newData.val() == 0',
  shoesFound: 'newData.val() == 0',
  alive: 'newData.val() == true',
};
for (const [k, init] of Object.entries(RESET_OK)) {
  const v = room.players.$uid[k]?.['.validate'] ?? '';
  const waiting = v.includes("child('state').val() == 'waiting'");
  const initOk = init == null || v.includes(init);
  if (initOk && waiting) ok(`참가자.${k} — 방이 waiting 으로 갈 때 초기값으로 되돌릴 수 있다`);
  else bad(`참가자.${k} — 남의 값을 초기화 못 한다. '방에 남기'가 401 로 죽는다`);
}
// ready 는 초기값 제약이 없어야(=값을 안 가려야) '자동 레디'가 통과한다 — 그 반대를 잡는다
{
  const v = room.players.$uid.ready?.['.validate'] ?? '';
  if (!v.includes('newData.val() == false')) ok('참가자.ready — 초기화 시 true 로도 되돌릴 수 있다 (자동 레디)');
  else bad('참가자.ready — false 로만 고정돼 있다. 자동 레디가 401 로 막힌다');
}

console.log('\n6) 참가자 노드가 객체인지 검사하는가 (가짜 인원 방지)');
const uidNode = room.players.$uid['.validate'] ?? '';
if (uidNode.includes('hasChildren') && uidNode.includes('nickname')) {
  ok('참가자 노드 — 원시값(players/남의uid: true)으로 인원을 부풀릴 수 없다');
} else {
  bad('참가자 노드 — 원시값을 쓰면 필드 검증이 전부 건너뛰어진다 (가짜 만원 방 가능)');
}

console.log('\n7) 방 밖에서도 정산을 마칠 수 있는가 (2026-08-18)');
/**
 * 판이 끝나면 모두 방에서 나간다(시체 방이 매칭을 굶기지 않게). 그런데 정산은 그 뒤에
 * 끝나는 일이 많다 — 패자가 늦게 내고, 승자가 다음 접속에 걷는다. 방 멤버만 쓸 수 있으면
 * **나간 순간 신발이 공중에 뜬다.** 그래서 이 두 경로만 따로 열어 둔다.
 */
const settledWrite = room.result.settled.$uid['.write'] ?? '';
const givenWrite = room.result.given.$uid['.write'] ?? '';
for (const [label, rule] of [['정산 도장', settledWrite], ['패자 납부', givenWrite]]) {
  if (rule.includes('auth.uid == $uid') && rule.includes("child('rankings').exists()")) {
    ok(`${label} — 본인만, 순위가 확정된 방에만`);
  } else {
    bad(`${label} — 방을 나가면 정산을 못 끝낸다 (또는 유령 방을 만들 수 있다)`);
  }
}

console.log('\n8) 끝나지 않은 판의 판돈을 되찾을 수 있는가 (2026-08-19)');
/**
 * 상대가 튕겨 순위가 영영 안 박히면 부활 비용은 아무에게도 안 간다. 그 신발을
 * 주인이 되가져오려면 **순위가 없는 방에서 자기 `given` 을 지울 수** 있어야 한다.
 * 지우기만 열고 쓰기는 안 연다 — 순위 없이 판돈을 새로 걸 수 있으면 정산이 꼬인다.
 */
if (givenWrite.includes('!newData.exists()') && givenWrite.includes('auth.uid == $uid')) {
  ok('판돈 회수 — 본인 것만, 지우는 것만');
} else {
  bad('판돈 회수 — 순위가 안 박힌 판의 판돈이 영원히 묶인다');
}

const roomWrite = room['.write'] ?? '';
if (!roomWrite.includes('!data.exists() ||')) ok('빈 코드에 아무 값이나 못 쓴다 (유령 방 방지)');
else bad('없는 방에 아무 필드나 쓸 수 있다 — 유령 방이 만들어진다');

console.log('\n9) 접속 표시 · 쪽지함 (2026-08-19 11차)');
{
  /**
   * `presence` · `inbox` 는 `rooms` 와 **같은 함정**을 공유한다 — `$other: false` 라
   * 클라이언트가 필드를 하나 늘리고 규칙에 안 적으면 그 쓰기가 통째로 거부된다.
   * 그런데 쪽지 보내기는 실패해도 화면에 아무 표시가 없다(토스트만 다르게 뜬다).
   * 그래서 여기서 **코드가 실제로 쓰는 필드**를 긁어 대조한다.
   */
  const pres = readFileSync('src/services/presence.js', 'utf8');
  const P = rules.presence?.$uid;
  const I = rules.inbox?.$uid?.$id;
  if (!P) bad('presence 규칙이 없다 — 현재접속자 목록이 통째로 빈다');
  if (!I) bad('inbox 규칙이 없다 — 쪽지·대결신청이 전부 거부된다');

  if (P && I) {
    const pKeys = new Set(Object.keys(P).filter((k) => !k.startsWith('.') && k !== '$other'));
    const card = /function myCard\(\) \{[\s\S]*?return \{([\s\S]*?)\};/.exec(pres)[1];
    for (const k of [...card.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1])) {
      if (pKeys.has(k)) ok(`접속카드.${k}`);
      else bad(`접속카드.${k} — 규칙에 없다 (접속 표시가 통째로 거부된다)`);
    }
    const iKeys = new Set(Object.keys(I).filter((k) => !k.startsWith('.') && k !== '$other'));
    for (const k of ['from', 'fromName', 'kind', 'at', 'text', 'code']) {
      if (iKeys.has(k)) ok(`쪽지.${k}`);
      else bad(`쪽지.${k} — 규칙에 없다 (그 쪽지는 영영 안 간다)`);
    }

    // 접속 표시는 **본인만** 쓴다 — 남의 상태를 '대기중'으로 바꿔 대결을 걸 수 있으면 안 된다
    if ((P['.write'] ?? '').includes('auth.uid == $uid')) ok('접속 표시 — 본인만 쓴다');
    else bad('접속 표시 — 남의 상태를 조작할 수 있다');
    if ((rules.presence['.read'] ?? '').includes('auth != null')) ok('접속 목록 — 로그인하면 읽는다');
    else bad('접속 목록을 아무도 못 읽는다');

    const w = I['.write'] ?? '';
    // 보내기: 새 쪽지만 · 보낸이는 나
    if (w.includes("!data.exists()") && w.includes("newData.child('from').val() == auth.uid")) {
      ok('쪽지 보내기 — 새 쪽지만, 보낸이 위조 불가');
    } else {
      bad('쪽지 — 남의 쪽지를 덮어쓰거나 보낸이를 위조할 수 있다');
    }
    /**
     * 쪽지함이 **이력**이 되면서(2026-08-19 12차) 주인은 자기 함을 고칠 수 있어야 한다 —
     * 읽음 표시·오래된 것 정리·보낸 사본 기록이 전부 여기로 들어온다.
     */
    if (w.includes('auth.uid == $uid')) ok('내 쪽지함은 내가 고친다 (읽음 표시·정리·보낸 사본)');
    else bad('읽음 표시를 못 한다 — 읽은 쪽지가 로비마다 다시 뜬다');
    // 받은 쪽지에 읽음 표시를 달 때 from 은 남의 uid 다 — 그대로면 통과해야 한다
    if ((I.from?.['.validate'] ?? '').includes('newData.val() == data.val()')) {
      ok('읽음 표시가 from 검증에 안 막힌다');
    } else {
      bad('읽음 표시가 from 검증에 막힌다 (받은 쪽지가 영원히 안 읽힘)');
    }
    for (const k of ['to', 'toName', 'out', 'read']) {
      if (iKeys.has(k)) ok(`쪽지.${k}`);
      else bad(`쪽지.${k} — 규칙에 없다 (이력·읽음 표시가 통째로 거부된다)`);
    }

    // 수신 거부 · 차단은 **규칙이** 막아야 한다 — 화면에서만 막으면 조작으로 뚫린다
    const P2 = rules.prefs?.$uid;
    if (!P2) bad('prefs 규칙이 없다 — 수신 거부·차단이 서버에서 안 막힌다');
    else {
      if (w.includes("child('accept').val() != false")) ok('수신 거부를 규칙이 막는다');
      else bad('수신을 꺼도 쪽지가 들어온다');
      // `== true` 로 쓰면 값이 없는 **신규 사용자 전원**이 쪽지를 못 받는다
      if (!w.includes("child('accept').val() == true")) ok('기본값(없음)은 수신 허용');
      else bad('accept 를 == true 로 봤다 — 설정을 안 만진 사람이 전부 막힌다');
      if (w.includes("child('blocked').child(auth.uid).exists()")) ok('차단을 규칙이 막는다');
      else bad('차단해도 그 사람 쪽지가 들어온다');
      if ((P2.accept?.['.read'] ?? '').includes('auth != null')) ok('수신 여부는 보내는 사람이 읽는다');
      else bad('수신 거부 이유를 보내는 사람에게 말해 줄 수 없다');
      // 차단 목록이 공개되면 그 자체가 사고다
      if ((P2.blocked?.['.read'] ?? '').includes('auth.uid == $uid')) ok('차단 목록은 본인만 읽는다');
      else bad('차단 목록이 공개돼 있다');
      if ((P2['.write'] ?? '').includes('auth.uid == $uid')) ok('수신 설정 — 본인만 쓴다');
      else bad('남의 수신 설정을 바꿀 수 있다');
    }
    if ((rules.inbox.$uid['.read'] ?? '').includes('auth.uid == $uid')) ok('쪽지함 — 본인만 읽는다');
    else bad('남의 쪽지함을 읽을 수 있다');

    /**
     * ★ 접속 판정의 근거가 되는 `lastActive` 는 **서버가 찍은 값만** 통과해야 한다.
     *   (2026-08-19 19차) 클라이언트가 미래 시각을 넣을 수 있으면 영원히 접속 중으로
     *   남을 수 있고, 그게 곧 사용자가 신고한 "아무도 없는데 5명 접속 중"이다.
     */
    const la = rules.presence?.$uid?.lastActive?.['.validate'] ?? '';
    if (la.includes('now')) ok('접속 활동 시각은 서버 시각만 허용');
    else bad('lastActive 규칙이 없거나 서버 시각을 강제하지 않는다');
    // 규칙에 없는 필드는 `$other: false` 때문에 통째로 거부된다 — 쓰면서 조용히 실패한다
    const presSrc = readFileSync('src/services/presence.js', 'utf8');
    if (presSrc.includes('lastActive')) ok('클라이언트도 lastActive 를 쓴다');
    else bad('presence.js 가 lastActive 를 안 쓴다');

    /**
     * 글자 수 상한은 **클라이언트의 maxlength 와 같은 숫자**여야 한다. 다르면
     * 규칙에서 잘려 쓰기가 거부되는데, 화면에는 "보내기를 눌렀는데 아무 일도 안 났다"로 보인다.
     */
    // 19차: 입력칸이 `replyInput` 하나로 합쳐졌다 — maxlength 도 이제 여기 한 곳뿐이다
    const uc = readFileSync('src/screens/replyInput.js', 'utf8');
    const max = /maxlength: '(\d+)'/.exec(uc)?.[1];
    const rule = /<= (\d+)/.exec(I.text['.validate'])?.[1];
    if (max && rule && max === rule) ok(`쪽지 길이 상한이 화면과 규칙에서 같다 (${max}자)`);
    else bad(`쪽지 길이 상한이 어긋난다 — 화면 ${max} · 규칙 ${rule}`);
  }
}

console.log('');
if (fails) { console.error(`규칙 검사 실패 — ${fails}건`); process.exit(1); }
console.log('규칙과 클라이언트가 일치한다');
