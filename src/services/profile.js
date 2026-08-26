/**
 * 프로필 — 화면이 유일하게 바라보는 계정 상태 창구.
 *
 * 원본은 **항상 로컬**이다. Firebase는 뒤에서 밀어 올리고 끌어내릴 뿐이라
 * 네트워크가 끊겨도 화면은 멈추지 않는다. (CLAUDE.md §6-4 "모든 쓰기는 실패를 가정한다")
 */

import { getStore, configured, withTimeout } from './firebase.js';
import { currentUser } from './auth.js';
import * as L from './storageLocal.js';
import { NICKNAME } from '../config/balance.js';
import { isTestAccount } from '../config/testAccount.js';
import * as Dex from './collection.js';
import * as Rank from './leaderboard.js';
/** 착용 자리 목록 — 표가 유일한 진실이라 슬롯이 늘어도 여기가 저절로 따라온다 */
import { ITEM_CATS } from '../data/items.js';

export const get = L.loadProfile;
export const dexUnique = L.dexUnique;
export const collection = L.loadCollection;

/** 원격 문서 경로 */
function userDoc(fb, uid) {
  return fb.storeMod.doc(fb.db, 'users', uid);
}

/**
 * 지갑 병합 — 신발별로 **많은 쪽**을 남긴다.
 *
 * 예전에는 `shoesOwned` 만 max 로 합치고 `shoesByTier` 는 원격 값을 통째로 덮어써서
 * 합계와 티어별이 서로 안 맞을 수 있었다. 이제 신발별 보유량 하나만 병합하고
 * 합계·티어별은 거기서 다시 계산하니 세 숫자가 어긋날 수가 없다.
 *
 * max 인 이유: 기기 A에서 주운 신발이 기기 B의 오래된 값에 덮여 사라지면 안 된다.
 * 대신 한쪽에서 쓴 신발이 되살아날 수는 있다 — 잃는 쪽보다 낫다고 봤다.
 */
function mergeWallet(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, n] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, n ?? 0);
  for (const k of Object.keys(out)) if (!(out[k] > 0)) delete out[k];
  return out;
}

/**
 * 이름 병합 — **빈 값은 절대 이기지 못한다.**
 * 원격이 비어 있으면 로컬을 쓰고, 둘 다 있으면 원격(다른 기기에서 바꿨을 수 있다).
 */
const pickName = (local, remote) => (remote || local || '');

/** 뱃지 도장 병합 — 0은 "아직"이라 절대 이기지 못한다 */
function earliestStamp(a, b) {
  const list = [a, b].filter((v) => v > 0);
  return list.length ? Math.min(...list) : 0;
}

/** 로컬을 먼저 고치고, 원격에는 조용히 밀어 올린다 */
export function patch(patchObj) {
  const p = L.patchProfile(patchObj);
  pushRemote(patchObj).catch(() => { /* 다음 기회에 */ });
  return p;
}

async function pushRemote(patchObj) {
  const u = currentUser();
  if (!configured() || !u || u.guest) return;
  const fb = await getStore();
  if (!fb) return;
  await withTimeout(fb.storeMod.setDoc(userDoc(fb, u.uid), patchObj, { merge: true }), undefined, '계정 저장');
}

