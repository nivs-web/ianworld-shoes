/**
 * 한 페이지 파워업 (2026-11-11 대표님 «1개 페이지로 가로 · 세로 모두 한 페이지에서 쉽게 슬롯 끼고 빼고 업글도 가능하게»)
 *
 *  위  : 코인 · 젬 · 비용 제한 띠 + 리더 브레스(사거리 · 위력 · 밀어내기 · 충전)
 *  슬롯: 출전 칸(덱). 칸을 누르면 빠지고, 빈 칸은 «+». «바꿀 칸을 고르세요» 상태에서 칸을 누르면 맞바꿈.
 *  목록: 가진 용 전체 카드. 카드를 누르면 빈 칸에 바로 들어가고, 꽉 찼으면 바꿀 칸을 고르게 한다.
 *        카드마다 레벨 · 체력/공격/사거리 막대 · «레벨업 ○○» 단추(진화 레벨이면 «진화»).
 *  아래: 고정 단추 (전투 안 = «전투 개시!» · «돌아가기» / 로비 = «닫기»)
 *  배치 : 가로 = 왼쪽 슬롯 세로 줄 + 오른쪽 목록 3~4열 · 세로 = 위 슬롯 가로 줄 + 아래 목록 2~3열 (같은 페이지 · CSS 만 다름)
 *  규칙은 로비 «파워업»(옛 용 둥지)과 같다 : ECON.lvCost · 레벨 상한 ECON.capAt · 덱 2칸 이상 · 칸 수 un.deckCap.
 *  소리 : 끼우기 deploy_s · 빼기 button_back · 레벨업 levelup · 진화 evolve + voice evolve · 코인 부족 button_deny (겜팀장)
 */
import * as Audio from '../audio/index.js';
import { UNITS } from '../data/units.js';
import { LEADERS } from '../data/leaders.js';
import { ECON } from '../data/econ.js';
import { powerMul } from '../core/rules.js';
import { unlockedBefore, stageByNo, LAST_STAGE, makeLoads } from './battleSetup.js';
import { breathStats } from './breathInfo.js';

const AI = '/assets/iandragon_game/ai/';
const capOf = (cleared) => ECON.capAt.reduce((c, [g, cap]) => (cleared >= g ? cap : c), 10);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const play = (n) => { try { Audio.init(); Audio.play(n); } catch { /* */ } };

/**
 * @param {(tag:string, cls?:string, text?:string)=>HTMLElement} h
 * @param {{ save:()=>object, write:(part:object)=>object, leader?:string, buttons:[string,Function,string?][], cls?:string }} o
 */
