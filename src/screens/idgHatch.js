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

const AI = '/assets/iandragon_game/ai/';
/* 게임 소리(겜팀장) — 부화장에서만 늦게 받는다 */
const snd = (fn) => { if (getSettings().sfxEnabled === false) return; import('../games/iandragon_game/audio/index.js').then((A) => { A.init(); fn(A); }).catch(() => {}); };
const REVEAL = { rare: 'hatch_reveal_rare', super: 'hatch_reveal_super', legend: 'hatch_reveal_legend' };

export function showHatch(onChange) {
  Sfx.play('sfx_menu_select');
  const info = el('div.idg-hatch-info'), stage = el('div.idg-hatch-stage'), btns = el('div.idg-row');
  function drawInfo() {
    const g = G.idg();
    info.replaceChildren(
      el('div', `젬 ${g.gems.toLocaleString('en-US')}`),
      el('div.small', `희귀 ${RATES.rare * 100}% · 슈퍼 ${RATES.super * 100}% · 전설 ${RATES.legend * 100}% · 전설까지 ${PITY - (g.pity || 0)}번 남음`),
    );
    btns.replaceChildren(
      el('button.idg-btn.main', { type: 'button', disabled: g.gems < EGG.one, onclick: () => go(1) }, [`알 1개 · 젬 ${EGG.one}`]),
      el('button.idg-btn.main', { type: 'button', disabled: g.gems < EGG.ten, onclick: () => go(10) }, [`알 10개 · 젬 ${EGG.ten}`]),
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
  const box = el('div.dialog.idg-hatch', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', '부화장'), info, stage, btns, button('닫기', () => close())]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}
