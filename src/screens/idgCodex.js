/**
 * 좀비와 드래곤 — «도감» (2026-11-11 대표님 · 기획 IAN_DRAGON_MENU_CODEX_PLAN.md 2장 «볼맛 나고 눌러 보고 싶게»)
 *  11/14 «도감 A» 레이아웃 (대표님 고름 · 시안 tools/_uimock/codex_a2.html · 규칙표 tools/_uimock/rules.html) :
 *   위 줄 : 왼쪽 = 도감 전체 알약(⑨ «전체 65/77 | 84%») · 가운데 = 날개 제목 · 오른쪽 = X  (공통 틀 idgFrame · idgXwin)
 *   몸   : 왼쪽 28% = 세로 탭 4개(⑰ · 모은 수 · NEW 숫자 배지(⑥) · 모은 비율 막대)
 *          가운데 = 카드 칸 (못 만난 것 = 까만 그림자 + «?» · 처음 보는 것 = NEW)
 *          오른쪽 = 자세히 칸 (몸 전체 그림 · 이름 · 등급 · 능력 막대 4 · «얻는 법» 종이 · [다시 듣기] 보라 + 바로가기 주황 / 싸우러 가기 빨강)
 *   카드를 누르면 오른쪽 자세히 칸만 바뀐다 (따로 창을 띄우지 않음) · 누를 때 소리(용 = 이름 외침 · 좀비 = 등장 · 보스 = 등장 대사)
 *   배경 탭 : 월드 그림 카드 → 자세히 칸에 그림 · 그 월드 곡 · 그림(또는 [크게 보기])을 누르면 큰 화면(끌기 · 확대)
 */
import { el, presentOverlay } from './ui.js';
import { applyRigFix } from '../games/iandragon_game/render/rig.js';
import * as G from '../services/iandragonGame.js';
import * as Sfx from '../audio/sfx.js';
import * as Audio from '../games/iandragon_game/audio/index.js';
import { VOICE_LINES } from '../games/iandragon_game/audio/voice-lines.js';
import { UNITS } from '../games/iandragon_game/data/units.js';
import { ENEMIES } from '../games/iandragon_game/data/enemies.js';
import { STAGES } from '../games/iandragon_game/data/stages/index.js';
import { unlockedBefore, LAST_STAGE, DRAGON_ORDER } from '../games/iandragon_game/render/battleSetup.js';
import { RAR_KO, RATES } from '../services/iandragonHatch.js';
import { showNest } from './idgNest.js';
import { xTitle } from './idgXwin.js';
import { kitClose } from './idgKit.js';   /* 큰 그림 보기 닫기 X */
import { scrollHint } from './idgMore.js';   /* 카드 칸 «아래로 더 있음» 금 화살표 */
import '../styles/idg-v2-codex.css';   /* 도감 A 레이아웃 (11/14) */

const AI = '/assets/iandragon_game/ai/';
const ART = { chubby: 'cone', shield: 'helmet', bossFat: 'bossGiant' };
const RAR = { story: '스토리', ...RAR_KO };
const CX = `${AI}codex/`;
const LOCK = `${AI}lobby/ico_lock.png`;
const WORLD_NAMES = ['달밤 초록 언덕', '부글부글 화산', '뭉게구름 하늘섬', '꽁꽁 얼음골', '덜컹덜컹 쇠 광산', '으스스 유령 묘지', '모래바람 사막', '끈적끈적 독 늪', '반짝반짝 수정 동굴', '좀비 드래곤캐슬'];
const SEEN_KEY = 'idgCodexSeen';
const seen = (() => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); } })();
const markSeen = (id) => { if (seen.has(id)) return; seen.add(id); try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* */ } };
/* 단추 끝 도트 › (규칙표 ③) */
const NS = 'http://www.w3.org/2000/svg';
const chev = () => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 4 7'); s.setAttribute('shape-rendering', 'crispEdges'); s.setAttribute('class', 'rt'); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS(NS, 'path'); p.setAttribute('fill', 'currentColor'); p.setAttribute('d', 'M0 0h1v1H0zM0 1h2v1H0zM0 2h3v1H0zM0 3h4v1H0zM0 4h3v1H0zM0 5h2v1H0zM0 6h1v1H0z'); s.appendChild(p); return s; };