/** 로그인 직후 — 프로필과 도감을 함께 끌어내린다 */
export async function pullAll() {
  /**
   * ★ **둘을 동시에 당긴다.** (2026-08-19 8차)
   *
   * 계정 문서(`users/{uid}`)와 도감(`users/{uid}/collection`)은 **서로를 안 본다** —
   * 각각 `sf_profile` 과 `sf_collection` 에 쓴다. 그런데 순서대로 기다리고 있었다:
   * 각 호출의 시한이 12초(`WRITE_TIMEOUT_MS`)라 느린 회선에서는 두 배로 늦어진다.
   * 병렬로 돌리면 **둘 중 느린 쪽**만큼만 걸린다.
   *
   * 뒤따르는 `ensureDexBadge()` 는 도감이 합쳐진 뒤여야 하므로 여기서 기다린다.
   */
  await Promise.all([
    pullRemote(),
    Dex.pullAndMerge().catch(() => {}),
  ]);
  /**
   * 도감을 합친 **뒤에** 뱃지 도장을 확인한다. 다른 기기에서 채운 종류가 지금 막
   * 내려왔을 수 있고, 개정 전에 이미 130종을 채운 사람은 도장이 아예 없다.
   */
  const stamped = L.ensureDexBadge();
  if (stamped.dexBadgeAt) pushRemote({ dexBadgeAt: stamped.dexBadgeAt }).catch(() => {});
  /**
   * ★ **테스트 계정은 서버에도 한 번 밀어 올린다.** (2026-08-21 29차, 사용자 지정)
   *
   * 로컬 채우기는 `loadProfile()` 이 이미 했다(`config/testAccount.js`). 그런데 그건
   * 이 기기에만 있는 값이라, 폰으로 갈아타면 원격 문서가 로컬을 덮으면서
   * (`pullRemote` 의 `ownedItems` 합집합) 아이템이 없는 상태로 돌아갈 수 있다.
   * 여기서 한 번 올려 두면 **어느 기기에서 들어와도 전부 가진 상태**가 된다.
   *
   * `get()` 이 곧 `loadProfile()` 이라 이 시점에는 이미 채워져 있다 — 그 값을 그대로 보낸다.
   */
  {
    const me = L.loadProfile();
    if (isTestAccount(me)) pushRemote({ ownedItems: me.ownedItems }).catch(() => {});
  }
  /**
   * 이름 되살리기 — 이미 빈 이름으로 박제된 계정 문서를 고친다.
   * 이 사람들은 판을 한 번 더 돌기 전까지 순위표에 `???` 로 보인다.
   */
  if (stamped.nickname) {
    pushRemote({
      nickname: stamped.nickname,
      nicknameLower: stamped.nickname.toLowerCase(),
      selectedCharacter: stamped.selectedCharacter ?? '',
    }).catch(() => {});
  }
  /**
   * ★ **마지막 로그인 시각.** (2026-08-19 12차, 사용자 지정)
   * 유저상태창 맨 아래 `마지막로그인: 2026.01.01 19:34` 에 쓴다. 접속 중인 사람은
   * `presence` 가 알려 주므로(현재로그인중), 이 값은 **떠난 뒤에** 의미가 생긴다.
   * 판마다가 아니라 접속 때 한 번만 쓴다 — 정확도는 충분하고 쓰기는 하루 몇 번이다.
   */
  pushRemote({ lastLoginAt: Date.now() }).catch(() => {});
  // 오프라인 동안 쌓인 기록을 이제 올린다
  Rank.flushQueued().catch(() => {});
  return stamped;
}

