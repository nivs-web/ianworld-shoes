/**
 * 캔버스 오버레이 씬들 — 일시정지 / 부활 / 게임오버.
 * 씬 스택 위에 얹혀 아래(게임 화면)가 비쳐 보인다. 전부 캔버스, DOM 금지.
 *
 * 입력: 좌/우 버튼(터치·키보드)이 곧 좌/우 선택. 탭 존도 지원.
 */

import * as Scene from '../core/scene.js';
import { consumeInput, clearInput, setTapHandler, BTN } from '../core/input.js';
import { rect, strokeRect } from '../core/sprite.js';
import { text, GLYPH_H } from '../core/pixelfont.js';
import * as Sfx from '../audio/sfx.js';
import { VIEW_W, VIEW_H, GAMEOVER } from '../config/layout.js';
import { REVIVE } from '../config/balance.js';
import { PAL } from './palette.js';

function dim() {
  rect(0, 0, VIEW_W, VIEW_H, PAL.dim);
}

function panelBox(x, y, w, h) {
  rect(x, y, w, h, PAL.panel);
  rect(x, y + h - 4, w, 4, PAL.panelDark);
  strokeRect(x, y, w, h, PAL.line);
  strokeRect(x + 2, y + 2, w - 4, h - 4, PAL.panelDark);
}

function button(x, y, w, h, active) {
  rect(x, y, w, h, active ? PAL.accent : PAL.panelDark);
  strokeRect(x, y, w, h, PAL.line);
}

const inRect = (px, py, x, y, w, h) => px >= x && px <= x + w && py >= y && py <= y + h;

// ─────────────────────────────────────────────
// 일시정지
// ─────────────────────────────────────────────

export class PauseOverlay {
  constructor(game) {
    this.game = game;
  }

  enter() {
    clearInput();
    setTapHandler((x, y) => {
      if (inRect(x, y, 40, 150, 100, 30)) {
        Scene.pop(); // 계속하기
        return true;
      }
      if (inRect(x, y, 40, 190, 100, 30)) {
        this.restart();
        return true;
      }
      return false;
    });
  }

  exit() {
    setTapHandler(null);
  }

  restart() {
    // 게임 씬 교체 (새 시드)
    const { GameScene } = window.__gameModule;
    Scene.reset(new GameScene({ difficulty: this.game.diff.id, charId: this.game.charId, controlMode: this.game.controlMode }));
  }

  update() {
    const btn = consumeInput();
    if (btn === BTN.LEFT) { Sfx.play('sfx_menu_back'); Scene.pop(); }
    else if (btn === BTN.RIGHT) { Sfx.play('sfx_menu_select'); this.restart(); }
  }

  render() {
    dim();
    panelBox(30, 100, 120, 136);
    text('PAUSE', 90, 112, { color: PAL.textShadow, scale: 2, align: 'center' });
    button(40, 150, 100, 30, true);
    text('GO!', 90, 150 + ((30 - GLYPH_H) >> 1), { color: PAL.text, scale: 1, align: 'center' });
    button(40, 190, 100, 30, false);
    text('RETRY', 90, 190 + ((30 - GLYPH_H) >> 1), { color: PAL.text, scale: 1, align: 'center' });
  }
}

// ─────────────────────────────────────────────
// 부활 (싱글 전용, 3초 카운트다운)
// ─────────────────────────────────────────────

export class ReviveOverlay {
  constructor(game) {
    this.game = game;
    this.left = REVIVE.decisionSeconds * 60;
  }

  enter() {
    clearInput();
    setTapHandler((x, y) => {
      if (inRect(x, y, 24, 170, 60, 40)) {
        this.accept();
        return true;
      }
      if (inRect(x, y, 96, 170, 60, 40)) {
        this.decline();
        return true;
      }
      return false;
    });
  }

  exit() {
    setTapHandler(null);
  }

  accept() {
    Scene.pop();
    this.game.doRevive();
  }

  decline() {
    Sfx.play('sfx_menu_back');
    Scene.pop();
    this.game.finish();
  }

  update() {
    const btn = consumeInput();
    if (btn === BTN.LEFT) return this.accept();
    if (btn === BTN.RIGHT) return this.decline();
    if (--this.left <= 0) this.decline();
  }

