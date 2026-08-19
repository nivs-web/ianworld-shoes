/**
 * 화면을 **누를 때 받는다.** (2026-08-19 13차, 속도)
 *
 * ## 왜
 *
 * 청크를 갈라 재 보니 부팅 번들 57.5KB(gzip) 중 **화면 코드와 그 데이터가 절반 가까이**
 * 였다 — 도감이 쓰는 `shoes.json`(130종), 배경설정이 쓰는 배경 명단(44종), 명예의 전당,
 * 캐릭터 선택, 멀티 화면들. **로비를 그리는 데는 한 줄도 필요 없는 것들이다.**
 *
 * 로비의 버튼은 사람이 읽고 누르기까지 최소 몇백 ms 가 걸리고, 그 사이에
 * `prefetch()` 가 한가한 틈에 미리 받아 둔다 — 실제로는 **누르면 이미 있다.**
 *
 * ## 늦게 온 응답이 남의 화면을 건드리지 않게
 *
 * `nav.refresh()` 는 "지금 살아 있는 화면"을 다시 그린다. 화면을 떠난 뒤에 모듈이
 * 도착해서 그걸 부르면 **엉뚱한 화면이 다시 그려진다** — 예전에 순위표 응답이
 * 닉네임 입력을 날린 적이 있다(§9-0-14). 그래서 `onLeave` 에서 도장을 찍고 확인한다.
 */

import S from '../config/strings.ko.js';
import { el, screen, title } from './ui.js';

/**
 * @param {() => Promise<{default: Function}>} load 동적 import
 * @param {string} label 받는 동안 보여 줄 제목 (화면이 통째로 비면 고장으로 보인다)
 * @returns {Function} router 가 그대로 쓸 수 있는 화면 팩토리
 */
export function lazyScreen(load, label) {
  /** 미리 받아 두기 — 로비가 뜨자마자 한가한 틈에 부른다 */
  const factory = function Lazy(nav, params = {}) {
    let inner = null;
    let gone = false;

    load().then((m) => {
      if (gone) return;
      inner = m.default(nav, params);
      nav.refresh();
    }).catch(() => { /* 다음 진입에 다시 시도한다 */ });

    return {
      onLeave() {
        gone = true;
        inner?.onLeave?.();
      },
      render() {
        if (inner) return inner.render();
        return screen(title(label), el('div.hint', S.loading));
      },
    };
  };
  factory.prefetch = () => load().catch(() => {});
  return factory;
}

/** 여러 화면을 한가할 때 한꺼번에 미리 받는다 */
export function prefetchScreens(list) {
  const go = () => { for (const f of list) f.prefetch?.(); };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1500);
}
