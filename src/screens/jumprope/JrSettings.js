/**
 * 줄넘기 챔피언 — 설정 · 하는 법.
 *   소리 · 진동 · 도우미 링(자동 / 늘 켜기 / 늘 끄기) + 처음 하는 사람을 위한 설명.
 */

import { el, backButton, screen, title, segmented } from '../ui.js';
import * as J from '../../services/jumprope.js';
import { ensureJrStyle } from './jrui.js';
import { figureCanvas } from '../../games/jumprope/art.js';

const ONOFF = [{ value: 'on', label: '켜기' }, { value: 'off', label: '끄기' }];
const RING = [{ value: 'auto', label: '자동' }, { value: 'on', label: '늘 켜기' }, { value: 'off', label: '늘 끄기' }];

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
        el('div.jr-field', null, [el('span', '도우미 링'), segmented(RING, o.ring, (v) => { J.setOpt('ring', v); nav.refresh(); })]),
        el('div.hint', '도우미 링: 발밑에서 링이 줄어들어 점선과 딱 맞을 때 누르면 PERFECT! (자동 = 스테이지·난이도에 따라)'),
        el('div.jr-preview', null, [figureCanvas(J.look(j), J.rope(j), 2, { w: 44, h: 68, theta: 2 * Math.PI })]),
        box('하는 법', [
          '줄이 발밑으로 올 때 «점프» 단추(또는 화면 · 스페이스)를 눌러요.',
          '너무 일찍 뛰면 이미 내려와서, 너무 늦게 뛰면 덜 떠서 줄에 걸려 넘어져요.',
          '가장 높이 떴을 때 줄이 지나가면 PERFECT · 조금 어긋나면 GREAT · GOOD.',
          '콤보 10번마다 점수가 10%씩 늘어요(최대 두 배).',
        ]),
        box('박자 장난', [
          '같은 박자 — 처음엔 똑같은 박자로 몸을 풀어요.',
          '랜덤 박자 — 한 바퀴마다 빠르기가 바뀌어요. 줄을 끝까지 보세요!',
          '빨라지기 · 느려지기 — 점점 빨라지거나 느려져요.',
          '멈칫 — 줄이 머리 위에서 잠깐 멈췄다 내려와요. 기다렸다 뛰어요.',
          '2단 뛰기 — 단추를 꾹 누르면 높이 뛰어요. 한 번 뛸 때 줄이 두 번 지나가요.',
          '박자가 바뀌기 한 바퀴 전에 글자로 미리 알려 줘요.',
        ]),
        box('별 · 레벨 · 별사탕', [
          '★ 클리어 · ★★ 하트를 1개 이하로 잃기 · ★★★ 하나도 안 잃고 PERFECT 절반 이상.',
          '경험치가 쌓이면 레벨이 올라 줄넘기 · 옷 · 모자를 얻어요(레벨 20까지).',
          '별사탕으로 상점에서 아이템 · 줄넘기 · 옷을 사요. 어려운 난이도일수록 많이 받아요.',
        ]),
        box('난이도', [
          '쉬움 — 판정이 넉넉하고 줄이 조금 느려요. 하트 +1, 도우미 링 켜짐.',
          '보통 — 스테이지 그대로.',
          '어려움 — 판정이 빡빡하고 줄이 조금 빨라요. 하트 −1, 도우미 링 꺼짐. 보상 두 배!',
        ]),
        el('div.spacer'),
        backButton('게임 로비로', () => nav.back()),
      );
    },
  };
}
