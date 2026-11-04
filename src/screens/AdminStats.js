/**
 * 운영자 통계 화면 — 숫자만. (2026-11-04, 대표님 지시 · 권반장 전달)
 *
 * *"운영자만 보는 것조차도 없어도 돼. 통계만 나오면 돼"*
 *
 * 실시간 접속자 목록(옛 `OnlineUsers`)을 없애고 그 자리를 이것으로 바꿨다.
 * 열 때 한 번 읽고, [새로고침]을 누를 때만 다시 읽는다 — 구독하지 않는다.
 * 메뉴는 운영자(`stats.isAdmin()`)에게만 보이고, 숫자 자체도 서버 규칙이 운영자에게만 준다.
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, title } from './ui.js';
import * as Stats from '../services/stats.js';

/** 'YYYYMMDD' → 'M/D' */
const md = (k) => `${Number(k.slice(4, 6))}/${Number(k.slice(6, 8))}`;

export default function AdminStats(nav) {
  let data;          // undefined = 읽는 중, null = 못 읽음
  let live = true;

  function load() {
    data = undefined;
    nav.refresh();
    Stats.readStats(7).then((d) => { if (!live) return; data = d; nav.refresh(); });
  }
  load();

  return {
    onLeave() { live = false; },

    render() {
      if (data === undefined) return screen(title(S.adminStatsTitle), el('div.hint', S.loading),
        el('div.spacer'), backButton(S.back, () => nav.back()));
      if (!data) return screen(title(S.adminStatsTitle), el('div.warn', S.adminStatsFailed),
        button(S.refreshList, load), el('div.spacer'), backButton(S.back, () => nav.back()));

      const today = data.days[0] ?? { n: 0, peak: 0 };
      const max = Math.max(1, ...data.days.map((d) => d.n));
      return screen(
        title(S.adminStatsTitle),
        el('div.admin-stats', null, [
          el('div.stat-line', S.adminTodayVisitors(today.n)),
          el('div.stat-line', S.adminLiveNow(data.live)),
          el('div.stat-line', S.adminTodayPeak(today.peak)),
        ]),
        el('div.diff-title', S.adminLast7),
        el('div.admin-days', null, data.days.slice().reverse().map((d) =>
          el('div.admin-day', null, [
            el('span.admin-day-k', md(d.day)),
            el('span.admin-day-bar', { style: { width: `${Math.round((d.n / max) * 100)}%` } }),
            el('span.admin-day-v', S.adminDayRow(d.n, d.peak)),
          ]))),
        el('div.hint', S.adminStatsHint),
        button(S.refreshList, load),
        el('div.spacer'),
        backButton(S.back, () => nav.back())
      );
    },
  };
}
