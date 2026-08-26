/**
 * S23-a 조작키 설정.
 *
 * ★ **가로로 안 돌려도 손볼 수 있어야 한다.** (2026-08-26, 사용자 지정)
 * 예전에는 게임 안 캔버스 화면뿐이라 스틱 크기 하나 바꾸려고 폰을 눕혀야 했다.
 * 값은 여전히 게임이 들고 있고(`gameOptions` / `setGameOption`), 여기서는 그 창구로만 만진다.
 *
 * 스틱·버튼이 실제로 어떻게 보이는지는 도트로만 그릴 수 있어서, 눈으로 보고 싶은
 * 사람을 위해 맨 아래에 가로 미리보기로 가는 문을 하나 남겨 둔다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title, segmented, toast } from './ui.js';
import DragonGame, { loadDragon } from './DragonGame.js';

const SIZE = [
  { value: 0, label: '작게' },
  { value: 1, label: '보통' },
  { value: 2, label: '크게' },
];
const ONOFF = [
  { value: 1, label: '켜짐' },
  { value: 0, label: '꺼짐' },
];
const STICK_MODE = [
  { value: 0, label: '왼쪽 아래 고정' },
  { value: 1, label: '누른 자리에' },
];

export default function DragonKeys(nav) {
  let mod = null;
  let live = true;
  loadDragon().then((m) => { mod = m; if (live) nav.refresh(); }).catch(() => {});

  const set = (k, v) => { if (mod) { mod.setGameOption(k, v); nav.refresh(); } };

  return {
    onLeave() { live = false; },

    render() {
      if (!mod) return screen(title(S.dragonMenuControls), el('div.hint', S.loading));
      const o = mod.gameOptions();

      const row = (label, opts, value, key, note) => el('div.opt-row', null, [
        el('div.opt-label', label),
        segmented(opts, value, (v) => set(key, v)),
        note ? el('div.hint', note) : null,
      ].filter(Boolean));

      return screen(
        title(S.dragonMenuControls),

        el('div.hint', S.dragonKeysHint),

        row('스틱 크기', SIZE, o.stickSize, 'stickSize'),
        row('스틱 방식', STICK_MODE, o.stickFloat, 'stickFloat'),
        row('버튼 크기', SIZE, o.btnSize, 'btnSize'),
        row('조작 투명도',
          [0.3, 0.5, 0.7].map((v) => ({ value: v, label: `${Math.round(v * 100)}%` })),
          [0.3, 0.5, 0.7].reduce((a, b) => (Math.abs(b - o.btnAlpha) < Math.abs(a - o.btnAlpha) ? b : a)),
          'btnAlpha'),

        /**
         * ★ **패드 하나로 두 명이 노는 설정.** (2026-08-26, 사용자 지정)
         * 오른쪽 스틱이 1P, 왼쪽 스틱이 2P 다. 무기는 같은 쪽 어깨 버튼으로 몬다 —
         * 얼굴 버튼(A/B)을 쓰면 엄지가 스틱에서 떨어져 그 순간 캐릭터가 멈춘다.
         */
        row('패드 스틱 나눠쓰기', ONOFF, o.splitPad, 'splitPad', S.dragonSplitPadHint),

        el('div.spacer'),
        button(S.dragonKeysPreview, () => {
          toast(S.dragonKeysPreviewHint, 2400);
          nav.push(DragonGame, { mode: 'options' });
        }),
        backButton(S.backToSettings, () => nav.back())
      );
    },
  };
}
