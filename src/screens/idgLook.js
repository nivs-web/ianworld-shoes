/**
 * 좀비와 드래곤 — «꾸미기» 창 (META 기획서 2장 · 2026-11-11)
 * 칸별로 가진 것 중 하나를 고른다(없음 포함). 능력치는 그대로 — 모양만 바뀐다.
 * 저장 필드 : look (encodeLook 글자 'h3.n1.b2.f4.r0.t7') · title (칭호 id, 얻은 것만) · leader ('auto' 또는 연 리더 id — 연구소 리더 칸과 같은 값).
 * showLook({ idg, save }) — idg = 지금 저장값, save(part) = 저장 후 새 idg 를 돌려주는 함수(G.saveIdg).
 *
 * 11/12 대표님 :
 *  1) 위 미리보기 = 로비 무대 위 «내 용»과 같은 모습 (몸 전체 · 숨쉬기 rig idle · 모자 · 목 장식) — 작은 석판 무대 + 어두운 보라 + 키트 카드 판 테.
 *     브레스 색 = 작은 불꽃 표 · 성 깃발 = 용 옆 깃대. 고르는 즉시 반영.
 *  2) 맨 위 «내 용 고르기» — 연구소 리더 고르기와 같은 데이터(g.leader · 월드 클리어로 열림 · '자동(월드 추천)'). 잠긴 용 = 자물쇠 + «월드 N 깨면 열려요».
 *  3) 가로 = 미리보기 왼쪽 · 고르기 오른쪽 / 세로 = 미리보기 위 (모양 = idg-look.css)
 *  4) 고를 때 목록을 다시 그리지 않고(«.on» 표만 바꿈) 스크롤 자리를 지킨다.
 */
import { el, button, presentOverlay } from './ui.js';
import * as Sfx from '../audio/sfx.js';
import { kitSection, kitRow, kitKeepScroll } from './idgKit.js';   /* UI 키트 (11/12) — 가져다 쓰기만 */
import { dressedCanvas } from './idgDressed.js';
import { SLOTS, SLOT_NAME, LOOKS, TITLES, encodeLook, decodeLook, hasItem, artOf } from '../games/iandragon_game/data/looks.js';
import { LEADERS } from '../games/iandragon_game/data/leaders.js';
import { leaderFor, stageByNo } from '../games/iandragon_game/render/battleSetup.js';
import '../styles/idg-look.css';

const AI = '/assets/iandragon_game/ai/';
const B = '/assets/iandragon_game/';
const imgFor = artOf;   // 보조 그림 이름 맞춤 (looks.js)
const FRAME_COLOR = { wood: '#a0703a', silver: '#c8d0d8', gold: '#FFC93C', fire: '#ff6b2b' };
const CW = 360, CH = 300;   // 미리보기 캔버스 속 크기 (CSS 가 칸에 맞춰 늘림 · 도트 그대로)

