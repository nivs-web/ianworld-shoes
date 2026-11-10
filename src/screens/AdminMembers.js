/**
 * 운영자 «신규 회원 가입 현황» (2026-11-10 대표님)
 *
 * > «신규 회원이 가입을 했으면 … 그 사람이 몇 시간 몇 분 몇 초 동안 우리 사이트에 접속했는지와
 * > 어떤 게임을 몇 판 했는지 자세하고 디테일하게. 날짜별로 … 누가 접속했는지 누가 몇 시간 동안 어떤 게임을 하다 나갔는지.»
 *
 * 위: 최근 가입한 회원(구글 계정 가입 시각 · 그 뒤 쓴 시간 · 판 수 합계)
 * 아래: 날짜별 접속한 사람 — 사람마다 접속 시간(시간 · 분 · 초) · 처음/마지막 시각 · 게임별 판 수. 그날 가입한 사람은 «신규».
 * 숫자는 `services/stats.js` 가 쌓는다(30초마다 접속 시간 +30초 · 게임을 시작할 때 판 수 +1). 읽기는 운영자만(서버 규칙).
 */
import { el, button, backButton, screen, title } from './ui.js';
import * as Stats from '../services/stats.js';

const DAYS = 14;
const md = (k) => `${Number(k.slice(4, 6))}월 ${Number(k.slice(6, 8))}일`;
const hms = (sec) => {
  sec = Math.max(0, sec | 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}시간 ${m}분 ${s}초` : m ? `${m}분 ${s}초` : `${s}초`;
};
const hm = (ms) => {
  if (!ms) return '-';
  const d = new Date(ms + 9 * 3600 * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};
const dateTime = (ms) => (ms ? `${md(Stats.dayKey(ms))} ${hm(ms)}` : '-');
const gamesLine = (g) => {
  const parts = Object.keys(Stats.GAME_NAMES).filter((k) => (g?.[k] | 0) > 0).map((k) => `${Stats.GAME_NAMES[k]} ${g[k] | 0}판`);
  return parts.length ? parts.join(' · ') : '게임 안 함';
};

export default function AdminMembers(nav) {
  let data;          // undefined = 읽는 중, null = 못 읽음
  let live = true;
  function load() {
    data = undefined;
    nav.refresh();
    Stats.readMembers(DAYS).then((d) => { if (!live) return; data = d; nav.refresh(); });
  }
  load();

  return {
    onLeave() { live = false; },
    render() {
      const T = '신규 회원 가입 현황';
      if (data === undefined) return screen(title(T), el('div.hint', '불러오는 중…'), el('div.spacer'), backButton('뒤로', () => nav.back()));
      if (!data) return screen(title(T), el('div.warn', '기록을 읽지 못했습니다 (운영자 계정 · 서버 규칙을 확인하세요)'),
        button('다시 읽기', load), el('div.spacer'), backButton('뒤로', () => nav.back()));

      const M = data.members || {};
      const since = Date.now() - DAYS * 86400000;
      /* 사람별 합계(최근 DAYS 일) */
      const tot = {};
      for (const d of data.days) for (const [uid, a] of Object.entries(d.users)) {
        const t = (tot[uid] ??= { sec: 0, plays: 0, days: 0 });
        t.sec += a.sec | 0; t.days++;
        for (const v of Object.values(a.g || {})) t.plays += v | 0;
      }
      const fresh = Object.entries(M).filter(([, m]) => (m.joined | 0) >= since).sort((a, b) => b[1].joined - a[1].joined);
      const nameOf = (uid, a) => (M[uid]?.nick || a?.nick || '(이름 없음)');

      const newBox = el('div.am-box', null, [
        el('div.am-h', `최근 ${DAYS}일 신규 가입 ${fresh.length}명 · 전체 회원 ${Object.keys(M).length}명`),
        ...(fresh.length ? fresh.map(([uid, m]) => el('div.am-row', null, [
          el('div.am-name', null, [m.nick || '(이름 없음)', el('span.am-new', '신규')]),
          el('div.am-sub', m.email || ''),
          el('div.am-sub', `가입 ${dateTime(m.joined)} · 접속 ${hms(tot[uid]?.sec)} · ${tot[uid]?.plays | 0}판 · ${tot[uid]?.days | 0}일 접속`),
        ])) : [el('div.am-sub', '아직 없어요')]),
      ]);

      const dayBoxes = data.days.filter((d) => Object.keys(d.users).length).map((d) => {
        const rows = Object.entries(d.users).sort((a, b) => (b[1].sec | 0) - (a[1].sec | 0));
        const newbies = rows.filter(([uid]) => M[uid]?.joined && Stats.dayKey(M[uid].joined) === d.day).length;
        return el('div.am-box', null, [
          el('div.am-h', `${md(d.day)} · 접속 ${rows.length}명${newbies ? ` · 신규 ${newbies}명` : ''}`),
          ...rows.map(([uid, a]) => {
            const isNew = M[uid]?.joined && Stats.dayKey(M[uid].joined) === d.day;
            return el('div.am-row', null, [
              el('div.am-name', null, [nameOf(uid, a), isNew ? el('span.am-new', '신규') : null]),
              M[uid]?.email ? el('div.am-sub', M[uid].email) : null,
              el('div.am-sub', `접속 ${hms(a.sec)} · ${hm(a.first)} ~ ${hm(a.last)}`),
              el('div.am-games', gamesLine(a.g)),
            ]);
          }),
        ]);
      });

      return screen(
        title(T),
        newBox,
        el('div.diff-title', '날짜별 접속'),
        ...(dayBoxes.length ? dayBoxes : [el('div.hint', '아직 쌓인 기록이 없어요 — 오늘부터 쌓입니다')]),
        el('div.hint', '접속 시간은 화면을 보고 있을 때만 30초씩 셉니다 · 판 수는 게임을 시작할 때 셉니다'),
        button('새로 고침', load),
        el('div.spacer'),
        backButton('뒤로', () => nav.back()),
      );
    },
  };
}
