/**
 * 좀비와 드래곤 — «도감» (B6 최소판 · 2026-11-11 야간)
 * 용 : 스토리 10 + 부화장 11 — 가진 용은 얼굴 · 이름 · 등급, 없는 용은 까만 그림자.
 * 좀비 : 1~5월드에 나오는 좀비 · 보스 — 깬 스테이지에서 만난 것만 보인다.
 */
import { el, button, presentOverlay } from './ui.js';
import * as G from '../services/iandragonGame.js';
import * as Sfx from '../audio/sfx.js';
import { UNITS } from '../games/iandragon_game/data/units.js';
import { ENEMIES } from '../games/iandragon_game/data/enemies.js';
import { STAGES } from '../games/iandragon_game/data/stages/index.js';
import { unlockedBefore, LAST_STAGE, DRAGON_ORDER } from '../games/iandragon_game/render/battleSetup.js';
import { RAR_KO } from '../services/iandragonHatch.js';

const AI = '/assets/iandragon_game/ai/';
const ART = { chubby: 'cone', shield: 'helmet', bossFat: 'bossGiant' };
const RAR = { story: '스토리', ...RAR_KO };

export function showCodex() {
  Sfx.play('sfx_menu_select');
  const g = G.idg();
  const story = unlockedBefore(g.cleared + 1).dragons;
  const have = (id) => story.includes(id) || (UNITS[id].rar !== 'story' && g.units[id]);
  const met = new Set();
  for (const st of STAGES) if (st.g <= Math.min(g.cleared, LAST_STAGE)) for (const l of st.lines) met.add(l.id);
  const zombies = [...new Set(STAGES.filter((s) => s.g <= LAST_STAGE).flatMap((s) => s.lines.map((l) => l.id)))];
  const card = (img, name, sub, on, cls = '') => el('div.idg-codex-card' + (on ? '' : '.off') + cls, null, [
    el('img', { src: img, alt: '', onerror: (e) => { if (!e.target.src.endsWith('/torso.png')) e.target.src = img.replace('/head.png', '/torso.png'); } }), el('b', on ? name : '???'), el('span', on ? sub : ''),
  ]);
  const DR = Object.keys(UNITS).filter((id) => UNITS[id].rar !== 'story' || DRAGON_ORDER.includes(id));   // 1차에 얻을 수 있는 용만 (코드 검토 10)
  const dragons = DR.map((id) => card(`${AI}${id}/head.png`, UNITS[id].name, RAR[UNITS[id].rar], have(id), '.' + UNITS[id].rar));
  const zs = zombies.map((id) => card(`${AI}${ART[id] || id}/head.png`, ENEMIES[id].name, ENEMIES[id].boss ? '보스' : '', met.has(id), ENEMIES[id].boss ? '.legend' : ''));
  const nD = DR.filter(have).length, nZ = zombies.filter((id) => met.has(id)).length;
  const box = el('div.dialog.idg-codex', { onclick: (e) => e.stopPropagation() }, [
    el('div.idg-how-title', '도감'),
    el('div.idg-codex-h', `용 ${nD} / ${DR.length}`), el('div.idg-codex-grid', null, dragons),
    el('div.idg-codex-h', `좀비 ${nZ} / ${zombies.length}`), el('div.idg-codex-grid', null, zs),
    button('닫기', () => close()),
  ]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}
