/**
 * 조립 점검 화면 (그림 담당 겜보조 2 · 2026-11-12 · 대표님 «보스 조립이 피카소 그림 같다 — 캐릭터를 하나하나 점검하는 걸 만들어»)
 *
 * 게임 render/rig.js 의 createRigged 를 그대로 import 해서 움직인다 (src 는 읽기만).
 *  왼쪽 = 원래 rig.json · 오른쪽 = 보정 표(ai/meta/ rigfix.json 날개 · 꼬리 → rigfix_boss.json → rigfix_zombie.json → rigfix_dragon_v2.json 을 겹침) + 이 화면에서 고친 것.
 *  부품 표 : 그리는 순서(1 = 맨 뒤) · 켜고 끄기 · ▲▼ 순서 바꾸기 · 기준점 a · 자리 p · 뒤집기. 줄에 마우스를 올리면 그 부품 상자가 두 화면에 뜬다.
 *  고친 값은 이 브라우저에만 임시로 남고(localStorage), «보정 표 JSON» 을 복사해 보스는 rigfix_boss.json, 일반은 rigfix_zombie.json 에 붙인다.
 */
import { Application, Assets, Container, Graphics } from 'pixi.js';
import { createRigged } from '/src/games/iandragon_game/render/rig.js';
import { auditRig } from './rigcheck-audit.js';
import IDS from './rigcheck-ids.json';   // 웹 빌드(/admin/idg-gallery/rigcheck.html)에도 묶여 들어가게 import

const BASE = '/assets/iandragon_game/ai/';
const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) k.startsWith('on') ? e.addEventListener(k.slice(2), v) : k === 'cls' ? (e.className = v) : e.setAttribute(k, v); e.append(...kids.filter((x) => x != null)); return e; };
const DRAFT_KEY = 'idg_rigcheck_draft_v1';
const S = { list: [], table: {}, prev: {}, beforeMode: 'raw', id: null, rig: null, draft: null, state: 'idle', paused: false, step: false, scale: 3, gameDir: true, boxes: true, hover: null, sel: null };

/** 보정 표 한 줄을 rig 에 얹는다 (tools/idg-rigcheck.mjs applyFix 와 같은 규칙) */
export function applyFix(rig, F = {}) {
  let parts = rig.parts.map((p) => ({ ...p, a: [...p.a], p: [...p.p], file: p.n, ...structuredClone(F.parts?.[p.n] || {}) }));
  for (const p of parts) { if (F.files?.[p.n]) p.file = F.files[p.n]; if (p.blink && F.files?.[p.blink]) p.blinkFile = F.files[p.blink]; p.hidden = (F.hidden || []).includes(p.n); }
  if (F.order) parts = [...F.order.map((n) => parts.find((p) => p.n === n)).filter(Boolean), ...parts.filter((p) => !F.order.includes(p.n))];
  return { ...rig, parts, ...(F.scale > 0 ? { scale: (rig.scale || 1) * F.scale } : {}) };
}
/** 세 표를 캐릭터마다 겹친다 (tools/idg-rigcheck.mjs mergeFix · wingTailFix 와 같은 규칙) */
function mergeFix(wingTail, ...tables) {
  const wt = {};
  for (const [id, v] of Object.entries(wingTail || {})) {
    const F = (wt[id] = {});
    for (const n of ['wing', 'tail']) if (v[n]) (F.parts ||= {})[n] = { p: v[n] };
    if (v.files) F.files = { ...v.files };
  }
  const out = {};
  for (const T of [wt, ...tables]) for (const [id, F] of Object.entries(T || {})) {
    const M = (out[id] ||= {});
    if (F.order) M.order = [...F.order];
    if (F.files) M.files = { ...M.files, ...F.files };
    if (typeof F.scale === 'number') M.scale = F.scale;
    for (const [n, d] of Object.entries(F.parts || {})) (M.parts ||= {})[n] = { ...M.parts?.[n], ...d };
  }
  return out;
}
const urlOf = (p) => `${BASE}${S.id}/${p.file || p.n}.png`;

/* ───────── 그리기 (원래 · 고친 것 두 판) ───────── */
const stages = {};
async function makeStage(key, host) {
  const app = new Application();
  await app.init({ width: host.clientWidth, height: 560, background: '#2a2140', antialias: false, resolution: 1 });
  host.append(app.canvas);
  const ground = new Graphics(), holder = new Container(), over = new Graphics();
  app.stage.addChild(ground, holder, over);
  stages[key] = { app, ground, holder, over, R: null, host };
  app.ticker.add((tk) => tick(key, tk.deltaMS / 1000));
}

