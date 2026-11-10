/**
 * 이안 드래곤 «좀비와 드래곤» 에셋 갤러리 (그림 담당) — 개발 서버 전용 도구. 게임 코드(src)는 import 만 한다.
 * 탭 → 카드 → 클릭하면 큰 창(캐릭터는 실제 rig.js 로 움직임 · 배경은 재미 요소 자리 확인).
 */
import { TABS, FUN_INFO, A, RETOUCH } from './lists.js';
import { makeThumb, getRig, createCharStage, createBgStage, createLineup } from './viewer.js';

const GAME = '/assets/iandragon_game/';
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const bust = Date.now();
const probeJson = async (url) => { try { const r = await fetch(url + '?v=' + bust); if (!r.ok) return null; return JSON.parse(await r.text()); } catch { return null; } };
const probeImg = (url) => new Promise((res) => { const i = new Image(); i.onload = () => res(i.naturalWidth > 0 ? i : null); i.onerror = () => res(null); i.src = url + '?v=' + bust; });
const img = (src, cls = '') => h('img', { src: src + '?v=' + bust, class: ('zoomable ' + cls).trim(), loading: 'lazy' });
const soon = (txt = '아직 없음') => h('div', { class: 'soon' }, h('div', { class: 'soon-ic' }, '🥚'), txt);

/* ───────── 큰 창 ───────── */
let modalCleanup = null;
function closeModal() { modalCleanup?.(); modalCleanup = null; $('#modal').classList.remove('open'); $('#modal-body').replaceChildren(); }
function openModal(title, sub, body, cleanup) {
  closeModal();
  $('#modal-title').textContent = title; $('#modal-sub').textContent = sub || '';
  $('#modal-body').replaceChildren(body);
  $('#modal').classList.add('open');
  modalCleanup = cleanup;
}
$('#modal-close').addEventListener('click', closeModal);
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') { if ($('#lightbox').classList.contains('open')) $('#lightbox').classList.remove('open'); else closeModal(); } });
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.tagName === 'IMG' && t.classList.contains('zoomable')) { $('#lightbox img').src = t.src; $('#lightbox').classList.add('open'); }
});
$('#lightbox').addEventListener('click', () => $('#lightbox').classList.remove('open'));

/* ───────── 탭 ───────── */
const state = { tab: (location.hash.match(/tab=(\w+)/) || [])[1] || 'dragon', funStage: null };
function buildTabs() {
  const nav = $('#tabs');
  nav.replaceChildren(...TABS.map((t) => h('button', { class: 'tab' + (t.id === state.tab ? ' on' : ''), 'data-id': t.id, onclick: () => { state.tab = t.id; location.hash = 'tab=' + t.id; buildTabs(); render(); } }, t.label)));
}
$('#reload').addEventListener('click', () => render());

async function render() {
  state.funStage?.destroy(); state.funStage = null;
  const tab = TABS.find((t) => t.id === state.tab) || TABS[0];
  const main = $('#main'); main.replaceChildren(h('p', { class: 'hint' }, '불러오는 중…'));
  const fn = { rig: renderRig, bg: renderBg, castle: renderCastle, fun: renderFun, egg: renderEgg, hud: renderHud, banner: renderBanner, lobby: renderLobby, meta: renderMeta }[tab.kind];
  const view = await fn(tab);
  main.replaceChildren(...[].concat(view));
  window.scrollTo(0, 0);
}

/* ───────── 캐릭터 탭 (용 · 진화형 · 리더 · 좀비 · 보스 · 부화장 용) ───────── */
function statLine(d) {
  const P = [['hp', '체력'], ['atk', '공격'], ['range', '사거리'], ['speed', '속도'], ['dmg', '브레스'], ['cost', '불씨']];
  return P.filter(([k]) => d?.[k] != null).map(([k, l]) => `${l} ${d[k]}`).join(' · ');
}
async function renderRig(tab) {
  const items = tab.items();
  const grid = h('div', { class: 'grid' });
  let have = 0;
  const cards = items.map((it) => {
    const thumb = h('div', { class: 'thumb' }, h('div', { class: 'spin' }));
    const card = h('div', { class: 'card' + (it.rar ? ' rar-' + it.rar : '') }, thumb,
      h('div', { class: 'name' }, it.name), h('div', { class: 'sub' }, it.sub),
      RETOUCH[it.art] && h('div', { class: 'retouch', title: RETOUCH[it.art] }, '✎ 리터치 후보 — ' + RETOUCH[it.art]));
    grid.append(card);
    return { it, thumb, card };
  });
  const head = h('div', { class: 'tabhead' }, h('b', {}, `${tab.label} ${items.length}종`), h('span', { class: 'count' }, ''), h('span', { class: 'hint' }, '카드를 누르면 실제 게임처럼 움직여 볼 수 있어요'));
  await Promise.all(cards.map(async ({ it, thumb, card }) => {
    const rig = await probeJson(`${A}${it.art}/rig.json`);
    if (!rig) { thumb.replaceChildren(soon()); card.classList.add('missing'); return; }
    have++;
    card.classList.add('ready');
    card.addEventListener('click', () => openChar(it, rig));
    makeThumb(it.art, it.facing).then((url) => thumb.replaceChildren(h('img', { src: url })), () => thumb.replaceChildren(soon('그림 오류')));
  }));
  $('.count', head).textContent = `그림 있음 ${have} / ${items.length}`;
  return [head, grid];
}

