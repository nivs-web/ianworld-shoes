/**
 * S50 이안 드래곤 게임 **로비** — 세로 화면. (2026-11-10, 이안오락실 7번째 게임)
 *
 * 대표님 결정 : «로비만 세로, 게임을 실행하면 가로 모드로 바뀐다 · 세로 모드는 없다 ·
 * 신발을 찾아서 · 드래곤 스트라이커처럼 로비가 있었으면» (기획서 11.0).
 * 그래서 드래곤 · 줄넘기 로비와 같은 순서다 : 제목 / 상태창 / 버튼들 / 큰 시작 버튼 / 오락실 복귀.
 * 「모험 시작」 을 누르면 가로 게임 화면(`IanDragonGame.js`)으로 간다 — 지도 · 둥지 · 부화장 · 전투는 전부 그 안(가로).
 */

import S from '../config/strings.ko.js';
import { el, button, backButton, screen, presentOverlay, toast } from './ui.js';
import { get as getProfile } from '../services/profile.js';
import Portal from './Portal.js';
import { lazyScreen } from './lazyScreen.js';
import * as G from '../services/iandragonGame.js';
import { enterFullscreen, exitFullscreen, isFullscreen } from '../core/fullscreen.js';
import { getSettings } from '../audio/audio.js';
import * as Sfx from '../audio/sfx.js';
import '../styles/iandragon-game.css';
import '../styles/idg-lobby2.css';   /* 새 로비 (11/12) — 위 파일 끝은 다른 사람이 자동으로 고치므로 따로 */
import { soundPanel, soundPrefs, applySound, bgmStyleNow } from '../games/iandragon_game/render/soundPrefs.js';
import { lockLobby } from '../games/iandragon_game/render/rot.js';   /* 로비화면 방향 (기본 세로 · 음향 설정 «로비화면» · 11/12 서브창2) */
import * as IdgAudio from '../games/iandragon_game/audio/index.js';
import { lobbyScene } from './idgLobbyFun.js';
/* 재미 요소 층 (촛불 · 등불 · 창문 · 호박 · 무덤 좀비 · 마녀 순환 — 다른 보조의 lobbyFx.js · idg-lobby-fx.css). 파일이 아직 없어도 터지지 않게 glob (없으면 빈 묶음) */
const FXMOD = import.meta.glob(['./lobbyFx.js', '../styles/idg-lobby-fx.css']);
import { showNest } from './idgNest.js';
import { showHatch } from './idgHatch.js';
import { showCodex } from './idgCodex.js';
import { dressedCanvas, headCanvas } from './idgDressed.js';
import { installIdgFrame } from './idgFrame.js';
installIdgFrame();   /* 모든 창 고정 틀 (제목 · 단추 고정 · 가운데만 스크롤) */
import { makeLoads, stageByNo } from '../games/iandragon_game/render/battleSetup.js';
import { showLab } from './idgLab.js';
import { showMulti } from './idgMulti.js';
import { showShop } from './idgShop.js';
import { showLook } from './idgLook.js';
import { showHall } from './idgHall.js';
import { TITLES, titleOf, decodeLook } from '../games/iandragon_game/data/looks.js';
import { fetchIdgBoard } from '../services/idgRank.js';
import { weekKey } from '../games/iandragon_game/render/battleSetup.js';
import { currentUser } from '../services/auth.js';
import { DIFF, hardOpen } from '../games/iandragon_game/render/battleSetup.js';
import { isOn } from '../services/switches.js';
import { MUST, SONGS, EDM_NOTE, EDM_MUST, EDM_SONGS } from '../games/iandragon_game/data/musicCredits.js';
import { showQuests } from './idgQuests.js';
import { claimable } from '../services/iandragonQuests.js';
import { OPEN_AT } from '../services/iandragonHatch.js';

const IanDragonGame = lazyScreen(() => import('./IanDragonGame.js'), S.idgTitle);

