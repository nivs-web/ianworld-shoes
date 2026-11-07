/**
 * 점프 피아노 — 계정에 저장하는 값 한 묶음(`profile.jp`)의 모양 · 고치기 · 병합. (2026-11-07)
 *
 * 줄넘기 챔피언(`jumpropeState.js` · `profile.jr`)을 그대로 복사해 이름만 바꿨다 — 두 게임은 저장을 섞지 않는다.
 * `profile.js` 의 `pullRemote` 가 부르므로 **부팅 번들에 들어간다** — 그래서 표(data.js)도
 * 게임 코드도 물지 않는 작은 순수 함수만 둔다.
 *
 * ## 병합 규칙 (드래곤 · 캐치볼과 같은 방침)
 * 줄지 않는 값(경험치 · 기록 · 누적 · 별)은 큰 쪽, 산 것은 합집합, 지갑(별사탕 · 아이템 수)도 큰 쪽
 * — 한 기기에서 번 것이 다른 기기의 옛 값에 덮여 사라지는 것보다, 쓴 것이 되살아나는 쪽이 낫다.
 * 고른 것(줄넘기 · 모습 · 난이도 · 설정)은 마지막에 고른 쪽(원격)을 따른다.
 */

const DK = ['easy', 'normal', 'hard'];
const STAGE_N = 10;
const ITEM_IDS = ['shield', 'heart', 'candy2'];
const CAP = 1e9;

const n0 = (v, hi = CAP) => {
  const x = Math.round(Number(v) || 0);
  return x < 0 ? 0 : x > hi ? hi : x;
};
const arr = (a, hi) => Array.from({ length: STAGE_N }, (_, i) => n0(Array.isArray(a) ? a[i] : 0, hi));
const per = (o, hi) => Object.fromEntries(DK.map((k) => [k, n0(o?.[k], hi)]));
const perArr = (o, hi) => Object.fromEntries(DK.map((k) => [k, arr(o?.[k], hi)]));
const str = (v, max, def) => (typeof v === 'string' && v.length <= max ? v : def);

export function emptyJp() { return normJp(null); }

/** 저장된 값이 어떤 모양이든 안전한 모양으로 */
export function normJp(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const opts = r.opts && typeof r.opts === 'object' ? r.opts : {};
  return {
    xp: n0(r.xp),
    candy: n0(r.candy),
    candyTotal: n0(r.candyTotal),
    plays: n0(r.plays),
    jumps: n0(r.jumps),
    perfects: n0(r.perfects),
    bestCombo: n0(r.bestCombo, 99999),
    /* 콤보 기록(보통 · 어려움에서 세운 최고 콤보) — 콤보 순위 · 콤보 선물 가면 (2026-11-07) */
    comboRec: n0(r.comboRec, 99999),
    /* 멀티 — 판 수 · 우승 수 (줄지 않는 값 · 점프 피아노 멀티는 다음 주 개발, 칸만 미리 둔다) */
    mPlays: n0(r.mPlays, 100000),
    mWins: n0(r.mWins, 100000),
    endless: per(r.endless, 99999),
    stars: perArr(r.stars, 3),
    scores: perArr(r.scores, 9999999),
    owned: [...new Set((Array.isArray(r.owned) ? r.owned : []).filter((s) => typeof s === 'string' && s.length <= 24))].slice(0, 200),
    items: Object.fromEntries(ITEM_IDS.map((k) => [k, n0(r.items?.[k], 99)])),
    rope: str(r.rope, 24, 'red'),
    look: str(r.look, 32, ''),
    diff: DK.includes(r.diff) ? r.diff : 'normal',
    opts: {
      sound: opts.sound !== false,
      vib: opts.vib !== false,
      ring: ['auto', 'on', 'off'].includes(opts.ring) ? opts.ring : 'auto',
      /* 리듬 판정 보정(ms) — 설정 «타이밍 맞추기». + = 늦게 누르는 버릇 */
      offset: Math.max(-150, Math.min(150, Math.round(Number(opts.offset) || 0))),
      /* 모드 설명 팝업을 본 것(비트: 1 챔피언십 · 2 무한 피아노 · 4 멀티) — 처음 누를 때 한 번만 띄운다 */
      guide: n0(opts.guide, 7),
      /* 방식 — 'jump' = 한 손(3칸 · 기본) · 'both' = 두 손(6칸). 로비에서 고른다 */
      ctrl: opts.ctrl === 'both' ? 'both' : 'jump',
      /* 무한 피아노 곡 (music.SONG_IDS 중 하나, 2026-11-07 10곡) */
      song: str(opts.song, 20, 'endless'),
    },
  };
}

const maxArr = (a, b) => a.map((v, i) => Math.max(v, b[i] ?? 0));

/** 두 기기의 값 합치기 — 위 «병합 규칙» */
export function mergeJp(localRaw, remoteRaw) {
  if (!remoteRaw) return localRaw ? normJp(localRaw) : undefined;
  const a = normJp(localRaw), b = normJp(remoteRaw);
  return {
    xp: Math.max(a.xp, b.xp),
    candy: Math.max(a.candy, b.candy),
    candyTotal: Math.max(a.candyTotal, b.candyTotal),
    plays: Math.max(a.plays, b.plays),
    jumps: Math.max(a.jumps, b.jumps),
    perfects: Math.max(a.perfects, b.perfects),
    bestCombo: Math.max(a.bestCombo, b.bestCombo),
    comboRec: Math.max(a.comboRec, b.comboRec),
    mPlays: Math.max(a.mPlays, b.mPlays),
    mWins: Math.max(a.mWins, b.mWins),
    endless: Object.fromEntries(DK.map((k) => [k, Math.max(a.endless[k], b.endless[k])])),
    stars: Object.fromEntries(DK.map((k) => [k, maxArr(a.stars[k], b.stars[k])])),
    scores: Object.fromEntries(DK.map((k) => [k, maxArr(a.scores[k], b.scores[k])])),
    owned: [...new Set([...a.owned, ...b.owned])],
    items: Object.fromEntries(ITEM_IDS.map((k) => [k, Math.max(a.items[k], b.items[k])])),
    rope: b.rope || a.rope,
    look: b.look || a.look,
    diff: remoteRaw.diff ? b.diff : a.diff,
    /* 고른 설정은 원격을 따르되, 본 설명 팝업은 두 기기 것을 합친다(다시 뜨지 않게) */
    opts: { ...(remoteRaw.opts ? b.opts : a.opts), guide: a.opts.guide | b.opts.guide },
  };
}
