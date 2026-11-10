/**
 * 멀티 락스텝 검사 (3차 준비 · 2026-11-11) — node tools/idg-lockstep-qa.mjs [판 수=20]
 * 기기 두 대를 흉내 낸다 : 각자 같은 씨앗 · 같은 편성으로 전투를 만들고, 각자 기준 AI 가 버튼을 누르고,
 * 묶음(lk)을 0.2초마다 «느리고(0.05~0.6초) · 순서가 뒤섞이고 · 30% 는 사라지는» 가짜 네트워크로 주고받는다.
 * 합격 : 판마다 두 기기의 마지막 상태 해시가 같다 · 해시 어긋남 0 · 명령이 하나도 사라지지 않음 · 판이 끝까지 감.
 * 협동(같은 편 둘)과 대결(pvp · 양쪽 한 명씩) 둘 다 본다.
 */
import { createBattle, step, aiCommands, hashState, TICK } from '../src/games/iandragon_game/core/index.js';
import { D } from '../src/games/iandragon_game/data/battleData.js';
import { stageByNo, makeLoads } from '../src/games/iandragon_game/render/battleSetup.js';
import { createLockstep } from '../src/games/iandragon_game/net/lockstep.js';

const N = Number(process.argv[2] || 20);
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log('✘ ' + m); } };
let rs = 12345; const rnd = () => ((rs = (rs * 1103515245 + 12345) >>> 0) / 4294967296);

function run(mode, g, seed) {
  const st0 = stageByNo(g);
  const stage = mode === 'pvp' ? { ...st0, pvp: true, lines: [], baseHp: 3000 } : st0;
  const base = makeLoads(st0, {}).loads[0];
  const loads = mode === 'pvp' ? [{ ...base, side: 0 }, { ...base, side: 1 }] : [{ ...base, side: 0 }, { ...base, side: 0 }];
  const dev = [0, 1].map((seat) => ({
    seat, S: createBattle(stage, loads, D, seed), ls: createLockstep({ seat, seats: 2 }), mem: {}, now: 0, sent: 0, inbox: [],
  }));
  const pol = { walletTarget: 3, useSkills: true };
  let wall = 0, pressed = 0, applied = [0, 0];
  const LIMIT = 30 * 900;   // 대결은 제한 시간(300초)까지 갈 수 있다 — 지연 대기까지 넉넉히
  while (wall < LIMIT && !(dev[0].S.over && dev[1].S.over)) {
    wall++;
    for (const d of dev) {
      /* 내 버튼 (기준 AI 가 0.5초마다 생각) */
      if (wall % 15 === d.seat * 7 && !d.S.over) for (const c of aiCommands(d.S, d.seat, pol, d.mem)) { if (d.ls.press(c, d.now) >= 0) pressed++; }
      /* 0.2초마다 묶음 보내기 → 가짜 네트워크 */
      if (wall % 6 === 0) {
        const pk = d.ls.packet(d.now, d.now % 150 === 0 && d.now > 0 ? [d.now, hashState(d.S)] : null);
        if (rnd() > 0.3) dev[1 - d.seat].inbox.push({ at: wall + Math.round((0.05 + rnd() * 0.55) * 30), pk });
      }
      /* 도착한 묶음 받기 (늦게 · 뒤섞여) */
      d.inbox = d.inbox.filter((m) => { if (m.at <= wall) { d.ls.receive(1 - d.seat, m.pk); return false; } return true; });
      /* 약속된 틱까지만 계산 (한 프레임 최대 6걸음) */
      for (let k = 0; k < 6 && !d.S.over && d.ls.ready(d.now + 1); k++) {
        d.now++; const cs = d.ls.commandsAt(d.now); applied[d.seat] += cs.length; step(d.S, cs);
      }
    }
  }
  /* 끝난 뒤 남은 묶음까지 다 받게 한 번 더 */
  const h0 = hashState(dev[0].S), h1 = hashState(dev[1].S);
  ok(dev[0].S.over && dev[1].S.over, `${mode} ${st0.id} 씨앗 ${seed} : 판이 끝나지 않음 (틱 ${dev[0].now}/${dev[1].now})`);
  ok(h0 === h1, `${mode} ${st0.id} 씨앗 ${seed} : 마지막 해시가 다름 ${h0} ≠ ${h1}`);
  ok(dev[0].ls.mismatch() < 0 && dev[1].ls.mismatch() < 0, `${mode} ${st0.id} : 중간 해시 어긋남`);
  ok(applied[0] === applied[1], `${mode} ${st0.id} : 실행한 명령 수가 다름 ${applied[0]} ≠ ${applied[1]}`);
  return { ticks: dev[0].now, pressed, applied: applied[0], winner: dev[0].S.over?.winner };
}

let sum = 0;
for (let i = 0; i < N; i++) {
  const mode = i % 2 ? 'pvp' : 'coop', g = 1 + (i * 7) % 50, seed = 100 + i;
  const r = run(mode, g, seed);
  sum += r.applied;
  if (i < 4) console.log(`  ${mode} ${stageByNo(g).id} : ${r.ticks}틱 · 누른 명령 ${r.pressed} · 실행 ${r.applied} · 승자 ${r.winner}`);
}
console.log(bad ? `✘ 락스텝 검사 ${bad}건 실패` : `✔ 락스텝 검사 통과 — ${N}판 (협동 · 대결) · 30% 유실 · 지연 0.05~0.6초 · 명령 ${sum}개 모두 두 기기 같게`);
process.exit(bad ? 1 : 0);