async function openChar(it, rig) {
  const host = h('div', { class: 'stage' });
  const info = h('div', { class: 'info' });
  const body = h('div', { class: 'charwin' }, h('div', { class: 'left' }, host), info);
  const stage = await createCharStage(host);
  const d = it.data || {};
  await stage.load(it.art, it.facing, { fore: d.fore || 0.3, back: d.back || 0.6 });
  const btn = (label, fn, cls = '') => h('button', { class: 'btn ' + cls, onclick: (e) => fn(e.currentTarget) }, label);
  const group = (...b) => h('div', { class: 'btngroup' }, ...b);
  const radio = (btns, on) => { btns.forEach((b) => b.classList.toggle('on', b.dataset.k === on)); };
  const baseBtns = [['walk', '걷기'], ['idle', '쉬기']].map(([k, l]) => h('button', { class: 'btn' + (k === 'walk' ? ' on' : ''), 'data-k': k, onclick: () => { stage.base(k); radio(baseBtns, k); } }, l));
  const scaleBtns = [1, 2, 3, 4].map((s) => h('button', { class: 'btn' + (s === stage.scale ? ' on' : ''), 'data-k': String(s), onclick: () => { stage.setScale(s); radio(scaleBtns, String(s)); } }, `×${s}`));
  const faceBtns = [[1, '오른쪽 ▶'], [-1, '◀ 왼쪽']].map(([k, l]) => h('button', { class: 'btn' + (k === stage.want ? ' on' : ''), 'data-k': String(k), onclick: () => { stage.setWant(k); radio(faceBtns, String(k)); } }, l));
  const move = h('input', { type: 'checkbox', onchange: (e) => stage.setMove(e.target.checked) });
  const controls = h('div', { class: 'controls' },
    group(...baseBtns, btn('⚔ 공격', () => stage.attack(), 'act'), btn('💥 맞음', () => stage.hit(), 'act')),
    group(...faceBtns, h('label', { class: 'chk' }, move, '걸어서 이동')),
    group(h('span', { class: 'lbl' }, '크기'), ...scaleBtns));
  body.querySelector('.left').append(controls);

  // 정보 · 부품 · 원본 시트
  if (RETOUCH[it.art]) info.append(h('div', { class: 'retouch big' }, '✎ 리터치 후보 — ' + RETOUCH[it.art]));
  info.append(h('div', { class: 'statline' }, statLine(d) || '—'));
  if (d.role) info.append(h('div', { class: 'sub2' }, d.role));
  if (d.line) info.append(h('div', { class: 'sub2' }, d.line));
  info.append(h('div', { class: 'sub2' }, `그림 폴더 ai/${it.art}/ · 종류 ${rig.kind} · 바라보는 방향 ${rig.face > 0 ? '오른쪽' : '왼쪽'}`));
  const names = [...new Set(rig.parts.flatMap((p) => [p.n, p.blink, p.breath].filter(Boolean)))];
  info.append(h('h4', {}, `부품 ${names.length}장 (눌러서 크게)`),
    h('div', { class: 'parts' }, names.map((n) => h('figure', {}, img(`${A}${it.art}/${n}.png`, 'part'), h('figcaption', {}, n)))));
  const pj = await probeJson(`${A}${it.art}/parts.json`);
  if (pj?.src) {
    const sheet = h('div', { class: 'sheetbox' }, h('div', { class: 'sub2' }, `원본 시트 ${pj.src}`));
    const si = new Image();
    si.onload = () => sheet.append(Object.assign(si, { className: 'zoomable sheet' }));
    si.onerror = () => sheet.append(h('div', { class: 'hint' }, '원본 시트 서버가 꺼져 있어요 (갤러리 전용 설정으로 열면 보입니다)'));
    si.src = `/idg-sheets/${pj.src}?v=${bust}`;
    info.append(h('h4', {}, '원본 시트'), sheet);
  }
  openModal(it.name, it.sub, body, () => stage.destroy());
}

