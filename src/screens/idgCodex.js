/**
 * 좀비와 드래곤 — «도감» (2026-11-11 대표님 · 기획 IAN_DRAGON_MENU_CODEX_PLAN.md 2장 «볼맛 나고 눌러 보고 싶게»)
 *  탭 4개 : 드래곤 · 좀비 · 보스 · 배경  ·  위에 모은 수 / 비율 막대
 *  카드 : 실제 게임 그림(머리 · 몸) 숨쉬기 · 못 만난 것은 까만 그림자 + «?» + «3-1 에서 만나요» · 처음 보는 카드 NEW
 *  자세히 : 몸 전체(부품 조립) · 등급 · 능력 막대 4 · 처음 만나는 판 · 🔊 소리(용 = 이름 외침 · 좀비 = 등장 · 보스 = 등장 대사) · 좌우 넘기기
 *  배경 : 월드 배경을 손가락으로 끌어 구경 + 그 월드 곡 · 못 간 월드는 흐리게 + 자물쇠
 */
import { el, button, presentOverlay } from './ui.js';
import * as G from '../services/iandragonGame.js';
import * as Sfx from '../audio/sfx.js';
import * as Audio from '../games/iandragon_game/audio/index.js';
import { VOICE_LINES } from '../games/iandragon_game/audio/voice-lines.js';
import { UNITS } from '../games/iandragon_game/data/units.js';
import { ENEMIES } from '../games/iandragon_game/data/enemies.js';
import { STAGES } from '../games/iandragon_game/data/stages/index.js';
import { unlockedBefore, LAST_STAGE, DRAGON_ORDER } from '../games/iandragon_game/render/battleSetup.js';
import { RAR_KO, RATES } from '../services/iandragonHatch.js';

const AI = '/assets/iandragon_game/ai/';
const ART = { chubby: 'cone', shield: 'helmet', bossFat: 'bossGiant' };
const RAR = { story: '스토리', ...RAR_KO };
const CX = `${AI}codex/`;
/** 카드 테두리 (그림 담당 ai/codex/card_*) : 등급 → 테두리 */
const TIER = { story: 'card_tier_story', rare: 'card_tier_rare', super: 'card_tier_hero', legend: 'card_tier_legend', zombie: 'card_base', boss: 'card_tier_legend' };
const WORLD_NAMES = ['달밤 초록 언덕', '부글부글 화산', '뭉게구름 하늘섬', '꽁꽁 얼음골', '덜컹덜컹 쇠 광산', '으스스 유령 묘지', '모래바람 사막', '끈적끈적 독 늪', '반짝반짝 수정 동굴', '좀비 드래곤 성'];
const SEEN_KEY = 'idgCodexSeen';
const seen = (() => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); } })();
const markSeen = (id) => { if (seen.has(id)) return; seen.add(id); try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* */ } };

