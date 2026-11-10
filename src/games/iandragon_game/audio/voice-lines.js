/**
 * 좀비와 드래곤 (옛 이름 이안 드래곤) — 한국어 음성 대사표 v2 (겜팀장 · 1차 = 월드 1~5 · 보이스 스튜디오로 만든다)
 * 대표님 2026-11-10: «심심하면 안 된다 · 과장된 표현 · 웃긴 말투 · 효과음과 합쳐진 목소리 · 보스는 무섭고도 웃기게 ·
 *   코믹 + 긴장 + 공포 · 같은 목소리가 반복되지 않게 다양하게».
 * 한 id 에 여러 줄(무작위 · 방금 한 줄은 안 고름). 출격은 게임이 deploy/<용>/0 · /1 을 부르면 그 용의 줄 전체에서 고른다.
 *   v: 목소리 (VOICES) · sfx: 같이 터지는 효과음 id (sfx.js) · at: 'end'(말 끝에) | 'start'
 * 파일 이름: id 의 / 를 _ 로 + '_' + 줄 번호  (예: deploy_kkomul_0.ogg)
 */
const L = (text, v, sfx, at = 'end') => ({ text, v, sfx, at });

export const VOICE_LINES = {
  /* ───── 출격 (용마다 4~5줄 · 목소리도 용마다 다르게) ───── */
  'deploy/kkomul': [L('가자뿡!', 'babyHi', 'toot'), L('꼬물꼬물~ 출동이다아!', 'babyHi', 'boing'), L('나 작아도 무섭거든?!', 'babyHi'), L('새싹 펀치 받아랏!', 'babyHi', 'bonk'), L('엄마아~ 나 간다!', 'babyHi', 'slide_up')],
  'deploy/doldeung': [L('으음… 막는 건… 내 전문…', 'babySleepy', 'bonk'), L('돌등이 방패애… 쿵!', 'babySleepy', 'thud'), L('졸려도… 못 지나간다…', 'babySleepy'), L('딱딱해서… 아프지…?', 'babySleepy', 'thud')],
  'deploy/bulttong': [L('불똥 튄다아아!', 'babyBold', 'fire_pop'), L('뜨거우니까 비켜!', 'babyBold', 'whoosh'), L('볼따구 장전 완료!', 'babyBold', 'boing'), L('활활! 화르륵!', 'babyBold', 'fire_pop')],
  'deploy/twetwe': [L('퉤엣!', 'babyGoofy', 'spit'), L('불덩이 배달 왔습니다~!', 'babyGoofy', 'spit'), L('입 크게 아~ 퉤!', 'babyGoofy', 'spit'), L('맛 좀 봐라, 퉤퉤퉤!', 'babyGoofy', 'spit')],
  'deploy/ssaeng': [L('쌩—!', 'babyFast', 'whoosh'), L('내가 제일 빨라!', 'babyFast', 'whoosh'), L('잡을 수 있으면 잡아 봐!', 'babyFast', 'zoom'), L('고글 장착! 출발!', 'babyFast', 'zoom')],
  'deploy/bangul': [L('물방울 발사!', 'babySweet', 'splash'), L('찰랑찰랑~ 간다!', 'babySweet', 'splash'), L('촉촉하게 혼내 줄게!', 'babySweet'), L('볼에 물 가득! 푸우!', 'babySweet', 'splash')],
  'deploy/dungsil': [L('둥실둥실~', 'babyDreamy', 'slide_up'), L('구름 타고 슝~', 'babyDreamy', 'whoosh'), L('하늘에서 내려다본다~', 'babyDreamy'), L('폭신폭신 공격!', 'babyDreamy', 'boing')],
  'deploy/giljjuk': [L('목 쭈우우욱!', 'babyProud', 'slide_up'), L('멀리서도 다 보여!', 'babyProud'), L('키 큰 형님 등장!', 'babyProud', 'boing'), L('저 끝까지 쏴 주지!', 'babyProud', 'spit')],
  'deploy/eoreum': [L('얼음땡!', 'babyCool', 'freeze'), L('꽁꽁 얼려 줄게!', 'babyCool', 'freeze'), L('목도리 휘날리며~ 출동!', 'babyCool', 'whoosh'), L('너무 차가웠나? 헤헤!', 'babyCool', 'freeze')],
  'deploy/jjirit': [L('찌릿찌릿!', 'babyZappy', 'zap'), L('번개 꼬리 간다!', 'babyZappy', 'zap'), L('감전 주의!', 'babyZappy', 'zap'), L('빠지직! 따끔하지?', 'babyZappy', 'zap')],
  'deploy/sapjil': [L('파낸다아!', 'babyBold', 'thud'), L('삽질 시작!', 'babyBold', 'bonk'), L('안전모 착용 완료!', 'babyBold')],
  'deploy/pokjuk': [L('펑펑 터진다!', 'babyGoofy', 'fire_pop'), L('불꽃놀이다아!', 'babyGoofy', 'fire_pop'), L('도화선 치지직~', 'babyGoofy', 'fire_pop')],
  'deploy/sommung': [L('몽글몽글~', 'babyDreamy', 'boing'), L('폭신하게 막아 줄게!', 'babyDreamy'), L('양털 방패 뿅!', 'babyDreamy', 'boing')],
  'deploy/dongjeon': [L('짤랑!', 'babyProud', 'coin_jingle'), L('용돈 벌러 간다!', 'babyProud', 'coin_jingle'), L('부자 용님 납신다!', 'babyProud', 'coin_jingle')],
  'deploy/gasigong': [L('데굴데굴!', 'babyFast', 'boing'), L('가시 조심해!', 'babyFast'), L('굴러간다아아!', 'babyFast', 'slide_down')],

  /* ───── 월드 보스: 등장 · 반 피 · 쓰러짐 (무섭게 시작해서 웃기게 망한다) ───── */
  'boss/bossFat': [L('쿠웅… 쿠웅… 크르르… 아기 용 냄새가 난다…', 'bossDeep', 'growl', 'start'), L('이 몽둥이… 원래 전봇대였다! 크하하!', 'bossDeep', 'stomp'), L('꼬마야, 잘 봐라! 몽땅 납작하게 만들어 주마!', 'bossDeep', 'stomp')],
  'boss/bossFat/half': [L('아야! 등에 꼬마가… 꼬마가 무겁다!', 'bossDeep', 'bonk'), L('내 몽둥이에 금이 갔잖아! 우어어어!', 'bossDeep', 'growl')],
  'boss/bossFat/die': [L('몽둥이가… 너무… 무거웠어…', 'bossDeep', 'sad_trombone'), L('꼬마야… 집까지… 업어 줘…', 'bossDeep', 'sad_trombone'), L('쿠당탕! …아이고, 허리야…', 'bossDeep', 'thud')],
  'boss/bossVolcano': [L('땅이 울린다… 내가 깨어났다!', 'bossGiant', 'rumble', 'start'), L('모두 녹여 버리겠다! 크하하!', 'bossGiant', 'fire_pop'), L('뜨겁지? 이건 시작일 뿐이다!', 'bossGiant', 'rumble')],
  'boss/bossVolcano/half': [L('내 머리에서… 김이 나잖아!', 'bossGiant', 'steam'), L('분화한다아아아!', 'bossGiant', 'rumble')],
  'boss/bossVolcano/die': [L('식는다… 미지근해진다…', 'bossGiant', 'steam'), L('으아… 화산이… 꺼져 버렸어…', 'bossGiant', 'sad_trombone')],
  'boss/bossRider': [L('비켜라 비켜! 라이더 나가신다!', 'bossShrill', 'zoom', 'start'), L('하늘은 내 거다! 크하하!', 'bossShrill', 'whoosh'), L('독수리야! 쪼아 버려!', 'bossShrill', 'screech')],
  'boss/bossRider/half': [L('어이쿠! 깃털 빠진다, 깃털!', 'bossShrill', 'slide_down'), L('독수리야, 정신 차려!', 'bossShrill', 'screech')],
  'boss/bossRider/die': [L('으아아… 추락이다아아…', 'bossShrill', 'slide_down'), L('면허… 반납합니다…', 'bossShrill', 'sad_trombone')],
  'boss/bossAvalanche': [L('우르르릉… 모두 덮어 버리겠다…', 'bossCold', 'rumble', 'start'), L('춥지? 더 춥게 해 주마!', 'bossCold', 'freeze'), L('발밑을 조심해라… 꼬맹이들…', 'bossCold', 'stomp')],
  'boss/bossAvalanche/half': [L('내 털이… 녹는다!', 'bossCold', 'splash'), L('화났다! 눈사태다아!', 'bossCold', 'rumble')],
  'boss/bossAvalanche/die': [L('봄이… 왔구나…', 'bossCold', 'sad_trombone'), L('녹는다아… 물이 되어 버려…', 'bossCold', 'splash')],
  'boss/bossRobot': [L('삐빅… 침입자 발견. 제거 시작.', 'bossRobot', 'alarm', 'start'), L('고철 대왕 출격! 삐빅!', 'bossRobot', 'zap'), L('저항은… 무의미하다… 삐…', 'bossRobot', 'servo')],
  'boss/bossRobot/half': [L('경고! 경고! 나사가 빠졌다!', 'bossRobot', 'alarm'), L('삐…빅? 왜 연기가 나지?', 'bossRobot', 'steam')],
  'boss/bossRobot/die': [L('시스템… 종료… 삐이이이—', 'bossRobot', 'power_down'), L('엄마… 보고 싶다… 삐빅…', 'bossRobot', 'power_down')],

  /* ───── 진행 · 해설 (경기 중계처럼 신나게) ───── */
  evolve: [L('진화다아아아!', 'caster', 'sparkle'), L('오오! 더 강해졌다!', 'caster', 'sparkle'), L('변신 완료! 멋지다!', 'caster', 'sparkle')],
  roar: [L('분노의 포효! 전부 밀어내!', 'caster', 'growl', 'start'), L('크아앙! 다 비켜라!', 'caster', 'growl', 'start'), L('으르렁! 판을 뒤집어!', 'caster', 'growl', 'start')],
  fever: [L('불꽃 타임! 몰아쳐라!', 'caster', 'fire_pop'), L('지금이다! 전부 쏟아부어!', 'caster'), L('뜨거워진다아! 불꽃 타임!', 'caster', 'fire_pop')],
  win: [L('승리! 드래곤 최고!', 'caster', 'crowd'), L('해냈다아아! 대단해!', 'caster', 'crowd'), L('좀비들 도망간다! 승리!', 'caster', 'crowd'), L('완벽한 승리입니다!', 'caster', 'crowd')],
  lose: [L('으악… 다시 한 번!', 'caster', 'sad_trombone'), L('아깝다! 조금만 더!', 'caster', 'sad_trombone'), L('좀비한테 졌다니… 복수다!', 'caster')],
  star3: [L('별 세 개! 완벽해!', 'caster', 'sparkle'), L('만점! 천재 아냐?!', 'caster', 'sparkle'), L('별 세 개 획득! 최고다!', 'caster', 'sparkle')],
  danger: [L('위험해! 둥지가 흔들린다!', 'caster', 'alarm', 'start'), L('막아! 막아야 해!', 'caster', 'heartbeat', 'start'), L('큰일이다! 버텨!', 'caster', 'alarm', 'start')],
  bossdown: [L('보스를 쓰러뜨렸다아!', 'caster', 'crowd'), L('거대한 놈이 넘어간다!', 'caster', 'crowd'), L('보스 격파! 끝내 버려!', 'caster', 'crowd')],
  'tut/1': [L('용 버튼을 꾹! 출격이다!', 'caster')],
  'tut/2': [L('불씨가 모이면 더 센 용이 나와!', 'caster')],
  'tut/3': [L('화로를 올리면 불씨가 팍팍 찬다!', 'caster')],
  'tut/4': [L('브레스 준비 완료! 지금 쏴!', 'caster')],
  'tut/5': [L('좀비 탑을 무너뜨려라!', 'caster')],
  'tut/6': [L('보스다! 튼튼한 용을 앞에 세워!', 'caster')],
  /* 타이틀 콜 (첫 화면 · 2026-11-10 대표님: 게임 이름 «좀비와 드래곤») */
  title: [L('좀비와아… 드래고오온!', 'caster', 'growl', 'start'), L('좀비와 드래곤! 지금 시작합니다!', 'caster', 'crowd'), L('크르르… 좀비와… 드래곤…', 'bossDeep', 'rumble', 'start')],
  /* 전투 진행 · 부화장 (2026-11-11 야간 추가) */
  start: [L('좀비들이 몰려온다! 준비해!', 'caster', 'alarm', 'start'), L('전투 시작! 둥지를 지켜라!', 'caster'), L('온다, 온다! 좀비 떼다!', 'caster', 'groan')],
  'wave/big': [L('큰 무리가 온다! 버텨!', 'caster', 'alarm', 'start')],
  'wave/last': [L('마지막 무리다! 조금만 더!', 'caster', 'heartbeat', 'start')],
  brazier: [L('화로 강화! 불씨가 쑥쑥!', 'caster', 'fire_pop'), L('화르륵! 더 뜨거워졌다!', 'caster', 'fire_pop')],
  breath: [L('드래곤 브레스! 다 태워라!', 'caster', 'whoosh', 'start'), L('불꽃 브레스 발사아!', 'caster', 'fire_pop', 'start')],
  'hatch/shake': [L('오오? 알이 흔들린다!', 'caster'), L('곧 나온다… 두근두근!', 'caster', 'heartbeat')],
  'hatch/rare': [L('짜잔! 새 친구다!', 'caster', 'sparkle')],
  'hatch/super': [L('우와아! 영웅 드래곤이다!', 'caster', 'sparkle')],
  'hatch/legend': [L('저, 저, 전설이다아아! 대박!', 'caster', 'crowd')],
};

