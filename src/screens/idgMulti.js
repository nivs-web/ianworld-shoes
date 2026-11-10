/**
 * 좀비와 드래곤 — «친구랑 같이 깨기» (3차 멀티 · 2026-11-11 · 멀티 기획 4장 · M3)
 * 방 만들기 → 방 번호를 친구에게 알려 줌 → 친구가 번호로 들어옴 → 방장이 «시작» → 카운트다운 → 둘 다 같은 판으로.
 * 오락실 방(services/multiplayer.js)을 그대로 쓴다 — game 'idragon' · 2인 · 비밀방 · idgStage.
 * ⏳ 서버 규칙 게시 전에는 방을 못 만든다 → «아직 준비 중» 안내.
 */
import { el, button, presentOverlay } from './ui.js';
import * as G from '../services/iandragonGame.js';
import * as Room from '../services/multiplayer.js';
import * as Sfx from '../audio/sfx.js';
import { seatsOf } from '../games/iandragon_game/net/roomBridge.js';
import { makeLoads, stageByNo, loadToLd, ldToLoad, PVP_OPEN, NET_V } from '../games/iandragon_game/render/battleSetup.js';
import { currentUser } from '../services/auth.js';

export function showMulti(onStart) {
  Sfx.play('sfx_menu_select');
  const body = el('div.idg-multi');
  let code = null, off = null, started = false;
  const msg = (t) => body.replaceChildren(el('p.idg-multi-msg', t), button('처음으로', menu));

  function menu() {
    off?.(); off = null; code = null;
    const g = G.idg(), stageNo = Math.min(100, (g.cleared || 0) + 1);
    const input = el('input.idg-code', { type: 'text', inputmode: 'numeric', maxlength: 6, placeholder: '방 번호' });
    body.replaceChildren(
      el('p.idg-multi-msg', `둘이 함께 ${G.stageLabel(stageNo)} 에 도전해요. 용은 각자 덱에서 나가요.`),
      button('같이 깨기 방 만들기', () => make(stageNo), { primary: true }),
      (g.cleared || 0) >= PVP_OPEN ? button('용 대결 방 만들기', () => make(0)) : el('p.idg-multi-msg', `용 대결은 ${G.stageLabel(PVP_OPEN)} 을 깨면 열려요.`),
      el('div.idg-multi-join', null, [input, button('들어가기', async () => {
        const c = input.value.trim(); if (!c) return;
        msg('들어가는 중…');
        const r = await Room.joinRoom(c, null, Room.GAME_IDRAGON).catch(() => 'error');
        if (r === 'ok') wait(c);
        else msg(r === 'notfound' ? '그런 방이 없어요. 번호를 다시 확인해요.' : r === 'full' ? '방이 꽉 찼어요.' : r === 'wronggame' ? '다른 게임 방이에요.' : '들어가지 못했어요 (서버 설정 전일 수 있어요).');
      })]),
    );
  }

  async function make(n) {
    msg('방을 만드는 중…');
    const r = await Room.createRoom({ game: Room.GAME_IDRAGON, maxPlayers: 2, isPrivate: true, idgStage: n }).catch(() => null);
    if (!r) { msg('아직 같이 하기를 준비 중이에요 (서버 설정 전). 조금만 기다려 주세요!'); return; }
    wait(r);
  }

  function wait(c) {
    code = c;
    let sentLd = false;
    const who = el('div.idg-multi-who'), startB = el('div');
    body.replaceChildren(el('div.idg-multi-code', null, [el('span', '방 번호'), el('b', String(c))]), el('p.idg-multi-msg', '친구에게 방 번호를 알려 주세요.'), who, startB);
    off = Room.subscribeRoom(c, async (room) => {
      if (!room || started) return;
      const uids = seatsOf(room);
      /* 내 편성을 한 번 올린다 (방 스테이지 기준 — 둘이 같은 판) */
      if (!sentLd) { sentLd = true; Room.publishIdg(c, { ld: loadToLd(makeLoads(stageByNo(room.idgStage || PVP_OPEN), G.idg()).loads[0]) }); }   // 대결(0)은 덱 6칸 판 기준
      who.replaceChildren(...uids.map((u, i) => el('div', `${i + 1}. ${room.players[u]?.nickname || '친구'}${u === room.hostUid ? ' (방장)' : ''}`)));
      const me = uids.indexOf(currentUser()?.uid ?? '');
      const host = room.hostUid === currentUser()?.uid;   // 시작 단추는 방장 화면에만
      const loads = uids.map((u) => ldToLoad(room.players[u]?.ld || ''));
      const oldV = loads.some((l) => l && l.v !== NET_V);   // 한쪽이 옛 버전 (오락실은 PWA 라 실제로 생긴다)
      const allLd = loads.every(Boolean) && !oldV;
      startB.replaceChildren(uids.length >= 2 && allLd && host ? button('시작!', () => Room.startCountdown(c), { primary: true }) : el('p.idg-multi-msg', oldV ? '게임 버전이 서로 달라요 — 둘 다 새로고침 해 주세요!' : uids.length < 2 ? '친구를 기다리는 중…' : '방장이 시작하기를 기다려요'));
      if ((room.state === 'countdown' || room.state === 'playing') && allLd) {
        started = true; off?.(); close();
        const ms = room.startAt ? await Room.msUntilStart(room.startAt) : 0;
        setTimeout(() => onStart({ code: c, seed: room.seed, stageNo: room.idgStage ?? 1, uids, seat: me, loads }), Math.max(0, Math.min(5000, ms)));
      }
    });
  }

  menu();
  const box = el('div.dialog.idg-nest', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', '친구랑 같이 깨기'), body, button('닫기', () => close())]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const closeO = presentOverlay(overlay);
  const close = () => { off?.(); closeO(); };
}
