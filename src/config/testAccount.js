/**
 * ★ **테스트 계정** — 아이템을 전부 산 것으로 둔다. (2026-08-21 29차, 사용자 지정)
 *
 * *"내가 테스트할 수 있도록 아이디 '토토' 라는 아이디에게만 모든 아이템을 다 구매한걸로
 *   만들어, 그 아이디로 모든 아이템 하나씩 착용해보고 잘 작동하는지 테스트 할 수 있도록"*
 *
 * ## 왜 이 파일 하나로 몰아 뒀나
 *
 * 테스트용 예외는 **지울 때 한 곳만 보면 되게** 해 두지 않으면 반드시 남는다.
 * 아래 `TEST_ACCOUNTS` 를 비우면(`nicknames: []`, `uids: []`) 기능 전체가 꺼지고,
 * 다른 파일은 한 줄도 안 고쳐도 된다. 부르는 곳은 두 군데뿐이다:
 *
 *   · `services/storageLocal.js` `loadProfile()` — 로컬(=원본)에 채워 넣는다
 *   · `services/profile.js` `pullAll()`          — 서버에도 한 번 밀어 올린다
 *
 * ## 무엇을 주고 무엇을 안 주나
 *
 *   · 준다   — **`ownedItems` 전부**(19종). 그래야 쇼핑 목록이 전부 `착용 가능 아이템` 이
 *              되고 큰 버튼이 `착용하기` 로 뜬다.
 *   · 안 준다 — **신발도, 캐릭터도, 착용 상태도** 건드리지 않는다. 신발을 얹으면 지갑
 *              계산(`reconcile`·도감 뱃지)이 실제 플레이와 달라져서 **다른 것을 테스트할 때
 *              방해가 된다.** 착용은 직접 눌러 보는 것이 이 계정의 목적이라 비워 둔다.
 *
 * ## 닉네임으로 가르는 것이 안전한가
 *
 * 로그인 계정의 닉네임은 **서버에서 중복을 막으므로**(`leaderboard` 의 중복 확인) 같은
 * 이름을 가진 계정이 둘일 수 없다. 그래도 더 좁히고 싶으면 `uids` 에 uid 를 적으면 된다 —
 * 그러면 그 계정 **하나만** 걸린다. uid 는 브라우저 콘솔에서 이렇게 확인한다:
 *
 *     JSON.parse(localStorage.sf_profile).uid
 *
 * `uids` 에 값이 하나라도 있으면 **uid 만** 본다(닉네임은 무시). 이름을 바꿔 가며 얻어
 * 가는 길을 아예 막고 싶을 때 쓰라고 그렇게 뒀다.
 */

import { ITEMS } from '../data/items.js';

/** 여기를 비우면 기능이 통째로 꺼진다 */
export const TEST_ACCOUNTS = {
  nicknames: ['토토'],
  /** @type {string[]} 비워 두면 닉네임으로 판단한다 */
  uids: [],
};

/** 이 프로필이 테스트 계정인가 */
export function isTestAccount(p) {
  if (!p) return false;
  // uid 를 적어 뒀으면 그쪽이 우선 — 이름은 바꿀 수 있지만 uid 는 못 바꾼다
  if (TEST_ACCOUNTS.uids.length) return TEST_ACCOUNTS.uids.includes(p.uid);
  return TEST_ACCOUNTS.nicknames.includes(p.nickname);
}

/**
 * 아직 없는 아이템을 채워 넣는다. **이미 다 있으면 아무것도 안 한다.**
 *
 * `loadProfile()` 은 화면을 그릴 때마다 불린다(초당 여러 번). 그래서 이 함수는
 * "바뀐 게 있을 때만" 참을 돌려주고, 부르는 쪽은 그때만 저장한다 — 매번 쓰면
 * localStorage 쓰기가 렌더마다 일어나고 서버로도 헛요청이 나간다.
 *
 * @param {object} p 프로필 (제자리에서 고친다)
 * @returns {boolean} 무언가 채워 넣었는가
 */
export function grantTestItems(p) {
  if (!isTestAccount(p)) return false;
  const owned = p.ownedItems ?? {};
  let changed = false;
  for (const it of ITEMS) {
    if (owned[it.id]) continue;
    owned[it.id] = true;
    changed = true;
  }
  if (changed) p.ownedItems = owned;
  return changed;
}
