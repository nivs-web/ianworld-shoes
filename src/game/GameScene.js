/**
 * 싱글 게임 씬 — M2 코어 게임플레이 조립.
 *
 * 루프: 입력 → (전환|상승|추락) → 게이지 → 애니메이션 → 렌더.
 * 이동은 스냅(보간 없음), 배경은 계단 상승량과 동일 픽셀로 스크롤.
 */

import * as Scene from '../core/scene.js';
import { clear } from '../core/canvas.js';
import { consumeInput, clearInput, setTapHandler, setPauseHandler, BTN } from '../core/input.js';
import { loadAll, img } from '../core/assets.js';
import { randomSeed, Rng } from '../core/rng.js';
import { text } from '../core/pixelfont.js';
import {
  DIFFICULTY, GAUGE_MAX, drainAt, REVIVE, SHOE_TIERS, tierWeights,
} from '../config/balance.js';
import { STAIR, CENTER_X, VIEW_W, VIEW_H } from '../config/layout.js';
import { BUILDINGS, buildingAssets, floorAsset, FLOOR_BACKGROUNDS } from '../data/backgrounds.js';
import { Stairs } from './stairs.js';
import { Player, P_STATE } from './player.js';
import { Background } from './background.js';
import { renderHud } from './hud.js';
import { PauseOverlay, ReviveOverlay, GameOverOverlay, MultiDeathOverlay } from './overlays.js';
import { PAL } from './palette.js';
import { get as getProfile, dexUnique } from '../services/profile.js';
import * as Sfx from '../audio/sfx.js';
import * as Bgm from '../audio/bgm.js';
import { AUDIO, SHOE_RARE_TIER_MAX, bgmTrackAt, MULTI } from '../config/balance.js';
import shoesData from '../data/shoes.json';
import * as Room from '../services/multiplayer.js';
import { roundOver, othersAllOut, slotIndex } from '../services/matchRules.js';
import S from '../config/strings.ko.js';
import { multiHud, TICKER_MS } from './multiHud.js';

export class GameScene {
  /**
   * @param {object} [opt]
   * @param {string} [opt.difficulty] 'easy'|'normal'|'hard'
   * @param {string} [opt.charId]
   * @param {number} [opt.seed]
   * @param {number} [opt.controlMode] 1|2|3
   * @param {number} [opt.startFloor] 엘리베이터로 건너뛴 시작 층수 (기획서 §5-8-1)
   * @param {(result:object, action:'home'|'retry')=>void} [opt.onFinish]
   *        판이 끝났을 때. 'home'이면 로비로, 'retry'면 같은 설정으로 새 판.
   *        어느 쪽이든 **결과는 먼저 계정에 반영된다** — 다시하기를 눌렀다고
   *        방금 주운 신발이 사라지면 안 된다.
   */
  constructor(opt = {}) {
    this.diff = DIFFICULTY[opt.difficulty ?? 'normal'];
    this.charId = opt.charId ?? 'ian';
    this.seed = opt.seed ?? randomSeed();
    this.controlMode = opt.controlMode ?? 1;
    this.startFloor = opt.startFloor ?? 0;
    this.onFinish = opt.onFinish ?? null;
    /**
     * ★ **판이 끝나는 순간 결과를 계정에 반영한다.** (2026-08-18)
     * 예전에는 게임오버 화면의 **버튼을 눌러야만** 저장됐다. 죽고 나서 전화가 오거나
     * 앱을 닫으면 300계단도, 그 판에 주운 신발도 전부 사라졌다. 판이 끝난 그 자리에서
     * 부르는 콜백을 두고, 나중에 `leave()` 가 또 반영하지 않도록 `committed` 로 막는다.
     */
    this.onCommit = opt.onCommit ?? null;
    this.committed = false;
    /** 판이 끝났다 — 입력도 게이지도 멈춘다 (결과 확정을 기다리는 동안 계속 돌면 안 된다) */
    this.over = false;
    /** `leave()` 재진입 방지 */
    this.leaving = false;
    /**
     * 멀티일 때만 채워진다: { code, startAt }.
     * `startAt` 은 **서버 시각 기준 절대값**이라, 각자 자기 시계 오차를 빼고
     * 그 순간에 출발하면 네 명이 같은 계단에서 시작한다.
     */
    this.multi = opt.multi ?? null;
    this.opponents = [];
    /** 마지막으로 받은 방 스냅샷 — 판돈·부활 위치를 여기서 읽는다 */
    this.room = null;
    /** 인게임 알림 큐 (낙사·부활) */
    this.ticker = [];
    this.countdownMs = 0;
    this.roomUnsub = null;
    this.ready = false;
  }

