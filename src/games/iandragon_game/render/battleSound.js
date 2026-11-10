/**
 * 전투 소리 잇기 (B3 · 2026-11-11 야간) — 코어 상태가 «바뀐 순간»을 찾아 겜팀장 audio/index.js 를 부른다.
 * 소리 id 는 겜팀장 sfx.js · music.js · voice-lines.js 그대로. 없는 id · 아직 없는 음성 파일은 조용히 넘어간다.
 * 오락실 소리 설정을 따른다 : 효과음 끔 → 전부 끔 · 배경음 끔 → 곡만 안 튼다. 소리는 화면 전용(계산 영향 없음).
 */
import * as Audio from '../audio/index.js';
import { getSettings } from '../../../audio/audio.js';

const deployFx = (cost) => (cost < 150 ? 'deploy_s' : cost < 400 ? 'deploy_m' : 'deploy_l');

export function createBattleSound(stage) {
  const set = getSettings();
  const musicOn = set.bgmEnabled !== false;
  Audio.init();
  Audio.setMuted(set.sfxEnabled === false);
  let cur = null;   // 지금 곡 (일시정지 뒤 다시 틀기)
  const song = (id, rate) => { cur = id; if (musicOn) Audio.bgm(id, { rate }); };
  const timers = [];   // 나간 뒤에 소리가 나지 않게 모아 두었다가 지운다 (코드 검토 6)
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  if (musicOn) Audio.worldBgm(stage.w);   // 겜팀장 월드 곡 (월드 1 «죽음의 무도» … 월드 5 «마법사의 제자»)
  const was = { spawned: 0, wl: 0, breath: 0, breathReady: false, skill: 0, rage: 0, kills: 0, base0: null, base1: null, boss: null, bossHalf: false, fever: false, over: false, hits: 0, units: new Set(), spawnT: [], waveCd: 0, lastWave: false };

  return {
    /** 매 프레임 — S = 코어 상태, view = 그리기(맞은 횟수 hits) */
    update(S, view) {
      const p = S.players[0];
      if (p.st.spawned > was.spawned) {
        const ids = new Set(S.units.filter((u) => u.side === 0).map((u) => u.id));
        for (const u of S.units) if (u.side === 0 && !was.units.has(u.id)) { Audio.play(deployFx(u.def.cost)); if (Math.random() < 0.4) Audio.voice(`deploy/${u.def._art}`); break; }
        was.units = ids;
      } else was.units = new Set(S.units.filter((u) => u.side === 0).map((u) => u.id));
      was.spawned = p.st.spawned;
      if (p.wl > was.wl) { Audio.play('wallet_up'); if (Math.random() < 0.5) Audio.voice('brazier'); } was.wl = p.wl;
      const ready = p.breathT >= p.breathCharge;
      if (ready && !was.breathReady) Audio.play('breath_ready'); was.breathReady = ready;
      if (p.st.breath > was.breath) { Audio.play('breath_fire'); Audio.voice('breath'); } was.breath = p.st.breath;
      if (p.st.skill > was.skill) { const used = p.skills.find((s) => s.cdT > s.def.cd - 0.2); Audio.play(`skill_${used ? used.id : 'meteor'}`); } was.skill = p.st.skill;
      if (p.st.rageUse > was.rage) { Audio.play('roar'); Audio.voice('roar'); } was.rage = p.st.rageUse;
      if (S.st.kills > was.kills) Audio.play('die'); was.kills = S.st.kills;
      if (view.hits > was.hits) Audio.play(view.bigHit ? 'hit_heavy' : 'hit_light'); was.hits = view.hits;
      for (const side of [0, 1]) {
        const k = side ? 'base1' : 'base0', hp = S.base[side].hp;
        if (was[k] != null && hp < was[k]) Audio.play('base_hit');
        was[k] = hp;
      }
      const b = S.boss;
      if (b && was.boss !== b.id) { was.boss = b.id; Audio.play('boss_warn'); later(() => Audio.play('shockwave'), 700); Audio.voice(`boss/${b.def._art}`); song('boss'); }
      if (b && !was.bossHalf && b.hp <= b.maxHp / 2) { was.bossHalf = true; Audio.voice(`boss/${b.def._art}/half`); }
      if (!was.fever && S.t >= S.feverAt) { was.fever = true; Audio.voice('fever'); }
      /* 무리 대사 (겜팀장) : 1.5초 안에 좀비 4마리 이상 = 큰 무리(20초에 한 번) · 정해진 무리 줄이 하나 남고 그것이 나오기 시작 = 마지막 무리(한 번) */
      while (was.spawnT.length && S.t - was.spawnT[0] > 1.5) was.spawnT.shift();
      for (let k = was.enemies ?? S.st.enemySpawned; k < S.st.enemySpawned; k++) was.spawnT.push(S.t);
      was.enemies = S.st.enemySpawned; was.waveCd -= 1 / 60;
      if (was.spawnT.length >= 4 && was.waveCd <= 0 && S.t > 5) { was.waveCd = 20; Audio.voice('wave/big'); }
      if (!was.lastWave) {
        const fin = S.lines.filter((l) => l.count < 900 && !l.boss), left = fin.filter((l) => l.left > 0);
        if (fin.length > 2 && left.length === 1 && left[0].left < left[0].count) { was.lastWave = true; Audio.voice('wave/last'); }
      }
      if (S.over && !was.over) {
        was.over = true; Audio.stopBgm();
        if (S.over.winner === 0) { Audio.play('base_break'); if (b && !b.alive) Audio.voice('bossdown'); later(() => { Audio.play('win_fanfare'); Audio.voice('win'); }, 900); }
        else { Audio.play('lose_womp'); Audio.voice('lose'); }
      }
    },
    /** 출격! (스테이지 카드에서) */
    start() { Audio.voice('start'); },
    /** 결과 판의 별 «탕 · 탕 · 탕» */
    stars(n) { for (let i = 0; i < n; i++) later(() => Audio.play('star'), 300 + i * 350); },
    /** 일시정지 · 앱 내림 : 곡까지 멈춤, 풀면 다시 (코드 검토 12) */
    pause(on) {
      if (on) Audio.setMuted(true);
      else { Audio.setMuted(set.sfxEnabled === false); if (musicOn) { if (cur) Audio.bgm(cur); else Audio.worldBgm(stage.w); } }
    },
    destroy() { for (const t of timers) clearTimeout(t); Audio.stopBgm(); },
  };
}
