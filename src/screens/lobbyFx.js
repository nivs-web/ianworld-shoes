/**
 * 좀비와 드래곤 로비 — 움직이는 눈요기 층 (11/12 대표님 «우리가 만들어 놓은 거 그냥 싹 다 집어넣어»)
 *
 *  mountLobbyFx(layer, { land }) → unmount()
 *    layer = .l2-fxlayer (앞 겹 위 · 용 · UI 아래 · .screen.idg-lobby2 안이라 cqw · cqh · --cx · --sc · --ih 를 물려받는다)
 *    land = true 가로(front_land_v3 2240×1072) · false 세로(front_port 1080×1935) · 안 주면 화면 방향을 본다. 화면 방향이 바뀌면 알아서 다시 깐다.
 *
 *  늘 있는 것 (CSS 애니메이션만) : 촛불 불꽃 일렁 · 가로등 · 땅 등불 일렁 · 초록 화로 불 · 성 창문 불빛 껌뻑(창마다 엇갈림) · 호박 눈 · 입 불빛 껌뻑 · 떠다니는 도깨비불
 *  가끔 나오는 것 (타이머 · 화면이 안 보이면 쉼) : 성문 앞 땅을 뚫고 나오는 해골 좀비(사라지고 7~8초 뒤 또 · 한 자리만) · 박쥐 떼(종류 번갈아 7~13초) · 하늘 손님(마녀 · 해골 빗자루 · 좀비 자전거 · 유령 15~25초)
 *  창문 · 호박 · 등불 유리 = 앞 겹 그림에서 따뜻한 불빛 픽셀만 뽑은 판(ai/lobby2/fx/glow_*_hi · _lo)을 같은 자리에 겹쳐 «더 밝게 / 꺼짐» 을 바꾼다.
 *  규칙 : 투명하게 스르르 사라짐 없음(땅속으로 꺼짐 · 화면 밖으로 나감 · 깜박) · 빛은 아주 은은하게 · 도트 · 움직임 줄이기면 전부 멈춤.
 *
 *  ★ 좌표 표 = 아래 LAND · PORT (앞 겹 그림 좌표 · 밝은 픽셀 덩어리를 재서 찍음). 앞 겹 그림이 옮겨지면 dx · dy 만 고치면 전부 따라간다.
 *    (불빛 판 glow_* 은 그림 그대로의 좌표라, 그림을 새로 그리면 판도 다시 뽑아야 한다)
 */

const AI = '/assets/iandragon_game/ai/';
const FX = AI + 'lobby2/fx/';

/* ════ 좌표 표 (그림 좌표 · 가운데 기준) ════
 *  candle [x, y, w, h] = 촛불 불꽃 덩어리 · lamp = 등불 유리 · torch = 초록 화로 불 · win = 성 창문 · pump = 호박 얼굴(눈 · 입)
 *  wisp [x, y, rx, ry] = 도깨비불 맴도는 가운데와 반경
 *  gate [x, 땅 y, 크기, 흔들 x, 흔들 y] = 해골 좀비가 솟는 자리(발밑) — 성문 계단 아래 호박 두 개 바로 밑 빈 땅 한 곳만 (11/12 대표님)
 *    매번 그 둘레 ±흔들 x · ±흔들 y 픽셀 안에서 조금씩 다른 자리 · 크기는 성 쪽이라 멀어서 작게
 *  sky [위 y, 아래 y] = 하늘 손님 · 박쥐가 지나가는 높이 */