/** 부품 캐릭터 몸 전체를 한 장으로 (rig.json 의 기본 자세 · 기준점 a · 자리 p · flip) */
export async function bodyCanvas(art) {
  const rig = await (await fetch(`${AI}${art}/rig.json`)).json();
  const files = await applyRigFix(art, rig);   /* 날개 · 꼬리 자리 표 (전투와 같게) */
  const imgs = await Promise.all(rig.parts.map((q) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = `${AI}${art}/${files[q.n] || q.n}.png`; })));
  const K = 1.7, W = 300, H = 250, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;   /* 크게 (도트 그대로) */
  x.translate(W / 2, H - 14); x.scale(K, K); if (rig.face === -1) x.scale(-1, 1);   /* 좀비는 왼쪽을 본다 → 도감에서는 오른쪽 보게 */
  rig.parts.forEach((q, k) => {
    const im = imgs[k]; if (!im) return;
    x.save(); x.translate(q.p[0], q.p[1]); if (q.flip) x.scale(-1, 1);
    x.drawImage(im, -q.a[0] * im.width, -q.a[1] * im.height); x.restore();
  });
  return c;
}

/** 몸 그림의 빈 둘레를 잘라 자세히 칸에 크게 (도트 그대로 · 실패하면 원래 그림) */
function trim(c) {
  try {
    const { width: W, height: H } = c, d = c.getContext('2d').getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return c;
    const p = 4, w = x1 - x0 + 1 + p * 2, h = y1 - y0 + 1 + p * 2, o = document.createElement('canvas'); o.width = w; o.height = h;
    const g = o.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, x0 - p, y0 - p, w, h, 0, 0, w, h);
    return o;
  } catch { return c; }
}

