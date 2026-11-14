/**
 * 잠시 잠근 꾸미기 (11/14 대표님 «캐릭터 위에 얹어 둔 이상한 아이템은 자물쇠로 잠그고 구매 · 착용 못 하게»)
 *  여기 있는 열쇠는 : 샵에서 못 삼(자물쇠 + 안내) · 꾸미기에서 못 씀 · 이미 쓰고 있어도 몸에 그리지 않음 · 특가 · 레벨 선물 후보에서 빠짐.
 *  그림을 다시 그려 고치면 이 목록에서 지우기만 하면 풀린다.
 */
export const BLOCKED = new Set([
  /* 모자 — 새 옆모습 그림이 깨짐 (초록 바탕 지울 때 같이 지워짐 · 무늬 깨짐) */
  'hat:lilypad', 'hat:ribbon', 'hat:wingcap',   /* 늪 마녀 · 용암 고깔 · 파라오 = 11/14 다시 그려 풂 */
  /* 목 장식 — 몸 밖 공중에 떠 보이거나 배에 붙어 보임 · 날개에 가려 안 보임 */
  'neck:skull', 'neck:bonechain', 'neck:frogbead', 'neck:crystalbead', 'neck:starnecklace', 'neck:rubyamulet', 'neck:dragonheart', 'neck:coalpouch',
  'neck:scarf', 'neck:emberscarf', 'neck:medal', 'neck:frostmedal', 'neck:leafscarf',
]);
export const BLOCK_TEXT = '새로 그리는 중이라 잠시 잠겼어요';
export const isBlocked = (key) => BLOCKED.has(key);
