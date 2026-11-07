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
    bit: 1, tag: '혼자 하기', title: '챔피언십',
    lead: '동네 예선부터 세계 선수권까지, 대회 5개를 차례로 깨는 «이야기 모드»예요.',
    lines: [
      '동네 예선 → 지역 대회 → 전국 대회 → 아시아 대회 → 세계 선수권',
      '대회마다 정해진 곡이 1분쯤 나와요. 곡 끝까지 버티면 클리어!',
      '잘할수록 별 ★1~3개. 별을 하나라도 받으면 다음 대회가 열려요.',
      '난이도(쉬움 · 보통 · 어려움)마다 별을 따로 모아요 — 난이도마다 15개.',
    ],
    go: '대회 고르기',
  },
  endless: {
    bit: 2, tag: '혼자 하기', title: '무한 줄넘기',
    lead: '끝이 없는 곡에 맞춰 «몇 개까지 넘나» 기록에 도전하는 모드예요.',
    lines: [
      '곡이 끝나지 않아요. 8마디마다 조금씩 빨라져요 (BPM 100 → 200).',
      '줄에 걸리면 체력이 줄고, 체력이 0 이 되면 그 판이 끝나요.',
      '한 판에 넘은 개수가 내 최고 기록 — 명예의 전당에 올라가요.',
    ],
    go: '바로 시작',
  },
  multi: {
    bit: 4, tag: '여럿이 하기 · 2~8명', title: '멀티 서바이벌',
    lead: '친구들과 같은 곡 · 같은 줄로 동시에 뛰어, 마지막까지 살아남는 사람이 이기는 모드예요.',
    lines: [
      '2명부터 최대 8명까지 한 방에서 같이 뛰어요.',
      '하트 3개 — 줄에 걸릴 때마다 하나씩 잃고, 다 잃으면 탈락 → 남은 사람 구경.',
      '8마디(라운드)마다 빨라져요. 마지막 1명이 우승!',
      '빠른 입장 = 아무나와 · 비밀방 = 방 번호를 친구에게 알려 주고 같이.',
    ],
    go: '방 찾기',
  },
};

/** 모든 모드에 같이 붙는 조작 안내 한 줄 */
const CTRL_LINE = '처음엔 JUMP 버튼 하나만! 레벨 20이 되면 ROPE+JUMP 두 버튼 «하드 모드»가 열려요.';

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
        el('div.jr-guide-lead', g.lead),
        el('ul.jr-guide-list', null, g.lines.map((l) => el('li', l))),
        el('div.jr-guide-ctrl', CTRL_LINE),
        el('div.row', null, [
          button('닫기', () => pick(false), { sfx: 'sfx_menu_back' }),
          button(opt.force ? '알겠어요' : g.go, () => pick(!opt.force), { primary: true }),
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
.rb-cal-pad { display: block; width: 100%; height: 120px; font-family: 'PretendardV', 'Arial Black', sans-serif; font-weight: 900; font-size: 44px; color: #fff; text-shadow: 3px 3px 0 #1b0f0a; background: #ff7a1a; border: 0; cursor: pointer; box-shadow: 0 -3px 0 0 #600f09, 0 3px 0 0 #600f09, -3px 0 0 0 #600f09, 3px 0 0 0 #600f09, inset 0 4px 0 0 #ffd08a, inset 0 -5px 0 0 #8a2a00; }
.rb-cal-pad:active { transform: translateY(3px); background: #d9561a; }
.dialog.jr-guide { max-width: 340px; gap: 8px; text-align: left; }
.jr-guide-tag { align-self: center; padding: 2px 8px; font-size: 11px; color: #fff; background: #4a2380; }
.jr-guide-title { text-align: center; font-size: 22px; color: #c2410c; text-shadow: 2px 2px 0 rgba(0,0,0,0.12); }
.jr-guide-lead { font-size: 13px; line-height: 1.5; text-align: center; }
.jr-guide-list { margin: 0; padding: 0 0 0 16px; font-size: 12px; line-height: 1.55; }
.jr-guide-list li { margin: 2px 0; }
.jr-guide-ctrl { font-size: 11px; line-height: 1.45; padding: 6px; background: rgba(74,35,128,0.12); border: 2px dashed rgba(74,35,128,0.45); }
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
.jr-tabs .pbtn { font-size: 14px; padding: 8px 4px; }
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
.jr-box { padding: 8px; background: rgba(245,217,160,0.08); border: 2px solid var(--c-line); color: var(--c-text-light); font-size: 13px; line-height: 1.5; }
.jr-box h4 { margin: 0 0 4px; font-size: 14px; color: #ffd23f; font-weight: normal; }
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
