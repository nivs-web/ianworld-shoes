/**
 * 싱글 게임 씬 — M2 코어 게임플레이 조립.
 *
 * 루프: 입력 → (전환|상승|추락) → 게이지 → 애니메이션 → 렌더.
 * 이동은 스냅(보간 없음), 배경은 계단 상승량과 동일 픽셀로 스크롤.
 */

import * as Scene from '../core/scene.js';
import { clear } from '../core/canvas.js';
import { consumeInput, clearInput, setTapHandler, BTN } from '../core/input.js';
import { loadAll, img } from '../core/assets.js';
import { randomSeed, Rng } from '../core/rng.js';
import { text } from '../core/pixelfont.js';
import {
  DIFFICULTY, GAUGE_MAX, drainAt, REVIVE, SHOE_TIERS,
} from '../config/balance.js';
import { STAIR, CENTER_X, VIEW_W, VIEW_H } from '../config/layout.js';
import { BUILDINGS, buildingAssets, floorAsset, FLOOR_BACKGROUNDS } from '../data/backgrounds.js';
import { Stairs } from './stairs.js';
import { Player, P_STATE } from './player.js';
import { Background } from './background.js';
import { renderHud, hitPause } from './hud.js';
import { PauseOverlay, ReviveOverlay, GameOverOverlay } from './overlays.js';
import { PAL } from './palette.js';
import * as Sfx from '../audio/sfx.js';
import * as Bgm from '../audio/bgm.js';
import { AUDIO, SHOE_RARE_TIER_MAX } from '../config/balance.js';
import shoesData from '../data/shoes.json';

export class GameScene {
  /**
   * @param {object} [opt]
   * @param {string} [opt.difficulty] 'easy'|'normal'|'hard'
   * @param {string} [opt.charId]
   * @param {number} [opt.seed]
   * @param {number} [opt.controlMode] 1|2|3
   */
  constructor(opt = {}) {
    this.diff = DIFFICULTY[opt.difficulty ?? 'normal'];
    this.charId = opt.charId ?? 'ian';
    this.seed = opt.seed ?? randomSeed();
    this.controlMode = opt.controlMode ?? 1;
    this.ready = false;
  }

  enter() {
    this.stairs = new Stairs(this.seed, {
      gapMin: this.diff.shoeGapMin,
      gapMax: this.diff.shoeGapMax,
    });
    this.player = new Player(this.charId);
    this.floor = 0;
    this.gauge = GAUGE_MAX;
    this.started = false; // 첫 입력부터 게이지가 줄기 시작
    this.shoesFound = 0;
    this.revives = 0;
    this.reviveEarned = 0; // 이미 지급한 부활 수 (20개마다 1개)
    this.overlayDone = false;
    /** 함성 발동용 — 실수 없이 연속으로 오른 칸 수 (기획서 §9-7-1) */
    this.stepStreak = 0;
    // 판이 시작되면 1번 트랙부터 (재시작 포함). 오디오가 아직 잠겨 있으면 조용히 무시된다.
    Bgm.forceTrack(1);
    Bgm.startBgm();

    // 인트로: 정면 → 팝 → 대기 → 첫 계단 방향으로 전환 (기획서: 시작인터페이스)
    this.player.introFacing = this.stairs.nextDir(0);
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
    setTapHandler((x, y) => {
      if (hitPause(x, y) && !this.player.dying) {
        Scene.push(new PauseOverlay(this));
        return true;
      }
      return false;
    });
  }

  resume() {
    clearInput();
    setTapHandler((x, y) => {
      if (hitPause(x, y) && !this.player.dying) {
        Scene.push(new PauseOverlay(this));
        return true;
      }
      return false;
    });
  }

  exit() {
    setTapHandler(null);
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
    // 최고기록 (M6 전까지 로컬 저장)
    const key = `sf_best_${this.diff.id}`;
    const best = Number(localStorage.getItem(key) ?? 0);
    if (this.floor > best) localStorage.setItem(key, String(this.floor));
    Scene.push(new GameOverOverlay(this, Math.max(best, this.floor)));
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