  enter() {
    this.stairs = new Stairs(
      this.seed,
      { gapMin: this.diff.shoeGapMin, gapMax: this.diff.shoeGapMax },
      /**
       * 도감을 100종 넘게 모았으면 1·2티어가 5분의 1로 줄어든다 (balance.DEX_LATE_GAME).
       * **멀티에서는 끈다** — 각자의 도감을 반영하면 같은 시드인데도 사람마다
       * 다른 신발이 나와서 승부가 성립하지 않는다.
       */
      tierWeights(this.multi ? 0 : dexUnique())
    );
    this.player = new Player(this.charId);
    this.floor = this.startFloor;
    this.gauge = GAUGE_MAX;
    this.started = false; // 첫 입력부터 게이지가 줄기 시작
    this.shoesFound = 0;
    this.revives = 0;
    this.reviveEarned = 0; // 이미 지급한 부활 수 (balance.REVIVE.shoesPerRevive 개마다 1개)
    this.overlayDone = false;
    this.over = false;
    this.committed = false;
    this.leaving = false;
    this.ticker = [];
    /** 함성 발동용 — 실수 없이 연속으로 오른 칸 수 (기획서 §9-7-1) */
    this.stepStreak = 0;
    /** 이번 판에 주운 신발 index 목록 — 판이 끝나면 도감·자산에 반영한다 */
    this.shoeIndices = [];
    // 판이 시작되면 1번 트랙부터 (재시작 포함). 오디오가 아직 잠겨 있으면 조용히 무시된다.
    Bgm.forceTrack(bgmTrackAt(this.floor) + 1);
    Bgm.startBgm();

    // 인트로: 정면 → 팝 → 대기 → 첫 계단 방향으로 전환 (기획서: 시작인터페이스)
    this.player.introFacing = this.stairs.nextDir(this.floor);
    this.player.facing = this.player.introFacing;

    // 배경: 16종 중 랜덤 1종
    const pick = new Rng(this.seed ^ 0x5eed).pick(BUILDINGS);
    this.bg = new Background(pick.id);

    // 에셋 로드 (캐시돼 있으면 즉시)
    const a = buildingAssets(pick.id);
    const list = [
      { key: `${this.charId}_front`, url: `/assets/characters/${this.charId}_front.png` },
      { key: `${this.charId}_side`, url: `/assets/characters/${this.charId}_side.png` },
      { key: `${this.charId}_jump`, url: `/assets/characters/${this.charId}_jump.png` },
      { key: 'shoes_game', url: '/assets/shoes/shoes_game.png' },
      { key: 'shoes_worn', url: '/assets/shoes/shoes_worn.png' },
      { key: 'shoe_icon', url: '/assets/shoes/shoe_icon.png' },
      { key: `${pick.id}_road`, url: a.road },
      { key: `${pick.id}_floor1`, url: a.floor1 },
      { key: `${pick.id}_tile`, url: a.tile },
      ...FLOOR_BACKGROUNDS.map((f) => ({ key: f.key, url: floorAsset(f.key) })),
      { key: 'stair', url: '/assets/ui/stair.png' },
      { key: 'btn_turn', url: '/assets/ui/btn_turn.png' },
      { key: 'btn_up', url: '/assets/ui/btn_up.png' },
      { key: 'btn_left', url: '/assets/ui/btn_left.png' },
      { key: 'btn_right', url: '/assets/ui/btn_right.png' },
      { key: 'gauge_frame', url: '/assets/ui/gauge_frame.png' },
      { key: 'btn_pause', url: '/assets/ui/btn_pause.png' },
    ];
    this.ready = false;
    loadAll(list).then(() => {
      this.ready = true;
    });

    clearInput();
    this.bindInput();
    if (this.multi) this.enterMulti();
  }

