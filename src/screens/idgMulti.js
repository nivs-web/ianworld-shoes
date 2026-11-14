/**
 * 좀비와 드래곤 — «친구랑 같이 깨기» (3차 멀티 · 2026-11-11 · 멀티 기획 4장 · M3)
 * 방 만들기 → 방 번호를 친구에게 알려 줌 → 친구가 번호로 들어옴 → 방장이 «시작» → 카운트다운 → 둘 다 같은 판으로.
 * 오락실 방(services/multiplayer.js)을 그대로 쓴다 — game 'idragon' · 2인 · 공개방(대표님 11/11 «비밀번호 방 말고 공개 방») · idgStage.
 * ⏳ 서버 규칙 게시 전에는 방을 못 만든다 → «아직 준비 중» 안내.
 *
 * 레이아웃 «멀티 A» (11/14 대표님 선택 · tools/_uimock/multi_a2.html · 디자인 규칙표 2판 ⑰ 왼쪽 메뉴 단추 · ⑲ 줄)
 *   왼쪽 = 모드 메뉴 단추(같이 깨기 · 드래곤 대결) + 종이 안내 + 빨강 [빠른 시작]
 *   오른쪽 = 고른 모드의 내용(줄) + 보라 [방 만들기] + 맨 아래 «방 번호 6자리» 입력 줄
 *   대기실 = 왼쪽 방 번호 · 빨강 [시작!] / 오른쪽 스테이지 · 들어온 사람 줄
 *   지금 없는 기능(열린 방 목록 · 비번방)은 만들지 않음 · 모양 = src/styles/idg-v2-multi.css
 */
import { el, presentOverlay } from './ui.js';
import * as G from '../services/iandragonGame.js';
import * as Room from '../services/multiplayer.js';
import * as Sfx from '../audio/sfx.js';
import { seatsOf } from '../games/iandragon_game/net/roomBridge.js';
import { makeLoads, stageByNo, loadToLd, ldToLoad, PVP_OPEN, PVP_DAY, NET_V } from '../games/iandragon_game/render/battleSetup.js';
import { currentUser } from '../services/auth.js';
import { decodeLook, titleOf } from '../games/iandragon_game/data/looks.js';
import { xTitle } from './idgXwin.js';
import { enterFullscreen } from '../core/fullscreen.js';   /* 11/12 대표님 «전투로 들어가는 단추는 무조건 전체 화면» — 판은 서버 응답 뒤에 열려 그때는 못 켜므로 누르는 순간에 켠다 */
import '../styles/idg-v2-multi.css';

const AI = '/assets/iandragon_game/ai/';
const LOCK = `${AI}lobby/ico_lock.png`;
/* 단추 (규칙표 ③ : 빨강 = 싸우러 가기 · 시작 / 보라 = 고르기 · 탭 / 회색 = 잠김) — 누르면 딸깍 */
const btn = (kind, label, onClick, opt = {}) => el(`button.idg-mx-btn.${kind}${opt.cls ? '.' + opt.cls : ''}`, { type: 'button', disabled: !!opt.disabled, 'aria-label': opt.aria || null, onclick: (e) => { if (opt.disabled) return; Sfx.play('sfx_menu_select'); onClick?.(e); } }, [opt.ico ? el('img', { src: opt.ico, alt: '', draggable: false }) : null, el('span', label)]);
const paper = (kids) => el('div.idg-k-paper.idg-mx-paper', { role: 'note' }, [].concat(kids));
/* 규칙표 ⑲ 줄 : [딱지] 제목 + 작은 설명 · 오른쪽 값/단추 */
const row = (tag, title, sub, right) => el('div.idg-mx-row', null, [tag ? el('span.lv', tag) : null, el('span.t', null, [el('b', title), sub ? el('small', sub) : null]), right || null]);
const todayKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

