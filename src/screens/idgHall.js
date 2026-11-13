/**
 * 좀비와 드래곤 — «명예의 전당» (2026-11-11 · 11/13 1 ~ 10위 한 화면)
 * 로비 위에 뜨는 창 — 탭 다섯 : 정복왕 · 어려움 · 같이 깨기 · 드래곤 대결 · 주간 습격, 각각 1~50위.
 *
 * 11/13 줄 설계 (docs IDG_DIFFICULTY_PLAN §D-2) :
 *   목록 = 줄 높이 clamp(44px, (화면 높이 − 나머지) ÷ 10, 56px) × 정확히 10줄 → 처음 화면은 늘 1 ~ 10위(스크롤 없이).
 *   11위부터는 같은 목록을 스크롤(10줄씩 딱 멈추는 스냅) · 50위까지. 내 줄은 목록 아래에 늘 고정(순위 밖이면 «순위 밖 · 내 기록»).
 *   가로 화면은 한 쪽 = 1 ~ 5 / 6 ~ 10 두 기둥 + 내 줄 아래.
 *   줄 칸 : 순위(1 ~ 3위 왕관 + 숫자) · 얼굴 36px + 2px 테두리 · 이름 14px 굵게 + 칭호 11px · 작은 레벨 배지 «Lv.123» · 기록(아이콘 + 숫자).
 *   «나머지 높이»(제목 · 탭 · 설명 · 내 줄 · 창 테)는 처음 열 때 · 화면이 바뀔 때 재서 --hc 로 준다(못 재면 184px).
 * 줄 모양은 다른 명예의 전당과 같은 이름(`rank-*`)이라 같은 CSS(키트 줄 그림 row2)를 탄다 — 디자인 양식은 그대로, 높이 · 배치만.
 *
 * ★ 초고수는 전당 어디에도 없다(탭 없음 · 순위 문서에 값 없음). 다만 초고수로 딴 칭호가 남의 줄에 보일 수 있어
 *   보는 사람이 보통 10-10 을 못 깼으면 그 칭호 글씨만 숨긴다(그림 · 테두리는 그대로) — HIDDEN_TITLES.
 * ⏳ 서버 규칙(`idgPlayers` — docs/FIREBASE_RULES.md)이 게시되기 전에는 읽기가 거부된다 — 그때는 «준비 중»과 내 기록만 보여 준다.
 */
import S from '../config/strings.ko.js';
import { decodeLook, titleOf } from '../games/iandragon_game/data/looks.js';
import { headCanvas } from './idgDressed.js';
import { el, segmented, presentOverlay, toast } from './ui.js';
import { crownImg } from './crown.js';
import { moreDown } from './idgMore.js';   /* «아래로 더 있음» 화살표 공용 규칙 (11/13) */
import * as Sfx from '../audio/sfx.js';
import { get as getProfile } from '../services/profile.js';
import { currentUser } from '../services/auth.js';
import * as G from '../services/iandragonGame.js';
import { idgDoc, fetchIdgBoard, fetchIdgRaidPlace, syncIdgPlayer, lvOf, PVP_RATE_MIN } from '../services/idgRank.js';
import { weekKey } from '../games/iandragon_game/render/battleSetup.js';
const WK = weekKey();

/** 보통 10-10 을 못 깬 사람에게 글씨를 숨기는 초고수 칭호 — 이 한 곳에서만 정한다.
 *  ① looks.js 칭호에 vis(보는 계정 조건 · D 의 SEES_MASTER)가 있으면 그것을 따르고 ② 아래 id · 머리글자(mw_ = 월드별 초고수 전설)도 숨긴다 */
export const HIDDEN_TITLES = new Set(['master', 'master_top', 'master_legend']);
const HIDDEN_TITLE_RE = /^(master|mw_)/;
/** 초고수를 아는 사람인가 = 보통 10-10 을 깼나 (§D-3) */
const knowsMaster = () => (G.idg().cleared || 0) >= 100;