  /** 멀티 전용 준비 — 출발 시각 맞추기 + 상대 진행도 구독 */
  enterMulti() {
    /**
     * ★ **출발 시각은 "언제"이지 "몇 프레임 뒤"가 아니다.** (2026-08-16)
     *
     * 예전에는 남은 시간을 한 번 재 두고 매 프레임 `1000/60` 씩 깎았다. 그런데
     * `update()` 는 에셋 로딩 중이면 그 앞에서 통째로 멈추고(`if (!this.ready) return`),
     * 탭이 가려져도 루프 자체가 선다. 그래서 **캐시가 빈 기기는 로딩에 쓴 5초만큼
     * 늦게 출발했다** — 같은 시드로 같은 계단을 보는 의미가 사라진다.
     *
     * 지금은 **내 시계 기준 절대 시각**을 하나 잡아 두고 매 프레임 다시 뺀다.
     * 로딩이 길든 탭이 가려졌든 남은 시간은 실제 시간대로 흐른다.
     */
    this.startAtLocal = this.multi.startAt ?? 0;
    /**
     * ★ **살아 있다는 신호를 5초마다 보낸다.** (2026-08-19)
     *
     * 렉으로 튕긴 사람은 서버에 `alive: true` 로 남는다. 그러면 판이 **영원히 안 끝나고**
     * 순위가 안 박혀 아무도 정산을 못 한다 — 항아리에 걸린 신발까지 통째로 묶인다.
     * 그래서 "아직 여기 있다"를 주기적으로 알린다.
     *
     * 진행도 쓰기로는 부족하다 — 일시정지 중이거나 죽어서 부활을 고르는 20초 동안에는
     * 계단이 안 바뀌어 아무 쓰기도 안 나간다. 신호는 **씬이 살아 있는 한** 계속 간다.
     */
    this.beat = setInterval(() => {
      if (this.over || this.leaving) return;
      // **방에 내가 있을 때만 보낸다.** 방이 지워졌거나 내가 빠진 뒤에 쓰면
      // `players/내uid/seenAt` 하나짜리 유령 노드를 새로 만들 수 있다.
      if (!this.room?.players?.[this.multi.myUid]) return;
      Room.heartbeat(this.multi.code).catch(() => {});
    }, MULTI.heartbeatMs);
    Room.msUntilStart(this.multi.startAt ?? 0).then((ms) => {
      // 서버 시계로 다시 잰다. 내 시계가 몇 초 어긋나 있어도 여기서 바로잡힌다
      this.startAtLocal = Date.now() + Math.max(0, ms);
    });
    this.roomUnsub = Room.subscribeRoom(this.multi.code, (r) => {
      if (!r) return;
      this.room = r;
      const uid = this.multi.myUid;
      /**
       * ★ **대기자(`waiting`)는 이번 판 사람이 아니다.** (2026-08-16)
       * 게임 중에 들어와 다음 판을 기다리는 사람이다. HUD 에 띄우면 0계단짜리 유령이
       * 하나 붙고, 종료 판정에도 끼어들어 판을 망친다.
       */
      /**
       * ★ **자리 번호를 여기서 붙인다.** (2026-08-19)
       * 색이 곧 신원이다 — 인게임에는 아이디를 아예 안 쓰기 때문에, 대기방에서 본
       * 번호·색이 그대로 레이스 게이지의 얼굴 테두리 색이 되어야 한다.
       */
      const next = Object.entries(r.players ?? {})
        .filter(([id, v]) => id !== uid && !v?.waiting)
        .map(([id, v]) => ({ id, slot: slotIndex(r.players, id), ...v }));
      this.mySlot = slotIndex(r.players, uid);
      this.myRevives = r.players?.[uid]?.revives ?? 0;

      /**
       * ★ **낙사·부활을 그 자리에서 알려 준다.** (2026-08-18)
       * 역전이 재미의 전부인데, 상대가 내 앞으로 튀어나온 걸 모르면 역전당한 줄도 모른다.
       * 판정은 **이전 스냅샷과의 차이**로 한다 — 서버가 이벤트를 주지 않으므로.
       */
      for (const o of next) {
        const was = this.opponents.find((p) => p.id === o.id);
        if (!was) continue;
        // 이름 대신 **자리 색**으로 부른다 — 인게임에는 아이디가 없고, 색이 곧 신원이다
        const color = S.slotColorName[o.slot] ?? S.slotColorName[0];
        if ((o.revives ?? 0) > (was.revives ?? 0)) {
          // 부활 알림만 짧은 색 이름을 쓴다 — "노랑, 1등 부활" (2026-08-19)
          const colorShort = S.slotColorShort[o.slot] ?? S.slotColorShort[0];
          this.notify(S.someoneRevived(colorShort));
          Sfx.play('sfx_revive');
        } else if (was.alive !== false && o.alive === false) {
          this.notify(S.someoneFell(color));
        } else if (!was.out && o.out) {
          this.notify(S.someoneOut(color));
        }
      }
      this.opponents = next;

      /**
       * ★ **판이 끝나는 조건이 바뀌었다.** (2026-08-18)
       * 예전: 누구든 한 명이 죽으면 전원 종료.
       * 지금: **전원이 죽고 아무도 부활하지 않을 때**. 그때까지는 각자 계속 오른다.
       *
       * 내가 살아 있는데 남들이 전부 빠졌으면 혼자 뛸 이유가 없으므로 거기서 끝낸다.
       */
      const now = Date.now() + (Room.serverOffsetSync?.() ?? 0);
      if (!this.over) {
        /**
         * ★ **순위가 박혔으면 무조건 끝이다.** (2026-08-19)
         * 내가 잠깐 튕긴 사이에 남들이 판을 끝냈을 수 있다. 그때 내 화면만 계속 돌면
         * 이미 끝난 판을 혼자 오르다가, 결과 화면에서야 "왜 내 계단이 반영이 안 됐지"가 된다.
         */
        if (r.result?.rankings || r.state === 'finished') this.endMulti();
        else if (roundOver(r, now)) this.endMulti();
        else if (!this.player?.dead && othersAllOut(r, uid, now)) this.endMulti();
      }
    });
  }

