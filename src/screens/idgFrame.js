/**
 * 좀비와 드래곤 창 «고정 틀» (2026-11-11 대표님 «모든 창이 뜨는 부분에 공통으로 · 버튼 뒤 진한 보라 음영 없애고 · 제목 · 단추는 고정 · 내용은 스크롤»)
 *
 * 로비 위에 뜨는 모든 창(.dialog.idg-*)을 자동으로 세 칸으로 나눈다 :
 *   [제목 리본 (.idg-how-title) — 고정] [가운데 내용 (.idg-dlg-body) — 이 칸만 스크롤] [맨 아래 단추 — 고정]
 * 창마다 코드를 고치지 않도록 document.body 를 지켜보다가 창이 붙거나 창의 직계 자식이 바뀌면 다시 나눈다.
 * 예전에는 제목 · 단추를 sticky 로 붙이고 뒤에 색 띠(#3f2a5a)를 깔아 가렸는데, 그 띠가 «버튼 뒤 진한 보라 상자»로 보였다.
 */
const isFoot = (n) => n && (n.tagName === 'BUTTON' || n.classList.contains('pbtn') || (n.classList.contains('row') && n.querySelector('button')) || n.classList.contains('idg-row'));
function frame(box) {
  if (box.querySelector(':scope > .idg-pp')) { box.classList.add('idg-framed', 'pp'); return; }   /* 파워업 페이지는 자기 틀이 있다 */
  let kids = [...box.children];
  const old = kids.find((k) => k.classList.contains('idg-dlg-body'));
  if (old && kids.length <= 3 && kids.indexOf(old) <= 1) return;   /* 이미 나뉨 */
  if (old) { old.replaceWith(...old.childNodes); kids = [...box.children]; }
  const head = kids[0]?.classList.contains('idg-how-title') ? kids[0] : null;
  const foot = kids.length > 1 && isFoot(kids[kids.length - 1]) ? kids[kids.length - 1] : null;
  const mid = kids.filter((k) => k !== head && k !== foot);
  const body = document.createElement('div'); body.className = 'idg-dlg-body';
  body.append(...mid);
  if (foot) box.insertBefore(body, foot); else box.appendChild(body);
  box.classList.add('idg-framed');
}
let on = false;
export function installIdgFrame() {
  if (on || typeof MutationObserver === 'undefined') return; on = true;
  const scan = (root) => { if (root.nodeType !== 1) return; if (root.matches?.('.dialog[class*="idg-"]')) frame(root); root.querySelectorAll?.('.dialog[class*="idg-"]').forEach(frame); };
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.target.nodeType === 1 && m.target.matches?.('.dialog[class*="idg-"]')) frame(m.target);
      m.addedNodes.forEach(scan);
    }
  }).observe(document.body, { childList: true, subtree: true });
  scan(document.body);
}
