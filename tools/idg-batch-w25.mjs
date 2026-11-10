/**
 * 그림 공장 — 월드 2~5 묶음 만들기 (겜부장 · 2026-11-11 야간)
 *   node tools/idg-batch-w25.mjs  → iandragon/docs/style_refs/batch_w25.json
 * 용 5 · 리더 5 · 좀비 9 · 보스 4 · 배경 4(21:9 · 2K) · 좀비 성 4
 * 배경은 «자리 규칙»(재미 요소가 나올 곳)을 지키도록 모든 월드에 같은 랜드마크를 그리게 한다 — IAN_DRAGON_FUN.md §8
 */
import fs from 'node:fs';

const DIR = 'C:/Users/ariancepc/Desktop/cowork/iandragon/docs/style_refs/';
const B = JSON.parse(fs.readFileSync(DIR + 'batch_w01.json', 'utf8'));
const strict = ' IMPORTANT: chunky low-resolution PIXEL ART exactly like the reference (visible square pixels), NOT smooth cartoon. NO grid lines, NO frames, NO numbers, NO labels, NO text anywhere. Pure magenta background between parts.';
const zs = strict + ' Each leg is a SINGLE leg.';
const D = (id, d) => ({ id, kind: 'dragonParts', ref: 'ref_dragons.webp', desc: 'A new baby dragon in the same style and proportions as the baby dragons in image 1: ' + d + strict });
const leaderParts = ' Create a PARTS SHEET for cut-out animation, side view facing RIGHT, solid flat pure magenta background (#FF00FF), each part separate with its own dark outline, neat 3x3 grid in this order: (1) head with closed mouth; (2) same head with eyes closed; (3) same head with mouth wide open roaring (no fire, just open mouth); (4) torso with belly scales; (5) front arm with claws; (6) back leg; (7) front leg; (8) one large wing spread; (9) tail.';
const L = (id, d) => ({ id, kind: 'custom', ref: 'ref_dragons.webp', styleRef: 'ref_castles_b.webp', desc: 'A heroic young LEADER dragon, a bit bigger and cooler than the baby dragons of image 1, same art style: ' + d + '.' + leaderParts + strict });
const Z = (id, d) => ({ id, kind: 'zombieParts', ref: 'ref_zombies.webp', desc: d + zs });
const bossParts = ' Create a PARTS SHEET for cut-out animation, side view facing LEFT, solid flat pure magenta background (#FF00FF), each part separate with its own dark outline, neat 3x3 grid in this order: ';
const BO = (id, d, parts) => ({ id, kind: 'custom', ref: 'ref_zombies.webp', desc: 'A HUGE BOSS in the same style as image 1 zombies, three times taller than a normal zombie: ' + d + '.' + bossParts + parts + strict });
const bgCommon = ' Wide side-scrolling 2D game BACKGROUND in exactly the art style of image 1 (rich pixel art, night, moody lighting). Layout rules (very important): the top edge of the walkable ground (grass or soil line) is a straight horizontal line at exactly 81% of the image height; the bottom 19% is a solid underground soil band with embedded rocks and a few bones. Always include these landmarks: a bare dead tree on the FAR LEFT with one thick horizontal branch; a big round glowing moon in the upper middle; distant castle or tower silhouettes with a few small lit windows on the right; a long low fence or railing standing on the ground in the right half; three or four small grave-like stones on the ground in the left half. NO characters, NO creatures, NO text.';
const BG = (id, d) => ({ id, kind: 'custom', ref: 'ref_backgrounds.webp', styleRef: 'ref_backgrounds.webp', size: '2K', aspect: '21:9', desc: 'World theme: ' + d + '.' + bgCommon });
const CA = (id, d) => ({ id, kind: 'custom', ref: 'ref_castles_a.webp', styleRef: 'ref_castles_a.webp', desc: 'Image 1 shows castle art. Draw ONE zombie tower for a game, ' + d + ', in exactly the same art style, front view. Draw it FOUR times in a 2x2 grid on a solid flat pure magenta background (#FF00FF) with wide gaps: (1) undamaged; (2) cracked a little; (3) badly damaged with missing bricks; (4) almost ruined, broken top, smoke. Same size and position in each cell, each with its own dark outline.' + strict });

