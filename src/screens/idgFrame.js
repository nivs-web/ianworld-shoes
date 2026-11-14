/**
 * 좀비와 드래곤 창 «고정 틀» (2026-11-11 대표님 «모든 창이 뜨는 부분에 공통으로 · 버튼 뒤 진한 보라 음영 없애고 · 제목 · 단추는 고정 · 내용은 스크롤»)
 *
 * 로비 위에 뜨는 모든 창(.dialog.idg-*)을 자동으로 세 칸으로 나눈다 :
 *   [제목 리본 (.idg-how-title) — 고정] [가운데 내용 (.idg-dlg-body) — 이 칸만 스크롤] [맨 아래 단추 — 고정]
 * 창마다 코드를 고치지 않도록 document.body 를 지켜보다가 창이 붙거나 창의 직계 자식이 바뀌면 다시 나눈다.
 * 예전에는 제목 · 단추를 sticky 로 붙이고 뒤에 색 띠(#3f2a5a)를 깔아 가렸는데, 그 띠가 «버튼 뒤 진한 보라 상자»로 보였다.
 */
import '../styles/idg-kit.css';      /* UI 키트 모양 (다른 보조 작 · 고치지 않음) */
import { moreDown } from './idgMore.js';   /* «아래로 더 있음» 화살표 공용 규칙 (11/13) */
import '../styles/idg-subwin.css';   /* 서브 창 다듬기 (11/12) — 키트를 옛 창(.dialog.idg-*)에 입히기 · 스크롤 표시 · 픽셀 바꿔 끼우기 */
import '../styles/idg-titlebar.css';   /* 창 머리 현판 50% · X 오른쪽 위 · 글씨 1단계 (11/14) */
import '../styles/idg-window-rules.css';   /* 창 규칙표 1판 (11/14) */
import '../styles/idg-v2.css';   /* 창 틀 2판 = 디자인 규칙표 ① (11/14 대표님 확정) */

/* 스크롤 표시 (11/12 대표님 «목록이 닫기 단추 위에서 뚝 잘려 보인다 → 스크롤 영역임을 알 수 있게 · 그림자 대신 도트 테두리 / 화살표»)
 *  가운데 칸이 넘치면 창에 .scrolls · 아래가 더 있으면 .more-down(아래 화살표) · 위로 올릴 게 있으면 .more-up — 모양은 idg-subwin.css */
/*  화살표는 내용 위에 뜨지 않게 «가운데 칸 바로 아래 금 테 선» 에 걸친 작은 표(.idg-dlg-more · 칸 밖 형제)로 둔다 (11/12 겜부장 점검)
 *  실제로 넘칠 때만(scrollHeight > clientHeight + 2) · 맨 아래까지 내리면 숨김 */
export function watchMore(box, body, after = body) {
  if (body.dataset.watch) return; body.dataset.watch = '1';
  let mark = after.nextElementSibling?.classList?.contains('idg-dlg-more') ? after.nextElementSibling : null;
  if (!mark) { mark = document.createElement('i'); mark.className = 'idg-dlg-more'; mark.setAttribute('aria-hidden', 'true'); after.after(mark); }
  const upd = () => {
    const over = body.scrollHeight - body.clientHeight;
    box.classList.toggle('scrolls', over > 2);
    box.classList.toggle('more-down', moreDown(body));
    box.classList.toggle('more-up', body.scrollTop > 2);
  };
  body.addEventListener('scroll', upd, { passive: true });
  body.addEventListener('load', upd, true);   // 그림이 늦게 들어와 길어질 때
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(upd).observe(body);
  /* 스크롤 위치 지키기 (11/12 서브창2 · 대표님 «받기 · 올리기 · 사기 · 고르기를 누르면 목록이 맨 위로 올라간다»)
   *  «누르면 본문을 통째로 다시 그리는» 창(연구소 · 상점 · 꾸미기 — 다른 파일)을 고치지 않고 여기서 막는다 :
   *  창 안을 누르는 순간의 scrollTop 을 적어 두고, 그 누름 때문에 본문이 바뀌면(MutationObserver) 바로 · 다음 그림 직전 · 조금 뒤 · 그림이 늦게 들어올 때 되살린다.
   *  다시 손가락을 대거나(pointerdown) 휠을 굴리면 되살리기를 멈춘다. */
  let keep = null;
  const restore = () => { if (keep && performance.now() - keep.t < 900 && body.isConnected && Math.abs(body.scrollTop - keep.top) > 1) body.scrollTop = keep.top; };
  box.addEventListener('pointerdown', () => { keep = null; }, true);
  box.addEventListener('wheel', () => { keep = null; }, { passive: true, capture: true });
  box.addEventListener('click', () => { keep = { top: body.scrollTop, t: performance.now() }; }, true);
  body.addEventListener('load', restore, true);
  new MutationObserver(() => {
    if (keep) { restore(); requestAnimationFrame(() => { restore(); requestAnimationFrame(restore); }); setTimeout(restore, 120); setTimeout(restore, 350); }
    requestAnimationFrame(upd);
  }).observe(body, { childList: true, subtree: true });
  requestAnimationFrame(upd); setTimeout(upd, 400);
}
/* 글자 그림(이모지 🔒 · ★☆) → 도트 그림 (11/12 대표님 «픽셀 아트가 아닌 부분은 모두 픽셀 아트로»)
 *  스테이지 고르기 창(로비 파일 · 다른 보조 담당)은 코드를 못 고치므로 창이 그려진 뒤 여기서 바꿔 끼운다. 한 번 바꾼 칸은 data-px 표시. */