async function texFor(rig) {
  const tex = {};
  await Promise.all(rig.parts.flatMap((p) => [[p.n, p.file || p.n], p.blink && [p.blink, p.blinkFile || p.blink], p.breath && [p.breath, p.breath]]).filter(Boolean).map(async ([n, f]) => {
    const t = await Assets.load(`${BASE}${S.id}/${f}.png`); t.source.scaleMode = 'nearest'; tex[n] = t;
  }));
  return tex;
}

async function build(key, rig) {
  const st = stages[key];
  st.R?.root.destroy({ children: true }); st.R = null;
  const tex = await texFor(rig);
  const R = createRigged({ rig, tex }, S.scale, S.gameDir ? (rig.kind === 'zombie' ? -1 : 1) : rig.face);
  R.t = 0; R.blinkAt = 999; R.set(S.state);
  const body = R.root.children[0];
  rig.parts.forEach((p, i) => { body.children[i].visible = !p.hidden; });
  st.R = R; st.rig = rig;
  st.holder.addChild(R.root);
  layoutStage(key);
  for (const o of Object.values(stages)) if (o.R) { o.R.t = 0; o.R.st = 0; o.R.update(0.0001); }   // 두 판이 같은 박자로 움직이게
}

function layoutStage(key) {
  const st = stages[key], w = st.app.screen.width, h = st.app.screen.height, gy = h - 40;
  st.R && st.R.root.position.set(w / 2 | 0, gy);
  st.ground.clear().moveTo(0, gy).lineTo(w, gy).stroke({ width: 1, color: 0xffb347, alpha: 0.7 })
    .moveTo(w / 2 - 6, gy).lineTo(w / 2 + 6, gy).moveTo(w / 2, gy - 6).lineTo(w / 2, gy + 6).stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
}

function tick(key, dt) {
  const st = stages[key]; if (!st.R) return;
  if (!S.paused || S.step) st.R.update(S.paused ? 1 / 30 : dt);
  if (key === 'after') S.step = false;
  st.over.clear();
  if (!S.boxes) return;
  const body = st.R.root.children[0];
  st.rig.parts.forEach((p, i) => {
    const s = body.children[i]; if (!s || !s.visible) return;
    const on = p.n === S.hover || p.n === S.sel, b = s.getBounds(), g = s.getGlobalPosition();
    if (on) st.over.rect(b.x, b.y, b.width, b.height).stroke({ width: 2, color: 0x7dffa0 });
    st.over.circle(g.x, g.y, on ? 4 : 2).fill(on ? 0xff4060 : 0xff8090);
  });
}

/* ───────── 부품 표 ───────── */
function draftRig() { return applyFix(S.rig, S.draft); }
function setDraft(fn) {
  fn(S.draft);
  saveDraft();
  build('after', draftRig()).then(renderTable);
  refreshWarn();
}
function partFix(n) { S.draft.parts ||= {}; return (S.draft.parts[n] ||= {}); }
function curOrder() { return draftRig().parts.map((p) => p.n); }

function numIn(v, on, step = 1) {
  return el('input', { type: 'number', step, value: v, oninput: (e) => { const x = Number(e.target.value); if (Number.isFinite(x)) on(x); } });
}

function renderTable() {
  const rig = draftRig(), orig = S.rig.parts, tb = $('#parts tbody');
  tb.replaceChildren();
  rig.parts.forEach((p, i) => {
    const o = orig.find((q) => q.n === p.n), oi = orig.indexOf(o);
    const ch = (k) => JSON.stringify(p[k]) !== JSON.stringify(o[k]) ? 'chg' : '';
    const mv = (d) => setDraft((D) => { const ord = curOrder(), j = i + d; if (j < 0 || j >= ord.length) return; [ord[i], ord[j]] = [ord[j], ord[i]]; D.order = ord; });
    const setA = (k, x) => setDraft(() => { const f = partFix(p.n); f.a = [...(f.a || p.a)]; f.a[k] = x; });
    const setP = (k, x) => setDraft(() => { const f = partFix(p.n); f.p = [...(f.p || p.p)]; f.p[k] = x; });
    const tr = el('tr', { cls: (p.n === S.sel ? 'sel ' : '') + (p.hidden ? 'off' : ''), onmouseenter: () => (S.hover = p.n), onmouseleave: () => (S.hover = null), onclick: (e) => { if (e.target.tagName === 'TD') { S.sel = S.sel === p.n ? null : p.n; renderTable(); } } },
      el('td', { cls: oi !== i ? 'chg' : '' }, String(i + 1), oi !== i ? el('small', {}, ` (원래 ${oi + 1})`) : null),
      el('td', {}, el('input', { type: 'checkbox', ...(p.hidden ? {} : { checked: '' }), onchange: (e) => setDraft((D) => { const h = new Set(D.hidden || []); e.target.checked ? h.delete(p.n) : h.add(p.n); D.hidden = [...h]; }) })),
      el('td', {}, el('button', { onclick: () => mv(-1), title: '한 칸 뒤로' }, '▲'), el('button', { onclick: () => mv(1), title: '한 칸 앞으로' }, '▼')),
      el('td', {}, el('b', {}, p.n), p.file !== p.n ? el('small', { cls: 'chg' }, ` ← ${p.file}.png`) : null, el('br'), el('img', { src: urlOf(p), cls: 'thumb' + (p.flip ? ' flip' : '') })),
      el('td', {}, p.move || ''),
      el('td', { cls: ch('a') }, numIn(p.a[0], (x) => setA(0, x), 0.01), numIn(p.a[1], (x) => setA(1, x), 0.01)),
      el('td', { cls: ch('p') }, numIn(p.p[0], (x) => setP(0, x)), numIn(p.p[1], (x) => setP(1, x))),
      el('td', { cls: ch('flip') }, el('input', { type: 'checkbox', ...(p.flip ? { checked: '' } : {}), onchange: (e) => setDraft(() => { partFix(p.n).flip = e.target.checked; }) })),
    );
    tb.append(tr);
  });
  $('#json').value = JSON.stringify({ [S.id]: exportFix() }, null, 1);
}

