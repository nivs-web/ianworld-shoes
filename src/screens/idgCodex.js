/**
 * 좀비와 드래곤 — «도감» (2026-11-11 대표님 · 기획 IAN_DRAGON_MENU_CODEX_PLAN.md 2장 «볼맛 나고 눌러 보고 싶게»)
 *  탭 4개 : 드래곤 · 좀비 · 보스 · 배경  ·  위에 모은 수 / 비율 막대
 *  카드 : 실제 게임 그림(머리 · 몸) 숨쉬기 · 못 만난 것은 까만 그림자 + «?» + «3-1 에서 만나요» · 처음 보는 카드 NEW
 *  자세히 : 몸 전체(부품 조립) · 등급 · 능력 막대 4 · 처음 만나는 판 · 🔊 소리(용 = 이름 외침 · 좀비 = 등장 · 보스 = 등장 대사) · 좌우 넘기기
 *  배경 : 월드 배경을 손가락으로 끌어 구경 + 그 월드 곡 · 못 간 월드는 흐리게 + 자물쇠
 */
import { el, button, presentOverlay } from './ui.js';
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
import { kitGauge, kitKeepScroll, kitClose } from './idgKit.js';   /* 키트 픽셀 게이지 · 스크롤 지키기 · 닫기 X (11/12 서브창2) */

const AI = '/assets/iandragon_game/ai/';
const ART = { chubby: 'cone', shield: 'helmet', bossFat: 'bossGiant' };
const RAR = { story: '스토리', ...RAR_KO };
const CX = `${AI}codex/`;
/* 카드 판 = kit/cx_card.webp (모은 것 · 금테) · kit/cx_card_off.webp (미수집 · 은테) — 모양은 idg-subwin.css «서브창2» (옛 ai/codex/card_tier_* 대신 · 11/12) */
const WORLD_NAMES = ['달밤 초록 언덕', '부글부글 화산', '뭉게구름 하늘섬', '꽁꽁 얼음골', '덜컹덜컹 쇠 광산', '으스스 유령 묘지', '모래바람 사막', '끈적끈적 독 늪', '반짝반짝 수정 동굴', '좀비 드래곤 성'];
const SEEN_KEY = 'idgCodexSeen';
const seen = (() => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); } })();
const markSeen = (id) => { if (seen.has(id)) return; seen.add(id); try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* */ } };

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

