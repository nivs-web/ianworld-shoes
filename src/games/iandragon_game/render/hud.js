/**
 * 전투 HUD (B2 · 2026-11-11 야간) — 캔버스 위 DOM (오락실 규칙 «캔버스 글씨 금지» · 기획서 11.1).
 *
 *  위 : ⏸ · 스테이지 · 시간 · ×1/×2 · 불씨 / 내 기지 ♥ · 좀비 탑 ♥ · (보스 체력바)
 *  아래 : [화로] [용 덱 5~10] [스킬] [포효] [브레스]
 * 덱 버튼 = 용 얼굴(부품 그림의 head) + 값. 불씨 모자라면 어둡게 · 재생산 중이면 시계처럼 차오름 · 다 되면 번쩍.
 * 키보드 : 1~0 덱 · Q 화로 · 스페이스 브레스 · A/S 스킬 · R 포효 · P 일시정지
 */
import { UNITS } from '../data/units.js';
import { SKILLS } from '../data/skills.js';
import { ENEMIES } from '../data/enemies.js';
import { rotated, lockPref } from './rot.js';
import { enterFullscreen, exitFullscreen, isFullscreen } from '../../../core/fullscreen.js';
/** 이 브라우저에서 전체 화면을 쓸 수 있나 (아이폰 = API 없음 · 허락 없는 iframe = fullscreenEnabled false) */
const fsOk = () => { const e = document.documentElement; return !!(e.requestFullscreen || e.webkitRequestFullscreen) && document.fullscreenEnabled !== false && document.webkitFullscreenEnabled !== false; };
import { powerPage } from './powerPage.js';
import { soundPanel } from './soundPrefs.js';
const ATTR_KO = { ghost: '유령', giant: '거대', shadow: '그림자', crystal: '수정' };

const AI = '/assets/iandragon_game/ai/';
/** 기믹 설명 (아이 말투 · 계산기 GIM_KO 와 같은 뜻) */
const GIM = {
  gold: '황금 좀비가 나와요! 잡으면 코인이 듬뿍', race: '좀비 달리기 대회! 좀비가 빨라요', time: '시간 안에 좀비 탑을 무너뜨려요!',
  cap10: '용은 10마리까지만 나갈 수 있어요', cap8: '용은 8마리까지만 나갈 수 있어요', lock: '화로가 고장 났어요 — 화로를 못 올려요',
  rush: '보스가 줄줄이 나와요! 보스 러시', wind: '앞에서 거센 바람이 불어요 — 용들이 느리게 걸어요', fog: '안개 — 멀리 있는 좀비가 잘 안 보여요',
  cost: '불씨 300 이하인 용만 나갈 수 있어요', money: '용돈 듬뿍! 불씨를 많이 들고 시작해요', fever: '불꽃 타임이 빨리 와요',
};
const ZART = { chubby: 'cone', shield: 'helmet', bossFat: 'bossGiant' };
const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
const UI = '/assets/iandragon_game/ui/';
/** 떠 있는 HUD : 위 · 아래 띠 판 없이 단추만 (CSS .idg-hud.float) */
const FLOAT_HUD = true;
/**
 * 확대 (11/11 대표님 «시작은 전체 화면 → 캐릭터 · 좀비가 나오고 몇 초 뒤 1.1배로 · 바닥은 단추 높이만큼만»)
 * 잘라 낼 칸 : 위 하늘 CROP.top · 아래 흙 CROP.bottom (합 49칸 = 540/491 ≈ 1.1배). 전투 ZOOM_AT 초부터 ZOOM_DUR 초 동안 부드럽게.
 * 개발 서버에서만 window.__idgCropTop 으로 위쪽 칸을 바꿔 비교할 수 있다.
 */