  render() {
    dim();
    panelBox(16, 110, 148, 116);
    // 카운트다운 숫자
    const sec = Math.ceil(this.left / 60);
    text(String(sec), 90, 120, { color: PAL.goRed, scale: 3, align: 'center', mono: true });

    // 하트 = 부활
    button(24, 170, 60, 40, true);
    heart(54, 184);
    // X = 포기
    button(96, 170, 60, 40, false);
    xmark(126, 184);

    text(`X${this.game.revives}`, 90, 156, { color: PAL.textShadow, align: 'center' });
  }
}

function heart(cx, cy) {
  const c = '#FFF';
  rect(cx - 8, cy - 4, 6, 4, c);
  rect(cx + 2, cy - 4, 6, 4, c);
  rect(cx - 10, cy, 20, 5, c);
  rect(cx - 6, cy + 5, 12, 3, c);
  rect(cx - 2, cy + 8, 4, 2, c);
}

function xmark(cx, cy) {
  const c = '#FFF';
  for (let i = -5; i <= 5; i++) {
    rect(cx + i - 1, cy + i - 1, 3, 3, c);
    rect(cx - i - 1, cy + i - 1, 3, 3, c);
  }
}

// ─────────────────────────────────────────────
// 게임 오버 (기획서 S11, 레퍼런스: 죽으면 점수표기.png)
// ─────────────────────────────────────────────

export class GameOverOverlay {
  constructor(game, best) {
    this.game = game;
    this.best = best;
    this.delay = 30; // 잠깐 여운 후 입력 허용
  }

  enter() {
    clearInput();
    setTapHandler((x, y) => {
      if (this.delay > 0) return true;
      const b1 = GAMEOVER.btnHome;
      const b2 = GAMEOVER.btnRetry;
      if (inRect(x, y, b1.x, b1.y, b1.w, b1.h)) {
        this.restart(); // M5 전까지 홈 = 재시작
        return true;
      }
      if (inRect(x, y, b2.x, b2.y, b2.w, b2.h)) {
        this.restart();
        return true;
      }
      return false;
    });
  }

  exit() {
    setTapHandler(null);
  }

  restart() {
    const { GameScene } = window.__gameModule;
    Scene.reset(new GameScene({ difficulty: this.game.diff.id, charId: this.game.charId, controlMode: this.game.controlMode }));
  }

  update() {
    if (this.delay > 0) {
      this.delay--;
      clearInput();
      return;
    }
    const btn = consumeInput();
    if (btn) this.restart();
  }

  render() {
    dim();

    text('GAME OVER', GAMEOVER.title.x, GAMEOVER.title.y, {
      color: PAL.goRed, outline: '#3A0A0A', scale: GAMEOVER.title.scale, align: 'center',
    });

    const p = GAMEOVER.panel;
    panelBox(p.x, p.y, p.w, p.h);

    text('SCORE', 90, GAMEOVER.label.y, { color: PAL.accent, scale: 1, align: 'center' });
    text(String(this.game.floor), GAMEOVER.score.x, GAMEOVER.score.y, {
      color: '#2E7D4F', outline: '#123020', scale: GAMEOVER.score.scale, align: 'center', mono: true,
    });

    // BEST 바
    const bh = GAMEOVER.best.barH;
    rect(p.x + 12, GAMEOVER.best.y - 4, p.w - 24, bh, PAL.panelDark);
    strokeRect(p.x + 12, GAMEOVER.best.y - 4, p.w - 24, bh, PAL.line);
    text('BEST', p.x + 18, GAMEOVER.best.y, { color: PAL.textShadow });
    text(String(this.best), p.x + p.w - 18, GAMEOVER.best.y, {
      color: PAL.goRed, align: 'right',
    });

    // 찾은 신발 요약
    text(`SHOES ${this.game.shoesFound}`, 90, GAMEOVER.shoes.y, {
      color: PAL.textShadow, align: 'center',
    });

    if (this.delay <= 0) {
      const b1 = GAMEOVER.btnHome;
      const b2 = GAMEOVER.btnRetry;
      button(b1.x, b1.y, b1.w, b1.h, false);
      text('HOME', b1.x + (b1.w >> 1), b1.y + ((b1.h - GLYPH_H) >> 1), { color: PAL.text, align: 'center' });
      button(b2.x, b2.y, b2.w, b2.h, true);
      // ▶ 재시작 삼각형
      const cx = b2.x + (b2.w >> 1) - 4;
      const cy = b2.y + (b2.h >> 1);
      for (let i = 0; i < 6; i++) rect(cx + i, cy - 6 + i, 2, 12 - i * 2, '#FFF');
    }
  }
}