  /** 인게임 알림 한 줄 — 몇 초 떠 있다 사라진다 (multiHud 가 그린다) */
  notify(msg) {
    this.ticker.push({ msg, until: Date.now() + TICKER_MS });
    if (this.ticker.length > 3) this.ticker.shift();
  }

  /** 이번 판의 성과 — 로비/결과 화면이 계정에 반영할 때 쓴다 */
  resultOf() {
    return { floor: this.floor, difficulty: this.diff.id, shoeIndices: this.shoeIndices };
  }

  /** 멀티 종료 — 부활 없이 곧장 정산으로 (기획서 §5-6 '멀티는 부활 없음') */
  endMulti() {
    if (this.over || this.leaving) return;   // 두 번 부르면 결과 화면이 두 개 뜬다
    this.over = true;
    Bgm.stopBgm();
    this.roomUnsub?.();
    this.roomUnsub = null;
    clearInterval(this.beat);
    this.beat = null;
    Room.publishProgress(this.multi.code, {
      stairs: this.floor, shoesFound: this.shoesFound, alive: !this.player?.dead,
    }, true);
    /**
     * ★ **판에서 손을 뗐다는 도장을 반드시 찍는다.** (2026-08-18 재수정)
     *
     * 마지막까지 살아남아 판을 끝낸 사람은 `alive: true` 로 남는다. 종료 판정이
     * "전원 죽었나"만 보던 시절에는 그 한 명 때문에 **판이 영원히 안 끝났다** —
     * 모두가 결과 화면에서 "다른 사람들이 아직 오르고 있습니다"를 보며 굳는다.
     * 죽어서 끝났든 살아서 끝났든, 나갈 때 이 도장을 찍으면 남들이 기다리지 않는다.
     */
    Room.markOut(this.multi.code).catch(() => {});
    // 결과를 넘긴다 — 예전에는 null 이라 이 판의 신발·계단이 통째로 버려졌다
    this.onFinish?.(this.resultOf(), 'multi');
  }