/** 줄 얼굴 : 대장 용 머리 + 모자 · 테두리 (꾸미기 글자) — 그림이 없으면 그 겹만 숨김 */
const AIP = '/assets/iandragon_game/ai/';
function face(look) {
  /* 머리 + 모자를 전투와 같은 자리표로 한 장에 (idgDressed headCanvas) — 칸 가운데 · 모자가 머리 위에 붙는다 (대표님 11/11) */
  const L = decodeLook(look || ''), hide = (e) => { e.target.style.display = 'none'; };
  const box = el('span.idg-hall-face', { 'data-look': look || null, class: L.frame ? 'framed' : '' }, []);
  headCanvas('novart', look).then((c) => { c.className = 'f-head'; box.prepend(c); }).catch(() => box.prepend(el('img.f-head', { src: AIP + 'novart/head.png', alt: '', onerror: hide })));
  if (L.frame) box.append(el('img.f-frame', { src: `${AIP}meta/frame_${L.frame}.png`, alt: '', onerror: hide }));
  return box;
}

const TABS = [
  { value: 'conquer', label: '정복왕' },
  { value: 'hard', label: '어려움' },
  { value: 'coop', label: '같이 깨기' },
  { value: 'pvp', label: '드래곤 대결' },
  { value: 'raid', label: '주간 습격' },
];
const NOTE = {
  conquer: '깬 스테이지가 많은 순서 (같으면 별이 많은 쪽)',
  hard: '붉은 별을 많이 모은 순서',
  coop: '친구와 함께 이긴 판이 많은 순서',
  pvp: `이긴 판이 많은 순서 (${PVP_RATE_MIN}판부터 승률이 보여요)`,
  raid: `${WK.key} 이번 주 버틴 웨이브 순서 (월요일에 새로 시작)`,
};

/** 칭호 id → 한글 이름. 칭호 표가 생기면 여기에 채운다 (표에 없는 id 는 한글일 때만 그대로 보인다) */
export const TITLE_KO = {};
const titleText = (id) => {
  if (!id) return '';
  const def = titleOf(id);
  if (!knowsMaster() && (HIDDEN_TITLES.has(id) || HIDDEN_TITLE_RE.test(id))) return '';
  if (typeof def?.vis === 'function' && !def.vis(G.idg())) return '';
  const t = TITLE_KO[id] || def?.name || (/[가-힣]/.test(id) ? id : '');
  return /초고수/.test(t) && !knowsMaster() ? '' : t;   // id 가 바뀌어도 «초고수» 글자는 새지 않게
};
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const stageLabel = (no) => G.stageLabel(no);

/* 기록 아이콘 (재화 · 기록 = 아이콘 + 숫자) — 붉은 별은 스테이지 창과 같은 색 돌림(.red) */
const IC = {
  castle: `${AIP}result/ico_castle.webp`, star: `${AIP}result/star_on.webp`, stage: `${AIP}lobby/ico_stages.png`,
  coop: `${AIP}lobby/ico_coop.png`, pvp: `${AIP}result/ico_fight.webp`, raid: `${AIP}lobby/ico_raid.png`,
};
const ico = (k, alt, red) => el('img.idg-hall-ico' + (red ? '.red' : ''), { src: IC[k], alt, draggable: 'false' });

/** 순위표 한 줄의 기록 칸 — [큰 줄, 작은 줄] (각각 노드 배열 · 작은 줄은 없을 수 있다) */
function valueOf(kind, r) {
  switch (kind) {
    case 'conquer': return [[ico('castle', '클리어'), r.cleared ? stageLabel(r.cleared) : '-'], [ico('star', '별'), fmt(r.stars)]];
    case 'hard': return [[ico('star', '붉은 별', true), fmt(r.hard)], r.cleared ? [ico('stage', '스테이지'), stageLabel(r.cleared)] : null];
    case 'coop': return [[ico('coop', '같이 깨기'), `${fmt(r.coop)}승`], null];
    case 'raid': return Math.floor((r.raid || 0) / 100) === WK.idx ? [[ico('raid', '주간 습격'), String((r.raid || 0) % 100)], ['웨이브']] : [['-'], ['이번 주 기록 없음']];
    default: return [[ico('pvp', '드래곤 대결'), `${fmt(r.pvpW)}승`], [`${fmt(r.pvpL)}패` + (r.rate == null ? '' : ` · 승률 ${r.rate}%`)]];
  }
}

