/**
 * S40 줄넘기 챔피언 **게임로비** (2026-11-07, 이안오락실 5번째 게임)
 *
 * > 권반장 지시: «캐치볼처럼 들어가서 아래 멀티플레이 버튼들이 있는 형태가 아니라
 * > 신발을 찾아서 · 드래곤 스트라이커처럼 로비가 있었으면 좋겠어. 캐릭터 꾸미기, 캐릭터 정보
 * > (줄넘기 몇 개까지 했는지 · 레벨 · 줄넘기를 얼마나 획득했는지), 명예의 전당, 아이템 구매 …
 * > 줄넘기도 다양하게 고르게 하고 난이도도 쉬움 · 보통 · 어려움.»
 *
 * 그래서 드래곤 로비(`DragonLobby.js`)와 **같은 순서**다:
 *   제목 / 로비유저상태창(캐릭터 + 기록) / 난이도 / 꾸미기 · 줄넘기 / 상점 · 명예의 전당 /
 *   만들기 · 설정 / 시작(스테이지 · 무한 줄넘기) / 오락실 복귀
 * 상태창의 캐릭터는 고른 줄넘기를 들고 **계속 줄넘기를 한다**(살아 있는 그림 하나).
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, segmented, screen } from './ui.js';
import { get as getProfile } from '../services/profile.js';
import { PAL } from '../game/palette.js';
import { pixelText } from './pixelText.js';
import Portal from './Portal.js';
import { lazyScreen } from './lazyScreen.js';
import * as J from '../services/jumprope.js';
import { DIFFS, DIFF_KEYS, ROPES } from '../games/jumprope/data.js';
import { animFigure } from '../games/jumprope/art.js';
import { ensureJrStyle, jrLogo, lvBar } from './jumprope/jrui.js';

const JrStages = lazyScreen(() => import('./jumprope/JrStages.js'), '스테이지');
const JrReady = lazyScreen(() => import('./jumprope/JrReady.js'), '무한 줄넘기');
const JrCloset = lazyScreen(() => import('./jumprope/JrCloset.js'), '캐릭터 꾸미기');
const JrRopes = lazyScreen(() => import('./jumprope/JrRopes.js'), '줄넘기 고르기');
const JrShop = lazyScreen(() => import('./jumprope/JrShop.js'), '상점');
const JrRanking = lazyScreen(() => import('./jumprope/JrRanking.js'), '명예의 전당');
const JrEditor = lazyScreen(() => import('./jumprope/JrEditor.js'), '스테이지 만들기');
const JrSettings = lazyScreen(() => import('./jumprope/JrSettings.js'), '설정 · 하는 법');

const SEG = DIFF_KEYS.map((k) => ({ value: k, label: DIFFS[k].label }));
const STAT_SCALE = 2;

/** `라벨 1,234 단위` 한 줄 — 숫자만 도트 글꼴 (DragonLobby 의 statLine 과 같은 방식) */
function statLine(str, numOpt) {
  const parts = String(str).split(/([\d,]+)/);
  return el('div.stat-line', null, parts.map((part, i) => {
    if (!/^[\d,]+$/.test(part)) return part;
    const cv = pixelText(part, numOpt);
    const pad = Number(cv.dataset.pad || 0);
    cv.style.marginLeft = /\s$/.test(parts[i - 1] ?? '') ? '0' : `-${pad}px`;
    cv.style.marginRight = `-${pad}px`;
    return cv;
  }));
}

export default function JumpRopeLobby(nav) {
  ensureJrStyle();
  let anim = null;
  const stopAnim = () => { anim?.stop(); anim = null; };
  /* 하위 화면은 한가할 때 미리 받아 둔다 */
  setTimeout(() => { for (const f of [JrStages, JrReady, JrCloset, JrRopes, JrShop, JrRanking]) f.prefetch?.(); }, 1200);

  return {
    onLeave() { stopAnim(); },
    render() {
      stopAnim();
      const p = getProfile();
      const j = J.jr();
      const L = J.levelOf(j);
      const diff = j.diff;
      const statNum = { scale: STAT_SCALE, mini: true, color: PAL.text };
      anim = animFigure(J.look(j), J.rope(j), 2, 44, 56);
      const nr = J.nextReward(j);

      return screen(
        jrLogo(),
        /* ── 로비유저상태창 ── */
        el('div.panel', null, [
          el('div.char-cell.jr', null, [anim.cv, el('div.char-name', p.nickname || '???')]),
          el('div.stats', null, [
            el('div', null, [statLine(`레벨 ${L.level}`, statNum), lvBar(L)]),
            statLine(`별사탕 ${j.candy.toLocaleString('en-US')}개`, statNum),
            statLine(`무한 최고 ${j.endless[diff]}개 (${DIFFS[diff].label})`, statNum),
            statLine(`총 넘은 횟수 ${j.jumps.toLocaleString('en-US')}번`, statNum),
            statLine(`모은 줄넘기 ${J.ownedRopes(j).length}/${ROPES.length}`, statNum),
            statLine(`별 ${J.starsIn(j, diff)}/30 (${DIFFS[diff].label})`, statNum),
          ]),
        ]),
        nr ? el('div.jr-next', `다음 레벨 보상 · Lv.${nr.lv} ${nr.list.map((x) => x.name).join(', ')}`) : el('div.jr-next', '모든 레벨 보상을 받았어요!'),

        el('div.diff-title', '난이도 (스테이지 · 무한 줄넘기)'),
        segmented(SEG, diff, (v) => { J.setDiff(v); nav.refresh(); }),

        el('div.row', null, [
          button('캐릭터 꾸미기', () => nav.push(JrCloset)),
          button('줄넘기 고르기', () => nav.push(JrRopes)),
        ]),
        el('div.row', null, [
          button('상점', () => nav.push(JrShop)),
          button('명예의 전당', () => nav.push(JrRanking)),
        ]),
        el('div.row', null, [
          button('스테이지 만들기', () => nav.push(JrEditor)),
          button('설정 · 하는 법', () => nav.push(JrSettings)),
        ]),

        /* 시작 버튼은 맨 아래 — 오락실 기계의 큰 버튼 자리 (드래곤 로비와 같다) */
        el('div.row', null, [
          button('스테이지', () => nav.push(JrStages), { primary: true }),
          button('무한 줄넘기', () => nav.push(JrReady, { mode: 'endless' }), { primary: true }),
        ]),

        el('div.spacer'),
        backButton(S.backToPortal, () => nav.reset(Portal)),
      );
    },
  };
}