/** 그림이 없으면 글자로 */
function pic(slot, id, name, style) {
  const wrap = el('span', { style: 'display:grid;place-items:center;overflow:hidden;font-size:9px;color:#bba;text-align:center;' + (style || 'width:36px;height:36px') });
  const img = el('img', { src: imgFor(slot, id), alt: '', style: 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated' });
  img.onerror = () => { wrap.replaceChildren(document.createTextNode(String(name || id).slice(0, 4))); };
  wrap.append(img);
  return wrap;
}

/** 지금 판 리더 (연구소 설정 g.leader → 실제 무대 용) — 로비 leaderOf · 전투 leaderFor 와 같은 계산 */
const stageNow = (g) => stageByNo(Math.min(100, (g.cleared || 0) + 1));
const actualLeader = (g) => { try { return leaderFor(stageNow(g), g) || 'novart'; } catch { return 'novart'; } };
const autoLeader = (g) => { try { return leaderFor(stageNow(g), { ...g, leader: 'auto' }) || 'novart'; } catch { return 'novart'; } };
const openWorlds = (g) => Math.floor((g.cleared || 0) / 10);
const wantOf = (g) => (!g.leader || !LEADERS[g.leader] ? 'auto' : g.leader);

/**
 * 살아 있는 용 한 마리 (로비 myDragon · liveRig 와 같은 방법 : rig idle + wear.json 모자 · 목 장식) — Pixi 캔버스 하나를 창이 닫힐 때까지 다시 쓴다.
 * WebGL 이 안 되면 꾸민 정지 그림(dressedCanvas)으로.
 */
function liveDragon(host) {
  let app = null, appP = null, gen = 0, R = null, follow = [], dead = false;
  const tick = (tk) => {
    if (!host.isConnected) { kill(); return; }   // 창이 사라졌으면 스스로 정리
    if (R) { R.update(Math.min(0.1, tk.deltaMS / 1000)); for (const [bx, t] of follow) bx.position.copyFrom(t.position); }
  };
  function ensureApp(Application) {
    if (!appP) appP = (async () => {
      const a = new Application();
      await a.init({ width: CW, height: CH, backgroundAlpha: 0, antialias: false, resolution: 1, autoDensity: false, preference: 'webgl' });
      a.ticker.maxFPS = 30; a.ticker.add(tick);
      a.canvas.className = 'idg-lk-dragon live'; a.canvas.setAttribute('aria-hidden', 'true');
      app = a; return a;
    })();
    return appP;
  }
  async function build(ld, look) {
    const [{ Application, Assets, Container, Sprite }, { loadRig, createRigged }] = await Promise.all([import('pixi.js'), import('../games/iandragon_game/render/rig.js')]);
    const [data, Wr] = await Promise.all([loadRig(ld), fetch(`${B}ai/meta/wear.json`).then((r) => r.json()).catch(() => null)]);
    const lk = decodeLook(look || ''), L = Wr?.leaders?.[ld], hk = 'hat_' + lk.hat, nk = 'neck_' + lk.neck;
    const wt = (f) => Assets.load(B + f).then((t) => { t.source.scaleMode = 'nearest'; return t; }).catch(() => null);
    const hatE = lk.hat && Wr?.items?.[hk] && L?.hat?.[hk];
    let rd = data;
    if (hatE?.head) { const tex = { ...data.tex }; for (const [n, f] of Object.entries(hatE.head)) { const t = await wt(f); if (t) tex[n] = t; } rd = { rig: data.rig, tex }; }   // 덮는 모자 = 모자용 머리
    const r = createRigged(rd, 1, 1); r.set('idle');
    const body = r.root.children[0], idx = (n) => data.rig.parts.findIndex((q) => q.n === n);
    const head = body.children[idx('head')], torso = body.children[idx('torso')], fl = [];
    if (hatE && head) { const t = await wt(Wr.items[hk].file); if (t) { const sp = new Sprite(t); sp.position.set(hatE.x, hatE.y); head.addChild(sp); } }
    const it = lk.neck && L && Wr?.items?.[nk];
    if (it && torso) {
      const at = it.layer === 'behind' ? L.nape : L.neck;
      const mk = async (f) => { const t = await wt(f); if (!t) return null; const sp = new Sprite(t); sp.anchor.set(it.anchor[0], it.anchor[1]); sp.position.set(at.x, at.y); return sp; };
      const behind = async (f) => { const sp = await mk(f); if (!sp) return; const bx = new Container(); bx.addChild(sp); body.addChildAt(bx, body.getChildIndex(torso)); fl.push([bx, torso]); };
      if (it.layer === 'split') { const fr = await mk(it.files.front); if (fr) torso.addChild(fr); await behind(it.files.back); } else await behind(it.file);
    }
    r.update(0); for (const [bx, t] of fl) bx.position.copyFrom(t.position);
    /* 크기 : 용마다 키가 달라도 칸에 꼭 맞게 · 발(rig 원점) = 캔버스 아래 가운데 = 석판 위 · 날개를 펄럭여도 안 잘리게 6% 여유 */
    const bd = r.root.getLocalBounds(), up = -bd.y, half = Math.max(-bd.x, bd.x + bd.width), pad = 3;
    const k = Math.min((CH - pad * 2) / up, (CW / 2 - pad) / half) * 0.94;
    r.root.scale.set(k * r.root.scale.x, k * r.root.scale.y); r.root.position.set(CW / 2, CH - pad);
    return { r, fl, Application };
  }
  function still(ld, look, my) {
    dressedCanvas(ld, look, { fit: true, W: CW, H: CH, pad: 3 }).then((c) => {
      if (my !== gen || dead) return;
      c.className = 'idg-lk-dragon still'; c.setAttribute('aria-hidden', 'true');
      host.replaceChildren(c);
    }).catch(() => {});
  }
  async function show(ld, look) {
    const my = ++gen;
    try {
      const { r, fl, Application } = await build(ld, look);
      const a = await ensureApp(Application);
      if (my !== gen || dead) { r.root.destroy({ children: true }); return; }
      if (R) { a.stage.removeChild(R.root); R.root.destroy({ children: true }); }
      R = r; follow = fl; a.stage.addChild(r.root);
      if (a.canvas.parentNode !== host) host.replaceChildren(a.canvas);
    } catch {
      if (my === gen && !dead) still(ld, look, my);
    }
  }
  function kill() {
    if (dead) return; dead = true; gen++;
    const a = app; app = null; R = null; follow = [];
    if (a) { try { a.destroy(true, { children: true }); } catch { /* */ } }
    else if (appP) appP.then((x) => { try { x.destroy(true, { children: true }); } catch { /* */ } }).catch(() => {});
  }
  return { show, kill };
}

export function showLook({ idg, save, onClose }) {
  Sfx.play('sfx_menu_select');
  let cur = idg;
  // 지금 꾸밈 — 가진 것만 남긴다 (예전에 저장된 값이 이상해도 안전)
  const sel = decodeLook(cur.look);
  sel.title = TITLES.some((t) => t.id === cur.title && t.has(cur)) ? cur.title : null;
  for (const s of SLOTS) if (sel[s] && !hasItem(cur, s, sel[s])) sel[s] = null;

  /* ── 미리보기 무대 : 카드 판 테 · 어두운 보라 · 석판 · 그림자 · 용 · 깃대 · 불꽃 표 · 이름표 ── */
  const dragonBox = el('div.idg-lk-dbox');
  const live = liveDragon(dragonBox);
  const nameEl = el('b.idg-lk-name'), titleEl = el('span.idg-lk-title');
  const flame = el('img.idg-lk-flame', { alt: '' });
  const flameBox = el('div.idg-lk-breath', { role: 'img' }, [flame]);
  const flagImg = el('img.idg-lk-banner', { alt: '' });
  const flagBox = el('div.idg-lk-flag', { role: 'img' }, [el('i.idg-lk-pole'), el('i.idg-lk-knob'), flagImg, el('i.idg-lk-pole-foot')]);
  const stage = el('div.idg-lk-stage', null, [
    el('i.idg-lk-slab'), dragonBox, flagBox, flameBox,
    el('div.idg-lk-tag', null, [nameEl, titleEl]),
  ]);
  const side = el('div.idg-lk-side', null, [stage]);

  let shown = '';   // 지금 그려진 용 (리더 + 모자 + 목) — 같으면 다시 안 그림
  function drawStage() {
    const ld = actualLeader(cur), L = LEADERS[ld];
    stage.style.setProperty('--fc', FRAME_COLOR[sel.frame] || 'transparent');
    stage.classList.toggle('framed', !!FRAME_COLOR[sel.frame]);
    nameEl.textContent = L?.ko || ld;
    const t = TITLES.find((x) => x.id === sel.title);
    titleEl.textContent = t ? `«${t.name}»` : '';
    titleEl.hidden = !t;
    const key = `${ld}|${sel.hat || ''}|${sel.neck || ''}`;
    if (key !== shown) { shown = key; live.show(ld, encodeLook({ hat: sel.hat, neck: sel.neck })); }
    const br = sel.breath || 'basic';
    flame.src = imgFor('breath', br);
    flameBox.setAttribute('aria-label', `브레스 색 : ${LOOKS.breath.find((x) => x.id === br)?.name || '기본 불꽃'}`);
    stage.classList.toggle('has-flag', !!sel.flag);
    if (sel.flag) { flagImg.src = imgFor('flag', sel.flag); flagBox.setAttribute('aria-label', `성 깃발 : ${LOOKS.flag.find((x) => x.id === sel.flag)?.name || ''}`); }
  }

  /* ── 내 용 고르기 (연구소 리더 칸과 같은 데이터 · 저장 g.leader) ── */
  const leaderRows = new Map();
  const leaderGrid = el('div.idg-lk-leaders', { role: 'radiogroup', 'aria-label': '내 용 고르기' });
  function buildLeaders() {
    const worlds = openWorlds(cur), want = wantOf(cur), auto = autoLeader(cur);
    const rows = [];
    const mk = (id, title, sub, locked, face = id) => {
      const row = kitRow({ icon: `${AI}${face}/head.png`, title, sub, hi: want === id, locked, onClick: locked ? null : () => pickLeader(id) });
      row.classList.add('idg-lk-lrow');
      if (!locked) { row.setAttribute('role', 'radio'); row.setAttribute('aria-checked', String(want === id)); }
      leaderRows.set(id, row); rows.push(row);
    };
    mk('auto', '자동 (월드 추천)', `지금은 ${LEADERS[auto]?.ko || auto} — 월드마다 알맞은 용`, false, auto);
    for (const [id, L] of Object.entries(LEADERS)) {
      const locked = L.unlock > worlds;
      mk(id, L.ko, locked ? `월드 ${L.unlock} 깨면 열려요` : L.line, locked);
    }
    leaderGrid.replaceChildren(...rows);
  }
  function pickLeader(id) {
    if (wantOf(cur) === id) return;
    const next = save({ leader: id });
    if (next) cur = next;
    const want = wantOf(cur);
    kitKeepScroll(leaderGrid, () => {
      for (const [k, row] of leaderRows) { const on = k === want; row.classList.toggle('hi', on); if (row.hasAttribute('aria-checked')) row.setAttribute('aria-checked', String(on)); }
      drawStage();
    });
    const ld = actualLeader(cur);   /* 이름 외침 (로비 무대 용을 누를 때와 같음) */
    import('../games/iandragon_game/audio/index.js').then((A) => { A.init(); A.voice(`name/${ld}`); }).catch(() => {});
  }

  /* ── 꾸미기 칸 (모자 · 목 장식 · 브레스 색 · 성 깃발 · 테두리 · 칭호) — 한 번만 만들고, 고르면 «.on» 만 바꾼다 ── */
  const slotBtns = {};   // slot → Map(id|'' → button)
  function commit(slot) {
    const next = save({ look: encodeLook(sel), title: sel.title || '' });
    if (next) cur = next;
    Sfx.play('sfx_menu_select');
    kitKeepScroll(leaderGrid, () => {
      for (const [id, b] of slotBtns[slot]) { const on = (id || null) === sel[slot]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
      drawStage();
    });
  }
  function buildSlots() {
    const secs = [];
    for (const slot of SLOTS) {
      const owned = LOOKS[slot].filter((x) => hasItem(cur, slot, x.id));
      const row = el('div.idg-leader-row');
      const m = slotBtns[slot] = new Map();
      const add = (id, kids) => {
        const on = (id || null) === sel[slot];
        const b = el('button.idg-leader' + (on ? '.on' : ''), { type: 'button', 'aria-pressed': String(on), onclick: () => { if (sel[slot] === (id || null)) return; sel[slot] = id || null; commit(slot); } }, kids);
        m.set(id || '', b); row.appendChild(b);
      };
      add('', [el('b', '없음')]);
      for (const x of owned) add(x.id, [pic(slot, x.id, x.name), el('b', x.name)]);
      const sec = el('div.idg-lk-sec', null, [kitSection(SLOT_NAME[slot]), row]);
      if (!owned.length) sec.appendChild(el('div.idg-look-hint', slot === 'frame' ? '명예의 전당 시즌 보상으로 받아요' : slot === 'title' ? '도전 과제와 기록으로 얻어요' : '용 시장에서 사 보세요'));
      if (slot === 'title') {
        // 아직 못 얻은 칭호는 얻는 방법만 보여 준다
        for (const t of TITLES.filter((x) => !x.has(cur))) sec.appendChild(el('div.idg-look-hint.lock', null, [el('img.idg-lock-ico', { src: `${AI}lobby/ico_lock.png`, alt: '잠김' }), el('b', `«${t.name}»`), ` ${t.how}`]));
      }
      secs.push(sec);
    }
    return secs;
  }

  buildLeaders();
  const list = el('div.idg-lk-list', null, [el('div.idg-lk-sec.lead', null, [kitSection('내 용 고르기'), leaderGrid]), ...buildSlots()]);
  drawStage();

  const wrap = el('div.idg-lk', null, [side, list]);
  const box = el('div.dialog.idg-look.idg-look2.idg-lab', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', '꾸미기'), wrap, button('닫기', () => close())]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  let done = false;
  const ended = () => { if (done) return; done = true; live.kill(); onClose?.(); };   // 닫으면(뒤로가기 포함) 로비 다시 그리기 — 무대 용 · 코인 · 젬
  const closeO = presentOverlay(overlay, ended);
  const close = () => { closeO(); ended(); };
}
