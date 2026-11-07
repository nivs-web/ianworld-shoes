/**
 * 운영자 난이도 설정 서비스 검사 (진단 전용, 2026-11-07)
 *
 *   node --import ./tools/_sim-loader.mjs tools/_tuning-qa.mjs
 *
 * 브라우저 없이 `src/services/tuning.js` 를 돌린다 — 배율 · 기본값 · 캐시 · 운영자만 쓰기 · 서버 읽기 한 번.
 * 가짜 서버(`tools/_sim/rtdb.mjs`)가 `config/tuning` 규칙을 흉내 낸다.
 */
import { CTX } from './_sim/firebase.js';
import { FakeDb } from './_sim/rtdb.mjs';

/* localStorage 대역 — 노드에는 없다 */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

let fails = 0;
const ok = (label, v, extra = '') => { if (!v) fails++; console.log(`${v ? '  ok  ' : '  X   '} ${label}${extra ? '  ' + extra : ''}`); };
const near = (a, b, eps = 1e-3) => Math.abs(a - b) < eps;
/* 모듈을 새로 받는다 — 앱을 껐다 켠 것과 같다 (메모리 캐시는 비고, localStorage 는 남는다) */
let gen = 0;
const fresh = () => import(`../src/services/tuning.js?run=${++gen}`);

const db = new FakeDb();
db.write('admins/ADMIN', true);
CTX.db = db;

console.log('1) 배율 · 기본값');
{
  CTX.uid = null;                      // 로그인 전 — 서버 못 읽음
  const T = await fresh();
  ok('factor(50) = 1', T.factor(50) === 1);
  ok('factor(51) ≈ 1.015 (1칸 = 1.5%)', near(T.factor(51), 1.015));
  ok('factor(99) ≈ 2.07', near(T.factor(99), 2.073, 0.002), T.factor(99).toFixed(4));
  ok('factor(1) ≈ 0.48', near(T.factor(1), 0.482, 0.002), T.factor(1).toFixed(4));
  ok('factor 는 범위 밖을 1~99 로 자른다', T.factor(500) === T.factor(99) && T.factor(-3) === T.factor(1));
  ok('clampLevel: 정수로 · 숫자 아니면 null', T.clampLevel(12.6) === 13 && T.clampLevel('x') === null && T.clampLevel(0) === 1);
  ok('아무것도 없으면 50', T.level('catch', 'throw') === 50 && T.tune('dragon', 'hp') === 1);
  const t = T.tunes('catch');
  ok('tunes(catch) = 세 키 모두 1', Object.keys(t).join() === 'throw,catch,speed' && Object.values(t).every((v) => v === 1));
  ok('키 표 — catch 3 · dragon 3 · jump 4', T.TUNING.catch.length === 3 && T.TUNING.dragon.length === 3 && T.TUNING.jump.length === 4);
  ok('로그인 전 loadTuning → 캐시(전부 50), 실패해도 안 터진다', (await T.loadTuning()) && T.level('jump', 'speed') === 50);
}

console.log('\n2) 운영자만 쓴다');
{
  CTX.uid = 'GUEST1';
  const T = await fresh();
  const r = await T.setLevel('catch', 'throw', 30);
  ok('손님 setLevel → 거부', r === false);
  ok('손님 거부 뒤 이 기기 캐시도 되돌린다 (50)', T.level('catch', 'throw') === 50);
  ok('서버에 안 들어갔다', db.read('config/tuning') === null);

  CTX.uid = 'ADMIN';
  const T2 = await fresh();
  ok('운영자 setLevel(catch.throw = 30) → 저장', await T2.setLevel('catch', 'throw', 30));
  ok('운영자 화면엔 곧바로 30', T2.level('catch', 'throw') === 30);
  ok('서버 값 30 (정수)', db.read('config/tuning/catch/throw') === 30);
  ok('운영자 setLevel(dragon.enemy = 64.4) → 64 로 저장', await T2.setLevel('dragon', 'enemy', 64.4) && db.read('config/tuning/dragon/enemy') === 64);
  ok('범위 밖 120 → 99 로 잘라 저장', await T2.setLevel('dragon', 'hp', 120) && db.read('config/tuning/dragon/hp') === 99);
  ok('모르는 키는 보내지도 않는다', (await T2.setLevel('catch', 'wind', 40)) === false && db.read('config/tuning/catch/wind') === null);
  ok('모르는 게임도', (await T2.setLevel('shoes', 'gauge', 40)) === false);
  /* 규칙 흉내 자체 — 클라이언트를 우회한 쓰기 */
  const raw = (await import('./_sim/rtdb.mjs')).makeFb(db, 'ADMIN');
  const deny = async (p, v) => { try { await raw.dbMod.set(raw.dbMod.ref(null, p), v); return false; } catch { return true; } };
  ok('서버: 소수 50.5 거부', await deny('config/tuning/catch/speed', 50.5));
  ok('서버: 0 · 100 거부', (await deny('config/tuning/catch/speed', 0)) && (await deny('config/tuning/catch/speed', 100)));
  ok('서버: 모르는 키 거부', await deny('config/tuning/jump/wind', 50));
  ok('서버: 문자열 거부', await deny('config/tuning/jump/timing', '50'));
}