  exitMulti() {
    this.roomUnsub?.();
    this.roomUnsub = null;
    clearInterval(this.beat);
    this.beat = null;
  }

  resume() {
    clearInput();
    this.bindInput();
  }

  /**
   * 인게임 입력 연결.
   *
   * 좌우 판정은 input.js 가 **화면 절반**으로 처리한다(layout.TOUCH). 여기서는
   * "일시정지"만 맡는다 — 화면 상단 탭·ESC·게임패드 Start 가 전부 이 하나로 모인다.
   * tapHandler 를 비독점(exclusive=false)으로 두어야 나머지 영역이 좌우로 흘러간다.
   */
  bindInput() {
    const pause = () => {
      if (this.player.dying) return;
      /**
       * ★ **끝난 판에서는 일시정지가 안 열린다.** (2026-08-18)
       * 멀티 종료는 `finalizeResult`(RTDB 왕복)를 기다리는 동안 화면이 그대로 남는다.
       * 그 사이에 상단을 눌러 일시정지 → 기권을 하면 `leave()` 가 또 불려
       * **결과 화면이 두 개** 뜨고 정산이 두 번 돌았다(신발 이중 차감).
       */
      if (this.over || this.leaving) return;
      if (Scene.current() !== this) return; // 이미 오버레이가 떠 있다
      Scene.push(new PauseOverlay(this));
    };
    setPauseHandler(pause);
    setTapHandler(null, false);
  }

  exit() {
    setTapHandler(null);
    setPauseHandler(null);
    this.exitMulti();
  }

  // ── 입력 → 행동 ──────────────────────────────

  /**
   * 버튼 입력 → 행동.
   *
   * **두 버튼 모두 한 칸 올라간다** (「무한의 계단」과 동일).
   *   · 상승 버튼   : 지금 보는 방향 그대로 올라간다
   *   · 방향전환 버튼: 방향을 반대로 바꾸면서 올라간다
   * 즉 매 순간 둘 중 하나만 정답이고, 틀린 쪽을 누르면 추락한다.
   * (2026-08-14 수정 — 이전에는 전환 버튼이 제자리에서 방향만 바꿔서 리듬이 죽었다)
   *
   * @param {'L'|'R'} btn
   */
  action(btn) {
    if (this.player.dying) return;
    // 인트로 연출 중에는 입력을 받지 않는다
    if (this.player.inIntro) return;
    // 이펙트 컷 중에도 즉시 처리한다 (착착착 리듬이 끊기면 안 된다)
    this.started = true;

    /** 이번 입력으로 향하게 될 방향 */
    let facing;
    if (this.controlMode === 3) {
      // 좌상승 / 우상승 — 버튼이 곧 방향
      facing = btn === BTN.LEFT ? -1 : 1;
    } else {
      const turnBtn = this.controlMode === 1 ? BTN.LEFT : BTN.RIGHT;
      facing = btn === turnBtn ? -this.player.facing : this.player.facing;
    }

    const need = this.stairs.nextDir(this.floor);
    if (facing !== need) {
      this.player.facing = facing; // 틀린 방향을 본 채로 추락한다
      this.die();
      return;
    }

    // 상승 성공
    this.floor++;
    this.player.climb(need);
    this.gauge = Math.min(GAUGE_MAX, this.gauge + this.diff.stepReward);
    Sfx.playStep();
    Bgm.setFloor(this.floor);

    // 함성 — 매 칸마다 지르면 시끄러우니 N연속 무실수마다 1회
    this.stepStreak++;
    if (this.stepStreak % AUDIO.shout.streak === 0) Sfx.playShout(this.charId);

    // 신발 획득
    const shoe = this.stairs.takeShoe(this.floor);
    if (shoe !== undefined) {
      this.player.wear(shoe);
      this.shoesFound++;
      this.shoeIndices.push(shoe);
      // 1·2티어는 특별 징글 + 함성 무조건 (연속 수와 무관)
      const tier = shoesData.shoes[shoe]?.tier ?? 5;
      if (tier <= SHOE_RARE_TIER_MAX) {
        Sfx.play('sfx_shoe_rare');
        Sfx.playShout(this.charId);
      } else {
        Sfx.play('sfx_shoe_get');
      }
      this.gauge = Math.min(GAUGE_MAX, this.gauge + this.diff.shoeReward);
      // 부활 지급 (싱글 전용, 신발 REVIVE.shoesPerRevive 개당 1개)
      const earned = Math.floor(this.shoesFound / REVIVE.shoesPerRevive);
      if (earned > this.reviveEarned) {
        this.revives += earned - this.reviveEarned;
        this.reviveEarned = earned;
      }
    }
  }