/** go = { stage(), hatch(), power()? } — «바로 가기» (로비가 넘겨 줌 · 없는 것은 단추를 숨긴다) */
export function showCodex(go = {}) {
  Sfx.play('sfx_menu_select');
  Audio.init();
  const g = G.idg();
  const story = unlockedBefore(g.cleared + 1).dragons;
  const firstAt = {};
  for (const st of STAGES) if (st.g <= LAST_STAGE) for (const l of st.lines) if (!firstAt[l.id]) firstAt[l.id] = st.id;
  const met = new Set();
  for (const st of STAGES) if (st.g <= Math.min(g.cleared, LAST_STAGE)) for (const l of st.lines) met.add(l.id);
  const allZ = [...new Set(STAGES.filter((s) => s.g <= LAST_STAGE).flatMap((s) => s.lines.map((l) => l.id)))];
  const DR = Object.keys(UNITS).filter((id) => (UNITS[id].rar !== 'story' || DRAGON_ORDER.includes(id)) && !['secret', 'myth'].includes(UNITS[id].rar));   // «?» 드래곤은 도감에 그대로 늘어놓지 않는다(비밀 · catalog.mysteryView 카드는 화면 담당이 붙임 · ⑤ 임시로 숨김)
  const haveD = (id) => story.includes(id) || (UNITS[id].rar !== 'story' && !!g.units[id]);
  const joinAt = {};   /* 스토리 용 : 몇 판을 깨면 함께하나 */
  for (let n = 1; n <= LAST_STAGE + 1; n++) for (const id of unlockedBefore(n).dragons) if (!joinAt[id]) joinAt[id] = n;
  const stLabel = (n) => STAGES.find((x) => x.g === n - 1)?.id || '1-1';
  const poolN = (r) => Object.keys(UNITS).filter((k) => UNITS[k].rar === r).length || 1;
  const pct = (r) => (((RATES[r] || 0) / poolN(r)) * 100).toFixed(1);
  const howGet = (id) => { const u = UNITS[id]; return u.rar === 'story' ? (joinAt[id] > 1 ? `${stLabel(joinAt[id])} 을 깨면 함께해요` : '처음부터 함께해요') : `부화장 · ${RAR[u.rar]} ${pct(u.rar)}%`; };
  const worldOpen = (w) => (w - 1) * 10 + 1 <= Math.min(LAST_STAGE, g.cleared + 1);
  /* 파워업 바로가기 : 로비가 go.power 를 주면 그것 · 아니면 로비의 [파워업] 단추를 대신 눌러 (로비 새로 고침까지 같게) · 로비가 없으면 파워업 창만 */
  const goPower = go.power || (() => { const b = document.querySelector('.idg-lobby2 .l2-btn.green'); if (b) b.click(); else showNest(() => {}); });
  /* 둘째 단추 (규칙표 ③ : 주황 = 다른 창 바로가기 · 빨강 = 싸우러 가기) */
  const fight = (st) => ({ cls: 'r', text: `${st} 싸우러 가기`, fn: go.stage });
  const TABS = {
    dragon: {
      name: '드래곤', ids: DR, have: haveD, data: (id) => UNITS[id], art: (id) => id, sub: (id) => RAR[UNITS[id].rar], cls: (id) => UNITS[id].rar, hint: howGet,
      go: (id, on) => (on ? { cls: 'o', text: '파워업 키우기', fn: goPower } : UNITS[id].rar === 'story' ? fight(stLabel(joinAt[id] || 1)) : { cls: 'o', text: '부화장 가기', fn: go.hatch }),
    },
    zombie: { name: '좀비', ids: allZ.filter((id) => !ENEMIES[id].boss), have: (id) => met.has(id), data: (id) => ENEMIES[id], art: (id) => ART[id] || id, sub: () => '좀비', cls: () => 'zombie', hint: (id) => `${firstAt[id] || '?'} 에서 만나요`, go: (id) => fight(firstAt[id] || '1-1') },
    boss: { name: '보스', ids: allZ.filter((id) => ENEMIES[id].boss), have: (id) => met.has(id), data: (id) => ENEMIES[id], art: (id) => ART[id] || id, sub: () => '보스', cls: () => 'boss', hint: (id) => `${firstAt[id] || '?'} 에서 만나요`, go: (id) => fight(firstAt[id] || '1-1') },
    world: { name: '배경', ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], have: worldOpen },
  };
  const isNew = (k, id) => k !== 'world' && TABS[k].have(id) && !seen.has(`${k}:${id}`);
  let tab = 'dragon', pick = 0, worldSong = false;
  /* 능력 막대 기준 (그 탭에서 가장 큰 값 = 꽉) */
  const maxOf = (ids, data, k) => Math.max(1, ...ids.map((id) => Number(data(id)[k]) || 0));

  const rail = el('div.idg-cxa-rail'), grid = el('div.idg-cxa-grid'), det = el('div.idg-cxa-det');
  const all = Object.values(TABS).reduce((a, t) => a + t.ids.length, 0), got = Object.values(TABS).reduce((a, t) => a + t.ids.filter(t.have).length, 0);
  const allPct = Math.round((got / all) * 100);
  /* ⑨ 도감 전체 단추 (알약 · 테 = 어두운 노란색 · 글씨 세로 가운데) */
  const allPill = el('div.idg-cxa-all', { role: 'img', 'aria-label': `도감 전체 ${got}/${all} · ${allPct}%` }, [el('span', '전체'), el('b', `${got}/${all}`), el('i'), el('b', `${allPct}%`)]);

  /** 왼쪽 세로 탭 (⑰) : 그림 · 이름 · 모은 수 · 모은 비율 막대 · NEW 숫자 배지(⑥) */
  function drawRail() {
    rail.replaceChildren(...Object.entries(TABS).map(([k, t]) => {
      const n = t.ids.filter(t.have).length, nw = t.ids.filter((id) => isNew(k, id)).length;
      return el('button.idg-cxa-tab' + (k === tab ? '.on' : ''), { type: 'button', 'aria-pressed': String(k === tab), 'aria-label': `${t.name} ${n}/${t.ids.length}${nw ? ` · 새로 얻음 ${nw}` : ''}`, onclick: () => { if (k === tab) return; Sfx.play('sfx_menu_move'); setTab(k); } }, [
        el('img', { src: `${CX}tab_${k}.png`, alt: '', onerror: (e) => e.target.remove() }),
        el('span.nm', t.name), el('span.cnt', `${n}/${t.ids.length}`),
        el('i.bar', { 'aria-hidden': 'true' }, [el('b', { style: { width: `${Math.round((n / t.ids.length) * 100)}%` } })]),
        nw ? el('i.idg-cxa-badge', String(nw)) : null,
      ]);
    }), el('div.idg-cxa-paper', null, ['못 모은 것도', el('br'), el('b', '눌러서'), ' 볼 수 있어요']));
  }
  function setTab(k) {
    if (worldSong && k !== 'world') { Audio.stopBgm(); worldSong = false; }
    tab = k; pick = 0;
    drawRail();
    grid.className = 'idg-cxa-grid' + (tab === 'world' ? ' world' : '');
    grid.replaceChildren(...TABS[tab].ids.map((id, i) => (tab === 'world' ? worldCard(id, i) : card(TABS[tab], id, i))));
    grid.scrollTop = 0;
    select(0, false);
  }
  function card(T, id, i) {
    const on = T.have(id), art = T.art(id), nw = isNew(tab, id);
    return el('button.idg-cxa-card.' + T.cls(id) + (on ? '' : '.off'), { type: 'button', 'aria-label': `${T.data(id).name}${on ? '' : ' (미수집)'}${nw ? ' 새로 얻음' : ''}`, onclick: () => select(i, true) }, [
      nw ? el('i.idg-cxa-new', 'NEW') : null,
      el('span.art', null, [el('img', { src: `${AI}${art}/head_big.png`, alt: '', draggable: 'false', onerror: (e) => { const f = Number(e.target.dataset.f || 0); e.target.dataset.f = f + 1; if (f === 0) e.target.src = `${AI}${art}/head.png`; else if (f === 1) e.target.src = `${AI}${art}/torso.png`; else e.target.remove(); } })]),
      el('span.nm', T.data(id).name),
    ]);
  }
  function worldCard(w, i) {
    const on = worldOpen(w);
    return el('button.idg-cxa-card.wcard' + (on ? '' : '.off'), { type: 'button', 'aria-label': `월드 ${w}${on ? ` ${WORLD_NAMES[w - 1]}` : ' (잠김)'}`, onclick: () => select(i, true) }, [
      el('span.art', null, [el('img.world', { src: `${AI}bg/w${String(w).padStart(2, '0')}_panel.png`, alt: '', draggable: 'false' }), on ? null : el('img.lk', { src: LOCK, alt: '' })]),
      el('span.nm', `월드 ${w}`),
    ]);
  }
  const sound = (T, id) => {
    if (tab === 'dragon') Audio.voice(VOICE_LINES[`name/${id}`] ? `name/${id}` : `deploy/${id}`);
    else if (tab === 'boss') Audio.voice(`boss/${T.art(id)}`);
    else Audio.play('zombie_spawn');
  };
  /** 작은 단추 (규칙표 ③ · 글씨 1px) */
  const sbtn = (cls, kids, fn) => el(`button.idg-cxa-btn.${cls}`, { type: 'button', onclick: fn }, kids);
  const goBtn = (o) => (o && o.fn ? sbtn(o.cls, [el('span', o.text), o.cls === 'o' ? chev() : null], () => { Sfx.play('sfx_menu_select'); close(); o.fn(); }) : null);   /* 로비가 이동 기능을 안 주면(부화장에서 연 도감 등) 단추를 숨긴다 */
  const listenBtn = (fn, off) => sbtn(off ? 'x0' : 'p', [el('img', { src: `${AI}lobby/ico_sound.png`, alt: '' }), el('span', '다시 듣기')], off ? () => Sfx.play('button_deny') : fn);

  /** 카드 고르기 → 오른쪽 자세히 칸만 바꾼다 (user = 직접 누름 : 소리 · NEW 지우기) */
  function select(i, user) {
    pick = i;
    [...grid.children].forEach((c, k) => { c.classList.toggle('sel', k === i); c.setAttribute('aria-pressed', String(k === i)); });
    if (tab === 'world') { worldDetail(TABS.world.ids[i], user); return; }
    const T = TABS[tab], id = T.ids[i], d = T.data(id), on = T.have(id), nw = isNew(tab, id);
    if (user) {
      if (nw) { markSeen(`${tab}:${id}`); grid.children[i]?.querySelector('.idg-cxa-new')?.remove(); drawRail(); }
      Audio.play(on ? 'codex_open' : 'codex_locked'); sound(T, id);
    }
    const chips = el('div.tl', null, [el('span.idg-cxa-chip.' + (on ? T.cls(id) : 'miss'), on ? T.sub(id) : '미수집'), nw ? el('i.idg-cxa-new.big', 'NEW') : null]);
    const stage = el('div.idg-cxa-stage' + (on ? '' : '.off'), null, [el('div.idg-cxa-load', '…'), chips]);
    bodyCanvas(T.art(id)).then((c) => { if (TABS[tab] === T && T.ids[pick] === id) { c = trim(c); c.className = 'idg-cxa-body'; stage.replaceChildren(c, chips); } })
      .catch(() => stage.replaceChildren(el('img.idg-cxa-body', { src: `${AI}${T.art(id)}/head.png`, alt: '' }), chips));
    const bar = (label, key, cls) => el('div.idg-cxa-stat', null, [el('span', label), on ? el('i', null, [el('b.' + cls, { style: { width: `${Math.max(4, Math.round(((Number(d[key]) || 0) / maxOf(T.ids, T.data, key)) * 100))}%` } })]) : el('em', '???')]);
    det.replaceChildren(
      stage,
      el('div.idg-cxa-name', null, [el('b', d.name), d.role ? el('span', d.role) : null]),
      el('div.idg-cxa-stats', null, [bar('체력', 'hp', 'gr'), bar('공격', 'atk', 'or'), bar('사거리', 'range', 'bl'), bar('빠르기', 'speed', 'pu')]),
      el('div.idg-cxa-how', null, ['얻는 법 · ', el('b', T.hint(id))]),
      el('div.idg-cxa-btns', null, [listenBtn(() => sound(T, id)), goBtn(T.go(id, on))]),
    );
  }
  /** 배경 자세히 : 월드 그림(누르면 큰 화면) · 그 월드 곡 */
  function worldDetail(w, user) {
    const on = worldOpen(w), n = String(w).padStart(2, '0');
    const src = `${AI}bg/w${n}_panel.png`, name = `월드 ${w} · ${WORLD_NAMES[w - 1]}`;
    if (user) {
      if (on) { Audio.worldBgm(w); worldSong = true; } else Sfx.play('button_deny');
    }
    const open = () => { if (on) bigView(src, name); else Sfx.play('button_deny'); };
    const stage = el('button.idg-cxa-stage.wst' + (on ? '' : '.off'), { type: 'button', 'aria-label': on ? `${name} 크게 보기` : `월드 ${w} 잠김`, onclick: open }, [el('img.idg-cxa-wimg', { src, alt: '', draggable: 'false' }), on ? el('i.idg-cx-zoom', { 'aria-hidden': 'true' }) : el('img.lk', { src: LOCK, alt: '' })]);
    det.replaceChildren(
      stage,
      el('div.idg-cxa-name', null, [el('b', on ? WORLD_NAMES[w - 1] : '???'), el('span', `월드 ${w}`)]),
      el('div.idg-cxa-how', null, on ? ['그림을 누르면 ', el('b', '크게'), ' 볼 수 있어요'] : [el('b', `${w}-1`), ' 에 가면 열려요']),
      el('div.idg-cxa-btns', null, [
        listenBtn(() => { Audio.worldBgm(w); worldSong = true; }, !on),
        on ? sbtn('o', [el('span', '크게 보기'), chev()], open) : goBtn(fight(`${w}-1`)),
      ]),
    );
  }

  /**
   * 배경 큰 화면 (11/12 서브창2) : 전체 덮개 · 처음 = 화면 높이에 꽉 · 한 손가락/마우스로 끌기 · 두 손가락 · 휠로 확대 · 두 번 누르면 확대 ↔ 원래 · 닫기 X / Esc
   *  pointer events 로 직접 (touch-action:none) — 그림은 도트 그대로(pixelated)
   */
  function bigView(src, name) {
    Sfx.play('sfx_menu_select');
    const img = el('img.idg-cx-big-img', { src, alt: name, draggable: 'false' });
    const stage = el('div.idg-cx-big-stage', null, [img]);
    const wrap = el('div.idg-cx-big.idg-k', { role: 'dialog', 'aria-modal': 'true', 'aria-label': `${name} 크게 보기`, tabindex: '-1' }, [stage, el('div.idg-cx-big-top', null, [el('b.idg-cx-big-name', name), kitClose(() => done(), '크게 보기 닫기')]), el('div.idg-cx-big-tip', '끌어서 구경 · 두 손가락으로 확대')]);
    let iw = 0, ih = 0, s = 1, x = 0, y = 0, fitH = 1, fitW = 1;
    const vw = () => stage.clientWidth, vh = () => stage.clientHeight;
    const clamp = () => {
      const W = iw * s, H = ih * s;
      x = W <= vw() ? (vw() - W) / 2 : Math.min(0, Math.max(vw() - W, x));
      y = H <= vh() ? (vh() - H) / 2 : Math.min(0, Math.max(vh() - H, y));
    };
    const paint = () => { clamp(); img.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) scale(${s})`; };
    const fit = () => { if (!iw) return; fitH = vh() / ih; fitW = Math.min(vw() / iw, fitH); s = fitH; x = 0; y = 0; paint(); };
    const zoomAt = (ns, cx, cy) => { ns = Math.max(fitW, Math.min(fitH * 4, ns)); x = cx - (cx - x) * (ns / s); y = cy - (cy - y) * (ns / s); s = ns; paint(); };
    const ready = () => { iw = img.naturalWidth; ih = img.naturalHeight; fit(); };
    img.addEventListener('load', ready);
    const pts = new Map(); let pinch = null, lastTap = 0;
    const rel = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    stage.addEventListener('pointerdown', (e) => {
      stage.setPointerCapture?.(e.pointerId); pts.set(e.pointerId, rel(e));
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s }; }
      if (pts.size === 1) { const now = performance.now(); if (now - lastTap < 300) { const [cx, cy] = rel(e); zoomAt(s > fitH * 1.05 ? fitH : fitH * 2, cx, cy); } lastTap = now; }
    });
    stage.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId), cur = rel(e); pts.set(e.pointerId, cur);
      if (pts.size >= 2 && pinch) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomAt(pinch.s * (d / pinch.d), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); return; }
      x += cur[0] - prev[0]; y += cur[1] - prev[1]; paint();
    });
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', (e) => { e.preventDefault(); const [cx, cy] = rel(e); zoomAt(s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), cx, cy); }, { passive: false });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); done(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { x += e.key === 'ArrowLeft' ? 60 : -60; paint(); }
      else if (e.key === '+' || e.key === '=') zoomAt(s * 1.25, vw() / 2, vh() / 2);
      else if (e.key === '-') zoomAt(s / 1.25, vw() / 2, vh() / 2);
    });
    const onResize = () => fit();
    const shutO = presentOverlay(wrap, () => removeEventListener('resize', onResize));
    function done() { shutO(); }
    addEventListener('resize', onResize);
    requestAnimationFrame(() => { if (img.complete && img.naturalWidth) ready(); wrap.focus(); });
  }

  /* 내용 칸은 처음부터 .idg-dlg-body 로 만든다 → idgFrame 이 다시 감싸지 않고 위 줄만 2판으로 바꾼다 */
  const body = el('div.idg-dlg-body.idg-cxa', null, [rail, el('div.idg-cxa-main', null, [grid, det])]);
  const box = el('div.dialog.idg-codex.idg-xw', { onclick: (e) => e.stopPropagation() }, [xTitle('도감', () => close(), { left: [allPill] }), body]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay, () => { if (worldSong) Audio.stopBgm(); });
  setTab('dragon');
  scrollHint(grid, { host: grid.parentElement });
}
