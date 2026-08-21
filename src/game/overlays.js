/**
 * 캔버스 오버레이 씬들 — 일시정지 / 부활 / 게임오버.
 * 씬 스택 위에 얹혀 아래(게임 화면)가 비쳐 보인다. 전부 캔버스, DOM 금지.
 *
 * 입력: 좌/우 버튼(터치·키보드)이 곧 좌/우 선택. 탭 존도 지원.
 */

import * as Scene from '../core/scene.js';
import { consumeInput, clearInput, setTapHandler, BTN } from '../core/input.js';
import { rect, strokeRect } from '../core/sprite.js';
/**
 * ★ **오버레이도 캐시본으로 그린다.** (2026-08-19 8차)
 *
 * 오버레이는 씬 스택 위에 얹히므로 **아래 게임 화면과 함께 매 프레임 다시 그려진다**
 * (`core/scene.js` renderAll). 그런데 여기 글자는 전부 `text()` 였다 — 외곽선이 붙으면
 * 글리프 하나가 fillRect 9벌이라(`pixelfont.js` 주석) 멀티 사망 패널 한 장이
 * **프레임당 3,647 fillRect** 였다(실측, `npm run perf:frame`). 초당 21만 번이다.
 *
 * 하필 이 화면은 **멀티에서 죽은 직후** — RTDB 왕복이 가장 바쁜 순간 — 에 뜬다.
 * 사용자가 신고한 "멀티게임 작동시 버벅임"이 정확히 이 자리다.
 *
 * 내용은 초당 1회(카운트다운) 또는 아예 안 바뀌므로 캐시본이 맞다.
 * `textCached` 는 `text` 와 인자가 같아서 이름만 바꿔 끼운다.
 */