const CROP = { top: 33, bottom: 16 }, ZOOM_AT = 5, ZOOM_DUR = 1.2;   /* 아래는 단추와 땅 줄 사이 여백이 남게 */
const cropTop = () => (import.meta.env?.DEV && window.__idgCropTop != null ? window.__idgCropTop : CROP.top);
/** 아이콘 그림 (없으면 글자 fallback) */
const ico = (name, alt) => { const i = h('img', 'ico'); i.src = `${UI}${name}.png`; i.alt = alt; i.draggable = false; i.onerror = () => { i.replaceWith(h('span', 'ico-t', alt)); }; return i; };
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** cb = { cmd({type,i}), pause(), speed(), exit(), retry(), next() } */
export function createHud(host, { stage, deck, skills, text, speedMax = 2, canAuto = false, leader = null, foeDeck = null, foeLeader = null, cons = null, consOff = false, talk = null, isNet = false }, cb) {
  let useCons = null;   // 시작 카드에서 고른 편의품
  const root = h('div', 'idg-hud' + (FLOAT_HUD ? ' float' : '')); host.appendChild(root);
  /* 대표님 «PC 에서 위 글씨 · 숫자가 너무 작다» (11/11) : HUD 전체를 화면 크기에 맞춰 키운다 (폰 가로 = 1 · PC 1280×800 ≈ 1.33 · 최대 1.7) */
  /* 2026-11-11 대표님 태블릿 «아래 단추가 사라진다» : CSS zoom 은 옛 크롬 · 삼성 인터넷에서 크기 계산이 달라 HUD 가 화면보다 커지며 아래가 잘렸다
   * → 어느 브라우저든 같은 transform 확대 (상자 크기를 1/z 로 줄이고 z 배로 키움 = 늘 화면에 꼭 맞음) */
  const fitHud = () => {
    const port = host.clientHeight > host.clientWidth * 1.05;   /* 세로 : 폭 520 · 높이 900 기준 (세로 태블릿에서 창 · 단추가 너무 작지 않게) */
    const z = Math.round(Math.max(1, Math.min(1.7, host.clientWidth / (port ? 520 : 960), host.clientHeight / (port ? 900 : 540))) * 100) / 100;
    Object.assign(root.style, { zoom: '', transformOrigin: '0 0', transform: z === 1 ? '' : `scale(${z})`, width: z === 1 ? '' : `${100 / z}%`, height: z === 1 ? '' : `${100 / z}%`, right: z === 1 ? '' : 'auto', bottom: z === 1 ? '' : 'auto' });
  };
  /* 위 · 아래 띠 높이를 캔버스에 알려 전장이 띠에 가리지 않게 한다 (app.js 'idg-insets') */
  let zoomK = 0, userZ = null;   /* 0 = 전체 화면 · 1 = 확대 끝 · 1 넘게 = 손으로 더 확대 (userZ = 손가락 · 휠로 고른 값, 고르면 시작 확대 애니메이션 대신 이것) */
  const ZMAX = 2.5;   /* 확대 한도 ≈ 1.36배 (대표님 «냥코처럼 맵 확대 · 축소» · 너무 커지지 않게) */
  const cropOf = (z) => ({ top: Math.round(z <= 1 ? cropTop() * z : cropTop() + 60 * (z - 1)), bottom: Math.round(CROP.bottom * Math.min(z, 1.5)), z });   /* 1 넘게는 하늘을 더 자르고 땅 · 단추 자리는 거의 그대로 */
  const sendIns = () => requestAnimationFrame(() => {
    const H = host.getBoundingClientRect(), tb = root.querySelector('.idg-top')?.getBoundingClientRect(), bb = root.querySelector('.idg-bot')?.getBoundingClientRect();
    if (!tb || !bb) return;
    /* 떠 있는 HUD (11/11 대표님 «위 · 아래 띠가 게임 화면을 가린다 · 단추는 공중에 떠 있게») : 띠 판이 없으니 캔버스는 화면 전체 — 띠 높이를 0 으로 알린다 */
    host.dispatchEvent(new CustomEvent('idg-insets', { detail: FLOAT_HUD ? { t: 0, b: 0, f: { ...cropOf(zoomK), bar: Math.round(Math.max(0, H.bottom - bb.top)), hudTop: Math.round(Math.max(0, (root.querySelector('.idg-hp')?.getBoundingClientRect().bottom ?? H.top) - H.top) + 12) } } : { t: Math.max(0, tb.bottom - H.top), b: Math.max(0, H.bottom - bb.top) } }));
  });
  const onRs = () => { fitHud(); sendIns(); };
  fitHud(); window.addEventListener('resize', onRs);
  /* 위 */
  const top = h('div', 'idg-top'); root.appendChild(top);
  const pauseB = h('button', 'idg-btn idg-pause', '⏸'); pauseB.type = 'button'; pauseB.onclick = () => cb.pause();
  const title = h('div', 'idg-title', `${stage.id} ${stage.name}`);
  const time = h('div', 'idg-time', '0:00');
  const speedB = h('button', 'idg-btn idg-speed', '2배속');   /* 동그라미 «2배속» (대표님 11/11 · X 없이 한글) — 켜지면 불이 들어온다 */ speedB.type = 'button'; speedB.onclick = () => cb.speed();
  const money = h('div', 'idg-money'); const moneyN = h('span', 'n', '0'); money.append(h('i', 'idg-ico-ember'), moneyN);
  /* 소리 단추 (대표님 «게임하면서 배경음 · 효과음을 켜고 끄는 단추») */
  /* 소리 단추는 화면에서 뺐다 — 일시정지 · 로비 «더보기 → 음향 설정» (대표님 11/11) */
  const fsB = h('button', 'idg-btn idg-fs'); fsB.type = 'button'; fsB.title = '꽉 찬 화면';
  /* 글자(⛶)는 글꼴마다 위로 쏠려 보였다 (대표님 3차) → 정사각 도트 그림(네 귀퉁이)을 단추 정가운데에 */
  /* 그림은 CSS(일시정지와 같은 판 · 같은 자리) · 전체 화면이면 «나가기» 그림으로 (대표님 «가로에서 전체화면 · 일시정지 단추가 이상하다») */
  const fsDraw = () => fsB.classList.toggle('on', !!(document.fullscreenElement || document.webkitFullscreenElement));
  document.addEventListener('fullscreenchange', fsDraw); document.addEventListener('webkitfullscreenchange', fsDraw); fsDraw();
  /* 누르는 그 순간(사용자 누름 안)에 바로 요청 · 들어가면 가로 잠금(안드로이드는 전체 화면이어야 잠금이 먹는다) · 실패해도 게임은 그대로 (11/12)
   * 전체 화면 API 가 아예 없는 곳(아이폰 사파리 · 아이폰 크롬/네이버 = 웹킷)이나 막힌 곳(document.fullscreenEnabled === false : 허락 없는 iframe · 일부 앱 안 브라우저)은 단추를 숨긴다 (눌러도 아무 일이 없어 «안 된다»로 보였다) */
  fsB.onclick = () => { if (isFullscreen()) exitFullscreen(); else enterFullscreen().then((ok) => { if (ok) lockPref(); }); };
  if (!fsOk()) fsB.style.visibility = 'hidden';
  /* 전투로 들어가는 단추(출격! · 다시하기 · 전투개시! · 다음 판 — 결과 창 · 파워업 · 일시정지 모두 cb 를 부른다) = 누르는 순간 전체 화면 요청 (11/12 대표님 «무조건 전체 화면» · 이미 전체 화면이면 그대로) */
  for (const k of ['go', 'retry', 'next']) { const f = cb[k]; if (typeof f === 'function') cb[k] = (...a) => { if (!isFullscreen()) enterFullscreen().then((ok) => { if (ok) lockPref(); }); return f(...a); }; }
  /* 오른쪽 위 끝 = 2배속 · 그 왼쪽 = 전체 화면 (대표님 11/11 «가운데 배속 단추는 별로 · 맨 오른쪽 위를 2배속으로») */
  top.append(pauseB, title, time, money, fsB, speedB);   /* ⛶ 꽉 찬 화면 (대표님 «브라우저 아래 줄이 갑자기 나와 가린다») */
  if (speedMax < 2 || isNet) speedB.style.visibility = 'hidden';   // 멀티는 1배속 고정
  if (isNet) { pauseB.textContent = '✕'; pauseB.title = '나가기'; pauseB.onclick = () => { if (window.confirm('정말 나갈까요? 친구는 혼자 계속해요.')) cb.exit(); }; }   // 멀티는 멈출 수 없다 (기획 5장)
  const autoB = h('button', 'idg-btn idg-speed idg-auto', '자동'); autoB.type = 'button'; autoB.onclick = () => cb.auto(); if (canAuto) speedB.after(autoB);
  const hp = h('div', 'idg-hp'); root.appendChild(hp);
  const myHp = h('div', 'idg-hp-me'), foeHp = h('div', 'idg-hp-foe');
  /* 성 체력 게이지 (그림 담당 hp_castle_* · 숫자 옆) */
  const myBar = h('i', 'idg-cbar'), foeBar = h('i', 'idg-cbar'); myBar.appendChild(h('b')); foeBar.appendChild(h('b'));
  const myWrap = h('div', 'idg-hp-side me'), foeWrap = h('div', 'idg-hp-side foe'); myWrap.append(myHp, myBar); foeWrap.append(foeBar, foeHp);
  hp.append(myWrap, foeWrap);
  const boss = h('div', 'idg-boss'); const bossFill = h('i'); boss.append(h('span', null, '보스'), h('b', null, '')); boss.lastChild.appendChild(bossFill); root.appendChild(boss);
  const warn = h('div', 'idg-warn', 'WARNING'); root.appendChild(warn);
  /* 보스 이름 띠 : 보스가 새로 나오면 1.2초(bossFx.js CUT_TIME) 보여 주고, 그 뒤에 WARNING 을 켠다 (처음 보스만) */
  const bname = h('div', 'idg-bossname'); const bnameT = h('b'); bname.appendChild(bnameT); root.appendChild(bname);
  let bossRef = null, nameT = 0, warnT = 0, bossCount = 0, lastNow = performance.now();
  /* 미니맵 (기획서 11.1) : ▲ 내 맨 앞 · ▼ 적 맨 앞 · 네모 = 지금 보는 곳. 누르면 그 자리로 */
  const mini = h('div', 'idg-mini'), miniView = h('i', 'view'), miniMe = h('b', 'me', '▲'), miniFoe = h('b', 'foe', '▼');
  mini.append(miniView, miniMe, miniFoe); root.appendChild(mini);
  mini.onpointerdown = (e) => { const r = mini.getBoundingClientRect(); const rt = rotated(); cb.look?.(rt === 'cw' ? (e.clientY - r.top) / r.height : rt === 'ccw' ? (r.bottom - e.clientY) / r.height : (e.clientX - r.left) / r.width); };
  const tip = h('div', 'idg-tip'); root.appendChild(tip);
  const net = h('div', 'idg-net'); root.appendChild(net);   // 멀티 : 상대 기다리는 중
  const mate = h('div', 'idg-mate'); root.appendChild(mate);
  const bubble = h('div', 'idg-talk'); root.appendChild(bubble);   // 상대 빠른 말
  if (talk) {   /* 빠른 말 서랍 : 💬 누르면 4개가 펼쳐진다 */
    const drawer = h('div', 'idg-talk-drawer'), open = h('button', 'idg-btn idg-talk-open', '💬'); open.type = 'button';
    const list = h('div', 'idg-talk-list');
    for (const t of talk) { const b = h('button', 'idg-btn', t); b.type = 'button'; b.onclick = () => { cb.talk?.(t); list.classList.remove('on'); }; list.appendChild(b); }
    open.onclick = () => list.classList.toggle('on');
    drawer.append(open, list); root.appendChild(drawer);
  }   // 멀티 친구 띠 (멀티 기획 5장) : 같이 깨기 = 친구 화로 · 브레스 준비 / 대결 = 상대 화로 레벨만

  /* 아래 */
  const bot = h('div', 'idg-bot'); root.appendChild(bot);
  const wallet = h('button', 'idg-btn idg-wallet'); wallet.type = 'button'; wallet.onclick = () => cb.cmd({ type: 'wallet' });
  const wLv = h('b', null, 'Lv1'), wCost = h('span', null, '');
  wallet.append(h('i', 'idg-ico-furnace'), wLv, wCost);
  const deckBox = h('div', 'idg-deck' + (deck.length > 5 ? ' two' : ''));
  const dbtn = deck.map((d, i) => {
    const b = h('button', 'idg-btn idg-unit'); b.type = 'button';
    const img = h('img'); img.src = `${AI}${d.id}/head.png`; img.alt = UNITS[d.id]?.name || d.id; img.draggable = false;
    const cost = h('span', 'cost', String(UNITS[d.id]?.cost ?? '')); const cd = h('i', 'cd'); const key = h('em', 'key', String((i + 1) % 10));
    b.append(img, cd, cost, key); b.onclick = () => cb.cmd({ type: 'spawn', i }); deckBox.appendChild(b);
    return { b, cd, ready: true };
  });
  const right = h('div', 'idg-right');
  /* 스킬 (대표님 «운석 단추가 뭘 하는지 모르겠고 자리가 이상하다 · 다 쓰면 투명해져 뒤 숫자가 비친다» · 11/11)
   *  → 아래 띠 안 브레스 왼쪽 둥근 단추 : 아이콘 + 이름 + 남은 횟수 배지 + 재충전 시계. 길게 누르거나 올려 두면 설명. 다 쓰면 «다 씀» 회색. */
  const sk = skills.map((id, i) => {
    const def = SKILLS[id] || {}, b = h('button', 'idg-btn idg-skill'); b.type = 'button'; b.title = `${def.name || id} : ${def.line || ''} (한 판에 ${def.charges || 1}번)`;
    const cdI = h('i', 'cd'), n = h('em', 'n', String(def.charges || 1));
    b.append(ico(`hud_skill_${id}`, (def.name || id).slice(0, 2)), cdI, h('b', 'nm', def.name || id), n);
    b.onclick = () => cb.cmd({ type: 'skill', i }); right.appendChild(b); b._cd = cdI; b._n = n; return b;
  });
  const rage = h('button', 'idg-btn idg-rage', '으르렁!'); rage.type = 'button'; rage.onclick = () => cb.cmd({ type: 'rage' }); right.appendChild(rage);
  const breath = h('button', 'idg-btn idg-breath'); breath.type = 'button'; breath.onclick = () => cb.cmd({ type: 'breath' }); breath.onpointerdown = () => cb.aim?.(true); breath.onpointerleave = breath.onpointerup = () => cb.aim?.(false);   /* 누르고 있는 동안 전장에 브레스 사거리 (대표님 11/11) */
  const bFill = h('i', 'fill'); breath.append(bFill, h('b', null, '브레스'));
  bot.append(wallet, deckBox, right, breath);
  /*
   * 세로 전투 (11/12 대표님 «단추가 싸움을 가리면 안 된다») : 둥근 단추(브레스 · 스킬 · 으르렁)를 전장 위 오른쪽 벽에 띄우지 않고 카드 줄 안으로.
   * 6칸 격자 — 카드(화로 + 용) 뒤 마지막 줄의 빈 칸을 오른쪽부터 [브레스(카드 한 칸 크기 · 가장 크게) → 스킬 → 으르렁] 순서로 채우고,
   * 모자라면 남은 것은 카드 줄 위 얇은 한 줄(오른쪽부터)로. 자리는 판마다 한 번 정한다(으르렁은 꺼져도 자리를 비워 둬 줄 높이가 출렁이지 않게).
   * 값은 CSS 변수(--gr 줄 · --gc 칸)로만 주고 세로 CSS(iandragon-game.css «세로 전투 4차»)에서만 쓴다 — 가로는 예전 그대로.
   */
  {
    const COLS = 6, cards = [wallet, ...dbtn.map((q) => q.b)], rows = Math.ceil(cards.length / COLS), free = rows * COLS - cards.length;
    const round = [breath, ...sk.slice().reverse(), rage], top = round.length > free ? 1 : 0;
    cards.forEach((e, k) => { e.style.setProperty('--gr', String(top + 1 + Math.floor(k / COLS))); e.style.setProperty('--gc', String((k % COLS) + 1)); });
    round.forEach((e, j) => { const inGrid = j < free; e.style.setProperty('--gr', String(inGrid ? top + rows : 1)); e.style.setProperty('--gc', String(COLS - (inGrid ? j : j - free))); e.classList.toggle('in-row', !inGrid); });
    bot.classList.toggle('has-act', !!top);
  }
  sendIns(); setTimeout(sendIns, 300);   // 글꼴 · 그림이 늦게 와서 높이가 바뀔 수 있다   // 스킬 · 포효 = 아래 띠 안 브레스 왼쪽 (예전 오른쪽 위는 좀비 성 체력 숫자를 가렸다)

  /** 일시정지 판의 소리 설정 : 배경음 · 효과음 각각 켜기 + 크기 */
  /** 일시정지 판의 «음향 설정» (로비 더보기와 같은 판 · soundPrefs.js) */
  const soundBox = () => soundPanel(h, () => cb.soundRefresh?.());

  /* 일시정지 · 결과 판 */
  const panel = h('div', 'idg-panel-over'); root.appendChild(panel);

  /* ── 새 결과 창 (대표님 11/12 · 부품 조립판 3차) ──
   *  틀 = 우리 창 테(dialog9 · 호박 모서리) · 위 = 장면 그림 칸(용들이 트로피 들고 환호 · 가리지 않게) · 날개 현판이 그림 아래 끝에 걸침
   *  단추 · 판 = 대표님 시안을 글자 없이 다시 그린 제미나이 부품(btn_red · btn_green · btn_purple · plate_reward · plate_new)
   *  아이콘 = 칼 · 화살표 하나(제미나이) · 다시하기 · 나가기(흰 SVG) · 코인(새 금화) · 젬(우리 icon_gem_v3) · 글씨 = 굵은 글꼴 + 단단한 외곽선 */
  const RES = '/assets/iandragon_game/ai/result/';
  const fontOnce = () => { if (document.getElementById('idg-res-font')) return; const l = document.createElement('link'); l.id = 'idg-res-font'; l.rel = 'stylesheet'; l.href = 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css'; document.head.appendChild(l); };
  function resultCard(kind, info) {
    fontOnce();
    const win = kind === 'win', card = h('div', `idg-card idg-res ${win ? 'win' : 'lose'}`);
    const img = (src, cls, alt = '') => { const i = h('img', cls); i.src = src; i.alt = alt; i.draggable = false; return i; };
    /* 11/12 대표님 : 그림이 창의 절반 넘게 · 현판은 용 머리 위 · 별은 용 아래 · 그림은 보상 판 가운데 줄(양 끝 뾰족한 곳)까지 내려와 금 줄로 끝남 */
    const scene = h('div', 'idg-res-scene'), body = h('div', 'idg-res-body');
    scene.appendChild(img(`${RES}${win ? 'banner_win' : 'banner_lose'}.webp`, 'idg-res-banner', win ? '승리!' : '패배'));
    { const st = h('div', 'idg-res-stars' + (info.diff === 'hard' ? ' red' : info.diff === 'master' ? ' purple' : '')); for (let i = 0; i < 3; i++) { const on = win && i < info.stars,   /* 패배 = 꺼진 별 3개 (11/12 대표님) */ w = h('span', 'star' + (on ? ' on' : '')), s = img(`${RES}${on ? 'star_on' : 'star_off'}.webp`); w.style.animationDelay = `${0.25 + i * 0.3}s`; w.appendChild(s); st.appendChild(w); } scene.appendChild(st); }
    /* 보상 판 (칸막이 2개 = 3칸) */
    const bar = h('div', 'idg-res-bar'), cell = (src, txt) => { const c = h('div', 'cell'); c.append(img(src), h('b', null, txt)); return c; };
    bar.append(cell(`${RES}timer.webp`, clock(info.t || 0)), cell(`${RES}coin_crown.webp`, `+${fmt(info.coins || 0)}`), cell('/assets/iandragon_game/ui/lobby/icon_gem_v3.png', `+${info.gems || 0}`));   /* 승리 · 패배 모두 : 시간 → 동전 → 젬 (11/12 대표님 «다른 배치는 없어») */
    body.appendChild(bar);
    /* 새로 열림 판 (승리) · 도움말 판 (패배) */
    const extra = win ? (info.unlocks ? info.unlocks.join(' · ') : info.daily ? '오늘 첫 승리 보너스 : 젬 +10' : '') : (info.hint || '파워업에서 용을 키우면 더 쉬워져요!');
    if (extra) { const nw = h('div', 'idg-res-new' + (win ? '' : ' is-tip')); nw.append(h('em', null, win ? (info.unlocks ? '새로 열림 :' : '보너스 :') : '도움말 :'), h('span', null, extra)); bar.appendChild(nw); bar.classList.add('has-new'); }   /* 보상 판 바로 아래에 붙은 꼬리표 (따로 떨어진 칸 아님) */
    if (info.final) body.appendChild(h('p', 'idg-res-final', '좀비 드래곤 로드를 물리쳤어요! 모든 모험 끝 — 고마워요!'));
    /* 단추 규칙 (대표님 11/11) : 승리 = 전투개시! + 파워업 / 다시하기 · 나가기 (작고 밋밋하게) · 패배 = 다시하기 + 파워업 / 나가기 */
    const btn = (label, ico, fn, cls) => { const b = h('button', 'idg-res-btn ' + cls); b.type = 'button'; b.append(img(`${RES}${ico}`, 'ico'), h('span', null, label)); b.onclick = fn; return b; };
    const r1 = h('div', 'idg-res-row big'), r2 = h('div', 'idg-res-row');
    const next = win && info.hasNext;
    r1.appendChild(next ? btn('전투개시!', 'ico_fight.webp', () => cb.next(), 'red') : btn('다시하기', 'ico_retry.svg', () => cb.retry(), 'red'));
    if (cb.puSave) r1.appendChild(btn('파워업', 'ico_power_n.webp', () => showPanel('powerup', { back: kind, backInfo: info }), 'green'));
    if (next) r2.appendChild(btn('다시하기', 'ico_retry.svg', () => cb.retry(), 'purple'));
    r2.appendChild(btn(text.exit, 'ico_exit.svg', () => cb.exit(), 'purple'));
    body.append(r1, r2);
    card.append(scene, body);
    return card;
  }

  function showPanel(kind, info = {}) {
    panel.replaceChildren();
    if (kind === 'powerup') {   /* 판 사이 파워업 (powerPage.js) — 돌아가기 = 방금 결과 창 */
      /* 한 페이지 파워업 (powerPage.js · 대표님 «한 페이지에서 슬롯 끼고 빼고 업글») */
      const back = () => showPanel(info.back, info.backInfo);
      const btns = info.back === 'win' && info.backInfo?.hasNext ? [['전투 개시!', () => cb.next(), 'main big'], ['돌아가기', back]] : [['다시하기', () => cb.retry(), 'main big'], ['돌아가기', back]];
      panel.appendChild(powerPage(h, { save: cb.puSave, write: cb.puWrite, leader, buttons: btns, cls: 'idg-card idg-pp' }));
      panel.classList.add('on'); return;
    }
    const box = h('div', 'idg-card');
    if (kind === 'pause') { box.append(h('h2', null, '일시정지')); box.appendChild(soundBox()); }
    else if (kind === 'intro' && stage.raid) {   /* 주간 습격 카드 */
      box.append(h('h2', null, '좀비 습격'), h('p', 'small', `${stage.raid} · 20초마다 웨이브 · 점점 세져요 · 5웨이브마다 보스`), h('p', 'small', '모두 같은 조건 : 내 덱 6칸 · 모두 Lv20 · 연구소/보물 없음'));
    }
    else if (kind === 'intro' && stage.pvp) {   /* 용 대결 카드 : 양쪽 덱 · 리더 공개 */
      box.append(h('h2', null, '용 대결!'));
      const face = (list, ld) => { const z = h('div', 'idg-intro-z'); for (const id of [ld, ...list.map((d) => d.id)].filter(Boolean)) { const im = h('img'); im.src = `${AI}${id}/head.png`; im.alt = ''; im.onerror = () => { im.onerror = null; im.style.display = 'none'; }; z.appendChild(im); } return z; };
      box.append(h('p', 'small', '나'), face(deck, leader), h('p', 'small', 'VS 친구'), face(foeDeck || [], foeLeader));
      box.append(h('p', 'small', '상대 둥지를 먼저 무너뜨리면 승리 · 3분 · 90초부터 불꽃 타임 · 모두 Lv20'));
    }
    else if (kind === 'intro') {   /* 스테이지 카드 (기획서 11.4) : 이름 · 기믹 · 오늘의 좀비 · 별 조건 */
      box.append(h('h2', null, `${stage.id} ${stage.name}`));
      if (stage.diff && stage.diff !== 'normal') box.append(h('p', 'idg-diff ' + stage.diff, stage.diff === 'hard' ? '어려움 — 붉은 별 · 출전 드래곤 Lv21 이상' : stage.diff === 'master' ? `초고수 — 보라 별 · ${stage.limit}초 · 부화 «+» · 편의품은 안 통해요` : '쉬움 — 좀비가 약해요 · 별은 2개까지'));
      if (stage.gim && GIM[stage.gim]) box.append(h('p', 'gim', GIM[stage.gim]));
      const zs = h('div', 'idg-intro-z');
      for (const tr of [...new Set(stage.lines.flatMap((l) => (ENEMIES[l.id]?.traits || []).filter((t) => ['ghost', 'giant', 'shadow', 'crystal'].includes(t))))]) { const ic = h('img', 'idg-attr'); ic.src = `/assets/iandragon_game/ui/hud_attr_${tr}_s.png`; ic.alt = ''; ic.title = ATTR_KO[tr]; ic.onerror = () => { ic.style.display = 'none'; }; zs.appendChild(ic); }   // 이 판의 특별한 좀비 (유령 · 거대 · 그림자 · 수정)
      for (const id of [...new Set(stage.lines.map((l) => l.id))]) { const im = h('img'); im.src = `${AI}${ZART[id] || id}/head.png`; im.alt = ''; im.onerror = () => { im.onerror = null; im.src = `${AI}${ZART[id] || id}/torso.png`; }; zs.appendChild(im); }   // 머리 조각이 없는 좀비(박쥐)는 몸 그림
      box.append(zs, h('p', 'small', `★ 깨면 · ★★ ${stage.star2}초 안에 · ★★★ ${stage.star3}초 안에`));
    }
    else if ((kind === 'win' || kind === 'lose') && !info.pvp && !isNet && !stage.raid) {   /* 새 결과 창 (대표님 11/12 시안) */
      panel.appendChild(resultCard(kind, info)); panel.classList.add('on'); return;
    }
    else {
      box.append(h('h2', kind === 'win' ? 'win' : 'lose', info.title || (kind === 'win' ? '승리!' : '아쉬워요…')));
      if (info.pvp) { box.append(h('p', null, `${clock(info.t || 0)} · 코인 +${fmt(info.coins || 0)}`), h('p', 'small', info.rec || '')); if (info.hint) box.append(h('p', 'hint', info.hint)); }
      else if (kind === 'win') { const st = h('div', 'idg-stars' + (info.red ? ' red' : info.purple ? ' purple' : '')); for (let i = 0; i < 3; i++) { const s = h('span', i < info.stars ? 'on' : '', '★'); s.style.animationDelay = `${0.3 + i * 0.35}s`; st.appendChild(s); } box.appendChild(st); }
      if (!info.pvp) box.append(h('p', null, `${clock(info.t || 0)}${kind === 'win' && info.coins ? ` · 코인 +${fmt(info.coins)}` : ''}${kind === 'win' && info.gems ? ` · 젬 +${info.gems}` : ''}${info.daily ? ' (오늘 첫 승리 +10)' : ''}${info.gold ? ` · 황금 좀비 +${fmt(info.gold)}` : ''}`));
      if (kind === 'lose' && info.hint && !info.pvp) box.append(h('p', 'hint', info.hint));
    }
    const row = h('div', 'idg-row');
    const add = (label, fn, cls = '') => { const b = h('button', 'idg-btn ' + cls, label); b.type = 'button'; b.onclick = fn; row.appendChild(b); };
    if (kind === 'pause' && !info.pvp && !isNet) {   /* 일시정지 단추 (대표님 11/11 밤) : «계속» 한 줄 꽉 · 아래 «다시하기 · 나가기» */
      const rows = h('div', 'idg-rows'), line = (...bs) => { const r = h('div', 'idg-row'); for (const [label, fn, cls] of bs) { const b = h('button', 'idg-btn ' + (cls || ''), label); b.type = 'button'; b.onclick = fn; r.appendChild(b); } rows.appendChild(r); };
      line(['계속', () => cb.pause(), 'main big']); line(['다시하기', () => cb.retry()], [text.exit, () => cb.exit()]);
      box.appendChild(rows); panel.appendChild(box); panel.classList.add('on'); return;
    }
    if (kind === 'pause') add('계속', () => cb.pause(), 'main');
    if (kind === 'intro' && cons && cons.length) {   /* 편의품 (판마다 1개) */
      const cr = h('div', 'idg-cons-row');
      const draw = () => cr.replaceChildren(h('span', null, '편의품'), ...cons.map((c) => { const b = h('button', 'idg-cons' + (useCons === c.id ? ' on' : ''), `${c.name} ×${c.n}`); b.type = 'button'; b.disabled = consOff; /* 초고수 = 회색 · 못 누름 */ b.onclick = () => { useCons = useCons === c.id ? null : c.id; draw(); }; return b; }));
      draw(); box.appendChild(cr);
    }
    if (kind === 'intro') { add('출격!', () => cb.go(useCons), 'main'); add(text.exit, () => cb.exit()); box.appendChild(row); panel.appendChild(box); panel.classList.add('on'); return; }
    if (info.unlocks) box.append(h('p', 'final', `새로 열림 : ${info.unlocks.join(' · ')}`));
    if (info.final) box.append(h('p', 'final', '좀비 드래곤 로드를 물리쳤어요! 모든 모험 끝 — 고마워요! 🐉'));
    /* 판 사이 기지 — 단추 세 줄 (대표님 11/11) : ① 전투 개시(승리) · 다시 하기(패배) ② 파워 업 ③ 다시 하기 + 나가기 (패배는 나가기만) */
    const base = (kind === 'win' || kind === 'lose') && !info.pvp && !isNet && !stage.raid;
    if (base) {
      const rows = h('div', 'idg-rows'), line = (...bs) => { const r = h('div', 'idg-row'); for (const [label, fn, cls] of bs) { const b = h('button', 'idg-btn ' + (cls || ''), label); b.type = 'button'; b.onclick = fn; r.appendChild(b); } rows.appendChild(r); };
      const win = kind === 'win' && info.hasNext;
      line(win ? ['전투 개시!', () => cb.next(), 'main big'] : ['다시하기', () => cb.retry(), 'main big']);
      if (cb.puSave) line(['파워 업', () => showPanel('powerup', { back: kind, backInfo: info }), 'pu big']);
      line(...(win ? [['다시하기', () => cb.retry()], [text.exit, () => cb.exit()]] : [[text.exit, () => cb.exit()]]));
      box.appendChild(rows); panel.appendChild(box); panel.classList.add('on'); return;
    }
    if (kind === 'win' && info.hasNext && !info.pvp && !isNet) add('전투 개시!', () => cb.next(), 'main big');   /* 다음 판 */
    if (isNet) add('한 판 더 (같은 방)', () => cb.rejoin(), 'main');
    else if (!info.pvp || stage.raid) add('다시하기', () => cb.retry(), kind === 'lose' ? 'main big' : '');
    add(text.exit, () => cb.exit());
    box.appendChild(row); panel.appendChild(box); panel.classList.add('on');
  }

  /* 키보드 */
  const onKey = (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (/^[0-9]$/.test(k)) { const i = k === '0' ? 9 : Number(k) - 1; if (i < deck.length) cb.cmd({ type: 'spawn', i }); }
    else if (k === 'q') cb.cmd({ type: 'wallet' });
    else if (k === ' ') { e.preventDefault(); cb.cmd({ type: 'breath' }); }
    else if (k === 'a') cb.cmd({ type: 'skill', i: 0 });
    else if (k === 's') cb.cmd({ type: 'skill', i: 1 });
    else if (k === 'r') cb.cmd({ type: 'rage' });
    else if (k === 'p') cb.pause();
  };
  window.addEventListener('keydown', onKey);

  return {
    /** 맵 확대 · 축소 (전장 두 손가락 · 휠) : d > 0 확대 */
    /* 세로 : 최소 = 전장 높이가 아래 단추 줄 위를 꽉 채우는 배율(z 1) — 더 작게 줄면 손톱만 해지고 아래에 붙었다 (대표님 11/11) */
    /* 세로 (대표님 11/11 밤) : 줄이기는 넓게(0)까지 · 키우기는 조금만(1.35) — 너무 크게 키우면 전혀 다른 게임 같다 */
    /* 세로 (대표님 11/11 밤 다시) : 가장 작게 = 성 체력 게이지 아래 여백 ~ 용 카드 줄 위를 꽉 채우는 크기(z 1) · 키우기는 예전처럼 크게 */
    zoomBy(d) { if (!FLOAT_HUD) return; const port = host.clientHeight > host.clientWidth * 1.05; userZ = Math.max(port ? 1 : 0, Math.min(ZMAX, (userZ ?? zoomK) + d)); },
    update(S, ui) {
      const p = S.players[ui.me || 0], W = S.D.wallet;
      if (FLOAT_HUD) { const z = Math.min(1, Math.max(0, (S.t - ZOOM_AT) / ZOOM_DUR)), e = userZ ?? (host.clientHeight > host.clientWidth * 1.05 ? 1 : z * z * (3 - 2 * z));   /* 세로 : 처음부터 중간 확대 (대표님 11/11 밤 «꽉 차게 크게 하니 전체 그림이 안 나와 다른 게임 같다») */ if (Math.abs(e - zoomK) > 0.03 || (e === 1 && zoomK !== 1) || (e === 0 && zoomK !== 0)) { zoomK = e; sendIns(); } }
      if (ui.net && S.players.length > 1) {
        const o = S.players[(ui.me || 0) === 0 ? 1 : 0], foe = o.side !== p.side;
        mate.textContent = foe ? `상대 화로 Lv${o.wl + 1}` : `친구 화로 Lv${o.wl + 1}${o.breathT >= o.breathCharge ? ' · 브레스 준비!' : ''}`;
        mate.classList.add('on'); mate.classList.toggle('foe', foe);
        const say = ui.talk ? `${foe ? '상대' : '친구'} : ${ui.talk}` : ui.myTalk ? `나 : ${ui.myTalk}` : '';
        bubble.textContent = say; bubble.classList.toggle('on', !!say); bubble.classList.toggle('mine', !ui.talk && !!ui.myTalk);
      }
      net.textContent = ui.netNote || (ui.netWait > 1.5 ? '연결 확인 중…' : ''); net.classList.toggle('on', !!ui.netNote || ui.netWait > 1.5);
      const lim = S.stage.gim === 'time' ? S.stage.limit : 0;
      time.textContent = S.stage.raid ? `웨이브 ${Math.max(1, Math.min(40, Math.floor((S.t - 3) / 20) + 1))} · ${clock(S.t)}` : lim ? `남은 ${clock(Math.max(0, lim - S.t))}` : clock(S.t); time.classList.toggle('hurry', !!lim && lim - S.t < 20);
      moneyN.textContent = `${fmt(p.money)} / ${fmt(W[p.wl].max * p.B.walletMax)}`;
      const sd = ui.side || 0;   // 대결 오른쪽 편 = 내 둥지는 1번
      myHp.textContent = ` ${fmt(Math.max(0, S.base[sd].hp))}`;
      foeHp.textContent = S.stage.raid ? '∞ ' : `${fmt(Math.max(0, S.base[1 - sd].hp))} `;
      const bm = S.base[sd], bf = S.base[1 - sd];
      myBar.style.setProperty('--p', String(Math.max(0, bm.hp / (bm.maxHp || 1)))); foeBar.style.setProperty('--p', S.stage.raid ? '1' : String(Math.max(0, bf.hp / (bf.maxHp || 1))));   // 습격 : 좀비 성은 무너지지 않음
      const top1 = p.wl >= W.length - 1;
      wLv.textContent = `Lv${p.wl + 1}`; wCost.textContent = top1 ? 'MAX' : fmt(W[p.wl].cost);
      wallet.classList.toggle('can', !top1 && p.money >= W[p.wl].cost && S.stage.walletLock == null);
      p.deck.forEach((d, i) => {
        const B = dbtn[i]; if (!B) return;
        const cdMax = d.def.cd / p.B.cooldown, left = Math.max(0, p.cd[i]);
        B.cd.style.setProperty('--p', left > 0 ? String(left / cdMax) : '0');
        const ready = left <= 0;
        B.b.classList.toggle('poor', p.money < d.def.cost);
        B.b.classList.toggle('wait', !ready);
        if (ready && !B.ready) { B.b.classList.remove('flash'); void B.b.offsetWidth; B.b.classList.add('flash'); }
        B.ready = ready;
      });
      const bc = Math.min(1, p.breathT / p.breathCharge);
      bFill.style.setProperty('--p', String(bc)); breath.classList.toggle('can', bc >= 1);
      const foeOn = S.units.some((u) => u.alive && u.side !== p.side);   // 좀비가 없을 때 누르면 횟수만 날아간다 → 그때는 못 누름
      sk.forEach((b, i) => { const s = p.skills[i], left = s ? s.left : 0; b.disabled = !s || left <= 0 || s.cdT > 0 || !foeOn; b._n.textContent = String(left); b.classList.toggle('used', left <= 0); b._cd.style.setProperty('--p', s && left > 0 && s.cdT > 0 ? String(s.cdT / s.def.cd) : '0'); });
      rage.classList.toggle('on', p.rage >= 100);
      const bs = S.boss;
      boss.classList.toggle('on', !!(bs && bs.alive));
      if (bs) bossFill.style.width = `${Math.max(0, bs.hp / bs.maxHp) * 100}%`;
      const now = performance.now(), dt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
      if (bs && bs !== bossRef) {
        bossRef = bs; bossCount++; nameT = 1.2; bnameT.textContent = bs.def.name;
        bname.classList.remove('on'); void bname.offsetWidth; bname.classList.add('on');
      }
      if (!ui.paused) {   // 일시정지 중에는 시간이 멈춘다
        if (nameT > 0) { nameT -= dt; if (nameT <= 0) { bname.classList.remove('on'); if (bossCount === 1) warnT = 0.9; } }
        else if (warnT > 0) warnT -= dt;
      }
      warn.classList.toggle('on', warnT > 0);
      speedB.classList.toggle('on', ui.speed >= 2); autoB.classList.toggle('on', !!ui.auto);
      if (ui.mini) {
        const { a, b, cam, w, F } = ui.mini;
        miniMe.style.left = `${(a / F) * 100}%`; miniFoe.style.left = `${(b / F) * 100}%`; miniFoe.style.visibility = S.stage.fog ? 'hidden' : '';
        miniView.style.left = `${(cam / F) * 100}%`; miniView.style.width = `${(w / F) * 100}%`;
      }
      tip.textContent = ui.tip || ''; tip.classList.toggle('on', !!ui.tip); tip.dataset.at = ui.tipAt || '';
      root.classList.toggle('fever', S.t >= S.feverAt);
    },
    showPanel,
    hidePanel() { panel.classList.remove('on'); panel.replaceChildren(); },
    destroy() { document.removeEventListener('fullscreenchange', fsDraw); document.removeEventListener('webkitfullscreenchange', fsDraw); window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onRs); root.remove(); },
  };
}
