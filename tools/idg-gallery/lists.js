/**
 * 갤러리 목록 — 폴더를 훑지 않고 data(units · enemies · leaders) + 알려진 폴더 이름으로 만든다.
 * 그림이 있는지는 main.js 가 열 때 한 번씩 두드려 보고 «아직 없음» 카드로 바꾼다.
 */
import { UNITS } from '/src/games/iandragon_game/data/units.js';
import { ENEMIES } from '/src/games/iandragon_game/data/enemies.js';
import { LEADERS } from '/src/games/iandragon_game/data/leaders.js';

export const A = '/assets/iandragon_game/ai/';
/** 그림 id 가 이름표 id 와 다른 것 (render/battleView.js 의 ART 와 같다) */
export const ART = { chubby: 'cone', shield: 'helmet', bossFat: 'bossGiant' };
export const RAR = { story: '이야기 용', rare: '희귀', super: '슈퍼', legend: '전설' };

const unit = (id, u, art, name, sub, extra = {}) => ({ id, art, name, sub, data: u, ...extra });
const entries = Object.entries;

export const TABS = [
  { id: 'dragon', label: '용', kind: 'rig', items: () => entries(UNITS).filter(([, u]) => u.rar === 'story').map(([id, u]) => unit(id, u, id, u.name, `${id} · ${u.role}`, { facing: 1 })) },
  { id: 'evolve', label: '진화형', kind: 'rig', items: () => entries(UNITS).filter(([, u]) => u.rar === 'story' && u.forms?.[2]).map(([id, u]) => unit(id, u, id + '_2', u.forms[2].name, `${id}_2 · ${u.name} 진화`, { facing: 1 })) },
  { id: 'leader', label: '리더', kind: 'rig', items: () => entries(LEADERS).map(([id, l]) => unit(id, l, id, l.ko, `${id} · 해금 ${l.unlock}`, { facing: 1 })) },
  { id: 'zombie', label: '좀비', kind: 'rig', items: () => entries(ENEMIES).filter(([, e]) => !e.boss).map(([id, e]) => unit(id, e, ART[id] || id, e.name, `${ART[id] ? id + ' → ' + ART[id] : id} · 월드 ${e.w || '-'}`, { facing: -1 })) },
  { id: 'boss', label: '보스', kind: 'rig', items: () => entries(ENEMIES).filter(([, e]) => e.boss).map(([id, e]) => unit(id, e, ART[id] || id, e.name, `${ART[id] ? id + ' → ' + ART[id] : id} · 월드 ${e.w}`, { facing: -1 })) },
  { id: 'hatch', label: '부화장 용', kind: 'rig', items: () => entries(UNITS).filter(([, u]) => u.rar !== 'story').map(([id, u]) => unit(id, u, id, u.name, `${id} · ${RAR[u.rar]}`, { facing: 1, rar: u.rar })) },
  { id: 'bg', label: '배경', kind: 'bg', items: () => Array.from({ length: 10 }, (_, i) => ({ id: 'w' + String(i + 1).padStart(2, '0'), world: i + 1, name: `월드 ${i + 1} 배경` })) },
  { id: 'castle', label: '성(탑)', kind: 'castle', items: () => [
    { id: 'nest', name: '부화 둥지 (내 성)', prefix: 'nest', world: 0 },
    ...Array.from({ length: 10 }, (_, i) => { const w = i + 1, n = String(w).padStart(2, '0'); return { id: 'tower_' + n, name: `월드 ${w} 탑`, prefix: w === 1 ? 'tower' : `tower_w${n}`, world: w }; }),
  ] },
  { id: 'fun', label: '재미 요소', kind: 'fun' },
  { id: 'egg', label: '알', kind: 'egg', items: () => ['egg_rare', 'egg_super', 'egg_legend', 'shell_top', 'shell_bottom', 'sparkle'].map((id) => ({ id, name: { egg_rare: '희귀 알', egg_super: '슈퍼 알', egg_legend: '전설 알', shell_top: '껍데기 위', shell_bottom: '껍데기 아래', sparkle: '반짝이' }[id] })) },
  { id: 'hud', label: 'HUD 아이콘', kind: 'hud' },
  { id: 'banner', label: '배너', kind: 'banner', items: () => [{ id: 'banner_iandragon', name: '배너 (게임 카드)' }, { id: 'banner_iandragon_lobby', name: '배너 (로비)' }] },
];

/** 재미 요소 17종 — 이름 · 쓰는 조각 (render/fun.js 의 DEFS 순서) */
export const FUN_INFO = [
  ['bike', '달밤 자전거', ['bike', 'wheel']], ['wisps', '도깨비불', ['wisp1', 'wisp2', 'wisp3']], ['lightning', '번개 해골 구름', ['skull_cloud']],
  ['bats', '박쥐떼', ['bat_up', 'bat_down']], ['hand', '무덤 손', ['hand_open', 'hand_wave', 'hand_flower']], ['witch', '마녀 빗자루', ['witch']],
  ['skelBroom', '해골 빗자루', ['skel_broom']], ['moon', '달님 얼굴', ['moon_smile', 'moon_wink', 'moon_yawn']], ['boo', '유령 까꿍', ['boo']],
  ['star', '별똥별 (코드)', []], ['cat', '유령 고양이', ['cat', 'cat_tail']], ['owl', '부엉이', ['owl', 'owl_turn']],
  ['pumpkin', '호박', ['pumpkin', 'pumpkin_grin']], ['cross', '십자가 · 뼈다귀', ['cross', 'cross_b1', 'cross_b2', 'bone', 'bonepile', 'skull']], ['spider', '거미', ['spider']],
  ['window', '창문 춤', ['dancer1', 'dancer2']], ['mole', '두더지', ['mole', 'mound', 'rise']],
].map(([id, name, pieces]) => ({ id, name, pieces }));

/** 대표님께 보여 드릴 «리터치 후보» (겜부장 · 2026-11-11) — 그림 id → 고칠 곳. 고치면 여기서 지운다 */
export const RETOUCH = {
  bossLord: '다리가 벌어져 고리처럼 보임',
  bossCrystal: '목 쪽에 어두운 틈',
  shard: '턱 조각이 가슴에 떠 보임',
};