/* ───────── 배경 탭 ───────── */
async function renderBg(tab) {
  const grid = h('div', { class: 'grid wide' });
  const cards = tab.items().map((it) => {
    const box = h('div', { class: 'bgthumb' }, h('div', { class: 'spin' }));
    const card = h('div', { class: 'card bg' }, box, h('div', { class: 'name' }, it.name), h('div', { class: 'sub' }, it.id));
    grid.append(card); return { it, box, card };
  });
  let have = 0;
  await Promise.all(cards.map(async ({ it, box, card }) => {
    const im = await probeImg(`${A}bg/${it.id}_panel.png`);
    if (!im) { box.replaceChildren(soon()); card.classList.add('missing'); return; }
    have++; card.classList.add('ready');
    box.replaceChildren(h('img', { src: im.src, class: 'bgimg' }), h('span', { class: 'dim' }, `${im.naturalWidth}×${im.naturalHeight}`));
    card.addEventListener('click', () => openBg(it));
  }));
  return [h('div', { class: 'tabhead' }, h('b', {}, '배경'), h('span', { class: 'count' }, `그림 있음 ${have} / ${cards.length}`), h('span', { class: 'hint' }, '카드를 누르면 540 높이로 크게 · 재미 요소 자리 겹쳐 보기')), grid];
}

/** 재미 요소 버튼줄 (배경 창 · 재미 요소 탭에서 같이 쓴다) */
function funButtons(stage) {
  const map = {};
  const row = h('div', { class: 'funbtns' }, FUN_INFO.map((f) => {
    const b = h('button', { class: 'btn fun', onclick: () => stage.trigger(f.id) }, f.name);
    map[f.id] = b; return b;
  }));
  const refresh = (usable) => FUN_INFO.forEach((f) => { const ok = usable.includes(f.id); map[f.id].disabled = !ok; map[f.id].title = ok ? '눌러서 띄우기' : '이 배경엔 이 요소가 앉을 자리가 없어요'; });
  stage.onUsable(refresh);
  return { row, refresh, map };
}
function stageControls(stage, { camera = true } = {}) {
  const ov = h('input', { type: 'checkbox', onchange: (e) => stage.setOverlay(e.target.checked) });
  const auto = h('input', { type: 'checkbox', onchange: (e) => stage.setAuto(e.target.checked) });
  const cam = h('input', { type: 'range', min: 0, max: 0, value: 0, class: 'cam', oninput: (e) => stage.setCam(+e.target.value) });
  const camLbl = h('label', { class: 'chk' }, '카메라', cam);
  const row = h('div', { class: 'btngroup' }, h('label', { class: 'chk' }, ov, '재미 요소 자리 겹쳐 보기'), h('label', { class: 'chk' }, auto, '자동으로 계속 띄우기'), camera ? camLbl : null);
  return { row, ov, auto, syncCam() { cam.max = stage.maxCam; cam.value = 0; camLbl.style.display = stage.maxCam > 0 ? '' : 'none'; } };
}

async function openBg(it) {
  const host = h('div', { class: 'bgstage' });
  const stage = await createBgStage(host);
  const ctl = stageControls(stage);
  const fb = funButtons(stage);
  const note = h('div', { class: 'hint' });
  const ok = await stage.setWorld(it.world);
  ctl.syncCam();
  note.textContent = stage.hasSpots() ? `월드 ${it.world} 자리표 있음 — 쓸 수 있는 재미 요소 ${stage.usable.length}종 (회색 버튼은 이 배경에 앉을 자리가 없는 것)` : `월드 ${it.world} 는 자리표(funSpots.js)가 아직 없어요 — 별똥별 · 거미만 나옵니다`;
  if (!ok) note.textContent = '배경 그림이 없어요';
  const body = h('div', { class: 'bgwin' }, host, ctl.row, note, h('h4', {}, '재미 요소 하나씩 띄워 보기 (17종)'), fb.row);
  openModal(it.name, `${it.id}_panel.png · 540 높이 · 게임과 같은 배율`, body, () => stage.destroy());
}

