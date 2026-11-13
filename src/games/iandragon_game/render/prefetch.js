/**
 * 로비에서 다음 판 전투 그림을 미리 받아 두기 (11/12 겜팀장 실측 «모험시작 → 전투 = R2 128개 · 약 10묶음 · 빈 캐시 4.7초» → 부탁 1번)
 * Pixi 없이 fetch 만 쓴다(로비 코드를 무겁게 하지 않게). R2 는 1년 캐시라, 여기서 받아 두면 전투의 Assets.load 가 브라우저 캐시에서 바로 꺼내 쓴다.
 * 주소는 battleView · rig.js 와 같은 규칙 (/assets/iandragon_game/ → 운영 빌드에서 R2 판 주소로 바뀜).
 */
import { lanesFor } from './lanes.js';

const AI = '/assets/iandragon_game/ai/';
const ART = { chubby: 'cone', shield: 'helmet', bossFat: 'bossGiant', shieldFirm: 'helmet', lavaFirm: 'lava', gearFirm: 'gear', shroomFirm: 'shroom' };   // battleView 와 같은 표 (*Firm = 초고수 굳센 좀비 · 원본 그림)
const get = (u) => fetch(u, { priority: 'low' }).then((r) => (r.ok ? r : null)).catch(() => null);
const json = (u) => get(u).then((r) => (r ? r.json() : null)).catch(() => null);
let done = '';

/** @param {{ world:number, ids:string[] }} o — ids = 리더 · 덱 용 · 이 판 좀비 (그림 이름) */
export async function prefetchBattle({ world = 1, ids = [] }) {
  const key = `${world}:${ids.join(',')}`;
  if (done === key) return; done = key;
  const wN = String(world).padStart(2, '0');
  lanesFor(world).then((ln) => get(`${AI}bg/layers/${ln.front.replace(/\.png$/, '.webp')}`));   // 앞 겹 = lanes.json 의 그 월드 front (1 · 3 · 6 · 10 = _v3)
  [`${AI}bg/layers/w${wN}_sky.webp`, `${AI}castles/nest_hp0.webp`, wN === '01' ? `${AI}castles/tower_hp0.webp` : `${AI}castles/tower_w${wN}_hp0.webp`,
    ...['hp_unit_frame', 'hp_unit_fill_me', 'hp_unit_fill_foe', 'hp_castle_frame', 'hp_castle_fill'].map((n) => `${AI}hud/${n}.png`), `${AI}hud/hp_bars.json`,
    `${AI}fx/meteor.png`, `${AI}meta/wear_anchor.json`, `${AI}meta/wear_items.json`].forEach(get);
  const fix = (await json(`${AI}meta/rigfix.json`)) || {};
  await Promise.all([...new Set(ids.map((id) => ART[id] || id))].map(async (id) => {
    const rig = await json(`${AI}${id}/rig.json`); if (!rig?.parts) return;
    const files = fix[id]?.files || {};
    const names = new Set(rig.parts.flatMap((p) => [p.n, p.blink, p.breath].filter(Boolean)));
    await Promise.all([...names].map((n) => get(`${AI}${id}/${files[n] || n}.png`)));
  }));
}
