/**
 * 줄넘기 챔피언 화면들이 같이 쓰는 모양(CSS) · 작은 부품. (2026-11-07)
 *
 * 공용 부품(`ui.js` 의 버튼 · 패널 · 순위 줄)을 그대로 쓰고, 줄넘기에만 있는 칸
 * (줄넘기 진열장 · 꾸미기 격자 · 스테이지 칸 · 박자 조각)만 여기서 더한다.
 * CSS 는 처음 부를 때 한 번만 <head> 에 넣는다.
 */

import { el, button, presentOverlay } from '../ui.js';
import { candyIcon } from '../../games/jumprope/art.js';
import * as J from '../../services/jumprope.js';

let on = false;
export function ensureJrStyle() {
  if (on || typeof document === 'undefined') return;
  on = true;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.append(st);
}

/**
 * 제목 그림 — 도트 로고(`tools/build-jumprope-banner.mjs` 가 오락실 배너와 같은 글자로 굽는다).
 * 드래곤 로비의 로고 그림과 같은 자리 · 같은 방식. `alt` 에 이름을 남긴다(그림이 안 떠도 무슨 게임인지 보이게).
 */
export function jrLogo() {
  return el('img.jr-logo-img', { src: '/assets/jumprope-logo.png', alt: '줄넘기 챔피언', width: 540, height: 174, decoding: 'async' });
}

/**
 * 게임 모드 설명 — 로비의 시작 단추를 **처음 누를 때** 한 번 뜨는 팝업. (2026-11-07)
 *
 * > 권반장: «챔피언십과 무한 줄넘기가 뭔지 모르겠어. 처음 눌렀을 때 팝업창처럼 간략하게 이해하기 쉽게 설명이 있으면 좋겠어.»
 *
 * 본 것은 `opts.guide` 비트로 저장한다(계정 · 기기 사이에 합쳐진다). 설정 · 하는 법에서 다시 볼 수 있다.
 */
export const MODE_GUIDE = {
  champ: {
    bit: 1, tag: '혼자', title: '챔피언십',
    lines: ['대회 5개를 차례로 깨요.', '곡 하나 1분 · 끝까지 버티면 클리어!', '별 ★1~3 · 별을 받으면 다음 대회가 열려요.'],
  },
  endless: {
    bit: 2, tag: '혼자', title: '무한 줄넘기',
    lines: ['끝나지 않는 곡 · 점점 빨라져요.', '체력이 다 떨어지면 끝.', '몇 개까지 넘나 기록 도전!'],
  },
  multi: {
    bit: 4, tag: '2~8명', title: '멀티 서바이벌',
    lines: ['같은 곡 · 같은 줄로 동시에 뛰어요.', '하트 3개 · 줄에 걸리면 하나씩 잃어요.', '마지막까지 남은 1명이 우승!'],
  },
};

/**
 * 모드 설명 팝업. 처음이면 띄우고 `true`(시작) / `false`(닫기)를, 이미 봤으면 바로 `true` 를 준다.
 * @param {'champ'|'endless'|'multi'} kind
 * @param {{force?:boolean}} [opt] force = 봤어도 띄운다(설정 화면의 «다시 보기»)
 * @returns {Promise<boolean>}
 */
export function modeGuide(kind, opt = {}) {
  const g = MODE_GUIDE[kind];
  const seen = (J.jr().opts.guide | 0) & g.bit;
  if (seen && !opt.force) return Promise.resolve(true);
  ensureJrStyle();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (settled) return; settled = true; resolve(v); };
    const pick = (v) => {
      if (!seen) J.setOpt('guide', (J.jr().opts.guide | 0) | g.bit);
      finish(v);
      dismiss();
    };
    const overlay = el('div.dialog-overlay', null, [
      el('div.dialog.jr-guide', null, [
        el('div.jr-guide-tag', g.tag),
        el('div.jr-guide-title', g.title),
        el('ul.jr-guide-list', null, g.lines.map((l) => el('li', l))),
        el('div.row', null, [
          button('닫기', () => pick(false), { sfx: 'sfx_menu_back' }),
          button(opt.force ? '확인' : '시작하기', () => pick(!opt.force), { primary: true }),
        ]),
      ]),
    ]);
    /* 뒤로가기 · 화면 바뀜으로 닫히면 «안 봤음» 그대로 — 다음에 다시 뜬다 */
    const dismiss = presentOverlay(overlay, () => finish(false));
  });
}

/** 별사탕 n — 지갑 한 줄 */
export function candyTag(n, label = '별사탕') {
  return el('div.jr-wallet', null, [candyIcon(2), el('span', `${label} ${Number(n || 0).toLocaleString('en-US')}`)]);
}

export function lvBar(L) {
  const pct = L.need ? Math.min(100, Math.round((L.into / L.need) * 100)) : 100;
  return el('div.jr-lvbar', null, [el('div.jr-lvbar-fill', { style: `width:${pct}%` })]);
}

