/**
 * 좀비와 드래곤 — «명예의 전당» (2026-11-11)
 * 로비 위에 뜨는 창 — 탭 넷 : 정복왕 · 어려움 · 같이 깨기 · 용 대결, 각각 1~50위.
 * 줄마다 [꾸미기 자리] 닉네임 · 칭호 · 기록. 내 줄은 강조, 1~3위는 금 · 은 · 동 (왕관 + 숫자 색).
 * 줄 모양은 다른 명예의 전당과 같은 이름(`rank-*`)이라 같은 CSS 를 탄다.
 *
 * 꾸미기 그림은 나중에 붙인다 — 줄 맨 앞 `span.idg-hall-face` 가 빈 자리다 (줄의 `look` 글자는 `data-look` 에 담아 둔다).
 * ⏳ 서버 규칙(`idgPlayers` — 초안, docs/FIREBASE_RULES.md)이 게시되기 전에는 읽기가 거부된다 — 그때는 «준비 중»과 내 기록만 보여 준다.
 */
import S from '../config/strings.ko.js';
import { el, button, segmented, presentOverlay } from './ui.js';
import { crownSlot } from './crown.js';
import * as Sfx from '../audio/sfx.js';
import { get as getProfile } from '../services/profile.js';
import { currentUser } from '../services/auth.js';
import { stageLabel } from '../services/iandragonGame.js';
import { idgDoc, fetchIdgBoard, syncIdgPlayer, PVP_RATE_MIN } from '../services/idgRank.js';

const TABS = [
  { value: 'conquer', label: '정복왕' },
  { value: 'hard', label: '어려움' },
  { value: 'coop', label: '같이 깨기' },
  { value: 'pvp', label: '용 대결' },
];
const NOTE = {
  conquer: '정복왕 — 깬 스테이지가 많은 순서 (같으면 별이 많은 쪽)',
  hard: '어려움 — 붉은 별을 많이 모은 순서',
  coop: '같이 깨기 — 친구와 함께 이긴 판이 많은 순서',
  pvp: `용 대결 — 이긴 판이 많은 순서 (${PVP_RATE_MIN}판부터 승률이 보여요)`,
};

/** 칭호 id → 한글 이름. 칭호 표가 생기면 여기에 채운다 (표에 없는 id 는 한글일 때만 그대로 보인다) */
export const TITLE_KO = {};
const titleText = (id) => TITLE_KO[id] || (/[가-힣]/.test(id || '') ? id : '');
const fmt = (n) => Number(n || 0).toLocaleString('en-US');

/** 순위표 한 줄의 기록 칸 — [큰 글씨, 작은 글씨] */
function valueOf(kind, r) {
  switch (kind) {
    case 'conquer': return [r.cleared ? `${stageLabel(r.cleared)} 클리어` : '-', `별 ${fmt(r.stars)}`];
    case 'hard': return [`붉은 별 ${fmt(r.hard)}`, `${r.cleared ? stageLabel(r.cleared) : '-'} 까지`];
    case 'coop': return [`${fmt(r.coop)}승`, ''];
    default: return [`${fmt(r.pvpW)}승 ${fmt(r.pvpL)}패`, r.rate == null ? '' : `승률 ${r.rate}%`];
  }
}

