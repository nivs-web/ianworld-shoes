/**
 * 싱글 게임 씬 — M2 코어 게임플레이 조립.
 *
 * 루프: 입력 → (전환|상승|추락) → 게이지 → 애니메이션 → 렌더.
 * 이동은 스냅(보간 없음), 배경은 계단 상승량과 동일 픽셀로 스크롤.
 */

import * as Scene from '../core/scene.js';
import { clear } from '../core/canvas.js';
import { consumeInput, clearInput, setTapHandler, setPauseHandler, setPauseZone, BTN } from '../core/input.js';
import { loadAll, img } from '../core/assets.js';
import { randomSeed, Rng } from '../core/rng.js';
import { text } from '../core/pixelfont.js';
import {
  DIFFICULTY, GAUGE_MAX, drainAt, REVIVE, SHOE_TIERS, tierWeights,
} from '../config/balance.js';
import { STAIR, CENTER_X, VIEW_W, VIEW_H, HUD } from '../config/layout.js';
import { BUILDINGS, buildingAssets, floorAsset, FLOOR_BACKGROUNDS } from '../data/backgrounds.js';
import { Stairs } from './stairs.js';
import { Player, P_STATE } from './player.js';
import { Background } from './background.js';
import { renderHud, buttonAssets } from './hud.js';
import { PauseOverlay, ReviveOverlay, GameOverOverlay, MultiDeathOverlay } from './overlays.js';
import { PAL } from './palette.js';
import { get as getProfile, dexUnique } from '../services/profile.js';
import * as Sfx from '../audio/sfx.js';
import * as Bgm from '../audio/bgm.js';
import { AUDIO, SHOE_RARE_TIER_MAX, bgmTrackAt, MULTI } from '../config/balance.js';
import shoesData from '../data/shoes.json';
import * as Room from '../services/multiplayer.js';
import { roundOver, othersAllOut, slotIndex, graceOnExit, leaveGraceLeftMs, pauseLeftMs, canPause } from '../services/matchRules.js';
import S from '../config/strings.ko.js';
import { multiHud, multiGhosts, menuHit, TICKER_MS } from './multiHud.js';
import { packItems, parseItems, itemAssetList } from './wornItems.js';