  die() {
    if (this.player.dying) return;
    this.stepStreak = 0;
    Sfx.play('sfx_death');
    this.player.die();
  }

  /**
   * ★ **멀티 부활 — 1위보다 앞 계단에서 되살아난다.** (2026-08-18)
   *
   * 계단은 전원이 같은 시드로 만들므로 **어느 층으로든 그냥 옮겨 놓으면 된다**
   * (엘리베이터가 쓰는 `startFloor` 와 같은 원리다). 게이지는 가득 채운다 —
   * 20켤레를 걸었는데 반쯤 닳은 게이지로 시작하면 베팅이 성립하지 않는다.
   *
   * @param {number} floor 되살아날 층
   */
  reviveAt(floor) {
    this.floor = floor | 0;
    this.gauge = GAUGE_MAX;
    /**
     * `dead`·`dying` 은 **state 에서 파생되는 getter** 다 — 대입하면 그 자리에서 터진다
     * (ESM 은 strict mode). 되살리려면 상태와 추락 연출 값만 되돌리면 된다.
     */
    this.player.state = P_STATE.IDLE;
    this.player.timer = 0;
    this.player.fallY = 0;
    this.player.fallVy = 0;
    this.player.facing = this.stairs.nextDir(this.floor);
    this.player.shoe = this.player.deadShoe ?? this.player.shoe;
    this.player.deadShoe = null;
    this.overlayDone = false;
    this.started = true;
    Bgm.setFloor(this.floor);
    clearInput();
  }

  /** 부활 (ReviveOverlay에서 호출) */
  doRevive() {
    Sfx.play('sfx_revive');
    this.revives--;
    this.gauge = REVIVE.gaugeOnRevive;
    this.player.state = P_STATE.IDLE;
    this.player.facing = this.stairs.nextDir(this.floor);
    this.player.shoe = this.player.deadShoe;
    this.player.deadShoe = null;
    this.overlayDone = false;
    clearInput();
  }

  // ── 갱신 ─────────────────────────────────────

