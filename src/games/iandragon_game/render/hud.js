/**
 * 전투 HUD (B2 · 2026-11-11 야간) — 캔버스 위 DOM (오락실 규칙 «캔버스 글씨 금지» · 기획서 11.1).
 *
 *  위 : ⏸ · 스테이지 · 시간 · ×1/×2 · 불씨 / 내 기지 ♥ · 좀비 탑 ♥ · (보스 체력바)
 *  아래 : [화로] [용 덱 5~10] [스킬] [포효] [브레스]
 * 덱 버튼 = 용 얼굴(부품 그림의 head) + 값. 불씨 모자라면 어둡게 · 재생산 중이면 시계처럼 차오름 · 다 되면 번쩍.
 * 키보드 : 1~0 덱 · Q 화로 · 스페이스 브레스 · A/S 스킬 · R 포효 · P 일시정지
 */
import { UNITS } from '../data/units.js';
import { SKILLS } from '../data/skills.js';

const AI = '/assets/iandragon_game/ai/';
/** 기믹 설명 (아이 말투 · 계산기 GIM_KO 와 같은 뜻) */
const GIM = {
  gold: '황금 좀비가 나와요! 잡으면 코인이 듬뿍', race: '좀비 달리기 대회! 좀비가 빨라요', time: '시간 안에 좀비 탑을 무너뜨려요!',
  cap10: '용은 10마리까지만 나갈 수 있어요', cap8: '용은 8마리까지만 나갈 수 있어요', lock: '화로가 고장 났어요 — 화로를 못 올려요',
  rush: '보스가 줄줄이 나와요! 보스 러시', wind: '맞바람 — 용들이 느리게 걸어요', fog: '안개 — 멀리 있는 좀비가 잘 안 보여요',
  cost: '비싼 용은 못 나가요 (불씨 300 이하만)', money: '용돈 듬뿍! 불씨를 많이 들고 시작해요', fever: '불꽃 타임이 빨리 와요',
};
const ZART = { chubby: 'cone', shield: 'helmet', bossFat: 'bossGiant' };
const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** cb = { cmd({type,i}), pause(), speed(), exit(), retry(), next() } */
export function createHud(host, { stage, deck, skills, text, speedMax = 2, canAuto = false }, cb) {
  const root = h('div', 'idg-hud'); host.appendChild(root);
  /* 위 */
  const top = h('div', 'idg-top'); root.appendChild(top);
  const pauseB = h('button', 'idg-btn idg-pause', '⏸'); pauseB.type = 'button'; pauseB.onclick = () => cb.pause();
  const title = h('div', 'idg-title', `${stage.id} ${stage.name}`);
  const time = h('div', 'idg-time', '0:00');
  const speedB = h('button', 'idg-btn idg-speed', '×1'); speedB.type = 'button'; speedB.onclick = () => cb.speed();
  const money = h('div', 'idg-money'); const moneyN = h('span', 'n', '0'); money.append(h('i', 'idg-ico-ember'), moneyN);
  top.append(pauseB, title, time, speedB, money);
  if (speedMax < 2) speedB.style.visibility = 'hidden';
  const autoB = h('button', 'idg-btn idg-speed idg-auto', '자동'); autoB.type = 'button'; autoB.onclick = () => cb.auto(); if (canAuto) speedB.after(autoB);
  const hp = h('div', 'idg-hp'); root.appendChild(hp);
  const myHp = h('div', 'idg-hp-me'), foeHp = h('div', 'idg-hp-foe');
  hp.append(myHp, foeHp);
  const boss = h('div', 'idg-boss'); const bossFill = h('i'); boss.append(h('span', null, '보스'), h('b', null, '')); boss.lastChild.appendChild(bossFill); root.appendChild(boss);
  const warn = h('div', 'idg-warn', 'WARNING'); root.appendChild(warn);
  /* 미니맵 (기획서 11.1) : ▲ 내 맨 앞 · ▼ 적 맨 앞 · 네모 = 지금 보는 곳. 누르면 그 자리로 */
  const mini = h('div', 'idg-mini'), miniView = h('i', 'view'), miniMe = h('b', 'me', '▲'), miniFoe = h('b', 'foe', '▼');
  mini.append(miniView, miniMe, miniFoe); root.appendChild(mini);
  mini.onpointerdown = (e) => { const r = mini.getBoundingClientRect(); cb.look?.((e.clientX - r.left) / r.width); };
  const tip = h('div', 'idg-tip'); root.appendChild(tip);

  /* 아래 */
  const bot = h('div', 'idg-bot'); root.appendChild(bot);
  const wallet = h('button', 'idg-btn idg-wallet'); wallet.type = 'button'; wallet.onclick = () => cb.cmd({ type: 'wallet' });
  const wLv = h('b', null, 'Lv1'), wCost = h('span', null, '');
  wallet.append(h('i', 'idg-ico-furnace'), wLv, wCost);
  const deckBox = h('div', 'idg-deck' + (deck.length > 5 ? ' two' : ''));
  const dbtn = deck.map((d, i) => {
    const b = h('button', 'idg-btn idg-unit'); b.type = 'button';
    const img = h('img'); img.src = `${AI}${d.id}/head.png`; img.alt = UNITS[d.id]?.name || d.id; img.draggable = false;
    const cost = h('span', 'cost', String(UNITS[d.id]?.cost ?? '')); const cd = h('i', 'cd'); const key = h('em', 'key', String((i + 1) % 10));
    b.append(img, cd, cost, key); b.onclick = () => cb.cmd({ type: 'spawn', i }); deckBox.appendChild(b);
    return { b, cd, ready: true };
  });
  const right = h('div', 'idg-right');
  const sk = skills.map((id, i) => { const b = h('button', 'idg-btn idg-skill', SKILLS[id]?.name || id); b.type = 'button'; b.onclick = () => cb.cmd({ type: 'skill', i }); right.appendChild(b); return b; });
  const rage = h('button', 'idg-btn idg-rage', '포효'); rage.type = 'button'; rage.onclick = () => cb.cmd({ type: 'rage' }); right.appendChild(rage);
  const breath = h('button', 'idg-btn idg-breath'); breath.type = 'button'; breath.onclick = () => cb.cmd({ type: 'breath' });
  const bFill = h('i', 'fill'); breath.append(bFill, h('b', null, '브레스'));
  bot.append(wallet, deckBox, breath);
  root.appendChild(right);   // 스킬 · 포효 = 오른쪽 위 하늘 자리 (전장을 가리지 않게)

  /* 일시정지 · 결과 판 */
  const panel = h('div', 'idg-panel-over'); root.appendChild(panel);
  function showPanel(kind, info = {}) {
    panel.replaceChildren();
    const box = h('div', 'idg-card');
    if (kind === 'pause') box.append(h('h2', null, '일시정지'));
    else if (kind === 'intro') {   /* 스테이지 카드 (기획서 11.4) : 이름 · 기믹 · 오늘의 좀비 · 별 조건 */
      box.append(h('h2', null, `${stage.id} ${stage.name}`));
      if (stage.gim && GIM[stage.gim]) box.append(h('p', 'gim', GIM[stage.gim]));
      const zs = h('div', 'idg-intro-z');
      for (const id of [...new Set(stage.lines.map((l) => l.id))]) { const im = h('img'); im.src = `${AI}${ZART[id] || id}/head.png`; im.alt = ''; im.onerror = () => { im.onerror = null; im.src = `${AI}${ZART[id] || id}/torso.png`; }; zs.appendChild(im); }   // 머리 조각이 없는 좀비(박쥐)는 몸 그림
      box.append(zs, h('p', 'small', `★ 깨면 · ★★ ${stage.star2}초 안 · ★★★ ${stage.star3}초 안`));
    }
    else {
      box.append(h('h2', kind === 'win' ? 'win' : 'lose', kind === 'win' ? '승리!' : '아쉬워요…'));
      if (kind === 'win') { const st = h('div', 'idg-stars'); for (let i = 0; i < 3; i++) { const s = h('span', i < info.stars ? 'on' : '', '★'); s.style.animationDelay = `${0.3 + i * 0.35}s`; st.appendChild(s); } box.appendChild(st); }
      box.append(h('p', null, `${clock(info.t || 0)}${kind === 'win' && info.coins ? ` · 코인 +${fmt(info.coins)}` : ''}${kind === 'win' && info.gems ? ` · 젬 +${info.gems}` : ''}${info.daily ? ' (오늘 첫 승리 +10)' : ''}`));
      if (kind === 'lose' && info.hint) box.append(h('p', 'hint', info.hint));
    }
    const row = h('div', 'idg-row');
    const add = (label, fn, cls = '') => { const b = h('button', 'idg-btn ' + cls, label); b.type = 'button'; b.onclick = fn; row.appendChild(b); };
    if (kind === 'pause') add('계속', () => cb.pause(), 'main');
    if (kind === 'intro') { add('출격!', () => cb.go(), 'main'); add(text.exit, () => cb.exit()); box.appendChild(row); panel.appendChild(box); panel.classList.add('on'); return; }
    if (info.final) box.append(h('p', 'final', '1차 모험 끝! 다음 이야기는 곧! 🐉'));
    if (kind === 'win' && info.hasNext) add('다음 스테이지', () => cb.next(), 'main');
    add('다시 하기', () => cb.retry(), kind === 'lose' ? 'main' : '');
    add(text.exit, () => cb.exit());
    box.appendChild(row); panel.appendChild(box); panel.classList.add('on');
  }

  /* 키보드 */
  const onKey = (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (/^[0-9]$/.test(k)) { const i = k === '0' ? 9 : Number(k) - 1; if (i < deck.length) cb.cmd({ type: 'spawn', i }); }
    else if (k === 'q') cb.cmd({ type: 'wallet' });
    else if (k === ' ') { e.preventDefault(); cb.cmd({ type: 'breath' }); }
    else if (k === 'a') cb.cmd({ type: 'skill', i: 0 });
    else if (k === 's') cb.cmd({ type: 'skill', i: 1 });
    else if (k === 'r') cb.cmd({ type: 'rage' });
    else if (k === 'p') cb.pause();
  };
  window.addEventListener('keydown', onKey);

  return {
    update(S, ui) {
      const p = S.players[0], W = S.D.wallet;
      const lim = S.stage.gim === 'time' ? S.stage.limit : 0;
      time.textContent = lim ? `남은 ${clock(Math.max(0, lim - S.t))}` : clock(S.t); time.classList.toggle('hurry', !!lim && lim - S.t < 20);
      moneyN.textContent = `${fmt(p.money)} / ${fmt(W[p.wl].max * p.B.walletMax)}`;
      myHp.textContent = ` ${fmt(Math.max(0, S.base[0].hp))}`;
      foeHp.textContent = `${fmt(Math.max(0, S.base[1].hp))} `;
      const top1 = p.wl >= W.length - 1;
      wLv.textContent = `Lv${p.wl + 1}`; wCost.textContent = top1 ? 'MAX' : fmt(W[p.wl].cost);
      wallet.classList.toggle('can', !top1 && p.money >= W[p.wl].cost && S.stage.walletLock == null);
      p.deck.forEach((d, i) => {
        const B = dbtn[i]; if (!B) return;
        const cdMax = d.def.cd / p.B.cooldown, left = Math.max(0, p.cd[i]);
        B.cd.style.setProperty('--p', left > 0 ? String(left / cdMax) : '0');
        const ready = left <= 0;
        B.b.classList.toggle('poor', p.money < d.def.cost);
        B.b.classList.toggle('wait', !ready);
        if (ready && !B.ready) { B.b.classList.remove('flash'); void B.b.offsetWidth; B.b.classList.add('flash'); }
        B.ready = ready;
      });
      const bc = Math.min(1, p.breathT / p.breathCharge);
      bFill.style.setProperty('--p', String(bc)); breath.classList.toggle('can', bc >= 1);
      sk.forEach((b, i) => { const s = p.skills[i]; b.disabled = !s || s.left <= 0 || s.cdT > 0; b.dataset.left = s ? s.left : 0; });
      rage.classList.toggle('on', p.rage >= 100);
      const bs = S.boss;
      boss.classList.toggle('on', !!(bs && bs.alive));
      if (bs) bossFill.style.width = `${Math.max(0, bs.hp / bs.maxHp) * 100}%`;
      warn.classList.toggle('on', ui.warn > 0);
      speedB.textContent = `×${ui.speed}`; autoB.classList.toggle('on', !!ui.auto);
      if (ui.mini) {
        const { a, b, cam, w, F } = ui.mini;
        miniMe.style.left = `${(a / F) * 100}%`; miniFoe.style.left = `${(b / F) * 100}%`;
        miniView.style.left = `${(cam / F) * 100}%`; miniView.style.width = `${(w / F) * 100}%`;
      }
      tip.textContent = ui.tip || ''; tip.classList.toggle('on', !!ui.tip); tip.dataset.at = ui.tipAt || '';
      root.classList.toggle('fever', S.t >= S.feverAt);
    },
    showPanel,
    hidePanel() { panel.classList.remove('on'); panel.replaceChildren(); },
    destroy() { window.removeEventListener('keydown', onKey); root.remove(); },
  };
}
