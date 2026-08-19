/**
 * 순위표를 **내 주변만** 잘라 낸다. (2026-08-19)
 *
 * ## 왜
 *
 * 예전에는 언제나 1등부터 보여 줬다. 그런데 내가 11등이면 1~10등은 그냥 스크롤해
 * 지나쳐야 하는 줄이다 — *"내가 11등이면 굳이 1등이 누군지 볼 필요가 있을까?"* (사용자).
 * 순위표에서 사람이 실제로 궁금해하는 건 **바로 위·아래에 누가 있는지**다.
 * 200명 중 200등이면 195~205등 언저리가 보여야 한다.
 *
 * ## 반경을 5 → 50 으로 넓혔다 (2026-08-19 11차, 사용자 지정)
 *
 * *"11위 12위 인데 1위가 안보이는것도 이상하다. 즉 내 순위 위 아래로 50명까지 보이게해"*
 *
 * 맞는 지적이다. 5줄만 보이면 **잘라 낸 것이 아니라 목록이 그것뿐인 것처럼** 보인다.
 * 1등이 누군지는 순위표의 기본 정보고, 11등에게 1등은 겨우 열 줄 위다.
 * 대신 목록이 길어졌으므로 화면 쪽에서 **내 줄이 보이는 자리로 스크롤**해 준다
 * (`HallOfFame` — 자르기만 넓히고 스크롤을 안 하면 내 줄을 손으로 찾아야 한다).
 *
 * ## 왜 별도 파일인가
 *
 * `leaderboard.js` 는 `firebase.js` → `import.meta.env` 를 타서 **노드에서 불러오는
 * 순간 죽는다**(§9-0-5 에 같은 이유로 `periodKeys.js` 를 뗀 기록이 있다).
 * 이 계산은 순수 함수라 브라우저 없이 검사할 수 있어야 하므로 여기 따로 둔다.
 */

/** 내 위아래로 몇 줄씩 보여 줄지 (총 2*RADIUS+1 줄) */
export const RANK_WINDOW_RADIUS = 50;

/**
 * @param {Array<{uid:string}>} rows 순위 순으로 정렬된 목록 (1등이 [0])
 * @param {string|null|undefined} myUid
 * @param {number} [radius]
 * @returns {Array} 내가 가운데 오도록 자른 조각. 내가 목록에 없으면 앞에서부터.
 *
 * **길이를 항상 일정하게 유지한다.** 내가 1등이라 위로 못 뻗으면 그만큼 아래로 더 준다 —
 * 안 그러면 상위권일수록 목록이 짧아져서 화면이 들쭉날쭉해 보인다.
 */
export function rankWindow(rows, myUid, radius = RANK_WINDOW_RADIUS) {
  const list = Array.isArray(rows) ? rows : [];
  const size = radius * 2 + 1;
  if (list.length <= size) return list;               // 다 보여 줘도 짧다

  const i = myUid ? list.findIndex((r) => r.uid === myUid) : -1;
  // 내가 목록에 없으면(순위 밖이거나 비로그인) 예전처럼 위에서부터 — 하단 '내 순위' 줄이 따로 있다
  if (i < 0) return list.slice(0, size);

  // 가운데에 놓되 양 끝에서는 안쪽으로 민다 (길이 고정)
  let start = i - radius;
  if (start < 0) start = 0;
  if (start + size > list.length) start = list.length - size;
  return list.slice(start, start + size);
}
