/**
 * 멀티 전용 인게임 표시 — 상대 진행도(S17) + 출발 카운트다운(S16).
 *
 * 인게임은 전부 캔버스다 (CLAUDE.md §6-3). DOM 오버레이를 얹으면 도트가 깨진다.
 *
 * 상대는 **이름 없이 얼굴도 없이 숫자만** 보여 준다. 180×320 안에서 세 명분
 * 초상화까지 넣으면 정작 내 계단이 안 보인다. 필요한 정보는 "쟤가 나보다
 * 위에 있나"뿐이고, 그건 숫자 두 개면 된다.
 */

import { text } from '../core/pixelfont.js';
import { PAL } from './palette.js';
import { VIEW_W } from '../config/layout.js';
import S from '../config/strings.ko.js';

/** 상대 줄이 시작되는 y — HUD(게이지·계단수)가 끝나는 바로 아래 */
const ROW_Y = 66;
const ROW_H = 10;

/**
 * @param {object} scene GameScene
 */
export function multiHud(scene) {
  drawOpponents(scene);
  drawCountdown(scene);
}

function drawOpponents(scene) {
  const list = scene.opponents ?? [];
  if (!list.length) return;

  // 계단이 높은 순 — 지금 누가 앞서는지가 한눈에 보여야 한다
  const sorted = [...list].sort((a, b) => (b.stairs ?? 0) - (a.stairs ?? 0));

  sorted.slice(0, 3).forEach((o, i) => {
    const y = ROW_Y + i * ROW_H;
    /**
     * 죽은 상대는 회색. 멀티는 한 명이 죽으면 즉시 끝나므로 이 표시가 보이는 시간은
     * 아주 짧지만, 그 찰나에 "누가 먼저 죽었나"를 알 수 있어야 결과 화면이 납득된다.
     */
    const alive = o.alive !== false;
    const color = alive ? PAL.text : PAL.textShadow;
    // 이름은 2~5자라 그대로 넣어도 넘치지 않는다 (balance.NICKNAME)
    text(String(o.nickname ?? '').slice(0, 5), 4, y, { scale: 1, color });
    text(S.multiOpponentStat(o.shoesFound ?? 0, o.stairs ?? 0), VIEW_W - 4, y, {
      scale: 1, color, align: 'right', mono: true,
    });
  });
}

function drawCountdown(scene) {
  const ms = scene.countdownMs ?? 0;
  if (ms <= 0) return;
  const n = Math.ceil(ms / 1000);
  /**
   * 3·2·1 은 숫자로, 0 이 되는 순간만 'GO!'. 기획서 §7 S16 그대로다.
   * 화면 한가운데 크게 — 이때는 계단을 볼 게 아니라 출발 타이밍만 보면 된다.
   */
  text(n > 0 ? String(n) : S.go, VIEW_W >> 1, 130, {
    scale: n > 0 ? 6 : 4, color: PAL.text, outline: PAL.textShadow, align: 'center', mono: true,
  });
}
