/**
 * 줄넘기 챔피언 — 설정 · 하는 법.
 *   소리 · 진동 · 도우미 링(자동 / 늘 켜기 / 늘 끄기) + 처음 하는 사람을 위한 설명.
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
        box('하는 법 — 두 버튼 리듬', [
          '음악이 나오고 위에서 «줄»이 떨어져요. 판정선(발 높이)에 닿을 때 눌러요.',
          '왼쪽 ROPE(A · ←) = 줄을 머리 위로 넘기기 · 오른쪽 JUMP(D · → · 스페이스) = 발밑 줄 뛰어넘기.',
          '기본 리듬: 박(쿵) = JUMP, 엇박(짝) = ROPE. 둘이 번갈아 북을 치듯!',
          '금색 X 줄 = 둘 다 같이(엇걸어 뛰기) · 꼬리 달린 줄 = JUMP 를 꾹(이단 · 삼단 뛰기).',
        ]),
        box('판정 · 점수', [
          'PERFECT 100 · GREAT 70 · GOOD 40 — 콤보가 쌓이면 ×1.2 · ×1.5 · ×2 · ×3.',
          '콤보 = 완벽히 돈 횟수(PERFECT). GREAT · GOOD 은 콤보를 지키고, MISS 면 0.',
          'JUMP 를 놓치면 줄에 걸려 넘어지고 체력이 크게 줄어요. 체력이 0 이면 탈락!',
          '50콤보부터 FEVER — 무대가 번쩍이고 점수가 크게 올라요.',
        ]),
        box('빨라지고 느려지고', [
          '곡마다 템포가 바뀌어요. «▲ SPEED UP!» «▼ SLOW DOWN…» 띠가 한 마디 먼저 알려 줘요.',
          '빨라지면 줄도 빨리 떨어져요 — 귀로 박을 잡으면 쉬워요(킥 = JUMP, 짝 = ROPE).',
        ]),
        box('난이도', [
          '쉬움 — 판정이 넉넉하고 ROPE 가 적어요(줄이 저절로 도는 박이 많아요).',
          '보통 — ROPE · JUMP 번갈이 + 대회 기술.',
          '어려움 — 16분 연타 · 이단 · 삼단 · 크로스 · 턴 전부. 판정이 빡빡해요. 보상 두 배!',
        ]),
        el('div.spacer'),
        backButton('게임 로비로', () => nav.back()),
      );
    },
  };
}
