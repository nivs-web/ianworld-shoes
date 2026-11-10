/* 생성 파일 — tools/idg-import-data.mjs 가 계산기(data.js · stages.js · stages.generated.json)에서 만든다. 손으로 고치지 말 것. */
/**
 * 1차(월드 1~5)에 필요한 그림 프레임 — 팀 계획서 2.1 의 약속. 겜팀장 qa:idg-art 가 ART_NAMES 와 시트를 대조한다.
 * 크기(w · h)는 **참고값** — 실제 크기는 시트의 프레임 크기를 따른다. 같은 캐릭터의 동작끼리는 크기 · 기준점이 같아야 한다.
 */
export const ART_WORLDS = 5;
export const ART_ANIMS = {"unit":["idle0","walk0","walk1","atk0","atk1","kb0"],"boss":["idle0","walk0","walk1","walk2","walk3","atk0","atk1","kb0"],"idle":["idle0"]};
/** [이름 접두, 가로, 세로, 동작 묶음, 색 묶음] */
export const ART_FRAMES = [
  ["dragon/kkomul/1",32,32,"unit","dragon"],
  ["dragon/kkomul/2",36,36,"unit","dragon"],
  ["dragon/doldeung/1",32,32,"unit","dragon"],
  ["dragon/doldeung/2",36,36,"unit","dragon"],
  ["dragon/bulttong/1",40,40,"unit","dragon"],
  ["dragon/bulttong/2",44,44,"unit","dragon"],
  ["dragon/twetwe/1",44,44,"unit","dragon"],
  ["dragon/twetwe/2",48,48,"unit","dragon"],
  ["dragon/ssaeng/1",40,40,"unit","dragon"],
  ["dragon/ssaeng/2",44,44,"unit","dragon"],
  ["dragon/bangul/1",44,44,"unit","dragon"],
  ["dragon/bangul/2",48,48,"unit","dragon"],
  ["dragon/dungsil/1",48,48,"unit","dragon"],
  ["dragon/dungsil/2",52,52,"unit","dragon"],
  ["dragon/giljjuk/1",48,48,"unit","dragon"],
  ["dragon/giljjuk/2",52,52,"unit","dragon"],
  ["dragon/eoreum/1",44,44,"unit","dragon"],
  ["dragon/eoreum/2",48,48,"unit","dragon"],
  ["dragon/jjirit/1",44,44,"unit","dragon"],
  ["dragon/jjirit/2",48,48,"unit","dragon"],
  ["zombie/walker/0",32,32,"unit","zombie"],
  ["zombie/pup/0",32,32,"unit","zombie"],
  ["zombie/chubby/0",44,44,"unit","zombie"],
  ["zombie/gold/0",40,40,"unit","zombie"],
  ["zombie/archer/0",40,40,"unit","zombie"],
  ["zombie/shield/0",44,44,"unit","zombie"],
  ["zombie/fart/0",40,40,"unit","zombie"],
  ["zombie/skull/0",40,40,"unit","zombie"],
  ["zombie/chili/0",40,40,"unit","zombie"],
  ["zombie/lava/0",44,44,"unit","zombie"],
  ["zombie/bomb/0",40,40,"unit","zombie"],
  ["zombie/bat/0",32,32,"unit","zombie"],
  ["zombie/wingz/0",40,40,"unit","zombie"],
  ["zombie/balloon/0",40,40,"unit","zombie"],
  ["zombie/penguin/0",40,40,"unit","zombie"],
  ["zombie/snowball/0",44,44,"unit","zombie"],
  ["zombie/icicle/0",40,40,"unit","zombie"],
  ["zombie/can/0",32,32,"unit","zombie"],
  ["zombie/cart/0",32,32,"unit","zombie"],
  ["zombie/gear/0",40,40,"unit","zombie"],
  ["boss/bossFat/0",128,128,"boss","boss"],
  ["boss/bossVolcano/0",128,128,"boss","boss"],
  ["boss/bossRider/0",128,128,"boss","boss"],
  ["boss/bossAvalanche/0",128,128,"boss","boss"],
  ["boss/bossRobot/0",128,128,"boss","boss"],
  ["leader/novart/0",64,56,"idle","leader"],
  ["leader/aquantis/0",64,56,"idle","leader"],
  ["leader/forestia/0",64,56,"idle","leader"],
  ["leader/crimsonde/0",64,56,"idle","leader"],
  ["leader/volttail/0",64,56,"idle","leader"],
  ["leader/solaris/0",64,56,"idle","leader"],
  ["crown/0/0",24,16,"idle","crown"],
];
export const ART_ICONS = ["ember","coin","gem","star","attr_ice","attr_metal","attr_red","attr_wing","skill_meteor","skill_gust","skill_frost"];
export const ART_FX = ["hit","dust","poof"];
/** 필요한 프레임 이름 전부 (351개) */
export const ART_NAMES = ["dragon/kkomul/1/idle0","dragon/kkomul/1/walk0","dragon/kkomul/1/walk1","dragon/kkomul/1/atk0","dragon/kkomul/1/atk1","dragon/kkomul/1/kb0","dragon/kkomul/2/idle0","dragon/kkomul/2/walk0","dragon/kkomul/2/walk1","dragon/kkomul/2/atk0","dragon/kkomul/2/atk1","dragon/kkomul/2/kb0","dragon/doldeung/1/idle0","dragon/doldeung/1/walk0","dragon/doldeung/1/walk1","dragon/doldeung/1/atk0","dragon/doldeung/1/atk1","dragon/doldeung/1/kb0","dragon/doldeung/2/idle0","dragon/doldeung/2/walk0","dragon/doldeung/2/walk1","dragon/doldeung/2/atk0","dragon/doldeung/2/atk1","dragon/doldeung/2/kb0","dragon/bulttong/1/idle0","dragon/bulttong/1/walk0","dragon/bulttong/1/walk1","dragon/bulttong/1/atk0","dragon/bulttong/1/atk1","dragon/bulttong/1/kb0","dragon/bulttong/2/idle0","dragon/bulttong/2/walk0","dragon/bulttong/2/walk1","dragon/bulttong/2/atk0","dragon/bulttong/2/atk1","dragon/bulttong/2/kb0","dragon/twetwe/1/idle0","dragon/twetwe/1/walk0","dragon/twetwe/1/walk1","dragon/twetwe/1/atk0","dragon/twetwe/1/atk1","dragon/twetwe/1/kb0","dragon/twetwe/2/idle0","dragon/twetwe/2/walk0","dragon/twetwe/2/walk1","dragon/twetwe/2/atk0","dragon/twetwe/2/atk1","dragon/twetwe/2/kb0","dragon/ssaeng/1/idle0","dragon/ssaeng/1/walk0","dragon/ssaeng/1/walk1","dragon/ssaeng/1/atk0","dragon/ssaeng/1/atk1","dragon/ssaeng/1/kb0","dragon/ssaeng/2/idle0","dragon/ssaeng/2/walk0","dragon/ssaeng/2/walk1","dragon/ssaeng/2/atk0","dragon/ssaeng/2/atk1","dragon/ssaeng/2/kb0","dragon/bangul/1/idle0","dragon/bangul/1/walk0","dragon/bangul/1/walk1","dragon/bangul/1/atk0","dragon/bangul/1/atk1","dragon/bangul/1/kb0","dragon/bangul/2/idle0","dragon/bangul/2/walk0","dragon/bangul/2/walk1","dragon/bangul/2/atk0","dragon/bangul/2/atk1","dragon/bangul/2/kb0","dragon/dungsil/1/idle0","dragon/dungsil/1/walk0","dragon/dungsil/1/walk1","dragon/dungsil/1/atk0","dragon/dungsil/1/atk1","dragon/dungsil/1/kb0","dragon/dungsil/2/idle0","dragon/dungsil/2/walk0","dragon/dungsil/2/walk1","dragon/dungsil/2/atk0","dragon/dungsil/2/atk1","dragon/dungsil/2/kb0","dragon/giljjuk/1/idle0","dragon/giljjuk/1/walk0","dragon/giljjuk/1/walk1","dragon/giljjuk/1/atk0","dragon/giljjuk/1/atk1","dragon/giljjuk/1/kb0","dragon/giljjuk/2/idle0","dragon/giljjuk/2/walk0","dragon/giljjuk/2/walk1","dragon/giljjuk/2/atk0","dragon/giljjuk/2/atk1","dragon/giljjuk/2/kb0","dragon/eoreum/1/idle0","dragon/eoreum/1/walk0","dragon/eoreum/1/walk1","dragon/eoreum/1/atk0","dragon/eoreum/1/atk1","dragon/eoreum/1/kb0","dragon/eoreum/2/idle0","dragon/eoreum/2/walk0","dragon/eoreum/2/walk1","dragon/eoreum/2/atk0","dragon/eoreum/2/atk1","dragon/eoreum/2/kb0","dragon/jjirit/1/idle0","dragon/jjirit/1/walk0","dragon/jjirit/1/walk1","dragon/jjirit/1/atk0","dragon/jjirit/1/atk1","dragon/jjirit/1/kb0","dragon/jjirit/2/idle0","dragon/jjirit/2/walk0","dragon/jjirit/2/walk1","dragon/jjirit/2/atk0","dragon/jjirit/2/atk1","dragon/jjirit/2/kb0","zombie/walker/0/idle0","zombie/walker/0/walk0","zombie/walker/0/walk1","zombie/walker/0/atk0","zombie/walker/0/atk1","zombie/walker/0/kb0","zombie/pup/0/idle0","zombie/pup/0/walk0","zombie/pup/0/walk1","zombie/pup/0/atk0","zombie/pup/0/atk1","zombie/pup/0/kb0","zombie/chubby/0/idle0","zombie/chubby/0/walk0","zombie/chubby/0/walk1","zombie/chubby/0/atk0","zombie/chubby/0/atk1","zombie/chubby/0/kb0","zombie/gold/0/idle0","zombie/gold/0/walk0","zombie/gold/0/walk1","zombie/gold/0/atk0","zombie/gold/0/atk1","zombie/gold/0/kb0","zombie/archer/0/idle0","zombie/archer/0/walk0","zombie/archer/0/walk1","zombie/archer/0/atk0","zombie/archer/0/atk1","zombie/archer/0/kb0","zombie/shield/0/idle0","zombie/shield/0/walk0","zombie/shield/0/walk1","zombie/shield/0/atk0","zombie/shield/0/atk1","zombie/shield/0/kb0","zombie/fart/0/idle0","zombie/fart/0/walk0","zombie/fart/0/walk1","zombie/fart/0/atk0","zombie/fart/0/atk1","zombie/fart/0/kb0","zombie/skull/0/idle0","zombie/skull/0/walk0","zombie/skull/0/walk1","zombie/skull/0/atk0","zombie/skull/0/atk1","zombie/skull/0/kb0","zombie/chili/0/idle0","zombie/chili/0/walk0","zombie/chili/0/walk1","zombie/chili/0/atk0","zombie/chili/0/atk1","zombie/chili/0/kb0","zombie/lava/0/idle0","zombie/lava/0/walk0","zombie/lava/0/walk1","zombie/lava/0/atk0","zombie/lava/0/atk1","zombie/lava/0/kb0","zombie/bomb/0/idle0","zombie/bomb/0/walk0","zombie/bomb/0/walk1","zombie/bomb/0/atk0","zombie/bomb/0/atk1","zombie/bomb/0/kb0","zombie/bat/0/idle0","zombie/bat/0/walk0","zombie/bat/0/walk1","zombie/bat/0/atk0","zombie/bat/0/atk1","zombie/bat/0/kb0","zombie/wingz/0/idle0","zombie/wingz/0/walk0","zombie/wingz/0/walk1","zombie/wingz/0/atk0","zombie/wingz/0/atk1","zombie/wingz/0/kb0","zombie/balloon/0/idle0","zombie/balloon/0/walk0","zombie/balloon/0/walk1","zombie/balloon/0/atk0","zombie/balloon/0/atk1","zombie/balloon/0/kb0","zombie/penguin/0/idle0","zombie/penguin/0/walk0","zombie/penguin/0/walk1","zombie/penguin/0/atk0","zombie/penguin/0/atk1","zombie/penguin/0/kb0","zombie/snowball/0/idle0","zombie/snowball/0/walk0","zombie/snowball/0/walk1","zombie/snowball/0/atk0","zombie/snowball/0/atk1","zombie/snowball/0/kb0","zombie/icicle/0/idle0","zombie/icicle/0/walk0","zombie/icicle/0/walk1","zombie/icicle/0/atk0","zombie/icicle/0/atk1","zombie/icicle/0/kb0","zombie/can/0/idle0","zombie/can/0/walk0","zombie/can/0/walk1","zombie/can/0/atk0","zombie/can/0/atk1","zombie/can/0/kb0","zombie/cart/0/idle0","zombie/cart/0/walk0","zombie/cart/0/walk1","zombie/cart/0/atk0","zombie/cart/0/atk1","zombie/cart/0/kb0","zombie/gear/0/idle0","zombie/gear/0/walk0","zombie/gear/0/walk1","zombie/gear/0/atk0","zombie/gear/0/atk1","zombie/gear/0/kb0","boss/bossFat/0/idle0","boss/bossFat/0/walk0","boss/bossFat/0/walk1","boss/bossFat/0/walk2","boss/bossFat/0/walk3","boss/bossFat/0/atk0","boss/bossFat/0/atk1","boss/bossFat/0/kb0","boss/bossVolcano/0/idle0","boss/bossVolcano/0/walk0","boss/bossVolcano/0/walk1","boss/bossVolcano/0/walk2","boss/bossVolcano/0/walk3","boss/bossVolcano/0/atk0","boss/bossVolcano/0/atk1","boss/bossVolcano/0/kb0","boss/bossRider/0/idle0","boss/bossRider/0/walk0","boss/bossRider/0/walk1","boss/bossRider/0/walk2","boss/bossRider/0/walk3","boss/bossRider/0/atk0","boss/bossRider/0/atk1","boss/bossRider/0/kb0","boss/bossAvalanche/0/idle0","boss/bossAvalanche/0/walk0","boss/bossAvalanche/0/walk1","boss/bossAvalanche/0/walk2","boss/bossAvalanche/0/walk3","boss/bossAvalanche/0/atk0","boss/bossAvalanche/0/atk1","boss/bossAvalanche/0/kb0","boss/bossRobot/0/idle0","boss/bossRobot/0/walk0","boss/bossRobot/0/walk1","boss/bossRobot/0/walk2","boss/bossRobot/0/walk3","boss/bossRobot/0/atk0","boss/bossRobot/0/atk1","boss/bossRobot/0/kb0","leader/novart/0/idle0","leader/aquantis/0/idle0","leader/forestia/0/idle0","leader/crimsonde/0/idle0","leader/volttail/0/idle0","leader/solaris/0/idle0","crown/0/0/idle0","base/nest/0/hp0","base/nest/0/hp1","base/nest/0/hp2","base/nest/0/hp3","base/tower/w01/hp0","base/tower/w01/hp1","base/tower/w01/hp2","base/tower/w01/hp3","base/tower/w02/hp0","base/tower/w02/hp1","base/tower/w02/hp2","base/tower/w02/hp3","base/tower/w03/hp0","base/tower/w03/hp1","base/tower/w03/hp2","base/tower/w03/hp3","base/tower/w04/hp0","base/tower/w04/hp1","base/tower/w04/hp2","base/tower/w04/hp3","base/tower/w05/hp0","base/tower/w05/hp1","base/tower/w05/hp2","base/tower/w05/hp3","bg/w01/sky","bg/w01/far","bg/w01/near","bg/w01/ground","bg/w02/sky","bg/w02/far","bg/w02/near","bg/w02/ground","bg/w03/sky","bg/w03/far","bg/w03/near","bg/w03/ground","bg/w04/sky","bg/w04/far","bg/w04/near","bg/w04/ground","bg/w05/sky","bg/w05/far","bg/w05/near","bg/w05/ground","icon/ember","icon/coin","icon/gem","icon/star","icon/attr_ice","icon/attr_metal","icon/attr_red","icon/attr_wing","icon/skill_meteor","icon/skill_gust","icon/skill_frost","fx/hit/0/0","fx/hit/0/1","fx/hit/0/2","fx/dust/0/0","fx/dust/0/1","fx/dust/0/2","fx/poof/0/0","fx/poof/0/1","fx/poof/0/2"];