const CSS = `
.rb-cal-pad { display: block; width: 100%; height: 120px; font-family: 'Galmuri11', 'Arial Black', sans-serif; font-weight: 900; font-size: 44px; color: #fff; text-shadow: 3px 3px 0 #1b0f0a; background: #ff7a1a; border: 0; cursor: pointer; box-shadow: 0 -3px 0 0 #600f09, 0 3px 0 0 #600f09, -3px 0 0 0 #600f09, 3px 0 0 0 #600f09, inset 0 4px 0 0 #ffd08a, inset 0 -5px 0 0 #8a2a00; }
.rb-cal-pad:active { transform: translateY(3px); background: #d9561a; }
.dialog.jr-guide { max-width: 320px; gap: 10px; text-align: left; }
.jr-guide-tag { align-self: center; padding: 2px 10px; font-size: 13px; color: #fff; background: #4a2380; }
.jr-guide-title { text-align: center; font-size: 26px; color: #c2410c; }
.jr-guide-list { margin: 0; padding: 0 0 0 18px; font-size: 16px; line-height: 1.6; letter-spacing: 0; word-break: keep-all; }
.jr-guide-list li { margin: 3px 0; }
/* 한국어는 낱말 중간에서 줄을 바꾸지 않는다(«차례/로» 같은 끊김 금지) · 설명 글자는 16px */
.jr-box, .jr-next, .jr-item-desc, .jr-stage-sub, .diff-title { word-break: keep-all; }
.jr-logo-img { display: block; width: min(100%, 360px); height: auto; margin: 4px auto 0; image-rendering: pixelated; }
.jr-logo { text-align: center; padding: 6px 0 2px; }
.jr-logo-main { font-size: 40px; line-height: 1.1; letter-spacing: 2px; filter: drop-shadow(3px 3px 0 #2a0f3a); }
.jr-logo.small .jr-logo-main { font-size: 26px; }
.jr-logo .l1 { background: linear-gradient(180deg, #fff6a8 0%, #ffd23f 45%, #ff8a1a 100%); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-stroke: 1.5px #5a1408; }
.jr-logo .l2 { background: linear-gradient(180deg, #c8f4ff 0%, #6fd3ff 45%, #b36bff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-stroke: 1.5px #23104a; }
.jr-logo-sub { font-size: 15px; color: #ff8fd1; letter-spacing: 6px; margin-top: 2px; text-shadow: 2px 2px 0 #2a0f3a; }
.char-cell.jr { width: 86px; }
.char-cell.jr canvas { display: block; }
.jr-wallet { display: flex; align-items: center; justify-content: center; gap: 6px; color: #ffd1ec; font-size: 15px; }
.jr-candy-ic { display: inline-block; vertical-align: -3px; }
.jr-next { text-align: center; font-size: 12px; color: #9be36f; }
.jr-lvbar { height: 6px; background: rgba(255,255,255,0.15); margin-top: 1px; }
.jr-lvbar-fill { height: 100%; background: linear-gradient(90deg, #7cf09a, #3fbf5a); }
.jr-tabs { display: flex; gap: 6px; }
.jr-seg5 .pbtn { font-size: 14px; padding-left: 2px; padding-right: 2px; white-space: nowrap; letter-spacing: 0; min-width: 0; }
.jr-mask { display: flex; align-items: center; gap: 10px; padding: 8px; background: rgba(245,217,160,0.08); border: 2px solid var(--c-line); color: var(--c-text-light); }
.jr-mask.have { border-color: #7cf09a; background: rgba(124,240,154,0.1); }
.jr-mask.rare { border-color: #ff9af0; background: linear-gradient(90deg, rgba(255,90,200,0.14), rgba(120,90,255,0.14)); }
.jr-mask-pic { flex: 0 0 auto; padding: 4px; background: #1d1430; border: 2px solid #2a1a10; }
.jr-mask-pic canvas { display: block; }
.jr-mask-body { flex: 1 1 auto; min-width: 0; word-break: keep-all; }
.jr-mask-name { font-size: 18px; color: #ffd23f; }
.jr-mask-need { font-size: 13px; color: #ff9af0; }
.jr-mask-desc { font-size: 13px; line-height: 1.45; color: var(--c-text-light); margin: 2px 0 4px; }
.jr-mask-left { font-size: 12px; color: #9be36f; margin-top: 2px; }
.jr-mask-lock { flex: 0 0 auto; font-size: 22px; }
.jr-mask .pbtn { width: auto; flex: 0 0 auto; font-size: 14px; padding: 8px 10px; }
.jr-songs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.jr-song { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 7px 8px; text-align: left; font-family: inherit; color: var(--c-text-light); background: rgba(245,217,160,0.08); border: 2px solid var(--c-line); cursor: pointer; word-break: keep-all; }
.jr-song b { font-weight: normal; font-size: 14px; color: #ffd23f; }
.jr-song small { font-size: 11px; line-height: 1.35; color: var(--c-panel-dark); }
.jr-song.on { border-color: #ffd23f; background: rgba(255,210,63,0.18); }
.jr-tabs .pbtn { font-size: 14px; padding: 8px 2px; white-space: nowrap; letter-spacing: 0; min-width: 0; }
.jr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 7px; }
.jr-card { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 7px 4px 6px; background: rgba(245,217,160,0.1); border: 2px solid var(--c-line); color: var(--c-text-light); font-family: inherit; cursor: pointer; }
.jr-card:active { transform: translateY(1px); }
.jr-card.on { border-color: #ffd23f; background: rgba(255,210,63,0.18); }
.jr-card.locked canvas { filter: grayscale(1) brightness(0.55); }
.jr-card-name { font-size: 12px; text-align: center; line-height: 1.25; min-height: 30px; display: flex; align-items: center; }
.jr-card-how { font-size: 10px; color: var(--c-panel-dark); text-align: center; line-height: 1.2; }
.jr-card-tag { position: absolute; top: 3px; right: 3px; font-size: 9px; padding: 1px 3px; background: #ffd23f; color: #2a1a10; }
.jr-card-tag.use { background: #7cf09a; }
.jr-preview { display: flex; justify-content: center; padding: 4px 0; }
.jr-preview canvas { display: block; }
.jr-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.jr-chip { min-width: 62px; flex: 1 1 62px; padding: 7px 4px; font-family: inherit; font-size: 12px; color: var(--c-text-light); background: rgba(245,217,160,0.1); border: 2px solid var(--c-line); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.jr-chip.on { border-color: #ffd23f; background: rgba(255,210,63,0.2); }
.jr-chip.locked { opacity: 0.55; }
.jr-chip small { font-size: 9px; color: var(--c-panel-dark); }
.jr-sw { width: 22px; height: 22px; border: 2px solid #2a1a10; }
.jr-stage { display: flex; align-items: center; gap: 8px; padding: 6px; background: rgba(245,217,160,0.08); border: 2px solid var(--c-line); color: var(--c-text-light); font-family: inherit; text-align: left; cursor: pointer; width: 100%; }
.jr-stage.locked { opacity: 0.5; }
.jr-stage canvas { flex: 0 0 auto; display: block; border: 2px solid #2a1a10; }
.jr-stage-body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.jr-stage-name { font-size: 15px; }
.jr-stage-sub { font-size: 11px; color: var(--c-panel-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jr-stars { font-size: 16px; letter-spacing: 1px; color: rgba(255,255,255,0.2); white-space: nowrap; }
.jr-stars b { color: #ffd23f; font-weight: normal; }
.jr-list { display: flex; flex-direction: column; gap: 6px; }
.jr-box { padding: 10px 12px; background: rgba(245,217,160,0.08); border: 2px solid var(--c-line); color: var(--c-text-light); font-size: 16px; line-height: 1.6; letter-spacing: 0; }
.jr-box h4 { margin: 0 0 6px; font-size: 17px; color: #ffd23f; font-weight: normal; }
.jr-item { display: flex; align-items: center; gap: 8px; padding: 6px; background: rgba(245,217,160,0.08); border: 2px solid var(--c-line); color: var(--c-text-light); }
.jr-item canvas { flex: 0 0 auto; }
.jr-item-body { flex: 1 1 auto; min-width: 0; }
.jr-item-name { font-size: 14px; }
.jr-item-desc { font-size: 11px; color: var(--c-panel-dark); }
.jr-item .pbtn { width: auto; flex: 0 0 auto; font-size: 13px; padding: 7px 9px; }
.jr-item.on { border-color: #7cf09a; background: rgba(124,240,154,0.12); }
.jr-seg-row { width: 100%; text-align: left; font-family: inherit; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 5px 6px; background: rgba(245,217,160,0.08); border: 2px solid var(--c-line); color: var(--c-text-light); font-size: 12px; }
.jr-seg-row .jr-seg-k { flex: 0 0 auto; padding: 2px 5px; background: #4a2380; color: #fff; font-size: 11px; }
.jr-seg-row .jr-seg-v { flex: 1 1 auto; min-width: 0; }
.jr-mini { width: 30px !important; min-width: 30px; flex: 0 0 30px !important; padding: 5px 0 !important; font-size: 13px !important; }
.jr-field { display: flex; align-items: center; gap: 8px; color: var(--c-text-light); font-size: 13px; }
.jr-field > span:first-child { flex: 0 0 72px; color: var(--c-panel-dark); }
.jr-field input, .jr-field select, .jr-code { flex: 1 1 auto; min-width: 0; font-family: inherit; font-size: 14px; padding: 6px; background: #1d1430; color: #fff4d6; border: 2px solid var(--c-line); }
.jr-code { width: 100%; box-sizing: border-box; font-size: 11px; word-break: break-all; min-height: 56px; resize: vertical; }
.jr-step { display: flex; align-items: center; gap: 4px; }
.jr-step .pbtn { width: 34px; padding: 5px 0; font-size: 15px; }
.jr-step b { min-width: 34px; text-align: center; font-weight: normal; }
.cbr-face canvas, .jr-rope-ic canvas { display: block; }
.jr-rope-ic { flex: 0 0 22px; width: 22px; height: 22px; }
.screen canvas { image-rendering: pixelated; }
`;
