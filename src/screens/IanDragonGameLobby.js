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
import { showNest } from './idgNest.js';
import { showHatch } from './idgHatch.js';
import { showCodex } from './idgCodex.js';
import { showLab } from './idgLab.js';
import { showMulti } from './idgMulti.js';
import { showQuests } from './idgQuests.js';
import { claimable } from '../services/iandragonQuests.js';
import { OPEN_AT } from '../services/iandragonHatch.js';

const IanDragonGame = lazyScreen(() => import('./IanDragonGame.js'), S.idgTitle);

function showHow() {
  Sfx.play('sfx_menu_select');
  const box = el('div.dialog.idg-how', { onclick: (e) => e.stopPropagation() }, [
    el('div.idg-how-title', S.idgLobbyHow),
    el('p', S.idgLobbyHowText),
    button('알겠어요', () => close(), { primary: true }),
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
  const grid = el('div.idg-stage-grid'), tabs = el('div.idg-world-tabs'), name = el('div.idg-world-name');
  function draw() {
    tabs.replaceChildren(...WORLD_NAMES.map((_, i) => el('button.idg-world-tab' + (i + 1 === w ? '.on' : ''), { type: 'button', disabled: i * 10 + 1 > open, onclick: () => { w = i + 1; draw(); } }, [String(i + 1)])));
    name.textContent = `월드 ${w} · ${WORLD_NAMES[w - 1]}`;
    grid.replaceChildren(...Array.from({ length: 10 }, (_, k) => {
      const no = (w - 1) * 10 + k + 1, st = Number(g.stars[no - 1]) || 0, locked = no > open;
      return el('button.idg-stage-btn' + (locked ? '.locked' : '') + (k === 9 ? '.boss' : ''), { type: 'button', disabled: locked, onclick: () => { close(); onPick(no); } }, [
        el('b', `${w}-${k + 1}`), el('span.idg-stage-stars', locked ? '🔒' : '★'.repeat(st) + '☆'.repeat(3 - st)),
      ]);
    }));
  }
  draw();
  const box = el('div.dialog.idg-stages', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', '스테이지 고르기'), tabs, name, grid, button('닫기', () => close())]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}

/* 로비 그림 (겜부장 보조가 제미나이로 만든다 · 파일이 없으면 그림만 숨기고 글자로) */
const UI = '/assets/iandragon_game/ui/lobby/';
const AL = '/assets/iandragon_game/ai/lobby/';   // 보조 제미나이 2차 (2026-11-11) — 메뉴 아이콘 · 판
const ICO = { stage: 'ico_stages', nest: 'ico_nest', hatch: 'ico_hatch', lab: 'ico_lab', quest: 'ico_quests', codex: 'ico_codex', how: 'ico_how', coop: 'ico_start' };
const hideBad = (e) => { e.target.style.display = 'none'; };
function tile(key, label, fn, locked = false, dot = false) {
  return el('button.idg-tile' + (locked ? '.locked' : '') + (dot ? '.dot' : ''), { type: 'button', onclick: () => { Sfx.play('sfx_menu_select'); fn(); } }, [
    el('img', { src: ICO[key] ? `${AL}${ICO[key]}.png` : `${UI}icon_${key}.png`, alt: '', onerror: hideBad }), el('span', label),
  ]);
}
const stat = (key, n) => el('span.idg-stat', null, [el('img', { src: `${UI}icon_${key}.png`, alt: '', onerror: hideBad }), el('b', Number(n || 0).toLocaleString('en-US'))]);

export default function IanDragonGameLobby(nav) {
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

  return {
    render() {
      const p = getProfile();
      const g = G.idg();
      return screen(
        el('div.idg-lobby-bg'),   // 로비 배경 그림 (ui/lobby/bg.webp · 없으면 어두운 바탕)
        /* 로고 그림(겜팀장 · 540×150 도트) — 좀비와 드래곤 / ZOMBIE & DRAGON */
        /* 로비 맨 위 배너 (겜팀장 v2 · 신발 · 드래곤 로비와 같은 비율) — 결정 D4 */
        el('div.idg-logo', null, [el('img.idg-lobby-banner', { src: '/assets/ui/banner_iandragon_lobby.webp', alt: `${S.idgTitle} ${S.idgTitleEn}` })]),
        /* 상태판 — 그림(겜부장 보조 · ui/lobby/*)이 있으면 그림, 없으면 글자만 (2026-11-11 대표님 «로비에 디자인 요소가 없다») */
        el('div.panel.idg-panel', null, [
          el('div.idg-player', p.nickname || '???'),
          el('div.idg-stats', null, [
            el('div', g.cleared >= 100 ? '모든 모험 끝! 좀비 드래곤 로드를 물리쳤어요!' : S.idgStatNext(G.stageLabel(G.nextStage(g)))),   // 코드 검토 7
            el('div.idg-stat-row', null, [stat('star', G.totalStars(g)), stat('coin', g.coins), stat('gem', g.gems)]),
          ]),
        ]),
        el('div.idg-menu', null, [
          tile('stage', '스테이지 고르기', () => showStages((no) => start(no))),
          tile('nest', '용 둥지', () => showNest(() => nav.refresh?.())),
          g.cleared >= OPEN_AT ? tile('hatch', '알 부화장', () => showHatch(() => nav.refresh?.())) : tile('hatch', '알 부화장', () => toast('알 부화장은 2-5를 깨면 열려요', 2200), true),
          tile('lab', '연구소 · 리더', () => showLab(() => nav.refresh?.())),
          tile('quest', claimable(g) ? `도전 과제 (${claimable(g)})` : '도전 과제', () => showQuests(() => nav.refresh?.()), false, claimable(g) > 0),
          tile('codex', '도감', showCodex),
          tile('coop', '친구랑 같이 깨기', () => showMulti((room) => { G.pickNet(room); start(room.stageNo); })),
          tile('how', S.idgLobbyHow, showHow),
        ]),
        el('div.spacer'),
        el('button.idg-start', { type: 'button', onclick: () => start() }, [el('span', S.idgLobbyStart)]),
        backButton(S.backToPortal, () => nav.reset(Portal)),
      );
    },
  };
}