function showHow() {
  Sfx.play('sfx_menu_select');
  const box = el('div.dialog.idg-how', { onclick: (e) => e.stopPropagation() }, [
    el('div.idg-how-title', S.idgLobbyHow),
    el('ol.idg-how-steps', null, S.idgLobbyHowSteps.map((t) => el('li', t))),
    /* 아래 고정 줄에 둘 다 (11/12 · 가로에서 «알겠어요» 가 스크롤 아래로 숨던 것) — 확인 = 초록 · 보조 = 보라 */
    el('div.idg-row.idg-foot2', null, [button('알겠어요', () => close(), { primary: true, class: 'green' }), button('음악 출처', () => { close(); showCredits(); })]),
  ]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}

/** 음악 출처 (겜팀장 녹음 · CC BY 3.0 곡은 게임 안 표기 필수) — «하는 법» 창 아래 단추 */
function showCredits() {
  Sfx.play('sfx_menu_select');
  const box = el('div.dialog.idg-how.idg-credits', { onclick: (e) => e.stopPropagation() }, [
    el('div.idg-how-title', '음악 출처'),
    el('p.idg-credits-small', '배경음악은 저작권이 끝난 클래식 곡의 공개 녹음입니다.'),
    ...MUST.map((t) => el('p.idg-credits-must', t)),
    el('div.idg-credits-list', null, [
      ...SONGS.map((x) => el('p', `${x.k.split(' — ')[1] || x.k} · ${x.title} — ${x.by} · ${x.perf} · ${x.lic}`)),
      /* 오케스트라 EDM 편곡 (음향 설정 «EDM») — CC-BY-SA · CC-BY 표기 의무 */
      el('p.idg-credits-h', '오케스트라 EDM 편곡'), el('p', EDM_NOTE), ...EDM_MUST.map((t) => el('p.idg-credits-must', t)), el('p', `곡 : ${EDM_SONGS}`),
    ]),
    button('닫기', () => close()),   /* 닫기 = 보라 (키트 규칙 · 빨강은 앞으로 가는 행동만) */
  ]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}

/** 스테이지 고르기 (B4 최소판 · 2026-11-11 야간) — 월드 1~5 × 10판 · 별 · 잠금(깬 다음 판까지만 열림) */
const WORLD_NAMES = ['달밤 초록 언덕', '부글부글 화산', '뭉게구름 하늘섬', '꽁꽁 얼음골', '덜컹덜컹 쇠 광산', '으스스 유령 묘지', '모래바람 사막', '끈적끈적 독 늪', '반짝반짝 수정 동굴', '좀비 드래곤 성'];
function showStages(onPick) {
  Sfx.play('sfx_menu_select');
  const g = G.idg(), open = Math.min(100, g.cleared + 1);
  let w = Math.min(10, Math.floor((open - 1) / 10) + 1);
  const grid = el('div.idg-stage-grid'), tabs = el('div.idg-world-tabs'), name = el('div.idg-world-name'), diffRow = el('div.idg-diff-row'), diffNote = el('div.idg-diff-note');
  const diffOn = isOn('zdOpt', 'diff');
  function draw() {
    tabs.replaceChildren(...WORLD_NAMES.map((_, i) => el('button.idg-world-tab' + (i + 1 === w ? '.on' : ''), { type: 'button', disabled: i * 10 + 1 > open, onclick: () => { w = i + 1; draw(); } }, [String(i + 1)])));
    name.textContent = `월드 ${w} · ${WORLD_NAMES[w - 1]}`;
    /* 난이도 (운영자 스위치 · 어려움은 이 월드를 다 깨야 열림) */
    const cur = G.idg().diff, hOk = hardOpen(w * 10, g);
    diffRow.replaceChildren(...(diffOn ? Object.entries(DIFF).map(([k, d]) => el('button.idg-diff-btn' + (cur === k ? '.on' : '') + '.' + k, { type: 'button', disabled: k === 'hard' && !hOk, title: k === 'hard' && !hOk ? '이 월드를 다 깨면 열려요' : '', onclick: () => { G.saveIdg({ diff: k }); draw(); } }, [d.name, ...(k === 'hard' && !hOk ? [el('img.idg-lock-ico', { src: `${AL}ico_lock.png`, alt: '잠김' })] : [])]   /* 🔒 글자 → 도트 자물쇠 */)) : []));
    diffNote.textContent = diffOn && !hOk ? `어려움(좀비 1.35배 · 붉은 별)은 월드 ${w}의 10판을 모두 깨면 열려요.` : '';   /* 대표님 «어려움은 왜 잠겨 있고 언제 풀리나» */
    const hard = diffOn && cur === 'hard' && hOk;
    grid.replaceChildren(...Array.from({ length: 10 }, (_, k) => {
      const no = (w - 1) * 10 + k + 1, st = Number((hard ? g.hardStars : g.stars)[no - 1]) || 0, locked = no > open;
      return el('button.idg-stage-btn' + (locked ? '.locked' : '') + (k === 9 ? '.boss' : ''), { type: 'button', disabled: locked, onclick: () => { close(); onPick(no); } }, [
        el('b', `${w}-${k + 1}`), el('span.idg-stage-stars' + (hard ? '.red' : ''), { 'data-px': '1' }, locked ? [el('img.idg-lock-ico', { src: `${AL}ico_lock.png`, alt: '잠김' })] : [0, 1, 2].map((i) => el('img.idg-star-ico', { src: `/assets/iandragon_game/ai/result/star_${i < st ? 'on' : 'off'}.webp`, alt: i < st ? '★' : '☆' }))),   /* ★☆ 글자 → 결과 창 별 그림 */
      ]);
    }));
  }
  draw();
  const box = el('div.dialog.idg-stages', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', '스테이지 고르기'), tabs, name, diffRow, diffNote, grid, button('닫기', () => close())]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}

/* 로비 그림 (겜부장 보조가 제미나이로 만든다 · 파일이 없으면 그림만 숨기고 글자로) */
const UI = '/assets/iandragon_game/ui/lobby/';
const AL = '/assets/iandragon_game/ai/lobby/';   // 보조 제미나이 2차 (2026-11-11) — 메뉴 아이콘 · 판
const ICO = { stage: 'ico_stages', nest: 'ico_nest', hatch: 'ico_hatch', lab: 'ico_lab', quest: 'ico_quests', codex: 'ico_codex', how: 'ico_how', coop: 'ico_coop', raid: 'ico_raid', more: 'ico_more', sound: 'ico_sound', music: 'ico_music' };
const hideBad = (e) => { e.target.style.display = 'none'; };
function tile(key, label, fn, locked = false, dot = false) {
  return el('button.idg-tile' + (locked ? '.locked' : '') + (dot ? '.dot' : ''), { type: 'button', onclick: () => { Sfx.play('sfx_menu_select'); fn(); } }, [
    el('img', { src: `${UI}icon_${key}.png`, alt: '', onerror: (e) => { if (ICO[key] && !e.target.dataset.f) { e.target.dataset.f = 1; e.target.src = `${AL}${ICO[key]}.png`; } else hideBad(e); } }), el('span', label),
  ]);
}
/** «더보기» 창 : 도감 · 게임하는 법 · 음향 설정 · 명예의 전당 · 음악 출처 */
function showMore(go = {}) {
  const pick = (fn) => () => { close(); fn(); };
  const box = el('div.dialog.idg-more', { onclick: (e) => e.stopPropagation() }, [
    el('div.idg-how-title', '더보기'),
    el('div.idg-menu', null, [
      tile('codex', '도감', pick(() => showCodex(go))),
      tile('how', '게임하는 법', pick(showHow)),
      tile('sound', '음향 설정', pick(showSound)),
      tile('hall', '명예의 전당', pick(showHall)),
      tile('music', '음악 출처', pick(showCredits)),
    ]),
    button('닫기', () => close()),
  ]);
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}
/** «음향 설정» 창 (대표님 «설정 대신 음향 설정») — 전투 일시정지와 같은 판 */
function showSound() {
  Sfx.play('sfx_menu_select');
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  /* 전체 소리를 다시 켜면 로비 곡도 다시 (끄면 setMuteAll 이 곡을 멈춘다) */
  const box = el('div.dialog.idg-soundset', { onclick: (e) => e.stopPropagation() }, [el('div.idg-how-title', '음향 설정'), soundPanel(mk, ({ mute }) => { if (mute === false) lobbyMusic(); }), button('닫기', () => close())]);   /* 키트 판 · 닫기 = 보라 */
  const overlay = el('div.dialog-overlay', { onclick: () => close() }, [box]);
  const close = presentOverlay(overlay);
}

/*
 * 로비 배경음악 (11/12 대표님 «무섭고 으스스한 오케스트라») — 곡 바꾸기는 LOBBY_SONG 한 곳만 (music/music.json 의 키).
 *  지금 = 'lobby' (겜팀장 · 베를리오즈 «마녀들의 밤의 꿈» · music/lobby_lt) · 고리로 계속 돈다(music.json loop).
 *  음향 설정의 «전체 소리» 를 끄지 않는 한 늘 나온다 (크기 0 이면 돌아도 안 들림 · 전투 battleSound 와 같은 규칙).
 *  브라우저가 자동재생을 막으면 소리 장치가 잠든 채라 → 첫 터치 때 깨우고 다시 부른다 (같은 곡이면 처음부터 다시 틀지 않음).
 */
const LOBBY_SONG = 'lobby';
function lobbyMusic() {
  try {
    if (soundPrefs().mute) return;
    IdgAudio.init(); applySound(); IdgAudio.setBgmStyle(bgmStyleNow());
    IdgAudio.bgm(LOBBY_SONG);
  } catch { /* 소리 실패는 화면과 무관 */ }
}

/** 새로 얻은 칭호 알림 (꾸미기에서 달 수 있음) */
function checkTitles() {
  const g = G.idg(), got = TITLES.filter((t) => t.has(g)).map((t) => t.id), fresh = got.filter((id) => !g.tGot.includes(id));
  if (!fresh.length) return;
  G.saveIdg({ tGot: [...g.tGot, ...fresh] });
  Sfx.play('sfx_purchase');
  toast(`칭호 획득! «${TITLES.filter((t) => fresh.includes(t.id)).map((t) => t.name).join(' · ')}» — 꾸미기에서 달 수 있어요`, 3200);
}
/** 지난주 주간 습격 1~3위 → 금 · 은 · 나무 테두리 (META 5장 · 한 주에 한 번 · 서버 순위를 보고 기기에서 준다) */
async function checkRaidFrame(onGot) {
  const prev = weekKey(Date.now() - 7 * 864e5), g = G.idg(), uid = currentUser()?.uid;
  if (!uid || g.frameW >= prev.idx) return;
  const r = await fetchIdgBoard('raid', 50).catch(() => null);
  if (!r?.ok) return;
  const rows = r.rows.filter((x) => Math.floor((x.raid || 0) / 100) === prev.idx).sort((a, b) => (b.raid % 100) - (a.raid % 100));
  const place = rows.findIndex((x) => x.uid === uid);
  const frame = ['gold', 'silver', 'wood'][place];
  G.saveIdg({ frameW: prev.idx, ...(place >= 0 && place < 10 ? { weekTop: prev.idx } : {}), ...(frame ? { owned: [...G.idg().owned, `frame:${frame}`] } : {}) });
  if (frame) { Sfx.play('sfx_purchase'); toast(`지난주 주간 습격 ${place + 1}위! ${frame === 'gold' ? '금' : frame === 'silver' ? '은' : '나무'} 테두리를 받았어요`, 3600); onGot?.(); }
}

export default function IanDragonGameLobby(nav) {
  setTimeout(checkTitles, 900);
  { const rj = G.takeRejoin(); if (rj) setTimeout(() => showMulti((room) => { G.pickNet(room); start(room.stageNo); }, rj), 300); }   // 멀티 «한 판 더»
  setTimeout(() => checkRaidFrame(() => nav.refresh?.()), 1500);
  setTimeout(() => IanDragonGame.prefetch?.(), 1200);   // 한가할 때 게임 코드를 미리 받아 둔다
  /* 다음 판 전투 그림(배경 · 성 · 리더 · 덱 용 · 이 판 좀비 부품)도 로비에 있는 동안 뒤에서 받아 둔다 (11/12 겜팀장 실측 부탁 1) */
  setTimeout(() => { try {
    const g = G.idg(), st = stageByNo(Math.min(100, (g.cleared || 0) + 1)), ld = makeLoads(st, g);
    const ids = [ld.loads?.[0]?.leader, ...(ld.deck || []).map((d) => d.id), ...new Set((st.lines || []).map((l) => l.id)), 'kkomul', 'walker'].filter(Boolean);
    import('../games/iandragon_game/render/prefetch.js').then((P) => P.prefetchBattle({ world: st.w || 1, ids }))   /* 그림 먼저 → 다 받은 뒤 소리(그 월드 곡 · 덱 이름 · 출격 말 · 좀비 효과음 · 겜팀장 audio/prefetch.js) */
      .then(() => import('../games/iandragon_game/audio/prefetch.js')).then((S) => S.prefetchSounds({ world: st.w || 1, arts: (ld.deck || []).map((d) => d.id) })).catch(() => {});
  } catch { /* */ } }, 2200);
  /* 타이틀 콜 «좀비와 드래곤!» (겜팀장 음성 · 오락실 효과음 설정을 따른다) */
  if (getSettings().sfxEnabled !== false) import('../games/iandragon_game/audio/index.js').then((A) => { A.init(); setTimeout(() => A.voice('title'), 300); }).catch(() => {});
  /* 로비 곡 : 들어오면 바로 · 자동재생이 막혔으면 첫 터치에서 (떠나면 멈춤 — 전투는 자기 월드 곡, 오락실은 조용히) */
  const kick = () => lobbyMusic();
  document.addEventListener('pointerdown', kick, { capture: true });
  const leave = () => { document.documentElement.classList.remove('idg-lobby-on'); killLive(); document.removeEventListener('pointerdown', kick, { capture: true }); try { IdgAudio.stopBgm(); } catch { /* */ } };

  /**
   * 「모험 시작」 — 전체화면은 클릭 핸들러 안에서 곧바로 요청해야 받아 준다(await 먼저 금지).
   * 가로 잠금은 전체화면이어야 먹으므로 게임 화면이 그 뒤에 건다.
   */
  function start(stageNo) {
    Sfx.play('sfx_menu_select');
    enterFullscreen();
    G.pickStage(typeof stageNo === 'number' ? stageNo : null);
    nav.push(IanDragonGame);
  }
  /* 가로 로비 왼쪽 위 «전체 화면» 단추 (11/12 대표님 · 프로필 얼굴 아래 · 모양 = idg-subwin.css .idg-lfs · 세로에선 숨김)
   *  전체 화면 API 가 없는 곳(아이폰 = 웹킷)이나 막힌 곳(허락 없는 iframe)은 숨김 · 누르는 순간 바로 요청(await 먼저 금지) */
  function lobbyFs() {
    const de = document.documentElement, ok = !!(de.requestFullscreen || de.webkitRequestFullscreen) && document.fullscreenEnabled !== false;
    const b = el('button.idg-lfs', { type: 'button', 'aria-label': '전체 화면', title: '전체 화면', onclick: () => { Sfx.play('sfx_menu_select'); if (isFullscreen()) exitFullscreen(); else enterFullscreen(); } });
    b.hidden = !ok; b.classList.toggle('on', isFullscreen());
    const upd = () => { if (!b.isConnected) { document.removeEventListener('fullscreenchange', upd); document.removeEventListener('webkitfullscreenchange', upd); return; } b.classList.toggle('on', isFullscreen()); };
    document.addEventListener('fullscreenchange', upd); document.addEventListener('webkitfullscreenchange', upd);
    return b;
  }

  /*
   * 가로 로비 (11/11 대표님 · 기획 IAN_DRAGON_LOBBY_ORIENTATION_PLAN.md 2장) : 같은 단추 · 같은 순서, 배치만 CSS 로 바꾼다.
   *  위 띠 = 짧은 배너(보조 banner_wide) + 상태판 · 왼쪽 = 리더 무대(stage_land + 리더 몸 그림, 누르면 이름 외침) · 오른쪽 = 모험 시작 + 2×2 · 아래 = 작은 아이콘 줄.
   *  html.idg-lobby-on : 로비가 떠 있는 동안 몸통 폭(오락실 450)을 화면 전체로 (가로에서만 · CSS).
   */
  const leaderOf = (g) => { try { return makeLoads(stageByNo(Math.min(100, (g.cleared || 0) + 1)), g).loads[0].leader || 'novart'; } catch { return 'novart'; } };
  /* 내가 꾸민 리더 드래곤 (대표님 11/11 «왕관을 썼으면 왕관, 목도리를 골랐으면 목도리») — 누르면 이름 외침 + 깡충 */
  function myDragon(tag, g, cls, opt) {
    const ld = leaderOf(g);
    const box = el(tag, { type: 'button', 'aria-label': '내 리더 드래곤',
      onclick: () => { box.classList.remove('hop'); void box.offsetWidth; box.classList.add('hop'); import('../games/iandragon_game/audio/index.js').then((A) => { A.init(); A.voice(`name/${ld}`); }).catch(() => {}); } });
    /* 살아 있는 용 (11/12 대표님) : 전투에서 서 있을 때와 같은 부품 움직임(rig idle · 숨쉬기 · 날개 · 꼬리 · 깜박) — 모든 용 공통.
       작은 Pixi 캔버스가 안 되면(WebGL 없음 등) 예전처럼 꾸민 정지 그림 + 약한 숨쉬기 */
    const still = (e) => { if (e?.message !== 'stale') dressedCanvas(ld, g.look, opt).then((c) => { c.className = cls; box.appendChild(c); }).catch(() => {}); };
    liveRig(ld, g.look, opt).then((app) => { app.canvas.className = cls + ' live'; box.appendChild(app.canvas); }).catch(still);
    return box;
  }
  /** 리더 rig 를 작은 Pixi 캔버스에 (전투 battleView 의 wearRig · wear 와 같은 방법으로 모자 · 목 장식을 붙인다) — 발 = 캔버스 아래 가운데 */
  let liveApp = null, liveGen = 0;   // liveGen : 다시 그리기 · 화면 떠남이면 늦게 끝난 옛 캔버스를 버린다
  const killLive = () => { liveGen++; const a = liveApp; liveApp = null; try { a?.destroy(true, { children: true }); } catch { /* */ } };
  async function liveRig(ld, look, { W = 420, H = 330, pad = 3 } = {}) {
    killLive(); const my = liveGen;
    const [{ Application, Assets, Container, Sprite }, { loadRig, createRigged }] = await Promise.all([import('pixi.js'), import('../games/iandragon_game/render/rig.js')]);
    const B = '/assets/iandragon_game/';
    const [data, Wr] = await Promise.all([loadRig(ld), fetch(`${B}ai/meta/wear.json`).then((r) => r.json()).catch(() => null)]);
    const lk = decodeLook(look || ''), L = Wr?.leaders?.[ld], hk = 'hat_' + lk.hat, nk = 'neck_' + lk.neck;
    const wt = (f) => Assets.load(B + f).then((t) => { t.source.scaleMode = 'nearest'; return t; }).catch(() => null);
    const hatE = lk.hat && Wr?.items?.[hk] && L?.hat?.[hk];
    let rd = data;
    if (hatE?.head) { const tex = { ...data.tex }; for (const [n, f] of Object.entries(hatE.head)) { const t = await wt(f); if (t) tex[n] = t; } rd = { rig: data.rig, tex }; }   // 덮는 모자 = 모자용 머리
    const R = createRigged(rd, 1, 1); R.set('idle');
    const body = R.root.children[0], idx = (n) => data.rig.parts.findIndex((q) => q.n === n);
    const head = body.children[idx('head')], torso = body.children[idx('torso')], follow = [];
    if (hatE && head) { const t = await wt(Wr.items[hk].file); if (t) { const sp = new Sprite(t); sp.position.set(hatE.x, hatE.y); head.addChild(sp); } }
    const it = lk.neck && L && Wr?.items?.[nk];
    if (it && torso) {
      const at = it.layer === 'behind' ? L.nape : L.neck;
      const mk = async (f) => { const t = await wt(f); if (!t) return null; const sp = new Sprite(t); sp.anchor.set(it.anchor[0], it.anchor[1]); sp.position.set(at.x, at.y); return sp; };
      const behind = async (f) => { const sp = await mk(f); if (!sp) return; const bx = new Container(); bx.addChild(sp); body.addChildAt(bx, body.getChildIndex(torso)); follow.push([bx, torso]); };
      if (it.layer === 'split') { const fr = await mk(it.files.front); if (fr) torso.addChild(fr); await behind(it.files.back); } else await behind(it.file);
    }
    R.update(0); for (const [bx, t] of follow) bx.position.copyFrom(t.position);
    const b = R.root.getLocalBounds(), up = -b.y, half = Math.max(-b.x, b.x + b.width);
    const k = Math.min((H - pad * 2) / up, (W / 2 - pad) / half) * 0.94;   // 날개를 펄럭여도 안 잘리게 6% 여유
    R.root.scale.set(k * R.root.scale.x, k * R.root.scale.y); R.root.position.set(W / 2, H - pad);   // 발(rig 원점) = 아래 가운데 = 무대 한가운데
    const app = new Application();
    await app.init({ width: W, height: H, backgroundAlpha: 0, antialias: false, resolution: 1, autoDensity: false, preference: 'webgl' });
    if (my !== liveGen) { app.destroy(true, { children: true }); throw new Error('stale'); }
    app.stage.addChild(R.root);
    app.ticker.maxFPS = 30;
    app.ticker.add((tk) => { R.update(Math.min(0.1, tk.deltaMS / 1000)); for (const [bx, t] of follow) bx.position.copyFrom(t.position); });
    liveApp = app;
    return app;
  }
  /*
   * 새 로비 v3 (11/12 대표님이 고른 시안 가로-A · 세로-A) — 진짜 그림 부품 + HTML/CSS (스크린샷 한 장 아님)
   *  배경 = 무대가 그려진 제미나이 배경(bg_land_v2 · bg_port_v2) · 리더 드래곤은 그 돌 무대 한가운데에 선다 (CSS 가 배경 cover 비율로 무대 자리를 계산 · idg-lobby2.css)
   *  가로 : 위 띠(초상 · 칭호 · 닉네임 · Lv · 경험치 | 제목 | 재화) · 왼쪽 2×2 · 오른쪽 세로 5칸 · 무대 아래 카드 + 모험시작 · 파워업 · 왼쪽 아래 이안오락실
   *  세로 : 위 띠 · 제목 · 용 왼쪽 2칸 + 오른쪽 2칸 · 카드 · 모험시작 · 파워업 · 아래 5칸 · 박쥐 날개 긴 «이안오락실로»
   *  움직이는 것 (CSS 만) : 박쥐 떼 · 픽셀 폭죽 · 꾸벅 조는 부엉이 (ai/fun/ 그림 · 움직임 줄이기 설정이면 멈춤)
   */
  const L2 = '/assets/iandragon_game/ai/lobby2/', RES = '/assets/iandragon_game/ai/result/';
  const shop = () => showShop({ idg: G.idg(), save: G.saveIdg, onClose: () => nav.refresh?.() });
  /** 보라 둥근 네모 칸 (그림 + 이름 가운데 · 잠금 = 반투명 + 자물쇠 · 빨간 «!») */
  function stone(key, label, fn, { locked = false, dot = false, src = null } = {}) {
    return el('button.l2-tile' + (locked ? '.locked' : '') + (dot ? '.dot' : ''), { type: 'button', 'aria-label': label, onclick: () => { Sfx.play('sfx_menu_select'); fn(); } }, [
      el('img.l2-ico', { src: src || `${UI}icon_${key}.png`, alt: '', draggable: false, onerror: (e) => { if (!src && ICO[key] && !e.target.dataset.f) { e.target.dataset.f = 1; e.target.src = `${AL}${ICO[key]}.png`; } else hideBad(e); } }),
      el('span.l2-label', label),
      ...(locked ? [el('img.l2-lock', { src: `${AL}ico_lock.png`, alt: '', onerror: hideBad })] : []),
      ...(dot ? [el('img.l2-dot', { src: `${L2}alert.webp`, alt: '!', onerror: hideBad })] : []),
    ]);
  }
  /** 재화 판 (왕관 금화 · 우리 보석) — 금 «+» = 드래곤샵 */
  const money = (cls, icon, n) => el('div.l2-money.' + cls, null, [
    el('img.l2-money-ico', { src: icon, alt: '', onerror: hideBad }), el('b', Number(n || 0).toLocaleString('en-US')),
    el('button.l2-plus', { type: 'button', 'aria-label': '드래곤샵', onclick: () => { Sfx.play('sfx_menu_select'); shop(); } }),
  ]);
  /** 하늘 겹 (어두운 밤 · 달 · 반짝이 별 · 흘러가는 구름 · 박쥐 · 폭죽 · 가끔 마녀) — 앞 겹(성 · 길 · 무대 · 호박) 뒤 */
  const sky = (fwN) => [
    el('i.l2-moon'), ...[1, 2, 3, 4, 5, 6, 7, 8].map((k) => el('i.l2-star.s' + k)),
    el('i.l2-cloud.c1'), el('i.l2-cloud.c2'), el('i.l2-cloud.c3'), el('i.l2-cloud.c4'),
    ...[1, 2, 3].slice(0, fwN).map((k) => el('i.l2-fw.f' + k)),
    /* 마녀 · 박쥐 떼는 lobbyFx.js 가 종류를 돌려 가며 낸다 (두 벌 겹침 정리 11/12) */
  ];
  return {
    onLeave: leave,
    destroy: leave,
    render() {
      const p = getProfile();
      const g = G.idg();
      document.documentElement.classList.add('idg-lobby-on');
      lockLobby(); setTimeout(lockLobby, 0);   /* 로비화면 방향으로 잠금 (전투에서 돌아올 때 전투 화면이 잠금을 푼 뒤에도 다시) */
      /* 결과 창과 같은 글꼴 (Pretendard Variable · 전투 HUD 와 같은 링크 id 라 한 번만 붙는다) */
      if (!document.getElementById('idg-res-font')) document.head.appendChild(Object.assign(document.createElement('link'), { id: 'idg-res-font', rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css' }));
      /* 레벨 (보이기만) : 별 5개마다 1 레벨 · 막대 = 다음 레벨까지 */
      const stars = G.totalStars(g), lv = 1 + Math.floor(stars / 5), xp = (stars % 5) / 5;
      const ttl = titleOf(g.title);
      const face = el('div.l2-face', { 'aria-hidden': 'true' });
      headCanvas(leaderOf(g), g.look, 64).then((c) => { c.className = 'l2-face-c'; face.prepend(c); }).catch(() => {});
      const done = g.cleared >= 100, no = Math.min(100, G.nextStage(g)), got = done ? 3 : Number(g.stars[no - 1]) || 0;
      const back = () => nav.reset(Portal);
      const skyEl = el('div.l2-sky', { 'aria-hidden': 'true', style: `--fwk:${(1.6 - Math.min(1, stars / 60) * 0.8).toFixed(2)}` }, sky(stars >= 40 ? 3 : stars >= 15 ? 2 : 1));
      /* 앞 겹(성 · 길 · 무대) + 부엉이 · 도깨비불 · 장착 깃발 (누를 수 없음 · idgLobbyFun.js) */
      const sceneEl = el('div.l2-scene', { 'aria-hidden': 'true' }, lobbyScene(decodeLook(g.look || '').flag));
      /* 재미 요소 층 = 앞 겹 위 · 용 · UI 아래 (lobbyFx.js 가 채운다 · 좌표는 앞 겹 그림 기준) */
      const fxLayer = el('div.l2-fxlayer', { 'aria-hidden': 'true' });
      FXMOD['../styles/idg-lobby-fx.css']?.().catch(() => {});
      FXMOD['./lobbyFx.js']?.().then((m) => m.mountLobbyFx?.(fxLayer, { land: !matchMedia('(orientation: portrait)').matches })).catch(() => {});
      lobbyMusic();
      const scr = screen(
        el('div.idg-lobby-bg'),
        /* 별을 많이 모을수록 폭죽이 자주 · 많이 (별 0 → 1곳 느리게 · 15개 → 2곳 · 40개 → 3곳 · 빠르기 최대 2배) */
        skyEl, sceneEl, fxLayer,
        /* 리더 드래곤 = 배경 돌 무대 한가운데 (누르면 이름 외침 + 깡충) */
        myDragon('button.l2-dragon', g, 'l2-leader', { fit: true, W: 420, H: 330, pad: 3 }),
        el('header.l2-top', null, [
          /* 프로필 (11/12 대표님 «Lv · 경험치가 얼굴을 가린다») : 얼굴 동그라미는 아무것도 안 덮는다 —
             칭호 리본은 이름 판 위 · Lv 알약은 이름 판 안 왼쪽(이름 옆) · 경험치 막대는 이름 판 아래 (모두 얼굴 오른쪽) */
          el('div.l2-player', null, [
            face,
            el('div.l2-plate', null, [
              ttl ? el('button.l2-ttl', { type: 'button', 'aria-label': `칭호 ${ttl.name}`, onclick: () => { Sfx.play('sfx_menu_select'); toast(`칭호 «${ttl.name}» · 얻는 법 : ${ttl.how}`, 2600); } }, [el('i', '칭호'), el('span', ttl.name)]) : null,
              el('div.l2-name', null, [el('span.l2-lv', { 'aria-label': `레벨 ${lv}` }, [el('small', 'Lv.'), el('b', String(lv))]), el('span.l2-nick', p.nickname || '???')]),
              el('span.l2-xp', { title: `별 ${stars}개 · 다음 레벨까지 ${5 - (stars % 5)}개` }, [el('i', { style: `width:${Math.round(xp * 100)}%` })]),
            ]),
          ]),
          el('div.l2-cur', null, [money('coin', `${L2}coin_round.webp`, g.coins), money('gem', `${UI}icon_gem_v3.png`, g.gems)]),
        ]),
        lobbyFs(),
        el('div.l2-logo', null, [el('img', { src: `${AL}title_logo.webp`, alt: '좀비와 드래곤 ZOMBIE & DRAGON', decoding: 'async' })]),
        el('nav.l2-side', null, [
          g.cleared >= OPEN_AT ? stone('hatch', '부화장', () => showHatch(() => nav.refresh?.())) : stone('hatch', '부화장', () => toast('부화장은 2-5를 깨면 열려요', 2200), { locked: true }),
          stone('coop', '멀티게임', () => showMulti((room) => { G.pickNet(room); start(room.stageNo); })),
          stone('raid', '좀비습격', () => { if ((G.idg().cleared || 0) < 20) { toast('좀비습격은 2-10을 깨면 열려요', 2200); return; } G.pickRaid(); start(); }, { locked: (g.cleared || 0) < 20 }),
          stone('quest', '도전과제', () => showQuests(() => nav.refresh?.()), { dot: claimable(g) > 0 }),
        ]),
        el('div.l2-nextwrap', null, [el('div.l2-next', null, [
          el('b.l2-next-t', done ? '모든 모험 끝!' : S.idgStatNext(G.stageLabel(no))),
          el('div.l2-stars', null, [0, 1, 2].map((k) => el('img', { src: `${RES}star_${k < got ? 'on' : 'off'}.webp`, alt: k < got ? '★' : '☆' }))),
        ])]),
        /* 처음 온 사람 : 박쥐가 «모험시작» 을 가리킨다 */
        ...((g.cleared || 0) === 0 ? [el('div.l2-hint', { 'aria-hidden': 'true' }, [el('i.l2-hint-bat'), el('b', '여기!')])] : []),
        el('div.l2-btns', null, [
          /* 모험시작 = 크고 멋지게 (결과 창 빨간 단추 btn_red3 · 큰 칼 아이콘 · 지나가는 빛줄기 · 살짝 숨쉬기) */
          el('button.l2-btn.red.go', { type: 'button', onclick: () => start() }, [el('img.ico', { src: `${RES}ico_fight.webp`, alt: '', onerror: hideBad }), el('span', S.idgLobbyStart), el('i.l2-shine', { 'aria-hidden': 'true' })]),
          el('button.l2-btn.green', { type: 'button', onclick: () => { Sfx.play('sfx_menu_select'); showNest(() => nav.refresh?.()); } }, [el('span.l2-pico', null, [el('img.ico', { src: `${L2}ico_power_clean.webp`, alt: '', onerror: hideBad })]), el('span', '파워업'), el('i.l2-spark.a', { 'aria-hidden': 'true' }, [el('i')]), el('i.l2-spark.b', { 'aria-hidden': 'true' }, [el('i')])]),
        ]),
        el('nav.l2-bottom', null, [
          stone('stage', '스테이지', () => showStages((n2) => start(n2))),
          stone('lab', '연구소', () => showLab(() => nav.refresh?.())),
          stone('shop', '드래곤샵', shop),
          stone('look', '꾸미기', () => showLook({ idg: G.idg(), save: G.saveIdg, onClose: () => nav.refresh?.() })),
          stone('more', '더보기', () => showMore({ stage: () => showStages((n2) => start(n2)), hatch: () => (G.idg().cleared >= OPEN_AT ? showHatch(() => nav.refresh?.()) : toast('부화장은 2-5를 깨면 열려요', 2200)) })),
        ]),
        /* 박쥐 날개 긴 단추 — 가로 · 세로 모두 «이안오락실로» (11/12 대표님 · 띄어쓰기 없이 여섯 글자) · 화면 왼쪽 아래 끝에 붙음 */
        (() => { const b = backButton('이안오락실로', back); b.className = 'l2-back'; b.setAttribute('aria-label', '이안오락실로 돌아가기'); b.replaceChildren(el('span.l2-back-in', null, [el('span', '이안오락실로')])); return b; })(),
      );
      scr.classList.add('idg-lobby2');
      return scr;
    },
  };
}
