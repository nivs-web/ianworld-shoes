/**
 * 줄넘기 챔피언 — 설정 · 하는 법.
 *   소리 · 진동 · 도우미 링(자동 / 늘 켜기 / 늘 끄기) + 처음 하는 사람을 위한 설명.
 */

import { el, backButton, screen, title, segmented } from '../ui.js';
import * as J from '../../services/jumprope.js';
import { ensureJrStyle, modeGuide, MODE_GUIDE } from './jrui.js';
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
        box('게임 모드 — 무엇이 다른가요?', [
          '챔피언십(혼자) — 대회 5개를 차례로 깨며 별을 모아요. 곡마다 1분쯤.',
          '무한 줄넘기(혼자) — 끝없는 곡, 점점 빨라져요. 몇 개까지 넘나 기록 도전.',
          '멀티 서바이벌(2~8명) — 같이 뛰어 마지막까지 살아남는 사람이 우승.',
        ]),
        el('div.row', null, Object.entries(MODE_GUIDE).map(([k, g]) => button(g.title, () => modeGuide(k, { force: true })))),
        box('하는 법 — JUMP 하나', [
          '음악이 나오고 위에서 «줄»이 떨어져요. 아래 동그란 원에 쏙 들어올 때 JUMP!',
          '줄이 가까워지면 원 둘레에 반투명 고리가 줄어들고 안쪽이 차올라요 — 고리가 원과 딱 겹칠 때 누르면 PERFECT.',
          'JUMP = 오른쪽 버튼(D · → · 스페이스). 줄은 저절로 돌아요.',
          `레벨 ${J.HARD_LV}이 되면 ROPE+JUMP 두 버튼 «하드 모드»가 열려요(로비의 «조작»에서 골라요 · 별사탕 1.5배).`,
        ]),
        box('하드 모드 — ROPE+JUMP 두 버튼', [
          '왼쪽 ROPE(A · ←) = 줄을 머리 위로 넘기기 · 오른쪽 JUMP = 발밑 줄 뛰어넘기.',
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
          '빨라지면 줄도 빨리 떨어져요 — 귀로 박(쿵)을 잡으면 쉬워요.',
        ]),
        box('난이도', [
          '쉬움 — 판정이 넉넉하고 줄이 드문드문(1초에 한 번쯤).',
          '보통 — 박마다 뛰고 가끔 반 박 빠르게.',
          '어려움 — 16분 연타 · 이단 · 삼단 · 크로스 · 턴 전부. 판정이 빡빡해요. 보상 두 배!',
        ]),
        el('div.spacer'),
        backButton('게임 로비로', () => nav.back()),
      );
    },
  };
}
