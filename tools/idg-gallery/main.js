/**
 * 이안 드래곤 «좀비와 드래곤» 에셋 갤러리 (그림 담당) — 개발 서버 전용 도구. 게임 코드(src)는 import 만 한다.
 * 탭 → 카드 → 클릭하면 큰 창(캐릭터는 실제 rig.js 로 움직임 · 배경은 재미 요소 자리 확인).
 */
import { TABS, FUN_INFO, A, RAR } from './lists.js';
import { makeThumb, getRig, createCharStage, createBgStage } from './viewer.js';

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
  const fn = { rig: renderRig, bg: renderBg, castle: renderCastle, fun: renderFun, egg: renderEgg, hud: renderHud, banner: renderBanner }[tab.kind];
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
      h('div', { class: 'name' }, it.name), h('div', { class: 'sub' }, it.sub));
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
async function renderHud() {
  const j = await probeJson(`${GAME}ui/hud_icons.json`);
  const grid = h('div', { class: 'grid small' });
  const entries = Object.entries(j || {});
  await Promise.all(entries.map(async ([key, e]) => {
    const im = await probeImg(GAME + e.file);
    grid.append(h('div', { class: 'card' + (im ? ' ready' : ' missing') }, h('div', { class: 'thumb hud' }, im ? h('img', { src: im.src, class: 'zoomable pix' }) : soon()), h('div', { class: 'name' }, key.replace('ui/hud/', '')), h('div', { class: 'sub' }, `${e.file.replace('ui/', '')} · ${e.w}×${e.h}`)));
  }));
  return [h('div', { class: 'tabhead' }, h('b', {}, 'HUD 아이콘'), h('span', { class: 'count' }, `${entries.length}개`)), grid];
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
