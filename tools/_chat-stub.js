/**
 * `services/multiplayer.js` 대역 — 방 채팅 미리보기·검사용. (2026-08-21 26차)
 *
 * 진짜 `roomChat.js` 를 **한 줄도 안 바꾸고** 띄우기 위한 것이다. 마크업을 손으로
 * 베낀 미리보기는 언젠가 거짓말을 한다(§9-0-33·§9-0-44 에서 두 번 데였다).
 *
 * `?rows=N` 으로 줄 수를, `?fail=1` 로 전송 실패를, `?off=1` 로 미접속을 만든다.
 */

const q = new URLSearchParams(location.search);
const N = Number(q.get('rows') ?? 12);
const FAIL = q.get('fail') === '1';
const OFF = q.get('off') === '1';

export const CHAT_MAX = 60;
export const CHAT_KEEP = 60;

const NOW = 1755600000000;
const WHO = [
  ['me', '이안'],
  ['u2', '다섯글자님'],
  ['u3', '로'],
  ['u4', '아빠게임왕'],
];
const SAY = [
  '다들 준비됐어요?',
  '난이도 어려움으로 갈게요',
  '저 신발 3켤레밖에 없어요 ㅠㅠ',
  '부활 아껴 쓰세요 마지막에 남은 사람이 이겨요',
  '방금 그거 역전 미쳤다',
  'ㅋㅋㅋㅋ 한 판 더',
];

let rows = Array.from({ length: N }, (_, i) => {
  const [uid, name] = WHO[i % WHO.length];
  return { id: `c${i}`, uid, name, text: SAY[i % SAY.length], at: NOW - (N - i) * 30e3 };
});

let notify = () => {};

export function subscribeChat(code, cb) {
  notify = () => cb(rows.slice());
  // 못 붙은 경우는 `null` — 화면이 "대화가 없다"고 거짓말하면 안 된다 (§9-0-6)
  cb(OFF ? null : rows.slice());
  return () => {};
}

export async function sendChat(code, text) {
  if (FAIL) return 'error';
  const body = String(text ?? '').trim();
  if (!body) return 'empty';
  rows = [...rows, { id: `c${rows.length}`, uid: 'me', name: '이안', text: body, at: NOW }];
  notify();
  return 'ok';
}

export async function trimChat() {}
