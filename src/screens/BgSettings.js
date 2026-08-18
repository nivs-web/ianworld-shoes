/**
 * S08d 싱글게임 배경설정 — 건물 16종 중 하나를 고정하거나 랜덤. (2026-08-19)
 *
 * ## 왜 싱글에만 적용하나
 *
 * 멀티는 **네 사람이 같은 계단·같은 배경**을 봐야 한다. 각자 취향대로 건물을 고르면
 * "같은 판"이라는 말이 성립하지 않고, 상대 고스트가 서 있는 자리가 화면마다 달라 보인다.
 * 그래서 멀티 배경은 방 시드가 정하고(`GameScene`), 이 설정은 무시된다.
 *
 * 미리보기로 `floor1`(1층 패널)을 쓴다 — 세 패널 중 그 건물의 개성이 가장 잘 드러나고,
 * 이미 게임에서 쓰는 파일이라 새로 구울 것이 없다.
 */

import S from '../config/strings.ko.js';
import { el, backButton, screen, title } from './ui.js';
import { get as getProfile, setSingleBg } from '../services/profile.js';
import { BUILDINGS, buildingAssets } from '../data/backgrounds.js';

const RANDOM = 'random';

export default function BgSettings(nav) {
  return {
    render() {
      const cur = getProfile().singleBg ?? RANDOM;

      /** 카드 하나 — 미리보기 + 이름. 고른 것은 테두리로 표시한다 */
      const card = (id, label, previewUrl) =>
        el('div.bg-card', {
          class: cur === id ? 'on' : '',
          onclick: () => { setSingleBg(id); nav.refresh(); },
        }, [
          previewUrl
            ? el('img.bg-thumb', { src: previewUrl, alt: label })
            : el('div.bg-thumb.bg-thumb-random', '?'),
          el('div.bg-card-name', label),
        ]);

      return screen(
        title(S.menuSingleBg),
        el('div.hint', S.singleBgHint),

        el('div.bg-grid', null, [
          card(RANDOM, S.bgRandom, null),
          ...BUILDINGS.map((b) => card(b.id, b.name, buildingAssets(b.id).floor1)),
        ]),

        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
