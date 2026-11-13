/**
 * 텍스처 픽셀 읽기 (화면 전용 · 11/12 필살기 연출) — 작은 부품 그림(40칸 남짓)을 한 번만 캔버스에 옮겨 알파를 읽는다.
 *  - texPixels(tex) : { w, h, d(RGBA) } · 못 읽으면 null (그때는 부르는 쪽이 대신하는 길로)
 *  - whiteTex(tex)  : 같은 모양의 «하얀 실루엣» 텍스처 (얼음 껍질 · 외곽선용 — tint 로 색을 입힌다)
 * 텍스처마다 한 번만 만들어 기억한다(WeakMap). 전투 코어와 무관.
 */
import { Texture } from 'pixi.js';

const PIX = new WeakMap(), WHITE = new WeakMap();

export function texPixels(tex) {
  if (!tex) return null;
  if (PIX.has(tex)) return PIX.get(tex);
  let r = null;
  try {
    const res = tex.source?.resource, f = tex.frame;
    if (res && f && typeof document !== 'undefined') {
      const w = Math.max(1, Math.round(f.width)), h = Math.max(1, Math.round(f.height));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(res, f.x, f.y, w, h, 0, 0, w, h);
      r = { w, h, d: g.getImageData(0, 0, w, h).data };
    }
  } catch { r = null; }
  PIX.set(tex, r);
  return r;
}

export function whiteTex(tex) {
  if (!tex) return null;
  if (WHITE.has(tex)) return WHITE.get(tex);
  let t = null;
  const px = texPixels(tex);
  if (px) {
    try {
      const c = document.createElement('canvas'); c.width = px.w; c.height = px.h;
      const g = c.getContext('2d'), img = g.createImageData(px.w, px.h);
      for (let i = 0; i < px.d.length; i += 4) { const a = px.d[i + 3]; if (a > 30) { img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = 255; } }
      g.putImageData(img, 0, 0);
      t = Texture.from(c); t.source.scaleMode = 'nearest';
    } catch { t = null; }
  }
  WHITE.set(tex, t);
  return t;
}
