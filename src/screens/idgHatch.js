/**
 * 좀비와 드래곤 — «알 부화장» 화면 (B6 · 2026-11-11 야간 · 기획서 10.4)
 * 1개 / 10개 · 확률을 화면에 적는다 · 천장까지 남은 횟수 · 알이 흔들리고 → 금이 가고 → 빛 색으로 등급 → 용이 나온다.
 * 계산은 services/iandragonHatch.js (화면과 분리 · 검사 도구 있음).
 *
 * 레이아웃 «부화장 C» (11/14 대표님 선택 · tools/_uimock/hatch_c2.html · 디자인 규칙표 2판)
 *   위 줄 = 왼쪽 재화 알약(v2Cash) · 가운데 날개 제목 · 오른쪽 X
 *   몸 = 왼쪽 정보 칸(확률 종이 · 전설까지 남은 횟수 막대 · 모은 용 · 주황 [용 도감 ›])
 *        + 가운데 받침대 위 큰 알(깨기 연출도 이 자리) + 오른쪽 «방금 나온 용» 카드 + 초록 [알 1개] [알 10개]
 *   모양 = src/styles/idg-v2-hatch.css
 */
import { el, presentOverlay } from './ui.js';
import { getSettings } from '../audio/audio.js';
import * as G from '../services/iandragonGame.js';
import * as Sfx from '../audio/sfx.js';
import { UNITS } from '../games/iandragon_game/data/units.js';
import { hatch, EGG, RATES, PITY, RAR_KO } from '../services/iandragonHatch.js';
import { xTitle, v2Cash } from './idgXwin.js';
import { showCodex } from './idgCodex.js';
import '../styles/idg-v2-hatch.css';

const AI = '/assets/iandragon_game/ai/';
const GEM = `${AI}ui/gem.svg`;
/* 게임 소리(겜팀장) — 부화장에서만 늦게 받는다 */
const snd = (fn) => { if (getSettings().sfxEnabled === false) return; import('../games/iandragon_game/audio/index.js').then((A) => { A.init(); fn(A); }).catch(() => {}); };
const REVEAL = { rare: 'hatch_reveal_rare', super: 'hatch_reveal_super', legend: 'hatch_reveal_legend' };
const RANK = { rare: 0, super: 1, legend: 2 };
/* 알에서 나오는 용 (희귀 → 슈퍼 → 전설 순) */
const POOL = Object.keys(UNITS).filter((id) => RANK[UNITS[id].rar] != null).sort((a, b) => RANK[UNITS[a].rar] - RANK[UNITS[b].rar]);
/* «방금 나온 용» — 창을 다시 열어도 보이게 (이 기기에만 · 없어도 됨) */
const LAST_KEY = 'idgHatchLast';
const loadLast = () => { try { const v = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); return v && UNITS[v.id] && RANK[v.rar] != null ? v : null; } catch { return null; } };
const saveLast = (v) => { try { localStorage.setItem(LAST_KEY, JSON.stringify(v)); } catch { /* */ } };
/* 도트 오른쪽 화살표 (규칙표 ③ 주황 바로가기) */
const ARROW = '<svg viewBox="0 0 4 7" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M0 0h1v1H0zM0 1h2v1H0zM0 2h3v1H0zM0 3h4v1H0zM0 4h3v1H0zM0 5h2v1H0zM0 6h1v1H0z"/></svg>';
/* 큰 머리 그림이 없으면 작은 머리로 */
const headBig = (id, alt = '') => el('img', { src: `${AI}${id}/head_big.png`, alt, draggable: false, onerror: (e) => { e.target.onerror = null; e.target.src = `${AI}${id}/head.png`; } });

