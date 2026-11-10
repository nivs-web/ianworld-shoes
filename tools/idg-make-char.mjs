/**
 * 그림 공장 3단계 — 부품 시트 → 게임 캐릭터 (자르기 + 몸 틀 자동 조립) (겜부장 · 2026-11-11)
 *
 *   node tools/idg-make-char.mjs <부품시트> <캐릭터id> <몸틀 dragon|zombie> <부품 이름들(쉼표, 시트 순서)> <목표 키(칸)> [그림방향 R|L]
 *
 * 1) 임시 배율로 잘라 크기를 재고 → 몸 틀로 조립했을 때 키가 목표 키가 되도록 배율을 다시 정해 다시 자른다.
 * 2) 몸 틀(부품 크기에 비례한 자리 · 회전 축)로 rig.json 을 쓴다. 그림이 왼쪽을 보고 있으면(L) 좌우를 뒤집어 적는다.
 * IDG_HAT=cover : 모자가 머리를 덮는다(헬멧) · IDG_KERNEL=lanczos3 : 매끈한 그림 축소
 * 부품 이름 : head head_blink torso arm_f arm_b leg_f leg_b (용: wing tail / 좀비: jaw hat) · '-' = 버림
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [sheet, id, kind, names, targetArg, faceArg = 'R'] = process.argv.slice(2);
const OUT = path.join('public/assets/iandragon_game/ai', id);
const target = Number(targetArg), artFace = faceArg === 'L' ? -1 : 1;
const cut = (s) => { const r = spawnSync('node', ['tools/idg-parts-cut.mjs', sheet, OUT, names, String(s)], { encoding: 'utf8' }); if (r.status) { console.error(r.stderr); process.exit(1); } };
const sizes = () => JSON.parse(fs.readFileSync(path.join(OUT, 'parts.json'), 'utf8')).parts;

/** 그림이 오른쪽을 본다고 치고 쓴 몸 틀 — [이름, 기준점, 자리, 움직임, 덧] */
function template(P) {
  const T = P.torso, L = Math.max(P.leg_f?.h || 0, P.leg_b?.h || P.leg_f?.h || 0), H = P.head;
  const out = [];
  const add = (n, a, p, move, extra = {}) => { if (P[n]) out.push({ n, a, p: p.map(Math.round), move, ...extra }); };
  if (kind === 'dragon') {
    const ty = -L * 1.07, top = ty - T.h / 2;
    add('tail', [0.9, 0.55], [-T.w * 0.3, ty + T.h * 0.26], 'tail');
    add('leg_b', [0.5, 0.12], [-T.w * 0.15, -L * 0.85], 'legB');
    if (!P.leg_b && P.leg_f) out.push({ n: 'leg_f', a: [0.5, 0.12], p: [Math.round(-T.w * 0.15), Math.round(-L * 0.85)], move: 'legB' });
    add('wing', [0.15, 0.9], [-T.w * 0.1, ty - T.h * 0.26], 'wing', { flip: true });
    add('arm_b', [0.35, 0.15], [T.w * 0.21, ty - T.h * 0.15], 'armB');
    add('torso', [0.5, 0.5], [0, ty], 'body');
    add('leg_f', [0.5, 0.12], [T.w * 0.12, -L * 0.8], 'legF');
    add('arm_f', [0.3, 0.15], [T.w * 0.27, ty - T.h * 0.1], 'armF');
    add('head', [0.35, 0.82], [T.w * 0.18, top + T.h * 0.09], 'head', { blink: P.head_blink ? 'head_blink' : undefined, breath: P.head_breath ? 'head_breath' : undefined });
  } else {
    const tb = -L * 0.92, top = tb - T.h * 0.95, hy = top + T.h * 0.08;
    add('leg_b', [0.5, 0.06], [-T.w * 0.14, -L], 'legB');
    add('arm_b', [0.08, 0.35], [-T.w * 0.18, top + T.h * 0.25], 'armB');
    add('torso', [0.5, 0.95], [0, tb], 'body');
    add('leg_f', [0.5, 0.06], [T.w * 0.14, -L], 'legF');
    add('jaw', [0.4, 0.15], [H.w * 0.15, hy - 4], 'jaw');
    add('head', [0.5, 0.92], [0, hy], 'head', { blink: P.head_blink ? 'head_blink' : undefined });
    if (process.env.IDG_HAT === 'cover') add('hat', [0.42, 0.62], [H.w * 0.04, hy - H.h * 0.5], 'head');   // 헬멧처럼 머리를 덮는 모자
    else add('hat', [0.5, 0.85], [0, hy - H.h * 0.75], 'hair');
    add('arm_f', [0.05, 0.35], [T.w * 0.05, top + T.h * 0.32], 'armF');
  }
  return out;
}
const mirror = (parts) => parts.map((q) => ({ ...q, a: [1 - q.a[0], q.a[1]], p: [-q.p[0], q.p[1]] }));
const heightOf = (P, parts) => -Math.min(...parts.map((q) => q.p[1] - P[q.n].h * q.a[1]));

cut(0.2);
let P = sizes(), h0 = heightOf(P, template(P));
const s = Math.round(0.2 * (target / h0) * 1000) / 1000;
cut(s);
P = sizes();
let parts = template(P);
if (artFace < 0) parts = mirror(parts);
const rig = { face: artFace, kind, scale: 1, parts };
fs.writeFileSync(path.join(OUT, 'rig.json'), JSON.stringify(rig, null, 1));
console.log(`${id} : 배율 ${s} · 키 ${Math.round(heightOf(P, template(P)))}칸 · 부품 ${parts.length}개 · 그림 방향 ${faceArg}`);