console.log('\n3) 다른 사람 — 다음 접속부터 · 캐시');
{
  CTX.uid = 'PLAYER';
  store.delete('sf_tuning');           // 이 사람 기기는 처음
  const T = await fresh();
  ok('앱 켜자마자(읽기 전) = 50', T.level('catch', 'throw') === 50);
  let reads = 0;
  const before = db.read.bind(db);     // 서버 읽기 횟수를 센다
  db.read = (p) => { if (p === 'config/tuning') reads++; return before(p); };
  await Promise.all([T.loadTuning(), T.loadTuning(), T.loadTuning()]);
  await T.loadTuning();
  db.read = before;
  ok('loadTuning 을 네 번 불러도 서버는 한 번 읽는다', reads === 1, `읽기 ${reads}회`);
  ok('읽은 뒤 catch.throw = 30 · dragon.enemy = 64 · hp = 99', T.level('catch', 'throw') === 30 && T.level('dragon', 'enemy') === 64 && T.level('dragon', 'hp') === 99);
  ok('tune = 1.015^(lv-50)', near(T.tune('catch', 'throw'), Math.pow(1.015, -20)) && near(T.tune('dragon', 'enemy'), Math.pow(1.015, 14)));
  ok('없는 칸은 50', T.level('jump', 'damage') === 50 && T.level('catch', 'speed') === 50);
  ok('localStorage 캐시에 들어갔다', JSON.parse(store.get('sf_tuning')).v.catch.throw === 30);

  /* 오프라인으로 다시 켠다 — 캐시로 돈다 */
  CTX.db = null;
  const T2 = await fresh();
  ok('오프라인 재시작: 읽기 전에도 캐시 값(30)', T2.level('catch', 'throw') === 30);
  await T2.loadTuning();
  ok('오프라인 loadTuning 실패 → 캐시 그대로', T2.level('catch', 'throw') === 30 && T2.level('dragon', 'hp') === 99);
  CTX.db = db;
  await T2.loadTuning();
  ok('다시 붙으면 다음 loadTuning 에서 읽는다 (실패는 기억하지 않는다)', T2.level('dragon', 'enemy') === 64);

  /* 캐시가 망가졌거나 손으로 고친 값 */
  store.set('sf_tuning', JSON.stringify({ v: { catch: { throw: 12.5, speed: 300, catch: 'x', wind: 9 }, dragon: { hp: 70 }, evil: { a: 1 } } }));
  CTX.db = null;
  const T3 = await fresh();
  ok('캐시의 소수 · 범위 밖 · 문자 · 모르는 키는 버린다(50)', T3.level('catch', 'throw') === 50 && T3.level('catch', 'speed') === 50 && T3.level('catch', 'catch') === 50);
  ok('캐시의 바른 값은 쓴다 (dragon.hp 70)', T3.level('dragon', 'hp') === 70);
  store.set('sf_tuning', '{망가진 json');
  const T4 = await fresh();
  ok('캐시가 깨진 JSON 이면 전부 50', T4.level('dragon', 'hp') === 50);
  CTX.db = db;

  /* 운영자가 칸을 지우면(되돌리기) 다음 접속에 50 */
  db.write('config/tuning/dragon', null);
  const T5 = await fresh();
  await T5.loadTuning();
  ok('서버에서 지운 칸은 다음 접속에 50', T5.level('dragon', 'enemy') === 50 && T5.level('catch', 'throw') === 30);
}

console.log('');
if (fails) { console.error(`난이도 설정 검사 실패 — ${fails}건`); process.exit(1); }
console.log('난이도 설정 서비스 통과');
