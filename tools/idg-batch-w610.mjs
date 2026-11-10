/**
 * 그림 공장 — 2차 (월드 6~10) 묶음 (겜부장 · 2026-11-11 · 결정 D10)   node tools/idg-batch-w610.mjs → batch_w610.json
 * 좀비 14 · 보스 5 · 리더 4 · 스토리 용 2 + 2단 2 · 배경 5(21:9 · 2K · 랜드마크 5개 고정) · 좀비 탑 5
 */
import fs from 'node:fs';

const DIR = 'C:/Users/ariancepc/Desktop/cowork/iandragon/docs/style_refs/';
const B = JSON.parse(fs.readFileSync(DIR + 'batch_w01.json', 'utf8'));
const strict = ' IMPORTANT: chunky low-resolution PIXEL ART exactly like the reference (visible square pixels), NOT smooth cartoon. NO grid lines, NO frames, NO numbers, NO letters, NO text anywhere (the art is mirrored in game). Pure magenta background between parts.';
const zs = strict + ' Each leg is a SINGLE leg.';
const Z = (id, d) => ({ id, kind: 'zombieParts', ref: 'ref_zombies.webp', desc: d + zs });
const D = (id, d) => ({ id, kind: 'dragonParts', ref: 'ref_dragons.webp', desc: 'A new baby dragon in the same style and proportions as the baby dragons in image 1: ' + d + strict });
const leaderParts = ' Create a PARTS SHEET for cut-out animation, side view facing RIGHT, solid flat pure magenta background (#FF00FF), each part separate with its own dark outline, neat 3x3 grid in this order: (1) head with closed mouth; (2) same head with eyes closed; (3) same head with mouth wide open roaring (no fire, just open mouth); (4) torso with belly scales; (5) front arm with claws; (6) back leg; (7) front leg; (8) one large wing spread; (9) tail.';
const L = (id, d) => ({ id, kind: 'custom', ref: 'ref_dragons.webp', styleRef: 'ref_castles_b.webp', desc: 'A heroic young LEADER dragon, a bit bigger and cooler than the baby dragons of image 1, same art style: ' + d + '.' + leaderParts + strict });
const bossParts = ' Create a PARTS SHEET for cut-out animation, side view facing LEFT, solid flat pure magenta background (#FF00FF), each part separate with its own dark outline, neat 3x3 grid in this order: ';
const BO = (id, d, parts) => ({ id, kind: 'custom', ref: 'ref_zombies.webp', desc: 'A HUGE BOSS in the same style as image 1 zombies, three times taller than a normal zombie: ' + d + '.' + bossParts + parts + strict });
const bossStd = (extra) => `(1) head without lower jaw, angry eyes; (2) same head eyes closed; (3) big lower jaw; (4) massive torso; (5) front arm; (6) back arm; (7) front leg; (8) back leg; (9) ${extra}.`;
const bgCommon = ' Wide side-scrolling 2D game BACKGROUND in exactly the art style of image 1 (rich pixel art, night, moody lighting). Layout rules (very important): the top edge of the walkable ground is a straight horizontal line at exactly 81% of the image height; the bottom 19% is a solid underground soil band with embedded rocks and a few bones. Always include these landmarks: a bare dead tree on the FAR LEFT with one thick horizontal branch; a big round glowing cream-colored moon in the upper middle; distant castle or tower silhouettes with a few small lit windows on the right; a long low fence or railing standing on the ground in the right half; three or four small grave-like stones on the ground in the left half. NO characters, NO creatures, NO text.';
const BG = (id, d) => ({ id, kind: 'custom', ref: 'ref_backgrounds.webp', styleRef: 'ref_backgrounds.webp', size: '2K', aspect: '21:9', desc: 'World theme: ' + d + '.' + bgCommon });
const CA = (id, d) => ({ id, kind: 'custom', ref: 'ref_castles_a.webp', styleRef: 'ref_castles_a.webp', desc: 'Image 1 shows castle art. Draw ONE zombie tower for a game, ' + d + ', in exactly the same art style, front view. Draw it FOUR times in a 2x2 grid on a solid flat pure magenta background (#FF00FF) with wide gaps: (1) undamaged; (2) cracked a little; (3) badly damaged with missing bricks; (4) almost ruined, broken top, smoke. Same size and position in each cell, each with its own dark outline.' + strict });