export const LAND = {
  img: 'front_land_v3', iw: 2240, ih: 1072, dx: 0, dy: 0, glow: 'glow_land',
  candle: [[957, 627, 15, 27], [923, 645, 15, 27], [1303, 641, 15, 27], [1338, 648, 15, 25], [1318, 667, 14, 24], [967, 838, 15, 22], [928, 864, 15, 25]],
  lamp: [[929, 448, 46, 46], [684, 707, 50, 32]],
  torch: [[934, 540, 30, 40], [1932, 529, 32, 48], [1877, 647, 36, 58]],
  win: [[1821, 155, 9, 18], [1748, 188, 23, 24], [1680, 214, 11, 24], [1529, 254, 16, 32], [1902, 267, 9, 22], [1750, 272, 19, 20], [1693, 304, 14, 33], [1616, 305, 13, 31], [1655, 306, 14, 29], [1823, 350, 10, 29], [2017, 352, 9, 27], [1847, 354, 9, 29], [1868, 360, 9, 27], [1382, 430, 7, 16], [2126, 450, 6, 14]],
  pump: [[887, 621, 44, 36], [1740, 599, 44, 38], [2001, 609, 32, 24], [1660, 549, 24, 20], [60, 663, 52, 40], [490, 703, 80, 56], [2096, 705, 38, 28], [246, 1031, 96, 80], [394, 1032, 102, 80], [125, 1048, 70, 46], [523, 1047, 72, 46], [1007, 1050, 62, 42], [2000, 1040, 92, 64], [2159, 1013, 128, 100], [1643, 1060, 48, 26]],
  wisp: [[770, 515, 40, 30], [1700, 470, 40, 26], [300, 600, 60, 26]],
  gate: [1660, 621, 0.72, 22, 4],   /* 성문(1630, 450) 계단 아래 · 호박 두 개(1650, 545 · 1640, 575) 밑 · 보라 길 위쪽 빈 땅 */
  sky: [70, 330],
};
export const PORT = {
  img: 'front_port', iw: 1080, ih: 1935, dx: 0, dy: 0, glow: 'glow_port',
  candle: [[720, 947, 16, 28], [757, 952, 15, 25], [359, 932, 16, 26], [324, 948, 16, 24], [736, 972, 14, 22], [367, 1159, 15, 25], [326, 1189, 15, 22], [704, 1503, 15, 26], [667, 1536, 15, 28]],
  lamp: [[330, 711, 50, 48], [91, 1022, 54, 48]],
  torch: [[993, 696, 34, 50], [339, 808, 32, 50], [772, 1310, 42, 80]],
  win: [[995, 227, 7, 16], [922, 256, 20, 31], [853, 290, 10, 16], [697, 326, 17, 35], [925, 347, 16, 17], [865, 382, 14, 30], [786, 383, 13, 30], [826, 383, 14, 30], [1000, 429, 10, 30], [1025, 435, 8, 25], [1046, 439, 9, 27], [547, 512, 7, 18]],
  pump: [[290, 903, 46, 40], [532, 787, 30, 24], [897, 713, 44, 42], [1054, 717, 30, 24], [835, 638, 24, 18], [323, 1460, 44, 36], [415, 1538, 80, 58], [335, 1618, 88, 64], [762, 1627, 86, 62], [108, 1550, 34, 26], [245, 1665, 36, 44], [77, 1880, 110, 92], [222, 1903, 82, 64], [468, 1902, 74, 62], [639, 1904, 56, 56], [820, 1891, 98, 70], [994, 1859, 142, 116]],
  wisp: [[260, 1430, 40, 30], [180, 1010, 36, 28], [800, 1560, 30, 24]],
  gate: [740, 732, 0.8, 14, 8],   /* 성문(810, 560) 계단 아래 · 호박 두 개(735, 632 · 815, 662) 밑 · 보라 길 오른쪽 빈 땅 (412×915 에서도 오른쪽 «좀비습격» 칸에 안 가리게) */
  sky: [130, 600],
};

/* ── 하늘 손님 (15~25초 · 순서대로 돌고 마녀는 한 바퀴에 두 번) — 그림 = 전투 눈요기와 같은 ai/fun/* ── */
const GUEST = {
  witch: { src: 'fun/witch.png', w: 91, h: 91, k: 1.25, dir: 1, ms: 11000 },
  skel: { src: 'fun/skel_broom.png', w: 96, h: 77, k: 1.2, dir: -1, ms: 10000 },
  bike: { src: 'fun/bike.png', w: 101, h: 98, k: 1.1, dir: 1, ms: 12000 },
  boo: { src: 'fun/boo.png', w: 51, h: 49, k: 1.3, dir: -1, ms: 13000 },
};
const GUEST_ROUND = ['witch', 'skel', 'bike', 'witch', 'boo'];
/* ── 박쥐 종류 (7~13초 · 번갈아) : 까만 작은 떼 · 보라 큰 박쥐 ── */
const BATS = {
  swarm: { a: 'fun/batswarm_a.png', b: 'fun/batswarm_b.png', w: 22, h: 14, k: 1.7, n: [6, 10] },
  purple: { a: 'fun/bat_up.png', b: 'fun/bat_down.png', w: 40, h: 24, k: 1.5, n: [2, 4] },
};