/** 로그인 직후 — 원격 값이 있으면 로컬로 끌어내린다 */
export async function pullRemote() {
  const u = currentUser();
  if (!configured() || !u || u.guest) return L.loadProfile();
  const fb = await getStore();
  if (!fb) return L.loadProfile();

  const snap = await withTimeout(fb.storeMod.getDoc(userDoc(fb, u.uid)), undefined, '계정 읽기');
  if (!snap.exists()) {
    // 첫 로그인 — 지금까지의 로컬 기록을 그대로 올린다
    const local = L.loadProfile();
    await withTimeout(
      fb.storeMod.setDoc(userDoc(fb, u.uid), { ...local, uid: u.uid, email: u.email }, { merge: true }),
      undefined, '계정 최초 생성');
    return local;
  }
  const remote = snap.data();
  // 기록류는 큰 쪽을 남긴다 — 다른 기기에서 더 잘한 판이 있을 수 있다
  const local = L.loadProfile();
  const merged = {
    ...local,
    ...remote,
    /**
     * ★ 이름은 **빈 값이 이기면 안 된다.**
     *
     * `...remote` 가 `...local` 을 덮으므로, 원격 문서의 닉네임이 빈 문자열이면
     * 로컬 닉네임까지 지워졌다. 계정 문서는 **첫 로그인 시점**에 만들어지는데
     * 그때는 아직 닉네임을 정하기 전이라 `''` 로 박히는 경로가 있다 — 그 뒤로
     * 이름이 영영 빈 채로 남고, 명예의 전당에는 `???` 로 나온다.
     * (실제 증상: 순위표 아이디가 전부 물음표)
     */
    nickname: pickName(local.nickname, remote.nickname),
    nicknameLower: pickName(local.nicknameLower, remote.nicknameLower),
    selectedCharacter: remote.selectedCharacter || local.selectedCharacter,
    bestStairs: Math.max(local.bestStairs ?? 0, remote.bestStairs ?? 0),
    totalPlays: Math.max(local.totalPlays ?? 0, remote.totalPlays ?? 0),
    // 지갑은 신발별 보유량이 진실이고 합계는 거기서 나온다 (아래 reconcile)
    shoesByIndex: mergeWallet(local.shoesByIndex, remote.shoesByIndex),
    /**
     * 뱃지 도장은 **한쪽에만 있어도 남긴다.** 0(없음)이 살아남으면
     * 아직 못 딴 기기에 로그인했을 때 훈장이 사라진다.
     * 둘 다 있으면 **이른 쪽** — 처음 해낸 시각이 진실이다.
     */
    dexBadgeAt: earliestStamp(local.dexBadgeAt, remote.dexBadgeAt),
    /**
     * ★ **산 아이템은 합집합이다.** (2026-08-21 26차)
     * 원격이 통째로 이기면 다른 기기에서 산 것이 사라진다 — 최대 10,000켤레짜리를
     * 로그인 한 번에 잃는 셈이다. 도감(`collection`)을 합집합으로 병합하는 것과 같은 이유.
     * 입고 있는 것은 **마지막에 고른 쪽**(원격)을 따른다 — 취향은 합칠 수 없다.
     */
    ownedItems: { ...(local.ownedItems ?? {}), ...(remote.ownedItems ?? {}) },
    equippedItems: remote.equippedItems ?? local.equippedItems ?? {},
  };
  L.reconcile(merged);
  L.saveProfile(merged);
  return merged;
}

// ─────────────────────────────────────────────
// 화면이 실제로 부르는 것들
// ─────────────────────────────────────────────

export const setDifficulty = (d) => patch({ difficulty: d });

// ── 드래곤 스트라이커 ──────────────────────────
export const setDragonDifficulty = (d) => patch({ dragonDifficulty: d });
export const setDragonCharacter = (i) => patch({ dragonCharacter: i | 0 });

/** 드래곤을 갖고 있나 — 앞의 다섯은 처음부터 갖고 있다 */
export function hasDragon(idx) {
  const i = idx | 0;
  if (i < 5) return true;
  return !!(L.loadProfile().dragonOwned || {})[i];
}

/**
 * 드래곤을 산다.
 * @returns {{ok:boolean, profile:object, short:number}} short = 모자란 금화
 */
export function buyDragon(idx, price) {
  const p = L.loadProfile();
  const i = idx | 0;
  const cost = Math.max(0, Math.round(price) || 0);
  if (hasDragon(i)) return { ok: true, profile: p, short: 0 };
  const have = p.dragonCoins || 0;
  if (have < cost) return { ok: false, profile: p, short: cost - have };
  const owned = { ...(p.dragonOwned || {}), [i]: true };
  /* 지갑에서만 뺀다 — 누적(dragonCoinsTotal)은 그대로라 금화왕 순위가 안 떨어진다 */
  return { ok: true, profile: patch({ dragonCoins: have - cost, dragonOwned: owned }), short: 0 };
}

