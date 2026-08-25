/**
 * S20 드래곤 스트라이커 — 게임 화면(iframe 호스트).
 *
 * ★ **왜 iframe 인가.**
 * 이 게임은 외부 파일이 하나도 없는 단일 HTML(`public/dragon/index.html`)이다.
 * 캔버스·입력·오디오·씬 스택을 제 것으로 다 들고 있어서, 신발게임의 `core/` 위에
 * 얹으려면 사실상 전면 재작성이다. iframe 으로 띄우면 그 코드를 한 줄도 건드리지
 * 않고 오락실의 계정·기록에 붙일 수 있다.
 *
 * 대신 두 세계가 완전히 분리되므로 **오가는 것은 postMessage 뿐**이다.
 * 규약은 아래 한 곳에만 적는다 — 게임 쪽(`public/dragon/index.html`)의
 * `IanWorldBridge` 와 반드시 짝이 맞아야 한다.
 *
 *   부모 → 게임 : { type:'ianworld:profile', nickname, difficulty, character }
 *   게임 → 부모 : { type:'ianworld:ready' }                     // 다리 연결됨
 *                { type:'ianworld:result', score, stage, level } // 한 판 끝
 *                { type:'ianworld:character', index }            // 드래곤 바꿈
 *                { type:'ianworld:exit' }                        // 로비로
 */

import S from '../config/strings.ko.js';
import { el, toast } from './ui.js';
import { get as getProfile, finishDragonRun, setDragonCharacter } from '../services/profile.js';

/** 게임 문서 경로. 빌드 산출물이 아니라 `public/` 그대로 나가는 정적 파일이다 */
const GAME_URL = '/dragon/index.html';

/**
 * 이 페이지가 서 있는 오리진. `postMessage` 의 targetOrigin 으로 쓴다.
 *
 * ★ **`'*'` 를 쓰지 않는다.** 게임이 같은 오리진에 있으므로 정확한 값을 줄 수 있고,
 * 그러면 닉네임 같은 계정 정보가 다른 오리진으로 새 나갈 여지가 아예 없다.
 * 받는 쪽도 `event.origin` 을 같은 값으로 검사한다.
 */
const ORIGIN = window.location.origin;

/**
 * @param {object} nav
 * @param {{mode?:'play'|'chars'|'options', difficulty?:string}} opt
 *   mode 는 게임이 어떤 화면부터 열지 정한다. 로비의 [드래곤 변경]·[설정]도
 *   같은 iframe 을 재사용한다 — 그 화면들은 게임 안에만 있고, 도트를 그리는
 *   코드까지 오락실 쪽에 복사하면 두 벌을 따로 고쳐야 한다.
 */
export default function DragonGame(nav, opt = {}) {
  const mode = opt.mode || 'play';
  let frame = null;
  let offMsg = null;
  /** 판이 끝나 이미 기록한 결과인지 — 같은 판을 두 번 세지 않는다 */
  let settled = false;

  function send(msg) {
    try { frame?.contentWindow?.postMessage(msg, ORIGIN); } catch { /* 아직 안 떴다 */ }
  }

  function pushProfile() {
    const p = getProfile();
    send({
      type: 'ianworld:profile',
      nickname: p.nickname || '',
      difficulty: p.dragonDifficulty || 'normal',
      character: p.dragonCharacter | 0,
    });
  }

  function onMessage(e) {
    // 오리진이 다르면 우리 게임이 아니다 — 광고 프레임 등이 보낸 것일 수 있다
    if (e.origin !== ORIGIN) return;
    if (e.source !== frame?.contentWindow) return;
    const d = e.data;
    if (!d || typeof d !== 'object') return;

    switch (d.type) {
      case 'ianworld:ready':
        pushProfile();
        break;

      /**
       * 한 판 끝. **여기가 유일한 기록 지점이다.**
       * 게임이 여러 번 보내더라도(연타·재시도) 한 판은 한 번만 센다.
       */
      case 'ianworld:result': {
        if (settled) break;
        settled = true;
        const { isBest } = finishDragonRun(d);
        if (isBest) toast(S.dragonNewBest(Math.round(Number(d.score) || 0)), 2600);
        break;
      }

      /** 게임 안에서 드래곤을 바꿨다 — 로비 카드에도 같은 것이 보여야 한다 */
      case 'ianworld:character':
        setDragonCharacter(d.index);
        break;

      case 'ianworld:exit':
        nav.back();
        break;

      /** 새 판이 시작됐다 — 다음 결과를 다시 받을 수 있게 연다 */
      case 'ianworld:start':
        settled = false;
        break;
    }
  }

  return {
    onLeave() {
      offMsg?.();
      offMsg = null;
      frame = null;
    },

    render() {
      frame = el('iframe.dragon-frame', {
        src: `${GAME_URL}?embed=1&mode=${encodeURIComponent(mode)}`,
        title: S.dragonTitle,
        /**
         * 게임은 전체화면 API 와 게임패드 진동을 쓴다. iframe 은 기본으로
         * 둘 다 막혀 있어서 명시적으로 열어 준다 — 없으면 게임 안에서
         * [전체화면] 을 눌러도 아무 일도 일어나지 않는다.
         */
        allow: 'fullscreen; gamepad; autoplay',
        allowfullscreen: 'true',
      });

      window.addEventListener('message', onMessage);
      offMsg = () => window.removeEventListener('message', onMessage);

      /**
       * ★ **`screen()` 으로 감싸지 않는다.** 그 컨테이너는 여백·세로 배치가 있어
       * iframe 이 화면을 꽉 채우지 못한다. 게임은 제 안에서 레터박스를 잡으므로
       * 여기서는 검은 판때기 하나만 주면 된다.
       */
      return el('div.dragon-stage', null, [
        el('div.dragon-loading', S.dragonLoading),
        frame,
      ]);
    },
  };
}
