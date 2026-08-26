/**
 * `services/profile.js` 대역 — 드래곤 스트라이커 로비/포털 미리보기용.
 *
 * 진짜 `DragonLobby.js` · `Portal.js` 를 한 줄도 안 바꾸고 띄우기 위한 것이다.
 * 로그인 게이트를 지나야만 볼 수 있는 화면이라, 계정 없이 눈으로 확인할 통로가
 * 이것뿐이다.
 *
 * `?best=N` 최고 점수 · `?stage=N` 최고 스테이지 · `?lv=N` 파이어 레벨
 * `?plays=N` 판수 · `?diff=easy|normal|hard` · `?shoes=N` (포털 카드의 신발 줄)
 */

const q = new URLSearchParams(location.search);
const n = (k, d) => Number(q.get(k) ?? d);

let P = {
  uid: 'me',
  nickname: q.get('nick') ?? '아빠게임왕',
  selectedCharacter: 'ian',
  shoesOwned: n('shoes', 4213),
  ownedItems: {},
  equippedItems: {},
  dragonBest: n('best', 128400),
  dragonBestStage: n('stage', 12),
  dragonBestLevel: n('lv', 8),
  dragonPlays: n('plays', 37),
  dragonDifficulty: q.get('diff') ?? 'normal',
  dragonCharacter: n('char', 0),
  dragonCoins: n('coins', 6400),
  dragonCoinsTotal: n('coins', 6400),
  dragonOwned: {},
};

export function get() { return P; }
export function setDragonDifficulty(d) { P = { ...P, dragonDifficulty: d }; return P; }
export function setDragonCharacter(i) { P = { ...P, dragonCharacter: i | 0 }; return P; }
export function finishDragonRun() { return { profile: P, isBest: false }; }

/**
 * 아래는 **화면을 띄우는 데만** 필요한 나머지 통로다.
 * 포털은 로비를 정적으로 import 하고 로비는 또 여러 화면을 끌고 오므로,
 * 하나라도 빠지면 모듈 자체가 안 열려 미리보기가 통째로 빈 화면이 된다.
 * 미리보기에서 눌릴 일이 없는 것들이라 값만 그럴듯하게 돌려준다.
 */
export function patch(o) { P = { ...P, ...o }; return P; }
export const dexUnique = () => 130;
export const collection = () => ({});
export const setDifficulty = (d) => patch({ difficulty: d });
export const setControlMode = (m) => patch({ controlMode: m });
export const setSingleBg = (id) => patch({ singleBg: id });
export const setCharacter = (id) => patch({ selectedCharacter: id });
export const buyItem = () => ({ ok: false, profile: P });
export const equipItem = () => P;
export const unequipAll = () => P;
export const buyCharacter = () => ({ ok: false, profile: P });
export const finishRun = () => P;
export const pullAll = async () => P;
export const pullRemote = async () => P;
export const validateNickname = () => ({ ok: true });
export const isNicknameTaken = async () => false;
export const saveNickname = (v) => patch({ nickname: v });

/* 드래곤 상점 미리보기용 */
export const hasDragon = (i) => (i|0) < 5 || !!(P.dragonOwned||{})[i|0];
export function buyDragon(idx, price){
  if(hasDragon(idx)) return { ok:true, profile:P, short:0 };
  const have = P.dragonCoins || 0;
  if(have < price) return { ok:false, profile:P, short: price - have };
  P = { ...P, dragonCoins: have - price, dragonOwned: { ...(P.dragonOwned||{}), [idx]: true } };
  return { ok:true, profile:P, short:0 };
}
export const spendDragonCoins = () => ({ ok:false, profile:P });
