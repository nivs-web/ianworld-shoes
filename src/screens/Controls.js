/**
 * S08 조작법 변경 — 3모드. (기획서 §4-2)
 * 세 모드 모두 1탭 = 1칸 상승이고, 어떤 버튼이 무엇을 하느냐만 다르다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title } from './ui.js';
import { get as getProfile, setControlMode } from '../services/profile.js';

/** 모드별 좌·우 버튼 아이콘 — 인게임과 같은 스프라이트를 쓴다 */
const MODES = [
  { value: 1, label: S.controlMode1, icons: ['btn_turn', 'btn_up'] },
  { value: 2, label: S.controlMode2, icons: ['btn_up', 'btn_turn'] },
  { value: 3, label: S.controlMode3, icons: ['btn_left', 'btn_right'] },
];

export default function Controls(nav) {
  return {
    render() {
      const cur = getProfile().controlMode;

      return screen(
        title(S.controlsTitle),

        ...MODES.map((m) =>
          el('div.ctrl-card', { class: m.value === cur ? 'on' : '' }, [
            el('div.ctrl-label', m.label),
            el('div.ctrl-preview', null,
              m.icons.map((k) => el('img', { src: `/assets/ui/${k}.png`, alt: k }))
            ),
            button(m.value === cur ? S.select : S.confirm, () => {
              setControlMode(m.value);
              nav.refresh();
            }, { primary: m.value === cur }),
          ])
        ),

        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
