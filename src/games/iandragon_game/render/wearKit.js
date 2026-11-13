/**
 * 좀비와 드래곤 — 꾸미기 착용 (모자 · 목 장식 · 망토) 공용 (겜보조 1 · 2026-11-13)
 *
 * 꾸미기 그림은 물건마다 하나(상점 그림). 대장 드래곤 10마리마다 «기준점 3개 + 크기»만 표로 둔다 :
 *   ai/meta/wear_anchor.json  드래곤별 head · neck · back 점 + size(1~5)      ai/meta/wear_items.json  물건별 w · anchor · layer · cover
 * 전투(battleView) · 로비(IanDragonGameLobby liveRig) · 꾸미기 창(dragonLive) · 2D 그림(idgDressed)이 전부 이 파일의 wearPlan 으로 같은 자리에 그린다.
 * 그림 = tools/idg-wear-bake.mjs 가 도트 칸에 맞는 정수 폭으로 줄여 둔 ai/meta/wear/fit/<물건>_<폭>.png (흐림 없음).
 */
import { Sprite, Container } from 'pixi.js';
import { wearTables, wearWidth, wearPlan } from './wearPlan.js';

export { wearTables, wearWidth, wearPlan };

/** 덮는 모자를 쓰면 그 용의 머리 · 눈 감김 · 숨 텍스처를 «모자용 머리»(뿔 · 볏을 지운 것)로 바꾼 rig 자료 (loadTex(주소) → 텍스처 | null) */
export async function wearRigData(data, art, lk, T, loadTex) {
  const e = wearPlan(art, lk, T).hat;
  if (!data || !e?.heads) return data;
  const tex = { ...data.tex };
  for (const [n, f] of Object.entries(e.heads)) { const t = await loadTex(f); if (t) tex[n] = t; }
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
  if (plan.hat && head) { const sp = await mk(plan.hat); if (sp && !head.destroyed) head.addChild(sp); }
  if (plan.neck && torso) {
    const sp = await mk(plan.neck);
    if (sp && !torso.destroyed && torso.parent === body) {
      if (plan.neck.layer === 'front') torso.addChild(sp);
      else { const box = new Container(); box.addChild(sp); body.addChildAt(box, body.getChildIndex(torso)); box.position.copyFrom(torso.position); follow.push([box, torso]); }
    }
  }
  return follow;
}
