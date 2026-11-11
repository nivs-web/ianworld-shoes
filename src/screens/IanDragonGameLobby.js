/**
 * S50 이안 드래곤 게임 **로비** — 세로 화면. (2026-11-10, 이안오락실 7번째 게임)
 *
 * 대표님 결정 : «로비만 세로, 게임을 실행하면 가로 모드로 바뀐다 · 세로 모드는 없다 ·
 * 신발을 찾아서 · 드래곤 스트라이커처럼 로비가 있었으면» (기획서 11.0).
 * 그래서 드래곤 · 줄넘기 로비와 같은 순서다 : 제목 / 상태창 / 버튼들 / 큰 시작 버튼 / 오락실 복귀.
 * 「모험 시작」 을 누르면 가로 게임 화면(`IanDragonGame.js`)으로 간다 — 지도 · 둥지 · 부화장 · 전투는 전부 그 안(가로).
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, presentOverlay, toast } from './ui.js';
import { get as getProfile } from '../services/profile.js';
import Portal from './Portal.js';
import { lazyScreen } from './lazyScreen.js';
import * as G from '../services/iandragonGame.js';
import { enterFullscreen } from '../core/fullscreen.js';
import { getSettings } from '../audio/audio.js';
import * as Sfx from '../audio/sfx.js';
import '../styles/iandragon-game.css';
import { soundPanel } from '../games/iandragon_game/render/soundPrefs.js';
import { showNest } from './idgNest.js';
import { showHatch } from './idgHatch.js';
import { showCodex } from './idgCodex.js';
import { dressedCanvas } from './idgDressed.js';
import { makeLoads, stageByNo } from '../games/iandragon_game/render/battleSetup.js';
import { showLab } from './idgLab.js';
import { showMulti } from './idgMulti.js';
import { showShop } from './idgShop.js';
import { showLook } from './idgLook.js';
import { showHall } from './idgHall.js';
import { TITLES, titleOf } from '../games/iandragon_game/data/looks.js';
import { fetchIdgBoard } from '../services/idgRank.js';
import { weekKey } from '../games/iandragon_game/render/battleSetup.js';
import { currentUser } from '../services/auth.js';
import { DIFF, hardOpen } from '../games/iandragon_game/render/battleSetup.js';
import { isOn } from '../services/switches.js';
import { MUST, SONGS, EDM_NOTE, EDM_MUST, EDM_SONGS } from '../games/iandragon_game/data/musicCredits.js';
import { showQuests } from './idgQuests.js';
import { claimable } from '../services/iandragonQuests.js';
import { OPEN_AT } from '../services/iandragonHatch.js';

const IanDragonGame = lazyScreen(() => import('./IanDragonGame.js'), S.idgTitle);

function showHow() {
  Sfx.play('sfx_menu_select');
  const box = el('div.dialog.idg-how', { onclick: (e) => e.stopPropagation() }, [
    el('div.idg-how-title', S.idgLobbyHow),
    el('ol.idg-how-steps', null, S.idgLobbyHowSteps.map((t) => el('li', t))),
    button('알겠어요', () => close(), { primary: true }),
    button('음악 출처', () => { close(); showCredits(); }),
  ]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}

/** 음악 출처 (겜팀장 녹음 · CC BY 3.0 곡은 게임 안 표기 필수) — «하는 법» 창 아래 단추 */
function showCredits() {
  Sfx.play('sfx_menu_select');
  const box = el('div.dialog.idg-how.idg-credits', { onclick: (e) => e.stopPropagation() }, [
    el('div.idg-how-title', '음악 출처'),
    el('p.idg-credits-small', '배경음악은 저작권이 끝난 클래식 곡의 공개 녹음입니다.'),
    ...MUST.map((t) => el('p.idg-credits-must', t)),
    el('div.idg-credits-list', null, [
      ...SONGS.map((x) => el('p', `${x.k.split(' — ')[1] || x.k} · ${x.title} — ${x.by} · ${x.perf} · ${x.lic}`)),
      /* 오케스트라 EDM 편곡 (음향 설정 «EDM») — CC-BY-SA · CC-BY 표기 의무 */
      el('p.idg-credits-h', '오케스트라 EDM 편곡'), el('p', EDM_NOTE), ...EDM_MUST.map((t) => el('p.idg-credits-must', t)), el('p', `곡 : ${EDM_SONGS}`),
    ]),
    button('닫기', () => close(), { primary: true }),
  ]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}

/** 스테이지 고르기 (B4 최소판 · 2026-11-11 야간) — 월드 1~5 × 10판 · 별 · 잠금(깬 다음 판까지만 열림) */
const WORLD_NAMES = ['달밤 초록 언덕', '부글부글 화산', '뭉게구름 하늘섬', '꽁꽁 얼음골', '덜컹덜컹 쇠 광산', '으스스 유령 묘지', '모래바람 사막', '끈적끈적 독 늪', '반짝반짝 수정 동굴', '좀비 드래곤 성'];
function showStages(onPick) {
  Sfx.play('sfx_menu_select');
  const g = G.idg(), open = Math.min(100, g.cleared + 1);
  let w = Math.min(10, Math.floor((open - 1) / 10) + 1);
  const grid = el('div.idg-stage-grid'), tabs = el('div.idg-world-tabs'), name = el('div.idg-world-name'), diffRow = el('div.idg-diff-row'), diffNote = el('div.idg-diff-note');
  const diffOn = isOn('zdOpt', 'diff');
  function draw() {
    tabs.replaceChildren(...WORLD_NAMES.map((_, i) => el('button.idg-world-tab' + (i + 1 === w ? '.on' : ''), { type: 'button', disabled: i * 10 + 1 > open, onclick: () => { w = i + 1; draw(); } }, [String(i + 1)])));
    name.textContent = `월드 ${w} · ${WORLD_NAMES[w - 1]}`;
    /* 난이도 (운영자 스위치 · 어려움은 이 월드를 다 깨야 열림) */
    const cur = G.idg().diff, hOk = hardOpen(w * 10, g);
    diffRow.replaceChildren(...(diffOn ? Object.entries(DIFF).map(([k, d]) => el('button.idg-diff-btn' + (cur === k ? '.on' : '') + '.' + k, { type: 'button', disabled: k === 'hard' && !hOk, title: k === 'hard' && !hOk ? '이 월드를 다 깨면 열려요' : '', onclick: () => { G.saveIdg({ diff: k }); draw(); } }, [d.name, ...(k === 'hard' && !hOk ? [el('span.idg-lock', '🔒')] : [])])) : []));
    diffNote.textContent = diffOn && !hOk ? `어려움(좀비 1.35배 · 붉은 별)은 월드 ${w}의 10판을 모두 깨면 열려요.` : '';   /* 대표님 «어려움은 왜 잠겨 있고 언제 풀리나» */
    const hard = diffOn && cur === 'hard' && hOk;
    grid.replaceChildren(...Array.from({ length: 10 }, (_, k) => {
      const no = (w - 1) * 10 + k + 1, st = Number((hard ? g.hardStars : g.stars)[no - 1]) || 0, locked = no > open;
      return el('button.idg-stage-btn' + (locked ? '.locked' : '') + (k === 9 ? '.boss' : ''), { type: 'button', disabled: locked, onclick: () => { close(); onPick(no); } }, [
        el('b', `${w}-${k + 1}`), el('span.idg-stage-stars' + (hard ? '.red' : ''), locked ? '🔒' : '★'.repeat(st) + '☆'.repeat(3 - st)),
      ]);
    }));
  }
  draw();
  const box = el('div.dialog.idg-stages', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', '스테이지 고르기'), tabs, name, diffRow, diffNote, grid, button('닫기', () => close())]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}

/* 로비 그림 (겜부장 보조가 제미나이로 만든다 · 파일이 없으면 그림만 숨기고 글자로) */
const UI = '/assets/iandragon_game/ui/lobby/';
const AL = '/assets/iandragon_game/ai/lobby/';   // 보조 제미나이 2차 (2026-11-11) — 메뉴 아이콘 · 판
const ICO = { stage: 'ico_stages', nest: 'ico_nest', hatch: 'ico_hatch', lab: 'ico_lab', quest: 'ico_quests', codex: 'ico_codex', how: 'ico_how', coop: 'ico_coop', raid: 'ico_raid', more: 'ico_more', sound: 'ico_sound', music: 'ico_music' };
const hideBad = (e) => { e.target.style.display = 'none'; };
function tile(key, label, fn, locked = false, dot = false) {
  return el('button.idg-tile' + (locked ? '.locked' : '') + (dot ? '.dot' : ''), { type: 'button', onclick: () => { Sfx.play('sfx_menu_select'); fn(); } }, [
    el('img', { src: `${UI}icon_${key}.png`, alt: '', onerror: (e) => { if (ICO[key] && !e.target.dataset.f) { e.target.dataset.f = 1; e.target.src = `${AL}${ICO[key]}.png`; } else hideBad(e); } }), el('span', label),
  ]);
}
/** 아래 작은 아이콘 칸 (그림 + 이름 · 빨간 점) */
function mini(key, label, fn, dot = false) {
  return el('button.idg-mini-btn' + (dot ? '.dot' : ''), { type: 'button', onclick: () => { Sfx.play('sfx_menu_select'); fn(); } }, [
    el('img', { src: `${UI}icon_${key}.png`, alt: '', onerror: (e) => { if (ICO[key] && !e.target.dataset.f) { e.target.dataset.f = 1; e.target.src = `${AL}${ICO[key]}.png`; } else { e.target.replaceWith(el('b.ico-t', key === 'more' ? '⋯' : label.slice(0, 1))); } } }), el('span', label),
  ]);
}
/** «더보기» 창 : 도감 · 게임하는 법 · 음향 설정 · 명예의 전당 · 음악 출처 */
function showMore(go = {}) {
  const pick = (fn) => () => { close(); fn(); };
  const box = el('div.dialog.idg-more', { onclick: (e) => e.stopPropagation() }, [
    el('div.idg-how-title', '더보기'),
    el('div.idg-menu', null, [
      tile('codex', '도감', pick(() => showCodex(go))),
      tile('how', '게임하는 법', pick(showHow)),
      tile('sound', '음향 설정', pick(showSound)),
      tile('hall', '명예의 전당', pick(showHall)),
      tile('music', '음악 출처', pick(showCredits)),
    ]),
    button('닫기', () => close()),
  ]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}
/** «음향 설정» 창 (대표님 «설정 대신 음향 설정») — 전투 일시정지와 같은 판 */
function showSound() {
  Sfx.play('sfx_menu_select');
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const box = el('div.dialog.idg-soundset', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', '음향 설정'), soundPanel(mk), button('닫기', () => close(), { primary: true })]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}
const stat = (key, n) => el('span.idg-stat', null, [el('img', { src: `${UI}icon_${key}.png`, alt: '', onerror: hideBad }), el('b', Number(n || 0).toLocaleString('en-US'))]);

/** 새로 얻은 칭호 알림 (꾸미기에서 달 수 있음) */
function checkTitles() {
  const g = G.idg(), got = TITLES.filter((t) => t.has(g)).map((t) => t.id), fresh = got.filter((id) => !g.tGot.includes(id));
  if (!fresh.length) return;
  G.saveIdg({ tGot: [...g.tGot, ...fresh] });
  Sfx.play('sfx_purchase');
  toast(`칭호 획득! «${TITLES.filter((t) => fresh.includes(t.id)).map((t) => t.name).join(' · ')}» — 꾸미기에서 달 수 있어요`, 3200);
}
/** 지난주 주간 습격 1~3위 → 금 · 은 · 나무 테두리 (META 5장 · 한 주에 한 번 · 서버 순위를 보고 기기에서 준다) */
async function checkRaidFrame(onGot) {
  const prev = weekKey(Date.now() - 7 * 864e5), g = G.idg(), uid = currentUser()?.uid;
  if (!uid || g.frameW >= prev.idx) return;
  const r = await fetchIdgBoard('raid', 50).catch(() => null);
  if (!r?.ok) return;
  const rows = r.rows.filter((x) => Math.floor((x.raid || 0) / 100) === prev.idx).sort((a, b) => (b.raid % 100) - (a.raid % 100));
  const place = rows.findIndex((x) => x.uid === uid);
  const frame = ['gold', 'silver', 'wood'][place];
  G.saveIdg({ frameW: prev.idx, ...(place >= 0 && place < 10 ? { weekTop: prev.idx } : {}), ...(frame ? { owned: [...G.idg().owned, `frame:${frame}`] } : {}) });
  if (frame) { Sfx.play('sfx_purchase'); toast(`지난주 주간 습격 ${place + 1}위! ${frame === 'gold' ? '금' : frame === 'silver' ? '은' : '나무'} 테두리를 받았어요`, 3600); onGot?.(); }
}

export default function IanDragonGameLobby(nav) {
  setTimeout(checkTitles, 900);
  { const rj = G.takeRejoin(); if (rj) setTimeout(() => showMulti((room) => { G.pickNet(room); start(room.stageNo); }, rj), 300); }   // 멀티 «한 판 더»
  setTimeout(() => checkRaidFrame(() => nav.refresh?.()), 1500);
  setTimeout(() => IanDragonGame.prefetch?.(), 1200);   // 한가할 때 게임 코드를 미리 받아 둔다
  /* 타이틀 콜 «좀비와 드래곤!» (겜팀장 음성 · 오락실 효과음 설정을 따른다) */
  if (getSettings().sfxEnabled !== false) import('../games/iandragon_game/audio/index.js').then((A) => { A.init(); setTimeout(() => A.voice('title'), 300); }).catch(() => {});

  /**
   * 「모험 시작」 — 전체화면은 클릭 핸들러 안에서 곧바로 요청해야 받아 준다(await 먼저 금지).
   * 가로 잠금은 전체화면이어야 먹으므로 게임 화면이 그 뒤에 건다.
   */
  function start(stageNo) {
    Sfx.play('sfx_menu_select');
    enterFullscreen();
    G.pickStage(typeof stageNo === 'number' ? stageNo : null);
    nav.push(IanDragonGame);
  }

  /*
   * 가로 로비 (11/11 대표님 · 기획 IAN_DRAGON_LOBBY_ORIENTATION_PLAN.md 2장) : 같은 단추 · 같은 순서, 배치만 CSS 로 바꾼다.
   *  위 띠 = 짧은 배너(보조 banner_wide) + 상태판 · 왼쪽 = 리더 무대(stage_land + 리더 몸 그림, 누르면 이름 외침) · 오른쪽 = 모험 시작 + 2×2 · 아래 = 작은 아이콘 줄.
   *  html.idg-lobby-on : 로비가 떠 있는 동안 몸통 폭(오락실 450)을 화면 전체로 (가로에서만 · CSS).
   */
  const leaderOf = (g) => { try { return makeLoads(stageByNo(Math.min(100, (g.cleared || 0) + 1)), g).loads[0].leader || 'novart'; } catch { return 'novart'; } };
  /* 내가 꾸민 리더 드래곤 (대표님 11/11 «왕관을 썼으면 왕관, 목도리를 골랐으면 목도리») — 누르면 이름 외침 + 깡충 */
  function myDragon(tag, g, cls) {
    const ld = leaderOf(g);
    const box = el(tag, { type: 'button', 'aria-label': '내 리더 드래곤',
      onclick: () => { box.classList.remove('hop'); void box.offsetWidth; box.classList.add('hop'); import('../games/iandragon_game/audio/index.js').then((A) => { A.init(); A.voice(`name/${ld}`); }).catch(() => {}); } });
    dressedCanvas(ld, g.look).then((c) => { c.className = cls; box.appendChild(c); }).catch(() => {});
    return box;
  }
  const landStage = (g) => myDragon('button.idg-land-stage', g, 'idg-land-leader');
  return {
    onLeave() { document.documentElement.classList.remove('idg-lobby-on'); },
    destroy() { document.documentElement.classList.remove('idg-lobby-on'); },
    render() {
      const p = getProfile();
      const g = G.idg();
      document.documentElement.classList.add('idg-lobby-on');
      const scr = screen(
        el('div.idg-lobby-bg'),   // 로비 배경 그림 (ui/lobby/bg.webp · 없으면 어두운 바탕)
        /* 로고 그림(겜팀장 · 540×150 도트) — 좀비와 드래곤 / ZOMBIE & DRAGON */
        /* 로비 맨 위 배너 (겜팀장 v2 · 신발 · 드래곤 로비와 같은 비율) — 결정 D4 */
        el('div.idg-logo', null, [el('img.idg-lobby-banner', { src: '/assets/ui/banner_iandragon_lobby.webp', alt: `${S.idgTitle} ${S.idgTitleEn}` })]),
        /* 상태판 — 그림(겜부장 보조 · ui/lobby/*)이 있으면 그림, 없으면 글자만 (2026-11-11 대표님 «로비에 디자인 요소가 없다») */
        el('div.panel.idg-panel.idg-prof', null, [
          myDragon('button.idg-prof-dragon', g, 'idg-prof-canvas'),
          el('div.idg-prof-text', null, [
          el('div.idg-player', (p.nickname || '???') + (titleOf(g.title) ? ` · ${titleOf(g.title).name}` : '')),
          el('div.idg-stats', null, [
            el('div', g.cleared >= 100 ? '모든 모험 끝! 좀비 드래곤 로드를 물리쳤어요!' : S.idgStatNext(G.stageLabel(G.nextStage(g)))),   // 코드 검토 7
            el('div.idg-stat-row', null, [stat('star', G.totalStars(g)), stat('coin', g.coins), stat('gem', g.gems)]),
          ]),
          ]),
        ]),
        /* 로비 메뉴 정리 (2026-11-11 대표님 · 기획 IAN_DRAGON_MENU_CODEX_PLAN.md 1장) : 큰 단추(매일 하는 것) + 아래 작은 아이콘 줄 + «더보기» */
        landStage(g),
        el('div.idg-start-row', null, [
          el('button.idg-start', { type: 'button', onclick: () => start() }, [el('span', S.idgLobbyStart)]),
          el('button.idg-pick', { type: 'button', onclick: () => { Sfx.play('sfx_menu_select'); showStages((no) => start(no)); } }, [el('img', { src: `${AL}ico_stages.png`, alt: '', onerror: hideBad }), el('span', '판 고르기')]),
        ]),
        el('div.idg-menu.big', null, [
          tile('nest', '파워업', () => showNest(() => nav.refresh?.())),
          g.cleared >= OPEN_AT ? tile('hatch', '알 부화장', () => showHatch(() => nav.refresh?.())) : tile('hatch', '알 부화장', () => toast('알 부화장은 2-5를 깨면 열려요', 2200), true),
          tile('coop', '친구와 하기', () => showMulti((room) => { G.pickNet(room); start(room.stageNo); })),
          tile('raid', '주간 좀비 습격', () => { if ((G.idg().cleared || 0) < 20) { toast('주간 좀비 습격은 2-10을 깨면 열려요', 2200); return; } G.pickRaid(); start(); }, (G.idg().cleared || 0) < 20),
        ]),
        el('div.idg-icons', null, [
          mini('lab', '연구소', () => showLab(() => nav.refresh?.())),
          mini('quest', '도전 과제', () => showQuests(() => nav.refresh?.()), claimable(g) > 0),
          mini('shop', '용 시장', () => showShop({ idg: G.idg(), save: G.saveIdg, onClose: () => nav.refresh?.() })),
          mini('look', '꾸미기', () => showLook({ idg: G.idg(), save: G.saveIdg, onClose: () => nav.refresh?.() })),
          mini('more', '더보기', () => showMore({ stage: () => showStages((no) => start(no)), hatch: () => (G.idg().cleared >= OPEN_AT ? showHatch(() => nav.refresh?.()) : toast('알 부화장은 2-5를 깨면 열려요', 2200)) })),
        ]),
        el('div.spacer'),
        (() => { const b = backButton(S.backToPortal, () => nav.reset(Portal)); b.classList.add('idg-back'); return b; })(),   // 돌 판 옷 (보조 의견)
      );
      scr.classList.add('idg-lobby');
      return scr;
    },
  };
}
