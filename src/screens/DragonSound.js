/**
 * S23-b 사운드 설정.
 *
 * 배경음 · 효과음 · 배경음 곡 고르기. 조작키와 갈라 둔 이유는 단순하다 —
 * 소리를 끄러 들어온 사람에게 스틱 크기까지 스크롤해서 지나가게 할 일이 없다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title, segmented } from './ui.js';
import { loadDragon } from './DragonGame.js';

const ONOFF = [
  { value: 1, label: '켜짐' },
  { value: 0, label: '꺼짐' },
];

export default function DragonSound(nav) {
  let mod = null;
  let live = true;
  loadDragon().then((m) => { mod = m; if (live) nav.refresh(); }).catch(() => {});

  const set = (k, v) => { if (mod) { mod.setGameOption(k, v); nav.refresh(); } };

  return {
    onLeave() { live = false; },

    render() {
      if (!mod) return screen(title(S.dragonMenuSound), el('div.hint', S.loading));
      const o = mod.gameOptions();

      return screen(
        title(S.dragonMenuSound),

        el('div.opt-row', null, [
          el('div.opt-label', '배경음'),
          segmented(ONOFF, o.bgmOn, (v) => set('bgmOn', v)),
        ]),
        el('div.opt-row', null, [
          el('div.opt-label', '효과음'),
          segmented(ONOFF, o.sfxOn, (v) => set('sfxOn', v)),
        ]),

        /**
         * 곡은 세 개뿐이라 한 줄에 늘어놓는다. 목록이 길어지면 그때 다른 모양으로 바꾼다 —
         * 지금 미리 스크롤 목록을 만들어 둘 이유가 없다.
         */
        el('div.opt-row', null, [
          el('div.opt-label', '배경음 곡'),
          segmented(
            o.tracks.map((n, i) => ({ value: i, label: `${i + 1}. ${n}` })),
            o.bgm,
            (v) => set('bgm', v)
          ),
        ]),

        el('div.hint', S.dragonSoundHint),

        el('div.spacer'),
        backButton(S.backToSettings, () => nav.back())
      );
    },
  };
}
