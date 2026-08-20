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

/**
 * 24차: 승률왕은 **최근 일주일 안에 한 판**을 한 사람만 나온다. 대역이 그 시각을
 * 안 주면 목록이 통째로 비어서, 검사가 "화면이 고장났다"와 구별되지 않는다.
 * 마지막 한 명만 일부러 오래된 값으로 둬서 **걸러지는 것도** 확인한다.
 */
const DAY = 24 * 60 * 60 * 1000;

export async function fetchMultiBoard(tab) {
  const rows = Array.from({ length: N }, (_, i) => {
    const wins = 128 - i * 7;
    const losses = 40 + i * 3;
    const games = wins + losses;
    const stale = i === N - 1;   // 마지막 한 명은 3주째 잠들었다
    return {
      uid: i + 1 === MY ? 'me' : `u${i}`,
      lastMultiAt: Date.now() - (stale ? 21 * DAY : (i % 5) * DAY),
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
  const shown = tab === 'rate'
    ? rows.filter((r) => r.games >= 10 && Date.now() - r.lastMultiAt <= 7 * DAY)
    : rows;
  shown.forEach((r, i) => { r.rank = i + 1; });
  return { rows: shown, me: { ...shown[MY - 1], rank: MY }, error: null, mePromise: null };
}

export async function fetchUserCard() { return null; }

/**
 * 진짜 `leaderboard.js` 는 자격 판정을 스스로 하지만, 대역은 **화면이 부르는 것만**
 * 갖고 있으면 된다. 지금 화면은 목록을 그대로 그리므로 여기서 걸러 준다 —
 * 판정 규칙 자체는 `qa:multi` 가 진짜 함수(`rateEligible`)로 검사한다.
 */