/** 작은 레벨 배지 — 색은 보조 D 의 .idg-lv[data-tier="0"~"9"] (idg-lvbadge.css · tier = floor(lv / 100)) */
const lvBadge = (lv) => el('span.idg-lv.idg-hall-lv', { 'data-tier': String(Math.min(9, Math.floor(lv / 100))) }, `Lv.${lv}`);

export function showHall(startKind = 'conquer') {   // startKind : 처음 열 탭 (습격 결과 창에서 'raid')
  Sfx.play('sfx_menu_select');
  ensureCss();
  const myUid = currentUser()?.uid;
  let kind = TABS.some((t) => t.value === startKind) ? startKind : 'conquer';
  let state = { loading: true, rows: [], err: null };
  let live = true, reqId = 0, synced = false;

  const segHost = el('div.idg-hall-seg');
  const note = el('div.idg-hall-note');
  const list = el('div.idg-hall-list');
  const more = el('i.idg-dlg-more', { 'aria-hidden': 'true' });
  const listWrap = el('div.idg-hall-listwrap', null, [list, more]);
  const mineBox = el('div.idg-hall-minebox');

  /** 한 줄 — rank 가 없으면(내 줄 · 순위 밖) «-» */
  function row(r, rank, extra = {}) {
    const [big, small] = valueOf(kind, r);
    const t = extra.sub ?? titleText(r.title);
    const top = rank && rank <= 3 ? rank : 0;
    return el('div.rank-row.idg-hall-row', {
      class: [r.uid === myUid || extra.me ? 'me' : '', top ? `crowned c${top}` : '', extra.cls || ''].filter(Boolean).join(' '),
    }, [
      el('div.rank-place', null, [top ? crownImg(top) : null, el('span.rank-no', rank ? String(rank) : '-')].filter(Boolean)),
      face(r.look),
      el('div.idg-hall-who', null, [el('div.rank-name', r.nickname || '???'), t ? el('div.idg-hall-title', t) : null].filter(Boolean)),
      lvBadge(lvOf(r)),
      el('div.idg-hall-val', null, [el('b', null, big), small ? el('span', null, small) : null].filter(Boolean)),
    ]);
  }

  function mine() {
    const p = getProfile();
    const d = idgDoc(p);
    const place = state.rows.findIndex((r) => r.uid === myUid);
    const r = { ...d, uid: myUid, nickname: p.nickname || '나', rate: d.pvpW + d.pvpL >= PVP_RATE_MIN ? Math.round((d.pvpW / (d.pvpW + d.pvpL)) * 100) : null };
    mineBox.replaceChildren(row(r, place >= 0 ? place + 1 : 0, { me: true, cls: 'idg-hall-myrow', sub: place >= 0 ? undefined : '순위 밖 · 내 기록' }));
  }

  function draw() {
    note.textContent = NOTE[kind];
    let body;
    if (state.loading) body = el('div.hint', S.loading);
    else if (state.err === 'auth') body = el('div.hint.bad', S.rankNeedLogin);
    else if (state.err === 'rules') body = el('div.hint', '명예의 전당을 여는 중이에요. 곧 열려요! 내 기록은 계속 쌓이고 있어요.');
    else if (state.err) body = el('div.hint.bad', S.rankLoadFailed);
    else if (!state.rows.length) body = el('div.hint', '아직 아무도 없어요. 첫 번째 주인공이 되어 보세요!');
    if (body) list.replaceChildren(el('div.idg-hall-page.msg', null, [body]));
    else {
      /* 10줄 = 한 쪽 (스냅 단위 · 가로 화면에선 한 쪽이 5 + 5 두 기둥) */
      const pages = [];
      for (let i = 0; i < state.rows.length; i += 10) pages.push(el('div.idg-hall-page', null, state.rows.slice(i, i + 10).map((r, k) => row(r, i + k + 1))));
      list.replaceChildren(...pages);
    }
    list.scrollTop = 0;
    mine();
    requestAnimationFrame(updMore);
  }

  /* 11위 아래가 있으면 금 화살표 (키트 .idg-dlg-more 그림 · 맨 아래까지 내리면 숨김) */
  function updMore() {
    const over = list.scrollHeight - list.clientHeight;
    listWrap.classList.toggle('more-down', moreDown(list));
  }
  list.addEventListener('scroll', updMore, { passive: true });

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
      if (r.ok && kind === 'raid') r.rows = r.rows.filter((x) => Math.floor((x.raid || 0) / 100) === WK.idx);   // 이번 주만
      state = r.ok ? { loading: false, rows: r.rows, err: null } : { loading: false, rows: [], err: r.reason || 'error' };
      draw();
    }).catch(() => {
      if (!live || my !== reqId) return;
      state = { loading: false, rows: [], err: 'error' };
      draw();
    });
  }

  /* 닫기 = 머리의 작은 X (키트 단추) — 아래 넓은 «닫기» 줄을 빼서 10줄 자리를 만든다 (§D-2 머리 = 제목 · 닫기) */
  const closeBtn = el('button.idg-k-close.idg-hall-x', { type: 'button', 'aria-label': '닫기', title: '닫기', onclick: () => { Sfx.play('sfx_menu_move'); close(); } });
  const box = el('div.dialog.idg-hall.idg-hall10', { onclick: (e) => e.stopPropagation() }, [
    el('div.idg-how-title', '명예의 전당'),
    segHost, note, listWrap, mineBox,
    closeBtn,
  ]);
  const overlay = el('div.dialog-overlay.idg-hall-ov', { onclick: () => close() }, [box]);

  /* 줄 높이 : 나머지(제목 · 탭 · 설명 · 내 줄 · 창 테 · 바깥 여백) 높이를 재서 --hc 로 — 목록이 화면에 정확히 10줄(가로 5 + 5) */
  function fit() {
    if (!live || !box.isConnected) return;
    const ov = getComputedStyle(overlay), pad = (parseFloat(ov.paddingTop) || 0) + (parseFloat(ov.paddingBottom) || 0);
    const hc = Math.ceil(box.getBoundingClientRect().height - list.getBoundingClientRect().height + pad);
    if (hc > 60 && hc < 600) box.style.setProperty('--hc', `${hc}px`);
    updMore();
  }
  const onResize = () => requestAnimationFrame(fit);
  addEventListener('resize', onResize);
  const close = presentOverlay(overlay, () => { live = false; removeEventListener('resize', onResize); });
  drawTabs();
  load();
  requestAnimationFrame(() => requestAnimationFrame(fit));
  setTimeout(fit, 400);   // 창 틀(idgFrame) · 글꼴이 늦게 붙는 경우
}

