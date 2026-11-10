/**
 * 전투 한 판 (B2 · 2026-11-11 야간) — 코어 + 그리기 + HUD 를 묶는다.
 *
 * 고정 간격 루프 (기획서 15.3) : 화면은 매 프레임, 코어는 1/30초씩. 한 프레임 최대 6걸음(×2배속이면 12).
 * 명령(덱 · 화로 · 브레스 · 스킬 · 포효)은 모았다가 다음 걸음에 넣는다 — 코어가 정한 대로만 움직인다.
 * 판이 끝나면 별 · 코인을 저장(onSave)하고 결과 판을 띄운다.
 */
import { TICK, createBattle, step } from '../core/index.js';
import { D } from '../data/battleData.js';
import { createBattleView, tagArt } from './battleView.js';
import { createHud } from './hud.js';
import { makeLoads, starsFor, stageByNo, LAST_STAGE } from './battleSetup.js';

tagArt(D);

/** opts = { stageNo, save, onSave(part), onExit(), restart(stageNo), text } */
export async function startBattle(ctx, opts) {
  const stage = stageByNo(opts.stageNo);
  const { deck, skills, loads } = makeLoads(stage, opts.save);
  const S = createBattle(stage, loads, D, (Date.now() % 1e9) | 0);
  const enemyIds = [...new Set(stage.lines.map((l) => l.id))];
  const view = await createBattleView(ctx, { world: stage.w, L: stage.length, dragons: deck, enemies: enemyIds, leader: loads[0].leader });

  const ui = { speed: 1, paused: false, warn: 0, done: false };
  const cmds = [];
  let acc = 0, bossSeen = false;
  const hud = createHud(ctx.host || opts.hudHost, { stage, deck, skills, text: opts.text }, {
    cmd(c) { if (!ui.paused && !S.over) cmds.push({ p: 0, ...c }); },
    pause() { if (ui.done) return; ui.paused = !ui.paused; if (ui.paused) hud.showPanel('pause'); else hud.hidePanel(); },
    speed() { ui.speed = ui.speed === 1 ? 2 : 1; },
    exit() { opts.onExit(); },
    retry() { opts.restart(stage.g); },
    next() { opts.restart(Math.min(LAST_STAGE, stage.g + 1)); },
  });

  function finish() {
    ui.done = true;
    const win = S.over.winner === 0;
    const info = { t: S.t, hasNext: stage.g < LAST_STAGE };
    if (win) {
      info.stars = starsFor(stage, S.t);
      const save = opts.save || {};
      const stars = (save.stars || '').padEnd(stage.g, '0').split('');
      const first = (Number(stars[stage.g - 1]) || 0) === 0;
      stars[stage.g - 1] = String(Math.max(Number(stars[stage.g - 1]) || 0, info.stars));
      info.coins = first ? stage.reward?.coins || 0 : Math.round((stage.reward?.coins || 0) * 0.3);
      const part = { cleared: Math.max(save.cleared || 0, stage.g), stars: stars.join(''), coins: (save.coins || 0) + info.coins, gems: (save.gems || 0) + (first ? stage.reward?.gems || 0 : 0) };
      try { opts.save = opts.onSave?.(part) || { ...save, ...part }; } catch (e) { console.warn('[좀비와 드래곤] 저장 실패', e); }
    } else info.hint = loseHint(S);
    setTimeout(() => hud.showPanel(win ? 'win' : 'lose', info), win ? 1600 : 900);
  }

  const tick = (ticker) => {
    const dt = Math.min(0.1, ticker.deltaMS / 1000);
    if (!ui.paused) {
      acc += dt * ui.speed;
      let n = 0;
      while (acc >= TICK && n < 6 * ui.speed) { step(S, cmds.splice(0)); acc -= TICK; n++; }
      if (acc > TICK * 6) acc = 0;
      if (S.boss && !bossSeen) { bossSeen = true; ui.warn = 0.9; }
      ui.warn -= dt;
      if (S.over && !ui.done) finish();
      view.update(S, dt);
    }
    hud.update(S, ui);
  };
  ctx.app.ticker.add(tick);
  if (import.meta.env.DEV) window.__idgBattle = { S, view, ui, cmds };

  return {
    destroy() { ctx.app.ticker?.remove(tick); hud.destroy(); view.destroy(); },
    pause() { if (!ui.done && !ui.paused) { ui.paused = true; hud.showPanel('pause'); } },
  };
}

/** 졌을 때 힌트 (기획서 11.6) — 가장 그럴듯한 이유 하나 */
function loseHint(S) {
  const p = S.players[0];
  if (p.st.walletUps === 0) return '화로를 올리면 불씨가 더 빨리 모여요!';
  if (p.st.breath === 0) return '브레스가 차면 꾹! 앞에 있는 좀비를 한꺼번에 태워요.';
  if (p.st.spawned < 15) return '용을 더 자주 내보내 보세요. 싼 꼬물이로 앞을 막아요.';
  return '돌등이처럼 튼튼한 용으로 앞을 막고, 뒤에서 퉤퉤로 공격해요.';
}
