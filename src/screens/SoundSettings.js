/**
 * S08c 사운드 설정 — BGM · SFX 개별 on/off. (2026-08-19)
 *
 * 예전에는 이 토글이 [설정] 화면에 바로 박혀 있었는데, 사용자 요청으로
 * **[조작법 변경] 과 같은 층의 메뉴 항목**으로 끌어올렸다. 설정 화면은 이제
 * "메뉴 목록"이고 실제 조작은 각 하위 화면에서 한다 — 항목이 늘어도 구조가 안 무너진다.
 *
 * 켜고 끄는 값 자체는 `audio/audio.js` 가 localStorage 에 저장한다. 여기서는
 * 읽고 쓰기만 한다 — 저장 위치가 둘이 되면 반드시 어긋난다.
 */

import S from '../config/strings.ko.js';
import { el, backButton, segmented, screen, title } from './ui.js';
import * as Audio from '../audio/audio.js';

const ON_OFF = [
  { value: true, label: S.settingsOn },
  { value: false, label: S.settingsOff },
];

export default function SoundSettings(nav) {
  return {
    render() {
      const s = Audio.getSettings();
      return screen(
        title(S.menuSound),

        el('div.settings-section', null, [
          el('div.settings-row', null, [
            el('span.settings-row-label', S.soundBgm),
            segmented(ON_OFF, s.bgmEnabled, (v) => { Audio.setEnabled('bgm', v); nav.refresh(); }),
          ]),
          el('div.settings-row', null, [
            el('span.settings-row-label', S.soundSfx),
            segmented(ON_OFF, s.sfxEnabled, (v) => { Audio.setEnabled('sfx', v); nav.refresh(); }),
          ]),
        ]),

        el('div.hint', S.soundHint),

        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