/**
 * 지난주 주간 습격 1 ~ 3위 → 금 · 은 · 나무 테두리 (META 5장 · 한 주에 한 번 · 서버 순위를 보고 기기에서 준다)
 * 11/13 버그 2 : 상위 50명 목록이 아니라 «나보다 높은 사람 수»를 서버에서 센다(fetchIdgRaidPlace) → 51위 아래도 자기 자리를 안다.
 * 같은 웨이브는 같은 자리(공동 순위 — 공동 1위면 둘 다 금). 10위 안이면 칭호 «이번 주 용사»(weekTop).
 * ※ 로비(IanDragonGameLobby.js)의 옛 checkRaidFrame 대신 이것을 불러야 고쳐진다 — 로비는 보조 D 담당이라 거기서 바꾼다.
 */
export async function checkRaidFrame(onGot) {
  const prev = weekKey(Date.now() - 7 * 864e5), g = G.idg(), uid = currentUser()?.uid;
  if (!uid || g.frameW >= prev.idx) return;
  const r = await fetchIdgRaidPlace(prev.idx).catch(() => null);
  if (!r?.ok) return;   // 못 셌으면 다음에 다시 (frameW 를 안 남긴다)
  const place = r.place;
  const frame = ['gold', 'silver', 'wood'][place];
  G.saveIdg({ frameW: prev.idx, ...(place >= 0 && place < 10 ? { weekTop: prev.idx } : {}), ...(frame ? { owned: [...new Set([...G.idg().owned, `frame:${frame}`])] } : {}) });
  if (frame) { Sfx.play('sfx_purchase'); toast(`지난주 주간 습격 ${place + 1}위! ${frame === 'gold' ? '금' : frame === 'silver' ? '은' : '나무'} 테두리를 받았어요`, 3600); onGot?.(); }
}