/* ───────── 성(탑) 탭 ───────── */
async function renderCastle(tab) {
  const grid = h('div', { class: 'grid wide' });
  let have = 0;
  const cards = tab.items().map((it) => {
    const row = h('div', { class: 'castlerow' }, h('div', { class: 'spin' }));
    const card = h('div', { class: 'card castle' }, row, h('div', { class: 'name' }, it.name), h('div', { class: 'sub' }, it.prefix + '_hp0~3'));
    grid.append(card); return { it, row, card };
  });
  await Promise.all(cards.map(async ({ it, row, card }) => {
    const ims = await Promise.all([0, 1, 2, 3].map((i) => probeImg(`${A}castles/${it.prefix}_hp${i}.png`)));
    if (!ims.some(Boolean)) { row.replaceChildren(soon()); card.classList.add('missing'); return; }
    have++; card.classList.add('ready');
    row.replaceChildren(...ims.map((im, i) => h('figure', {}, im ? h('img', { src: im.src, class: 'zoomable' }) : soon('없음'), h('figcaption', {}, ['튼튼', '조금 금', '많이 금', '무너짐'][i] + ` hp${i}`))));
  }));
  return [h('div', { class: 'tabhead' }, h('b', {}, '성(탑)'), h('span', { class: 'count' }, `그림 있음 ${have} / ${cards.length}`), h('span', { class: 'hint' }, 'hp0~3 네 단계 나란히 · 그림을 누르면 크게')), grid];
}

/* ───────── 재미 요소 탭 ───────── */
async function renderFun() {
  const host = h('div', { class: 'bgstage' });
  const stage = await createBgStage(host);
  state.funStage = stage;
  const fb = funButtons(stage);
  const ctl = stageControls(stage);
  const worlds = await Promise.all(Array.from({ length: 10 }, (_, i) => probeImg(`${A}bg/w${String(i + 1).padStart(2, '0')}_panel.png`).then((im) => !!im)));
  const sel = h('select', { class: 'sel', onchange: async (e) => { await stage.setWorld(+e.target.value); ctl.syncCam(); } },
    worlds.map((ok, i) => h('option', { value: i + 1, disabled: !ok }, `월드 ${i + 1} 배경${ok ? '' : ' (아직 없음)'}`)));
  const first = worlds.findIndex(Boolean) + 1 || 1;
  sel.value = first;
  await stage.setWorld(first); ctl.syncCam();
  const top = h('div', { class: 'funtop' }, host, h('div', { class: 'btngroup' }, sel), ctl.row);
  const grid = h('div', { class: 'grid fungrid' });
  const cardOf = new Map();
  const upd = (usable) => { for (const [id, c] of cardOf) { const ok = usable.includes(id); c.card.classList.toggle('dim', !ok); c.play.disabled = !ok; c.play.title = ok ? '' : '이 배경엔 자리가 없어요'; } };
  for (const f of FUN_INFO) {
    const play = h('button', { class: 'btn act', onclick: () => stage.trigger(f.id) }, '▶ 재생');
    const pieces = h('div', { class: 'pieces' }, f.pieces.length ? f.pieces.map((p) => h('figure', {}, img(`${A}fun/${p}.png`, 'piece'), h('figcaption', {}, p))) : h('div', { class: 'hint' }, '그림 조각 없이 코드로 그려요'));
    const card = h('div', { class: 'card fun' }, h('div', { class: 'name' }, f.name), h('div', { class: 'sub' }, f.id), pieces, play);
    grid.append(card); cardOf.set(f.id, { card, play });
  }
  stage.onUsable((u) => { fb.refresh(u); upd(u); });
  upd(stage.usable);
  // 원본 시트
  const fj = await probeJson(`${A}fun/fun.json`);
  const sheets = h('div', { class: 'sheets' });
  for (const s of fj?.src || []) { const si = new Image(); si.className = 'zoomable sheet'; si.onload = () => sheets.append(h('figure', {}, si, h('figcaption', {}, '원본 시트 ' + s))); si.src = `/idg-sheets/${s}?v=${bust}`; }
  return [h('div', { class: 'tabhead' }, h('b', {}, '재미 요소 17종'), h('span', { class: 'hint' }, '카드의 «재생»을 누르면 위 배경에서 실제 게임 코드(fun.js)로 띄웁니다')), top, grid, sheets];
}

