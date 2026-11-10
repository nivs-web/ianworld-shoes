/**
 * 좀비와 드래곤 — «꾸미기» 창 (META 기획서 2장 · 2026-11-11)
 * 칸별로 가진 것 중 하나를 고른다(없음 포함). 능력치는 그대로 — 모양만 바뀐다.
 * 저장 필드 : look (encodeLook 글자 'h3.n1.b2.f4.r0.t7') · title (칭호 id, 얻은 것만).
 * showLook({ idg, save }) — idg = 지금 저장값, save(part) = 저장 후 새 idg 를 돌려주는 함수(G.saveIdg).
 */
import { el, button, presentOverlay } from './ui.js';
import * as Sfx from '../audio/sfx.js';
import { SLOTS, SLOT_NAME, LOOKS, TITLES, BREATH_COLORS, encodeLook, decodeLook, hasItem } from '../games/iandragon_game/data/looks.js';

const AI = '/assets/iandragon_game/ai/';
const META = `${AI}meta/`;
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const imgFor = (slot, id) => (slot === 'title' ? `${META}badge_${id}.png` : `${META}${slot}_${id}.png`);

/** 그림이 없으면 글자로 */
function pic(slot, id, name, style) {
  const wrap = el('span', { style: 'display:grid;place-items:center;overflow:hidden;font-size:9px;color:#bba;text-align:center;' + (style || 'width:36px;height:36px') });
  const img = el('img', { src: imgFor(slot, id), alt: '', style: 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated' });
  img.onerror = () => { wrap.replaceChildren(document.createTextNode(String(name || id).slice(0, 4))); };
  wrap.append(img);
  return wrap;
}

export function showLook({ idg, save }) {
  Sfx.play('sfx_menu_select');
  let cur = idg;
  // 지금 꾸밈 — 가진 것만 남긴다 (예전에 저장된 값이 이상해도 안전)
  const sel = decodeLook(cur.look);
  sel.title = TITLES.some((t) => t.id === cur.title && t.has(cur)) ? cur.title : null;
  for (const s of SLOTS) if (sel[s] && !hasItem(cur, s, sel[s])) sel[s] = null;
  const leader = !cur.leader || cur.leader === 'auto' ? 'novart' : cur.leader;

  const preview = el('div.idg-look-preview', { style: 'position:relative;width:150px;height:150px;margin:8px auto 4px;border-radius:14px;background:#221548;border:4px solid #554' });
  const info = el('div.idg-nest-help');
  const body = el('div.idg-lab-sec');

  function drawPreview() {
    const frameColor = { wood: '#a0703a', silver: '#c8d0d8', gold: '#FFC93C', fire: '#ff6b2b' }[sel.frame] || '#554';
    preview.style.borderColor = frameColor;
    const head = el('img', { src: `${AI}${leader}/head.png`, alt: '', style: 'position:absolute;left:25%;top:30%;width:50%;height:50%;object-fit:contain;image-rendering:pixelated', onerror: (e) => { e.target.style.display = 'none'; } });
    const parts = [head];
    if (sel.neck) parts.push(el('img', { src: imgFor('neck', sel.neck), alt: '', style: 'position:absolute;left:22%;top:66%;width:56%;height:30%;object-fit:contain;image-rendering:pixelated', onerror: (e) => { e.target.style.display = 'none'; } }));
    if (sel.hat) parts.push(el('img', { src: imgFor('hat', sel.hat), alt: '', style: 'position:absolute;left:22%;top:6%;width:56%;height:36%;object-fit:contain;image-rendering:pixelated', onerror: (e) => { e.target.style.display = 'none'; } }));
    if (sel.flag) parts.push(el('div', { style: 'position:absolute;right:4px;top:4px;width:30px;height:30px' }, [pic('flag', sel.flag, LOOKS.flag.find((x) => x.id === sel.flag)?.name, 'width:100%;height:100%')]));
    // 브레스 색 띠 (바닥에 색 점)
    const cols = BREATH_COLORS[sel.breath || 'basic'] || [0xff9a3c, 0xffd84a, 0xff6b2b];
    parts.push(el('div', { style: 'position:absolute;left:8px;right:8px;bottom:5px;display:flex;gap:3px;justify-content:center' }, cols.map((c) => el('i', { style: `width:12px;height:6px;border-radius:3px;background:${hex(c)}` }))));
    preview.replaceChildren(...parts);
    const t = TITLES.find((x) => x.id === sel.title);
    info.textContent = t ? `칭호 «${t.name}»` : '칭호 없음';
  }

  /** 지금 고른 모양을 저장 (고를 때마다 바로) */
  function commit() {
    const next = save({ look: encodeLook(sel), title: sel.title || '' });
    if (next) cur = next;
    Sfx.play('sfx_menu_select'); draw();
  }

  function draw() {
    drawPreview();
    const secs = [];
    for (const slot of SLOTS) {
      const owned = LOOKS[slot].filter((x) => hasItem(cur, slot, x.id));
      const row = el('div.idg-leader-row');
      const pick = (id) => { sel[slot] = id; commit(); };
      row.appendChild(el('button.idg-leader' + (!sel[slot] ? '.on' : ''), { type: 'button', onclick: () => pick(null) }, [el('b', '없음')]));
      for (const x of owned) {
        row.appendChild(el('button.idg-leader' + (sel[slot] === x.id ? '.on' : ''), { type: 'button', onclick: () => pick(x.id) }, [pic(slot, x.id, x.name), el('b', x.name)]));
      }
      const sec = el('div', null, [el('div.idg-codex-h', SLOT_NAME[slot]), row]);
      if (!owned.length) sec.appendChild(el('div.idg-nest-help', slot === 'frame' ? '명예의 전당 시즌 보상으로 받아요' : slot === 'title' ? '도전 과제와 기록으로 얻어요' : '용 시장에서 사 보세요'));
      if (slot === 'title') {
        // 아직 못 얻은 칭호는 얻는 방법만 보여 준다
        for (const t of TITLES.filter((x) => !x.has(cur))) sec.appendChild(el('div.idg-nest-help', { style: 'text-align:left;margin:2px 0' }, [`잠김 «${t.name}» — ${t.how}`]));
      }
      secs.push(sec);
    }
    body.replaceChildren(...secs);
  }
  draw();

  const box = el('div.dialog.idg-look.idg-lab', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', '꾸미기'), preview, info, body, button('닫기', () => close())]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}