/* 창 안에서만 쓰는 모양 — 줄 그림 · 내 줄 색 · 탭 단추는 공용 `rank-*` · 키트(idg-subwin.css) CSS 를 그대로 탄다.
 * 11/13 : 높이 · 배치만 새로 (선택자 앞 .dialog.idg-hall.idg-hall10 = 키트 규칙보다 뒤 · 같은 무게라 이긴다).
 * 글씨는 1px 8방향 딱딱한 외곽선만(흐린 그림자 · 글로우 없음). 레벨 배지 색은 :where() 로 무게 0 — D 의 .idg-lv[data-tier] 가 이긴다. */
const H = '.dialog.idg-hall.idg-hall10';
const OL = (c) => `1px 0 ${c}, -1px 0 ${c}, 0 1px ${c}, 0 -1px ${c}, 1px 1px ${c}, -1px 1px ${c}, 1px -1px ${c}, -1px -1px ${c}`;
const CSS = `
.dialog-overlay.idg-hall-ov { padding: max(6px, env(safe-area-inset-top)) 8px max(6px, env(safe-area-inset-bottom)); }
${H} { --rg: 2px; --rh: clamp(44px, calc((100dvh - var(--hc, 184px) - 9 * var(--rg)) / 10), 56px);
  position: relative; width: min(100%, 440px); max-width: min(100%, 440px); max-height: calc(100dvh - 12px); gap: 4px;
  border-width: 18px 18px; border-image-width: 18px 18px; padding: 0 4px 2px; overflow: hidden; }
${H} > .idg-how-title { margin: 0 auto 2px; padding-top: 7px; padding-bottom: 8px; font-size: 16px; line-height: 1.1; }
${H} > .idg-hall-x { position: absolute; top: 2px; right: 0; width: 34px; height: 34px; font-size: 0; z-index: 8; }
${H} > .idg-dlg-body { overflow: hidden; gap: 4px; padding: 0; }
${H} .idg-hall-seg .seg, ${H} .seg { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.05fr) minmax(0, 1.25fr) minmax(0, 1.05fr); gap: 3px; }   /* «드래곤 대결»이 가장 길다 */
${H} .seg .pbtn { min-height: 34px; height: 34px; padding: 0 1px; font-size: 13px; letter-spacing: -.5px; white-space: nowrap; }
${H} .idg-hall-note { margin: 0; font-size: 11px; line-height: 16px; height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; color: #ffd98a; text-shadow: ${OL('#1a0c38')}; }
${H} .idg-hall-listwrap { position: relative; flex: none; display: flex; flex-direction: column; }
${H} .idg-hall-list { display: block; flex: none; height: calc(10 * var(--rh) + 9 * var(--rg)); min-height: 0; max-height: none; overflow-y: auto; overflow-x: hidden;
  scroll-snap-type: y mandatory; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
${H} .idg-hall-list::-webkit-scrollbar { display: none; }
${H} .idg-hall-page { display: grid; grid-template-columns: minmax(0, 1fr); grid-auto-rows: var(--rh); gap: var(--rg); height: calc(10 * var(--rh) + 9 * var(--rg)); margin-bottom: var(--rg);
  scroll-snap-align: start; scroll-snap-stop: always; align-content: start; }
${H} .idg-hall-page.msg { display: flex; align-items: center; justify-content: center; }
${H} .idg-hall-listwrap > .idg-dlg-more { align-self: center; }
${H} .idg-hall-row, ${H} .idg-hall-myrow { position: relative; display: flex; flex-direction: row; align-items: center; gap: 5px; box-sizing: border-box; height: var(--rh); min-height: 0; margin: 0; padding: 0 4px 0 2px; overflow: hidden; cursor: default; }
${H} .idg-hall-row.crowned::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: var(--tint); box-shadow: inset 2px 0 0 var(--band); }
${H} .idg-hall-row.c1 { --tint: rgba(242, 178, 51, .16); --band: #f2b233; }
${H} .idg-hall-row.c2 { --tint: rgba(201, 210, 220, .13); --band: #c9d2dc; }
${H} .idg-hall-row.c3 { --tint: rgba(201, 123, 60, .15); --band: #c97b3c; }
${H} .idg-hall-row > * { position: relative; }
${H} .rank-place { flex: 0 0 30px; width: 30px; height: auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; }
${H} .rank-place .crown { width: 20px; height: auto; margin: 0 0 -1px; image-rendering: pixelated; }
${H} .rank-no { font-size: 16px; line-height: 17px; font-weight: 900; color: #fff; text-shadow: ${OL('#1a0c38')}; }
${H} .crowned .rank-no { font-size: 13px; line-height: 14px; }
${H} .c1 .rank-no { color: #ffd45a; } ${H} .c2 .rank-no { color: #e4eaf0; } ${H} .c3 .rank-no { color: #f0a46a; }
${H} .idg-hall-face { flex: 0 0 40px; width: 40px; height: 40px; box-sizing: border-box; display: grid; place-items: center; position: relative; overflow: hidden; border: 2px solid #1a0c38; background: #2a1a4a; }
${H} .idg-hall-face.framed { border-color: transparent; background: none; overflow: visible; }
${H} .idg-hall-face canvas.f-head, ${H} .idg-hall-face img.f-head { width: 36px; height: 36px; margin: 0; position: static; transform: none; object-fit: contain; image-rendering: pixelated; }
${H} .idg-hall-face .f-frame { position: absolute; inset: -2px; width: 40px; height: 40px; transform: none; image-rendering: pixelated; }
${H} .idg-hall-who { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 1px; }
${H} .idg-hall-who .rank-name { font-size: 14px; line-height: 17px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: ${OL('#1a0c38')}; }
${H} .idg-hall-title { font-size: 11px; line-height: 13px; font-weight: 700; color: #ffd84a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: ${OL('#1a0c38')}; }
${H} .idg-hall-lv { flex: none; min-width: 40px; height: 18px; box-sizing: border-box; padding: 0 3px; display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; line-height: 1; font-weight: 900; letter-spacing: 0; white-space: nowrap; border-width: 2px; border-style: solid; border-radius: 0; text-shadow: ${OL('#1a0c38')}; }
:where(.idg-hall-lv) { color: #fff3c4; background: #5a3a12; border-color: #d9a441; }
${H} .idg-hall-val { flex: 0 0 auto; width: 92px; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 1px; white-space: nowrap; text-shadow: ${OL('#1a0c38')}; }
${H} .idg-hall-val b, ${H} .idg-hall-val span { display: inline-flex; align-items: center; gap: 3px; }
${H} .idg-hall-val b { font-size: 14px; line-height: 17px; font-weight: 900; color: #fff; }
${H} .idg-hall-val span { font-size: 11px; line-height: 13px; font-weight: 700; color: #e6dcff; }
${H} .idg-hall-row.c1 .idg-hall-val b { color: #ffd45a; } ${H} .idg-hall-row.c2 .idg-hall-val b { color: #e4eaf0; } ${H} .idg-hall-row.c3 .idg-hall-val b { color: #f0a46a; }
${H} .idg-hall-ico { height: 15px; width: auto; flex: none; image-rendering: pixelated; }
${H} .idg-hall-val span .idg-hall-ico { height: 12px; }
${H} .idg-hall-ico.red { filter: hue-rotate(-42deg) saturate(1.5); }
${H} .idg-hall-minebox { flex: none; }
${H} .idg-hall-myrow { height: 56px; }
${H} .hint { padding: 12px; }
@media (max-width: 380px) {
  .dialog-overlay.idg-hall-ov { padding-left: 4px; padding-right: 4px; }
  ${H} { border-width: 18px 14px; border-image-width: 18px 14px; padding: 0 2px 2px; }
  ${H} .seg .pbtn { font-size: 12px; letter-spacing: -.8px; }
  ${H} .idg-hall-row, ${H} .idg-hall-myrow { gap: 4px; }
  ${H} .rank-place { flex-basis: 26px; width: 26px; }
  ${H} .idg-hall-lv { min-width: 36px; font-size: 10px; padding: 0 2px; }
  ${H} .idg-hall-val { width: 80px; }
}
@media (max-height: 700px) and (orientation: portrait) {
  ${H} .idg-hall-note { display: none; }
  ${H} > .idg-how-title { padding-top: 5px; padding-bottom: 6px; font-size: 15px; }
  ${H} .idg-hall-myrow { height: 50px; }
}
/* 가로 : 머리 한 줄 = 제목 + 탭 + X · 한 쪽 = 1 ~ 5 / 6 ~ 10 두 기둥 · 내 줄 아래 */
@media (orientation: landscape) {
  ${H} { --rg: 2px; --rh: clamp(34px, calc((100dvh - var(--hc, 150px) - 4 * var(--rg)) / 5), 48px);
    width: min(100%, 860px); max-width: min(100%, 860px); display: grid; grid-template-columns: auto minmax(0, 1fr) 36px; column-gap: 8px; row-gap: 3px; align-items: center; border-width: 14px 18px; border-image-width: 14px 18px; }
  ${H} > .idg-dlg-body { display: contents; }
  ${H} > .idg-how-title { grid-column: 1; grid-row: 1; margin: 0; padding-top: 6px; padding-bottom: 7px; font-size: 15px; min-width: 0; }
  ${H} .idg-hall-seg { grid-column: 2; grid-row: 1; }
  ${H} > .idg-hall-x { position: static; grid-column: 3; grid-row: 1; justify-self: end; }
  ${H} .idg-hall-note { grid-column: 1 / -1; }
  ${H} .idg-hall-listwrap, ${H} .idg-hall-minebox { grid-column: 1 / -1; }
  ${H} .idg-hall-list { height: calc(5 * var(--rh) + 4 * var(--rg)); }
  ${H} .idg-hall-page { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(5, var(--rh)); grid-auto-flow: column; column-gap: 8px; height: calc(5 * var(--rh) + 4 * var(--rg)); }
  ${H} .idg-hall-myrow { height: var(--rh); max-width: calc(50% - 4px); margin: 0 auto; }
}
@media (orientation: landscape) and (max-height: 420px) { ${H} .idg-hall-note { display: none; } }
`;
function ensureCss() {
  if (typeof document === 'undefined') return;
  const old = document.getElementById('idg-hall-css');
  if (old?.dataset.v === '1113') return;
  old?.remove();
  const st = document.createElement('style');
  st.id = 'idg-hall-css';
  st.dataset.v = '1113';
  st.textContent = CSS;
  document.head.append(st);
}