/** go = { stage(), hatch() } — «바로 가기» (로비가 넘겨 줌) */
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
  const DR = Object.keys(UNITS).filter((id) => UNITS[id].rar !== 'story' || DRAGON_ORDER.includes(id));
  const haveD = (id) => story.includes(id) || (UNITS[id].rar !== 'story' && !!g.units[id]);
  const joinAt = {};   /* 스토리 용 : 몇 판을 깨면 함께하나 */
  for (let n = 1; n <= LAST_STAGE + 1; n++) for (const id of unlockedBefore(n).dragons) if (!joinAt[id]) joinAt[id] = n;
  const stLabel = (n) => STAGES.find((x) => x.g === n - 1)?.id || '1-1';
  const poolN = (r) => Object.keys(UNITS).filter((k) => UNITS[k].rar === r).length || 1;
  const howGet = (id) => { const u = UNITS[id]; return u.rar === 'story' ? (joinAt[id] > 1 ? `${stLabel(joinAt[id])} 을 깨면 함께해요` : '처음부터 함께해요') : `알 부화장 · ${RAR[u.rar]} ${(((RATES[u.rar] || 0) / poolN(u.rar)) * 100).toFixed(1)}%`; };
  const shortGet = (id) => { const u = UNITS[id]; return u.rar === 'story' ? (joinAt[id] > 1 ? `${stLabel(joinAt[id])} 깨면 합류` : '처음부터') : `부화장 ${(((RATES[u.rar] || 0) / poolN(u.rar)) * 100).toFixed(1)}%`; };
  const worldOpen = (w) => (w - 1) * 10 + 1 <= Math.min(LAST_STAGE, g.cleared + 1);
  const TABS = {
    dragon: { name: '드래곤', ids: DR, have: haveD, data: (id) => UNITS[id], art: (id) => id, sub: (id) => RAR[UNITS[id].rar], cls: (id) => UNITS[id].rar, hint: howGet, short: shortGet, go: (id) => (UNITS[id].rar === 'story' ? go.stage : go.hatch) },
    zombie: { name: '좀비', ids: allZ.filter((id) => !ENEMIES[id].boss), have: (id) => met.has(id), data: (id) => ENEMIES[id], art: (id) => ART[id] || id, sub: () => '좀비', cls: () => 'zombie', hint: (id) => `${firstAt[id] || '?'} 에서 만나요`, short: (id) => `${firstAt[id] || '?'} 에서`, go: () => go.stage },
    boss: { name: '보스', ids: allZ.filter((id) => ENEMIES[id].boss), have: (id) => met.has(id), data: (id) => ENEMIES[id], art: (id) => ART[id] || id, sub: () => '보스', cls: () => 'boss', hint: (id) => `${firstAt[id] || '?'} 에서 만나요`, short: (id) => `${firstAt[id] || '?'} 에서`, go: () => go.stage },
    world: { name: '배경', ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], have: worldOpen },
  };
  let tab = 'dragon';
  const tabsEl = el('div.idg-cx-tabs'), prog = el('div.idg-cx-prog'), grid = el('div.idg-cx-grid');
  /* 능력 막대 기준 (그 탭에서 가장 큰 값 = 꽉) */
  const maxOf = (ids, data, k) => Math.max(1, ...ids.map((id) => Number(data(id)[k]) || 0));

  function draw() {
    tabsEl.replaceChildren(...Object.entries(TABS).map(([k, t]) => el('button.idg-cx-tab' + (k === tab ? '.on' : ''), { type: 'button', onclick: () => { Sfx.play('sfx_menu_move'); tab = k; draw(); } }, [el('img', { src: `${CX}tab_${k}.png`, alt: '', onerror: (e) => e.target.remove() }), el('span', t.name)])));
    const T = TABS[tab], n = T.ids.filter(T.have).length, all = Object.values(TABS).reduce((a, t) => a + t.ids.length, 0), got = Object.values(TABS).reduce((a, t) => a + t.ids.filter(t.have).length, 0);
    prog.replaceChildren(el('span', `${T.name} ${n} / ${T.ids.length}`), kitGauge({ value: got, max: all, color: 'gold', label: '도감 전체 모은 비율' }), el('span.all', `전체 ${got}/${all} · ${Math.round((got / all) * 100)}%`));
    grid.className = 'idg-cx-grid' + (tab === 'world' ? ' world' : '');
    grid.replaceChildren(...T.ids.map((id, i) => (tab === 'world' ? worldCard(id) : card(T, id, i))));
  }
  function card(T, id, i) {
    const on = T.have(id), art = T.art(id), isNew = on && !seen.has(`${tab}:${id}`);
    /* 대표님 «수집은 못했지만 어떤 캐릭터인지 눌러볼 수 있게» : 못 모은 것 = 흑백 + «미수집» 도장 · 이름은 보임 · 눌러서 자세히 */
    /* 11/12 서브창2 (대표님 «카드가 너무 밝고 테가 두껍다 → 고급 카드») : 어두운 안쪽 + 얇은 금테 + 모서리 장식 판(kit/cx_card · 미수집 = cx_card_off 은테) · 얼굴 크게 · NEW / 미수집 = 작은 꼬리표 */
    return el('button.idg-cx-card.cx2.' + T.cls(id) + (on ? '' : '.off'), { type: 'button', 'aria-label': `${T.data(id).name}${on ? '' : ' (미수집)'}${isNew ? ' 새로 얻음' : ''}`, onclick: () => detail(T, i) }, [
      el('img.breath', { src: `${AI}${art}/head.png`, alt: '', onerror: (e) => { if (!e.target.dataset.f) { e.target.dataset.f = 1; e.target.src = `${AI}${art}/torso.png`; } } }),
      el('b', T.data(id).name), el('span', on ? T.sub(id) : (T.short || T.hint)(id)), on ? null : el('em.cx-tag.cx-miss', '미수집'), isNew ? el('em.cx-tag.cx-new', 'NEW') : null,
    ].filter(Boolean));
  }
  function worldCard(w) {
    const on = worldOpen(w);
    return el('button.idg-cx-world' + (on ? '' : '.off'), { type: 'button', onclick: () => { if (!on) { Sfx.play('button_deny'); return; } worldView(w); } }, [
      el('img', { src: `${AI}bg/w${String(w).padStart(2, '0')}_panel.png`, alt: '' }), el('b', `월드 ${w}`), el('span', null, on ? [WORLD_NAMES[w - 1]] : [el('img.idg-lock-ico', { src: '/assets/iandragon_game/ai/lobby/ico_lock.png', alt: '잠김' }), '아직 못 갔어요']),
    ]);
  }
  /** 자세히 보기 */
  function detail(T, i) {
    const ids = T.ids; let k = i;
    const stage = el('div.idg-cx-stage'), info = el('div.idg-cx-info');
    const sound = (id) => {
      if (tab === 'dragon') Audio.voice(VOICE_LINES[`name/${id}`] ? `name/${id}` : `deploy/${id}`);
      else if (tab === 'boss') Audio.voice(`boss/${T.art(id)}`);
      else Audio.play('zombie_spawn');
    };
    const show = () => {
      const id = ids[k], d = T.data(id), on = T.have(id); if (on) markSeen(`${tab}:${id}`); Audio.play(on ? 'codex_open' : 'codex_locked'); sound(id);
      stage.classList.toggle('off', !on);
      stage.replaceChildren(el('div.idg-cx-load', '…'));
      bodyCanvas(T.art(id)).then((c) => { if (ids[k] === id) { c.className = 'idg-cx-body'; stage.replaceChildren(c); } }).catch(() => stage.replaceChildren(el('img.idg-cx-body', { src: `${AI}${T.art(id)}/head.png`, alt: '' })));
      /* 능력 = 키트 픽셀 게이지 (11/12 서브창2 · 끝 마감 · 체력 초록 · 공격 주황 · 사거리 파랑 · 빠르기 보라) */
      const bar = (label, key, color) => el('div.idg-cx-bar' + (on ? '' : '.q'), null, [el('span', label), on ? kitGauge({ value: Number(d[key]) || 0, max: maxOf(T.ids, T.data, key), color, floor: 0.04, label }) : el('em', '???')]);
      info.replaceChildren(
        el('h3', d.name), el('div.sub', `${T.sub(id)}${d.role ? ' · ' + d.role : ''}`),
        bar('체력', 'hp', 'green'), bar('공격', 'atk', 'orange'), bar('사거리', 'range', 'blue'), bar('빠르기', 'speed', 'purple'),
        el('div.first', tab === 'dragon' ? (d.rar === 'story' ? '모험에서 함께해요' : '부화장에서 태어나요') : `처음 만나는 판 : ${firstAt[id] || '?'}`),
        ...(on ? [] : [el('div.idg-cx-get', null, [el('span', `얻는 법 · ${T.hint(id)}`), T.go?.(id) ? button('바로 가기', () => { const f = T.go(id); closeAll(); f(); }) : null].filter(Boolean))]),   /* null 을 넘기면 «null» 글자가 찍혔다 (11/12 고침) */
      );
    };
    const step = (dlt) => { Sfx.play('sfx_menu_move'); k = (k + dlt + ids.length) % ids.length; show(); };
    const box = el('div.dialog.idg-cx-detail', { onclick: (e) => e.stopPropagation() }, [
      el('div.idg-how-title', `${TABS[tab]?.name || ''} 도감`),   /* 다른 창처럼 리본 현판 (11/12) */
      el('div.idg-cx-dwrap', null, [el('button.idg-cx-arrow', { type: 'button', onclick: () => step(-1), 'aria-label': '앞으로' }, [el('i.idg-px-arrow.l')]), stage, el('button.idg-cx-arrow', { type: 'button', onclick: () => step(1), 'aria-label': '다음' }, [el('i.idg-px-arrow.r')])]),
      info,
      el('div.idg-row2', null, [(() => { const b = button('다시 듣기', () => sound(ids[k])); b.prepend(el('img.idg-btn-ico', { src: '/assets/iandragon_game/ai/lobby/ico_sound.png', alt: '' })); return b; })()   /* 🔊 글자 그림 → 도트 아이콘 */, button('닫기', () => { close(); redraw(); }, { primary: true })]),
    ]);
    const overlay = el('div.dialog-overlay', { onclick: () => { close(); redraw(); } }, [box]);
    const close = presentOverlay(overlay);
    closeD = close;
    show();
  }
  /* 자세히를 닫은 뒤 다시 그리기 : 목록 스크롤이 맨 위로 튀지 않게 (11/12 서브창2) */
  const redraw = () => kitKeepScroll(grid, draw);
  let closeD = null;
  const closeAll = () => { closeD?.(); closeMain?.(); };
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
  /** 배경 구경 : 끌어 보기 + 그 월드 곡 */
  function worldView(w) {
    const n = String(w).padStart(2, '0');
    const src = `${AI}bg/w${n}_panel.png`, name = `월드 ${w} · ${WORLD_NAMES[w - 1]}`;
    /* 11/12 서브창2 (대표님 «끌어서 구경이라는데 확대가 안 된다») : 그림을 누르면 큰 화면(전체 덮개)으로 — 화면 높이에 꽉 · 끌어서 구경 · 두 손가락 확대 */
    const strip = el('button.idg-cx-strip.zoomable', { type: 'button', 'aria-label': `${name} 크게 보기`, onclick: () => bigView(src, name) }, [el('img', { src, alt: '' }), el('i.idg-cx-zoom', { 'aria-hidden': 'true' })]);
    Audio.worldBgm(w);
    const box = el('div.dialog.idg-cx-wdetail', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', name), el('div.idg-cx-tip', '그림을 눌러서 크게 보기'), strip, button('닫기', () => close())]);
    const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
    const close = presentOverlay(overlay, () => Audio.stopBgm());
  }

  draw();
  let closeMain = null;
  const box = el('div.dialog.idg-codex.idg-cx', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', '도감'), tabsEl, prog, grid, button('닫기', () => close())]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
  closeMain = close;
}
