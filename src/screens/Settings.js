/**
 * S08b 설정 — **메뉴 목록만** 둔다. 실제 조작은 각 하위 화면이 한다. (2026-08-19)
 *
 * 처음에는 음향 토글을 이 화면에 바로 박았는데, 사용자 요청으로 [조작법 변경] 과
 * 같은 층의 항목([사운드 설정])으로 끌어올렸다. 항목이 늘어도(배경설정이 그 예다)
 * 이 화면은 버튼 목록 그대로라 구조가 안 무너진다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title } from './ui.js';
import Controls from './Controls.js';
import SoundSettings from './SoundSettings.js';
import BgSettings from './BgSettings.js';

export default function Settings(nav) {
  return {
    render() {
      return screen(
        title(S.settingsTitle),

        button(S.menuControls, () => nav.push(Controls)),
        button(S.menuSound, () => nav.push(SoundSettings)),
        button(S.menuSingleBg, () => nav.push(BgSettings)),

        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
