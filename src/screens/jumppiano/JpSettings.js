/**
 * 점프 피아노 — 설정 · 하는 법.
 * 줄넘기 챔피언 `JrSettings.js` 를 복사해 이름만 바꿨다 — 설정은 피아노 것(`jp.opts`)이다.
 *   소리 · 진동 · 타이밍 맞추기 + 짧은 설명(2026-11-07 권반장 «간단하게 · 글씨 크게»).
 */

import { el, backButton, screen, title, segmented } from '../ui.js';
import * as J from '../../services/jumppiano.js';
import { ensureJpStyle } from './jpui.js';
import { figureCanvas } from '../../games/jumprope/art.js';
import { button } from '../ui.js';
import { lazyScreen } from '../lazyScreen.js';

const JpCalibrate = lazyScreen(() => import('./JpCalibrate.js'), '타이밍 맞추기');

const ONOFF = [{ value: 'on', label: '켜기' }, { value: 'off', label: '끄기' }];

export default function JpSettings(nav) {
  ensureJpStyle();
  return {
    render() {
      const j = J.jp();
      const o = j.opts;
      const box = (h, lines) => el('div.jr-box', null, [el('h4', h), ...lines.map((l) => el('div', l))]);
      return screen(
        title('설정 · 하는 법'),
        el('div.jr-field', null, [el('span', '소리'), segmented(ONOFF, o.sound ? 'on' : 'off', (v) => { J.setOpt('sound', v === 'on'); nav.refresh(); })]),
        el('div.jr-field', null, [el('span', '진동'), segmented(ONOFF, o.vib ? 'on' : 'off', (v) => { J.setOpt('vib', v === 'on'); nav.refresh(); })]),
        button(`타이밍 맞추기 (지금 ${(o.offset | 0) > 0 ? '+' : ''}${o.offset | 0}ms)`, () => nav.push(JpCalibrate)),
        el('div.jr-preview', null, [figureCanvas(J.look(j), J.rope(j), 2, { w: 44, h: 68, theta: 2 * Math.PI })]),
        box('하는 법', [
          '떨어지는 타일이 판정선에 닿을 때 두드려 점프!',
          '긴 타일은 꾹 · 슬라이더 타일은 밀면서 따라가요.',
          '한 손 (3칸) — 오른쪽 3칸만 써요.',
          '두 손 (6칸) — 왼쪽 3칸 · 오른쪽 3칸 모두 써요.',
        ]),
        box('게임 모드', [
          '챔피언십 — 대회 5개를 차례로 깨요.',
          '무한 피아노 — 끝없는 곡, 기록 도전.',
        ]),
        box('점수', [
          'PERFECT 가 이어지면 콤보 · 50콤보부터 FEVER!',
          '타일을 놓치면 체력이 줄고, 0 이면 끝.',
          '어려울수록 · 두 손(6칸)일수록 보상이 커요.',
        ]),
        el('div.spacer'),
        backButton('게임 로비로', () => nav.back()),
      );
    },
  };
}
