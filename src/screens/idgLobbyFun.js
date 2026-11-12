/**
 * 좀비와 드래곤 로비 — 앞 겹 위 작은 것들 (11/12 대표님 로비 2차 피드백 7 깃발) · 로비 파일이 300줄을 넘지 않게 따로
 *
 *  lobbyScene(flagId) : 앞 겹(.l2-scene) 안 — 배경 그림 위 정해진 자리
 *    장착 깃발(작은 돌 받침 · 깃대 · 펄럭이는 천) · 꾸벅 조는 부엉이(가로등 팔) · 도깨비불
 *    자리 = 배경 그림 좌표 (가로 front_land_v3 2240×1072 · 세로 front_port 1080×1935). 가로 · 세로 둘 다 만들고 CSS 가 화면 방향에 맞는 쪽만 보인다.
 *  촛불 · 등불 · 창문 · 호박 불빛 · 무덤 좀비 · 마녀 순환 같은 재미 요소는 다른 보조의 lobbyFx.js (로비가 따로 층을 만들어 부른다).
 */
import { el } from './ui.js';

const SPOT = {
  land: { owl: [880, 364], wisp: [[620, 560], [2020, 660], [1505, 640]], flag: [1452, 732] },
  port: { owl: [290, 603], wisp: [[900, 1420], [150, 1190]], flag: [760, 1066] },
};
const pos = (x, y) => `--x:${x};--y:${y}`;

/**
 * 장착 깃발 — 꾸미기 «성 깃발» (G.idg().look 의 f 칸 → decodeLook(look).flag · data/looks.js LOOKS.flag)
 *  그림 = 전투 battleView 와 같은 ai/meta/flag_<id>.png · 안 달았으면 호박 깃발(flag_pumpkin · 판매 목록에 없는 기본 그림)
 *  천은 같은 그림을 세로 띠 6줄로 잘라 띠마다 엇갈려 출렁인다 (바람에 펄럭).
 */
function flagStand(flagId, at) {
  const src = `/assets/iandragon_game/ai/meta/flag_${flagId || 'pumpkin'}.png`;
  const cloth = el('i.l2-flag-cloth', null, [0, 1, 2, 3, 4, 5].map((k) => el('i.l2-flag-strip', { style: `--k:${k};background-image:url(${src})` })));
  return el('i.l2-flag', { style: pos(at[0], at[1]) }, [el('i.l2-flag-pole'), el('i.l2-flag-arm'), cloth, el('i.l2-flag-base')]);
}

function fxSet(flagId, k) {
  const S = SPOT[k];
  return el('i.l2-fx.' + k, null, [
    ...S.wisp.map(([x, y], i) => el('i.l2-wisp', { style: pos(x, y) + `;--dl:${(-1.7 * i).toFixed(1)}s` })),
    el('i.l2-owl', { style: pos(...S.owl) }),
    flagStand(flagId, S.flag),
  ]);
}
/** 앞 겹 안에 늘 있는 것 (가로 · 세로 두 벌) */
export function lobbyScene(flagId) { return [fxSet(flagId, 'land'), fxSet(flagId, 'port')]; }
