/**
 * 그림 담당 — 용 조립 보정 표 만들기 (겜보조 · 2026-11-12 · 대표님 «날개가 거꾸로 달린 용이 너무 많다 · 하나하나 꼼꼼히»)
 *
 *   node tools/idg-rigfix-dragon.mjs        → public/assets/iandragon_game/ai/meta/rigfix_dragon.json 을 새로 쓴다
 *
 * 날개 거꾸로의 원인 : 원본 날개 그림은 대부분 이미 «뿌리(굵은 뼈 끝)가 오른쪽 아래 · 막이 왼쪽으로 펼쳐진» 모양이라
 *   오른쪽을 보는 용에는 그대로 붙여야 하는데, rig.json 이 모든 용 날개를 flip:true 로 한 번 더 뒤집었다
 *   → 뿌리가 몸에서 먼 쪽 · 날개 끝이 어깨에 붙음. ROOT_RIGHT 의 용은 flip 을 풀고 기준점을 뿌리(오른쪽 아래)로 옮긴다.
 *   (뿌리가 왼쪽 아래인 그림 — aquantis 처럼 — 은 지금 flip 이 맞다)
 * 표 형식은 rigfix_zombie.json 과 같고 scale(크기 배수) · files(고친 부품 그림 새 이름) 이 더 있다.
 * 날개 · 꼬리 자리 p 는 rigfix.json 몫이라 p 를 다시 적을 때는 rigfix.json 값을 읽어 그 위에서 고친다.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const AI = path.join(ROOT, 'public/assets/iandragon_game/ai');
const OUT = path.join(AI, 'meta/rigfix_dragon.json');
const WINGTAIL = JSON.parse(fs.readFileSync(path.join(AI, 'meta/rigfix.json'), 'utf8'));

/* 날개 그림의 뿌리(굵은 팔뼈 끝 · 엄지 발톱 쪽)가 오른쪽인 용 — 43종을 한 장씩 크게 보고 고름 (11/12)
 * 그대로 두는 17종 : aquantis byeolttong forestia frostwing goldrex jjirit jjirit_2 kkomul kkomul_2 kungkwang novart
 *   sandscale sapjil shadowfen volttail (뿌리가 왼쪽 아래라 지금 flip 이 맞음) · twetwe twetwe_2 (11/11 에 wing_v2 로 새로 그려 맞춤) */
const ROOT_RIGHT = ['bangul', 'bangul_2', 'banjjak', 'bulttong', 'bulttong_2', 'crimsonde', 'doldeung', 'doldeung_2', 'dongjeon',
  'dungsil', 'dungsil_2', 'eoreum', 'eoreum_2', 'gasigong', 'geuneul', 'giljjuk', 'giljjuk_2', 'hwanggeum', 'meari', 'nunbora',
  'pokjuk', 'solaris', 'sommung', 'ssaeng', 'ssaeng_2', 'ssangdung'];
/* 손 보정 (점검 화면에서 맞춘 값) */
const HAND = {
  /* 솜뭉치 : 몸통을 3 내려 다리 윗부분(배 무늬)을 더 덮고, 앞팔 기준점을 남은 어깨로 (날개 조각을 지운 뒤 빈 자리였음) */
  sommung: { torso: { p: [0, -34] }, arm_f: { a: [0.64, 0.24], p: [21, -37] }, arm_b: { a: [0.6, 0.3], p: [17, -38] } },
};
const ORDER = {
  /* 솜뭉치 : 앞다리 그림에 배 무늬가 같이 그려져 몸통 앞에 오면 배가 둘로 보인다 → 몸통 뒤로, 발만 아래로 보이게 */
  sommung: ['tail', 'leg_b', 'leg_f', 'wing', 'arm_b', 'torso', 'arm_f', 'head'],
};
/* 크기 배수 (대표님 «길쭉하고 크게 생긴 용은 더 크게 · 뽑는 재미 · 용마다 정해라»)
 * 지금 키는 모두 80~93 으로 비슷하다 → 등급 · 진화 · 몸집으로 나눈다. 리더 10종은 둥지 자리 크기가 따로 있어 그대로(1).
 *   이야기 용 기본 1 · 진화(_2) 1.12 · 희귀 1.05 · 영웅 1.12 · 전설 1.2 · 길쭉이 1.15 / 1.3 · 쿵쾅이 · 돌등이 진화 1.15 */
const SCALE = {
  bangul_2: 1.12, bulttong_2: 1.12, dungsil_2: 1.12, eoreum_2: 1.12, jjirit_2: 1.12, kkomul_2: 1.12, ssaeng_2: 1.12, twetwe_2: 1.12,
  doldeung_2: 1.15, kungkwang: 1.15, giljjuk: 1.15, giljjuk_2: 1.3,
  sapjil: 1.05, pokjuk: 1.05, sommung: 1.05, dongjeon: 1.05,
  gasigong: 1.12, meari: 1.12, geuneul: 1.12, nunbora: 1.12,
  byeolttong: 1.2, hwanggeum: 1.2, ssangdung: 1.2,
};
/* 고친 부품 그림 (tools/idg-dragon-partfix.mjs 가 새 이름으로 만든다) */
const FILES = {
  meari: { head: 'head_ear1', head_blink: 'head_blink_ear1' },   // 귀 투명 구멍 채움
  banjjak: { head: 'head_eye1' },                                // 눈동자
  sommung: { arm_f: 'arm_f_fix1', arm_b: 'arm_b_fix1' },         // 팔에 붙어 온 날개 조각 지움
};

const out = {};
const ids = fs.readdirSync(AI).filter((d) => !/^boss/.test(d) && fs.existsSync(path.join(AI, d, 'rig.json'))).sort();
for (const id of ids) {
  const rig = JSON.parse(fs.readFileSync(path.join(AI, id, 'rig.json'), 'utf8'));
  if (rig.kind !== 'dragon') continue;
  const F = {};
  if (ROOT_RIGHT.includes(id)) {
    const w = rig.parts.find((p) => p.n === 'wing');
    if (w?.flip) (F.parts ||= {}).wing = { flip: false, a: [+(1 - w.a[0]).toFixed(2), w.a[1]] };
  }
  for (const [n, d] of Object.entries(HAND[id] || {})) (F.parts ||= {})[n] = { ...F.parts?.[n], ...d };
  if (ORDER[id]) F.order = [...ORDER[id]];
  if (SCALE[id]) F.scale = SCALE[id];
  if (FILES[id]) F.files = { ...FILES[id] };
  if (Object.keys(F).length) out[id] = F;
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`→ ${path.relative(ROOT, OUT)} ${Object.keys(out).length}종 : ${Object.keys(out).join(' ')}`);
