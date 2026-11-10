/**
 * 이안 드래곤 게임 — 한국어 음성 대사표 (겜팀장 · 1차 = 월드 1~5). 보이스 스튜디오로 만든다.
 * 대표님 톤 지시: «빠르고 박진감 · 임팩트 · 흥분되는 목소리». 출격 한마디 1초 안팎 · 긴 대사도 2초 안.
 *   baby  = 아기 용: 짧고 기운차게 (용마다 높이 · 말끝을 조금씩 다르게)
 *   boss  = 좀비 보스: 허세 부리다 망하는 코믹 톤
 *   caster = 진행: 경기 해설처럼 신나게
 * id → { text, who, note }   (파일 이름 = id 의 / 를 _ 로, voice.js)
 */
export const VOICE_LINES = {
  /* 출격 (용마다 2개 중 무작위 — 게임이 /0 · /1 을 고른다) */
  'deploy/kkomul/0': { text: '가자뿡!', who: 'baby', note: '가장 어린 목소리, 통통 튀게' },
  'deploy/kkomul/1': { text: '꼬물꼬물 출동!', who: 'baby' },
  'deploy/doldeung/0': { text: '막아낸다…!', who: 'baby', note: '졸린 듯 느긋하지만 단단하게' },
  'deploy/doldeung/1': { text: '돌등이 방패!', who: 'baby' },
  'deploy/bulttong/0': { text: '불똥 튄다!', who: 'baby', note: '씩씩하고 화끈하게' },
  'deploy/bulttong/1': { text: '활활 간다아!', who: 'baby' },
  'deploy/twetwe/0': { text: '퉤엣!', who: 'baby', note: '입 크게, 장난스럽게' },
  'deploy/twetwe/1': { text: '불덩이 배달!', who: 'baby' },
  'deploy/bangul/0': { text: '물방울 발사!', who: 'baby', note: '맑고 상냥하게' },
  'deploy/bangul/1': { text: '촉촉하게 간다!', who: 'baby' },
  'deploy/ssaeng/0': { text: '쌩—!', who: 'baby', note: '아주 빠르게, 바람 소리처럼' },
  'deploy/ssaeng/1': { text: '내가 제일 빨라!', who: 'baby' },
  'deploy/dungsil/0': { text: '둥실둥실~', who: 'baby', note: '느긋하고 몽글하게' },
  'deploy/dungsil/1': { text: '하늘에서 간다!', who: 'baby' },
  'deploy/giljjuk/0': { text: '목 쭈욱!', who: 'baby', note: '키 큰 척 의젓하게' },
  'deploy/giljjuk/1': { text: '멀리서도 보여!', who: 'baby' },
  'deploy/eoreum/0': { text: '얼음땡!', who: 'baby', note: '시원하고 또박또박' },
  'deploy/eoreum/1': { text: '꽁꽁 얼려 줄게!', who: 'baby' },
  'deploy/jjirit/0': { text: '찌릿찌릿!', who: 'baby', note: '톡 쏘게, 빠르게' },
  'deploy/jjirit/1': { text: '번개 꼬리 간다!', who: 'baby' },
  'deploy/sapjil/0': { text: '파낸다!', who: 'baby', note: '부지런한 일꾼처럼' },
  'deploy/sapjil/1': { text: '삽질 시작!', who: 'baby' },
  'deploy/pokjuk/0': { text: '펑펑 터진다!', who: 'baby', note: '신나서 들뜬 목소리' },
  'deploy/pokjuk/1': { text: '불꽃놀이다!', who: 'baby' },
  'deploy/sommung/0': { text: '몽글몽글~', who: 'baby', note: '포근하게' },
  'deploy/sommung/1': { text: '폭신하게 막아!', who: 'baby' },
  'deploy/dongjeon/0': { text: '짤랑!', who: 'baby', note: '부자 흉내, 으쓱하게' },
  'deploy/dongjeon/1': { text: '용돈 벌러 간다!', who: 'baby' },
  'deploy/gasigong/0': { text: '데굴데굴!', who: 'baby', note: '구르듯 빠르게' },
  'deploy/gasigong/1': { text: '가시 조심해!', who: 'baby' },
  /* 월드 보스 등장 */
  'boss/bossFat': { text: '배고프다아… 다 먹어 주마!', who: 'boss', note: '느끼하고 우렁차게, 마지막에 트림하듯' },
  'boss/bossVolcano': { text: '뜨겁지? 내가 바로 화산 킹이다!', who: 'boss' },
  'boss/bossRider': { text: '비켜라 비켜! 라이더 나가신다!', who: 'boss' },
  'boss/bossAvalanche': { text: '우르르릉… 다 덮어 버리겠다!', who: 'boss' },
  'boss/bossRobot': { text: '삐빅! 고철 대왕 출격! 삐…빅?', who: 'boss', note: '기계음 흉내, 끝에 고장 난 듯' },
  /* 전투 진행 */
  evolve: { text: '진화다아아!', who: 'caster' },
  roar: { text: '분노의 포효! 전부 밀어내!', who: 'caster' },
  fever: { text: '불꽃 타임! 몰아쳐라!', who: 'caster' },
  win: { text: '승리! 드래곤 최고!', who: 'caster' },
  lose: { text: '으악… 다시 한 번!', who: 'caster' },
  star3: { text: '별 세 개! 완벽해!', who: 'caster' },
  /* 튜토리얼 안내 (1-1 ~ 1-3) */
  'tut/1': { text: '용 버튼을 눌러 출격!', who: 'caster' },
  'tut/2': { text: '불씨가 모이면 더 센 용!', who: 'caster' },
  'tut/3': { text: '화로를 올리면 불씨가 빨리 차!', who: 'caster' },
  'tut/4': { text: '브레스 준비 완료! 지금이야!', who: 'caster' },
  'tut/5': { text: '좀비 탑을 무너뜨려!', who: 'caster' },
  'tut/6': { text: '보스다! 방패 용을 앞에!', who: 'caster' },
};

/** 보이스 스튜디오 «목소리 설계» 설명 (who 별) */
export const VOICE_DESIGN = {
  baby: '한국어, 10살 안팎 아이 같은 높고 밝은 목소리, 아주 빠르고 기운찬 말투, 짧게 외치듯',
  boss: '한국어, 굵고 우스꽝스러운 악당 목소리, 과장된 허세, 빠르고 힘 있게',
  caster: '한국어, 신난 남자 경기 해설자, 빠르고 박진감 넘치게, 크게 외치듯',
};