/**
 * 드래곤 아이템 보관함.
 *
 * ★ 신발게임의 `buyItem`/`equipItem` 과 **이름을 겁치지 않았다.**
 * 둘은 같은 계정에 들어 있을 뿐 서로 전혀 다른 물건이다 —
 * 한쪽을 고치다 다른 쪽 지갑을 건드리는 사고를 막으려고 이름을 나눠 둔다.
 */

/** 드래곤 아이템을 갖고 있나 */
export function hasDragonItem(id) {
  return !!(L.loadProfile().dragonItems || {})[id];
}

/** 낌 것 전부 — 게임에 넘겨줄 모양 그대로 */
export function dragonEquipment() {
  const e = L.loadProfile().dragonEquip || {};
  return { mask: e.mask || null, flame: e.flame || null, head: e.head || null, leg: e.leg || null };
}

/**
 * 드래곤 아이템을 산다. 사면 **곷바로 낌다** — 사놓고 또 눌러야 끼는 건 번거롭다.
 * @returns {{ok:boolean, profile:object, short:number}} short = 모자란 금화
 */
export function buyDragonItem(id, slot, price) {
  const p = L.loadProfile();
  const cost = Math.max(0, Math.round(price) || 0);
  if (hasDragonItem(id)) return { ok: true, profile: p, short: 0 };
  const have = p.dragonCoins || 0;
  if (have < cost) return { ok: false, profile: p, short: cost - have };
  const items = { ...(p.dragonItems || {}), [id]: true };
  const equip = { ...(p.dragonEquip || {}), [slot]: id };
  /* 지갑에서만 빼다 — 누적(dragonCoinsTotal)은 그대로라 금화왕 순위가 안 떨어진다 */
  return { ok: true, short: 0,
           profile: patch({ dragonCoins: have - cost, dragonItems: items, dragonEquip: equip }) };
}

/**
 * 끼거나 벗는다. 이미 낌 것을 다시 누르면 벗는다.
 * 갖고 있지 않은 것은 끼지 않는다 — 저장이 망가져도 공짜로 끼는 일은 없다.
 */
export function equipDragonItem(slot, id) {
  const p = L.loadProfile();
  const cur = (p.dragonEquip || {})[slot] || null;
  const next = (id == null || cur === id) ? null : (hasDragonItem(id) ? id : cur);
  return patch({ dragonEquip: { ...(p.dragonEquip || {}), [slot]: next } });
}

/** 아이템을 산다 — 지갑에서만 빠지고 누적은 그대로다 (금화왕 순위가 안 떨어진다) */
export function spendDragonCoins(n) {
  const p = L.loadProfile();
  const cost = Math.max(0, Math.round(n) || 0);
  if ((p.dragonCoins || 0) < cost) return { ok: false, profile: p };
  return { ok: true, profile: patch({ dragonCoins: (p.dragonCoins || 0) - cost }) };
}

/**
 * 드래곤 스트라이커 한 판이 끝났다.
 *
 * ★ **기록은 큰 쪽만 남기고, 판수는 무조건 올린다.**
 * `patch()` 는 넘긴 칸만 원격에 merge 하므로 갱신이 없으면 아예 쓰지 않는다 —
 * 판마다 무조건 쓰면 최고기록이 그대로인데도 Firestore 쓰기가 계속 나간다.
 *
 * ★ **점수는 게임(iframe)이 보내온 값이다.** 사람이 고칠 수 있는 값이라
 * 믿을 수 있는 상한을 넘으면 버린다 — 순위표가 있는 게임에서 이 검사가 없으면
 * 콘솔 한 줄로 1등이 된다. 지금은 순위표가 없지만 곧 붙일 자리라 미리 막아 둔다.
 *
 * @param {{score:number, stage:number, level:number}} r
 * @returns {{profile:object, isBest:boolean}}
 */
