/**
 * S50 이안 드래곤 게임 **로비** — 세로 화면. (2026-11-10, 이안오락실 7번째 게임)
 *
 * 대표님 결정 : «로비만 세로, 게임을 실행하면 가로 모드로 바뀐다 · 세로 모드는 없다 ·
 * 신발을 찾아서 · 드래곤 스트라이커처럼 로비가 있었으면» (기획서 11.0).
 * 그래서 드래곤 · 줄넘기 로비와 같은 순서다 : 제목 / 상태창 / 버튼들 / 큰 시작 버튼 / 오락실 복귀.
 * 「모험 시작」 을 누르면 가로 게임 화면(`IanDragonGame.js`)으로 간다 — 지도 · 둥지 · 부화장 · 전투는 전부 그 안(가로).
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, presentOverlay } from './ui.js';
import { get as getProfile } from '../services/profile.js';
import Portal from './Portal.js';
import { lazyScreen } from './lazyScreen.js';
import * as G from '../services/iandragonGame.js';
import { enterFullscreen } from '../core/fullscreen.js';
import * as Sfx from '../audio/sfx.js';
import '../styles/iandragon-game.css';

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

export default function IanDragonGameLobby(nav) {
  setTimeout(() => IanDragonGame.prefetch?.(), 1200);   // 한가할 때 게임 코드를 미리 받아 둔다

  /**
   * 「모험 시작」 — 전체화면은 클릭 핸들러 안에서 곧바로 요청해야 받아 준다(await 먼저 금지).
   * 가로 잠금은 전체화면이어야 먹으므로 게임 화면이 그 뒤에 건다.
   */
  function start() {
    Sfx.play('sfx_menu_select');
    enterFullscreen();
    nav.push(IanDragonGame);
  }

  return {
    render() {
      const p = getProfile();
      const g = G.idg();
      return screen(
        /* 로고 그림(겜팀장 · 540×150 도트) — 좀비와 드래곤 / ZOMBIE & DRAGON */
        el('div.idg-logo', null, [el('img.idg-logo-img', { src: '/assets/iandragon-logo.png', alt: `${S.idgTitle} ${S.idgTitleEn}` })]),
        el('div.panel.idg-panel', null, [
          el('div.idg-player', p.nickname || '???'),
          el('div.idg-stats', null, [
            el('div', S.idgStatNext(G.stageLabel(G.nextStage(g)))),
            el('div', S.idgStatStars(G.totalStars(g))),
            el('div', `${S.idgStatCoins(g.coins)} · ${S.idgStatGems(g.gems)}`),
          ]),
        ]),
        el('div.idg-preview', S.idgLobbyPreview),
        button(S.idgLobbyHow, showHow),
        el('div.spacer'),
        button(S.idgLobbyStart, start, { primary: true }),
        backButton(S.backToPortal, () => nav.reset(Portal)),
      );
    },
  };
}
