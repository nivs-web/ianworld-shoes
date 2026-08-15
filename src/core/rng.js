/**
 * 시드 기반 난수 (mulberry32).
 *
 * 멀티플레이에서 모든 참가자가 "같은 계단, 같은 신발"을 봐야 하므로
 * Math.random()을 쓰지 않고 방의 seed로 초기화한 이 RNG만 쓴다.
 */

export class Rng {
  /** @param {number} seed 32비트 정수 */
  constructor(seed) {
    this.state = (seed >>> 0) || 1;
  }

  /** [0, 1) */
  next() {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max] 정수 (양끝 포함) */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** 확률 p로 true */
  chance(p) {
    return this.next() < p;
  }

  /** 배열에서 하나 균등 선택 */
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /**
   * 가중치 배열에서 인덱스 선택.
   * @param {number[]} weights 합이 1이 아니어도 된다
   */
  weighted(weights) {
    let total = 0;
    for (const w of weights) total += w;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }
}

/** 싱글플레이용 랜덤 시드 */
export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