export function powerPage(h, o) {
  const box = h('div', o.cls || 'idg-pp');
  let swapFor = null;   /* 꽉 찼을 때 넣으려는 용 → 바꿀 칸을 고르는 중 */
  function draw() {
    const g = o.save(), cleared = g.cleared || 0, next = stageByNo(Math.min(LAST_STAGE, cleared + 1));
    const un = unlockedBefore(cleared + 1), cap = capOf(cleared), exp = next.expLevel || 1;
    const ids = [...new Set([...un.dragons, ...Object.keys(g.units || {}).filter((id) => UNITS[id] && UNITS[id].rar !== 'story')])].filter((id) => UNITS[id]);
    const deck = (g.deck || []).filter((id) => ids.includes(id)).length >= 2 ? g.deck.filter((id) => ids.includes(id)).slice(0, un.deckCap) : makeLoads(next, g).deck.map((d) => d.id);
    const ld = o.leader || makeLoads(next, g).loads[0].leader;
    const setDeck = (d) => { o.write({ deck: d }); };

    /* 위 띠 */
    const band = h('div', 'idg-pp-band');
    band.append(h('span', 'coin', `코인 ${fmt(g.coins || 0)}`), h('span', 'gem', `젬 ${fmt(g.gems || 0)}`), h('span', 'slots', `출전 ${deck.length} / ${un.deckCap}칸`));
    if (next.costMax) band.append(h('span', 'limit', `다음 판 ${next.id} : 비용 ${next.costMax} 이하만`));
    const bs = breathStats(ld, g), lead = h('div', 'idg-pp-lead');
    const face = h('img'); face.src = `${AI}${ld}/head.png`; face.alt = '';
    lead.append(face, h('b', null, `${LEADERS[ld]?.ko || '리더'} 브레스`), h('span', null, `사거리 ${bs.range} · 위력 ${fmt(bs.power)} · 밀어내기 ${bs.push} · 충전 ${bs.charge}초`));

    /* 출전 칸 */
    const slots = h('div', 'idg-pp-slots' + (swapFor ? ' pick' : ''));
    for (let i = 0; i < un.deckCap; i++) {
      const id = deck[i], b = h('button', 'idg-pp-slot' + (id ? '' : ' empty')); b.type = 'button';
      if (id) {
        const im = h('img'); im.src = `${AI}${id}/head.png`; im.alt = UNITS[id].name; b.append(im, h('em', null, `Lv${Math.max(g.units?.[id]?.[0] || 1, exp)}`));
        b.onclick = () => {
          if (swapFor) { const d = deck.slice(); d[i] = swapFor; swapFor = null; setDeck(d); play('deploy_s'); draw(); return; }
          if (deck.length <= 2) { play('button_deny'); return; }
          setDeck(deck.filter((x) => x !== id)); play('button_back'); draw();
        };
      } else { b.append(h('b', null, '+')); b.onclick = () => { swapFor = null; draw(); }; }
      slots.appendChild(b);
    }
    const hint = h('p', 'idg-pp-hint', swapFor ? `«${UNITS[swapFor].name}» 과 바꿀 칸을 고르세요` : '카드를 누르면 출전 ↔ 대기가 바뀌어요');

    /* 용 목록 */
    const list = h('div', 'idg-pp-list');
    for (const id of ids) {
      const U = UNITS[id], lv = g.units?.[id]?.[0] || 1, cost = ECON.lvCost(lv), max = lv >= cap, poor = (g.coins || 0) < cost;
      const on = deck.includes(id), over = next.costMax && U.cost > next.costMax;
      const evo = (lv + 1 === 10 && U.forms?.[1]) || (lv + 1 === 20 && U.forms?.[2]);
      const form = lv >= 20 ? U.forms?.[2] : lv >= 10 ? U.forms?.[1] : null;
      const m = powerMul(Math.max(lv, exp));
      const card = h('div', 'idg-pp-card' + (on ? ' on' : '') + (over ? ' over' : '') + (swapFor === id ? ' sel' : ''));
      const im = h('img'); im.src = `${AI}${lv >= 10 ? `${id}_2` : id}/head.png`; im.alt = ''; im.onerror = () => { im.onerror = null; im.src = `${AI}${id}/head.png`; };
      const bar = (lb, v, mx) => { const r = h('div', 'st'), i = h('i'), f = h('b'); f.style.width = `${Math.round(Math.max(0.05, Math.min(1, v / mx)) * 100)}%`; i.appendChild(f); r.append(h('span', null, lb), i); return r; };
      const top = h('div', 'idg-pp-pick');
      top.append(im, h('b', 'nm', form?.name || U.name), h('span', 'lv', `Lv ${lv}${exp > lv ? ` (권장 ${exp})` : ''} · 비용 ${U.cost}`), on ? h('em', 'tag', '출전') : h('em', 'tag off', over ? '비용 초과' : '대기'));
      /* 카드 전체(레벨업 단추만 빼고)를 누르면 출전 ↔ 대기 (대표님 11/11 «직관적으로 빠르게 넣고 빼게») */
      card.onclick = () => {
        if (on) { if (deck.length <= 2) { play('button_deny'); return; } setDeck(deck.filter((x) => x !== id)); play('button_back'); draw(); return; }
        if (over) { play('button_deny'); return; }
        if (deck.length < un.deckCap) { setDeck([...deck, id]); play('deploy_s'); swapFor = null; draw(); return; }
        swapFor = swapFor === id ? null : id; play('button'); draw();
      };
      const up = h('button', 'idg-btn idg-pp-up' + (evo ? ' evo' : ''), max ? `최고 (상한 ${cap})` : `${evo ? '진화' : '레벨업'} ${fmt(cost)}`); up.type = 'button';
      if (max) up.disabled = true; else if (poor) up.classList.add('poor');
      up.onclick = (e) => {
        e.stopPropagation();
        const cur = o.save(), now = cur.units?.[id]?.[0] || 1, c = ECON.lvCost(now);
        if (now >= capOf(cur.cleared || 0)) return;
        if ((cur.coins || 0) < c) { play('button_deny'); return; }
        o.write({ coins: cur.coins - c, units: { ...cur.units, [id]: [now + 1, cur.units?.[id]?.[1] || 0] } });
        const ev = now + 1 === 10 || now + 1 === 20;
        play(ev ? 'evolve' : 'levelup'); if (ev) { try { Audio.voice('evolve'); } catch { /* */ } }
        draw();
        const again = list.querySelector(`[data-id="${id}"]`); if (again) { again.classList.add('pop'); }
      };
      card.dataset.id = id;
      card.append(top, bar('체력', U.hp * m, 6000), bar('공격', U.atk * m, 900), bar('사거리', U.range || 40, 400), up);
      list.appendChild(card);
    }
    const row = h('div', 'idg-row idg-pp-row');
    for (const [label, fn, cls] of o.buttons) { const b = h('button', 'idg-btn ' + (cls || ''), label); b.type = 'button'; b.onclick = fn; row.appendChild(b); }
    const side = h('div', 'idg-pp-side'); side.append(lead, slots, hint);
    /* 고정 틀 : 제목 · 띠는 위에 고정 · 가운데만 스크롤 · 단추 한 줄은 아래에 고정 (뒤 배경 상자 없음) */
    const keep = box.querySelector('.idg-pp-body')?.scrollTop || 0;
    box.replaceChildren(h('h2', 'idg-pp-title', '파워업'), band, h('div', 'idg-pp-body', null), row);
    requestAnimationFrame(() => { const bd = box.querySelector('.idg-pp-body'); if (bd) bd.scrollTop = keep; });
    box.querySelector('.idg-pp-body').append(side, list);
  }
  draw();
  return box;
}