/** 보이스 스튜디오 «목소리 설계» — 목소리마다 다르게 (반복 지루함 방지) */
export const VOICES = {
  babyHi: '한국어, 아주 어린 아이, 아주 높은 목소리, 통통 튀고 신나게, 빠르게',
  babySleepy: '한국어, 아이, 낮고 느릿한 졸린 말투지만 단단하게',
  babyBold: '한국어, 씩씩한 남자아이, 힘차고 빠르게 외치듯',
  babyGoofy: '한국어, 장난꾸러기 아이, 익살스럽고 과장되게',
  babyFast: '한국어, 아이, 아주 빠르고 숨 가쁘게, 신나서',
  babySweet: '한국어, 상냥한 여자아이, 맑고 밝게',
  babyDreamy: '한국어, 몽글몽글한 아이 목소리, 느긋하고 귀엽게',
  babyProud: '한국어, 으쓱대는 아이, 의젓한 척 과장되게',
  babyCool: '한국어, 시원시원한 아이, 또박또박 자신 있게',
  babyZappy: '한국어, 톡 쏘는 아이 목소리, 빠르고 짧게',
  bossDeep: '한국어, 아주 굵고 낮은 괴물 목소리, 무섭게 으르렁대다가 허세 부리는 코믹 악당',
  bossGiant: '한국어, 산처럼 거대한 괴물, 땅이 울리는 굵은 목소리, 천천히 쿵쿵 외치다가 허둥대는 코믹 악당',
  bossCold: '한국어, 차갑게 속삭이는 낮은 괴물 목소리, 메아리치듯 오싹하게, 끝엔 울먹이는 코믹 악당',
  bossShrill: '한국어, 높고 째지는 악당 목소리, 촐싹대고 과장되게',
  bossRobot: '한국어, 딱딱한 기계 말투, 단조롭고 차갑게, 가끔 버벅임',
  caster: '한국어, 흥분한 남자 경기 해설자, 아주 빠르고 박진감 넘치게, 크게 외치듯',
};
