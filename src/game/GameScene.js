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
import { PauseOverlay, ReviveOverlay, GameOverOverlay } from './overlays.js';
import { PAL } from './palette.js';
import { get as getProfile, dexUnique } from '../services/profile.js';
import * as Sfx from '../audio/sfx.js';
import * as Bgm from '../audio/bgm.js';
import { AUDIO, SHOE_RARE_TIER_MAX, bgmTrackAt } from '../config/balance.js';
import shoesData from '../data/shoes.json';

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
    this.ready = false;
  }

  enter() {
    this.stairs = new Stairs(
      this.seed,
      { gapMin: this.diff.shoeGapMin, gapMax: this.diff.shoeGapMax },
      // 도감을 100종 넘게 모았으면 1·2티어가 5분의 1로 줄어든다 (balance.DEX_LATE_GAME)
      tierWeights(dexUnique())
    );
    this.player = new Player(this.charId);
    this.floor = this.startFloor;
    this.gauge = GAUGE_MAX;
    this.started = false; // 첫 입력부터 게이지가 줄기 시작
    this.shoesFound = 0;
    this.revives = 0;
    this.reviveEarned = 0; // 이미 지급한 부활 수 (20개마다 1개)
    this.overlayDone = false;
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
      if (Scene.current() !== this) return; // 이미 오버레이가 떠 있다
      Scene.push(new PauseOverlay(this));
    };
    setPauseHandler(pause);
    setTapHandler(null, false);
  }

  exit() {
    setTapHandler(null);
    setPauseHandler(null);
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
      // 부활 지급 (싱글 전용, 신발 20개당 1개)
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

    // 사망 처리 → 부활 or 게임오버
    if (this.player.dead && !this.overlayDone) {
      this.overlayDone = true;
      if (this.revives > 0) {
        Scene.push(new ReviveOverlay(this));
      } else {
        this.finish();
      }
    }
  }

  finish() {
    Bgm.stopBgm();
    Scene.push(new GameOverOverlay(this, this.bestSoFar()));
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
    Bgm.stopBgm();
    const result = { floor: this.floor, difficulty: this.diff.id, shoeIndices: this.shoeIndices };
    if (!this.onFinish) {
      console.error('[game] onFinish 가 없어 로비로 돌아갈 수 없다 — GameScene 생성부를 확인할 것');
      return;
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
      revives: this.revives,
      controlMode: this.controlMode,
    });
  }
}

/** 티어 확률 합 검증 (개발 안전장치) */
const probSum = SHOE_TIERS.reduce((s, t) => s + t.prob, 0);
if (Math.abs(probSum - 1) > 1e-6) console.warn('신발 티어 확률 합이 1이 아님:', probSum);