/* ───────── 알 · HUD · 배너 ───────── */
async function renderEgg(tab) {
  const grid = h('div', { class: 'grid' });
  let have = 0;
  await Promise.all(tab.items().map(async (it) => {
    const im = await probeImg(`${A}eggs/${it.id}.png`);
    const card = h('div', { class: 'card' + (im ? ' ready' : ' missing') }, h('div', { class: 'thumb' }, im ? h('img', { src: im.src, class: 'zoomable pix' }) : soon()), h('div', { class: 'name' }, it.name), h('div', { class: 'sub' }, it.id));
    if (im) have++;
    grid.append(card);
  }));
  const pj = await probeJson(`${A}eggs/parts.json`);
  const sheets = h('div', { class: 'sheets' });
  if (pj?.src) { const si = new Image(); si.className = 'zoomable sheet'; si.onload = () => sheets.append(h('figure', {}, si, h('figcaption', {}, '원본 시트 ' + pj.src))); si.src = `/idg-sheets/${pj.src}?v=${bust}`; }
  return [h('div', { class: 'tabhead' }, h('b', {}, '알'), h('span', { class: 'count' }, `그림 있음 ${have} / ${tab.items().length}`)), grid, sheets];
}
/** 옛 도트판(tools/idg-gallery/old/) 과 바이트가 다르면 «새 그림» */
const OLD = '/tools/idg-gallery/old/';
async function changed(file) {
  try {
    const [a, b] = await Promise.all([GAME + file, OLD + file].map((u) => fetch(u + '?v=' + bust).then((r) => (r.ok && /image/.test(r.headers.get('content-type') || '') ? r.arrayBuffer() : null))));
    if (!a || !b) return null;
    if (a.byteLength !== b.byteLength) return true;
    const x = new Uint8Array(a), y = new Uint8Array(b);
    for (let i = 0; i < x.length; i += 7) if (x[i] !== y[i]) return true;
    return false;
  } catch { return null; }
}
async function renderHud() {
  const j = await probeJson(`${GAME}ui/hud_icons.json`) || {};
  const bases = [...new Set(Object.keys(j).map((k) => k.replace('ui/hud/', '').replace(/_(s|xs)$/, '')))];
  const grid = h('div', { class: 'grid hudgrid' });
  let fresh = 0;
  const strip = h('div', { class: 'hudstrip' });
  await Promise.all(bases.map(async (b) => {
    const e = j['ui/hud/' + b];
    const isNew = await changed(e.file);
    if (isNew) fresh++;
    const sizes = ['', '_s', '_xs'].filter((s) => j['ui/hud/' + b + s]);
    const card = h('div', { class: 'card hud' + (isNew ? ' fresh' : '') },
      h('div', { class: 'hudpair' },
        h('figure', {}, img(GAME + e.file, 'pix'), h('figcaption', {}, isNew ? '새 그림' : '지금')),
        h('figure', { class: 'old' }, img(OLD + e.file, 'pix'), h('figcaption', {}, '옛 도트'))),
      h('div', { class: 'name' }, b, isNew ? h('span', { class: 'newtag' }, 'NEW') : null),
      h('div', { class: 'sub' }, sizes.map((s) => `hud_${b}${s}.png`).join(' · ')));
    card.dataset.b = b;
    grid.append(card);
    strip.append(h('img', { src: GAME + e.file + '?v=' + bust, title: b }));
  }));
  [...grid.children].sort((p, q) => bases.indexOf(p.dataset.b) - bases.indexOf(q.dataset.b)).forEach((c) => grid.append(c));
  [...strip.children].sort((p, q) => bases.indexOf(p.title) - bases.indexOf(q.title)).forEach((c) => strip.append(c));
  const onBg = h('div', { class: 'hudbg', style: `background-image:url(${A}bg/w01_panel.png)` }, h('div', { class: 'hudbar' }, strip));
  return [h('div', { class: 'tabhead' }, h('b', {}, 'HUD 아이콘'), h('span', { class: 'count' }, `새 그림 ${fresh} / ${bases.length}종`), h('span', { class: 'hint' }, '왼쪽 = 지금 게임에 들어간 것 · 오른쪽 = 옛 도트판 · 아래 줄 = 실제 크기(40칸)로 전투 배경 위에')),
    onBg, grid];
}
/* ───────── 로비 (새 그림 · 실제 로비에 입혀 보기) ───────── */
const LOBBY = '/assets/iandragon_game/ai/lobby/';
const LOBBY_PARTS = [
  ['btn_start', '큰 시작 버튼 판', 'webp', '9조각: 70 150 fill / 18px 40px'], ['btn_menu', '메뉴 버튼 판', 'webp', '9조각: 58 80 fill / 12px 18px'],
  ['frame', '상태판 테두리 (박쥐 · 호박)', 'webp', '9조각: 88 118 / 22px 30px (안은 투명)'], ['plate_count', '숫자판 (코인 · 젬)', 'webp', '9조각: 30 60 fill'],
  ['btn_round', '둥근 버튼 판', 'webp', ''], ['btn_square', '네모 버튼 판', 'webp', ''],
];
const LOBBY_ICONS = [['ico_stages', '스테이지 고르기'], ['ico_nest', '용 둥지'], ['ico_hatch', '알 부화장'], ['ico_lab', '연구소 · 보물'], ['ico_quests', '도전 과제'], ['ico_codex', '도감'], ['ico_how', '하는 법'], ['ico_arcade', '오락실로'], ['ico_start', '(여분) 횃불']];
async function renderLobby() {
  const frame = (q, label) => h('figure', { class: 'phone' }, h('iframe', { src: `/tools/idg-gallery/lobby.html${q}`, loading: 'lazy' }), h('figcaption', {}, label, ' · ', h('a', { href: `/tools/idg-gallery/lobby.html${q}`, target: '_blank' }, '새 창')));
  const phones = h('div', { class: 'phones' }, frame('', '지금 로비 (오락실 기본 버튼)'), frame('?skin=a', 'A안 — 모닥불 아기 용들'), frame('?skin=b', 'B안 — 용의 성문 · 몰려오는 좀비'));
  const bgs = h('div', { class: 'grid' }, ['a', 'b'].map((k) => h('div', { class: 'card' }, h('div', { class: 'thumb tall' }, img(`${LOBBY}bg_${k}.webp`)), h('div', { class: 'name' }, `로비 배경 ${k.toUpperCase()}안`), h('div', { class: 'sub' }, `ai/lobby/bg_${k}.webp · 900×1614`))));
  const parts = h('div', { class: 'grid wide' }, LOBBY_PARTS.map(([id, name, ext, note]) => h('div', { class: 'card' }, h('div', { class: 'thumb plate' }, img(`${LOBBY}${id}.${ext}`)), h('div', { class: 'name' }, name), h('div', { class: 'sub' }, `ai/lobby/${id}.${ext}${note ? ' · ' + note : ''}`))));
  const icons = h('div', { class: 'grid small' }, LOBBY_ICONS.map(([id, name]) => h('div', { class: 'card' }, h('div', { class: 'thumb hud' }, img(`${LOBBY}${id}.png`, 'pix')), h('div', { class: 'name' }, name), h('div', { class: 'sub' }, `ai/lobby/${id}.png · 96×96`))));
  const plates = (dir, list) => h('div', { class: 'grid wide' }, list.map(([id, name]) => h('div', { class: 'card' }, h('div', { class: 'thumb plate' }, img(`/assets/iandragon_game/ai/${dir}/${id}`)), h('div', { class: 'name' }, name), h('div', { class: 'sub' }, `ai/${dir}/${id}`))));
  const hud = plates('hud', [['bar_top.webp', '전투 위 띠'], ['bar_bottom_clean.webp', '전투 아래 띠 (위 띠 뒤집기 · 추천)'], ['bar_bottom.webp', '전투 아래 띠 (뼈 · 이끼)'], ['slot.webp', '용 카드 칸'], ['slot_ready.webp', '용 카드 칸 (준비됨)'], ['btn_breath.webp', '브레스 둥근 판'], ['bar_progress.webp', '체력 · 진행 막대 틀'], ['frame_portrait.webp', '박쥐 날개 얼굴 틀']]);
  const dlg = plates('lobby', [['dialog.webp', '창 테두리 (결과 · 일시정지 · 로비 창)'], ['ribbon.webp', '창 제목 리본'], ['tile.webp', '스테이지 칸'], ['tile_boss.webp', '스테이지 칸 (보스)'], ['tile_locked.webp', '스테이지 칸 (잠김)'], ['badge.webp', '월드 탭'], ['badge_on.webp', '월드 탭 (고름)']]);
  const small = h('div', { class: 'grid small' }, ['ico_star_empty', 'ico_lock', 'ico_gift', 'ico_check', 'ico_seal', 'ico_marker', 'ico_key'].map((id) => h('div', { class: 'card' }, h('div', { class: 'thumb hud' }, img(`${LOBBY}${id}.png`, 'pix')), h('div', { class: 'name' }, id.replace('ico_', '')), h('div', { class: 'sub' }, `ai/lobby/${id}.png`))));
  const result = plates('result', [['win.webp', '승리 그림'], ['lose.webp', '패배 그림 (귀엽게)']]);
  return [h('div', { class: 'tabhead' }, h('b', {}, '로비 · 전투 UI'), h('span', { class: 'hint' }, '진짜 로비 화면(IanDragonGameLobby.js)에 새 그림을 입혀 본 것 — 게임 코드는 그대로, 미리보기에서만 CSS 를 덧씌움 (lobby-skin.css · battle-skin.css). «새 창» → 모험 시작 → 전투 HUD 도 새 옷')),
    phones, h('h3', { class: 'sec' }, '배경 (대표님이 하나 고르기)'), bgs, h('h3', { class: 'sec' }, '버튼 판 · 테두리'), parts, h('h3', { class: 'sec' }, '메뉴 아이콘'), icons,
    h('h3', { class: 'sec' }, '전투 HUD 판'), hud, h('h3', { class: 'sec' }, '창 · 스테이지 고르기'), dlg, h('h3', { class: 'sec' }, '작은 아이콘'), small, h('h3', { class: 'sec' }, '결과 그림'), result];
}

