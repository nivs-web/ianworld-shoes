/**
 * 점프 피아노 화면들이 같이 쓰는 작은 부품. (2026-11-07)
 *
 * 줄넘기 챔피언의 `jumprope/jrui.js` 를 복사해 이름만 바꿨다. 모양(CSS)은 챔피언 것을 그대로 쓴다
 * (`ensureJrStyle` — 같은 칸 이름 `jr-*`). 저장은 피아노 창구(`services/jumppiano.js`)로만 간다.
 */

import { el, button, presentOverlay } from '../ui.js';
import * as J from '../../services/jumppiano.js';
import { ropeHow } from '../../games/jumprope/data.js';
import { ensureJrStyle, candyTag, lvBar } from '../jumprope/jrui.js';

export { candyTag, lvBar };
export const ensureJpStyle = ensureJrStyle;

/** 제목 그림 — 오락실 배너와 같은 점프 피아노 도트 로고 */
export function jpLogo() {
  return el('img.jr-logo-img', { src: '/assets/jumppiano-logo.png', alt: '점프 피아노', width: 540, height: 153, decoding: 'async' });
}

/** 줄넘기 얻는 법 — 챔피언 문구에서 모드 이름만 피아노로 */
export const jpRopeHow = (r) => ropeHow(r).replace('무한 줄넘기 100개 넘기', '무한 피아노 100개 치기');

/**
 * 게임 모드 설명 — 로비의 시작 단추를 **처음 누를 때** 한 번 뜨는 팝업.
 * 본 것은 피아노 `opts.guide` 비트로 저장한다(챔피언과 따로). 설정 · 하는 법에서 다시 볼 수 있다.
 * (멀티는 다음 주 개발 — 아직 없다)
 */
export const MODE_GUIDE = {
  champ: {
    bit: 1, tag: '혼자', title: '챔피언십',
    lines: ['대회 5개를 차례로 깨요.', '곡 하나 1분 · 끝까지 버티면 클리어!', '별 ★1~3 · 별을 받으면 다음 대회가 열려요.'],
  },
  endless: {
    bit: 2, tag: '혼자', title: '무한 피아노',
    lines: ['끝나지 않는 곡 · 점점 빨라져요.', '체력이 다 떨어지면 끝.', '타일 몇 개까지 치나 기록 도전!'],
  },
};

/**
 * 모드 설명 팝업. 처음이면 띄우고 `true`(시작) / `false`(닫기)를, 이미 봤으면 바로 `true` 를 준다.
 * @param {'champ'|'endless'} kind
 * @param {{force?:boolean}} [opt] force = 봤어도 띄운다(설정 화면의 «다시 보기»)
 * @returns {Promise<boolean>}
 */
export function modeGuide(kind, opt = {}) {
  const g = MODE_GUIDE[kind];
  const seen = (J.jp().opts.guide | 0) & g.bit;
  if (seen && !opt.force) return Promise.resolve(true);
  ensureJrStyle();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (settled) return; settled = true; resolve(v); };
    const pick = (v) => {
      if (!seen) J.setOpt('guide', (J.jp().opts.guide | 0) | g.bit);
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