export function showHall() {
  Sfx.play('sfx_menu_select');
  ensureCss();
  const myUid = currentUser()?.uid;
  let kind = 'conquer';
  let state = { loading: true, rows: [], err: null };
  let live = true, reqId = 0, synced = false;

  const segHost = el('div.idg-hall-seg');
  const note = el('div.idg-hall-note');
  const list = el('div.idg-hall-list');
  const mineBox = el('div.idg-hall-mine');

  function row(r, i) {
    const rank = i + 1;
    const [big, small] = valueOf(kind, r);
    const t = titleText(r.title);
    return el('div.rank-row.idg-hall-row', {
      class: [r.uid === myUid ? 'me' : '', rank <= 3 ? `crowned c${rank}` : ''].filter(Boolean).join(' '),
    }, [
      el('div.rank-place', null, [crownSlot(rank), el('span.rank-no', S.rankPlace(rank))]),
      el('span.idg-hall-face', { 'data-look': r.look || null }),
      el('div.idg-hall-who', null, [el('div.rank-name', r.nickname || '???'), t ? el('div.idg-hall-title', t) : null].filter(Boolean)),
      el('div.idg-hall-val', null, [el('b', big), small ? el('span', small) : null].filter(Boolean)),
    ]);
  }

  function mine() {
    const d = idgDoc(getProfile());
    const p = getProfile();
    const [big, small] = valueOf(kind, { ...d, rate: d.pvpW + d.pvpL >= PVP_RATE_MIN ? Math.round((d.pvpW / (d.pvpW + d.pvpL)) * 100) : null });
    const place = state.rows.findIndex((r) => r.uid === myUid);
    mineBox.replaceChildren(
      el('b', `내 기록 — ${p.nickname || '나'}`),
      el('span', [big, small].filter(Boolean).join(' · ') + (place >= 0 ? ` · ${place + 1}위` : '')),
    );
  }

  function draw() {
    note.textContent = NOTE[kind];
    if (state.loading) list.replaceChildren(el('div.hint', S.loading));
    else if (state.err === 'auth') list.replaceChildren(el('div.hint.bad', S.rankNeedLogin));
    else if (state.err === 'rules') list.replaceChildren(el('div.hint', '명예의 전당을 여는 중이에요. 곧 열려요! 내 기록은 계속 쌓이고 있어요.'));
    else if (state.err) list.replaceChildren(el('div.hint.bad', S.rankLoadFailed));
    else if (!state.rows.length) list.replaceChildren(el('div.hint', '아직 아무도 없어요. 첫 번째 주인공이 되어 보세요!'));
    else list.replaceChildren(...state.rows.map(row));
    mine();
  }

  function drawTabs() {
    segHost.replaceChildren(segmented(TABS, kind, (v) => { if (v === kind) return; kind = v; drawTabs(); load(); }));
  }

  function load() {
    const my = ++reqId;
    state = { loading: true, rows: [], err: null };
    draw();
    /* 내 줄이 최신이어야 순위를 보는 의미가 있다 — 처음 한 번 먼저 올리고 읽는다 */
    const ready = synced ? Promise.resolve() : syncIdgPlayer().catch(() => false).then(() => { synced = true; });
    ready.then(() => fetchIdgBoard(kind, 50)).then((r) => {
      if (!live || my !== reqId) return;
      state = r.ok ? { loading: false, rows: r.rows, err: null } : { loading: false, rows: [], err: r.reason || 'error' };
      draw();
    }).catch(() => {
      if (!live || my !== reqId) return;
      state = { loading: false, rows: [], err: 'error' };
      draw();
    });
  }

  const box = el('div.dialog.idg-hall', { onclick: (e) => e.stopPropagation() }, [
    el('div.idg-how-title', '명예의 전당'),
    segHost, note, list, mineBox,
    button('닫기', () => close()),
  ]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay, () => { live = false; });
  drawTabs();
  load();
}

/* 창 안에서만 쓰는 모양 — 줄 · 왕관 · 내 줄 색은 공용 `rank-*` CSS 를 그대로 탄다 */
const CSS = `
.idg-hall { max-width: 420px; max-height: 88vh; display: flex; flex-direction: column; gap: 6px; }
.idg-hall-seg .seg { display: flex; gap: 4px; }
.idg-hall-seg .seg .pbtn { flex: 1 1 0; min-width: 0; padding: 6px 2px; font-size: 12px; }
.idg-hall-note { color: #ffd98a; font: 11px 'Neo둥근모', monospace; text-shadow: 0 1px 0 #1a0c38; }
.idg-hall-list { display: flex; flex-direction: column; gap: 3px; flex: 1 1 auto; min-height: 120px; max-height: 52vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.idg-hall-row { cursor: default; }
.idg-hall-face { flex: 0 0 34px; width: 34px; height: 34px; display: block; }
.idg-hall-who { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.idg-hall-title { font-size: 10px; line-height: 1.2; color: #ffc93c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.idg-hall-val { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; font-size: 11px; line-height: 1.2; color: var(--c-panel-dark); white-space: nowrap; }
.idg-hall-val b { font-size: 12px; color: var(--c-text-light); }
.idg-hall-row.c1 .idg-hall-val b { color: #f2b233; }
.idg-hall-row.c2 .idg-hall-val b { color: #c9d2dc; }
.idg-hall-row.c3 .idg-hall-val b { color: #c97b3c; }
.idg-hall-mine { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border: 2px solid var(--c-accent); background: rgba(217, 79, 43, 0.18); font-size: 12px; color: var(--c-text-light); }
@media (max-width: 360px) { .idg-hall-face { display: none; } }
`;
function ensureCss() {
  if (typeof document === 'undefined' || document.getElementById('idg-hall-css')) return;
  const st = document.createElement('style');
  st.id = 'idg-hall-css';
  st.textContent = CSS;
  document.head.append(st);
}