const css = (o) => Object.entries(o).map(([k, v]) => `--${k}:${v}`).join(';');
function mk(cls, style, kids) {
  const e = document.createElement('i');
  e.className = cls;
  if (style) e.setAttribute('style', style);
  if (kids) for (const k of kids) e.appendChild(k);
  return e;
}
/** 번호로 정하는 흩어짐 (다시 그려도 같다) */
const hsh = (i, m) => ((i * 7919 + 13) % 97) / 97 * m;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/** 늘 있는 것 한 벌 */
function staticSet(T) {
  const kids = [];
  T.win.forEach(([x, y, w, h], i) => kids.push(mk('lfx-p lfx-glow lfx-win', css({ x, y, w, h, du: (6 + hsh(i, 8)).toFixed(1) + 's', dl: (-hsh(i + 3, 14)).toFixed(2) + 's' }))));
  T.pump.forEach(([x, y, w, h], i) => kids.push(mk('lfx-p lfx-glow lfx-pump', css({ x, y, w, h, du: (4.5 + hsh(i, 6)).toFixed(1) + 's', dl: (-hsh(i + 5, 10)).toFixed(2) + 's' }))));
  T.lamp.forEach(([x, y, w, h], i) => {
    kids.push(mk('lfx-p lfx-halo warm', css({ x, y, w: w * 3, h: h * 3, dl: (-i * 0.37).toFixed(2) + 's' })));
    kids.push(mk('lfx-p lfx-glow lfx-lamp', css({ x, y, w, h, dl: (-i * 0.53).toFixed(2) + 's' })));
    kids.push(mk('lfx-p lfx-fl lfx-lampfl', css({ x, y: y + h * 0.3, w: w * 0.32, h: w * 0.48, dl: (-i * 0.21).toFixed(2) + 's' })));
  });
  T.torch.forEach(([x, y, w, h], i) => {
    kids.push(mk('lfx-p lfx-halo green', css({ x, y, w: w * 3.2, h: h * 2.6, dl: (-i * 0.41).toFixed(2) + 's' })));
    kids.push(mk('lfx-p lfx-fl lfx-gfl', css({ x, y: y + h * 0.5, w: h * 0.8, h: h * 1.2, dl: (-i * 0.17).toFixed(2) + 's' })));
  });
  T.candle.forEach(([x, y, w, h], i) => {
    kids.push(mk('lfx-p lfx-halo candle', css({ x, y, w: w * 3.4, h: h * 2.6, dl: (-hsh(i, 1)).toFixed(2) + 's' })));
    kids.push(mk('lfx-p lfx-fl lfx-cf', css({ x, y: y + h * 0.5, w: h * 0.7, h: h * 1.05, du: (0.5 + (i % 3) * 0.09).toFixed(2) + 's', dl: (-hsh(i + 1, 1)).toFixed(2) + 's' })));
  });
  T.wisp.forEach(([x, y, rx, ry], i) => kids.push(mk('lfx-p lfx-wisp', css({ x, y, rx, ry, du: (15 + hsh(i, 8)).toFixed(1) + 's', dl: (-hsh(i + 2, 15)).toFixed(2) + 's' }))));
  return kids;
}

/** 해골 좀비 (6초) : 흙 들썩 → 초록 손이 땅을 뚫고 쑥 · 꿈틀 → 손이 쏙 들어가고 해골 좀비가 솟음 → 만세 콩콩
 *    → 와르르 뼈 더미(해골 · 뼈 튀어 떨어짐 · 먼지) → 뼈 · 흙이 땅속으로 가라앉아 없어짐 (투명하게 사라지지 않음)
 *  그림 = 전투 재미 요소와 같은 ai/fun/ hand_open · hand_wave(무덤 손) · rise(만세 해골) · bonepile · bone · skull · mound + 먼지 ai/fx/dust_* */
export const ZOMBIE_MS = 6000;
function gateZombie(T) {
  const [gx, gy, k, jx, jy] = T.gate;
  const x = Math.round(gx + rnd(-jx, jx)), y = Math.round(gy + rnd(-jy, jy));
  const dirt = Array.from({ length: 6 }, () => mk('lfx-gz-d', css({ vx: Math.round(rnd(-40, 40)), vy: Math.round(rnd(-56, -28)) })));
  const bones = [
    mk('lfx-gz-b skull', css({ vx: Math.round(rnd(-14, 14)), vh: 34, r: Math.round(rnd(-200, 200)) + 'deg' })),
    ...Array.from({ length: 5 }, (_, i) => mk('lfx-gz-b', css({ vx: Math.round((i - 2) * 15 + rnd(-6, 6)), vh: Math.round(rnd(14, 30)), r: Math.round(rnd(-420, 420)) + 'deg' }))),
  ];
  return [mk('lfx-p lfx-gz', css({ x, y, k }), [
    mk('lfx-gz-crack'),
    mk('lfx-gz-box', null, [mk('lfx-gz-hand'), mk('lfx-gz-z'), mk('lfx-gz-pile'), ...bones]),
    mk('lfx-gz-mound'),
    mk('lfx-gz-dust'),
    ...dirt,
  ]), ZOMBIE_MS + 100];
}
/** 하늘 손님 한 명 */
function guest(T, id) {
  const g = GUEST[id], y = Math.round(rnd(T.sky[0], T.sky[1]));
  const dir = id === 'boo' ? pick([1, -1]) : g.dir;
  return [mk('lfx-fly ' + (dir > 0 ? 'ltr' : 'rtl'), css({ y, du: g.ms / 1000 + 's', w: Math.round(g.w * g.k), h: Math.round(g.h * g.k) }), [
    mk('lfx-guest ' + id, `background-image:url(${AI}${g.src})`),
  ]), g.ms + 200];
}
/** 박쥐 떼 한 무리 */
function batFlock(T, kind) {
  const b = BATS[kind], n = Math.round(rnd(b.n[0], b.n[1])), y = Math.round(rnd(T.sky[0], T.sky[1] + 60));
  const dir = pick([1, -1]), ms = Math.round(rnd(9000, 13000));
  const bats = Array.from({ length: n }, (_, i) => mk('lfx-bat', css({
    ox: Math.round(i * 34 + rnd(-10, 10)), oy: Math.round(rnd(-40, 40)), s: (b.k * rnd(0.75, 1.15)).toFixed(2),
    w: b.w, h: b.h, fd: rnd(0.24, 0.36).toFixed(2) + 's', bd: (-rnd(0, 1.4)).toFixed(2) + 's',
  }) + `;--fa:url(${AI}${b.a});--fb:url(${AI}${b.b})`));
  return [mk('lfx-fly ' + (dir > 0 ? 'ltr' : 'rtl') + ' flock', css({ y, du: ms / 1000 + 's', w: 0, h: 0 }), bats), ms + 200];
}