export function showMulti(onStart, rejoinCode = null) {
  Sfx.play('sfx_menu_select');
  const body = el('div.idg-mx');
  let code = null, off = null, started = false;
  let mode = 'coop';   // 왼쪽 메뉴에서 고른 것 : coop = 같이 깨기 · pvp = 드래곤 대결
  /* 기다림 · 실패 안내 (한가운데 종이 + 보라 [처음으로]) */
  const msg = (t, back = true) => body.replaceChildren(el('div.idg-mx-msg', null, [paper(t), back ? btn('p', '처음으로', menu) : null]));

  Room.prewarm?.();   /* 미리 서버에 붙여 둔다 — 번호 넣고 «들어가기» 때 렉 줄이기 */
  function menu() {
    off?.(); off = null; code = null;
    const g = G.idg(), stageNo = Math.min(100, (g.cleared || 0) + 1);
    const pvpOpen = (g.cleared || 0) >= PVP_OPEN;
    const st = G.stageLabel(stageNo);
    const pick = (m) => { if (m === mode) return; Sfx.play('sfx_menu_move'); mode = m; menu(); };
    const rb = (m, label, ico, locked) => el(`button.idg-mx-rb${mode === m ? '.on' : ''}${locked ? '.lock' : ''}`, { type: 'button', 'aria-pressed': mode === m ? 'true' : 'false', onclick: () => pick(m) }, [
      el('img', { src: ico, alt: '', draggable: false }), el('span', label), locked ? el('img.lk', { src: LOCK, alt: '잠김', draggable: false }) : null,
    ]);
    const coop = mode === 'coop';
    /* 왼쪽 = 모드 메뉴 + 안내 + 빠른 시작 */
    const rail = el('div.idg-mx-rail', null, [
      rb('coop', '같이 깨기', `${AI}lobby/ico_coop.png`),
      rb('pvp', '드래곤 대결', `${AI}result/ico_fight.webp`, !pvpOpen),
      el('div.idg-mx-grow'),
      coop ? paper(['둘이 함께 ', el('b', st), ' 에', el('br'), '도전해요'])
        : pvpOpen ? paper(['친구 드래곤과', el('br'), '한 판 겨뤄요'])
          : paper([el('b', G.stageLabel(PVP_OPEN)), ' 을 깨면', el('br'), '열려요']),
      /* 빠른 시작 (대표님 «다른 게임처럼 방 번호 없이 바로») : 열린 방이 있으면 들어가고, 없으면 만들어 기다린다 */
      coop ? btn('r', '빠른 시작', () => quick(false, stageNo), { cls: 'big', aria: '빠른 시작 · 같이 깨기' })
        : pvpOpen ? btn('r', '빠른 시작', () => quick(true, 0), { cls: 'big', aria: '빠른 시작 · 드래곤 대결' })
          : btn('x0', '빠른 시작', null, { cls: 'big', disabled: true, ico: LOCK }),
    ]);
    /* 오른쪽 = 고른 모드의 내용 */
    const pvpN = g.pvp?.day === todayKst() ? g.pvp.n : 0;
    const lines = coop
      ? [
        row(st, '도전할 판', '내가 깬 다음 판 · 방장이 고를 수 있어요'),
        row(null, '드래곤', '각자 자기 덱에서 나가요'),
        row(null, '같이 깨기 방 만들기', '방 번호를 친구에게 알려 줘요', btn('p', '방 만들기', () => make(stageNo))),
      ]
      : pvpOpen
        ? [
          row(null, '오늘 보상', `하루 ${PVP_DAY}판까지 보상을 받아요`, el('span.val', `${Math.max(0, PVP_DAY - pvpN)}/${PVP_DAY}판`)),
          row(null, '내 전적', '드래곤 대결 이긴 판 · 진 판', el('span.val', `${g.pvp?.w || 0}승 ${g.pvp?.l || 0}패`)),
          row(null, '드래곤 대결 방 만들기', '방 번호를 친구에게 알려 줘요', btn('p', '방 만들기', () => make(0))),
        ]
        : [row(null, '드래곤 대결', `${G.stageLabel(PVP_OPEN)} 을 깨면 열려요`, btn('x0', '잠김', null, { disabled: true, ico: LOCK }))];
    const input = el('input.idg-mx-code', { type: 'text', inputmode: 'numeric', maxlength: 6, placeholder: '방 번호 6자리', 'aria-label': '방 번호 6자리' });
    const join = async () => {
      const c = input.value.trim(); if (!c) return;
      enterFullscreen();
      msg('들어가는 중…', false);
      const r = await Room.joinRoom(c, null, Room.GAME_IDRAGON).catch(() => 'error');
      if (r === 'ok') wait(c);
      else msg(r === 'notfound' ? '그런 방이 없어요. 번호를 다시 확인해요.' : r === 'full' ? '방이 꽉 찼어요.' : r === 'wronggame' ? '다른 게임 방이에요.' : '들어가지 못했어요 (서버 설정 전일 수 있어요).');
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
    const main = el('div.idg-mx-main', null, [
      el('div.idg-mx-sec', coop ? '같이 깨기' : '드래곤 대결'),
      el('div.idg-mx-list', null, lines),
      el('div.idg-mx-grow'),
      el('div.idg-mx-sec', '친구 방에 들어가기'),
      el('div.idg-mx-join', null, [el('label.idg-mx-inp', null, [el('img', { src: `${AI}lobby/ico_key.png`, alt: '', draggable: false }), input]), btn('p', '들어가기', join)]),
    ]);
    body.replaceChildren(rail, main);
  }

  async function quick(pvp, n) {
    enterFullscreen();
    msg('같이 할 친구를 찾는 중…', false);
    const accept = (r) => (pvp ? (r.idgStage | 0) === 0 : (r.idgStage | 0) > 0);
    const r = await Room.quickJoin({ game: Room.GAME_IDRAGON, maxPlayers: 2, accept, idgStage: n }).catch(() => null);
    if (!r) { msg('지금은 연결이 어려워요. 잠시 뒤 다시 해 봐요!'); return; }
    wait(r);
  }
  async function make(n) {
    enterFullscreen();
    msg('방을 만드는 중…', false);
    const r = await Room.createRoom({ game: Room.GAME_IDRAGON, maxPlayers: 2, isPrivate: false, idgStage: n }).catch(() => null);
    if (!r) { msg('아직 같이 하기를 준비 중이에요 (서버 설정 전). 조금만 기다려 주세요!'); return; }
    wait(r);
  }

  function wait(c) {
    code = c;
    let sentLd = false;
    const who = el('div.idg-mx-list.idg-mx-who'), startB = el('div.idg-mx-start'), stageRow = el('div.idg-mx-stage');
    /* 대기실 : 왼쪽 = 방 번호 · 안내 · 시작 / 오른쪽 = 스테이지 · 들어온 사람 */
    body.replaceChildren(
      el('div.idg-mx-rail', null, [
        el('div.idg-mx-room', null, [el('span', '방 번호'), el('b', String(c))]),
        paper(['친구에게', el('br'), '방 번호를 알려 주세요']),
        el('div.idg-mx-grow'),
        startB,
      ]),
      el('div.idg-mx-main', null, [el('div.idg-mx-sec', '스테이지'), stageRow, el('div.idg-mx-sec', '들어온 친구'), who]),
    );
    startB.replaceChildren(paper('방에 붙는 중…'));
    off = Room.subscribeRoom(c, async (room) => {
      if (!room || started) return;
      const uids = seatsOf(room);
      if (room.idgStage === 0 && (G.idg().cleared || 0) < PVP_OPEN) { off?.(); Room.leaveRoom(c).catch?.(() => {}); msg(`드래곤 대결은 ${G.stageLabel(PVP_OPEN)} 을 깨면 할 수 있어요.`); return; }
      /* 내 편성을 한 번 올린다 (방 스테이지 기준 — 둘이 같은 판) */
      if (!sentLd) { sentLd = true; Room.publishIdg(c, { ld: loadToLd(makeLoads(stageByNo(room.idgStage || PVP_OPEN), G.idg()).loads[0], G.idg().look) }); }   // 대결(0)은 덱 6칸 판 기준
      who.replaceChildren(...uids.map((u, i) => {
        const t = titleOf(decodeLook(ldToLoad(room.players[u]?.ld || '')?.look || '').title);
        return row(String(i + 1), room.players[u]?.nickname || '친구', t ? t.name : null, u === room.hostUid ? el('span.val.host', '방장') : null);
      }), ...(uids.length < 2 ? [row('2', '빈 자리', '친구를 기다리는 중…')] : []));
      /* O. 방장이 스테이지 고르기 (같이 깨기 · 내가 깬 것 + 바로 다음까지) */
      const st = room.idgStage || 0, mine = Math.min(100, (G.idg().cleared || 0) + 1);
      const canPick = st > 0 && room.hostUid === currentUser()?.uid && uids.length < 2;
      stageRow.replaceChildren(st > 0
        ? row(G.stageLabel(st), `스테이지 ${G.stageLabel(st)}`, canPick ? '방장이 판을 고를 수 있어요' : '둘이 같은 판에 나가요', canPick ? el('span.idg-mx-arw', null, [
          btn('p', '‹', () => Room.setRoomIdgStage(c, Math.max(1, st - 1)), { aria: '앞 판' }), btn('p', '›', () => Room.setRoomIdgStage(c, Math.min(mine, st + 1)), { aria: '다음 판' }),
        ]) : null)
        : row(null, '용 대결', '친구 드래곤과 한 판 겨뤄요'));
      const me = uids.indexOf(currentUser()?.uid ?? '');
      const host = room.hostUid === currentUser()?.uid;   // 시작 단추는 방장 화면에만
      const loads = uids.map((u) => ldToLoad(room.players[u]?.ld || ''));
      const oldV = loads.some((l) => l && l.v !== NET_V);   // 한쪽이 옛 버전 (오락실은 PWA 라 실제로 생긴다)
      const allLd = loads.every(Boolean) && !oldV;
      startB.replaceChildren(uids.length >= 2 && allLd && host ? btn('r', '시작!', () => { enterFullscreen(); Room.startCountdown(c); }, { cls: 'big' }) : paper(oldV ? '게임 버전이 서로 달라요 — 둘 다 새로고침 해 주세요!' : uids.length < 2 ? '친구를 기다리는 중…' : '방장이 시작하기를 기다려요'));
      if ((room.state === 'countdown' || room.state === 'playing') && allLd) {
        started = true; off?.(); close();
        const ms = room.startAt ? await Room.msUntilStart(room.startAt) : 0;
        setTimeout(() => onStart({ code: c, seed: room.seed, stageNo: room.idgStage ?? 1, uids, seat: me, loads }), Math.max(0, Math.min(5000, ms)));
      }
    });
  }

  if (rejoinCode) { Room.resetRoom(rejoinCode).catch?.(() => {}); wait(rejoinCode); } else menu();   // 한 판 더 : 같은 방을 대기 상태로 되돌리고 대기실로
  const box = el('div.dialog.idg-nest.idg-multi.idg-xw', { onclick: (e) => e.stopPropagation() }, [xTitle('멀티게임', () => close()), body]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const closeO = presentOverlay(overlay);
  const close = () => { off?.(); closeO(); };
}
