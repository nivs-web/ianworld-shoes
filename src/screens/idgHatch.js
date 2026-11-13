/**
 * 좀비와 드래곤 — «알 부화장» 화면 (B6 · 2026-11-11 야간 · 기획서 10.4)
 * 1개 / 10개 · 확률을 화면에 적는다 · 천장까지 남은 횟수 · 알이 흔들리고 → 금이 가고 → 빛 색으로 등급 → 용이 나온다.
 * 계산은 services/iandragonHatch.js (화면과 분리 · 검사 도구 있음).
 */
import { el, button, presentOverlay } from './ui.js';
import { getSettings } from '../audio/audio.js';
import * as G from '../services/iandragonGame.js';
import * as Sfx from '../audio/sfx.js';
import { UNITS } from '../games/iandragon_game/data/units.js';
import { hatch, EGG, RATES, PITY, RAR_KO } from '../services/iandragonHatch.js';
import { kitWallet, kitPaper, kitPriceBtn } from './idgKit.js';
import { xTitle } from './idgXwin.js';   /* UI 키트 (11/12 · docs/IDG_DESIGN_STYLESHEET.md) */

const AI = '/assets/iandragon_game/ai/';
/* 게임 소리(겜팀장) — 부화장에서만 늦게 받는다 */
const snd = (fn) => { if (getSettings().sfxEnabled === false) return; import('../games/iandragon_game/audio/index.js').then((A) => { A.init(); fn(A); }).catch(() => {}); };
const REVEAL = { rare: 'hatch_reveal_rare', super: 'hatch_reveal_super', legend: 'hatch_reveal_legend' };

export function showHatch(onChange) {
  Sfx.play('sfx_menu_select');
  const info = el('div.idg-hatch-info'), stage = el('div.idg-hatch-stage'), btns = el('div.idg-hatch-buy');
  /* 10개 묶음 할인 % (1개 값 × 10 대비) — 단추 위 딱지 */
  const off = Math.round((1 - EGG.ten / (EGG.one * 10)) * 100);
  function drawInfo() {
    const g = G.idg();
    /* 11/12 대표님 : «젬» 글자 대신 젬 아이콘 · 확률 다음 줄에 «전설까지 ○번 남음» · 글씨 조금 크게 */
    info.replaceChildren(
      kitWallet({ coins: g.coins, gems: g.gems }),   /* 키트 «내 보유량» 지갑 판 (상점 · 부화장 맨 위) */
      kitPaper([el('span.idg-hatch-rates', null, [   /* 안내 = 종이 판 */
        el('span.r', `희귀 ${RATES.rare * 100}%`), ' · ', el('span.s', `슈퍼 ${RATES.super * 100}%`), ' · ', el('span.l', `전설 ${RATES.legend * 100}%`),
      ]), el('small.idg-hatch-pity', null, ['전설까지 ', el('b', `${PITY - (g.pity || 0)}번`), ' 남음'])]),
    );
    /* 노란 네모 → 결과 창 양식 고급 단추 (1개 = 초록 · 10개 = 빨강 + «할인» 딱지) · 가격은 젬 아이콘 + 숫자 */
    btns.replaceChildren(
      kitPriceBtn({ kind: 'green', label: '알 1개', gem: EGG.one, poor: g.gems < EGG.one, onClick: () => go(1) }),
      kitPriceBtn({ kind: 'red', label: '알 10개', gem: EGG.ten, poor: g.gems < EGG.ten, tag: off > 0 ? `${off}% 할인` : '', onClick: () => go(10) }),
    );
  }
  function go(n) {
    const r = hatch(G.idg(), n);
    if (!r) return;
    G.saveIdg(r.part); onChange?.();
    Sfx.play('sfx_menu_select');
    const best = r.results.some((x) => x.rar === 'legend') ? 'legend' : r.results.some((x) => x.rar === 'super') ? 'super' : 'rare';
    /* 연출 : 알 흔들림 0.9초 → 금 + 등급 빛 0.5초 → 결과 */
    stage.replaceChildren(el(`div.idg-egg.shake.${best}`, null, [el('img', { src: `${AI}eggs/egg_${best}.png`, alt: '', onerror: (e) => e.target.remove() })]));
    btns.style.visibility = 'hidden';
    /* 소리(겜팀장) : 달그락 ×3 → 빠직 → 등급 소리. 전설은 북소리 1.3초가 끝나는 순간 알이 터진다 */
    for (const t of [0, 300, 600]) setTimeout(() => snd((A) => A.play('egg_shake')), t);
    snd((A) => A.voice('hatch/shake'));   // 겜팀장 대사 (파일이 없으면 조용히 넘어감)
    setTimeout(() => { stage.firstChild?.classList.add('crack'); snd((A) => { A.play('egg_crack'); if (best === 'legend') A.play(REVEAL.legend); }); }, 900);
    const burst = best === 'legend' ? 900 + 1300 : 1400;
    if (best !== 'legend') setTimeout(() => snd((A) => A.play(REVEAL[best])), burst);
    setTimeout(() => snd((A) => A.voice(`hatch/${best}`)), burst + 150);
    setTimeout(() => {
      stage.replaceChildren(el('div.idg-hatch-grid' + (n > 1 ? '.ten' : ''), null, r.results.map((x, i) => el(`div.idg-hatch-card.${x.rar}`, { style: `animation-delay:${i * 0.08}s` }, [
        el('img', { src: `${AI}${x.id}/head.png`, alt: '' }),
        el('b', UNITS[x.id].name), el('span', x.dup ? `+${x.plus}` : `${RAR_KO[x.rar]} · NEW`),
      ]))));
      btns.style.visibility = ''; drawInfo();
    }, burst);
  }
  drawInfo();
  stage.appendChild(el('div.idg-egg', null, [el('img', { src: `${AI}eggs/egg_rare.png`, alt: '', onerror: (e) => e.target.remove() })]));
  const box = el('div.dialog.idg-hatch.idg-xw', { onclick: (e) => e.stopPropagation() }, [xTitle('부화장', () => close()), info, stage, btns]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}