/**
 * 재미 요소 층 깔기. 반환 = 정리 함수 (타이머 · 듣기 · 요소 전부 치움)
 * @param {HTMLElement} layer
 * @param {{ land?: boolean }} [opt]
 */
export function mountLobbyFx(layer, opt = {}) {
  if (!layer) return () => {};
  const mq = typeof matchMedia === 'function' ? matchMedia('(orientation: portrait)') : null;
  const calmQ = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const calm = () => !!calmQ?.matches;
  let land = typeof opt.land === 'boolean' ? opt.land : !mq?.matches;
  let root = null, alive = true;
  const timers = new Set(), live = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

  function build() {
    root?.remove();
    for (const n of live) n.remove();
    live.clear();
    const T = land ? LAND : PORT;
    root = mk('lfx ' + (land ? 'land' : 'port'), css({ dx: T.dx, dy: T.dy, gw: T.iw, gh: T.ih }) + `;--gl:url(${FX}${T.glow}_hi.webp);--gd:url(${FX}${T.glow}_lo.webp)`, staticSet(T));
    layer.appendChild(root);
  }
  /** 가끔 나오는 것 하나 붙였다가 시간이 다 되면 뗀다 (화면 밖으로 나갔거나 땅속으로 들어간 뒤) */
  function show([node, ms]) {
    if (!root) return;
    root.appendChild(node); live.add(node);
    later(() => { node.remove(); live.delete(node); }, ms);
  }
  const quiet = () => !alive || calm() || (typeof document !== 'undefined' && document.hidden) || !root;
  /* 감독 셋 : 각자 다음 차례를 예약하고, 화면이 안 보이거나 움직임 줄이기면 건너뛴다 */
  let gi = 0, bi = 0;
  const guestOrder = GUEST_ROUND.slice();
  /* 해골 좀비 : 한 번에 한 마리 · 사라지고 7~8초 뒤 다음 (안 보일 때는 7~8초 뒤 다시 봄) */
  function loopGrave() { if (!alive) return; const off = quiet(); if (!off) show(gateZombie(land ? LAND : PORT)); later(loopGrave, (off ? 0 : ZOMBIE_MS) + rnd(7000, 8000)); }
  function loopGuest() { if (!alive) return; later(loopGuest, rnd(15000, 25000)); if (!quiet()) show(guest(land ? LAND : PORT, guestOrder[gi++ % guestOrder.length])); }
  function loopBats() { if (!alive) return; later(loopBats, rnd(7000, 13000)); if (!quiet()) show(batFlock(land ? LAND : PORT, bi++ % 2 ? 'purple' : 'swarm')); }

  build();
  later(loopGrave, 3500);   // 들어오고 곧 첫 해골 좀비
  later(loopBats, 1500);
  later(loopGuest, 6000);

  /* 화면 방향이 바뀌면 그 방향 표로 다시 깐다 */
  const onTurn = () => { const nl = !mq.matches; if (nl !== land) { land = nl; build(); } };
  mq?.addEventListener?.('change', onTurn);
  /* 안 보일 때는 CSS 도 멈춤 (배터리) */
  const onVis = () => root?.classList.toggle('paused', document.hidden);
  document.addEventListener('visibilitychange', onVis);

  return function unmount() {
    alive = false;
    for (const t of timers) clearTimeout(t);
    timers.clear();
    mq?.removeEventListener?.('change', onTurn);
    document.removeEventListener('visibilitychange', onVis);
    for (const n of live) n.remove();
    live.clear();
    root?.remove(); root = null;
  };
}