export function showHatch(onChange) {
  Sfx.play('sfx_menu_select');
  /* 10개 묶음 할인 % (1개 값 × 10 대비) — 단추 딱지 */
  const off = Math.round((1 - EGG.ten / (EGG.one * 10)) * 100);
  let busy = false;
  const g0 = G.idg();
  const cash = v2Cash(g0.coins, g0.gems);
  const info = el('div.idg-hc-info'), nest = el('div.idg-hc-nest'), last = el('div.idg-hc-last'), buy = el('div.idg-hc-buy');
  const egg = (rar = 'rare', cls = '') => el(`div.idg-egg.idg-hc-egg${cls}`, null, [el('img', { src: `${AI}eggs/egg_${rar}.png`, alt: '', draggable: false, onerror: (e) => e.target.remove() })]);
  const sparkles = () => [el('img.idg-hc-sp.a', { src: `${AI}eggs/sparkle.png`, alt: '', draggable: false }), el('img.idg-hc-sp.b', { src: `${AI}eggs/sparkle.png`, alt: '', draggable: false })];
  const setNest = (...kids) => nest.replaceChildren(...sparkles(), el('span.idg-hc-ped'), ...kids);

  function drawCash() { const g = G.idg(); cash.replaceChildren(...v2Cash(g.coins, g.gems).childNodes); }
  function drawInfo() {
    const g = G.idg(), pity = g.pity || 0, left = PITY - pity;
    const has = (id) => !!g.units?.[id];
    const rate = (k) => el(`div.idg-hc-rate.${k}`, null, [el('i'), el('span', RAR_KO[k]), el('b', `${Math.round(RATES[k] * 100)}%`)]);
    info.replaceChildren(
      el('div.idg-k-paper.idg-hc-paper.rates', { role: 'note', 'aria-label': '알 확률' }, [rate('rare'), rate('super'), rate('legend')]),
      el('div.idg-k-paper.idg-hc-paper.pity', { role: 'note' }, [
        el('span', null, ['전설까지 ', el('b', `${left}번`), ' 남음']),
        el('div.idg-hc-bar', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': PITY, 'aria-valuenow': pity }, [el('u', { style: `width:${Math.max(0, Math.min(100, (pity / PITY) * 100))}%` })]),
      ]),
      el('div.idg-k-paper.idg-hc-paper.own', { role: 'note' }, [
        el('span', null, ['모은 용 ', el('b', String(POOL.filter(has).length)), ` / ${POOL.length}`]),
        el('div.idg-hc-own', null, POOL.map((id) => el(`img.${UNITS[id].rar}${has(id) ? '' : '.no'}`, { src: `${AI}${id}/head.png`, alt: has(id) ? UNITS[id].name : '아직 없음', title: has(id) ? UNITS[id].name : null, draggable: false }))),
      ]),
      el('div.idg-hc-grow'),
      el('button.idg-hc-go', { type: 'button', onclick: () => { if (busy) return; Sfx.play('sfx_menu_select'); close(); showCodex({ hatch: () => showHatch(onChange) }); } }, [
        el('img', { src: `${AI}lobby/ico_codex.png`, alt: '', draggable: false }), el('span', '용 도감'), el('i', { html: ARROW }),
      ]),
    );
  }
  function drawLast(v) {
    const card = v
      ? el(`div.idg-hc-card.${v.rar}`, null, [el('div.art', null, [headBig(v.id)]), el('b.nm', UNITS[v.id].name), el('span.fx', v.dup ? `${RAR_KO[v.rar]} · +${v.plus}` : `${RAR_KO[v.rar]} · NEW`)])
      : el('div.idg-hc-card.none', null, [el('div.art', null, [el('img', { src: `${AI}eggs/egg_rare.png`, alt: '', draggable: false })]), el('b.nm', '아직 없어요'), el('span.fx', '알을 깨 보세요')]);
    last.replaceChildren(el('div.idg-hc-sec', '방금 나온 용'), card);
  }
  /* 초록 = 사기 (규칙표 ③) · 젬이 모자라면 숫자만 빨강 + 눌리지 않음 */
  const buyBtn = (n, gem, tag) => {
    const poor = (G.idg().gems || 0) < gem;
    return el(`button.idg-hc-btn${poor ? '.poor' : ''}`, { type: 'button', disabled: poor || busy, 'aria-label': `알 ${n}개 젬 ${gem}${poor ? ' (젬이 모자라요)' : ''}`, onclick: () => go(n) }, [
      el('span', `알 ${n}개`), el('img', { src: GEM, alt: '', draggable: false }), el('b', gem.toLocaleString('en-US')), tag ? el('i.idg-hc-off', tag) : null,
    ]);
  };
  function drawBuy() { buy.replaceChildren(buyBtn(1, EGG.one), buyBtn(10, EGG.ten, off > 0 ? `-${off}%` : '')); }

  function go(n) {
    if (busy) return;
    const r = hatch(G.idg(), n);
    if (!r) return;
    G.saveIdg(r.part); onChange?.();
    Sfx.play('sfx_menu_select');
    busy = true; drawCash(); drawBuy();
    const best = r.results.some((x) => x.rar === 'legend') ? 'legend' : r.results.some((x) => x.rar === 'super') ? 'super' : 'rare';
    /* 연출 : 받침대 위 알 흔들림 0.9초 → 금 + 등급 빛 0.5초 → 결과 */
    setNest(egg(best, `.shake.${best}`));
    /* 소리(겜팀장) : 달그락 ×3 → 빠직 → 등급 소리. 전설은 북소리 1.3초가 끝나는 순간 알이 터진다 */
    for (const t of [0, 300, 600]) setTimeout(() => snd((A) => A.play('egg_shake')), t);
    snd((A) => A.voice('hatch/shake'));   // 겜팀장 대사 (파일이 없으면 조용히 넘어감)
    setTimeout(() => { nest.querySelector('.idg-hc-egg')?.classList.add('crack'); snd((A) => { A.play('egg_crack'); if (best === 'legend') A.play(REVEAL.legend); }); }, 900);
    const burst = best === 'legend' ? 900 + 1300 : 1400;
    if (best !== 'legend') setTimeout(() => snd((A) => A.play(REVEAL[best])), burst);
    setTimeout(() => snd((A) => A.voice(`hatch/${best}`)), burst + 150);
    setTimeout(() => {
      /* 1개 = 받침대 위에 나온 용 · 10개 = 받침대 앞에 카드 10장 (5 × 2) */
      if (n === 1) {
        const x = r.results[0];
        setNest(el(`div.idg-hc-born.${x.rar}`, null, [headBig(x.id, UNITS[x.id].name)]));
      } else {
        setNest(el('div.idg-hc-grid', null, r.results.map((x, i) => el(`div.idg-hc-mini.${x.rar}`, { style: `animation-delay:${i * 0.08}s` }, [
          el('img', { src: `${AI}${x.id}/head.png`, alt: '', draggable: false }),
          el('b', UNITS[x.id].name), el('span', x.dup ? `+${x.plus}` : 'NEW'),
        ]))));
      }
      /* «방금 나온 용» = 이번에 나온 것 중 가장 높은 등급 (같으면 처음 것) */
      const top = r.results.reduce((a, x) => (RANK[x.rar] > RANK[a.rar] ? x : a), r.results[0]);
      const v = { id: top.id, rar: top.rar, dup: !!top.dup, plus: top.plus || 0 };
      saveLast(v); drawLast(v);
      busy = false; drawInfo(); drawBuy();
    }, burst);
  }

  drawInfo(); drawLast(loadLast()); drawBuy();
  setNest(egg('rare'));
  const root = el('div.idg-hc', null, [info, nest, el('div.idg-hc-act', null, [last, buy])]);
  const box = el('div.dialog.idg-hatch.idg-xw', { onclick: (e) => e.stopPropagation() }, [xTitle('부화장', () => close(), { left: [cash] }), root]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}
