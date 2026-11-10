/**
 * 이안 드래곤 게임 — 오락실이 부르는 문 (기획서 15.2). `mount(host, opts)` · `unmount()` · `requestPause()`.
 *
 * B0(뼈대) 단계 : PixiJS 가로 화면 · 정수배 도트 · 세로 지킴이 · 그림 시트 읽기까지.
 * 지금 보이는 장면(용 · 좀비가 걸어가는 것)은 **화면 확인용 임시 장면**이다 — B1 에서 전투 코어를,
 * B2 에서 진짜 전장 화면을 붙이면서 `demo.js` 는 지운다.
 *
 * @typedef {{ save:object, text:{rotate:string,rotateSub:string,exit:string},
 *             onSave:(part:object)=>object, onExit:()=>void }} MountOpts
 */

import { Assets } from 'pixi.js';
import { createApp } from './render/app.js';
import { guardLandscape } from './render/orient.js';
import { startDemo } from './render/demo.js';
import { startPilot } from './render/pilot.js';
import { startBattle } from './render/battle.js';
import { LAST_STAGE } from './render/battleSetup.js';
import * as Audio from './audio/index.js';

export const ATLAS_URL = '/assets/iandragon_game/atlas.json';
const ENV_URL = (name) => `/assets/iandragon_game/env/${name}.json`;

let S = null;   // 지금 붙어 있는 판 하나

/** @param {HTMLElement} host @param {MountOpts} opts */
export async function mount(host, opts) {
  unmount();
  const me = { alive: true, paused: false };
  S = me;
  host.classList.add('idg-host');

  const ctx = await createApp(host);
  if (!me.alive) { ctx.destroy(); return; }
  me.ctx = ctx;

  Audio.init();
  /* 점검용 주소(?idgDemo · ?idgPilot · ?idgStage=N)는 개발 서버에서만 — 운영에서 순서 잠금을 건너뛰지 못하게 (코드 검토 3) */
  const q = import.meta.env.DEV ? location.search : '';
  /* 옛 장면(시트 기반)만 캐릭터 시트 · 배경 시트가 필요하다 — 전투는 ai/ 그림만 쓴다 (코드 검토 2) */
  let T = null, has = null, sheetMeta = null;
  if (/idgDemo|idgPilot/.test(q)) {
    const [sheet, common, w01] = await Promise.all([Assets.load(ATLAS_URL), Assets.load(ENV_URL('common')), Assets.load(ENV_URL('w01'))]);
    if (!me.alive) return;
    const sheets = [common, w01, sheet];
    has = (name) => sheets.some((s) => s.textures[name]);
    T = (name) => { for (const s of sheets) if (s.textures[name]) return s.textures[name]; return sheet.textures['icon/star'] ?? Object.values(sheet.textures)[0]; };
    sheetMeta = [w01.data.meta, common.data.meta];
  }

  /* 그림 공장 시험판(2026-11-11) — 옛 기준 장면은 주소에 ?idgDemo 를 붙이면 본다 */
  /* B2 (2026-11-11 야간) — 진짜 전투. 옛 장면 : ?idgDemo(기준 장면) · ?idgPilot(그림 공장 시험판) */
  const begin = async (stageNo) => {
    me.scene?.destroy(); me.scene = null;
    try {
      me.scene = await startBattle({ ...ctx, host }, {
      stageNo, save: opts.save, text: opts.text,
      onSave: (part) => (opts.save = opts.onSave(part)),
      onExit: () => opts.onExit(),
      restart: (no) => { if (me.alive) begin(no); },
      });
    } catch (e) {   /* 못 열면 갇히지 않게 로비로 (코드 검토 1) */
      console.warn('[좀비와 드래곤] 전투를 열지 못했다', e);
      if (me.alive) opts.onExit();
    }
  };
  const stQ = Number((q.match(/[?&]idgStage=(\d+)/) || [])[1]);   // 점검용 : ?idgStage=12
  if (/idgDemo/.test(q)) me.scene = startDemo(ctx, T, has, sheetMeta[0], sheetMeta[1]);
  else if (/idgPilot/.test(q)) me.scene = await startPilot(ctx, T);
  else await begin(stQ || opts.stageNo || Math.min(LAST_STAGE, (opts.save?.cleared || 0) + 1));
  const battle = !/idgDemo|idgPilot/.test(q);

  /* 나가기 단추 (화면 위 DOM — 캔버스 글씨 금지 규칙) */
  const exit = document.createElement('button');
  exit.type = 'button';
  exit.className = 'idg-exit';
  exit.textContent = opts.text.exit;
  exit.addEventListener('click', () => opts.onExit());
  if (!battle) { host.appendChild(exit); me.exitBtn = exit; }   // 전투는 일시정지 판 안에 나가기가 있다

  me.guard = guardLandscape(host, opts.text, {
    onPortrait: () => { me.scene?.pause?.(); setPaused(me, true); },
    onLandscape: () => setPaused(me, false),
    onExit: () => opts.onExit(),
  });
}

function setPaused(me, on) {
  me.paused = on;
  if (!me.ctx) return;
  if (on) me.ctx.app.stop(); else me.ctx.app.start();
}

/** 뒤로가기 · ESC — 지금은 일시정지 토글 (B3 에서 일시정지 화면) */
export function requestPause() {
  if (!S || !S.ctx) return;
  if (S.guard?.portrait) return;    // 세로 안내 중에는 그대로
  if (S.scene?.back) { S.scene.back(); return; }   // 전투 : 카드면 나가기, 아니면 일시정지 판(계속 · 다시 · 나가기)
  setPaused(S, !S.paused);
}

export function unmount() {
  const me = S;
  if (!me) return;
  S = null;
  me.alive = false;
  me.guard?.destroy();
  me.exitBtn?.remove();
  me.scene?.destroy();
  me.ctx?.destroy();
}
