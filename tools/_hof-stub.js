/**
 * `leaderboard.js` 대역 (진단 전용).
 *
 * 명예의 전당의 **세로 배치**를 재려면 줄이 실제로 여러 개 있어야 하는데, 로그인 없는
 * 검사 환경에서는 목록이 늘 비어 있다. 그래서 데이터 계층만 갈아 끼우고
 * **화면 코드(`HallOfFame.js`)는 진짜를 그대로 쓴다** — 마크업을 손으로 베낀 미리보기는
 * 언젠가 거짓말을 한다(§9-0-33·§9-0-44).
 */
const CHARS = ['ian', 'denny', 'rose', 'tony'];
/**
 * ★ 30차: 줄마다 **착용한 아이템**이 다르다. 아무것도 안 낀 줄만 재면 착용 모습이
 * 통째로 안 그려져도 검사가 통과한다 — 가장 큰 조합(가면+날개+큰 호랑이)을 섞는다.
 */
const WORN = [
  [],
  ['hat_crown', 'wing_angel', 'pet_dog'],
  ['hat_batman', 'wing_devil', 'pet_tiger_big'],
  ['hat_ironman', 'wing_bat', 'pet_squirrel'],
];
const N = Number(new URLSearchParams(location.search).get('rows') ?? 40);
const MY = Number(new URLSearchParams(location.search).get('mine') ?? 11);

export async function fetchBoard() {
  const rows = Array.from({ length: N }, (_, i) => ({
    uid: i + 1 === MY ? 'me' : `u${i}`,
    rank: i + 1,
    nickname: ['이안', '다섯글자님', '로', '아빠게임왕'][i % 4],
    characterId: CHARS[i % 4],
    items: WORN[i % 4],
    value: 12480 - i * 97,
    multiWins: (i * 7) % 130,
    multiLosses: (i * 3) % 90,
  }));
  return { rows, me: { ...rows[MY - 1], rank: MY }, error: null };
}

export async function fetchUserCard() { return null; }