export function finishDragonRun(r) {
  const before = L.loadProfile();
  const score = Math.max(0, Math.min(DRAGON_SCORE_CAP, Math.round(Number(r?.score) || 0)));
  const stage = clampInt(r?.stage, 0, 20);
  const level = clampInt(r?.level, 0, 10);

  /* 금화는 지갑과 누적 양쪽에 넣는다. 누적은 순위용이라 절대 줄지 않는다 */
  const coins = Math.max(0, Math.min(DRAGON_COIN_CAP, Math.round(Number(r?.coins) || 0)));
  const next = {
    dragonPlays: (before.dragonPlays || 0) + 1,
    dragonCoins: (before.dragonCoins || 0) + coins,
    dragonCoinsTotal: (before.dragonCoinsTotal || 0) + coins,
  };
  const isBest = score > (before.dragonBest || 0);
  if (isBest) { next.dragonBest = score; next.dragonBestLevel = level; }
  if (stage > (before.dragonBestStage || 0)) next.dragonBestStage = stage;

  const profile = patch(next);

  /**
   * 순위에 올린다. **기다리지 않는다** — 결과 화면이 네트워크를
   * 기다리면 비행기 모드에서 멈춰 버린다. 실패해도 다음 판이 끝날 때
   * 더 높은 기록으로 다시 올라간다.
   */
  Rank.submitDragonRun({
    score, coins, stage,
    difficulty: profile.dragonDifficulty || 'normal',
    dragon: profile.dragonCharacter | 0,
  }).catch(() => {});

  return { profile, isBest };
}

/**
 * 한 판에서 나올 수 있는 점수의 상한.
 * 20스테이지를 2인으로 완주해도 20만점 근처라 100만이면 넉넉하다 —
 * 넉넉하게 잡되 "무한대"는 아니게 하는 것이 요점이다.
 */
const DRAGON_SCORE_CAP = 1000000;
/**
 * 한 판에서 넣을 수 있는 금화의 상한.
 * 무적 봇으로 20스테이지를 완주해도 6,600개였다 — 넉넉하게 잡되 "무한대"는 아니게.
 */
const DRAGON_COIN_CAP = 20000;
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

export const setControlMode = (m) => patch({ controlMode: m });
/** 싱글 게임 배경 — 'random' 또는 BUILDINGS 의 id (2026-08-19) */
export const setSingleBg = (id) => patch({ singleBg: id });

/**
 * 캐릭터 교체. 순위표에 박혀 있는 얼굴도 같이 갈아 준다 —
 * 로비에서는 새 캐릭터인데 주간 순위표에만 옛 얼굴이 남으면 남의 기록처럼 보인다.
 */
export function setCharacter(id) {
  const p = patch({ selectedCharacter: id });
  Rank.syncIdentity().catch(() => { /* 다음 기록 제출 때 맞춰진다 */ });
  return p;
}

/**
 * 아이템 구매 (2026-08-21 26차) — 캐릭터 구매와 **같은 모양**이다.
 * 지갑이 바뀌므로 지갑 세 값을 같이 올린다(안 올리면 다음 접속에 옛 지갑이 이겨
 * 신발이 되살아난다 — §9-0-24 ⑥에서 부활 판돈이 그랬다).
 * @returns {{ok:boolean, profile:object}}
 */
export function buyItem(id) {
  const r = L.buyItem(id);
  if (r.ok) {
    pushRemote({
      ownedItems: r.profile.ownedItems,
      shoesOwned: r.profile.shoesOwned,
      shoesByTier: r.profile.shoesByTier,
      shoesByIndex: r.profile.shoesByIndex,
    }).catch(() => {});
  }
  return r;
}

/**
 * ★ **착용 모습도 순위표에 박혀 있다** — 갈아입으면 같이 고친다. (2026-08-21 30차)
 *
 * 캐릭터·닉네임과 **정확히 같은 이유**다(`setCharacter` 주석): 로비에서는 새 옷인데
 * 주간 순위표에만 옛 모습이 남으면 남의 기록처럼 보인다. 다만 이쪽은 부르는 횟수가
 * 다르다 — 쇼핑에서 이것저것 입어 보면 **탭 한 번마다** 불린다. `syncIdentity()` 는
 * 한 번에 최대 아홉 장을 고치므로 그대로 매달면 쓰기가 쏟아진다.
 *
 * 그래서 **모아서 한 번만** 보낸다. 마지막 탭에서 3초가 지나야 나가고, 그 사이의
 * 탭은 전부 하나로 접힌다. 늦어도 손해가 없다 — 순위표는 지금 이 순간을 다투는
 * 화면이 아니고, 실패해도 다음 기록 제출 때 어차피 맞춰진다.
 */
