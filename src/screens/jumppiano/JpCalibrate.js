/**
 * 점프 피아노 — 타이밍 맞추기(판정 보정).
 * 줄넘기 챔피언 `JrCalibrate.js` 를 복사해 이름만 바꿨다 — 보정값은 피아노 설정(`jp.opts.offset`)에 저장한다.
 *
 * 메트로놈 «딱» 소리 12번(앞 4번은 준비) 중 뒤 8번에 맞춰 JUMP(단추 · 스페이스 · 화면)를 누른다.
 * 누른 시각과 박의 차이(오디오 출력 시각 기준)의 **중앙값**을 보정값으로 저장한다(−150 ~ +150ms).
 * 블루투스 이어폰처럼 소리가 늦게 나오는 기기에서 PERFECT 가 맞게 만든다.
 */

import { el, button, backButton, screen, title } from '../ui.js';
import * as J from '../../services/jumppiano.js';
import { createMusic } from '../../games/jumprope/beat/music.js';
import { ensureJpStyle } from './jpui.js';

const BPM = 100, BEATS = 12, LEAD = 4;

export default function JpCalibrate(nav) {
  ensureJpStyle();
  let music = null, T0 = 0, taps = [], state = 'idle', msg = '', result = null, timer = 0;
  const beat = 60 / BPM;

  const ctxTimeAt = (ts) => {
    const ctx = music?.ctx;
    if (!ctx) return 0;
    try {
      const ot = ctx.getOutputTimestamp?.();
      if (ot && ot.performanceTime > 0) return ot.contextTime + (ts - ot.performanceTime) / 1000;
    } catch { /* */ }
    return ctx.currentTime - (performance.now() - ts) / 1000 - (ctx.outputLatency || ctx.baseLatency || 0);
  };
  function start() {
    music = music || createMusic();
    music.init();
    taps = []; result = null; state = 'run'; msg = '«딱» 소리에 맞춰 눌러요 — 처음 4번은 듣기만';
    T0 = music.metronome(BPM, BEATS);
    clearTimeout(timer);
    timer = setTimeout(done, (LEAD + BEATS + 1) * beat * 1000 + 600);
    nav.refresh();
  }
  function tap(ts) {
    if (state !== 'run' || !music?.ctx) return;
    const t = ctxTimeAt(ts) - T0;
    const k = Math.round(t / beat);
    if (k < LEAD || k >= BEATS) return;
    taps.push((t - k * beat) * 1000);
    msg = `${taps.length} / ${BEATS - LEAD}`;
    nav.refresh();
  }
  function done() {
    state = 'done';
    if (taps.length < 4) { msg = '누른 횟수가 적어요. 다시 해 볼까요?'; nav.refresh(); return; }
    const s = [...taps].sort((a, b) => a - b);
    const med = s[Math.floor(s.length / 2)];
    result = Math.max(-150, Math.min(150, Math.round(med)));
    msg = result > 8 ? `소리보다 ${result}ms 늦게 누르는 편이에요` : result < -8 ? `소리보다 ${-result}ms 빨리 누르는 편이에요` : '거의 딱 맞아요!';
    nav.refresh();
  }
  const kd = (e) => { if (!e.repeat && ['Space', 'KeyD', 'ArrowRight', 'KeyJ', 'Enter'].includes(e.code)) { e.preventDefault(); tap(e.timeStamp || performance.now()); } };
  window.addEventListener('keydown', kd);

  return {
    onLeave() { window.removeEventListener('keydown', kd); clearTimeout(timer); try { music?.stop(); music?.close(); } catch { /* */ } },
    render() {
      const cur = J.jp().opts.offset | 0;
      return screen(
        title('타이밍 맞추기'),
        el('div.jr-box', null, [
          el('h4', '메트로놈에 맞춰 JUMP 를 눌러요'),
          el('div', `«딱» 12번 — 처음 4번은 듣기만, 다음 8번에 맞춰 누르기. 지금 보정값: ${cur > 0 ? '+' : ''}${cur}ms`),
          el('div', '이어폰(특히 블루투스)을 쓰면 꼭 한 번 맞춰 주세요.'),
        ]),
        el('button.rb-cal-pad', {
          type: 'button',
          onpointerdown: (e) => { e.preventDefault(); if (state === 'run') tap(e.timeStamp || performance.now()); },
        }, ['JUMP']),
        el('div.hint', msg || '아래 «시작»을 누르세요'),
        state === 'done' && result != null
          ? el('div.row', null, [
            button(`보정값 ${result > 0 ? '+' : ''}${result}ms 저장`, () => { J.setOpt('offset', result); msg = '저장했어요!'; state = 'idle'; nav.refresh(); }, { primary: true }),
            button('다시', start),
          ])
          : button(state === 'run' ? '듣는 중…' : '시작', () => { if (state !== 'run') start(); }, { primary: state !== 'run' }),
        button('보정값 0 으로', () => { J.setOpt('offset', 0); msg = '0 으로 되돌렸어요'; nav.refresh(); }),
        el('div.spacer'),
        backButton('뒤로', () => nav.back()),
      );
    },
  };
}
