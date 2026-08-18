/**
 * S08b 설정 — 예전엔 로비 메뉴가 곧바로 [조작법 변경] 화면이었다. (2026-08-19)
 *
 * 여기 하나로 모으고 안에 [조작법 변경] 과 [음향 설정](BGM·SFX 개별 on/off)을 둔다.
 * 소리 on/off 인프라(audio/audio.js `getSettings/setEnabled`)는 이미 있었는데
 * **꺼내 쓰는 화면이 없었다** — 저장·복원·게인 반영은 전부 되는데 버튼이 없던 상태.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, segmented, screen, title } from './ui.js';
import * as Audio from '../audio/audio.js';
import Controls from './Controls.js';

const ON_OFF = [
  { value: true, label: S.settingsOn },
  { value: false, label: S.settingsOff },
];

export default function Settings(nav) {
  return {
    render() {
      const s = Audio.getSettings();
      return screen(
        title(S.settingsTitle),

        button(S.menuControls, () => nav.push(Controls)),

        el('div.settings-section', null, [
          el('div.settings-label', S.menuSound),
          el('div.settings-row', null, [
            el('span.settings-row-label', S.soundBgm),
            segmented(ON_OFF, s.bgmEnabled, (v) => { Audio.setEnabled('bgm', v); nav.refresh(); }),
          ]),
          el('div.settings-row', null, [
            el('span.settings-row-label', S.soundSfx),
            segmented(ON_OFF, s.sfxEnabled, (v) => { Audio.setEnabled('sfx', v); nav.refresh(); }),
          ]),
        ]),

        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
