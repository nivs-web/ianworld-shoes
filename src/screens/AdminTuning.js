/**
 * 운영자 난이도 설정 화면. (2026-11-07, 권반장 지시)
 *
 * *"그거 누르면 캐치볼에서 전체적으로 던지기 난이도 · 받기 난이도 · 캐치볼 전체 스피드 등을
 *   1에서 99까지 조절하게. 현재 적용된 건 다 50 으로 기본 셋팅"*
 *
 * 통계 화면(`AdminStats`)에서만 들어온다 — 그 화면이 운영자에게만 보인다. 저장도 서버 규칙이
 * 운영자만 받는다(`config/tuning`). 숫자 · 배율 계산은 전부 `services/tuning.js` 에 있다.
 *
 * ## 누르는 동안 화면을 다시 그리지 않는다
 * [−][+] 를 길게 누르면 숫자가 빠르게 바뀐다. 그때마다 `nav.refresh()` 로 화면을 새로 만들면
 * 누르고 있던 단추가 사라져 손을 떼도 멈추지 않는다. 그래서 숫자 칸만 직접 고친다.
 *
 * ## 저장은 손을 멈추고 0.5초 뒤 한 번
 * 50 → 30 으로 내리는 동안 스무 번 쓰지 않는다. 화면을 떠나면 남은 것을 곧바로 쓴다.
 */

import S from '../config/strings.ko.js';
import * as Sfx from '../audio/sfx.js';
import { el, button, backButton, screen, title } from './ui.js';
import * as Tuning from '../services/tuning.js';

const SAVE_DELAY_MS = 500;
/** 길게 누르기 — 이만큼 지나면 되풀이가 시작되고, 오래 누를수록 빨라진다 */
const HOLD_START_MS = 380;
const holdEvery = (n) => (n < 6 ? 120 : n < 20 ? 60 : 30);