/** 원래와 다른 것만 표에 적는다 */
function exportFix() {
  const rig = draftRig(), out = {}, orig = S.rig.parts;
  const ord = rig.parts.map((p) => p.n);
  if (ord.join() !== orig.map((p) => p.n).join()) out.order = ord;
  for (const p of rig.parts) {
    const o = orig.find((q) => q.n === p.n), d = {};
    for (const k of ['a', 'p', 'flip', 'move']) if (JSON.stringify(p[k] ?? false) !== JSON.stringify(o[k] ?? false)) d[k] = p[k];
    if (Object.keys(d).length) (out.parts ||= {})[p.n] = d;
    if (p.file !== p.n) (out.files ||= {})[p.n] = p.file;
  }
  if (S.draft.scale) out.scale = S.draft.scale;
  return out;
}

async function refreshWarn() {
  const box = $('#warn'), before = await auditRig(applyFix(S.rig), urlOf), after = await auditRig(draftRig(), urlOf);
  const line = (w) => el('li', { cls: w.lv, onmouseenter: () => (S.hover = w.parts[0]), onmouseleave: () => (S.hover = null) }, w.t);
  box.replaceChildren(
    el('div', {}, el('b', {}, `원래 : ${before.length ? before.length + '건' : '문제 없음'}`), el('ul', {}, ...before.map(line))),
    el('div', {}, el('b', {}, `고친 것 : ${after.length ? after.length + '건' : '문제 없음 ✓'}`), el('ul', {}, ...after.map(line))),
  );
  const row = document.querySelector(`#list [data-id="${S.id}"] .cnt`);
  if (row) { row.textContent = after.filter((w) => w.lv === 'bad').length || '✓'; row.className = 'cnt ' + (after.some((w) => w.lv === 'bad') ? 'bad' : 'ok'); }
}

/* ───────── 캐릭터 고르기 ───────── */
function loadDrafts() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; } }
function saveDraft() { try { const all = loadDrafts(); all[S.id] = S.draft; localStorage.setItem(DRAFT_KEY, JSON.stringify(all)); } catch { /* 저장 못 해도 화면은 돈다 */ } }

async function pick(id) {
  S.id = id; S.sel = null;
  location.hash = id;
  document.querySelectorAll('#list li').forEach((li) => li.classList.toggle('on', li.dataset.id === id));
  S.rig = await (await fetch(`${BASE}${id}/rig.json`, { cache: 'no-store' })).json();
  S.draft = loadDrafts()[id] || structuredClone(S.table[id] || {});
  $('#title').textContent = `${id} · ${S.rig.kind} · 그림 방향 ${S.rig.face > 0 ? '오른쪽' : '왼쪽'} · 부품 ${S.rig.parts.length}`;
  await Promise.all([build('before', applyFix(S.rig, S.beforeMode === 'prev' ? S.prev[id] : undefined)), build('after', draftRig())]);
  renderTable(); refreshWarn();
}

function renderList() {
  const groups = [['보스', (r) => r.boss], ['좀비', (r) => !r.boss && r.kind === 'zombie'], ['용 · 기타', (r) => !r.boss && r.kind !== 'zombie']];
  const q = $('#q').value.trim();
  $('#list').replaceChildren(...groups.map(([name, f]) => el('section', {}, el('h3', {}, name),
    el('ul', {}, ...S.list.filter(f).filter((r) => !q || r.id.includes(q)).map((r) => el('li', { 'data-id': r.id, cls: r.id === S.id ? 'on' : '', onclick: () => pick(r.id) },
      r.id, S.table[r.id] ? el('i', { title: '보정 표에 있음' }, ' ✎') : null, el('span', { cls: 'cnt' }, '')))))));
}