const IDENTITY_DEBOUNCE_MS = 3000;
let identityTimer = null;
function syncIdentitySoon() {
  clearTimeout(identityTimer);
  identityTimer = setTimeout(() => {
    identityTimer = null;
    Rank.syncIdentity().catch(() => { /* 다음 기록 제출 때 맞춰진다 */ });
  }, IDENTITY_DEBOUNCE_MS);
}

/**
 * ★ **벗은 자리는 빈 문자열로 적어 보낸다.** (2026-08-21 30차)
 *
 * `pushRemote` 는 `setDoc(..., { merge: true })` 다. 이게 map 필드를 **재귀로**
 * 병합한다 — 즉 `{ equippedItems: {} }` 를 보내는 것은 **아무 일도 안 하는 것**이고,
 * `{ hat: 'x' }` 만 보내도 서버의 `wing`·`pet` 은 그대로 남는다. 그래서 **키를 지우는
 * 일이 서버에 전달되는 길이 없었다** — 벗어도 다음 로그인에 되살아나고, 순위표에는
 * 계속 입은 채로 떴다. (26차부터 있던 결함인데, 30차에 계정 문서의 `equippedItems`
 * 를 순위표 그림의 입력으로 쓰면서 처음 화면에 드러났다.)
 *
 * `deleteField()` 를 쓰는 방법도 있지만 슬롯이 늘 때마다 지울 목록을 손으로 적어야
 * 한다. **자리를 빠짐없이 적고 빈 자리는 `''`** 로 두면 그 문제가 사라진다 —
 * 읽는 쪽은 전부 `filter(Boolean)`(`packItems`·`wornList`·`unequipAll`) 이라
 * 빈 문자열이 흘러들어도 안 입은 것과 똑같이 취급된다.
 */
const fullWorn = (worn) => Object.fromEntries(ITEM_CATS.map((c) => [c.slot, worn?.[c.slot] ?? '']));

/** 착용/해제 — 값은 작지만 기기 사이에 따라와야 해서 서버에도 올린다 */
export function equipItem(slot, id) {
  const p = L.equipItem(slot, id);
  pushRemote({ equippedItems: fullWorn(p.equippedItems) }).catch(() => {});
  syncIdentitySoon();
  return p;
}

/** 모두 벗기 — 벗은 개수를 돌려준다(0이면 화면이 "착용한 아이템이 없습니다"를 띄운다) */
export function unequipAll() {
  const r = L.unequipAll();
  if (r.off) { pushRemote({ equippedItems: fullWorn(null) }).catch(() => {}); syncIdentitySoon(); }
  return r;
}

/** @returns {{ok:boolean, profile:object}} */
export function buyCharacter(id) {
  const r = L.unlockCharacter(id);
  if (r.ok) {
    pushRemote({
      unlockedCharacters: r.profile.unlockedCharacters,
      shoesOwned: r.profile.shoesOwned,
      shoesByTier: r.profile.shoesByTier,
      shoesByIndex: r.profile.shoesByIndex,
    }).catch(() => {});
  }
  return r;
}