export class GameScene {
  /**
   * @param {object} [opt]
   * @param {string} [opt.difficulty] 'easy'|'normal'|'hard'
   * @param {string} [opt.charId]
   * @param {number} [opt.seed]
   * @param {number} [opt.controlMode] 1|2|3
   * @param {number} [opt.startFloor] 엘리베이터로 건너뛴 시작 층수 (기획서 §5-8-1)
   * @param {(result:object, action:'home'|'retry')=>void} [opt.onFinish]
   * @param {() => void} [opt.onAbsent] 30초 넘게 자리를 비워 판에서 빠졌다 (멀티)
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
    /** 30초 넘게 자리를 비워 판에서 빠졌을 때 (멀티 전용, `kickOut`) */
    this.onAbsent = opt.onAbsent ?? null;
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
    /**
     * 싱글 전용 배경 지정 (설정 → 싱글게임 배경설정, 2026-08-19).
     * `null`/'random' 이면 예전처럼 시드로 뽑는다. **멀티에서는 무시한다** —
     * 네 사람이 서로 다른 건물을 보면 같은 판이 아니게 된다.
     */
    this.forcedBuilding = opt.buildingId && opt.buildingId !== 'random' ? opt.buildingId : null;
    this.opponents = [];
    /** 마지막으로 받은 방 스냅샷 — 판돈·부활 위치를 여기서 읽는다 */
    this.room = null;
    /** 인게임 알림 큐 (낙사·부활) */
    this.ticker = [];
    this.countdownMs = 0;
    this.roomUnsub = null;
    /** 이탈 카운트다운 중인가 (멀티 1등 전용, 6초) */
    this.exiting = false;
    /** 이탈까지 남은 ms — 화면이 이 값을 큰 숫자로 그린다 */
    this.exitLeftMs = 0;
    /** 전원 일시정지에 남은 ms (0이면 안 멈춰 있다) */
    this.pauseLeftMs = 0;
    /** 인게임 메뉴가 열려 있나 — `null` 이면 닫힘 (멀티 전용, 게임은 계속 돈다) */
    this.menu = null;
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
    /**
     * ★ **아이템 쇼핑에서 산 것을 계단 위에서도 입는다.** (2026-08-21 26차 후속)
     * 프로필은 판이 시작될 때 한 번만 읽는다 — 렌더에서 읽으면 `localStorage` 파싱과
     * 신발 130칸 순회를 초당 60번 하게 된다(§9-0-39 에서 한 번 데인 자리다).
     */
    this.myItems = parseItems(packItems(getProfile().equippedItems));
    this.player.items = this.myItems;
    this.floor = this.startFloor;
    this.gauge = GAUGE_MAX;
    this.started = false; // 첫 입력부터 게이지가 줄기 시작
    /**
     * 출발 제한(멀티)에 남은 시간(ms). 0이면 안 그린다.
     * 판이 시작되고 `MULTI.startWithinSeconds` 안에 첫 발을 안 떼면 그 판은 패배다
     * (`failToStart`). 값 자체는 매 프레임 `update()` 가 다시 잰다.
     */
    this.startLeftMs = 0;
    /** 판이 실제로 돌기 시작한 첫 프레임의 시각 — 출발 제한의 기준 */
    this.raceOpenedAt = 0;
    this.shoesFound = 0;
    this.revives = 0;
    this.reviveEarned = 0; // 이미 지급한 부활 수 (balance.REVIVE.shoesPerRevive 개마다 1개)
    this.overlayDone = false;
    this.over = false;
    this.committed = false;
    this.leaving = false;
    this.exiting = false;
    this.exitLeftMs = 0;
    this.pauseLeftMs = 0;
    this.pauseTickAt = 0;
    this.menu = null;
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

