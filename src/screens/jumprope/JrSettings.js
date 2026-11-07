/**
 * 줄넘기 챔피언 — 설정 · 하는 법.
 *   소리 · 진동 · 타이밍 맞추기 + 짧은 설명(2026-11-07 권반장 «간단하게 · 글씨 크게»).
 */

import { el, backButton, screen, title, segmented } from '../ui.js';
import * as J from '../../services/jumprope.js';
import { ensureJrStyle } from './jrui.js';
import { figureCanvas } from '../../games/jumprope/art.js';
import { button } from '../ui.js';
import { lazyScreen } from '../lazyScreen.js';

const JrCalibrate = lazyScreen(() => import('./JrCalibrate.js'), '타이밍 맞추기');

const ONOFF = [{ value: 'on', label: '켜기' }, { value: 'off', label: '끄기' }];

export default function JrSettings(nav) {
  ensureJrStyle();
  return {
    render() {
      const j = J.jr();
      const o = j.opts;
      const box = (h, lines) => el('div.jr-box', null, [el('h4', h), ...lines.map((l) => el('div', l))]);
      return screen(
        title('설정 · 하는 법'),
        el('div.jr-field', null, [el('span', '소리'), segmented(ONOFF, o.sound ? 'on' : 'off', (v) => { J.setOpt('sound', v === 'on'); nav.refresh(); })]),
        el('div.jr-field', null, [el('span', '진동'), segmented(ONOFF, o.vib ? 'on' : 'off', (v) => { J.setOpt('vib', v === 'on'); nav.refresh(); })]),
        button(`타이밍 맞추기 (지금 ${(o.offset | 0) > 0 ? '+' : ''}${o.offset | 0}ms)`, () => nav.push(JrCalibrate)),
        el('div.jr-preview', null, [figureCanvas(J.look(j), J.rope(j), 2, { w: 44, h: 68, theta: 2 * Math.PI })]),
        box('하는 법', [
          '타일이 판정선에 닿을 때 해요 — 화면 어디든.',
          '● 짧게 탭 · Ⅱ 꾹 누르기(이중 뛰기) · ← → 밀기(스키어).',
          '타일 옆 이름이 그 동작이에요(스키어 · 복서 스텝 …).',
          '두 손 — 왼쪽 ROPE · 오른쪽 JUMP(동그라미가 점선에 겹칠 때).',
        ]),
        box('게임 모드', [
          '챔피언십 — 대회 5개를 차례로 깨요.',
          '무한 줄넘기 — 끝없는 곡, 기록 도전.',
          '멀티 서바이벌 — 2~8명, 마지막 1명 우승.',
        ]),
        box('점수', [
          'PERFECT 가 이어지면 콤보 · 50콤보부터 FEVER!',
          '줄에 걸리면 체력이 줄고, 0 이면 끝.',
          '어려울수록 · 로프+점프일수록 보상이 커요.',
        ]),
        el('div.spacer'),
        backButton('게임 로비로', () => nav.back()),
      );
    },
  };
}
