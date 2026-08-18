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
import { REVIVE, MULTI } from '../config/balance.js';
import { PAL } from './palette.js';
import { get as getProfile } from '../services/profile.js';
import { potShoes, canRevive } from '../services/matchRules.js';
import * as Room from '../services/multiplayer.js';
import { pickPenaltyShoes } from '../services/matchRules.js';
import * as L from '../services/storageLocal.js';
import { syncWallet } from '../services/multiSettle.js';
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
          } },
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
    /**
     * 패널 높이는 **항목 수에 맞춘다.** 멀티는 [재개 · 기권하고 나가기] 두 개뿐이라
     * 고정 높이로 두면 아래가 텅 빈다 (미리보기로 확인, 2026-08-19).
     */
    const 마지막 = PAUSE.btnY[this.items.length - 1] + PAUSE.btnH;
    panelBox(p.x, p.y, p.w, 마지막 + 12 - p.y);
    text(S.paused, PAUSE.title.x, PAUSE.title.y, {
      color: PAL.textShadow, scale: PAUSE.title.scale, align: 'center' });
    this.items.forEach((it, i) => {
      const y = PAUSE.btnY[i];
      button(PAUSE.btnX, y, PAUSE.btnW, PAUSE.btnH, i === this.sel);
      text(it.label, PAUSE.btnX + (PAUSE.btnW >> 1), y + ((PAUSE.btnH - GLYPH_H) >> 1), {
        color: PAL.text, scale: 1, align: 'center' });
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
      color: PAL.goRed, outline: '#3A0A0A', scale: GAMEOVER.title.scale, align: 'center' });

    const p = GAMEOVER.panel;
    panelBox(p.x, p.y, p.w, p.h);

    text(S.score, 90, GAMEOVER.label.y, { color: PAL.accent, scale: 1, align: 'center' });
    text(String(this.game.floor), GAMEOVER.score.x, GAMEOVER.score.y, {
      color: '#2E7D4F', outline: '#123020', scale: GAMEOVER.score.scale, align: 'center', mono: true });

    // BEST 바
    const bh = GAMEOVER.best.barH;
    rect(p.x + 12, GAMEOVER.best.y - 4, p.w - 24, bh, PAL.panelDark);
    strokeRect(p.x + 12, GAMEOVER.best.y - 4, p.w - 24, bh, PAL.line);
    text(S.best, p.x + 18, GAMEOVER.best.y, { color: PAL.textShadow });
    text(String(this.best), p.x + p.w - 18, GAMEOVER.best.y, {
      color: PAL.goRed, align: 'right' });

    // 찾은 신발 요약
    text(S.shoesFound(this.game.shoesFound), 90, GAMEOVER.shoes.y, {
      color: PAL.textShadow, align: 'center' });

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

// ─────────────────────────────────────────────
// 멀티 사망 → 부활 베팅 (2026-08-18 역전 배틀)
// ─────────────────────────────────────────────

/**
 * 죽은 순간 20초 동안 뜨는 화면. **판은 아직 안 끝났다** — 남들은 계속 오르고 있다.
 *
 * ## 왜 여기서 신발을 빼는가
 *
 * "걸었다"는 사실이 **서버에 실물로 남아야** 한다. 그래서 순서가 정해져 있다:
 *   ① 내 지갑에서 20켤레를 뺀다  ② 방의 항아리(`result/given`)에 올린다  ③ 되살아난다
 * ②가 실패하면 ①을 되돌린다. 반대로 하면 "살아났는데 안 낸" 상태가 되어
 * 화면의 판돈과 실제로 받을 신발이 어긋난다 — 그건 사기다.
 *
 * ## 시간
 *
 * 남은 시간은 **서버 기준 `deadAt`** 에서 잰다. 프레임으로 세면 로딩·백그라운드에서
 * 멈춰 사람마다 창 길이가 달라진다(카운트다운에서 이미 겪었다 — §9-0-14).
 */
export class MultiDeathOverlay {
  constructor(game) {
    this.game = game;
    this.busy = false;
    /**
     * ★ **창의 끝은 서버 시각 기준이다.** (2026-08-18 재수정)
     * 남들은 내 `deadAt`(서버 보정)에 20초를 더해 판정한다. 내 화면만 **폰 시계**로
     * 세면 시계가 어긋난 만큼 창이 길거나 짧아진다 — 길면 이미 끝난 판에 신발을 걸고
     * (그 신발은 아무도 안 걷는다), 짧으면 억울하게 기회를 잃는다.
     */
    /**
     * ★ **걸 신발이 없으면 창을 짧게.** (2026-08-19)
     * 고를 수 있는 게 '나가기' 하나뿐인데 10초를 세는 건 그냥 기다리게 하는 것이다.
     * 남들의 판정 기준은 여전히 10초다 — 남은 사람은 내 지갑을 모른다.
     * 이쪽이 먼저 닫히면서 `out` 도장을 찍으므로 남들도 그 즉시 기다림을 멈춘다.
     */
    const 걸수있다 = (getProfile().shoesOwned ?? 0) >= MULTI.reviveCost && canRevive(this.me);
    const 창초 = 걸수있다 ? MULTI.reviveWindowSeconds : MULTI.reviveWindowShortSeconds;
    const me = game.room?.players?.[game.multi?.myUid];
    const 서버기준끝 = (me?.deadAt ?? 0) + 창초 * 1000;
    const 내시계로 = 서버기준끝 - Room.serverOffsetSync();
    this.endAt = me?.deadAt ? 내시계로 : Date.now() + 창초 * 1000;
    this.msg = null;
  }

