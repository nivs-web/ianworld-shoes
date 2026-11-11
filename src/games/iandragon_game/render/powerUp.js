/**
 * 판 사이 «파워 업» (2026-11-11 대표님 «냥코처럼 게임 끝나면 파워업 창 · 로비로 안 나가도 바로 레벨업»)
 *
 * 전투 화면 HUD 판(panel) 안에 그린다 — 세로 화면에서 틀을 돌려도(rot.js) 함께 돌아간다.
 * 용 카드를 좌우로 넘기며(◀ ▶ · 손가락 밀기) 레벨 · 힘 · 필요 코인을 보고 큰 «파워 업!!»으로 바로 올린다.
 * 규칙은 로비 «용 둥지»(screens/idgNest.js)와 같다 : ECON.lvCost · 레벨 상한 ECON.capAt.
 * 맨 앞 카드는 리더(브레스) — 브레스 사거리 · 위력을 숫자와 막대로 보여 준다 (레벨업할지 새 용을 뽑을지 고르는 기준).
 */
import * as Audio from '../audio/index.js';
import { UNITS } from '../data/units.js';
import { LEADERS } from '../data/leaders.js';
import { ECON } from '../data/econ.js';
import { powerMul } from '../core/rules.js';
import { unlockedBefore, stageByNo, LAST_STAGE } from './battleSetup.js';
import { breathStats } from './breathInfo.js';
import { px } from './rot.js';

const AI = '/assets/iandragon_game/ai/';
const capOf = (cleared) => ECON.capAt.reduce((c, [g, cap]) => (cleared >= g ? cap : c), 10);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

/**
 * @param {(tag:string, cls?:string, text?:string)=>HTMLElement} h
 * @param {{ save:()=>object, write:(part:object)=>object, leader?:string, onBack:()=>void }} o
 */
export function powerUpPanel(h, o) {
  const box = h('div', 'idg-card idg-pu');
  let at = 0;
  const ids = () => {
    const g = o.save(), un = unlockedBefore((g.cleared || 0) + 1);
    return [...new Set([...un.dragons, ...Object.keys(g.units || {}).filter((id) => UNITS[id] && UNITS[id].rar !== 'story')])].filter((id) => UNITS[id]);
  };
  const bar = (label, v, max, txt) => {
    const r = h('div', 'idg-pu-stat'), b = h('i'), f = h('b');
    f.style.width = `${Math.round(Math.max(0.04, Math.min(1, v / max)) * 100)}%`; b.appendChild(f);
    r.append(h('span', null, label), b, h('em', null, txt)); return r;
  };
  function draw() {
    const g = o.save(), cap = capOf(g.cleared || 0), list = ids(), n = list.length + 1;
    at = (at + n) % n;
    const coins = h('div', 'idg-pu-coins', `코인 ${fmt(g.coins || 0)}`);
    const card = h('div', 'idg-pu-card'), face = h('img', 'idg-pu-face'); face.alt = '';
    const info = h('div', 'idg-pu-info');
    let up = null;
    if (at === 0) {   /* 리더 · 브레스 */
      const L = LEADERS?.[o.leader] || {}, bs = breathStats(o.leader, g);
      face.src = `${AI}${o.leader}/head.png`;
      info.append(h('b', 'nm', `${L.ko || L.name || '리더'} · 브레스`), h('span', 'lv', '오른쪽 아래 필살기'),
        bar('사거리', bs.range, 1000, `${bs.range}`), bar('위력', bs.power, 2400, fmt(bs.power)), bar('밀어내기', bs.push, 3, `${bs.push}칸`),
        h('p', 'idg-pu-help', `충전 ${bs.charge}초 · 연구소에서 더 세져요`));
    } else {
      const id = list[at - 1], U = UNITS[id], lv = g.units?.[id]?.[0] || 1, cost = ECON.lvCost(lv), max = lv >= cap, poor = (g.coins || 0) < cost;
      const form = lv >= 20 ? U.forms?.[2] : lv >= 10 ? U.forms?.[1] : null;
      face.src = `${AI}${lv >= 10 ? `${id}_2` : id}/head.png`; face.onerror = () => { face.onerror = null; face.src = `${AI}${id}/head.png`; };
      const exp = stageByNo(Math.min(LAST_STAGE, (g.cleared || 0) + 1)).expLevel || 1;   /* 전투는 저장 레벨 · 권장 레벨 중 큰 값 */
      const m = powerMul(Math.max(lv, exp)), m2 = powerMul(Math.max(Math.min(cap, lv + 1), exp));
      info.append(h('b', 'nm', form?.name || U.name), h('span', 'lv', `Lv ${lv}${max ? ' (최고)' : ` → ${lv + 1}`}${exp > lv ? ` · 다음 판은 권장 Lv${exp} 로 나가요` : ''}`),
        bar('체력', U.hp * m, 6000, `${fmt(U.hp * m)}${max ? '' : ` → ${fmt(U.hp * m2)}`}`),
        bar('공격', U.atk * m, 900, `${fmt(U.atk * m)}${max ? '' : ` → ${fmt(U.atk * m2)}`}`),
        bar('사거리', U.range || 40, 400, `${U.range || 40}`));
      if (lv < 10 && U.forms?.[1]) info.append(h('p', 'idg-pu-help', `Lv10 이 되면 «${U.forms[1].name}» 으로 진화!`));
      up = h('button', 'idg-btn main idg-pu-up', max ? `최고 레벨 (상한 ${cap})` : poor ? `코인 ${fmt(cost)} 필요` : `파워 업!! ${fmt(cost)}`);
      up.type = 'button'; up.disabled = max || poor;
      up.onclick = () => {
        const cur = o.save(), now = cur.units?.[id]?.[0] || 1, c = ECON.lvCost(now);
        if ((cur.coins || 0) < c || now >= capOf(cur.cleared || 0)) return;
        o.write({ coins: cur.coins - c, units: { ...cur.units, [id]: [now + 1, cur.units?.[id]?.[1] || 0] } });
        const evo = now + 1 === 10 || now + 1 === 20;
        Audio.play(evo ? 'evolve' : 'levelup'); if (evo) Audio.voice('evolve');
        card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
        draw();
      };
    }
    card.append(face, info);
    const prev = h('button', 'idg-pu-arrow l', '◀'), next = h('button', 'idg-pu-arrow r', '▶');
    prev.type = next.type = 'button'; prev.onclick = () => { at--; draw(); }; next.onclick = () => { at++; draw(); };
    const nav = h('div', 'idg-pu-nav'); nav.append(prev, card, next);
    let sx = null; card.onpointerdown = (e) => { sx = px(e); }; card.onpointerup = (e) => { if (sx == null) return; const d = px(e) - sx; sx = null; if (Math.abs(d) > 40) { at += d < 0 ? 1 : -1; draw(); } };
    const dots = h('div', 'idg-pu-dots', `${at + 1} / ${n}`);
    const row = h('div', 'idg-row'); if (up) row.appendChild(up);
    const back = h('button', 'idg-btn', '돌아가기'); back.type = 'button'; back.onclick = () => o.onBack(); row.appendChild(back);
    box.replaceChildren(h('h2', null, '파워 업'), coins, nav, dots, row);
  }
  draw();
  return box;
}
