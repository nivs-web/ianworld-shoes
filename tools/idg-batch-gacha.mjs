/**
 * 그림 공장 — 부화장 용 11 + 알 시트 (겜부장 · 2026-11-11 야간)   node tools/idg-batch-gacha.mjs → batch_gacha.json
 * 희귀 4 (삽질이 · 폭죽이 · 솜뭉치 · 동전이) · 슈퍼 4 (가시공 · 메아리 · 그늘이 · 눈보라) · 전설 3 (별똥별 · 황금알 대왕 · 쌍둥머리)
 */
import fs from 'node:fs';

const DIR = 'C:/Users/ariancepc/Desktop/cowork/iandragon/docs/style_refs/';
const B = JSON.parse(fs.readFileSync(DIR + 'batch_w01.json', 'utf8'));
const strict = ' IMPORTANT: chunky low-resolution PIXEL ART exactly like the reference (visible square pixels), NOT smooth cartoon. NO grid lines, NO frames, NO numbers, NO labels, NO text anywhere. Pure magenta background between parts.';
const D = (id, d) => ({ id, kind: 'dragonParts', ref: 'ref_dragons.webp', desc: 'A new baby dragon in the same style and proportions as the baby dragons in image 1: ' + d + strict });
const jobs = [
  D('sapjil', 'SAPJIL, a brown mole-like digging dragon with miner goggles and a little shovel-shaped tail tip (rare)'),
  D('pokjuk', 'POKJUK, a red-and-yellow striped FIRECRACKER dragon with a lit fuse on its head, like a firework rocket (rare)'),
  D('sommung', 'SOMMUNG, a very round fluffy white COTTON-BALL dragon, puffy fur, tiny wings, sleepy cute face (rare)'),
  D('dongjeon', 'DONGJEON, a golden COIN dragon with coin-shaped scales and a shiny coin mark on the forehead (rare)'),
  D('gasigong', 'GASIGONG, a CHESTNUT-BURR dragon covered with sharp brown spikes, round body, fierce little eyes (super, sparkly outline)'),
  D('meari', 'MEARI, a purple ECHO dragon with huge bat ears, a big mouth and sound-wave ring marks (super)'),
  D('geuneul', 'GEUNEUL, a sleek dark navy SHADOW dragon with glowing violet eyes and a smoky wisp tail (super)'),
  D('nunbora', 'NUNBORA, a white-blue SNOWSTORM dragon with a snowflake crest and a frosty swirling mane (super)'),
  D('byeolttong', 'BYEOLTTONG, a COSMIC dragon: deep blue body full of tiny stars, star-shaped horns, a glowing comet tail (legend, majestic)'),
  D('hwanggeum', 'HWANGGEUM, a big golden dragon KING wearing cracked golden egg-shell armor and a small crown (legend, majestic)'),
  D('ssangdung', 'SSANGDUNG, a TWO-HEADED dragon: one red head and one blue head, bickering; draw BOTH heads together as ONE head piece (legend)'),
  { id: 'eggs', kind: 'custom', ref: 'ref_dragons.webp', desc: 'Dragon EGG props for a hatchery screen, same pixel-art style as image 1. Solid flat pure magenta background (#FF00FF), each item separate with its own dark outline, neat 3x2 grid in this order: (1) a cream egg with BLUE spots (rare); (2) a cream egg with PURPLE swirls (super); (3) a shiny GOLD egg with star marks (legend); (4) the top half of a cracked egg shell; (5) the bottom half of a cracked egg shell; (6) a bright white-yellow sparkle burst.' + strict },
];
fs.writeFileSync(DIR + 'batch_gacha.json', JSON.stringify({ style: B.style, dragonParts: B.dragonParts, jobs }, null, 1));
console.log(jobs.length + '개 → batch_gacha.json');