  enter() {
    clearInput();
    setTapHandler((x, y) => {
      if (this.busy) return true;
      if (inRect(x, y, 16, 168, 148, 34)) { this.revive(); return true; }
      if (inRect(x, y, 16, 208, 148, 26)) { this.quit(); return true; }
      return true;   // 이 화면에서는 좌우 입력이 새면 안 된다
    }, true);
  }

  exit() { setTapHandler(null); }

  /** 내 참가자 레코드 (부활 횟수·상한 판정용) */
  get me() {
    return this.game.room?.players?.[this.game.multi?.myUid] ?? {};
  }

  get left() {
    return Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000));
  }

  async revive() {
    if (this.busy) return;
    // 이미 판이 끝나 결과 화면으로 가는 중이면 걸 이유가 없다 (걸어도 아무도 못 걷는다)
    if (this.game.over || this.game.leaving) return;
    const wallet = getProfile();
    if (!canRevive(this.me)) { this.msg = S.reviveMaxed; return; }
    if ((wallet.shoesOwned ?? 0) < MULTI.reviveCost) {
      this.msg = S.reviveNeed(MULTI.reviveCost, wallet.shoesOwned ?? 0);
      return;
    }
    this.busy = true;
    Sfx.play('sfx_menu_select');

    // ① 지갑에서 먼저 뺀다
    const picked = pickPenaltyShoes(wallet.shoesByIndex ?? {}, MULTI.reviveCost);
    if (picked.length < MULTI.reviveCost) {
      this.busy = false;
      this.msg = S.reviveNeed(MULTI.reviveCost, picked.length);
      return;
    }
    L.removeShoesByIndex(picked);

    /**
     * ② 판돈과 부활을 **한 번의 쓰기로** 올린다(`reviveMe`). 전부 되거나 전부 안 된다.
     * `null` 은 서버를 다시 읽어 "정말 안 들어갔다"를 확인한 뒤에만 온다 —
     * 그래서 여기서 되돌려도 신발이 복제되지 않는다.
     */
    const floor = await Room.reviveMe(this.game.multi.code, picked).catch(() => null);
    if (floor == null) {
      L.addShoes(picked);
      this.busy = false;
      this.msg = S.networkError;
      return;
    }
    /**
     * ★ **지갑을 바로 서버에 올린다.** (2026-08-18 재수정)
     * 지갑 병합은 신발별 **max** 라, 여기서 안 올리면 다음 접속에 서버의 옛 값이
     * 이겨 20켤레가 되돌아온다 — 항아리에는 그대로 있으니 그만큼 복제된다.
     */
    syncWallet();
    /**
     * 기다리는 사이에 판이 끝나 버렸으면(다른 사람이 순위를 박았거나 내가 그 사이 나갔다면)
     * **되살아날 자리가 없다.** 서버에는 내가 살아 있는 것으로 남으므로, 그대로 두면
     * 남들의 종료 판정이 나를 영원히 기다린다 — 곧바로 손 뗐다고 알린다.
     */
    if (this.game.over || this.game.leaving) {
      Room.markOut(this.game.multi.code).catch(() => {});
      this.busy = false;
      return;
    }
    Sfx.play('sfx_revive');
    Scene.pop();
    this.game.reviveAt(floor);
  }

  quit() {
    if (this.busy) return;
    this.busy = true;
    Sfx.play('sfx_menu_back');
    Room.declineRevive(this.game.multi.code).catch(() => {});
    Scene.pop();
    this.game.endMulti();
  }

  update() {
    const btn = consumeInput();
    if (btn === BTN.LEFT) return void this.revive();
    if (btn === BTN.RIGHT) return void this.quit();
    // 시간이 다 되면 자동으로 나간다 — 남들을 무한정 기다리게 둘 수 없다
    if (!this.busy && Date.now() >= this.endAt) this.quit();
  }

  render() {
    dim();
    panelBox(12, 96, 156, 146);

    text(S.fellTitle, 90, 104, { color: PAL.goRed, align: 'center' });
    text(String(this.left), 90, 118, { color: PAL.text, scale: 3, align: 'center', mono: true });

    // 판돈은 이 화면의 핵심 정보다 — 얼마가 걸려 있는지 알아야 걸지 말지 정한다
    text(S.potLine(potShoes(this.game.room)), 90, 150, { color: PAL.text, align: 'center', small: true });
    const have = getProfile().shoesOwned ?? 0;
    text(S.myShoes(have), 90, 160, { color: PAL.textShadow, align: 'center', small: true });

    const 가능 = canRevive(this.me) && have >= MULTI.reviveCost && !this.busy;
    button(16, 168, 148, 34, 가능);
    // 한 줄로 쓰면 170px 라 패널(148)을 넘는다 — 두 줄로 나눈다
    const c = 가능 ? PAL.text : PAL.textShadow;
    text(S.reviveWith1(MULTI.reviveCost), 90, 174, { color: c, align: 'center', small: true });
    text(S.reviveWith2(MULTI.reviveAhead), 90, 186, { color: c, align: 'center', small: true });

    button(16, 208, 148, 26, false);
    text(S.quitRound, 90, 215, { color: PAL.text, align: 'center' });

    if (this.msg) text(this.msg, 90, 238, { color: PAL.goRed, align: 'center', small: true });
  }
}
