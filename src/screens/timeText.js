/**
 * 시각 한 줄 표기 — 쪽지함·팝업·유저상태창이 **같은 식**을 쓰게 떼어 뒀다.
 * (2026-08-19 12차, 사용자 요청: "메세지 받은 시간도 같이 표기")
 *
 * 화면끼리 서로 import 하면 순환 참조가 생긴다(쪽지함 ↔ 유저상태창). 문자열 포맷은
 * 화면이 아니라 도구이므로 여기 따로 둔다.
 *
 * **오늘 것은 시:분만** 찍는다. 목록의 대부분은 방금 온 것이라 날짜를 붙이면 같은
 * 글자가 줄마다 되풀이되고, 정작 다른 부분(시각)이 눈에 덜 들어온다.
 */

import S from '../config/strings.ko.js';

const p2 = (n) => String(n).padStart(2, '0');

export function stamp(at, now = Date.now()) {
  const d = new Date(at ?? 0);
  const today = new Date(now);
  const sameDay = d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  return sameDay
    ? S.msgTimeToday(p2(d.getHours()), p2(d.getMinutes()))
    : S.msgTimeFull(p2(d.getMonth() + 1), p2(d.getDate()), p2(d.getHours()), p2(d.getMinutes()));
}

/** 마지막 로그인처럼 **연도까지** 밝혀야 하는 자리 — `2026.01.01 19:34` */
export function stampFull(at) {
  const d = new Date(at ?? 0);
  return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