  update() {
    if (!this.ready) return;
    /**
     * ★ **끝난 판은 더 돌지 않는다.** (2026-08-18)
     * 멀티 종료는 `finalizeResult`(RTDB 왕복 두 번)를 기다린 뒤에야 화면이 바뀐다.
     * 그동안 이 루프가 계속 돌아서 **게이지가 마저 닳아 사망음이 결과 화면 위로 겹쳤고**,
     * 끝난 뒤의 계단이 서버에 덮어써져 순위표와 방 기록이 어긋났다.
     */
    if (this.over) return;

    /**
     * 멀티 출발 게이트. 카운트다운이 남아 있으면 **입력도 게이지도 멈춘다** —
     * 먼저 누른 사람이 먼저 출발하면 같은 시드를 쓰는 의미가 없다.
     * 남은 시간은 서버 시각 기준으로 재 뒀다(enterMulti).
     */
    if (this.multi) {
      this.countdownMs = Math.max(0, (this.startAtLocal ?? 0) - Date.now());
      if (this.countdownMs > 0) {
        clearInput();
        return;
      }
    }

    const btn = consumeInput();
    if (btn) this.action(btn);

    const prevState = this.player.state;
    this.player.update();
    // STARE → FALL 로 넘어가는 그 순간에 추락음 (죽자마자 내면 좌절 3음과 겹친다)
    if (prevState === P_STATE.STARE && this.player.state === P_STATE.FALL) Sfx.play('sfx_fall');
    if (this.player.inIntro) return; // 인트로 동안은 게이지 정지

    // 게이지
    if (this.started && !this.player.dying) {
      this.gauge -= drainAt(this.diff, this.floor) / 60;
      if (this.gauge <= 0) {
        this.gauge = 0;
        this.die();
      }
    }

    // 진행도 전송 (스로틀은 multiplayer.js 안에 있다)
    if (this.multi && !this.player.dead) {
      Room.publishProgress(this.multi.code, {
        stairs: this.floor, shoesFound: this.shoesFound, alive: true,
      });
    }

    // 사망 처리 → 부활 or 게임오버
    if (this.player.dead && !this.overlayDone) {
      this.overlayDone = true;
      /**
       * 멀티는 부활이 없고(기획서 §5-6), 내가 죽는 순간 **방 전체가 끝난다**.
       * 그래서 게임오버 오버레이를 띄우지 않고 곧장 정산 화면으로 넘어간다 —
       * 여기서 '다시하기'를 보여 주면 남들은 이미 결과 화면인데 나만 딴 판을 하게 된다.
       */
      /**
       * ★ **멀티에서 죽으면 20초의 부활 창이 열린다.** (2026-08-18 역전 배틀)
       * 예전에는 곧장 정산 화면으로 갔다("멀티는 부활 없음"). 이제는 신발을 걸고
       * **1위보다 20칸 앞**에서 되살아날 수 있다 — 그게 이 게임의 승부다.
       * 판은 여기서 안 끝난다. 남은 사람들은 계속 오르고 있다.
       */
      if (this.multi) {
        Room.reportDeath(this.multi.code, { stairs: this.floor, shoesFound: this.shoesFound });
        Scene.push(new MultiDeathOverlay(this));
        return;
      }
      if (this.revives > 0) {
        Scene.push(new ReviveOverlay(this));
      } else {
        this.finish();
      }
    }
  }

  finish() {
    Bgm.stopBgm();
    /**
     * ★ **여기서 계정에 반영한다.** (2026-08-18)
     * 게임오버 패널이 뜬 그 순간이 판의 끝이다. 버튼을 눌러야만 저장하던 예전 구조는
     * 죽자마자 앱을 닫은 사람의 판을 통째로 버렸다. `bestSoFar()` 가 이번 판을 포함해
     * 계산하므로 **반영 전에** 먼저 읽는다 — 안 그러면 방금 넣은 기록과 비교하게 된다.
     */
    const best = this.bestSoFar();
    this.commitRun();
    Scene.push(new GameOverOverlay(this, best));
  }

  /** 이번 판 결과를 계정에 한 번만 반영한다 */
  commitRun() {
    if (this.committed || !this.onCommit) return;
    this.committed = true;
    try { this.onCommit(this.resultOf()); } catch (e) { console.warn('[game] 결과 반영 실패', e); }
  }

  /** 게임오버 패널에 띄울 BEST — 이번 판을 포함한 값 */
  bestSoFar() {
    const p = getProfile();
    return Math.max(p.bestByDifficulty?.[this.diff.id] ?? 0, this.floor);
  }

