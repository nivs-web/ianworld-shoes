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
import { kitClose } from '../../../screens/idgKit.js';   /* 키트 X 단추 (일시정지 오른쪽 위 시안 PAUSE_X) */
import { scrollHint } from '../../../screens/idgMore.js';   /* «아래로 더 있음» 금 화살표 공용 (11/13) */
const ATTR_KO = { ghost: '유령', giant: '거대', shadow: '그림자', crystal: '수정' };

const AI = '/assets/iandragon_game/ai/';
/** 기믹 설명 (아이 말투 · 계산기 GIM_KO 와 같은 뜻) */
const GIM = {
  gold: '황금 좀비가 나와요! 잡으면 코인이 듬뿍', race: '좀비 달리기 대회! 좀비가 빨라요', time: '시간 안에 좀비 탑을 무너뜨려요!',
  cap10: '용은 10마리까지만 나갈 수 있어요', cap8: '용은 8마리까지만 나갈 수 있어요', lock: '화로가 고장 났어요 — 화로를 못 올려요',
  rush: '보스가 줄줄이 나와요! 보스 러시', wind: '앞에서 거센 바람이 불어요 — 용들이 느리게 걸어요', fog: '안개 — 멀리 있는 좀비가 잘 안 보여요',
  cost: '불씨 300 이하인 용만 나갈 수 있어요', money: '용돈 듬뿍! 불씨를 많이 들고 시작해요', fever: '불꽃 타임이 빨리 와요',
};
const ZART = { chubby: 'cone', shield: 'helmet', bossFat: 'bossGiant', shieldFirm: 'helmet', lavaFirm: 'lava', gearFirm: 'gear', shroomFirm: 'shroom' };   // *Firm = 초고수 굳센 좀비(원본 그림 그대로)
/** 낱말 규칙(대표님 11/13) : 화면에 그릴 때 «용» → «드래곤» · «좀비 성» → «좀비 탑» · «성» → «드래곤캐슬» (판 자료 글은 그대로 두고 그릴 때만 · «용돈 · 활용» 같은 낱말 속 글자는 건드리지 않음) */
const KO_YONG = /(^|[\s«「'"(·])용(?=[은는이가을를도의과와에로만들]|[\s,.!?·»」'")]|$)/g, KO_SUNG = /(^|[\s«「'"(·])성(?=[은는이가을를도의과와에로만]|[\s,.!?·»」'")]|$)/g;
export const ko = (s) => (typeof s === 'string' && /[용성]/.test(s) ? s.replace(/좀비 성/g, '좀비 탑').replace(KO_YONG, '$1드래곤').replace(KO_SUNG, '$1드래곤캐슬') : s);
const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = ko(txt); return e; };
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
const UI = '/assets/iandragon_game/ui/';
/** 떠 있는 HUD : 위 · 아래 띠 판 없이 단추만 (CSS .idg-hud.float) */
const FLOAT_HUD = true;
/**
 * 확대 (11/11 대표님 «시작은 전체 화면 → 캐릭터 · 좀비가 나오고 몇 초 뒤 1.1배로 · 바닥은 단추 높이만큼만»)
 * 잘라 낼 칸 : 위 하늘 CROP.top · 아래 흙 CROP.bottom (합 49칸 = 540/491 ≈ 1.1배). 전투 ZOOM_AT 초부터 ZOOM_DUR 초 동안 부드럽게.
 * 개발 서버에서만 window.__idgCropTop 으로 위쪽 칸을 바꿔 비교할 수 있다.
 */
const CROP = { top: 33, bottom: 16 }, ZOOM_AT = 5, ZOOM_DUR = 1.2, GUARD_UP = 40;   /* 아래는 단추와 땅 줄 사이 여백이 남게 */
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
  let hudZ = 1;   /* HUD 확대 배율 (sendIns 가 레이아웃 좌표 → CSS px 로 바꿀 때) */
  const fitHud = () => {
    const port = host.clientHeight > host.clientWidth * 1.05;   /* 세로 : 폭 520 · 높이 900 기준 (세로 태블릿에서 창 · 단추가 너무 작지 않게) */
    const z = Math.round(Math.max(1, Math.min(1.7, host.clientWidth / (port ? 520 : 960), host.clientHeight / (port ? 900 : 540))) * 100) / 100;
    hudZ = z;
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
    /* 단추 줄 높이 · 위 체력 줄 아래 끝은 «레이아웃 좌표»(offsetTop)로 잰다 — 화면 방향 고정(rot.js)으로 전투 틀이 90° 돌아가 있으면
     * getBoundingClientRect 는 돌아간 화면 좌표라 띠 높이가 화면 높이만큼 나와 전장이 통째로 밀려 올라갔다(11/12 · 세로 기기 «가로 고정»에서 검은 화면) */
    const lt = (el) => { let y = 0; for (let e = el; e && e !== root; e = e.offsetParent) y += e.offsetTop; return y; };
    const botEl = root.querySelector('.idg-bot'), hpEl = root.querySelector('.idg-hp'), RH = root.offsetHeight;
    const barL = Math.round(Math.max(0, (RH - lt(botEl)) * hudZ)), hudTopL = Math.round(Math.max(0, hpEl ? (lt(hpEl) + hpEl.offsetHeight) * hudZ : 0) + 12);
    host.dispatchEvent(new CustomEvent('idg-insets', { detail: FLOAT_HUD ? { t: 0, b: 0, f: { ...cropOf(zoomK), bar: barL, hudTop: hudTopL } } : { t: Math.max(0, tb.bottom - H.top), b: Math.max(0, H.bottom - bb.top) } }));
  });
  const onRs = () => { fitHud(); fitRound(); sendIns(); };   /* fitRound = 가로 둥근 단추 한 줄 · 두 단 (아래) */
  fitHud(); window.addEventListener('resize', onRs);
  /* 위 */
  const top = h('div', 'idg-top'); root.appendChild(top);
  const pauseB = h('button', 'idg-btn idg-pause', '⏸'); pauseB.type = 'button'; pauseB.onclick = () => cb.pause();
  const title = h('div', 'idg-title', stage.raid ? '주간 좀비 습격 ·' : `${stage.id} ${stage.name}`);   /* 습격 : «주간 좀비 습격 · 웨이브 18 · 5:48» (이름의 «습격» 두 번 고침 11/13) */
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
  const warn = h('div', 'idg-warn', '보스가 나타났다!'); root.appendChild(warn);
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
    b.append(ico(`hud_skill_${id === 'gust' ? 'gust2' : id}`, (def.name || id).slice(0, 2)), cdI,   /* 돌풍 = 새 그림 gust2 (11/13 · 전투 단추만) */ h('b', 'nm', def.name || id), n);
    b.onclick = () => cb.cmd({ type: 'skill', i }); right.appendChild(b); b._cd = cdI; b._n = n; return b;
  });
  /* 으르렁 (11/12 대표님 «아이콘 없이 글씨만») : 다른 스킬과 같은 양식 — 도트 아이콘(포효하는 용 · ui/hud_rage) + 아래 이름 */
  const rage = h('button', 'idg-btn idg-skill idg-rage'); rage.type = 'button'; rage.title = '으르렁! : 잠깐 모든 용이 세져요'; rage.onclick = () => cb.cmd({ type: 'rage' });
  rage.append(ico('hud_rage', '으르'), h('b', 'nm', '으르렁')); right.appendChild(rage);
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
  /*
   * 가로 (11/12 대표님 «치명적인 버그» → 대표님 결정) : 한 줄 = [화로 · 카드 · 스킬 … 브레스(맨 오른쪽 · 가장 큼)].
   * «으르렁»은 줄에서 빼 브레스 바로 위에 세로로 맞춰 띄운다(.rage-up · 가운데 맞춤 --rx) — 꺼져 있으면 그 자리만 비고 카드 줄 폭에는 영향 없음.
   * 그래도 넘치거나 카드가 52px 보다 좁아지면 카드를 더 좁게 허용(.tight 44px → .tight2 38px). 세로(격자 배치)는 위 자리표 그대로.
   * 단추 영역 높이(footFit 기준)는 .idg-bot 상자 = 카드 줄 위끝 — 위에 뜬 으르렁은 넣지 않는다.
   */
  function fitRound() {
    bot.classList.remove('stack', 'tight', 'tight2', 'rage-up'); rage.style.removeProperty('--rx');
    if (getComputedStyle(bot).display === 'grid') return;
    bot.classList.add('rage-up');
    const over = () => bot.scrollWidth > bot.clientWidth + 1;
    if (over() || Math.min(...dbtn.map((q) => q.b.offsetWidth || 99)) < 52) bot.classList.add('tight');
    if (over()) bot.classList.add('tight2');
    rage.style.setProperty('--rx', `${Math.round(breath.offsetLeft + (breath.offsetWidth - rage.offsetWidth) / 2)}px`);
  }
  fitRound();
  sendIns(); setTimeout(() => { fitRound(); sendIns(); }, 300);   // 글꼴 · 그림이 늦게 와서 높이가 바뀔 수 있다   // 스킬 · 포효 = 아래 띠 안 브레스 왼쪽 (예전 오른쪽 위는 좀비 성 체력 숫자를 가렸다)

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
  fontOnce();   /* 전투 중 띠 · 안내 · 현판도 같은 글꼴(Pretendard) */
  function resultCard(kind, info) {
    fontOnce();
    const win = kind === 'win', card = h('div', `idg-card idg-res ${win ? 'win' : 'lose'}`);
    const img = (src, cls, alt = '') => { const i = h('img', cls); i.src = src; i.alt = alt; i.draggable = false; return i; };
    /* 11/12 대표님 : 그림이 창의 절반 넘게 · 현판은 용 머리 위 · 별은 용 아래 · 그림은 보상 판 가운데 줄(양 끝 뾰족한 곳)까지 내려와 금 줄로 끝남 */
    const scene = h('div', 'idg-res-scene'), body = h('div', 'idg-res-body');
    if (info.plate) { const pl = h('div', `idg-res-banner idg-res-plate ${win ? 'gold' : 'stone'}`), pi = h('div', 'p'); pi.appendChild(h('b', info.plate.length > 6 ? 'long' : info.plate.length > 4 ? 'mid' : '', info.plate)); pl.appendChild(pi); scene.appendChild(pl); }   /* 습격 · 비김 · 어긋남 = 글자 없는 날개 + 현판 글씨 (같은 자리 · 같은 날개) */
    else scene.appendChild(img(`${RES}${win ? 'banner_win' : 'banner_lose'}.webp`, 'idg-res-banner', win ? '승리!' : '패배'));
    if (info.big != null) { const bg = h('div', 'idg-res-big' + (String(info.big).length > 4 ? ' sm' : '')); if (info.bigSub) bg.appendChild(h('small', null, info.bigSub)); bg.appendChild(h('b', null, String(info.big))); scene.appendChild(bg); }   /* 별 없는 모드 : 별 자리에 큰 숫자(웨이브 · 전적) */
    else { const st = h('div', 'idg-res-stars' + (info.diff === 'hard' ? ' red' : info.diff === 'master' ? ' purple' : '')); for (let i = 0; i < 3; i++) { const on = win && i < info.stars,   /* 패배 = 꺼진 별 3개 (11/12 대표님) */ w = h('span', 'star' + (on ? ' on' : '')), s = img(`${RES}${on ? 'star_on' : 'star_off'}.webp`); w.style.animationDelay = `${0.25 + i * 0.3}s`; w.appendChild(s); st.appendChild(w); } scene.appendChild(st); }
    /* 보상 판 (칸막이 2개 = 3칸) */
    const bar = h('div', 'idg-res-bar'), cell = (src, txt) => { const c = h('div', 'cell'); c.append(img(src), h('b', null, txt)); return c; };
    bar.append(cell(`${RES}timer.webp`, clock(info.t || 0)), cell(`${RES}coin_crown.webp`, `+${fmt(info.coins || 0)}`), cell('/assets/iandragon_game/ui/lobby/icon_gem_v3.png', `+${info.gems || 0}`));   /* 승리 · 패배 모두 : 시간 → 동전 → 젬 (11/12 대표님 «다른 배치는 없어») */
    body.appendChild(bar);
    /* 새로 열림 판 (승리) · 도움말 판 (패배) */
    const own = info.line !== undefined;   /* 습격 · 대결 · 어긋남 = 한 줄을 직접 줌(꼬리표 글자 없이) */
    const extra = own ? info.line : win ? (info.unlocks ? info.unlocks.join(' · ') : info.daily ? '오늘 첫 승리 보너스 : 젬 +10' : '') : (info.mode ? '' : info.hint || '파워업에서 용을 키우면 더 쉬워져요!');
    if (extra) { const nw = h('div', 'idg-res-new' + (win || own ? '' : ' is-tip')); if (!own) nw.append(h('em', null, win ? (info.unlocks ? '새로 열림 :' : '보너스 :') : '도움말 :')); nw.append(h('span', null, extra)); bar.appendChild(nw); bar.classList.add('has-new'); requestAnimationFrame(() => { if (!nw.offsetHeight) return; const em = parseFloat(getComputedStyle(nw).fontSize) || 10; if (nw.offsetHeight > em * 3) card.classList.add('tight'); requestAnimationFrame(() => { bar.style.marginBottom = `${Math.ceil(nw.offsetHeight - 0.12 * bar.offsetHeight + 4)}px`; }); }); }   /* 한 줄이 두 줄로 길어지면 아래 여백도 같이 */   /* 보상 판 바로 아래에 붙은 꼬리표 (따로 떨어진 칸 아님) */
    if (info.final) body.appendChild(h('p', 'idg-res-final', '좀비 드래곤 로드를 물리쳤어요! 모든 모험 끝 — 고마워요!'));
    /* 단추 규칙 (대표님 11/11) : 승리 = 전투개시! + 파워업 / 다시하기 · 나가기 (작고 밋밋하게) · 패배 = 다시하기 + 파워업 / 나가기 */
    const btn = (label, ico, fn, cls) => { const b = h('button', 'idg-res-btn ' + cls); b.type = 'button'; b.append(img(ico.startsWith('/') ? ico : `${RES}${ico}`, 'ico'), h('span', null, label)); b.onclick = fn; return b; };
    const r1 = h('div', 'idg-res-row big'), r2 = h('div', 'idg-res-row');
    const next = win && info.hasNext && !isNet && !info.mode;
    if (info.mode === 'raid') {   /* 주간 습격 : 빨강 다시하기 · 초록 명예의 전당(«주간 습격» 탭 바로 열기) · 보라 나가기 */
      r1.append(btn('다시하기', 'ico_retry.svg', () => cb.retry(), 'red'), btn('명예의 전당', '/assets/iandragon_game/ui/lobby/icon_hall.png', () => cb.hall?.(), 'green'));
    } else if (isNet) r1.appendChild(btn('다시하기', 'ico_retry.svg', () => cb.rejoin(), 'red'));   /* 같이 깨기 · 대결 : 같은 방에서 다시하기 */
    else r1.appendChild(next ? btn('전투개시!', 'ico_fight.webp', () => cb.next(), 'red') : btn('다시하기', 'ico_retry.svg', () => cb.retry(), 'red'));
    if (cb.puSave && !isNet && !info.mode) r1.appendChild(btn('파워업', 'ico_power_n.webp', () => showPanel('powerup', { back: kind, backInfo: info }), 'green'));
    if (next) r2.appendChild(btn('다시하기', 'ico_retry.svg', () => cb.retry(), 'purple'));
    r2.appendChild(btn(text.exit, 'ico_exit.svg', () => cb.exit(), 'purple'));
    body.append(r1, r2);
    card.append(scene, body);
    /* 가운데 칸이 아래 테두리에 걸려 단추가 잘리면 그림 칸을 줄여(.tight) 먼저 맞춘다 — 그래도 넘치면 그때 스크롤 + 금 화살표(idgMore) */
    const fit = () => { if (!card.isConnected || body.scrollHeight - body.clientHeight <= 2) return; if (!card.classList.contains('tight')) card.classList.add('tight'); else if (!card.classList.contains('tighter')) card.classList.add('tighter'); };
    setTimeout(fit, 120); setTimeout(fit, 300); setTimeout(fit, 600);
    return card;
  }

  /* ── 시작 창 (대표님 11/13 «시작 창 · 결과 창 비슷한 창은 규칙으로 통일» · docs/IDG_UI_PATTERNS.md §1) ──
   *  차례 : 날개 현판(판 이름 · 모드 이름) → 그림 띠(포스터 · 월드 배경 + 나오는 좀비 얼굴 칸) → 큰 한 줄 목표 → 정보 줄(아이콘 + 짧은 글 · 종이 띠) → (별 기준 알약) → 빨강 «시작하기» + 보라 «나가기»
   *  창이 떠 있는 동안 전투는 멈춰 있다(battle.js ui.paused) · «시작하기»를 눌러야 시작 */
  function introCard(info) {
    fontOnce();
    const raid = !!stage.raid, pvp = !!stage.pvp, card = h('div', `idg-card idg-res idg-int win${raid ? ' raid' : ''}${pvp ? ' pvp' : ''}`);
    const img = (src, cls, alt = '') => { const i = h('img', cls); i.src = src; i.alt = alt; i.draggable = false; return i; };
    const scene = h('div', 'idg-res-scene'), body = h('div', 'idg-res-body');
    /* 현판 : 판 = «1-4» 큰 글 + 이름 작은 글 두 줄 · 습격 = «주간 좀비 습격» */
    { const pl = h('div', 'idg-res-banner idg-res-plate gold two'), pi = h('div', 'p');
      if (raid || pvp) pi.appendChild(h('b', 'mid', raid ? '주간 좀비 습격' : '드래곤 대결')); else pi.append(h('b', 'id', stage.id), h('i', null, stage.name));
      pl.appendChild(pi); scene.appendChild(pl); }
    if (raid) { const po = img('/assets/iandragon_game/ui/raid_poster.webp', 'idg-int-poster'); po.onerror = () => { po.onerror = null; po.src = `${RES}win.webp`; }; scene.appendChild(po); }
    else if (pvp) {   /* 대결 : 내 덱(대장 먼저) VS 친구 덱 · 얼굴 칸 */
      scene.style.backgroundImage = `url(${AI}bg/w${String(stage.w || 1).padStart(2, '0')}_panel.png)`; scene.classList.add('world');
      const side = (name, list, ld) => { const g = h('div', 'grp'), z = h('div', 'idg-int-faces in'); g.appendChild(h('i', null, name));
        for (const id of [ld, ...(list || []).map((d) => d.id)].filter(Boolean)) { const c = h('div', 'face'), im = img(`${AI}${id}/head.png`); im.onerror = () => { c.style.display = 'none'; }; c.appendChild(im); z.appendChild(c); } g.appendChild(z); return g; };
      const vs = h('div', 'idg-int-vs'); vs.append(side('나', deck, leader), h('b', null, 'VS'), side('친구', foeDeck, foeLeader)); scene.appendChild(vs);
    }
    else {
      scene.style.backgroundImage = `url(${AI}bg/w${String(stage.w || 1).padStart(2, '0')}_panel.png)`; scene.classList.add('world');
      const zs = h('div', 'idg-int-faces');   /* 나오는 좀비 얼굴 칸 */
      for (const id of [...new Set(stage.lines.map((l) => ZART[l.id] || l.id))]) { const c = h('div', 'face'), im = img(`${AI}${id}/head.png`); im.onerror = () => { im.onerror = null; im.src = `${AI}${ZART[id] || id}/torso.png`; }; c.appendChild(im); zs.appendChild(c); }
      scene.appendChild(zs);
    }
    /* 별 기준 알약 (판만) : 별 1 · 2 · 3 개 = 깨면 · n 초 안에 */
    if (!raid && !pvp) {
      const bar = h('div', 'idg-res-bar idg-int-bar' + (stage.diff === 'hard' ? ' red' : stage.diff === 'master' ? ' purple' : ''));
      const cell = (n, txt) => { const c = h('div', 'cell'), ss = h('span', 'ss'); for (let i = 0; i < n; i++) ss.appendChild(img(`${RES}star_on.webp`)); c.append(ss, h('b', null, txt)); return c; };
      bar.append(cell(1, '깨기'), cell(2, `${stage.star2}초`), cell(3, `${stage.star3}초`)); body.appendChild(bar);
    }
    body.appendChild(h('p', 'idg-int-goal', raid ? '최대한 오래 버텨라!' : pvp ? '상대 드래곤캐슬을 먼저 부숴라!' : '좀비 탑을 무너뜨려라!'));
    /* 정보 줄 (아이콘 + 짧은 글) */
    const lines = h('div', 'idg-int-lines'), line = (ico, txt, cls = '') => { const l = h('div', 'idg-res-new idg-int-line ' + cls); if (ico) l.appendChild(typeof ico === 'string' ? img(ico, 'ico') : ico); l.appendChild(h('span', null, txt)); lines.appendChild(l); };
    const ICO = { timer: `${RES}timer.webp`, fight: `${RES}ico_fight.webp`, hall: `${UI}lobby/icon_hall.png`, tip: `${RES}ico_tip.webp` };
    if (pvp) {
      line(ICO.timer, '3분 안에 · 90초부터 불꽃 타임'); line(ICO.fight, '모두 같은 조건 : 드래곤 Lv20'); line(`${RES}ico_castle.webp`, '시간이 끝나면 드래곤캐슬 체력이 많은 쪽이 이겨요');
    } else if (raid) {
      line(ICO.timer, '좀비가 20초마다 더 세게 몰려와요 — 끝이 없어요'); line(ICO.fight, '이번 주 모두 같은 좀비 · 같은 드래곤(Lv20)으로 겨뤄요'); line(ICO.hall, '버틴 웨이브 수가 명예의 전당 순위가 돼요');
      scene.appendChild(h('div', 'idg-int-best', info.best ? `내 이번 주 최고 ${info.best} 웨이브` : '이번 주 내 기록이 아직 없어요'));
    } else {
      if (stage.diff && stage.diff !== 'normal') line(ICO.fight, stage.diff === 'hard' ? '어려움 — 붉은 별 · 출전 드래곤 Lv21 이상' : stage.diff === 'master' ? `초고수 — 보라 별 · ${stage.limit ? `${stage.limit}초 · ` : ''}부화 «+» · 편의품은 안 통해요` : '쉬움 — 좀비가 약해요 · 별은 2개까지', 'diff ' + stage.diff);
      if (stage.gim && GIM[stage.gim]) line(ICO.tip, GIM[stage.gim]);
      const trs = [...new Set(stage.lines.flatMap((l) => (ENEMIES[l.id]?.traits || []).filter((t) => ['ghost', 'giant', 'shadow', 'crystal'].includes(t))))];
      if (trs.length) { const w = h('span', 'attrs'); for (const tr of trs) { const ic = img(`${UI}hud_attr_${tr}_s.png`, 'idg-attr'); ic.title = ATTR_KO[tr]; ic.onerror = () => { ic.style.display = 'none'; }; w.appendChild(ic); } line(w, `특별한 좀비 : ${trs.map((t) => ATTR_KO[t]).join(' · ')}`); }
    }
    if (lines.childElementCount) body.appendChild(lines);
    /* 편의품 (판마다 1개) */
    if (!raid && !pvp && cons && cons.length) {
      const cr = h('div', 'idg-cons-row');
      const draw = () => cr.replaceChildren(h('span', null, '편의품'), ...cons.map((c) => { if (c.auto) return h('span', 'idg-cons on auto', c.name); /* 브레스 UP = 자동 사용 · 켜진 표시만 */ const b = h('button', 'idg-cons' + (useCons === c.id ? ' on' : ''), `${c.name} ×${c.n}`); b.type = 'button'; b.disabled = consOff; /* 초고수 = 회색 · 못 누름 */ b.onclick = () => { useCons = useCons === c.id ? null : c.id; draw(); }; return b; }));
      draw(); body.appendChild(cr);
    }
    const btn = (label, ico, fn, cls) => { const b = h('button', 'idg-res-btn ' + cls); b.type = 'button'; b.append(img(`${RES}${ico}`, 'ico'), h('span', null, label)); b.onclick = fn; return b; };
    const r1 = h('div', 'idg-res-row big');
    r1.append(btn('시작하기', 'ico_fight.webp', () => cb.go(useCons), 'red'), btn(text.exit, 'ico_exit.svg', () => cb.exit(), 'purple'));
    body.appendChild(r1);
    card.append(scene, body);
    return card;
  }

  /* ── 일시정지 창 = 원래 모양 그대로(대표님 11/13 «일시정지 창은 건들지 마») : idg-card · «일시정지» · 설정 · «계속» 한 줄 꽉 · «다시하기 · 나가기» ── */
  const PAUSE_X = false;   /* 오른쪽 위 X(키트 btn_close) = «계속» 과 같음 — 시안만(대표님이 사진을 보고 받아들이면 true) */
  function pauseCard() {
    const box = h('div', 'idg-card idg-pause-card');
    if (PAUSE_X) { const w = h('div', 'idg-pause-xw'); w.appendChild(kitClose(() => cb.pause(), '계속')); box.appendChild(w); }
    box.append(h('h2', null, '일시정지')); box.appendChild(soundBox());
    const rows = h('div', 'idg-rows'), line = (...bs) => { const r = h('div', 'idg-row'); for (const [label, fn, cls] of bs) { const b = h('button', 'idg-btn ' + (cls || ''), label); b.type = 'button'; b.onclick = fn; r.appendChild(b); } rows.appendChild(r); };
    line(['계속', () => cb.pause(), 'main big']); line(['다시하기', () => cb.retry()], [text.exit, () => cb.exit()]);
    box.appendChild(rows);
    return box;
  }

  /* ── 판 · 대결 시작 창 = 원래 모양(대표님 11/13 «시작할 때 화면 원래가 더 좋았던 것 같다 — 되돌리고, 새 디자인은 기획부터 다시») ──
   *  f0f3a83 의 시작 카드 그대로 : idg-card · 제목 «4-8 펭귄 썰매 부대» 한 줄 · (난이도 줄) · (기믹) · 좀비 얼굴 줄 · «★ 깨면 · ★★ N초 안에 · ★★★ N초 안에» · 편의품 줄 · «출격!» + «나가기»
   *  대결 = «드래곤 대결!» · 양쪽 덱 얼굴 · 규칙 한 줄. 주간 습격 소개는 새 모양(introCard) 그대로. 글자는 h() 가 ko() 로 낱말을 고친다(용 → 드래곤 · 좀비 성 → 좀비 탑) */
  function starPill() {   /* 원래 시작 창 안의 별 알약 (11/13 대표님 3차) : 칸막이 없는 판(plate_pill) · 별 3개 → 2개 → 1개 순서 · 시간은 결과 창 초시계 아이콘 + 초 · 난이도 색 별(붉은 · 보라) */
    fontOnce();
    const bar = h('div', 'idg-sp2' + (stage.diff === 'hard' ? ' red' : stage.diff === 'master' ? ' purple' : ''));
    const pic = (src, cls) => { const im = h('img', cls); im.src = src; im.alt = ''; im.draggable = false; return im; };
    const cell = (n, sec) => { const c = h('div', 'cell'), ss = h('span', 'ss'); for (let i = 0; i < n; i++) ss.appendChild(pic(`${RES}star_on.webp`)); c.append(ss); if (sec) { const t = h('span', 't'); t.append(pic(`${RES}timer.webp`, 'tm'), h('b', null, `${sec}초`)); c.append(t); } else c.append(h('b', null, '깨기')); return c; };
    bar.append(cell(3, stage.star3), cell(2, stage.star2), cell(1, 0));
    return bar;
  }
  function startCard() {
    const box = h('div', 'idg-card');
    if (stage.pvp) {
      box.append(h('h2', null, '용 대결!'));
      const face = (list, ld) => { const z = h('div', 'idg-intro-z'); for (const id of [ld, ...(list || []).map((d) => d.id)].filter(Boolean)) { const im = h('img'); im.src = `${AI}${id}/head.png`; im.alt = ''; im.onerror = () => { im.onerror = null; im.style.display = 'none'; }; z.appendChild(im); } return z; };
      box.append(h('p', 'small', '나'), face(deck, leader), h('p', 'small', 'VS 친구'), face(foeDeck || [], foeLeader));
      box.append(h('p', 'small', '상대 드래곤캐슬을 먼저 무너뜨리면 승리 · 3분 · 90초부터 불꽃 타임 · 모두 Lv20'));
    } else {
      box.append(h('h2', null, `${stage.id} ${stage.name}`));
      if (stage.diff && stage.diff !== 'normal') box.append(h('p', 'idg-diff ' + stage.diff, stage.diff === 'hard' ? '어려움 — 붉은 별 · 출전 드래곤 Lv21 이상' : stage.diff === 'master' ? `초고수 — 보라 별 · ${stage.limit ? `${stage.limit}초 · ` : ''}부화 «+» · 편의품은 안 통해요` : '쉬움 — 좀비가 약해요 · 별은 2개까지'));
      if (stage.gim && GIM[stage.gim]) box.append(h('p', 'gim', GIM[stage.gim]));
      const zs = h('div', 'idg-intro-z');
      for (const tr of [...new Set(stage.lines.flatMap((l) => (ENEMIES[l.id]?.traits || []).filter((t) => ['ghost', 'giant', 'shadow', 'crystal'].includes(t))))]) { const ic = h('img', 'idg-attr'); ic.src = `/assets/iandragon_game/ui/hud_attr_${tr}_s.png`; ic.alt = ''; ic.title = ATTR_KO[tr]; ic.onerror = () => { ic.style.display = 'none'; }; zs.appendChild(ic); }   // 이 판의 특별한 좀비
      for (const id of [...new Set(stage.lines.map((l) => ZART[l.id] || l.id))]) { const im = h('img'); im.src = `${AI}${id}/head.png`; im.alt = ''; im.onerror = () => { im.onerror = null; im.src = `${AI}${id}/torso.png`; }; zs.appendChild(im); }   // 머리 조각이 없는 좀비(박쥐)는 몸 그림
      box.append(zs, starPill());   /* 별 기준 = 새 창의 짙은 알약 (대표님 11/13 · «★ 깨기 | ★★ N초 | ★★★ N초») */
      if (cons && cons.length) {   /* 편의품 (판마다 1개) */
        const cr = h('div', 'idg-cons-row');
        const draw = () => cr.replaceChildren(h('span', null, '편의품'), ...cons.map((c) => { if (c.auto) return h('span', 'idg-cons on auto', c.name); /* 브레스 UP = 자동 사용 · 켜진 표시만 */ const b = h('button', 'idg-cons' + (useCons === c.id ? ' on' : ''), `${c.name} ×${c.n}`); b.type = 'button'; b.disabled = consOff; /* 초고수 = 회색 · 못 누름 */ b.onclick = () => { useCons = useCons === c.id ? null : c.id; draw(); }; return b; }));
        draw(); box.appendChild(cr);
      }
    }
    const row = h('div', 'idg-row');
    const add = (label, fn, cls = '') => { const b = h('button', 'idg-btn ' + cls, label); b.type = 'button'; b.onclick = fn; row.appendChild(b); };
    add('출격!', () => cb.go(useCons), 'main'); add(text.exit, () => cb.exit());
    box.appendChild(row);
    return box;
  }

  function showPanel(kind, info = {}) {
    panel.replaceChildren();
    if (kind === 'powerup') {   /* 판 사이 파워업 (powerPage.js) — 돌아가기 = 방금 결과 창 */
      /* 한 페이지 파워업 (powerPage.js · 대표님 «한 페이지에서 슬롯 끼고 빼고 업글») */
      const back = () => showPanel(info.back, info.backInfo);
      const btns = info.back === 'win' && info.backInfo?.hasNext ? [['전투 개시!', () => cb.next(), 'main big'], ['돌아가기', back]] : [['다시하기', () => cb.retry(), 'main big'], ['돌아가기', back]];
      panel.appendChild(powerPage(h, { save: cb.puSave, write: cb.puWrite, leader, buttons: btns, exit: () => cb.exit(), shop: cb.shop ? () => cb.shop(() => showPanel('powerup', info)) : null, cls: 'idg-card idg-pp' }));   /* exit = «나가기»(로비 · 결과 창 나가기와 같음 · 11/12 대표님 3차) */
      panel.classList.add('on'); return;
    }
    /* 일시정지 · 시작(판 · 습격 · 대결) · 결과 = 모두 결과 창과 같은 틀(docs/IDG_UI_PATTERNS.md §0 · §1 · §2) */
    const card = kind === 'pause' ? pauseCard() : kind === 'intro' ? (stage.raid ? introCard(info) : startCard()) : resultCard(kind, info);   /* 판 · 대결 시작 = 원래 창(startCard) · 주간 습격 = 새 소개 창 */
    panel.appendChild(card);
    panel.classList.add('on');
    if (kind === 'intro' && !stage.raid) return;   /* 원래 시작 창은 짧아서 스크롤 화살표 없음 */
    /* 아래로 더 있으면 금 화살표 (대표님 11/13 · 공용 idgMore.js) : 일시정지 카드는 카드째 스크롤, 시작 · 결과는 가운데 칸(.idg-res-body)이 스크롤 */
    if (kind === 'pause') scrollHint(card, { host: panel, lift: 30 });
    else { const body = card.querySelector('.idg-res-body'); if (body) scrollHint(body, { host: card, lift: 3 }); }
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
      /* .chg = 다시 차는 중 (11/13 대표님 : 차기 전에는 살짝 회색 · 어둡게 — CSS «전투 단추 기다림») */
      sk.forEach((b, i) => { const s = p.skills[i], left = s ? s.left : 0; b.disabled = !s || left <= 0 || s.cdT > 0 || !foeOn; b._n.textContent = String(left); b.classList.toggle('used', left <= 0); b.classList.toggle('chg', !!s && left > 0 && s.cdT > 0); b._cd.style.setProperty('--p', s && left > 0 && s.cdT > 0 ? String(s.cdT / s.def.cd) : '0'); });
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
      tip.textContent = ko(ui.tip || ''); tip.classList.toggle('on', !!ui.tip); tip.dataset.at = ui.tipAt || '';
      root.classList.toggle('fever', S.t >= S.feverAt);
    },
    /** 아래 단추 줄 근처인가 (화면 px · 전장 끌기 · 확대가 쓴다 — 대표님 11/13 «출전 단추를 누르다 실수로 맵을 건드리면 화면이 돌아간다»)
     *  .idg-bot(화로 · 출전 · 필살기 · 브레스 줄) 위끝에서 GUARD_UP px 위부터 아래 전부. 줄 위에 떠 있는 으르렁은 그 둘레 40px 도. 화면을 돌려 그리면(rot.js) «게임 위쪽» = 화면 오른쪽(cw) · 왼쪽(ccw) */
    inGuard(x, y) {
      if (!bot.isConnected) return false;
      const r = bot.getBoundingClientRect(); if (!r.width || !r.height) return false;
      const ru = bot.classList.contains('rage-up') ? rage.getBoundingClientRect() : null, rt = rotated();
      if (ru && ru.width && x >= ru.left - GUARD_UP && x <= ru.right + GUARD_UP && y >= ru.top - GUARD_UP && y <= ru.bottom + GUARD_UP) return true;   /* 줄 위에 떠 있는 으르렁 둘레 */
      if (rt === 'cw') return x <= r.right + GUARD_UP;
      if (rt === 'ccw') return x >= r.left - GUARD_UP;
      return y >= r.top - GUARD_UP;
    },
    showPanel,
    hidePanel() { panel.classList.remove('on'); panel.replaceChildren(); },
    destroy() { document.removeEventListener('fullscreenchange', fsDraw); document.removeEventListener('webkitfullscreenchange', fsDraw); window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onRs); root.remove(); },
  };
}