const jobs = [
  D('bangul', 'BANGUL, a round light-blue WATER dragon with fin ears, a water droplet mark on the forehead, bubbles, small fin-like wings'),
  D('dungsil', 'DUNGSIL, a fluffy CLOUD dragon with white-lavender cotton fur, puffy cloud wings, sleepy happy eyes'),
  D('giljjuk', 'GILJJUK, a tall slim yellow-green dragon with a very long neck, sharp focused eyes like a sniper'),
  D('eoreum', 'EOREUM, a pale cyan ICE dragon with icicle spikes on the back, crystal horns, frosty cheeks'),
  D('jjirit', 'JJIRIT, a yellow ELECTRIC dragon with a lightning-bolt tail tip, zig-zag stripes, spiky crackling crest'),
  L('aquantis', 'AQUANTIS, a teal-blue sea dragon with fins and a wave-shaped crest'),
  L('forestia', 'FORESTIA, a green forest dragon with leafy wings, vines and small flowers'),
  L('crimsonde', 'CRIMSONDE, a crimson red fire dragon with a flame mane and ember spots'),
  L('volttail', 'VOLTTAIL, a purple and yellow storm dragon with a lightning tail and glowing stripes'),
  L('solaris', 'SOLARIS, a golden sun dragon with a radiant sun crest and white-gold wings'),
  Z('wingz', 'World 3 (sky). A zombie with big tattered bat wings on its back, aviator goggles. Part 9 = one tattered bat wing alone.'),
  Z('balloon', 'World 3 (sky). A goofy zombie floating while holding three colorful balloons. Part 9 = the bunch of three balloons with strings.'),
  Z('penguin', 'World 4 (ice). A zombie PENGUIN: black and white body, flippers as arms, webbed orange feet as legs, cracked beak. Part 9 = a small knitted winter cap.'),
  Z('snowball', 'World 4 (ice). A zombie stuck inside a big round dirty snowball body, only head, arms and legs sticking out. Part 9 = a carrot.'),
  Z('icicle', 'World 4 (ice). A frosty blue-skinned zombie archer with frozen hair, throwing icicles. Part 9 = one long icicle spear.'),
  Z('can', 'World 5 (scrap metal). A zombie wearing armor made of dented tin cans and bolts. Part 9 = a tin-can helmet.'),
  Z('gear', 'World 5 (scrap metal). A zombie KNIGHT in rusty armor holding a big gear as a shield. Part 9 = the big rusty gear shield.'),
  { id: 'bat', kind: 'custom', ref: 'ref_zombies.webp', desc: 'World 3 (sky). A cute creepy ZOMBIE BAT in the same style as image 1 zombies. Create a PARTS SHEET, side view facing LEFT, solid flat pure magenta background (#FF00FF), each part separate with its own dark outline, neat 3x2 grid in this order: (1) round furry body with head, eyes open, little fangs, no wings; (2) the same body with eyes closed; (3) one bat wing spread wide; (4) the same wing folded up; (5) tiny clawed feet; (6) a small stitched ear.' + strict },
  { id: 'cart', kind: 'custom', ref: 'ref_zombies.webp', desc: 'World 5 (scrap metal). A zombie riding a rusty MINE CART, in the same style as image 1 zombies. Create a PARTS SHEET, side view facing LEFT, solid flat pure magenta background (#FF00FF), each part separate with its own dark outline, neat 3x2 grid in this order: (1) the rusty mine cart body WITHOUT wheels; (2) one cart wheel; (3) zombie head eyes open, crazy grin; (4) the same head eyes closed; (5) zombie upper body (torso) with both arms raised up, no head; (6) lower jaw with teeth.' + strict },
  BO('bossVolcano', 'VOLCANO ZOMBIE KING, a giant zombie made of black volcanic rock with glowing lava veins, wearing a crown of magma, holding a lava hammer', '(1) head without lower jaw with magma crown, angry eyes; (2) same head eyes closed; (3) big lower jaw; (4) massive torso; (5) front arm holding a lava hammer; (6) back arm; (7) front leg; (8) back leg; (9) a small floating lava rock.'),
  BO('bossRider', 'ZOMBIE RIDER, a skinny zombie knight riding a HUGE zombie bat-dragon mount', '(1) the mount head with jaw open, angry; (2) the same mount head eyes closed; (3) the mount body (no wings, no legs); (4) one big tattered wing spread; (5) mount front leg with claws; (6) mount back leg with claws; (7) the zombie rider (whole, sitting, with a lance); (8) mount tail; (9) a saddle.'),
  BO('bossAvalanche', 'AVALANCHE GIANT, a giant zombie yeti made of dirty snow and ice chunks, icicle beard, glowing blue eyes', '(1) head without lower jaw; (2) same head eyes closed; (3) big lower jaw with icicle teeth; (4) massive snowy torso; (5) front arm with huge fist; (6) back arm; (7) front leg; (8) back leg; (9) a big snowball.'),
  BO('bossRobot', 'SCRAP KING ROBOT, a giant robot made of rusty scrap metal with a glass dome on top holding a little zombie pilot, smoke pipes', '(1) the glass dome head with the zombie pilot inside, eyes open; (2) the same dome with pilot eyes closed; (3) a robot jaw plate; (4) massive scrap-metal torso with pipes; (5) front arm with a claw hand; (6) back arm; (7) front leg; (8) back leg; (9) a gear.'),
  BG('bg_w02', 'VOLCANO at night: dark red-violet sky with ember sparks, distant erupting volcano, lava rivers glowing in the distance, charred rocks, black obsidian graves, a burnt dead tree, an iron fence'),
  BG('bg_w03', 'SKY ISLANDS at night: floating islands, big clouds below, distant floating castle with lit windows, wooden graves on the island ground, a windswept dead tree, a rope-and-plank railing'),
  BG('bg_w04', 'ICE land at night: aurora in the sky, snowy hills, frozen castle with lit windows, ice-covered graves, a frosted dead tree, a snowy wooden fence'),
  BG('bg_w05', 'SCRAP-METAL junkyard factory at night: smokestacks, rusty pipes, distant factory towers with lit windows, scrap piles, rusty metal grave markers, a dead tree with metal bits, a chain-link fence'),
  CA('castle_w02', 'made of black volcanic rock with lava cracks, skull on top, red banners'),
  CA('castle_w03', 'a floating zombie fortress on a small rock island with tattered wing-shaped banners'),
  CA('castle_w04', 'made of ice blocks and snow, frozen skull ornament, icicles'),
  CA('castle_w05', 'made of rusty scrap metal, pipes, gears and a glowing skull sign'),
];
fs.writeFileSync(DIR + 'batch_w25.json', JSON.stringify({ style: B.style, dragonParts: B.dragonParts, zombieParts: B.zombieParts, jobs }, null, 1));
console.log(jobs.length + '개 일 → batch_w25.json');