export default function AdminTuning(nav) {
  let live = true;
  /** 손을 대기 시작했다 — 뒤늦게 온 서버 값이 편집을 덮지 않게 */
  let touched = false;
  const id = (g, k) => `${g}.${k}`;
  const vals = {};
  const nodes = {};               // id → { val, x }
  const timers = new Map();       // id → 저장 대기
  let inflight = 0;
  let batchFailed = false;
  let statusEl = null;
  let status = '';

  function readAll() {
    for (const { id: g } of Tuning.TUNING_GAMES) for (const { key } of Tuning.TUNING[g]) vals[id(g, key)] = Tuning.level(g, key);
  }
  readAll();
  /* 다른 기기에서 바꿨을 수도 있다 — 열 때 한 번 더 읽는다(운영자 한 명만 부른다) */
  Tuning.refreshTuning().then((ok) => {
    if (!live || !ok || touched) return;
    readAll();
    for (const k of Object.keys(nodes)) paint(k);
  });

  function factorText(lv) {
    if (lv === Tuning.TUNE_MID) return S.adminTuningMid;
    const f = Tuning.factor(lv);
    return lv > Tuning.TUNE_MID ? S.adminTuningHarder(f) : S.adminTuningEasier(f);
  }

  function paint(k) {
    const n = nodes[k];
    if (!n) return;
    const lv = vals[k];
    n.val.textContent = String(lv);
    n.x.textContent = factorText(lv);
    n.row.classList.toggle('harder', lv > Tuning.TUNE_MID);
    n.row.classList.toggle('easier', lv < Tuning.TUNE_MID);
  }

  function setStatus(s) {
    status = s;
    if (!statusEl) return;
    statusEl.textContent = s === 'saving' ? S.adminTuningSaving : s === 'saved' ? S.adminTuningSaved : s === 'failed' ? S.adminTuningFailed : '';
    statusEl.className = `tune-status ${s}`;
  }

  /** @returns {boolean} 값이 바뀌었나 (끝에 닿으면 false — 되풀이를 멈춘다) */
  function setVal(g, k, v) {
    const key = id(g, k);
    const lv = Tuning.clampLevel(v);
    if (lv === null || lv === vals[key]) return false;
    vals[key] = lv;
    paint(key);
    schedule(g, k);
    return true;
  }

  function schedule(g, k) {
    const key = id(g, k);
    if (!timers.size && !inflight) batchFailed = false;
    touched = true;
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => save(g, k), SAVE_DELAY_MS));
    setStatus('saving');
  }

  async function save(g, k) {
    const key = id(g, k);
    timers.delete(key);
    inflight++;
    const ok = await Tuning.setLevel(g, k, vals[key]);
    inflight--;
    if (!ok) batchFailed = true;
    if (!live) return;
    /* 거부됐으면 이 기기 캐시는 서비스가 되돌렸다 — 화면도 그 값으로 */
    if (!ok && !timers.has(key)) { vals[key] = Tuning.level(g, k); paint(key); }
    if (!timers.size && !inflight) setStatus(batchFailed ? 'failed' : 'saved');
  }

  /** 떠날 때 기다리던 저장을 곧바로 보낸다 — 0.5초 안에 [뒤로]를 눌러도 잃지 않는다 */
  function flush() {
    for (const [key, t] of timers) {
      clearTimeout(t);
      const [g, k] = key.split('.');
      Tuning.setLevel(g, k, vals[key]).catch(() => {});
    }
    timers.clear();
  }

  /** [−] / [+] — 톡 누르면 한 칸, 길게 누르면 점점 빠르게 */
  function stepper(g, k, dir) {
    let t = null, n = 0;
    const stop = () => { clearTimeout(t); t = null; };
    const tick = () => {
      n++;
      if (!setVal(g, k, vals[id(g, k)] + dir)) { stop(); return; }
      if (n % 5 === 0) Sfx.play('sfx_menu_move');
      t = setTimeout(tick, holdEvery(n));
    };
    const btn = el('button.pbtn.tune-btn', {
      type: 'button',
      'aria-label': dir > 0 ? '+1' : '-1',
      onpointerdown(e) {
        if (e.button > 0) return;
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch { /* 지원 안 함 */ }
        stop(); n = 0;
        setVal(g, k, vals[id(g, k)] + dir);
        Sfx.play('sfx_menu_move');
        t = setTimeout(tick, HOLD_START_MS);
      },
      onpointerup: stop,
      onpointercancel: stop,
      onlostpointercapture: stop,
      oncontextmenu(e) { e.preventDefault(); },
      /* 키보드(Enter · Space)로 누르면 pointerdown 없이 click 만 온다 */
      onclick(e) { if (e.detail === 0) { setVal(g, k, vals[id(g, k)] + dir); Sfx.play('sfx_menu_move'); } },
    }, [dir > 0 ? '+' : '-']);
    return btn;
  }

  function row(g, t) {
    const key = id(g, t.key);
    const val = el('div.tune-val');
    const x = el('div.tune-x');
    const r = el('div.tune-row', null, [
      el('div.tune-label', null, [el('div.tune-name', t.name), el('div.tune-desc', t.desc), x]),
      el('div.tune-ctrl', null, [stepper(g, t.key, -1), val, stepper(g, t.key, +1)]),
    ]);
    nodes[key] = { val, x, row: r };
    paint(key);
    return r;
  }

  function group(game) {
    return el('div.tune-game', null, [
      el('div.tune-game-name', game.name),
      ...Tuning.TUNING[game.id].map((t) => row(game.id, t)),
      button(S.adminTuningReset, () => {
        for (const { key } of Tuning.TUNING[game.id]) setVal(game.id, key, Tuning.TUNE_MID);
      }, { class: 'tune-reset', sfx: 'sfx_menu_back' }),
    ]);
  }

  return {
    onLeave() { live = false; flush(); },

    render() {
      statusEl = el('div.tune-status');
      setStatus(status);
      return screen(
        title(S.adminTuningTitle),
        el('div.hint', `${S.adminTuningHint}\n${S.adminTuningHint2}`),
        statusEl,
        ...Tuning.TUNING_GAMES.map(group),
        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