/** 부품 캐릭터 몸 전체를 한 장으로 (rig.json 의 기본 자세 · 기준점 a · 자리 p · flip) */
export async function bodyCanvas(art) {
  const rig = await (await fetch(`${AI}${art}/rig.json`)).json();
  const imgs = await Promise.all(rig.parts.map((q) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = `${AI}${art}/${q.n}.png`; })));
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
    prog.replaceChildren(el('span', `${T.name} ${n} / ${T.ids.length}`), el('i', null, [el('b', { style: `width:${Math.round((got / all) * 100)}%` })]), el('span.all', `전체 ${got}/${all} · ${Math.round((got / all) * 100)}%`));
    grid.className = 'idg-cx-grid' + (tab === 'world' ? ' world' : '');
    grid.replaceChildren(...T.ids.map((id, i) => (tab === 'world' ? worldCard(id) : card(T, id, i))));
  }
  function card(T, id, i) {
    const on = T.have(id), art = T.art(id), isNew = on && !seen.has(`${tab}:${id}`);
    /* 대표님 «수집은 못했지만 어떤 캐릭터인지 눌러볼 수 있게» : 못 모은 것 = 흑백 + «미수집» 도장 · 이름은 보임 · 눌러서 자세히 */
    return el('button.idg-cx-card.' + T.cls(id) + (on ? '' : '.off'), { type: 'button', style: `background-image:url(${CX}${TIER[T.cls(id)] || 'card_base'}.png)`, onclick: () => detail(T, i) }, [
      el('img.breath', { src: `${AI}${art}/head.png`, alt: '', onerror: (e) => { if (!e.target.dataset.f) { e.target.dataset.f = 1; e.target.src = `${AI}${art}/torso.png`; } } }),
      el('b', T.data(id).name), el('span', on ? T.sub(id) : (T.short || T.hint)(id)), on ? null : el('em.stamp', '미수집'), isNew ? el('em.new', 'NEW') : null,
    ].filter(Boolean));
  }
  function worldCard(w) {
    const on = worldOpen(w);
    return el('button.idg-cx-world' + (on ? '' : '.off'), { type: 'button', onclick: () => { if (!on) { Sfx.play('button_deny'); return; } worldView(w); } }, [
      el('img', { src: `${AI}bg/w${String(w).padStart(2, '0')}_panel.png`, alt: '' }), el('b', `월드 ${w}`), el('span', on ? WORLD_NAMES[w - 1] : '🔒 아직 못 갔어요'),
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
      const bar = (label, key) => el('div.idg-cx-bar' + (on ? '' : '.q'), null, [el('span', label), on ? el('i', null, [el('b', { style: `width:${Math.round(((Number(d[key]) || 0) / maxOf(T.ids, T.data, key)) * 100)}%` })]) : el('em', '???')]);
      info.replaceChildren(
        el('h3', d.name), el('div.sub', `${T.sub(id)}${d.role ? ' · ' + d.role : ''}`),
        bar('체력', 'hp'), bar('공격', 'atk'), bar('사거리', 'range'), bar('빠르기', 'speed'),
        el('div.first', tab === 'dragon' ? (d.rar === 'story' ? '모험에서 함께해요' : '알 부화장에서 태어나요') : `처음 만나는 판 : ${firstAt[id] || '?'}`),
        on ? null : el('div.idg-cx-get', null, [el('span', `얻는 법 · ${T.hint(id)}`), T.go?.(id) ? button('바로 가기', () => { const f = T.go(id); closeAll(); f(); }) : null].filter(Boolean)),
      );
    };
    const step = (dlt) => { Sfx.play('sfx_menu_move'); k = (k + dlt + ids.length) % ids.length; show(); };
    const box = el('div.dialog.idg-cx-detail', { onclick: (e) => e.stopPropagation() }, [
      el('div.idg-cx-dwrap', null, [el('button.idg-cx-arrow', { type: 'button', onclick: () => step(-1) }, ['◀']), stage, el('button.idg-cx-arrow', { type: 'button', onclick: () => step(1) }, ['▶'])]),
      info,
      el('div.idg-row2', null, [button('🔊 다시 듣기', () => sound(ids[k])), button('닫기', () => { close(); draw(); }, { primary: true })]),
    ]);
    const overlay = el('div.dialog-overlay', { onclick: () => { close(); draw(); } }, [box]);
    const close = presentOverlay(overlay);
    closeD = close;
    show();
  }
  let closeD = null;
  const closeAll = () => { closeD?.(); closeMain?.(); };
  /** 배경 구경 : 끌어 보기 + 그 월드 곡 */
  function worldView(w) {
    const n = String(w).padStart(2, '0');
    const strip = el('div.idg-cx-strip', null, [el('img', { src: `${AI}bg/w${n}_panel.png`, alt: '' })]);
    Audio.worldBgm(w);
    const box = el('div.dialog.idg-cx-wdetail', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', `월드 ${w} · ${WORLD_NAMES[w - 1]}`), el('div.idg-cx-tip', '◀ 손가락으로 끌어서 구경해요 ▶'), strip, button('닫기', () => close(), { primary: true })]);
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
