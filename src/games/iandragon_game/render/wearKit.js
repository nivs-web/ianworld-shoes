/**
 * 좀비와 드래곤 — 꾸미기 착용 (모자 · 목 장식 · 망토) 공용 (겜보조 1 · 2026-11-13)
 *
 * 꾸미기 그림은 물건마다 하나(상점 그림). 대장 드래곤 10마리마다 «기준점 3개 + 크기»만 표로 둔다 :
 *   ai/meta/wear_anchor.json  드래곤별 head · neck · back 점 + size(1~5)      ai/meta/wear_items.json  물건별 w · anchor · layer · cover
 * 전투(battleView) · 로비(IanDragonGameLobby liveRig) · 꾸미기 창(dragonLive) · 2D 그림(idgDressed)이 전부 이 파일의 wearPlan 으로 같은 자리에 그린다.
 * 그림 = tools/idg-wear-bake.mjs 가 도트 칸에 맞는 정수 폭으로 줄여 둔 ai/meta/wear/fit/<물건>_<폭>.png (흐림 없음).
 */
import { Sprite, Container, Texture } from 'pixi.js';
import { wearTables, wearWidth, wearPlan, wearArt, hatFit, hatWidth, bakeHat, pixCanvas, maskedHead } from './wearPlan.js';
import { texPixels } from './texPix.js';

export { wearTables, wearWidth, wearPlan, wearArt };
/* 모자 세로 자리 · 속 비우기 = wearPlan.js hatFit (11/14 · 머리 그림의 실제 윗면에 «씌움» — 대표님 «왕관이 공중에 떠 있다») */

/* 만든 텍스처는 한 번만 (로비를 다시 그려도 같은 모자 · 같은 머리면 다시 안 만든다) — 키 = 텍스처 uid */
const made = new Map();
const once = (key, mk) => { if (!made.has(key)) { const c = mk(); let t = null; if (c) { t = Texture.from(c); t.source.scaleMode = 'nearest'; } made.set(key, t); } return made.get(key); };

/** 덮는 모자를 쓰면 그 용의 머리 · 눈 감김 · 숨 텍스처를 «모자용 머리»(뿔 · 볏을 지운 것)로 바꾼 rig 자료 (loadTex(주소) → 텍스처 | null)
 *  색 바꾼 모습(_red · _violet) : 원래 용의 모자용 머리를 «모양»으로만 써서 자기 머리 색 그대로 뿔만 지운다 (못 만들면 자기 머리 그대로) */
export async function wearRigData(data, art, lk, T, loadTex) {
  const e = wearPlan(art, lk, T).hat;
  if (!data || !e?.heads) return data;
  const tex = { ...data.tex };
  for (const [n, f] of Object.entries(e.heads)) {
    const t = await loadTex(f); if (!t) continue;
    if (!e.mask) { tex[n] = t; continue; }
    const own = data.tex[n];
    const m = own && once(`m${own.uid}_${t.uid}`, () => maskedHead(texPixels(own), texPixels(t)));
    if (m) tex[n] = m;
  }
  return { rig: data.rig, tex };
}

/**
 * 리그(R = createRigged 결과)에 모자 · 목 장식을 붙인다. 돌려주는 follow = [[상자, 몸통], …] — 몸통 뒤 층 장식(망토)은
 * 몸통을 따라 움직여야 하므로 매 프레임 상자 위치를 몸통에 복사한다.
 * loadTex(주소) → 텍스처 | null (nearest) · 주소는 BASE(/assets/iandragon_game/) 뒤 경로
 */
export async function attachWear(R, data, art, lk, T, loadTex) {
  const follow = [], plan = wearPlan(art, lk, T), body = R?.root.children[0];
  if (!body || !data || !(plan.hat || plan.neck)) return follow;
  const idx = (n) => data.rig.parts.findIndex((p) => p.n === n);
  const torso = body.children[idx('torso')], head = body.children[idx('head')];
  const mk = async (e) => { const t = await loadTex(e.file); if (!t) return null; const sp = new Sprite(t); sp.position.set(Math.round(e.x - e.ax * t.width), Math.round(e.y - e.ay * t.height)); return sp; };
  if (plan.hat && head) {   /* 모자 : 두개골(모자용 머리)에서 잰 가운데 · 폭 · 기울기로 씌운다 — 띠 모자는 머리 뒤 층 (wearPlan.js hatWidth · bakeHat · hatFit) */
    const e = plan.hat, [src, sk] = await Promise.all([e.src ? loadTex(e.src) : null, e.skull ? loadTex(e.skull) : null]);
    const ht = head.texture, hpx = texPixels(ht), spx = sk ? texPixels(sk) : null, fpx = data.tex.head ? texPixels(data.tex.head) : null;   /* fpx = 뿔 포함 원래 머리 (옆모습 모자 자리 기준) */
    const tw = hatWidth(e, spx || hpx, fpx);
    let hp = src && tw ? bakeHat(texPixels(src), tw, e.hole) : null, key = hp && `b${src.uid}_${tw}_${ht.uid}`;
    if (!hp) { const t = await loadTex(e.file); hp = t ? texPixels(t) : null; key = t && `f${t.uid}_${ht.uid}`; }   /* 원본을 못 받으면 굽어 둔 예비 그림 */
    const fit = () => hatFit(e, hp, hpx, spx, [head.anchor.x, head.anchor.y], fpx);
    const tex = hp && !head.destroyed ? once(key, () => pixCanvas(hp, fit().cut)) : null;
    if (tex) {
      const f = fit(), sp = new Sprite(tex);
      sp.anchor.set(0.5, 1); sp.position.set(f.x + hp.w / 2, f.y + hp.h); sp.rotation = f.rot;   /* 아랫단 가운데를 축으로 기울임 */
      if (!f.behind) head.addChild(sp);
      else if (head.parent === body) {   /* 머리 뒤 층 : 머리 바로 아래에 두고 매 프레임 머리 자리 · 각 · 크기 · 보임을 따라간다 */
        const box = new Container(); box.addChild(sp); body.addChildAt(box, body.getChildIndex(head));
        const sync = () => { if (head.destroyed) return; box.position.copyFrom(head.position); box.rotation = head.rotation; box.scale.copyFrom(head.scale); box.visible = head.visible; };
        sync(); box.onRender = sync;
      }
    }
  }
  if (plan.neck && torso) {
    const sp = await mk(plan.neck);
    if (sp && !torso.destroyed && torso.parent === body) {
      if (plan.neck.layer === 'front') torso.addChild(sp);
      else { const box = new Container(); box.addChild(sp); body.addChildAt(box, body.getChildIndex(torso)); box.position.copyFrom(torso.position); follow.push([box, torso]); }
    }
  }
  return follow;
}
