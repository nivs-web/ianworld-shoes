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
import { soundPrefs, setSoundOn, setSoundVol } from './soundPrefs.js';
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
/** 하늘 위를 잘라 낼 칸 = 확대 정도 (80 ≈ 1.17배). 개발 서버에서만 window.__idgCropTop 으로 A/B 비교 */
const CROP_TOP = () => (import.meta.env?.DEV && window.__idgCropTop != null ? window.__idgCropTop : 80);
/** 아이콘 그림 (없으면 글자 fallback) */
const ico = (name, alt) => { const i = h('img', 'ico'); i.src = `${UI}${name}.png`; i.alt = alt; i.draggable = false; i.onerror = () => { i.replaceWith(h('span', 'ico-t', alt)); }; return i; };
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** cb = { cmd({type,i}), pause(), speed(), exit(), retry(), next() } */
export function createHud(host, { stage, deck, skills, text, speedMax = 2, canAuto = false, leader = null, foeDeck = null, foeLeader = null, cons = null, talk = null, isNet = false }, cb) {
  let useCons = null;   // 시작 카드에서 고른 편의품
  const root = h('div', 'idg-hud' + (FLOAT_HUD ? ' float' : '')); host.appendChild(root);
  /* 대표님 «PC 에서 위 글씨 · 숫자가 너무 작다» (11/11) : HUD 전체를 화면 크기에 맞춰 키운다 (폰 가로 = 1 · PC 1280×800 ≈ 1.33 · 최대 1.7) */
  const fitHud = () => { const z = Math.max(1, Math.min(1.7, innerWidth / 960, innerHeight / 540)); root.style.zoom = String(Math.round(z * 100) / 100); };
  /* 위 · 아래 띠 높이를 캔버스에 알려 전장이 띠에 가리지 않게 한다 (app.js 'idg-insets') */
  const sendIns = () => requestAnimationFrame(() => {
    const H = host.getBoundingClientRect(), tb = root.querySelector('.idg-top')?.getBoundingClientRect(), bb = root.querySelector('.idg-bot')?.getBoundingClientRect();
    if (!tb || !bb) return;
    /* 떠 있는 HUD (11/11 대표님 «위 · 아래 띠가 게임 화면을 가린다 · 단추는 공중에 떠 있게») : 띠 판이 없으니 캔버스는 화면 전체 — 띠 높이를 0 으로 알린다 */
    host.dispatchEvent(new CustomEvent('idg-insets', { detail: FLOAT_HUD ? { t: 0, b: 0, f: { top: CROP_TOP(), bottom: 0 } } : { t: Math.max(0, tb.bottom - H.top), b: Math.max(0, H.bottom - bb.top) } }));
  });
  const onRs = () => { fitHud(); sendIns(); };
  fitHud(); window.addEventListener('resize', onRs);
  /* 위 */
  const top = h('div', 'idg-top'); root.appendChild(top);
  const pauseB = h('button', 'idg-btn idg-pause', '⏸'); pauseB.type = 'button'; pauseB.onclick = () => cb.pause();
  const title = h('div', 'idg-title', `${stage.id} ${stage.name}`);
  const time = h('div', 'idg-time', '0:00');
  const speedB = h('button', 'idg-btn idg-speed', '×1'); speedB.type = 'button'; speedB.onclick = () => cb.speed();
  const money = h('div', 'idg-money'); const moneyN = h('span', 'n', '0'); money.append(h('i', 'idg-ico-ember'), moneyN);
  /* 소리 단추 (대표님 «게임하면서 배경음 · 효과음을 켜고 끄는 단추») */
  const musicB = h('button', 'idg-btn idg-snd'), sfxB = h('button', 'idg-btn idg-snd'); musicB.type = sfxB.type = 'button';
  const drawSnd = () => { const sp = soundPrefs(); musicB.replaceChildren(ico(sp.music ? 'hud_music_on' : 'hud_music_off', '음악')); sfxB.replaceChildren(ico(sp.sfx ? 'hud_sfx_on' : 'hud_sfx_off', '효과')); musicB.classList.toggle('off', !sp.music); sfxB.classList.toggle('off', !sp.sfx); musicB.title = sp.music ? '배경음 끄기' : '배경음 켜기'; sfxB.title = sp.sfx ? '효과음 끄기' : '효과음 켜기'; };
  musicB.onclick = () => { const on = !soundPrefs().music; setSoundOn('bgm', on); cb.music?.(on); drawSnd(); };
  sfxB.onclick = () => { setSoundOn('sfx', !soundPrefs().sfx); cb.soundRefresh?.(); drawSnd(); };
  drawSnd();
  top.append(pauseB, title, time, speedB, money, musicB, sfxB);
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
  mini.onpointerdown = (e) => { const r = mini.getBoundingClientRect(); cb.look?.((e.clientX - r.left) / r.width); };
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
  const breath = h('button', 'idg-btn idg-breath'); breath.type = 'button'; breath.onclick = () => cb.cmd({ type: 'breath' });
  const bFill = h('i', 'fill'); breath.append(bFill, h('b', null, '브레스'));
  bot.append(wallet, deckBox, right, breath);
  sendIns(); setTimeout(sendIns, 300);   // 글꼴 · 그림이 늦게 와서 높이가 바뀔 수 있다   // 스킬 · 포효 = 아래 띠 안 브레스 왼쪽 (예전 오른쪽 위는 좀비 성 체력 숫자를 가렸다)

  /** 일시정지 판의 소리 설정 : 배경음 · 효과음 각각 켜기 + 크기 */
  function soundBox() {
    const wrap = h('div', 'idg-sound');
    const row = (label, bus, key) => {
      const r = h('div', 'idg-sound-row'), on = h('button', 'idg-sound-on'); on.type = 'button';
      const rg = h('input'); rg.type = 'range'; rg.min = '0'; rg.max = '150'; rg.step = '5';
      const draw = () => { const sp = soundPrefs(), isOn = bus === 'bgm' ? sp.music : sp.sfx; on.textContent = isOn ? '켜짐' : '꺼짐'; on.classList.toggle('off', !isOn); rg.value = String(Math.round(sp[key] * 100)); rg.disabled = !isOn; };
      on.onclick = () => { const sp = soundPrefs(), v = !(bus === 'bgm' ? sp.music : sp.sfx); setSoundOn(bus, v); if (bus === 'bgm') cb.music?.(v); else cb.soundRefresh?.(); draw(); drawSnd(); };
      rg.oninput = () => { setSoundVol(key, Number(rg.value) / 100); cb.soundRefresh?.(); };
      draw(); r.append(h('span', 'lb', label), on, rg); return r;
    };
    wrap.append(row('배경음', 'bgm', 'm'), row('효과음', 'sfx', 's'));
    return wrap;
  }

  /* 일시정지 · 결과 판 */
  const panel = h('div', 'idg-panel-over'); root.appendChild(panel);
  function showPanel(kind, info = {}) {
    panel.replaceChildren();
    const box = h('div', 'idg-card');
    if (kind === 'pause') { box.append(h('h2', null, '일시정지')); box.appendChild(soundBox()); }
    else if (kind === 'intro' && stage.raid) {   /* 주간 습격 카드 */
      box.append(h('h2', null, '주간 좀비 습격'), h('p', 'small', `${stage.raid} · 20초마다 웨이브 · 점점 세져요 · 5웨이브마다 보스`), h('p', 'small', '모두 같은 조건 : 내 덱 6칸 · 모두 Lv20 · 연구소/보물 없음'));
    }
    else if (kind === 'intro' && stage.pvp) {   /* 용 대결 카드 : 양쪽 덱 · 리더 공개 */
      box.append(h('h2', null, '용 대결!'));
      const face = (list, ld) => { const z = h('div', 'idg-intro-z'); for (const id of [ld, ...list.map((d) => d.id)].filter(Boolean)) { const im = h('img'); im.src = `${AI}${id}/head.png`; im.alt = ''; im.onerror = () => { im.onerror = null; im.style.display = 'none'; }; z.appendChild(im); } return z; };
      box.append(h('p', 'small', '나'), face(deck, leader), h('p', 'small', 'VS 친구'), face(foeDeck || [], foeLeader));
      box.append(h('p', 'small', '상대 둥지를 먼저 무너뜨리면 승리 · 3분 · 90초부터 불꽃 타임 · 모두 Lv20'));
    }
    else if (kind === 'intro') {   /* 스테이지 카드 (기획서 11.4) : 이름 · 기믹 · 오늘의 좀비 · 별 조건 */
      box.append(h('h2', null, `${stage.id} ${stage.name}`));
      if (stage.diff && stage.diff !== 'normal') box.append(h('p', 'idg-diff ' + stage.diff, stage.diff === 'hard' ? '어려움 — 좀비가 1.35배 세요 · 붉은 별' : '쉬움 — 좀비가 약해요 · 별은 2개까지'));
      if (stage.gim && GIM[stage.gim]) box.append(h('p', 'gim', GIM[stage.gim]));
      const zs = h('div', 'idg-intro-z');
      for (const tr of [...new Set(stage.lines.flatMap((l) => (ENEMIES[l.id]?.traits || []).filter((t) => ['ghost', 'giant', 'shadow', 'crystal'].includes(t))))]) { const ic = h('img', 'idg-attr'); ic.src = `/assets/iandragon_game/ui/hud_attr_${tr}_s.png`; ic.alt = ''; ic.title = ATTR_KO[tr]; ic.onerror = () => { ic.style.display = 'none'; }; zs.appendChild(ic); }   // 이 판의 특별한 좀비 (유령 · 거대 · 그림자 · 수정)
      for (const id of [...new Set(stage.lines.map((l) => l.id))]) { const im = h('img'); im.src = `${AI}${ZART[id] || id}/head.png`; im.alt = ''; im.onerror = () => { im.onerror = null; im.src = `${AI}${ZART[id] || id}/torso.png`; }; zs.appendChild(im); }   // 머리 조각이 없는 좀비(박쥐)는 몸 그림
      box.append(zs, h('p', 'small', `★ 깨면 · ★★ ${stage.star2}초 안에 · ★★★ ${stage.star3}초 안에`));
    }
    else {
      box.append(h('h2', kind === 'win' ? 'win' : 'lose', info.title || (kind === 'win' ? '승리!' : '아쉬워요…')));
      if (info.pvp) { box.append(h('p', null, `${clock(info.t || 0)} · 코인 +${fmt(info.coins || 0)}`), h('p', 'small', info.rec || '')); if (info.hint) box.append(h('p', 'hint', info.hint)); }
      else if (kind === 'win') { const st = h('div', 'idg-stars' + (info.red ? ' red' : '')); for (let i = 0; i < 3; i++) { const s = h('span', i < info.stars ? 'on' : '', '★'); s.style.animationDelay = `${0.3 + i * 0.35}s`; st.appendChild(s); } box.appendChild(st); }
      if (!info.pvp) box.append(h('p', null, `${clock(info.t || 0)}${kind === 'win' && info.coins ? ` · 코인 +${fmt(info.coins)}` : ''}${kind === 'win' && info.gems ? ` · 젬 +${info.gems}` : ''}${info.daily ? ' (오늘 첫 승리 +10)' : ''}${info.gold ? ` · 황금 좀비 +${fmt(info.gold)}` : ''}`));
      if (kind === 'lose' && info.hint && !info.pvp) box.append(h('p', 'hint', info.hint));
    }
    const row = h('div', 'idg-row');
    const add = (label, fn, cls = '') => { const b = h('button', 'idg-btn ' + cls, label); b.type = 'button'; b.onclick = fn; row.appendChild(b); };
    if (kind === 'pause') add('계속', () => cb.pause(), 'main');
    if (kind === 'intro' && cons && cons.length) {   /* 편의품 (판마다 1개) */
      const cr = h('div', 'idg-cons-row');
      const draw = () => cr.replaceChildren(h('span', null, '편의품'), ...cons.map((c) => { const b = h('button', 'idg-cons' + (useCons === c.id ? ' on' : ''), `${c.name} ×${c.n}`); b.type = 'button'; b.onclick = () => { useCons = useCons === c.id ? null : c.id; draw(); }; return b; }));
      draw(); box.appendChild(cr);
    }
    if (kind === 'intro') { add('출격!', () => cb.go(useCons), 'main'); add(text.exit, () => cb.exit()); box.appendChild(row); panel.appendChild(box); panel.classList.add('on'); return; }
    if (info.unlocks) box.append(h('p', 'final', `새로 열림 : ${info.unlocks.join(' · ')}`));
    if (info.final) box.append(h('p', 'final', '좀비 드래곤 로드를 물리쳤어요! 모든 모험 끝 — 고마워요! 🐉'));
    if (kind === 'win' && info.hasNext && !info.pvp && !isNet) add('다음 스테이지', () => cb.next(), 'main');
    if (isNet) add('한 판 더 (같은 방)', () => cb.rejoin(), 'main');
    else if (!info.pvp || stage.raid) add('다시 하기', () => cb.retry(), kind === 'lose' ? 'main' : '');
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
    update(S, ui) {
      const p = S.players[ui.me || 0], W = S.D.wallet;
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
      speedB.textContent = `×${ui.speed}`; autoB.classList.toggle('on', !!ui.auto);
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
    destroy() { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onRs); root.remove(); },
  };
}
