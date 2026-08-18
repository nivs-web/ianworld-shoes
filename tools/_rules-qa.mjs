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
const rec = /function meRecord\(profile\) \{\s*return \{([\s\S]*?)\};/.exec(src)[1];
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
if (settled.includes(own)) ok('결과.settled 도장');
else bad('결과.settled 도장 — 남이 도장을 지울 수 있다');

console.log('\n4) 트랜잭션이 통째로 거부되지 않는가 (hostUid 함정)');
const host = room.hostUid['.validate'] ?? '';
if (host.includes('newData.val() == data.val()')) ok('hostUid — 값이 그대로면 통과 (입장·이탈·결과확정이 산다)');
else bad('hostUid — 값이 그대로여도 거부된다. 방장이 아니면 입장 자체가 막힌다');

console.log('');
if (fails) { console.error(`규칙 검사 실패 — ${fails}건`); process.exit(1); }
console.log('규칙과 클라이언트가 일치한다');
