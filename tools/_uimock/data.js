// 시안 공용 데이터 + 작은 도우미 (실제 게임 그림 경로만 씀)
const A = '/assets/iandragon_game/ai/';
const M = A + 'meta/';
const L = A + 'lobby/';
const COIN = A + 'ui/coin.svg', GEM = A + 'ui/gem.svg';
const ITEMS = [
  { n: '달 깃발', fx: '캐슬 체력 +0.5%', img: M + 'flag_moon.png', p: 2800, r: 'rare', off: 30 },
  { n: '별 깃발', fx: '캐슬 체력 +0.5%', img: M + 'flag_star.png', p: 2800, r: 'rare' },
  { n: '박쥐 깃발', fx: '캐슬 체력 +0.5%', img: M + 'flag_batflag.webp', p: 2030, r: 'epic', off: 30 },
  { n: '황금 브레스', fx: '브레스 색', img: M + 'breath_gold.png', p: 5000, r: 'leg' },
  { n: '얼음 브레스', fx: '브레스 색', img: M + 'breath_ice.png', p: 3200, r: 'rare' },
  { n: '은하 오라', fx: '발밑 빛', img: M + 'aura_galaxy.webp', p: 4400, r: 'epic' },
  { n: '반딧불 오라', fx: '발밑 빛', img: M + 'aura_firefly.webp', p: 1800, r: '' },
  { n: '용의 성문', fx: '캐슬 가호 +1%', img: M + 'gate_dragongate.webp', p: 6000, r: 'leg' },
  { n: '불꽃 성문', fx: '캐슬 가호 +0.5%', img: M + 'gate_firegate.webp', p: 3000, r: 'epic' },
  { n: '하트 깃발', fx: '캐슬 체력 +0.5%', img: M + 'flag_heart.png', p: 2100, r: '' },
];
const DR = ['novart', 'aquantis', 'solaris', 'frostwing', 'goldrex', 'shadowfen', 'forestia', 'volttail', 'sandscale', 'crimsonde', 'kkomul', 'twetwe'];
const DRN = { novart: '노바트', aquantis: '아쿠안티스', solaris: '솔라리스', frostwing: '프로스트윙', goldrex: '골드렉스', shadowfen: '섀도펜', forestia: '포레스티아', volttail: '볼트테일', sandscale: '샌드스케일', crimsonde: '크림슨드', kkomul: '꼬물이', twetwe: '튀튀' };
const head = (id) => `${A}${id}/head_big.png`;
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const fmt = (n) => n.toLocaleString('en-US');
const cashHTML = () => `<div class="cash coin"><img src="${COIN}"><b>99,999</b></div><div class="cash gem"><img src="${GEM}"><b>999</b></div>`;
const cardHTML = (it, btn = true) => `<div class="card ${it.r}">${it.off ? `<i class="off">-${it.off}%</i>` : ''}<div class="art"><img src="${it.img}"></div><div class="nm">${it.n}</div><div class="fx">${it.fx}</div>${btn ? `<span class="btn g wide"><img src="${COIN}">${fmt(it.p)}</span>` : ''}</div>`;
const tag = (t) => document.body.append(h(`<div class="tag">${t}</div>`));
const fill = (id, html) => { document.getElementById(id).innerHTML = html; };
document.addEventListener('DOMContentLoaded', () => { const c = document.getElementById('cash'); if (c) c.outerHTML = document.querySelector('.win.v2') ? `<span class="pill2"><img src="${COIN}"><b class="c">99,999</b><i></i><img src="${GEM}"><b class="gm">999</b></span>` : cashHTML(); });
