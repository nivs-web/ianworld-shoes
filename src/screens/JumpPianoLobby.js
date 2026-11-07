/**
 * 점프 피아노 **게임로비** (2026-11-07, 이안오락실 6번째 게임)
 *
 * > 대표님: «줄넘기 챔피언에 있는 기능 싹 다 점프 피아노에 집어넣어 — 복사해서 이름만 바꿔서.
 * > 캐릭터 꾸미기, 줄넘기 고르기, 상점, 명예의 전당(콤보 랭킹 포함), 스테이지, 배경 다 가져와.
 * > 단 점프 피아노의 멀티게임은 다음주에 개발 — 그것만 빼고.»
 *
 * 줄넘기 챔피언 로비(`JumpRopeLobby.js`)를 복사해 이름만 바꿨다 — 같은 순서:
 *   제목 / 로비유저상태창(캐릭터 + 기록) / 방식 · 난이도 / 꾸미기 · 줄넘기 / 상점 · 명예의 전당 /
 *   만들기 · 설정 / 시작(챔피언십 · 무한 피아노) / 오락실 복귀
 * 저장 · 지갑 · 기록 · 순위는 챔피언과 **따로**다(`services/jumppiano.js` — 프로필 `jp`).
 * 멀티 단추는 없다(다음 주 개발).
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, segmented, screen } from './ui.js';
import { get as getProfile } from '../services/profile.js';
import { PAL } from '../game/palette.js';
import { pixelText } from './pixelText.js';
import Portal from './Portal.js';
import { lazyScreen } from './lazyScreen.js';
import * as J from '../services/jumppiano.js';
import { DIFFS, DIFF_KEYS, ROPES } from '../games/jumprope/data.js';
import { animFigure } from '../games/jumprope/art.js';
import { ensureJpStyle, jpLogo, lvBar, modeGuide } from './jumppiano/jpui.js';

const JpStages = lazyScreen(() => import('./jumppiano/JpStages.js'), '점프 피아노 챔피언십');
const JpReady = lazyScreen(() => import('./jumppiano/JpReady.js'), '무한 피아노');
const JpCloset = lazyScreen(() => import('./jumppiano/JpCloset.js'), '캐릭터 꾸미기');
const JpRopes = lazyScreen(() => import('./jumppiano/JpRopes.js'), '줄넘기 고르기');
const JpShop = lazyScreen(() => import('./jumppiano/JpShop.js'), '상점');
const JpRanking = lazyScreen(() => import('./jumppiano/JpRanking.js'), '명예의 전당');
const JpEditor = lazyScreen(() => import('./jumppiano/JpEditor.js'), '스테이지 만들기');
const JpSettings = lazyScreen(() => import('./jumppiano/JpSettings.js'), '설정 · 하는 법');

const SEG = DIFF_KEYS.map((k) => ({ value: k, label: DIFFS[k].label }));
const CTRL_SEG = [{ value: 'jump', label: '한 손 (3칸)' }, { value: 'both', label: '두 손 (6칸)' }];
const STAT_SCALE = 2;

/** `라벨 1,234 단위` 한 줄 — 숫자만 도트 글꼴 (챔피언 로비와 같은 방식) */
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

export default function JumpPianoLobby(nav) {
  ensureJpStyle();
  let anim = null;
  const stopAnim = () => { anim?.stop(); anim = null; };
  /* 하위 화면은 한가할 때 미리 받아 둔다 */
  setTimeout(() => { for (const f of [JpStages, JpReady, JpCloset, JpRopes, JpShop, JpRanking]) f.prefetch?.(); }, 1200);

  /* 시작 단추 — 처음 누르면 모드 설명 팝업(jpui.modeGuide), 본 뒤로는 바로 간다 */
  let guiding = false;
  const guided = (kind, go) => {
    if (guiding) return;
    guiding = true;
    modeGuide(kind).then((ok) => { guiding = false; if (ok) go(); });
  };

  return {
    onLeave() { stopAnim(); },
    render() {
      stopAnim();
      const p = getProfile();
      const j = J.jp();
      const L = J.levelOf(j);
      const diff = j.diff;
      const statNum = { scale: STAT_SCALE, mini: true, color: PAL.text };
      anim = animFigure(J.look(j), J.rope(j), 2, 44, 56);
      const nr = J.nextReward(j);

      return screen(
        jpLogo(),
        /* ── 로비유저상태창 ── */
        el('div.panel', null, [
          el('div.char-cell.jr', null, [anim.cv, el('div.char-name', p.nickname || '???')]),
          el('div.stats', null, [
            el('div', null, [statLine(`레벨 ${L.level}`, statNum), lvBar(L)]),
            statLine(`별사탕 ${j.candy.toLocaleString('en-US')}개`, statNum),
            statLine(`무한 최고 ${j.endless[diff]}개 (${DIFFS[diff].label})`, statNum),
            statLine(`총 점프 횟수 ${j.jumps.toLocaleString('en-US')}번`, statNum),
            statLine(`모은 줄넘기 ${J.ownedRopes(j).length}/${ROPES.length}`, statNum),
            statLine(`별 ${J.champStars(j, diff)}/${J.CHAMP_STAGES * 3} (${DIFFS[diff].label})`, statNum),
          ]),
        ]),
        nr ? el('div.jr-next', `다음 레벨 보상 · Lv.${nr.lv} ${nr.list.map((x) => x.name).join(', ')}`) : el('div.jr-next', '모든 레벨 보상을 받았어요!'),

        /* 방식(한 손 3칸 · 두 손 6칸) 과 난이도 — 처음부터 자유롭게 고른다 */
        el('div.diff-title', '방식 · 난이도'),
        segmented(CTRL_SEG, J.ctrlMode(j), (v) => { J.setOpt('ctrl', v); nav.refresh(); }),
        segmented(SEG, diff, (v) => { J.setDiff(v); nav.refresh(); }),

        el('div.row', null, [
          button('캐릭터 꾸미기', () => nav.push(JpCloset)),
          button('줄넘기 고르기', () => nav.push(JpRopes)),
        ]),
        el('div.row', null, [
          button('상점', () => nav.push(JpShop)),
          button('명예의 전당', () => nav.push(JpRanking)),
        ]),
        el('div.row', null, [
          button('스테이지 만들기', () => nav.push(JpEditor)),
          button('설정 · 하는 법', () => nav.push(JpSettings)),
        ]),

        /* 시작 버튼은 맨 아래 — 오락실 기계의 큰 버튼 자리 (챔피언 로비와 같다). 멀티는 다음 주 */
        el('div.row', null, [
          button('챔피언십', () => guided('champ', () => nav.push(JpStages)), { primary: true }),
          button('무한 피아노', () => guided('endless', () => nav.push(JpReady, { mode: 'endless' })), { primary: true }),
        ]),

        el('div.spacer'),
        backButton(S.backToPortal, () => nav.reset(Portal)),
      );
    },
  };
}