/* ───────── 꾸미기 · 상점 · 명예의 전당 (IAN_DRAGON_META.md §7) ───────── */
const META = '/assets/iandragon_game/ai/meta/';
const HATS = [['crown', '왕관'], ['pirate', '해적 모자'], ['wizard', '마법사 고깔'], ['pumpkin', '호박 모자'], ['helmet', '기사 헬멧'], ['ribbon', '리본'], ['party', '파티 고깔'], ['viking', '바이킹 투구'], ['tophat', '마술사 모자 (여분)']];
const NECKS = [['cape', '망토'], ['scarf', '목도리'], ['medal', '메달'], ['skull', '해골 목걸이'], ['bow', '나비넥타이'], ['bell', '방울'], ['lei', '꽃목걸이 (여분)'], ['chain', '금목걸이 (여분)'], ['vine', '덩굴 목걸이 (여분)']];
const FLAGS = [['dragon', '용'], ['flame', '불꽃'], ['moon', '달'], ['star', '별'], ['skull', '해골'], ['crown', '왕관'], ['heart', '하트'], ['rainbow', '무지개'], ['pumpkin', '호박 (여분)']];
const BREATHS = [['default', '기본'], ['rainbow', '무지개'], ['ghost', '보라 유령불'], ['gold', '황금'], ['ice', '얼음 파랑']];
const FRAMES = [['wood', '나무'], ['silver', '은'], ['gold', '금'], ['fire', '불꽃']];
const BADGES = [['hunter', '좀비 사냥꾼'], ['hundred', '백 판의 용'], ['stars', '별 수집가'], ['weekhero', '이번 주 용사'], ['boss', '보스 사냥꾼'], ['buddies', '단짝 친구'], ['duel', '대결 왕'], ['hard', '어려움 정복'], ['egg', '알 박사'], ['breath', '브레스 달인'], ['nest', '둥지 지킴이'], ['explorer', '탐험가']];
async function renderMeta() {
  // 꾸미기 미리보기 : 진짜 rig 대장 용에 모자 · 목 장식을 붙여 움직인다
  const host = h('div', { class: 'stage' });
  const stage = await createCharStage(host, 520, 320);
  const leaders = ['novart', 'aquantis', 'forestia', 'crimsonde', 'volttail', 'solaris', 'sandscale', 'shadowfen', 'frostwing', 'goldrex'];
  const look = { hat: 'hat_crown', neck: 'neck_cape' };
  let lead = 'novart';
  const load = async () => { await stage.load(lead, 1); stage.setScale(2); stage.setLook(look); };
  await load();
  const sel = h('select', { class: 'sel', onchange: async (e) => { lead = e.target.value; await load(); } }, leaders.map((id) => h('option', { value: id }, id)));
  const lineHost = h('div', { class: 'stage' });
  const lineup = await createLineup(lineHost, leaders);
  state.funStage = { destroy() { stage.destroy(); lineup.destroy(); } };
  const apply = () => { stage.setLook(look); lineup.setLook(look); };
  apply();
  const pick = (slot, list, prefix) => h('div', { class: 'lookrow' }, h('button', { class: 'btn', onclick: () => { look[slot] = null; apply(); } }, '없음'),
    list.map(([id, name]) => h('button', { class: 'lookbtn', title: name, onclick: () => { look[slot] = `${prefix}_${id}`; apply(); } }, h('img', { src: `${META}${prefix}_${id}.png?v=${bust}` }))));
  const tryOn = h('div', { class: 'charwin' }, h('div', { class: 'left' }, host, h('div', { class: 'btngroup' }, h('span', { class: 'lbl' }, '대장 용'), sel, h('button', { class: 'btn act', onclick: () => stage.attack() }, '⚔ 브레스 자세'), h('button', { class: 'btn', onclick: () => stage.base('walk') }, '걷기'), h('button', { class: 'btn', onclick: () => stage.base('idle') }, '쉬기'))),
    h('div', { class: 'info' }, h('h4', {}, '모자 (눌러서 씌우기)'), pick('hat', HATS, 'hat'), h('h4', {}, '목 장식'), pick('neck', NECKS, 'neck'),
      h('div', { class: 'hint' }, '단추 = 상점 아이콘(정면 상품 그림) · 용이 쓴 모습 = 착용 부품(옆모습 · 게임 칸 굵기). 붙는 자리는 tools/idg-wear-fit.mjs 가 대장 용마다 머리 · 목 픽셀을 재서 계산 → ai/meta/wear.json')));
  const wearGrid = (list) => h('div', { class: 'grid small' }, list.map(([id, name]) => {
    const f = /^neck_(?!cape)/.test(id) ? [`${id}_back`, `${id}_front`] : [id];
    return h('div', { class: 'card' }, h('div', { class: 'thumb meta wear' }, f.map((x) => img(`${META}wear/${x}.png`, 'pix'))), h('div', { class: 'name' }, name), h('div', { class: 'sub' }, f.map((x) => `wear/${x}.png`).join(' · ')));
  }));
  const grid = (list, prefix, cls, size) => h('div', { class: 'grid ' + cls }, list.map(([id, name]) => h('div', { class: 'card' }, h('div', { class: 'thumb meta' }, img(`${META}${prefix}_${id}.png`)), h('div', { class: 'name' }, name), h('div', { class: 'sub' }, `ai/meta/${prefix}_${id}.png · ${size}`))));
  const shop = h('div', { class: 'grid' },
    h('div', { class: 'card' }, h('div', { class: 'thumb tall' }, img(`${META}shop_bg.webp`)), h('div', { class: 'name' }, '상점 배경'), h('div', { class: 'sub' }, 'ai/meta/shop_bg.webp · 720×1560')),
    h('div', { class: 'card' }, h('div', { class: 'thumb tall' }, img(`${META}shopkeeper.png`)), h('div', { class: 'name' }, '상점 주인 (좀비 상인)'), h('div', { class: 'sub' }, 'ai/meta/shopkeeper.png · 512×512')),
    ...[['icon_shop', '용 시장 타일'], ['icon_hall', '명예의 전당 타일'], ['icon_look', '꾸미기 타일']].map(([id, name]) => h('div', { class: 'card' }, h('div', { class: 'thumb' }, img(`/assets/iandragon_game/ui/lobby/${id}.png`)), h('div', { class: 'name' }, name), h('div', { class: 'sub' }, `ui/lobby/${id}.png · 256×256`))),
    ...[['shop_coins', '코인 더미 (여분)'], ['shop_gems', '젬 주머니 (여분)'], ['shop_basket', '장바구니 (여분)']].map(([id, name]) => h('div', { class: 'card' }, h('div', { class: 'thumb' }, img(`${META}${id}.png`)), h('div', { class: 'name' }, name), h('div', { class: 'sub' }, `ai/meta/${id}.png · 96×96`))));
  return [h('div', { class: 'tabhead' }, h('b', {}, '꾸미기 · 상점 · 명예의 전당'), h('span', { class: 'hint' }, '기획서 IAN_DRAGON_META.md §7 — 이름 · 크기는 겜부장 규격 (ai/meta/)')),
    tryOn, h('h3', { class: 'sec' }, '대장 용 10마리 착용 비교 (같은 꾸미기 · 쉬는 자세)'), lineHost,
    h('h3', { class: 'sec' }, '착용 부품 — 모자 (옆모습 · 머리에 맞춘 크기 · ai/meta/wear/)'), wearGrid(HATS.map(([id, n]) => [`hat_${id}`, n])),
    h('h3', { class: 'sec' }, '착용 부품 — 목 장식 (고리는 뒤 반쪽 = 몸통 뒤 · 앞 반쪽 = 몸통 앞 · 망토 = 몸통 뒤)'), wearGrid(NECKS.map(([id, n]) => [`neck_${id}`, n])),
    h('h3', { class: 'sec' }, '상점 아이콘 — 모자 (정면 상품 그림 · 256×256)'), grid(HATS, 'hat', 'small', '256×256'),
    h('h3', { class: 'sec' }, '상점 아이콘 — 목 장식 (정면 상품 그림 · 256×256)'), grid(NECKS, 'neck', 'small', '256×256'),
    h('h3', { class: 'sec' }, '성 깃발 (128×192)'), grid(FLAGS, 'flag', 'small', '128×192'),
    h('h3', { class: 'sec' }, '브레스 색 (128×128)'), grid(BREATHS, 'breath', 'small', '128×128'),
    h('h3', { class: 'sec' }, '얼굴 테두리 (256×256 · 안쪽 투명)'), grid(FRAMES, 'frame', 'small', '256×256'),
    h('h3', { class: 'sec' }, '칭호 배지 (96×96)'), grid(BADGES, 'badge', 'small', '96×96'),
    h('h3', { class: 'sec' }, '상점 · 타일'), shop];
}

async function renderBanner(tab) {
  const grid = h('div', { class: 'grid wide' });
  await Promise.all(tab.items().map(async (it) => {
    const im = await probeImg(`/assets/ui/${it.id}.webp`);
    grid.append(h('div', { class: 'card' + (im ? ' ready' : ' missing') }, h('div', { class: 'thumb banner' }, im ? h('img', { src: im.src, class: 'zoomable' }) : soon()), h('div', { class: 'name' }, it.name), h('div', { class: 'sub' }, `${it.id}.webp${im ? ` · ${im.naturalWidth}×${im.naturalHeight}` : ''}`)));
  }));
  return [h('div', { class: 'tabhead' }, h('b', {}, '배너')), grid];
}

buildTabs();
render();
