/**
 * 좀비와 드래곤 «아래로 더 있음» 금 화살표 — 공용 (대표님 11/13 «어떠한 창에서든, 스크롤을 아래로 내릴 수 있으면 아래로 화살표가
 * 깜빡깜빡 빛나고, 손가락으로 조금이라도 내리면 사라지게»)
 *
 *  규칙 : 아래로 더 내용이 있을 때만 보임 · 조금이라도 스크롤하면 숨김(맨 아래에 닿아도 숨김) · 깜빡임은 밝기만(.6 ↔ 1 · 투명 X) ·
 *         화살표를 누르면 한 화면만큼 내려감.
 *  그림 = 키트 ai/kit/more_arrow.webp(.idg-dlg-more::before · idg-subwin.css) · 모든 창이 이 파일 하나를 쓴다.
 *   - moreDown(scroller)        : 화살표를 보일지 (스크롤 칸이 넘치고 · 아직 안 내렸을 때)
 *   - scrollHint(scroller, opt) : 스스로 스크롤하는 창(일시정지 카드 · 시작 · 결과 …)에 떠 있는 화살표를 붙인다
 *   - 화살표(.idg-dlg-more · .idg-k-more)를 누르면 이 파일이 한 번만 건 문서 단위 클릭 처리로 한 화면 내려간다
 */
const TH = 2;
export const moreDown = (s) => !!s && s.scrollHeight - s.clientHeight > TH && s.scrollTop <= TH;

const canScroll = (n) => { if (!n || n.nodeType !== 1) return false; const o = getComputedStyle(n).overflowY; return (o === 'auto' || o === 'scroll') && n.scrollHeight - n.clientHeight > TH; };
/** 화살표 표가 가리키는 스크롤 칸 : 앞 형제 → 그 안의 첫 스크롤 칸 → 표가 든 키트 스크롤 상자 */
function scrollerOf(mark) {
  const kit = mark.closest?.('.idg-k-scroll'); if (kit) return kit.querySelector('.idg-k-scroll-in');
  if (mark._for) return mark._for;
  let p = mark.previousElementSibling;
  for (let i = 0; i < 3 && p; i++, p = p.previousElementSibling) {
    if (canScroll(p)) return p;
    const inner = p.querySelector?.('*') && [...p.querySelectorAll('*')].find(canScroll); if (inner) return inner;
  }
  return null;
}

let hooked = false;
function hook() {
  if (hooked || typeof document === 'undefined') return; hooked = true;
  document.addEventListener('click', (e) => {
    const mark = e.target?.closest?.('.idg-dlg-more, .idg-k-more'); if (!mark) return;
    const s = scrollerOf(mark); if (!s) return;
    e.preventDefault(); e.stopPropagation();
    s.scrollBy({ top: Math.max(40, Math.round(s.clientHeight * 0.85)), behavior: 'smooth' });
  }, true);
}
hook();

/**
 * 스스로 스크롤하는 칸(scroller) 아래쪽에 «떠 있는» 화살표를 붙인다. 부모(host)가 위치 기준(absolute · relative)이어야 한다 — 아니면 relative 로 만든다.
 * @param {HTMLElement} scroller  @param {{host?:HTMLElement, lift?:number}} [opt]  lift = 칸 아래 끝에서 올릴 px(창 테두리 안쪽으로)
 * @returns {() => void} refresh
 */
export function scrollHint(scroller, opt = {}) {
  if (!scroller || scroller._hint) return scroller?._hint;
  const host = opt.host || scroller.parentElement; if (!host) return () => {};
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const mark = document.createElement('i'); mark.className = 'idg-dlg-more fly'; mark.setAttribute('aria-hidden', 'true'); mark._for = scroller;
  scroller.after(mark);
  const lift = opt.lift ?? 4;
  const refresh = () => {
    if (!mark.isConnected) return;
    mark.style.left = `${scroller.offsetLeft + scroller.offsetWidth / 2}px`;
    mark.style.top = `${scroller.offsetTop + scroller.offsetHeight - lift}px`;
    mark.classList.toggle('on', moreDown(scroller));
  };
  scroller.addEventListener('scroll', refresh, { passive: true });
  scroller.addEventListener('load', refresh, true);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(refresh).observe(scroller);
  if (typeof MutationObserver !== 'undefined') new MutationObserver(() => requestAnimationFrame(refresh)).observe(scroller, { childList: true, subtree: true, characterData: true });
  requestAnimationFrame(() => requestAnimationFrame(refresh)); setTimeout(refresh, 300);
  scroller._hint = refresh;
  return refresh;
}