import { textCached as text, GLYPH_H } from '../core/pixelfont.js';
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
  /**
   * ★ 항목을 **한 번만 만든다.** (2026-08-19)
   * 게터라서 `render()` 2회 + `update()` 2회 = 프레임당 3~4번 배열·객체·클로저를
   * 새로 만들고 있었다. 라벨이 바뀌는 건 `confirmExit` 하나뿐이라 그것만 다시 만든다.
   */
  get items() {
    if (this._items && this._itemsConfirm === this.confirmExit) return this._items;
    this._itemsConfirm = this.confirmExit;
    this._items = this.buildItems();
    return this._items;
  }

  /**
   * ★ **이 화면은 이제 싱글 전용이다.** (2026-08-21 26차, 사용자 지정)
   *
   * 멀티에서 씬을 얹으면 `update()` 가 통째로 멈춘다 — **내 게이지만** 멈추고 상대는
   * 계속 오른다. 그게 사용자가 신고한 악용의 뿌리였다(*"상대방이 신발 100개이상
   * 먹을때까지 기다렸다가, 일시정지 풀고, 죽은 다음 부활을 누르는 악행"*).
   * 멀티의 메뉴는 `GameScene.openMenu()` 가 그린다 — 씬을 안 얹으므로 게임이 계속 돈다.
   */
  buildItems() {
    const resume = { label: S.resume, run: () => { Sfx.play('sfx_menu_back'); Scene.pop(); } };
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
     * ★ **부활 창은 지갑과 무관하게 항상 6초다.** (2026-08-21 26차, 사용자 지정)
     *
     * 10초는 *"너무 게임이 루즈해짐, 10초동안 기다렸다가 1초 남았을때 부활을 한다면
     * 쉬는 시간이 생겨버리니깐"*. 그리고 이 6초는 **이탈 유예와 같은 숫자**다 —
     * 1등이 죽으면 이 창이 그대로 상대의 반격 시간이 되기 때문이다.
     */
    const 창초 = MULTI.reviveWindowSeconds;
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
      if (inRect(x, y, 16, 178, 148, 34)) { this.revive(); return true; }
      if (inRect(x, y, 16, 220, 148, 26)) { this.quit(); return true; }
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

  /**
   * ★ **판돈과 지갑을 매 프레임 다시 세지 않는다.** (2026-08-19 8차)
   *
   * `potShoes()` 는 참가자 전원의 `given` 을 훑는 정산 계산이고, `getProfile()` 은
   * **localStorage 를 읽어 JSON 을 파싱하고 신발 130칸을 순회**한다
   * (`storageLocal.reconcile`). 그 둘이 `render()` 안에 있었으니 초당 60번씩 돌았다.
   *
   * 둘 다 **방 스냅샷이 바뀔 때만** 달라진다(지갑은 내가 부활을 눌렀을 때만).
   * 그래서 방 객체의 정체성을 열쇠로 쓴다 — `subscribeRoom` 이 스냅샷마다 새 객체를
   * 주므로 값이 바뀌면 반드시 열쇠도 바뀐다.
   */
  pot() {
    const room = this.game.room;
    if (this._potRoom !== room) { this._potRoom = room; this._pot = potShoes(room); }
    return this._pot;
  }

  wallet() {
    if (this._wallet === undefined) this._wallet = getProfile().shoesOwned ?? 0;
    return this._wallet;
  }

  /** 지갑이 실제로 바뀌었을 때만 다시 읽는다 (부활 성공·실패 환불) */
  invalidateWallet() { this._wallet = undefined; }

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
    this.invalidateWallet();

    /**
     * ② 판돈과 부활을 **한 번의 쓰기로** 올린다(`reviveMe`). 전부 되거나 전부 안 된다.
     * `null` 은 서버를 다시 읽어 "정말 안 들어갔다"를 확인한 뒤에만 온다 —
     * 그래서 여기서 되돌려도 신발이 복제되지 않는다.
     */
    const floor = await Room.reviveMe(this.game.multi.code, picked).catch(() => null);
    if (floor == null) {
      L.addShoes(picked);
      this.invalidateWallet();
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

  /**
   * 부활을 포기한다 — **곧장 결과로 가지 않는다.** (2026-08-21 26차)
   *
   * 내가 1등이면 남은 사람에게 6초가 주어지고, 그동안 나는 게임 화면을 보며
   * 카운트다운만 볼 수 있다(`GameScene.beginExit`). 그 6초가 없으면
   * "부활 → 즉사 → 나가기"가 그대로 필승법이 된다(§9-0-55).
   *
   * 기준 시각은 `deadAt` 이라 **이미 부활 창에서 쓴 시간이 빠진다** — 창을 끝까지
   * 흘려보낸 사람은 유예가 0이라 그 자리에서 끝난다.
   */
  quit() {
    if (this.busy) return;
    this.busy = true;
    Sfx.play('sfx_menu_back');
    Room.declineRevive(this.game.multi.code).catch(() => {});
    Scene.pop();
    this.game.beginExit('home');
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
    /**
     * ★ **여백을 다시 잡았다.** (2026-08-19)
     * 제목 → 남은 초 → 상금 → 내 지갑 → 버튼 두 개가 서로 붙어 있어서 급해 보였다.
     * 패널을 위아래로 늘리고 줄 사이를 벌린다.
     */
    panelBox(12, 84, 156, 172);

    text(S.fellTitle, 90, 92, { color: PAL.goRed, align: 'center' });

    /**
     * ★ **카운트다운 칸을 따로 판다.** (2026-08-19, 사용자 요청)
     *
     * 숫자가 제목·상금과 같은 바닥에 얹혀 있어서 어디까지가 "남은 시간"인지 경계가
     * 없었다. 살짝 어두운 칸을 깔고 위아래로 여백을 주면 그 칸이 곧 시계가 된다.
     * 숫자에는 **외곽선**을 둘러 크림색 패널 위에서도 획이 또렷하게 선다
     * (배율 3이라 외곽선 한 겹이 3도트로 두껍게 나온다).
     */
    // 배율 3 숫자는 높이가 33도트다 — 위아래 4~5도트 여백을 두려면 칸이 42여야 한다
    const CD = { x: 50, y: 106, w: 80, h: 42 };
    rect(CD.x, CD.y, CD.w, CD.h, PAL.panelDark);
    strokeRect(CD.x, CD.y, CD.w, CD.h, PAL.boxLine);
    text(String(this.left), 90, CD.y + 4, {
      color: PAL.text, outline: PAL.textShadow, scale: 3, align: 'center', mono: true });

    // 판돈은 이 화면의 핵심 정보다 — 얼마가 걸려 있는지 알아야 걸지 말지 정한다
    // 상금은 크게(11px), 내 지갑은 한 단계 작게(7px) — 무엇이 중요한지 크기로 말한다
    /**
     * 상금 줄 — 인게임 하단과 **같은 문구**(`1등하면 신발 N켤레!`)에 외곽선을 둘러
     * 배경 위에서도 읽히게 한다. (2026-08-19)
     *
     * 그 아래 있던 `나의 남은 신발 N켤레` 줄은 **지웠다** — 어두운 색(textShadow)이라
     * 배경에 묻혀 "검은 숫자만 떠 있는" 것처럼 보였고, 부활 여부는 버튼이 활성인지로
     * 이미 알 수 있어서 정보가 겹쳤다(사용자 요청).
     */
    text(S.potWin(this.pot()), 90, 154, {
      color: PAL.gaugeWarn, outline: PAL.textShadow, align: 'center' });
    /**
     * 그 바로 아래 **한 단계 작은 검은 글씨**로 내 잔고 (2026-08-19, 사용자 요청).
     * 한 번 지웠다가 되살렸다 — 지난번엔 배경 위에 떠 있어 묻혔는데, 이제는 크림색
     * 패널 안이라 검은 글씨가 오히려 또렷하다. 걸지 말지 정하려면 "얼마 걸리나"와
     * "내가 얼마 가졌나"가 나란히 있어야 한다.
     */
    const have = this.wallet();
    text(S.myShoes(have), 90, 168, { color: PAL.boxLine, align: 'center', small: true });

    const 가능 = canRevive(this.me) && have >= MULTI.reviveCost && !this.busy;
    button(16, 182, 148, 34, 가능);
    /**
     * 못 누르는 상태(신발 부족·부활 소진)도 **읽히기는 해야 한다.**
     * 예전엔 어두운 `textShadow` 색이라 어두운 버튼 위에서 글자가 뭉개져 보였다
     * (미리보기로 확인). 흐린 회색 + 어두운 외곽선이면 "꺼져 있지만 읽힌다".
     */
    const c = 가능 ? PAL.text : PAL.deadGray;
    /**
     * 부활 버튼 문구 — 두 줄 7px 이던 것을 **한 줄 11px + 외곽선**으로 바꿨다.
     * (`신발 20개 써서 / 1위로 부활` → `신발 20개로 부활`, 2026-08-19 사용자 요청)
     * 11px 는 7px 대비 두 단계 위다(이 게임의 폰트는 두 벌뿐이라 그게 최대 단계다).
     */
    text(S.reviveWith(MULTI.reviveCost), 90, 193, {
      color: c, outline: PAL.textShadow, align: 'center' });

    button(16, 222, 148, 26, false);
    text(S.quitRound, 90, 229, { color: PAL.text, align: 'center' });

    if (this.msg) text(this.msg, 90, 252, { color: PAL.goRed, align: 'center', small: true });
  }
}
