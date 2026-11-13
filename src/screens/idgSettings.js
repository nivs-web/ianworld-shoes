/**
 * 좀비와 드래곤 «설정» 창 — 로비 더보기 (대표님 11/13 밤 «음향 설정 + 키보드 설정 = 설정 하나 · 탭 [음향] [화면] [키보드]»)
 *
 *  음향   : 소리만 (배경음악 · 말 많기 · 크기 · 좀비 소리 · 전체 소리) — soundPrefs.soundPanel 에서 화면 방향 줄을 뺀 것
 *  화면   : 로비화면 방향 (자동 · 가로 · 세로) — 처음엔 기기에 맞춘 값(폰 세로 · 그 밖 가로) · 직접 고르면 그 값 · 게임화면은 늘 가로(안내만)
 *  키보드 : 동작 | 지금 키 | [바꾸기] 표 + 맨 아래 «처음대로» (저장 = 기기 localStorage 'idg_keys' · idgKeys.js)
 * 전투 중 «일시정지» 창은 이 창이 아니다 (원래 모양 그대로 — hud.js pauseCard).
 * 모양 = 로비 창 양식(.dialog.idg-xw · 머리 X 하나) + 키트 부품(탭 · 줄 · 스크롤 상자)
 */
import { el, button, presentOverlay, toast } from './ui.js';
import * as Sfx from '../audio/sfx.js';
import { kitTabs, kitRow, kitBtn, kitSection, kitScroll, kitPaper } from './idgKit.js';
import { xTitle } from './idgXwin.js';
import { soundPanel } from '../games/iandragon_game/render/soundPrefs.js';
import { ORIENTS, lobbyOrientPref, lobbyOrientChosen, setLobbyOrientPref, GAME_ORIENT, isPhone } from '../games/iandragon_game/render/rot.js';
import { KEY_ACTIONS, FIXED_KEYS, keyLabel, keyName, setKey, resetKeys, captureKey, cancelCapture } from './idgKeys.js';

const TABS = [{ id: 'sound', label: '음향' }, { id: 'screen', label: '화면' }, { id: 'keys', label: '키보드' }];

/** @param {{tab?:'sound'|'screen'|'keys', onSound?:(p:{mute?:boolean,style?:string})=>void}} [o] */
export function showSettings(o = {}) {
  Sfx.play('sfx_menu_select');
  const scroll = kitScroll([], { height: 'clamp(150px, calc(100vh - 230px), 440px)' });
  const foot = el('div.idg-row.idg-foot2');
  let cur = '';

  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  function soundTab() { return [soundPanel(mk, (p) => o.onSound?.(p), { screen: false })]; }

  function screenTab() {
    const note = el('p.idg-set-note');
    const paint = () => {
      const chosen = lobbyOrientChosen();
      note.textContent = chosen ? '내가 고른 대로 기억해요.' : `처음에는 기기에 맞춰져요 — 지금은 ${isPhone() ? '휴대폰이라 세로' : '휴대폰이 아니라 가로'}예요. 직접 고르면 그대로 기억해요.`;
    };
    const tabs = kitTabs({ label: '로비화면 방향', tabs: ORIENTS.map(({ v, label }) => ({ id: v, label })), value: lobbyOrientPref(), onPick: (v) => { setLobbyOrientPref(v); paint(); } });
    paint();
    return [
      kitRow({ title: '로비화면', sub: '로비와 로비 창의 방향', right: tabs }),
      kitRow({ title: '게임화면', sub: '싸울 때는 늘 가로예요', right: el('span.idg-key-chip.fixed', GAME_ORIENT === 'land' ? '가로' : '세로') }),
      note,
    ];
  }

  function keysTab() {
    const chips = new Map(), btns = new Map();
    const chipOf = (id) => el('span.idg-key-chip', keyLabel(id));
    const update = () => { for (const [id, c] of chips) { c.textContent = keyLabel(id); c.classList.remove('wait'); } for (const b of btns.values()) b.querySelector('.idg-k-btn-text').textContent = '바꾸기'; };
    const start = (id) => {
      cancelCapture(); update();
      const chip = chips.get(id), btn = btns.get(id);
      chip.textContent = '바꿀 키를 누르세요'; chip.classList.add('wait'); btn.querySelector('.idg-k-btn-text').textContent = '취소';
      captureKey(chip, (code) => {
        if (code == null) { update(); return true; }   // Esc = 취소
        const r = setKey(id, code);
        if (!r.ok) { toast(r.error, 1600); return false; }   // 쓸 수 없는 키면 계속 기다림
        update();
        const lab = (x) => KEY_ACTIONS.find((a) => a.id === x)?.label;
        toast(r.swapped ? `«${keyName(code)}» 키를 «${lab(r.swapped)}» 와 서로 바꿨어요` : `«${lab(id)}» → «${keyName(code)}»`, 2000);
        return true;
      });
    };
    const out = [kitPaper('[바꾸기]를 누르고 새 키를 누르세요. 이미 쓰는 키면 두 동작이 서로 바뀌어요. 한글 입력 상태여도 같은 키예요. Esc = 취소')];
    let grp = '';
    for (const a of KEY_ACTIONS) {
      if (a.group !== grp) { grp = a.group; out.push(kitSection(grp)); }
      const chip = chipOf(a.id), btn = kitBtn({ kind: 'purple', size: 'sm', text: '바꾸기', label: `${a.label} 키 바꾸기`, onClick: () => start(a.id) });
      chips.set(a.id, chip); btns.set(a.id, btn);
      out.push(kitRow({ title: a.label, right: [chip, btn] }));
    }
    out.push(kitSection('고정 키 (바꿀 수 없어요)'));
    for (const f of FIXED_KEYS) out.push(el('div.idg-key-fixed', null, [kitRow({ title: f.keys, sub: f.label, right: [] })]));
    return out;
  }

  function draw(id) {
    cancelCapture(); cur = id;
    scroll.inner.replaceChildren(...(id === 'sound' ? soundTab() : id === 'screen' ? screenTab() : keysTab()));
    scroll.inner.scrollTop = 0; scroll.refresh();
    foot.replaceChildren(...(id === 'keys' ? [button('처음대로', () => { cancelCapture(); resetKeys(); draw('keys'); toast('키를 처음대로 돌렸어요', 1600); }, { sfx: 'sfx_menu_move' })] : []));
    foot.style.display = id === 'keys' ? '' : 'none';
  }

  const tabs = kitTabs({ label: '설정', tabs: TABS, value: o.tab || 'sound', onPick: (id) => draw(id) });
  draw(o.tab || 'sound');
  const box = el('div.dialog.idg-set.idg-xw', { onclick: (e) => e.stopPropagation() }, [xTitle('설정', () => close()), tabs, scroll, foot]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay, () => { cancelCapture(); });
  return { close, tab: () => cur };
}