const jobs = [
  BG('bg_w06', 'HAUNTED GRAVEYARD at night: thick green mist, many crooked tombstones, ghost lights, a ruined chapel, an old iron cemetery fence'),
  BG('bg_w07', 'SANDSTORM DESERT at night: sand dunes, half-buried pyramids and obelisks, sand-swept bone graves, a dead desert tree, a broken wooden fence'),
  BG('bg_w08', 'POISON SWAMP at night: glowing green toxic water, giant mushrooms, twisted mangrove roots, mossy graves, a rotten wooden fence on stilts'),
  BG('bg_w09', 'CRYSTAL CAVE: huge glowing purple and cyan crystals, cave ceiling with a big round opening showing the moon, crystal grave stones, a crystal-studded railing'),
  BG('bg_w10', 'ZOMBIE DRAGON CASTLE courtyard at night: dark gothic fortress, red-purple sky, dragon skull decorations, stone graves, a spiked iron fence'),
  CA('castle_w06', 'a haunted crypt tower with green ghost flames and crooked crosses'),
  CA('castle_w07', 'a sandstone pyramid-temple tower with a golden zombie pharaoh mask'),
  CA('castle_w08', 'a swamp witch hut tower on stilts with poison mushrooms and a bubbling cauldron'),
  CA('castle_w09', 'a tower made of glowing purple crystals with a skull carved in crystal'),
  CA('castle_w10', 'a dark dragon-bone fortress tower with a giant zombie dragon skull on top'),
  Z('ghost', 'World 6. A wobbly translucent pale-green GHOST zombie with a ragged sheet body, floating, spooky cute. Part 9 = a small chain with a ball.'),
  Z('bones', 'World 6. A SKELETON SOLDIER zombie with a rusty helmet, cracked shield and bone sword. Part 9 = the round cracked wooden shield.'),
  Z('mole', 'World 6. A digging MOLE zombie with claw hands, miner helmet with lamp, dirty overalls. Part 9 = a small dirt mound.'),
  Z('scarab', 'World 7. A small swarm-like zombie made of SCARAB BEETLES forming a body, shiny blue-green shells. Part 9 = one single scarab beetle.'),
  Z('mummy', 'World 7. A MUMMY zombie wrapped in dirty bandages with loose bandage strips, glowing eyes. Part 9 = a loose bandage strip.'),
  Z('golem', 'World 7. A big chunky SAND GOLEM zombie made of sandstone blocks with hieroglyph-like cracks (no letters), heavy fists. Part 9 = a sandstone block.'),
  Z('shade', 'World 8. A fast SHADOW zombie: pitch-dark smoky body with glowing purple eyes and wispy edges. Part 9 = a wisp of dark smoke.'),
  Z('frog', 'World 8. A FROG zombie: green warty frog-man with a long sticky tongue, swamp weeds. Part 9 = the long tongue.'),
  Z('shroom', 'World 8. A POISON MUSHROOM zombie: zombie with a huge spotted purple mushroom cap growing from its head, spores. Part 9 = a puff of green spores.'),
  Z('shard', 'World 9. A CRYSTAL BAT zombie: a bat-like zombie with sharp crystal wings and crystal fangs. Part 9 = one crystal wing.'),
  Z('crystal', 'World 9. A CRYSTAL zombie with purple crystal growths on shoulders and back, glowing. Part 9 = a crystal cluster.'),
  Z('prism', 'World 9. A PRISM SHOOTER zombie holding a glowing prism crystal that shoots rainbow beams. Part 9 = the glowing prism.'),
  Z('knight', 'World 10. A heavy ZOMBIE KNIGHT in dark spiked armor with a big sword and torn red cape. Part 9 = the big sword.'),
  Z('dragonling', 'World 10. A small ZOMBIE DRAGON: undead baby dragon with exposed bones, torn wings, green fire breath. Part 9 = one torn bony wing.'),
  BO('bossGhost', 'GHOST KING, a huge translucent ghost zombie wearing a ghostly crown and long tattered royal robe, holding a lantern', bossStd('a ghost lantern')),
  BO('bossPharaoh', 'PHARAOH ZOMBIE, a giant mummy pharaoh with a golden headdress and a golden staff', bossStd('a golden scarab staff')),
  BO('bossWitch', 'SWAMP WITCH, a giant zombie witch with a pointy hat, crooked nose, holding a bubbling poison cauldron', bossStd('the bubbling cauldron')),
  BO('bossCrystal', 'CRYSTAL DRAGON ZOMBIE, a giant undead dragon made of purple crystals standing on two legs', bossStd('a crystal wing')),
  BO('bossLord', 'ZOMBIE DRAGON LORD, the final boss: an enormous dark undead dragon king with a crown, glowing red eyes, tattered wings, standing on two legs', bossStd('one huge tattered wing')),
  L('sandscale', 'SANDSCALE, a sandy golden-brown desert dragon with scarab-like armor plates'),
  L('shadowfen', 'SHADOWFEN, a dark purple-black swamp shadow dragon with glowing green eyes'),
  L('frostwing', 'FROSTWING, an icy white-blue dragon with crystal ice wings and a snowflake crest'),
  L('goldrex', 'GOLDREX, a shiny golden treasure dragon with gem-studded horns'),
  D('banjjak', 'BANJJAK, a glowing white-gold LIGHT dragon with a halo-like crest and sparkles'),
  D('kungkwang', 'KUNGKWANG, a big heavy rock-hammer dragon with huge fists and a stone-plated back (bigger than others)'),
];
fs.writeFileSync(DIR + 'batch_w610.json', JSON.stringify({ style: B.style, dragonParts: B.dragonParts, zombieParts: B.zombieParts, jobs }, null, 1));
console.log(jobs.length + '개 → batch_w610.json');
