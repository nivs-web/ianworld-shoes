/**
 * 보스 연출 (화면 전용) — 코어 상태 S 를 읽기만 한다. 계산에 손대지 않는다.
 *
 *  1) 등장 컷인 : S.boss 가 새로 생기면 1.2초 — 화면이 살짝 어두워지고, 오른쪽에서 보스 얼굴(head.png)이 3배로
 *     미끄러져 들어와 멈췄다가 사라진다. 이름표는 캔버스 글씨 금지(오락실 규칙)라 hud.js 의 DOM «보스 이름 띠»가 맡는다.
 *  2) 큰 공격 경고 : 보스가 'fore'(공격 준비)에 들어가면 보스 앞 땅에(def.range 만큼) 빨간 띠를 깔고, 준비 시간(def.fore)
 *     동안 점점 진해지다가 공격 순간(fore → back) 사라지며 작게 흔든다. 일반 좀비에는 하지 않는다.
 *
 * createBossFx({ layer, fx, M, GY, view, artOf, shake }) → { update(S, dt, V), destroy() }
 *   layer = 화면 고정 층(카메라를 따라가지 않는 곳, 보통 app.stage) · fx = 전장 효과 층(카메라를 따라감)
 *   artOf(def) = 그림 id · shake(초) = 화면 흔들림 요청 · V = 코어 유닛 id → 그림(사용 안 해도 됨)
 */
import { Assets, Container, Sprite, Graphics } from 'pixi.js';

export const CUT_TIME = 1.2;                 // 컷인 길이 (hud.js 의 이름 띠와 같은 시간)
const AI = '/assets/iandragon_game/ai/';
const SCALE = 3;                             // 얼굴 크기 (게임 속 크기의 3배)
const ease = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
const clamp01 = (k) => Math.max(0, Math.min(1, k));

export function createBossFx({ layer, fx, M, GY, view, artOf, shake }) {
  /* ── 컷인 : 어두운 막 + 얼굴 */
  const cut = new Container(); cut.visible = false;
  const dim = new Graphics(); dim.alpha = 0;
  const face = new Sprite(); face.anchor.set(0.5, 0.5); face.scale.set(SCALE); face.visible = false;
  cut.addChild(dim, face); layer.addChild(cut);
  const texs = new Map();                    // 그림 id → 얼굴 그림 (받으면 넣는다)
  const loadFace = (art) => {
    if (texs.has(art)) return;
    texs.set(art, null);
    Assets.load(`${AI}${art}/head.png`).then((t) => { t.source.scaleMode = 'nearest'; texs.set(art, t); }).catch(() => {});
  };
  let bossId = null, cutT = CUT_TIME, cutArt = null, gone = false;

  function drawCut(dt) {
    if (cutT >= CUT_TIME) { if (cut.visible) cut.visible = false; return; }
    cutT += dt;
    const t = Math.min(cutT, CUT_TIME), W = view.w, H = view.h;
    cut.visible = true;
    dim.clear().rect(0, 0, W, H).fill(0x000000);
    dim.alpha = 0.5 * Math.min(clamp01(t / 0.15), clamp01((CUT_TIME - t) / 0.25));
    const tx = cutArt && texs.get(cutArt);
    if (tx && face.texture !== tx) face.texture = tx;
    face.visible = !!tx;
    const w = (tx ? tx.width : 50) * SCALE;
    const x0 = W + w, x1 = W * 0.74;
    face.position.set(Math.round(x0 + (x1 - x0) * ease(clamp01(t / 0.3))), Math.round(H * 0.42));
    face.alpha = clamp01((CUT_TIME - t) / 0.3);
  }

  /* ── 큰 공격 경고 : 보스 앞 땅의 빨간 띠 */
  const warn = new Graphics(); fx.addChild(warn);
  const prev = new Map();                    // 보스 id → 지난 상태
  const BAND_TOP = 12, BAND_H = 34;          // 땅(GY) 위아래로 깔리는 띠 높이

  function drawWarn(S) {
    warn.clear();
    const seen = new Set();
    for (const u of S.units) {
      if (!u.boss || u.side !== 1) continue;
      seen.add(u.id);
      const was = prev.get(u.id); prev.set(u.id, u.state);
      if (u.state === 'back' && was === 'fore' && u.alive) shake(0.25);   // 공격 순간 : 작은 흔들림
      if (!u.alive || u.state !== 'fore') continue;
      const total = u.def.fore || 0.5, k = clamp01(1 - u.t / total);      // 준비 시간 진행 0 → 1
      const range = u.def.range || 60, right = M + u.x, left = right - range;
      const a = 0.12 + 0.4 * k, pulse = 0.5 + 0.5 * Math.sin(k * 14);
      warn.rect(left, GY - BAND_TOP, range, BAND_H).fill({ color: 0xff2a2a, alpha: a });
      warn.rect(left, GY - BAND_TOP, range, 3).fill({ color: 0xff8a8a, alpha: 0.35 + 0.4 * pulse * k });
      warn.rect(left, GY - BAND_TOP + BAND_H - 3, range, 3).fill({ color: 0xff8a8a, alpha: 0.35 + 0.4 * pulse * k });
    }
    for (const id of prev.keys()) if (!seen.has(id)) prev.delete(id);
  }

  return {
    update(S, dt) {
      if (gone) return;
      const b = S.boss;
      if (b && b.id !== bossId) {            // 새 보스 등장 → 컷인 시작
        bossId = b.id; cutT = 0; cutArt = artOf(b.def); loadFace(cutArt);
      }
      drawCut(dt); drawWarn(S);
    },
    destroy() { gone = true; cut.destroy({ children: true }); warn.destroy(); },
  };
}
