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
import { VIEW_W, VIEW_H, GAMEOVER, PAUSE } from '../config/layout.js';
import { REVIVE } from '../config/balance.js';
import { PAL } from './palette.js';
import S from '../config/strings.ko.js';

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
    /** 키보드용 커서. 터치는 직접 누르므로 이 값과 무관하다. */
    this.sel = 0;
    /** 멀티 나가기는 두 번 눌러야 한다 — 한 번은 확인 */
    this.confirmExit = false;
  }

  /**
   * 화면에 보이는 순서대로.
   *
   * ★ **멀티에서는 '다시하기'가 없다.** (2026-08-18)
   * 화면 위쪽 1/5 을 아무 데나 누르면 일시정지라(`layout.TOUCH.pauseBelowY`) 실수로
   * 열리기 쉬운데, 거기서 '다시하기'는 새 맵이 아니라 **사망 보고 → 몰수패**였다
   * (멀티의 `onFinish` 는 `action` 을 무시하므로 '나가기'와 완전히 같다).
   * 그리고 나가기는 **한 번 더 눌러야** 나간다 — 지고 나서 되돌릴 방법이 없는 행동이다.
   */
  get items() {
    const resume = { label: S.resume, run: () => { Sfx.play('sfx_menu_back'); Scene.pop(); } };
    if (this.game.multi) {
      return [
        resume,
        {
          label: this.confirmExit ? S.forfeitConfirm : S.forfeit,
          run: () => {
            if (!this.confirmExit) { this.confirmExit = true; Sfx.play('sfx_menu_move'); return; }
            Sfx.play('sfx_menu_back');
            this.game.leave('home');
          },
        },
      ];
    }
    return [
      resume,
      { label: S.restart, run: () => { Sfx.play('sfx_menu_select'); this.restart(); } },
      { label: S.toLobby, run: () => { Sfx.play('sfx_menu_back'); this.game.leave('home'); } },
    ];
  }

  enter() {
    clearInput();
    setTapHandler((x, y) => {
      const hit = PAUSE.btnY.findIndex((by) => inRect(x, y, PAUSE.btnX, by, PAUSE.btnW, PAUSE.btnH));
      // 멀티는 항목이 둘뿐이라 세 번째 칸을 눌러도 아무 일도 없어야 한다
      if (hit < 0 || !this.items[hit]) return false;
      this.items[hit].run();
      return true;
    }, true);
  }

  exit() {
    setTapHandler(null);
  }

  /** 새 맵 — 이번 판 결과를 먼저 반영하고 같은 설정으로 다시 연다 */
  restart() {
    this.game.leave('retry');
  }

  /**
   * 입력이 좌/우 둘뿐인데 항목은 셋이라, **왼쪽=커서 이동 / 오른쪽=선택**으로 나눴다.
   * 선택된 칸을 강조해 두면 어느 쪽이 눌리는지 눈으로 보인다.
   */
  update() {
    const btn = consumeInput();
    if (btn === BTN.LEFT) {
      this.sel = (this.sel + 1) % this.items.length;
      Sfx.play('sfx_menu_move');
    } else if (btn === BTN.RIGHT) {
      this.items[this.sel].run();
    }
  }

  render() {
    dim();
    const p = PAUSE.panel;
    panelBox(p.x, p.y, p.w, p.h);
    text(S.paused, PAUSE.title.x, PAUSE.title.y, {
      color: PAL.textShadow, scale: PAUSE.title.scale, align: 'center',
    });
    this.items.forEach((it, i) => {
      const y = PAUSE.btnY[i];
      button(PAUSE.btnX, y, PAUSE.btnW, PAUSE.btnH, i === this.sel);
      text(it.label, PAUSE.btnX + (PAUSE.btnW >> 1), y + ((PAUSE.btnH - GLYPH_H) >> 1), {
        color: PAL.text, scale: 1, align: 'center',
      });
    });
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
    }, true);
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
        Sfx.play('sfx_menu_back');
        this.game.leave('home');
        return true;
      }
      if (inRect(x, y, b2.x, b2.y, b2.w, b2.h)) {
        this.restart();
        return true;
      }
      return false;
    }, true);
  }

  exit() {
    setTapHandler(null);
  }

  /** 다시하기 — 이번 판 결과를 먼저 반영하고 같은 설정으로 새 판을 연다 */
  restart() {
    this.game.leave('retry');
  }

  update() {
    if (this.delay > 0) {
      this.delay--;
      clearInput();
      return;
    }
    const btn = consumeInput();
    // 버튼이 세로 2단이라 좌=위(로비) / 우=아래(맵바꾸기)로 나눴다
    if (btn === BTN.LEFT) { Sfx.play('sfx_menu_back'); this.game.leave('home'); }
    else if (btn === BTN.RIGHT) this.restart();
  }

  render() {
    dim();

    text(S.gameOver, GAMEOVER.title.x, GAMEOVER.title.y, {
      color: PAL.goRed, outline: '#3A0A0A', scale: GAMEOVER.title.scale, align: 'center',
    });

    const p = GAMEOVER.panel;
    panelBox(p.x, p.y, p.w, p.h);

    text(S.score, 90, GAMEOVER.label.y, { color: PAL.accent, scale: 1, align: 'center' });
    text(String(this.game.floor), GAMEOVER.score.x, GAMEOVER.score.y, {
      color: '#2E7D4F', outline: '#123020', scale: GAMEOVER.score.scale, align: 'center', mono: true,
    });

    // BEST 바
    const bh = GAMEOVER.best.barH;
    rect(p.x + 12, GAMEOVER.best.y - 4, p.w - 24, bh, PAL.panelDark);
    strokeRect(p.x + 12, GAMEOVER.best.y - 4, p.w - 24, bh, PAL.line);
    text(S.best, p.x + 18, GAMEOVER.best.y, { color: PAL.textShadow });
    text(String(this.best), p.x + p.w - 18, GAMEOVER.best.y, {
      color: PAL.goRed, align: 'right',
    });

    // 찾은 신발 요약
    text(S.shoesFound(this.game.shoesFound), 90, GAMEOVER.shoes.y, {
      color: PAL.textShadow, align: 'center',
    });

    if (this.delay <= 0) {
      for (const [b, label, on] of [
        [GAMEOVER.btnHome, S.toLobby, false],
        [GAMEOVER.btnRetry, S.restart, true],
      ]) {
        button(b.x, b.y, b.w, b.h, on);
        text(label, b.x + (b.w >> 1), b.y + ((b.h - GLYPH_H) >> 1), { color: PAL.text, align: 'center' });
      }
    }
  }
}