const RES = '/assets/iandragon_game/ai/result/', LOCK = '/assets/iandragon_game/ai/lobby/ico_lock.png';
function pimg(src, alt, cls) { const i = document.createElement('img'); i.src = src; i.alt = alt; i.className = cls; i.draggable = false; return i; }
function pixelize(box) {
  box.querySelectorAll('.idg-stage-stars:not([data-px]), .idg-lock:not([data-px])').forEach((e) => {
    const t = e.textContent || ''; e.dataset.px = '1';
    if (t.includes('🔒')) { e.replaceChildren(pimg(LOCK, '잠김', 'idg-lock-ico')); return; }
    if (e.classList.contains('idg-stage-stars')) e.replaceChildren(...[...t].filter((c) => c === '★' || c === '☆').map((c) => pimg(`${RES}star_${c === '★' ? 'on' : 'off'}.webp`, c, 'idg-star-ico')));
  });
}
/* ── 창 틀 2판 (디자인 규칙표 ① · 11/14) ──
 *  제목 줄을 «위 줄» 로 바꾼다 : 글씨 → 가운데 날개 현판(.v2t) · .v2-left → 왼쪽(재화 알약) · 바로가기 · X → 오른쪽
 *  창 크기 4단계 : 클래스 v2-max · (기본 = 큰) · v2-mid · v2-small — 창마다 아래 SIZE 표로 정한다 */
const V2_SKIP = ['idg-hall', 'pp'];
const SIZE = [['idg-set', 'v2-mid'], ['idg-more', 'v2-mid'], ['idg-profile', 'v2-mid'], ['idg-note', 'v2-small'], ['idg-gift', 'v2-mid'], ['idg-how', 'v2-mid'], ['idg-credits', 'v2-mid']];
function v2head(box, head) {
  if (!head || head.classList.contains('v2')) return;
  if (V2_SKIP.some((c) => box.classList.contains(c))) return;
  const texts = [...head.childNodes].filter((n) => n.nodeType === 3 || (n.nodeType === 1 && n.matches('.v2-text')));
  const t = texts.map((n) => n.textContent).join('').trim();
  texts.forEach((n) => n.remove());
  const left = document.createElement('div'); left.className = 'v2l';
  const right = document.createElement('div'); right.className = 'v2r';
  [...head.children].forEach((c) => { (c.classList.contains('v2-left') ? left : right).appendChild(c); });
  const plate = document.createElement('div'); plate.className = 'v2t';
  const b = document.createElement('b'); b.textContent = t; b.dataset.t = t; plate.appendChild(b);
  head.replaceChildren(left, plate, right);
  head.classList.add('v2');
  box.classList.add('idg-v2');
  const s = SIZE.find(([c]) => box.classList.contains(c)); if (s) box.classList.add(s[1]);
}
const isFoot = (n) => n && (n.tagName === 'BUTTON' || n.classList.contains('pbtn') || (n.classList.contains('row') && n.querySelector('button')) || n.classList.contains('idg-row'));
function frame(box) {
  box.classList.add('idg-k');   /* UI 키트 뿌리 (11/12 대표님 «어느 창이든 통일감») — 키트 부품 · Pretendard 외곽선 글씨가 모든 로비 창에 */
  if (box.querySelector(':scope > .idg-pp')) { box.classList.add('idg-framed', 'pp'); return; }   /* 파워업 페이지는 자기 틀이 있다 */
  let kids = [...box.children].filter((k) => !k.classList.contains('idg-dlg-more'));   /* 스크롤 화살표 표는 칸 나누기에서 뺀다 */
  const old = kids.find((k) => k.classList.contains('idg-dlg-body'));
  pixelize(box);
  if (old && kids.length <= 3 && kids.indexOf(old) <= 1) { v2head(box, kids[0]?.classList.contains('idg-how-title') ? kids[0] : null); watchMore(box, old); return; }   /* 이미 나뉨 */
  if (old) { box.querySelectorAll(':scope > .idg-dlg-more').forEach((m) => m.remove()); old.replaceWith(...old.childNodes); kids = [...box.children]; }
  const head = kids[0]?.classList.contains('idg-how-title') ? kids[0] : null;
  v2head(box, head);
  const foot = kids.length > 1 && isFoot(kids[kids.length - 1]) ? kids[kids.length - 1] : null;
  const mid = kids.filter((k) => k !== head && k !== foot);
  const body = document.createElement('div'); body.className = 'idg-dlg-body';
  body.append(...mid);
  if (foot) box.insertBefore(body, foot); else box.appendChild(body);
  box.classList.add('idg-framed');
  watchMore(box, body);
}
let on = false;
export function installIdgFrame() {
  if (on || typeof MutationObserver === 'undefined') return; on = true;
  const scan = (root) => { if (root.nodeType !== 1) return; if (root.matches?.('.dialog[class*="idg-"]')) frame(root); root.querySelectorAll?.('.dialog[class*="idg-"]').forEach(frame); };
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.target.nodeType === 1 && m.target.matches?.('.dialog[class*="idg-"]')) frame(m.target);
      else if (m.target.nodeType === 1) { const d = m.target.closest?.('.dialog[class*="idg-"]'); if (d) pixelize(d); }
      m.addedNodes.forEach(scan);
    }
  }).observe(document.body, { childList: true, subtree: true });
  scan(document.body);
}
