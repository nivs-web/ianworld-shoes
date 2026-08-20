/**
 * `leaderboard.js` 대역 — 멀티게임순위 검사·미리보기용. (2026-08-19 23차)
 *
 * 화면(`MultiRank.js`)은 **진짜를 그대로 쓴다**. 마크업을 손으로 베낀 미리보기는
 * 언젠가 거짓말을 한다(§9-0-33·§9-0-44).
 */
const q = new URLSearchParams(location.search);
const N = Number(q.get('rows') ?? 12);
const MY = Number(q.get('mine') ?? 2);
const CHARS = ['ian', 'denny', 'rose', 'tony'];
const NAMES = ['이안', '다섯글자님', '로', '아빠게임왕'];

export async function fetchMultiBoard(tab) {
  const rows = Array.from({ length: N }, (_, i) => {
    const wins = 128 - i * 7;
    const losses = 40 + i * 3;
    const games = wins + losses;
    return {
      uid: i + 1 === MY ? 'me' : `u${i}`,
      rank: i + 1,
      nickname: NAMES[i % 4],
      characterId: CHARS[i % 4],
      multiWins: wins,
      multiLosses: losses,
      shoesOwned: 1200 - i * 13,
      games,
      value: tab === 'rate' ? Math.round((wins / games) * 10000) : wins,
    };
  });
  return { rows, me: { ...rows[MY - 1], rank: MY }, error: null, mePromise: null };
}

export async function fetchUserCard() { return null; }