/** 한 판 종료 반영 */
export function finishRun(result) {
  const r = L.commitRun(result);
  pushRemote({
    /**
     * ★ 이름·캐릭터를 **매 판마다 같이 올린다.**
     *
     * 신발왕·역대 탭은 `users` 문서의 이름을 그대로 읽는다. 그런데 이 필드를
     * 쓰는 곳이 `saveNickname` 하나뿐이라, 그 한 번이 실패하면(예전에 로그인이
     * 깨져 있던 동안 실제로 그랬다) 계정 문서의 이름이 영영 빈 채로 남는다.
     * 판이 끝날 때마다 같이 실어 보내면 저절로 복구된다.
     */
    nickname: r.profile.nickname ?? '',
    nicknameLower: (r.profile.nickname ?? '').toLowerCase(),
    selectedCharacter: r.profile.selectedCharacter ?? '',
    bestStairs: r.profile.bestStairs,
    bestByDifficulty: r.profile.bestByDifficulty,
    totalStairs: r.profile.totalStairs,
    totalPlays: r.profile.totalPlays,
    shoesOwned: r.profile.shoesOwned,
    shoesByTier: r.profile.shoesByTier,
    shoesByIndex: r.profile.shoesByIndex,
    dexBadgeAt: r.profile.dexBadgeAt ?? 0,
  }).catch(() => {});
  // 도감은 별도 컬렉션이라 따로 올린다 (실패해도 로컬에는 이미 있다)
  Dex.pushFound(result.shoeIndices).catch(() => {});
  /**
   * 명예의 전당 제출. 먼저 큐에 넣고 바로 올린다 —
   * 성공하면 큐에서 빠지고, 실패하면 남아서 다음 접속에 다시 올라간다.
   * 넣기 전에 올리면 앱이 그 사이에 닫혔을 때 기록이 통째로 사라진다.
   */
  const entry = {
    stairs: result.floor,
    difficulty: result.difficulty,
    shoesFound: result.shoeIndices.length,
  };
  L.queueScore(entry);
  Rank.flushQueued().catch(() => {});
  return r;
}

/** 닉네임 규칙 검사 — 한글 2~4자 (기획서 §8) */
export function validateNickname(v) {
  return NICKNAME.pattern.test(String(v ?? '').trim());
}

/** 중복 확인이 이 시간을 넘으면 그냥 통과시킨다 — 네트워크 때문에 가입이 멈추면 안 된다 */
const NICK_CHECK_TIMEOUT_MS = 4000;

/**
 * 닉네임 중복 확인.
 *
 * **로그인한 사용자에게만 의미가 있다.** 게스트 닉네임은 이 브라우저에만 있고
 * 서버에 올라가지 않으므로 남의 이름과 겹쳐도 아무 일도 일어나지 않는다.
 * 게스트를 막으면 아무 이득 없이 Firestore(93KB)만 내려받게 된다.
 */
export async function isNicknameTaken(nickname) {
  const u = currentUser();
  if (!configured() || !u || u.guest) return false;

  const check = (async () => {
    const fb = await getStore();
    if (!fb) return false;
    const q = fb.storeMod.query(
      fb.storeMod.collection(fb.db, 'users'),
      fb.storeMod.where('nicknameLower', '==', nickname.trim().toLowerCase()),
      fb.storeMod.limit(1)
    );
    const snap = await withTimeout(fb.storeMod.getDocs(q), undefined, '닉네임 중복 확인');
    return snap.docs.some((d) => d.id !== u.uid);
  })();

  const timeout = new Promise((r) => setTimeout(() => r(false), NICK_CHECK_TIMEOUT_MS));
  return Promise.race([check, timeout]);
}

/**
 * 닉네임 저장.
 *
 * 이름을 바꾸면 **이미 올라간 이번 주·달·해 기록의 이름도 함께 고친다.**
 * 신발 200켤레를 내고 바꿨는데 순위표에 옛 이름이 그대로면 산 게 아니다.
 * (`leaderboard.syncIdentity` — 고칠 문서는 최대 9장이라 부담이 없다)
 */
export function saveNickname(nickname) {
  const v = nickname.trim();
  const p = patch({ nickname: v, nicknameLower: v.toLowerCase() });
  Rank.syncIdentity().catch(() => { /* 다음 기록 제출 때 맞춰진다 */ });
  return p;
}
