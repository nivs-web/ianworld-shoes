/**
 * 점프 피아노 로비 (2026-11-07 대표님 «게임은 2개 — 줄넘기 챔피언 / 점프 피아노»).
 * 줄넘기 챔피언(동그라미 리듬)과 저장 · 상점 · 순위를 섞지 않는다. 설정과 최고 점수는 이 기기에만 적는다.
 * 한 손 = 오른쪽 3칸(점프) · 두 손 = 왼쪽 3칸(로프)까지 6칸. 슬라이더 타일은 기술(스키어 · 지그재그 · 줄 휘두르기).
 */
import S from '../config/strings.ko.js';
import { el, button, backButton, segmented, screen } from './ui.js';
import Portal from './Portal.js';
import { DIFFS, DIFF_KEYS } from '../games/jumprope/data.js';
import { STAGES } from '../games/jumprope/beat/stages.js';
import { ensureJrStyle } from './jumprope/jrui.js';
import JumpPianoGame, { pianoSave, pianoLoad } from './JumpPianoGame.js';

const CTRL_SEG = [{ value: 'jump', label: '한 손 (3칸)' }, { value: 'both', label: '두 손 (6칸)' }];
const SEG = DIFF_KEYS.map((k) => ({ value: k, label: DIFFS[k].label }));

export default function JumpPianoLobby(nav) {
  ensureJrStyle();
  return {
    render() {
      const st = pianoLoad();
      const best = (key) => st.best?.[`${st.ctrl}:${st.diff}:${key}`] | 0;
      const go = (mode, stageNo) => nav.push(JumpPianoGame, { mode, stageNo });
      return screen(
        el('div.diff-title', S.pianoTitle),
        el('div.jr-next', '타일을 두드려 점프! 긴 타일은 꾹 · 슬라이더 타일은 밀면서 따라가요'),
        el('div.diff-title', '방식 · 난이도'),
        segmented(CTRL_SEG, st.ctrl, (v) => { pianoSave({ ctrl: v }); nav.refresh(); }),
        segmented(SEG, st.diff, (v) => { pianoSave({ diff: v }); nav.refresh(); }),
        el('div.diff-title', '곡 고르기'),
        ...STAGES.map((s) => button(`${s.no}. ${s.name} · 최고 ${best(s.no).toLocaleString('en-US')}점`, () => go('stage', s.no), { primary: true })),
        button(`무한 피아노 · 최고 ${best('endless').toLocaleString('en-US')}점`, () => go('endless', 1), { primary: true }),
        el('div.spacer'),
        backButton(S.backToPortal, () => nav.reset(Portal)),
      );
    },
  };
}
