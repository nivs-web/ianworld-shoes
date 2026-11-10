/* 생성 파일 — tools/idg-import-data.mjs 가 계산기(data.js)에서 만든다. 손으로 고치지 말 것. */
export const LEADERS = {
  "novart": {"name":"NOVART","ko":"노바트","unlock":0,"charge":20,"dmg":120,"range":650,"kb":1,"passive":{},"line":"기본기 만점. 밀치고 태운다"},
  "aquantis": {"name":"AQUANTIS","ko":"아쿠안티스","unlock":1,"charge":20,"dmg":100,"range":700,"kb":2,"slow":3,"strongVs":["red"],"passive":{},"line":"물대포 — 두 배로 밀고 느리게. 빨강에 2배"},
  "forestia": {"name":"FORESTIA","ko":"포레스티아","unlock":2,"charge":22,"dmg":80,"range":650,"freeze":2.5,"strongVs":["wing"],"passive":{"hp":1.1},"line":"덩굴 — 2.5초 묶는다. 날개에 2배. 아군 체력 +10%"},
  "crimsonde": {"name":"CRIMSONDE","ko":"크림존드","unlock":3,"charge":18,"dmg":240,"range":420,"kb":1,"strongVs":["ice"],"passive":{"atk":1.05},"line":"짧고 굵은 불기둥. 얼음에 2배. 아군 공격 +5%"},
  "volttail": {"name":"VOLTTAIL","ko":"볼트테일","unlock":4,"charge":22,"dmg":110,"range":650,"trueDmg":true,"focus":5,"passive":{},"line":"벼락 — 강철·방어막을 뚫고, 제일 센 놈에게 5배"},
  "solaris": {"name":"SOLARIS","ko":"솔라리스","unlock":5,"charge":22,"dmg":150,"range":650,"kb":1,"purify":true,"strongVs":["ghost"],"passive":{"income":1.1},"line":"햇살 — 유령이 다시 못 일어난다. 유령에 2배. 불씨 +10%"},
  "sandscale": {"name":"SANDSCALE","ko":"샌드스케일","unlock":6,"charge":20,"dmg":100,"range":650,"weaken":6,"kb":1,"passive":{"baseHp":1.15},"line":"모래 폭풍 — 6초간 적 공격력 절반. 기지 체력 +15%"},
  "shadowfen": {"name":"SHADOWFEN","ko":"섀도우펜","unlock":7,"charge":20,"dmg":130,"range":650,"kb":1,"strongVs":["shadow"],"passive":{"cooldown":1.08},"line":"그림자 발톱 — 그림자에 2배. 생산 속도 +8%"},
  "frostwing": {"name":"FROSTWING","ko":"프로스트윙","unlock":8,"charge":24,"dmg":60,"range":700,"freeze":4,"passive":{},"line":"눈보라 — 4초 동안 전부 꽁꽁"},
  "goldrex": {"name":"GOLDREX","ko":"골드렉스","unlock":9,"charge":22,"dmg":120,"range":650,"kb":1,"bountyMul":3,"passive":{"bounty":1.2},"line":"황금 브레스 — 브레스로 잡으면 불씨 3배. 처치 불씨 +20%"},
};