    // 배경: 기본은 BUILDINGS 전체(시즌1 14 + 시즌2 30 = 44종) 중 랜덤 1종.
    // 싱글에서 사용자가 골라 뒀으면 그것을 쓴다. 없는 id 면 find 가 undefined 라 랜덤으로 흘러간다.
    const chosen = !this.multi && this.forcedBuilding
      ? BUILDINGS.find((b) => b.id === this.forcedBuilding)
      : null;
    const pick = chosen ?? new Rng(this.seed ^ 0x5eed).pick(BUILDINGS);
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
      { key: 'stair', url: '/assets/ui/stair.png' },
      // 조작 버튼은 **이 모드가 쓰는 두 장만** 받는다 (아래 주석)
      ...buttonAssets(this.controlMode),
      { key: 'gauge_frame', url: '/assets/ui/gauge_frame.png' },
      { key: 'btn_pause', url: '/assets/ui/btn_pause.png' },
      // 내가 착용한 것만 받는다 — 안 산 아이템 스무 장 넘게를 판마다 받을 이유가 없다
      ...itemAssetList(this.myItems),
    ];
    this.ready = false;
    loadAll(list).then(() => {
      this.ready = true;
    });

    /**
     * ★ **층수 배경 9장은 기다리지 않는다.** (2026-08-19 8차)
     *
     * 200층↑ 교체 배경 9장은 **115KB — 판 시작에 받는 전체(257KB)의 44%** 인데,
     * 200층에 닿기 전에는 단 한 장도 안 그린다(`background.js` 가 `floor >= from`
     * 일 때만 쓴다). 그걸 기다리느라 **모든 판의 시작이 늦어지고 있었다.**
     *
     * 그래서 뒤에서 받는다. 200층까지 오르는 데 최소 수십 초가 걸리므로 그때는 이미
     * 도착해 있고, 혹시 없더라도 `img()` 가 null 을 주면 배경이 어두운 색으로
     * 폴백할 뿐 게임은 멈추지 않는다(그 분기가 원래부터 있다).
     */
    loadAll(FLOOR_BACKGROUNDS.map((f) => ({ key: f.key, url: floorAsset(f.key) }))).catch(() => {});

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
    /** 마지막으로 "내가 방에 있다"가 확인된 시각 — 30초 판정의 기준 */
    this.lastSeenOk = Date.now();
    /** 화면을 내려둔 시각 (0 이면 보고 있다) */
    this.hiddenAt = 0;

    const beat = () => {
      if (this.over || this.leaving) return;
      /**
       * ★ **방을 아직 못 받았으면 아무 판단도 하지 않는다.** (2026-08-19 10차)
       *
       * 예전에는 `!this.room?.players?.[uid]` 하나로 판단해서, **첫 스냅샷이 오기 전에도
       * "내가 빠졌다"로 읽고** 5초마다 방 전체를 다시 읽었다(`rejoinIfDropped`).
       * 사용자가 신고한 "방금 만든 거 렉이 있는 것 같다"의 한 갈래가 이 헛왕복이다.
       * 모르는 것을 근거로 움직이면 안 된다 — 방을 받은 뒤에만 따진다.
       */
      const room = this.room;
      if (!room) return;

      if (!room.players?.[this.multi.myUid]) {
        /**
         * 방에 내가 없다. 두 경우가 있고 **처방이 정반대**다.
         *   · 30초 안: 잠깐 끊긴 사이에 예약이 나를 지운 것이다 → 자리를 되찾는다
         *   · 30초 밖: 규칙대로 자리를 잃은 것이다 → 로비로 나간다
         */
        if (Date.now() - this.lastSeenOk <= MULTI.absentSeconds * 1000) {
          Room.rejoinIfDropped(this.multi.code, {
            stairs: this.floor, shoesFound: this.shoesFound,
            alive: !this.player?.dead, revives: this.myRevives | 0,
          }).catch(() => {});
        } else {
          this.kickOut();
        }
        return;
      }
      this.lastSeenOk = Date.now();
      Room.heartbeat(this.multi.code).catch(() => {});
    };
    this.beat = setInterval(beat, MULTI.heartbeatMs);

    /**
     * ★ **30초 안에 돌아오면 계속, 넘기면 로비로.** (2026-08-19 10차, 사용자 지정)
     *
     * 브라우저는 탭이 뒤로 가면 `setInterval` 을 **1분에 한 번**으로 조이고, 폰에서
     * 전화를 받으면 페이지를 통째로 **얼린다.** 그러니 "얼마나 자리를 비웠나"는
     * 타이머로 셀 수 없고, **화면이 내려간 시각과 돌아온 시각의 차이**로 재야 한다.
     *
     * 30초를 넘겼으면 남들은 이미 나를 판에서 뺐다(`matchRules.isStale`, 같은 30초).
     * 그 상태로 혼자 계단을 오르면 아무 의미가 없으므로 **스스로 정리하고 나간다** —
     * 남들의 판정과 내 화면이 어긋나는 구간을 아예 만들지 않는다.
     */
    this.onVisible = () => {
      if (document.hidden) { this.hiddenAt = Date.now(); return; }
      const 비운시간 = this.hiddenAt ? Date.now() - this.hiddenAt : 0;
      this.hiddenAt = 0;
      if (비운시간 > MULTI.absentSeconds * 1000) return this.kickOut();
      /**
       * ★ **자리를 비운 만큼 게이지가 닳는다.** (2026-08-21 26차)
       *
       * 일시정지 버튼을 없애도 **홈 버튼이 그대로 일시정지**다 — `main.js` 의
       * `bindVisibility` 가 탭이 숨으면 루프를 세우므로 게이지가 멈춘다. 29초씩 끊어서
       * 반복하면 30초 규칙에도 안 걸리고 무한정 기다릴 수 있다. 그게 사용자가 신고한
       * *"상대방이 신발 100개이상 먹을때까지 기다렸다가"* 와 정확히 같은 악용이다.
       *
       * 상대는 그동안 계속 뛰었으므로 비운 시간만큼 깎는 쪽이 규칙에도 맞는다.
       * 초당 감소량은 `drainAt(diff, floor)` 다 — 매 프레임 그 값을 60으로 나눠 빼므로
       * 1초에 정확히 그만큼이다. 다 닳으면 그 자리에서 죽고 **부활 창이 열린다**
       * (판을 뺏지는 않는다 — 돌아온 사람에게도 되돌릴 기회는 줘야 한다).
       */
      if (비운시간 > 0 && this.started && !this.over && !this.leaving && !this.exiting
          && !this.player?.dead && this.pauseLeftMs <= 0) {
        this.gauge = Math.max(0, this.gauge - drainAt(this.diff, this.floor) * (비운시간 / 1000));
      }
      beat();
    };
    document.addEventListener('visibilitychange', this.onVisible);

    // 서버가 끊김을 직접 찍게 해 둔다 — 타이머로 어림하지 않는다
    Room.armPresence(this.multi.code).catch(() => {});
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
          // 부활은 판이 뒤집히는 순간이다 — **노란색**으로 띄우고 놀란 소리를 낸다
          this.notify(S.someoneRevived(color), PAL.gaugeWarn);
          Sfx.play('sfx_rival_revive');
        } else if (was.alive !== false && o.alive === false) {
          // 낙사는 **빨강**. 내 사망음과 다른, 짧고 아쉬운 소리를 쓴다
          this.notify(S.someoneFell(color), PAL.goRed);
          Sfx.play('sfx_rival_fell');
        } else if (!was.out && o.out) {
          this.notify(S.someoneOut(color), PAL.goRed);
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
        /**
         * ★ **혼자 남았어도 유예가 남아 있으면 안 끝낸다.** (2026-08-21 26차)
         *
         * 1등이 나가기를 누른 그 순간 나는 "혼자 남은 사람"이 된다. 예전 코드는 여기서
         * 곧바로 판을 끝냈는데, 그러면 **내가 반격할 6초가 통째로 사라진다** —
         * 규칙을 넣고도 아무 효과가 없는 상태가 된다(실제로 이 한 줄을 빠뜨려 놓고
         * `sim:multi` 가 잡았다).
         */
        else if (!this.exiting && !this.player?.dead
                 && othersAllOut(r, uid, now) && leaveGraceLeftMs(r, now) <= 0) this.endMulti();
      }
    });
  }

  /** 인게임 알림 한 줄 — 몇 초 떠 있다 사라진다 (multiHud 가 그린다) */
  /**
   * 인게임 알림 한 줄.
   * @param {string} msg
   * @param {string} [color] 줄 색. 안 주면 기본색 — **무슨 일인지 색으로 먼저 읽힌다**
   *   (떨어짐은 빨강, 부활은 노랑). (2026-08-19)
   */
  notify(msg, color) {
    this.ticker.push({ msg, color, until: Date.now() + TICKER_MS });
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
    this.exitMulti();
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
    if (this.onVisible) {
      document.removeEventListener('visibilitychange', this.onVisible);
      this.onVisible = null;
    }
    // 자리 지킴은 판이 끝나면 끈다 — 결과 화면·대기방에서는 끊겨도 방에서 빠지면 안 된다
    if (this.multi?.code) Room.disarmPresence(this.multi.code);
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
      /**
       * ★ **멀티는 씬을 얹지 않는다.** (2026-08-21 26차)
       * `PauseOverlay` 는 씬 스택 위에 올라가 `update()` 를 통째로 멈춘다 — 그게 곧
       * "혼자만 멈춰서 판돈이 불어나기를 기다리는" 악용이었다. 대신 메뉴만 연다.
       */
      if (this.multi) {
        if (this.over || this.leaving || this.exiting) return;
        if (this.pauseLeftMs > 0) return;      // 멈춰 있는 동안은 아무것도 안 열린다
        if (Scene.current() !== this) return;  // 사망 오버레이가 떠 있다
        this.openMenu();
        return;
      }
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
    /**
     * ★ **멀티에서는 상단 밴드 전체가 아니라 버튼 사각형만 메뉴다.** (2026-08-21 26차)
     *
     * 기본 판정은 화면 위 1/5 전체(`TOUCH.pauseBelowY`)다. 싱글에서는 실수로 열려도
     * 손해가 없지만, 멀티에서는 그 한 번이 **1회뿐인 일시정지**를 날리거나 나가기
     * 확인창을 띄운다. 대신 상단이 통째로 좌우 조작이 되어 **조작 영역이 넓어진다.**
     */
    setPauseZone(this.multi ? { ...HUD.pause } : null);
    /**
     * ★ 멀티의 세 상태에서는 **화면 전체를 이 핸들러가 삼킨다.** (2026-08-21 26차)
     *
     *   · 이탈 카운트다운 — *"그 어떤 버튼도 못누르게 막아야해"* (사용자 지정)
     *   · 전원 일시정지   — 멈춰 있는데 계단이 오르면 그건 멈춘 게 아니다
     *   · 인게임 메뉴     — 버튼을 눌렀는데 캐릭터가 같이 오르면 안 된다
     *
     * `true` 를 돌려주면 좌우 판정으로 새지 않는다(`input.handlePointerDown`).
     * 셋 다 아니면 `false` 라 평소처럼 화면 절반이 좌우 조작이다.
     */
    setTapHandler((x, y) => {
      if (!this.multi) return false;
      if (this.exiting || this.pauseLeftMs > 0) return true;
      if (!this.menu) return false;
      const hit = menuHit(x, y);
      if (hit >= 0) this.menuItems()[hit]?.run();
      return true;
    }, false);
  }

  exit() {
    setTapHandler(null);
    setPauseHandler(null);
    setPauseZone(null);
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
     * ★ **전원 일시정지 — 20초, 1인 1회.** (2026-08-21 26차, 사용자 지정)
     *
     * 멈춘 동안에는 **아무것도 하지 않는다.** 게이지도, 진행도 전송도, 종료 판정도.
     * 값은 방(`pausedAt`)에서 오므로 네 사람의 화면이 정확히 같은 초에 멈추고 풀린다.
     *
     * 출발 제한(`raceOpenedAt`)만 **멈춘 만큼 뒤로 민다** — 그 시계는 벽시계 기준이라
     * (§9-0-14) 밀어 주지 않으면 남이 건 일시정지 때문에 내가 출발도 못 하고 진다.
     */
    if (this.multi) {
      const now = Date.now();
      const 남음 = pauseLeftMs(this.room, now + (Room.serverOffsetSync?.() ?? 0));
      this.pauseLeftMs = 남음;
      if (남음 > 0) {
        const dt = now - (this.pauseTickAt || now);
        this.pauseTickAt = now;
        if (this.raceOpenedAt) this.raceOpenedAt += dt;
        clearInput();
        return;
      }
      this.pauseTickAt = 0;
      /**
       * 20초가 지났는데 방에 표시가 남아 있으면 **누구든** 지운다. 건 사람이 그대로
       * 앱을 닫으면 아무도 안 풀어서 판이 영원히 멈춘다 — 규칙도 삭제는 열어 뒀다.
       */
      if (this.room?.pausedBy) Room.resumeRound(this.multi.code).catch(() => {});
    }

    /**
     * ★ **이탈 카운트다운 — 6초 동안 아무것도 못 한다.** (2026-08-21 26차, 사용자 지정)
     *
     * *"그 어떤 버튼도 못누르게 막아야해, 그냥 5초가 지나가는걸 볼 수밖에 없어,
     *   다만, 5초 카운트 다운 뒤로 화면에서 역전 당하는지도 보이면 좋겠어"*
     *
     * 그래서 **패널을 안 깐다**(`multiHud.drawExitCountdown`) — 큰 숫자만 얹고 게임
     * 화면은 그대로 보인다. 상대가 20켤레를 걸고 내 앞으로 튀어나오는 걸 눈으로 본다.
     *
     * 남은 시간은 **서버가 내 이탈을 받은 뒤에는 모두와 같은 계산**을 쓴다
     * (`leaveGraceLeftMs`). 받기 전에는 내 시계로 어림한다 — 안 그러면 왕복이 끝날
     * 때까지 0으로 읽혀 카운트다운이 통째로 사라진다.
     */
    if (this.exiting) {
      const now = Date.now();
      const mine = this.room?.players?.[this.multi.myUid];
      const left = mine?.out
        ? leaveGraceLeftMs(this.room, now + (Room.serverOffsetSync?.() ?? 0))
        : Math.max(0, this.exitEndLocal - now);
      this.exitLeftMs = left;
      if (left <= 0) {
        this.exiting = false;
        this.leave(this.exitAction ?? 'home');
      }
      return;
    }

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
      /**
       * ★ **5초 안에 출발하지 않으면 패배한다.** (2026-08-19 11차, 사용자 지정)
       *
       * 시각은 **절대 시각으로** 잰다 — 프레임 수로 깎으면 에셋 로딩이나 일시정지 동안
       * 멈춰서, 일부러 멈춰 두는 사람에게 오히려 유리해진다(카운트다운을 벽시계로
       * 바꾼 것과 같은 이유, §9-0-14).
       */
      if (!this.started) {
        /**
         * 기준은 방의 출발 시각이 아니라 **판이 실제로 돌기 시작한 첫 프레임**이다.
         * 에셋이 아직 안 받아졌으면 `update()` 는 그 앞(`!this.ready`)에서 통째로
         * 멈춘다 — 방 시각으로 재면 **로딩이 5초를 넘긴 기기는 뜨자마자 패배**한다.
         * (같은 함정을 카운트다운에서 한 번 겪었다, §9-0-14)
         */
        if (!this.raceOpenedAt) this.raceOpenedAt = Date.now();
        const 남음 = this.raceOpenedAt + MULTI.startWithinSeconds * 1000 - Date.now();
        this.startLeftMs = Math.max(0, 남음);
        if (남음 <= 0) return this.failToStart();
      } else if (this.startLeftMs) {
        this.startLeftMs = 0;
      }
    }

    const btn = consumeInput();
    /**
     * ★ 인게임 메뉴가 열려 있으면 좌우 입력은 **메뉴 커서**다. (2026-08-21 26차)
     * 이 메뉴는 씬을 얹지 않으므로 게임이 계속 돈다 — 그동안 캐릭터는 서 있고
     * 게이지는 닳는다. 그게 "멀티에는 일시정지가 없다"의 정직한 모습이다.
     */
    if (this.menu) {
      if (btn === BTN.LEFT) { this.menu.sel = (this.menu.sel + 1) % this.menuItems().length; Sfx.play('sfx_menu_move'); }
      else if (btn === BTN.RIGHT) this.menuItems()[this.menu.sel]?.run();
    } else if (btn) this.action(btn);

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
        this.menu = null;   // 사망 오버레이가 위에 뜬다 — 메뉴가 남아 있으면 두 겹이 된다
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

  // ── 멀티 인게임 메뉴 · 일시정지 · 이탈 ──────────

  /**
   * ★ **멀티에는 일시정지 메뉴가 없다 — 메뉴만 있다.** (2026-08-21 26차, 사용자 지정)
   *
   * 예전에는 상단을 누르면 `PauseOverlay` 가 씬으로 얹혀 **내 게임만 멈췄다.**
   * 그게 곧 사용자가 신고한 악용이다 — *"일시정지 기다리고 있다가, 상대방이 신발
   * 100개이상 먹을때까지 기다렸다가, 일시정지 풀고, 죽은 다음 부활을 누르는 악행"*.
   *
   * 지금 이 메뉴는 **씬을 얹지 않는다.** 열어 두는 동안에도 게이지가 닳고 상대는
   * 계속 오른다. 멈추고 싶으면 [일시정지]를 눌러야 하고, 그건 **전원이 같이** 멈춘다.
   */
  openMenu() {
    if (this.menu) { this.menu = null; return; }
    this.menu = { sel: 0, confirmExit: false };
    Sfx.play('sfx_menu_move');
  }

  menuItems() {
    if (!this.menu) return [];
    const now = Date.now() + (Room.serverOffsetSync?.() ?? 0);
    const 가능 = canPause(this.room, this.multi?.myUid, now);
    return [
      { label: S.pauseOnce(MULTI.pauseSeconds), dim: !가능, run: () => this.tryPause(가능) },
      {
        label: this.menu.confirmExit ? S.forfeitConfirm : S.forfeit,
        run: () => {
          if (!this.menu.confirmExit) { this.menu.confirmExit = true; Sfx.play('sfx_menu_move'); return; }
          Sfx.play('sfx_menu_back');
          this.menu = null;
          this.beginExit('home');
        },
      },
      { label: S.close, run: () => { Sfx.play('sfx_menu_back'); this.menu = null; } },
    ];
  }

  tryPause(가능) {
    if (!가능) {
      // 왜 못 쓰는지 말해 준다 — 아무 반응이 없으면 그건 고장으로 보인다
      const me = this.room?.players?.[this.multi?.myUid];
      this.notify(me?.pauseUsed ? S.pauseUsedUp : S.pauseNotNow, PAL.goRed);
      Sfx.play('sfx_menu_back');
      return;
    }
    Sfx.play('sfx_menu_select');
    this.menu = null;
    Room.pauseRound(this.multi.code).then((ok) => {
      if (!ok) this.notify(S.pauseNotNow, PAL.goRed);
    }).catch(() => {});
  }

  /**
   * ★ **판을 뜬다 — 1등이면 6초를 주고 나간다.** (2026-08-21 26차, 사용자 지정)
   *
   * 이 6초가 없으면 나가기 버튼은 **순위 확정 버튼**이다(§9-0-55). 1등이 아니거나
   * 반격할 사람이 없으면 유예 없이 그대로 나간다 — 기권을 붙잡을 이유는 없다.
   *
   * **취소는 없다.** 상대가 부활하는 걸 보고 무를 수 있으면 이 버튼은 *"상대의 20켤레를
   * 공짜로 태우는 낚시"* 가 된다(6번 반복하면 120켤레를 항아리에 넣고 내가 먹는다).
   */
  beginExit(action = 'home') {
    if (this.over || this.leaving || this.exiting) return;
    if (!this.multi) return this.leave(action);
    const now = Date.now() + (Room.serverOffsetSync?.() ?? 0);
    const 붙잡는다 = graceOnExit(this.room, this.multi.myUid, now);

    /**
     * 서버에 **먼저** 알린다 — 남은 사람 화면의 빨간 카운트다운이 여기서 시작된다.
     * 살아 있는 채로 나가면 `deadAt` 이 없으므로 `markOut` 의 `outAt` 이 기준이 되고,
     * 죽어 있으면 `deadAt` 이 더 이르므로 그쪽이 기준이 된다(`exitStartedAt`).
     */
    if (!this.player?.dead) {
      Room.reportDeath(this.multi.code, { stairs: this.floor, shoesFound: this.shoesFound })
        .catch(() => {});
    }
    Room.markOut(this.multi.code).catch(() => {});

    if (!붙잡는다) return this.leave(action);

    this.exiting = true;
    this.exitAction = action;
    this.menu = null;
    clearInput();
    Bgm.stopBgm();
    /**
     * 서버 답이 오기 전에 쓸 내 시계 기준 끝 시각. **죽어서 나가는 경우에는 죽은
     * 순간부터** 세므로 부활 창에서 쓴 시간이 자동으로 빠진다 — 어느 경로로 나가든
     * 상대가 받는 시간은 정확히 6초다.
     */
    const me = this.room?.players?.[this.multi.myUid];
    const 기준 = me?.deadAt ? me.deadAt - (Room.serverOffsetSync?.() ?? 0) : Date.now();
    this.exitEndLocal = 기준 + MULTI.leaveGraceSeconds * 1000;
    this.exitLeftMs = Math.max(0, this.exitEndLocal - Date.now());
  }

  /**
   * ★ **출발하지 않아 진다.** (2026-08-19 11차, 사용자 지정)
   *
   * **부활 창을 주지 않는다.** 주면 그게 곧 사용자가 신고한 그 전략이다 — 가만히 서서
   * 상대가 부활을 태우기를 기다렸다가, 죽는 순간 1위보다 20칸 앞에서 살아나는 것.
   * 그래서 기권(`leave`)과 똑같이 처리한다: 사망 보고 → `out` 도장 → 결과 화면.
   * 남들은 도장을 보고 곧바로 판을 끝낼 수 있다.
   */
  failToStart() {
    if (this.over || this.leaving) return;
    this.startLeftMs = 0;
    this.leave('home');
  }

  /**
   * ★ **30초 넘게 자리를 비웠다 — 판에서 나간다.** (2026-08-19 10차, 사용자 지정)
   *
   * 남들은 이미 나를 뺐으므로(같은 30초) 여기서 버티면 **화면과 서버가 다른 말을 한다.**
   * 조용히 사라지지 않고 세 가지를 하고 나간다:
   *   ① 판에서 손을 뗐다는 도장 — 남들이 나를 기다리지 않게 (`markOut`)
   *   ② 자리 비우기 — 유령으로 남아 다음 판을 막지 않게 (`leaveRoom`)
   *   ③ 왜 나왔는지 말해 주기 — 아무 설명 없이 로비면 그건 고장으로 보인다
   *
   * 정산은 다음 접속의 청산(`sweepUnsettled`)이 마저 한다. 내가 건 판돈은 방에 남아
   * 있고 규칙상 방 밖에서도 도장을 찍을 수 있다(§9-0-22).
   */
  kickOut() {
    if (this.over || this.leaving) return;
    this.leaving = true;
    Bgm.stopBgm();
    this.exitMulti();
    const code = this.multi.code;
    Room.markOut(code).catch(() => {});
    Room.leaveRoom(code).catch(() => {});
    this.onAbsent?.();
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
    /**
     * ★ 상대 고스트는 **내 캐릭터보다 먼저** 그린다 (2026-08-19) — 같은 계단에 겹쳤을 때
     * 반투명한 남이 나를 덮으면 내 위치를 놓친다. 나중에 그린 것이 위에 얹히므로
     * 순서가 곧 우선순위다. (multiHud.js `multiGhosts` 주석)
     */
    if (this.multi) multiGhosts(this);
    this.player.render(camX, this.stairs.worldX(this.floor));
    renderHud({
      gauge: this.gauge,
      floor: this.floor,
      shoesFound: this.shoesFound,
      // 멀티는 부활이 없으므로 부활 칸 자체를 그리지 않는다 (기획서 §5-6)
      revives: this.multi ? 0 : this.revives,
      controlMode: this.controlMode,
      // 멀티는 계단 숫자 위에 판돈 줄이 한 줄 들어가 좌표가 다르다 (layout.HUD.scoreMulti)
      multi: !!this.multi,
    });
    if (this.multi) multiHud(this);
  }
}

/** 티어 확률 합 검증 (개발 안전장치) */
const probSum = SHOE_TIERS.reduce((s, t) => s + t.prob, 0);
if (Math.abs(probSum - 1) > 1e-6) console.warn('신발 티어 확률 합이 1이 아님:', probSum);
