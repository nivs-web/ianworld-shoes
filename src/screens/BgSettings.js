/**
 * S08d 싱글게임 배경설정 — 건물 44종 중 하나를 고정하거나 랜덤. (2026-08-19)
 *
 * ## 왜 싱글에만 적용하나
 *
 * 멀티는 **네 사람이 같은 계단·같은 배경**을 봐야 한다. 각자 취향대로 건물을 고르면
 * "같은 판"이라는 말이 성립하지 않고, 상대 고스트가 서 있는 자리가 화면마다 달라 보인다.
 * 그래서 멀티 배경은 방 시드가 정하고(`GameScene`), 이 설정은 무시된다.
 *
 * 목록 미리보기로 `floor1`(1층 패널)을 쓴다 — 세 패널 중 그 건물의 개성이 가장 잘 드러나고,
 * 이미 게임에서 쓰는 파일이라 새로 구울 것이 없다.
 *
 * ## 한 번 더 누르면 크게 본다 (2026-08-19)
 *
 * 배경이 44종이 되면서 **54px 짜리 썸네일로는 고를 수가 없어졌다.** 그렇다고 격자를
 * 키우면 한 화면에 몇 개 안 들어온다. 그래서 고르는 것과 구경하는 것을 나눴다 —
 * 첫 탭은 선택(빨간 테두리), 이미 고른 카드를 한 번 더 누르면 **도로 + 1층 + 2·3층을
 * 이어 붙인 세로 한 컷**이 뜬다. 게임에서 실제로 보게 될 탑 그대로다.
 *
 * 이어 붙이는 건 그림 세 장을 세로로 쌓는 것뿐이라 **새로 구울 파일이 없다.**
 * 대신 확대는 정수배로만 한다(180 의 배수) — 1.7배 같은 걸 걸면 도트가 뭉개진다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title, presentOverlay } from './ui.js';
import { get as getProfile, setSingleBg } from '../services/profile.js';
import { BUILDINGS, buildingAssets } from '../data/backgrounds.js';
import { BG } from '../config/layout.js';
import { play } from '../audio/sfx.js';

const RANDOM = 'random';

/** 한 컷의 논리 크기 — 2·3층(360) + 1층(180) + 도로(120) */
const CUT_W = BG.tileW;
const CUT_H = BG.tileH + BG.floor1H + BG.roadH;

/**
 * 큰 그림 팝업. 확대는 **정수배**로만 — 가로가 화면에 들어가는 최대 배수를 고른다.
 * 세로는 어차피 660 도트라 웬만한 폰보다 길다. 억지로 줄이는 대신 스크롤한다:
 * "탑이 길다"는 게 이 게임의 그림이고, 줄여 놓으면 그게 안 보인다.
 */
/**
 * 확대 배율 — 가로가 정하고, **너무 길어지면 한 단계씩 줄인다.**
 * 폰(390px)이면 2배(360×1320) — 화면 두 번쯤 굴리면 끝까지 본다.
 * 가로만 보고 정하면 넓은 PC 에서 6배(1080×3960)가 나와 스크롤만 하다 만다.
 *
 * 화면 밖으로 뺀 이유는 **미리보기와 검사가 같은 식을 쓰게** 하려는 것이다.
 * 미리보기가 배율을 따로 계산하면, 그 미리보기는 언젠가 거짓말을 한다(§9-0-33).
 */
export function cutScale(vw, vh) {
  const 여유높이 = Math.max(320, vh - 140);
  let k = Math.max(1, Math.min(3, Math.floor((vw - 16) / CUT_W)));
  while (k > 1 && CUT_H * k > 여유높이 * 2.2) k--;
  return k;
}

function openCut(bId, name) {
  const k = cutScale(window.innerWidth, window.innerHeight);
  const a = buildingAssets(bId);
  const img = (src) => el('img', { src, alt: '' });

  const overlay = el('div.dialog-overlay.bg-cut-overlay', {
    onclick: (e) => { if (e.target === e.currentTarget) close(); },
  }, [
    el('div.bg-cut', null, [
      el('div.bg-cut-name', name),
      el('div.bg-cut-stack', { style: `width:${CUT_W * k}px` }, [
        img(a.tile), img(a.floor1), img(a.road),
      ]),
      button(S.bgPreviewClose, () => close(), { sfx: 'sfx_menu_back' }),
    ]),
  ]);
  const close = presentOverlay(overlay);
  play('sfx_menu_select');
}

export default function BgSettings(nav) {
  return {
    render() {
      const cur = getProfile().singleBg ?? RANDOM;

      /**
       * 카드 하나 — 미리보기 + 이름. 고른 것은 테두리로 표시한다.
       * 이미 고른 카드를 다시 누르면 **선택을 바꾸지 않고** 큰 그림을 연다.
       */
      const card = (id, label, previewUrl) =>
        el('div.bg-card', {
          class: cur === id ? 'on' : '',
          onclick: () => {
            if (cur === id) return previewUrl ? openCut(id, label) : undefined;
            setSingleBg(id);
            nav.refresh();
          },
        }, [
          previewUrl
            ? el('img.bg-thumb', { src: previewUrl, alt: label })
            : el('div.bg-thumb.bg-thumb-random', '?'),
          el('div.bg-card-name', label),
        ]);

      return screen(
        title(S.menuSingleBg),
        el('div.hint', S.singleBgHint),
        el('div.hint.bg-tip', S.bgPreviewHint),

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
