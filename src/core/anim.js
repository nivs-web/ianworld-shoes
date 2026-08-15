/**
 * 프레임 시퀀서 — 보간 없이 컷을 뚝뚝 교체한다. (CLAUDE.md §3-3)
 *
 * 게임 루프는 60fps지만 애니메이션은 8~12fps로 돈다.
 * 중간 상태를 만들어내지 않는 것이 이 모듈의 존재 이유다.
 */

import { FPS } from './loop.js';
import { ANIM } from '../config/balance.js';

/**
 * @typedef {object} Clip
 * @property {string[]} frames 프레임 키 배열
 * @property {number} [fps] 이 클립만의 프레임레이트
 * @property {boolean} [loop] 반복 여부 (기본 true)
 */

export class Animator {
  /** @param {Record<string, Clip>} clips */
  constructor(clips) {
    this.clips = clips;
    this.name = null;
    this.index = 0;
    this.ticks = 0; // 현재 프레임이 유지된 게임 프레임 수
    this.done = false;
  }

  /**
   * 클립 재생. 같은 클립을 다시 걸어도 리셋하지 않는다(force 제외).
   * @param {string} name @param {boolean} [force]
   */
  play(name, force = false) {
    if (this.name === name && !force) return;
    this.name = name;
    this.index = 0;
    this.ticks = 0;
    this.done = false;
  }

  /** 고정 스텝마다 1회 호출. */
  update() {
    const clip = this.clips[this.name];
    if (!clip || this.done) return;

    const fps = clip.fps ?? ANIM.fps;
    const holdFrames = Math.max(1, Math.round(FPS / fps));

    this.ticks++;
    if (this.ticks < holdFrames) return;

    this.ticks = 0;
    this.index++;

    if (this.index >= clip.frames.length) {
      if (clip.loop === false) {
        this.index = clip.frames.length - 1;
        this.done = true;
      } else {
        this.index = 0;
      }
    }
  }

  /** 현재 프레임 키. */
  frame() {
    const clip = this.clips[this.name];
    if (!clip) return null;
    return clip.frames[this.index];
  }

  isDone() {
    return this.done;
  }
}

/**
 * N 게임프레임 동안만 참인 일회성 타이머.
 * 상승 시 번개 이펙트 컷처럼 "잠깐 떴다 사라지는" 연출에 쓴다.
 */
export class Timer {
  constructor() {
    this.left = 0;
  }

  /** @param {number} frames */
  start(frames) {
    this.left = frames | 0;
  }

  /** 고정 스텝마다 1회 호출. 이번 틱에 끝났으면 true. */
  update() {
    if (this.left <= 0) return false;
    this.left--;
    return this.left === 0;
  }

  get active() {
    return this.left > 0;
  }

  cancel() {
    this.left = 0;
  }
}
