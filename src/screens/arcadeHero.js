/**
 * 이안오락실 «첫 화면» — 오락실 홈페이지(onstori.com/oraksil) 모바일 첫 화면과 같은 느낌 (2026-11-04 대표님)
 *
 * > 대표님: 네온사인 움직임 · 동전 도는 것 · 폭죽 · 위 조명 왔다갔다는 넣고 / 조이스틱·게임패드·동전 아이콘·별·하트는 지움 /
 * >   햄버거·버튼·메뉴 없음 · NOW OPEN·«오늘 밤 한 판 더» 뺌 · 오락실 모니터 화면까지만 · 폰 화면 절반보다 조금 넓게.
 * >   가운데 엠블럼 + «이안오락실» 로고 · 엠블럼: 가만히 → 반짝 → 1초 → 빙글 1바퀴 → 1초 → 반짝 → 1초 → 빙글 2바퀴 → 반복 ·
 * >   로고 글씨는 무게감 + 불빛이 위를 싹 지나가는 반짝임.
 *
 * ★ 배경판·드래곤·불·폭발·동전 그림은 홈페이지와 같은 원본(우리 R2)을 이 앱 public/assets/ui/arcade 에 복사해 쓴다.
 *   배경판은 가장자리 아이콘(하트·별·동전·조이스틱)을 지우고 모니터 높이까지(원본의 위 64%)만 자른 판.
 * ★ 자리 값 = 홈페이지 config/arcade-scene.ts 의 «폰» 값을 잘린 높이(0.64)에 맞춰 옮긴 것.
 * ★ 움직임은 CSS(arcade.css) — 폭죽만 아래 start() 가 뿌린다(화면을 떠나면 stop()).
 */

import { el } from './ui.js';
import '../styles/arcade.css';

const A = '/assets/ui/arcade/';
/* 빙글 동전 [left%, top%, 시작 엇박 s] — 홈페이지 폰 자리 ÷ 0.64 */
const COINS = [[50, 7.8, 0], [8, 71.9, -0.3], [90, 84.4, -0.6], [30, 4.7, -0.15], [20, 81.2, -0.45], [72, 73.4, -0.75], [12, 46.9, -0.6]];
/* 오락기 화면 반짝 [left, top, w, h, 종류, 엇박] */
const CABS = [[0.4, 92, 5.3, 6, 1, 0], [18.4, 91.3, 2.7, 3.75, 2, 0], [79.9, 91.3, 2.2, 3.75, 3, 0], [94.4, 92, 5.2, 6, 1, -1.6]];
/* 네온 전구 길(원본 1536×2752 좌표 · 위 1761 까지만 보임) */
const CHASE = ['M195 1110 L195 830 A45 45 0 0 1 286 830 L286 1110', 'M1264 1110 L1264 825 A42 42 0 0 1 1348 825 L1348 1110', 'M0 978 L105 978 L336 1188 L336 1300 L0 1188'];
const FW = ['#FF2BD6', '#22E6FF', '#8FFF4A', '#FFC93C', '#9A5FE0', '#FFFFFF'];

export function arcadeHero() {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'oh-chase');
  svg.setAttribute('viewBox', '0 0 1536 1761');
  svg.setAttribute('preserveAspectRatio', 'none');
  for (const d of CHASE) { const p = document.createElementNS(svgNS, 'path'); p.setAttribute('d', d); svg.appendChild(p); }

  return el('div.oh', { 'aria-hidden': 'true' }, [
    el('div.oh-sc', null, [
      el('i.oh-glow.g1'), el('i.oh-glow.g2'), el('i.oh-glow.g3'),
      ...CABS.map(([l, t, w, h, k, d]) => el(`i.oh-cab.k${k}`, { style: `left:${l}%;top:${t}%;width:${w}%;height:${h}%;animation-delay:${d}s` })),
      svg,
      el('i.oh-beam'), el('i.oh-beam.b2'),
      el('span.oh-bob', null, [el('i.oh-dr.blk')]),
      el('span.oh-bob.b2', null, [el('i.oh-dr.blu')]),
      el('i.oh-px.oh-fire.blu'), el('i.oh-px.oh-fire.blk'),
      el('i.oh-px.oh-boom'), el('i.oh-px.oh-boom.b2'),
      ...COINS.map(([l, t, d]) => el('i.oh-px.oh-coin', { style: `left:${l}%;top:${t}%;animation-delay:${d}s` })),
      el('div.oh-fwlayer'),
    ]),
    /* 가운데 엠블럼 + 로고 */
    el('div.oh-brand', null, [
      el('div.oh-emblem', null, [el('img', { src: A + 'emblem.webp', alt: '' }), el('i.oh-emblem-shine')]),
      el('div.oh-logo', null, [el('img', { src: A + 'logo-text.png', alt: '이안오락실' }), el('i.oh-logo-shine')]),
    ]),
  ]);
}

/* 폭죽 — 화면에 .oh-fwlayer 가 있을 때만 뿌린다. 화면을 떠나면 stop() */
let timer = 0;
export function startArcade() {
  stopArcade();
  const R = (a, b) => a + Math.random() * (b - a);
  const burst = () => {
    const layer = document.querySelector('.oh-fwlayer');
    if (!layer || document.hidden) return;
    const W = layer.clientWidth, H = layer.clientHeight;
    const cx = W * R(0.28, 0.72), cy = H * R(0.18, 0.5), n = 16, rad = R(28, 58), sz = 4, dur = R(1000, 1500);
    const c1 = FW[(Math.random() * FW.length) | 0], c2 = FW[(Math.random() * FW.length) | 0];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + R(-0.08, 0.08), r = rad * R(0.75, 1.05), c = k % 2 ? c1 : c2;
      const d = document.createElement('i');
      d.className = 'oh-fw';
      d.style.cssText = `width:${sz}px;height:${sz}px;background:${c};box-shadow:0 0 ${sz}px ${c}`;
      layer.appendChild(d);
      const ex = cx + Math.cos(a) * r, ey = cy + Math.sin(a) * r;
      d.animate([
        { transform: `translate(${cx}px,${cy}px) scale(.5)`, opacity: 1 },
        { transform: `translate(${ex}px,${ey}px) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${ex}px,${ey + rad * 0.35}px) scale(.6)`, opacity: 0 },
      ], { duration: dur, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => d.remove();
    }
  };
  const loop = () => { burst(); timer = window.setTimeout(loop, R(1100, 1900)); };
  timer = window.setTimeout(loop, 500);
}
export function stopArcade() { if (timer) { clearTimeout(timer); timer = 0; } }