/** 목록 옆 숫자 = 고친 뒤 남은 큰 문제 수 (보스 먼저 · 한가할 때 하나씩) */
async function auditAll() {
  for (const r of S.list) {
    const rig = await (await fetch(`${BASE}${r.id}/rig.json`)).json();
    const F = loadDrafts()[r.id] || S.table[r.id];
    const w = await auditRig(applyFix(rig, F), (p) => `${BASE}${r.id}/${p.file || p.n}.png`);
    const c = document.querySelector(`#list [data-id="${r.id}"] .cnt`), bad = w.filter((x) => x.lv === 'bad').length;
    if (c) { c.textContent = bad || '✓'; c.className = 'cnt ' + (bad ? 'bad' : 'ok'); }
    await new Promise((ok) => setTimeout(ok, 0));
  }
}

async function main() {
  const table = (n) => fetch(`${BASE}meta/${n}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const [list, wt, boss, zombie, dragon] = await Promise.all([
    IDS,
    table('rigfix.json'), table('rigfix_boss.json'), table('rigfix_zombie.json'), table('rigfix_dragon_v2.json'),
  ]);
  S.list = list; S.table = mergeFix(wt, boss, zombie, dragon);
  S.prev = mergeFix(wt, boss, zombie);   // «용 표 전» = 11/12 용 보정 직전 게임 모습 (자세 사진 --before prev)
  $('#back').href = location.pathname.startsWith('/admin/') ? './' : '/tools/idg-gallery.html';   // 웹 = /admin/idg-gallery/ · 개발 서버 = /tools/
  await makeStage('before', $('#stBefore'));
  await makeStage('after', $('#stAfter'));
  renderList();
  $('#q').oninput = renderList;
  document.querySelectorAll('[data-state]').forEach((b) => (b.onclick = () => {
    S.state = b.dataset.state; document.querySelectorAll('[data-state]').forEach((x) => x.classList.toggle('on', x === b));
    for (const st of Object.values(stages)) st.R?.set(S.state);
  }));
  $('#pause').onclick = () => { S.paused = !S.paused; $('#pause').textContent = S.paused ? '▶ 움직이기' : '⏸ 멈추기'; };
  $('#stepBtn').onclick = () => { S.paused = true; S.step = true; for (const st of Object.values(stages)) st.R?.update(1 / 30); $('#pause').textContent = '▶ 움직이기'; };
  $('#scale').oninput = (e) => { S.scale = Number(e.target.value); pick(S.id); };
  $('#gameDir').onchange = (e) => { S.gameDir = e.target.checked; pick(S.id); };
  $('#boxes').onchange = (e) => { S.boxes = e.target.checked; };
  $('#reset').onclick = () => { if (!confirm(`${S.id} 를 보정 표(파일) 상태로 되돌릴까요? 이 화면에서 고친 것이 지워집니다.`)) return; const all = loadDrafts(); delete all[S.id]; localStorage.setItem(DRAFT_KEY, JSON.stringify(all)); pick(S.id); };
  $('#raw').onclick = () => { S.draft = {}; saveDraft(); pick(S.id); };
  $('#copy').onclick = () => { navigator.clipboard.writeText($('#json').value); $('#copy').textContent = '복사됨 ✓'; setTimeout(() => ($('#copy').textContent = '보정 표 JSON 복사'), 1200); };
  const fit = () => { for (const [k, st] of Object.entries(stages)) { st.app.renderer.resize(Math.max(200, st.host.clientWidth - 2), 560); layoutStage(k); } };
  addEventListener('resize', fit); fit();   // 첫 판은 옆 판이 붙기 전 폭으로 만들어지므로 한 번 맞춘다
  await pick(decodeURIComponent(location.hash.slice(1)) || (S.list.some((r) => r.id === 'bossLord') ? 'bossLord' : S.list[0].id));   // 처음엔 최종 보스(월드 10)
  /* 자세 고정 (tools/idg-rigcheck-poses.mjs 가 자세별 전/후 사진을 찍을 때 씀) — t 초 · 상태 시작 뒤 st 초의 모습으로 멈춘다 */
  window.__rigcheck = {
    pick, ready: true,
    setBefore(m) { S.beforeMode = m; },
    pose(state, t, st = t) { S.paused = true; for (const o of Object.values(stages)) if (o.R) { o.R.set(state); o.R.t = t; o.R.st = st; o.R.update(0.0001); } },
  };
  auditAll();
}
main();
