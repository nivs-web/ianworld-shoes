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
const i = rulesDoc.indexOf('## Realtime Database');
const json = /```json\n([\s\S]*?)\n```/.exec(rulesDoc.slice(i))[1];
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
  ready: 'newData.val() == false',
  stairs: 'newData.val() == 0',
  shoesFound: 'newData.val() == 0',
  alive: 'newData.val() == true',
};
for (const [k, init] of Object.entries(RESET_OK)) {
  const v = room.players.$uid[k]?.['.validate'] ?? '';
  const waiting = v.includes("child('state').val() == 'waiting'");
  if (v.includes(init) && waiting) ok(`참가자.${k} — 방이 waiting 으로 갈 때 초기값으로 되돌릴 수 있다`);
  else bad(`참가자.${k} — 남의 값을 초기화 못 한다. '방에 남기'가 401 로 죽는다`);
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

console.log('');
if (fails) { console.error(`규칙 검사 실패 — ${fails}건`); process.exit(1); }
console.log('규칙과 클라이언트가 일치한다');