  /**
   * 판을 떠난다 — 결과를 반영하고 로비로 돌아가거나 새 판을 연다.
   *
   * onFinish 가 없으면 **나갈 방법이 사라진다**. 예전에 일시정지 '맵바꾸기'가
   * onFinish 없이 새 GameScene 을 만들어서, 그 뒤로 죽어도 로비로 못 나가는
   * 버그가 있었다. 조용히 무시하지 말고 소리를 내게 둔다.
   *
   * @param {'home'|'retry'} action
   */
  leave(action) {
    /**
     * ★ **두 번 나가지 않는다.** (2026-08-18)
     * 멀티에서 결과 확정을 기다리는 사이 일시정지 → 나가기를 누르면 `onFinish` 가
     * 두 번 불려 **결과 화면이 두 개** 뜨고, 각자 정산을 돌려 패자가 신발을 두 번 냈다
     * (한 켤레는 아무도 못 받고 증발한다).
     */
    if (this.leaving || this.over) return;
    this.leaving = true;
    Bgm.stopBgm();
    const result = this.committed ? null : this.resultOf();
    this.committed = true;
    this.over = true;
    if (!this.onFinish) {
      console.error('[game] onFinish 가 없어 로비로 돌아갈 수 없다 — GameScene 생성부를 확인할 것');
      return;
    }
    /**
     * ★ **멀티에서 중도 이탈은 곧 사망이다.** (2026-08-16)
     *
     * 예전에는 일시정지 → `로비로나가기` 가 `reportDeath()` 없이 곧장 `finalizeResult()`
     * 로 갔다. 순위 확정은 **먼저 부른 사람이 그 시점 진행도로 못 박는** 트랜잭션이라,
     * 신발 하나 먼저 줍고 일시정지(내 게이지만 멈춘다) → 나가기 = **이기고 도망**이었다.
     * 게다가 내 `alive` 가 `true` 로 남아 **남은 사람은 자기가 죽을 때까지 방이 안 끝났다.**
     *
     * 그래서 나가기 전에 죽었다고 알리고 구독을 끊는다. 그러면 남은 사람들 화면도
     * 정상적으로 종료되고, 순위도 내 실제 진행도로 매겨진다.
     */
    if (this.multi) {
      Room.reportDeath(this.multi.code, { stairs: this.floor, shoesFound: this.shoesFound })
        .catch(() => {});
      // 기권은 부활할 생각이 없다는 뜻이다 — 안 찍으면 남들이 20초를 헛기다린다
      Room.markOut(this.multi.code).catch(() => {});
      this.exitMulti();
    }
    this.onFinish(result, action);
  }

  // ── 렌더 ─────────────────────────────────────

  render() {
    if (!this.ready) {
      clear('#0d0a08');
      text('LOADING', CENTER_X, 150, { color: PAL.text, align: 'center' });
      return;
    }

    // 카메라: 현재 계단과 다음 계단의 중간
    const camX = this.stairs.worldX(this.floor) + ((this.stairs.nextDir(this.floor) * STAIR.gapX) >> 1);

    this.bg.render(this.floor);
    this.stairs.render(this.floor, camX);
    this.player.render(camX, this.stairs.worldX(this.floor));
    renderHud({
      gauge: this.gauge,
      floor: this.floor,
      shoesFound: this.shoesFound,
      // 멀티는 부활이 없으므로 부활 칸 자체를 그리지 않는다 (기획서 §5-6)
      revives: this.multi ? 0 : this.revives,
      controlMode: this.controlMode,
    });
    if (this.multi) multiHud(this);
  }
}

/** 티어 확률 합 검증 (개발 안전장치) */
const probSum = SHOE_TIERS.reduce((s, t) => s + t.prob, 0);
if (Math.abs(probSum - 1) > 1e-6) console.warn('신발 티어 확률 합이 1이 아님:', probSum);
