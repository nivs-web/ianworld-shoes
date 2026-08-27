/**
 * 드래곤 스트라이커 — 오락실 이안월드의 2번째 게임.
 *
 * 아래 5,200여 줄은 단일 HTML 이던 시절 그대로다(렌더·물리·보스·사운드 합성).
 * 맨 끝의 「모듈 경계」 만 오락실에 붙이려고 새로 썼다.
 */
import { enterFullscreen, exitFullscreen, isFullscreen, lockLandscape } from '../../core/fullscreen.js';
import { text as koBlit, measure as koMeasure } from '../../core/pixelfont.js';
import { FLAME_PALS } from './items.js';

/**
 * 한글 도트 글자. 이 게임의 자체 글꼴(FONT)은 5x7 아스키뿐이라 한글이 없다.
 * 오락실이 이미 갈무리11 을 도트로 구워 두었으므로(`core/pixelfont.js`) 그걸 빌려 쓴다.
 * `opt.ctx` 로 그릴 대상을 받아 주므로 이 게임 캔버스에도 그대로 찍힌다.
 *
 * ⚠ 여기 적는 한글은 `tools/build-font.mjs` 가 src/ 를 훑어 자동으로 굽는다 —
 *   문구를 고치면 `npm run build` 를 다시 돌려야 그 글자가 나온다. 안 그러면 '?' 로 뜬다.
 */
function ko(ctx, str, x, y, scale, opt){
  koBlit(str, x, y, Object.assign({ ctx, scale }, opt || {}));
}
const KO_H = 11;                   // 갈무리11 — 글자 한 줄 높이(배율 1)
/** 세 자리마다 쉼표. 결과 표의 숫자는 이걸로 찍는다 */
const num = (v) => Number(v || 0).toLocaleString('en-US');

/**
 * ★★ **박스에 맞춰 그린다.** (2026-08-27, 사용자 지적)
 *
 * *"박스 다 깨고 나오고 뭉게짐 (...) 매번 이런식으로 디자인 하는 이유를 전혀 모르겠다"*
 *
 * 지금까지는 글자 배율을 **박스와 상관없이 손으로** 정했다. 그러니 문구가
 * 한 글자만 길어져도(`이어하기 (금화 500)`) 박스를 뚫고 나오고, 눈대중으로
 * 배율을 낮추면 이번엔 딴 데가 헐거워진다.
 *
 * 이제 **들어가는 가장 큰 배율을 골라** 그린다. 문구가 길어지든 짧아지든
 * 박스 안에 있는 것이 보장된다 — 이 종류의 사고가 다시 안 난다.
 */
function koFitScale(str, box, max){
  const availW = box.w - PX*10, availH = box.h - PX*6;
  let s = max;
  while(s > 1 && (koMeasure(String(str), s) > availW || KO_H*s > availH)) s -= 0.5;
  return s;
}
/**
 * ★ **나란히 선 버튼은 글자 크기가 같아야 한다.** (2026-08-27)
 * 각자 알아서 맞추면 문구가 긴 버튼만 글자가 작아져서 **셋이 따로 논다.**
 * 가장 빡빡한 것에 맞춰 전부 같은 배율로 그린다.
 */
function koFitAll(labels, boxes, max){
  let s = max;
  for(let i=0;i<labels.length;i++) s = Math.min(s, koFitScale(labels[i], boxes[i], max));
  return s;
}
function koFitBox(ctx, str, box, max, opt){
  const s = typeof max === 'number' ? koFitScale(str, box, max) : max;
  ko(ctx, str, box.x + box.w/2, Math.round(box.y + (box.h - KO_H*s)/2), s,
     Object.assign({ align:'center' }, opt || {}));
  return s;
}


'use strict';
/* ==================================================================
   DRAGON STRIKER  -  횡스크롤 도트 슈팅 (좌 -> 우 진행)
   Canvas 1280x720 / 고정 타임스텝 60FPS / 단일 HTML 파일 / 외부 리소스 없음

   씬   : 타이틀 -> 옵션 / 캐릭터선택 -> 스테이지선택 -> 게임(+일시정지/결과)
   그래픽: 문자 그리드 도트 스프라이트 + fillRect. 드래곤 10종은 팔레트로 구분,
           불 레벨 1~10 에 따라 형태/크기/파츠가 성장
   전투 : 파이어 블레스(레벨별 두께/관통) / 탄도미사일(선회 후 돌진, 콤보 3-6-9)
           / 필살기 드래곤 뢰(5단계 핵 연출)
   적   : 날개좀비 / 드래곤라이더 / 헤비라이더 / 중간보스 / 최종보스(5패턴)
   무대 : 20 스테이지 4층 패럴랙스 + 날씨(비/눈/낙엽/번개/별)
   사운드: Web Audio 전량 합성 (BGM 3곡 시퀀서 + 효과음 16종)
   ================================================================== */

const BUILD = 'B7';                 // 업로드한 파일이 최신인지 확인용 표식
const GAME_W = 1280, GAME_H = 720;
const PX = 4;                       // 도트 1칸 = 4px. 모든 배경 요소는 이 그리드에 스냅
const COLS = GAME_W / PX;           // 320칸
const snap  = v => Math.round(v / PX) * PX;
const clamp = (v,a,b) => v < a ? a : (v > b ? b : v);
const lerp  = (a,b,t) => a + (b-a)*t;

/* ---------------- 공용 팔레트 ---------------- */
const PAL = {
  fire: ['#fff6c2','#ffd24a','#ffa32e','#ff7a1e','#f0451f','#c81f2e','#8f1230'],
  gold:'#ffd24a', goldDim:'#a3701a', white:'#fdf6e3', dim:'#8a7bb8',
  cyan:'#67e8f9', violet:'#a78bfa', ink:'#160a1e', outline:'#2a0a14'
};

/* ---------------- 색상 유틸 ---------------- */
function hex2rgb(h){ const n = parseInt(h.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function rgb2hex(r,g,b){ return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1); }
function mixHex(a,b,t){
  const A = hex2rgb(a), B = hex2rgb(b);
  return rgb2hex(Math.round(lerp(A[0],B[0],t)), Math.round(lerp(A[1],B[1],t)), Math.round(lerp(A[2],B[2],t)));
}
function rampColor(stops, t){
  t = clamp(t,0,1);
  for(let i=0;i<stops.length-1;i++){
    const a = stops[i], b = stops[i+1];
    if(t >= a.p && t <= b.p){
      const k = (b.p - a.p) < 1e-6 ? 0 : (t - a.p)/(b.p - a.p);
      return mixHex(a.c, b.c, k);
    }
  }
  return stops[stops.length-1].c;
}

/* ---------------- 난수 (시드 고정 / 타일링 안전) ---------------- */
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash1(i, seed){
  let h = Math.imul(i ^ seed, 2654435761);
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/* ==================================================================
   픽셀 폰트 (5x7) - fillRect 로 직접 찍는 도트 폰트
   ================================================================== */
const FONT = {
  A:['01110','10001','10001','11111','10001','10001','10001'],
  B:['11110','10001','10001','11110','10001','10001','11110'],
  C:['01110','10001','10000','10000','10000','10001','01110'],
  D:['11110','10001','10001','10001','10001','10001','11110'],
  E:['11111','10000','10000','11110','10000','10000','11111'],
  F:['11111','10000','10000','11110','10000','10000','10000'],
  G:['01110','10001','10000','10111','10001','10001','01111'],
  H:['10001','10001','10001','11111','10001','10001','10001'],
  I:['11111','00100','00100','00100','00100','00100','11111'],
  J:['00111','00010','00010','00010','00010','10010','01100'],
  K:['10001','10010','10100','11000','10100','10010','10001'],
  L:['10000','10000','10000','10000','10000','10000','11111'],
  M:['10001','11011','10101','10101','10001','10001','10001'],
  N:['10001','11001','11001','10101','10011','10011','10001'],
  O:['01110','10001','10001','10001','10001','10001','01110'],
  P:['11110','10001','10001','11110','10000','10000','10000'],
  Q:['01110','10001','10001','10001','10101','10010','01101'],
  R:['11110','10001','10001','11110','10100','10010','10001'],
  S:['01111','10000','10000','01110','00001','00001','11110'],
  T:['11111','00100','00100','00100','00100','00100','00100'],
  U:['10001','10001','10001','10001','10001','10001','01110'],
  V:['10001','10001','10001','10001','10001','01010','00100'],
  W:['10001','10001','10001','10101','10101','11011','10001'],
  X:['10001','10001','01010','00100','01010','10001','10001'],
  Y:['10001','10001','01010','00100','00100','00100','00100'],
  Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10011','10011','10101','11001','11001','01110'],
  '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'],
  '3':['11111','00010','00100','00010','00001','10001','01110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],
  '5':['11111','10000','11110','00001','00001','10001','01110'],
  '6':['00110','01000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],
  '9':['01110','10001','10001','01111','00001','00010','01100'],
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
  '.':['00000','00000','00000','00000','00000','01100','01100'],
  ',':['00000','00000','00000','00000','01100','01100','01000'],
  ':':['00000','01100','01100','00000','01100','01100','00000'],
  '!':['00100','00100','00100','00100','00100','00000','00100'],
  '?':['01110','10001','00001','00010','00100','00000','00100'],
  '-':['00000','00000','00000','11111','00000','00000','00000'],
  '_':['00000','00000','00000','00000','00000','00000','11111'],
  '/':['00001','00010','00010','00100','01000','01000','10000'],
  '+':['00000','00100','00100','11111','00100','00100','00000'],
  '*':['00000','10101','01110','11111','01110','10101','00000'],
  '(':['00010','00100','01000','01000','01000','00100','00010'],
  ')':['01000','00100','00010','00010','00010','00100','01000'],
  '<':['00010','00100','01000','10000','01000','00100','00010'],
  '>':['01000','00100','00010','00001','00010','00100','01000'],
  '%':['10001','00010','00010','00100','01000','01000','10001']
};
const FONT_W = 5, FONT_H = 7;

function textWidth(text, s, spacing){
  const sp = (spacing === undefined) ? s : spacing;
  return text.length === 0 ? 0 : text.length * (FONT_W*s + sp) - sp;
}

/* 도트 텍스트 출력
   opt : { align, color:'#hex'|fn(row,col,charIdx), outline, shadow, shadowOff, spacing, alpha } */
/* 글자 픽셀을 실제로 찍는 부분. 굽기와 무지개색 경로가 같이 쓴다. */
function paintText(ctx, text, sx, y, s, opt){
  const sp   = (opt.spacing === undefined) ? s : opt.spacing;
  const step = FONT_W*s + sp;
  const each = (cb) => {
    for(let ci=0; ci<text.length; ci++){
      const g  = FONT[text[ci]] || FONT[' '];
      const gx = sx + ci*step;
      for(let r=0; r<FONT_H; r++){
        const row = g[r];
        for(let c=0; c<FONT_W; c++) if(row[c] === '1') cb(gx + c*s, y + r*s, r, c, ci);
      }
    }
  };
  if(opt.shadow){
    const off = (opt.shadowOff === undefined) ? s : opt.shadowOff;
    ctx.fillStyle = opt.shadow;
    each((px,py) => ctx.fillRect(px+off, py+off, s, s));
  }
  if(opt.outline){
    ctx.fillStyle = opt.outline;
    each((px,py) => ctx.fillRect(px-s, py-s, s*3, s*3));
  }
  if(typeof opt.color === 'function'){
    each((px,py,r,c,ci) => { ctx.fillStyle = opt.color(r,c,ci); ctx.fillRect(px,py,s,s); });
  }else{
    ctx.fillStyle = opt.color || PAL.white;
    each((px,py) => ctx.fillRect(px,py,s,s));
  }
}

/* 같은 문구/크기/색 조합은 캔버스에 한 번만 굽고 그 뒤로는 blit 만 한다.
   HUD 한 프레임에 fillRect 를 2200번 쓰던 것이 이 캐시로 거의 사라진다. */
const TEXT_CACHE_MAX = 320;
const _textCache = new Map();
function bakeText(text, s, opt){
  const sp  = (opt.spacing === undefined) ? s : opt.spacing;
  const off = opt.shadow ? ((opt.shadowOff === undefined) ? s : opt.shadowOff) : 0;
  const w   = textWidth(text, s, sp);
  const pad = s;                                    // 외곽선이 사방으로 s 만큼 번진다
  const cw  = Math.max(1, Math.ceil(w + pad*2 + off));
  const ch  = Math.max(1, Math.ceil(FONT_H*s + pad*2 + off));
  const { cv, c } = makeCanvas(cw, ch);
  paintText(c, text, pad, pad, s, opt);
  return { cv, ox: pad, oy: pad, w };
}
/* 매 프레임 값이 바뀌는 숫자용. 문자열 통째로 캐시하면 값이 바뀔 때마다
   새로 구워야 해서 캐시가 오히려 손해다. 글자 단위로 그리면 0~9 열 장이면 끝난다. */
function drawDigits(ctx, str, x, y, s, opt){
  str = String(str);
  const sp = (opt && opt.spacing !== undefined) ? opt.spacing : s;
  const step = FONT_W*s + sp;
  for(let i=0;i<str.length;i++) drawText(ctx, str[i], x + i*step, y, s, opt);
  return str.length*step - sp;
}
function drawText(ctx, text, x, y, s, opt){
  opt = opt || {};
  text = String(text).toUpperCase();
  const sp = (opt.spacing === undefined) ? s : opt.spacing;
  const w  = textWidth(text, s, sp);
  let sx = x;
  if(opt.align === 'center') sx = x - w/2;
  else if(opt.align === 'right') sx = x - w;
  sx = Math.round(sx); y = Math.round(y);

  const oldA = ctx.globalAlpha;
  if(opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;

  if(typeof opt.color === 'function'){
    // 무지개색처럼 매 프레임 색이 바뀌는 건 캐시가 의미 없으니 그대로 찍는다
    paintText(ctx, text, sx, y, s, opt);
  }else{
    const key = text + '|' + s + '|' + sp + '|' + (opt.color || '') + '|'
              + (opt.outline || '') + '|' + (opt.shadow || '') + '|'
              + (opt.shadowOff === undefined ? '' : opt.shadowOff);
    let e = _textCache.get(key);
    if(!e){
      e = bakeText(text, s, opt);
      if(_textCache.size >= TEXT_CACHE_MAX) _textCache.delete(_textCache.keys().next().value);
      _textCache.set(key, e);
    }
    ctx.drawImage(e.cv, sx - e.ox, y - e.oy);
  }
  ctx.globalAlpha = oldA;
  return w;
}

/* ==================================================================
   Phase 9 : 사운드 (Web Audio 로 전부 합성. 외부 파일 없음)
   - BGM 3곡을 스텝 시퀀서로 연주 (베이스/리드/코드/드럼)
   - 효과음은 오실레이터 + 노이즈 버퍼로 즉석 합성
   ================================================================== */
const R_ = -99;                                   // 쉼표

function midiFreq(n){ return 440 * Math.pow(2, (n - 69) / 12); }

/* 32스텝(16분음표) 루프. 숫자는 루트로부터의 반음. */
const BGM_TRACKS = [
  { name:'DRAGON FURY', bpm:172, root:40, swing:0,      // E 마이너 / 질주하는 메탈
    bass:[0,R_,0,0, 0,R_,0,0, 0,R_,0,0, 3,R_,3,3,
          5,R_,5,5, 5,R_,5,5, 3,R_,3,3, 0,R_,0,-2],
    lead:[24,R_,27,31, R_,29,27,R_, 24,R_,27,R_, 31,R_,R_,R_,
          29,R_,27,24, R_,22,24,R_, 27,R_,24,R_, 22,R_,R_,R_],
    chord:[12,R_,R_,R_, R_,R_,R_,R_, 15,R_,R_,R_, R_,R_,R_,R_,
           17,R_,R_,R_, R_,R_,R_,R_, 15,R_,R_,R_, 12,R_,R_,R_],
    kick: '1...1...1...1...1...1...1.1.1...',
    snare:'....1.......1.......1.......1...',
    hat:  '..1...1...1...1...1...1...1...1.',
    leadType:'square', bassType:'sawtooth' },

  { name:'SKY ASSAULT', bpm:146, root:45,               // A 마이너 / 군악 + 신스웨이브
    bass:[0,R_,R_,0, 7,R_,R_,R_, 0,R_,R_,0, 7,R_,R_,R_,
          -2,R_,R_,-2, 5,R_,R_,R_, 3,R_,R_,3, 10,R_,R_,R_],
    lead:[24,28,31,28, 24,R_,R_,R_, 26,29,33,29, 26,R_,R_,R_,
          22,26,29,26, 22,R_,R_,R_, 27,31,34,31, 36,R_,R_,R_],
    chord:[12,R_,16,R_, 19,R_,R_,R_, 12,R_,16,R_, 19,R_,R_,R_,
           10,R_,14,R_, 17,R_,R_,R_, 15,R_,19,R_, 22,R_,R_,R_],
    kick: '1.......1.......1.......1.......',
    snare:'....1...1...1.1.....1...1...1.1.',
    hat:  '1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.',
    leadType:'triangle', bassType:'square' },

  { name:'PIXEL STORM', bpm:154, root:43,               // G / 아케이드 액션
    bass:[0,R_,12,R_, 0,R_,12,R_, 5,R_,17,R_, 5,R_,17,R_,
          7,R_,19,R_, 7,R_,19,R_, 3,R_,15,R_, -2,R_,10,R_],
    lead:[19,R_,22,24, 26,R_,24,22, 19,R_,17,19, 22,R_,R_,R_,
          24,R_,26,27, 29,R_,27,26, 24,R_,22,24, 19,R_,R_,R_],
    chord:[7,R_,R_,R_, 11,R_,R_,R_, 12,R_,R_,R_, 11,R_,R_,R_,
           14,R_,R_,R_, 12,R_,R_,R_, 10,R_,R_,R_, 7,R_,R_,R_],
    kick: '1..1..1.1..1..1.1..1..1.1..1..1.',
    snare:'....1.......1.......1.......1...',
    hat:  '..1...1...1...1...1...1...1...1.',
    leadType:'square', bassType:'square' }
];

const SND = {
  ctx:null, master:null, bgmG:null, sfxG:null, comp:null, noiseBuf:null,
  ready:false, bgmOn:true, sfxOn:true, bgmVol:0.34, sfxVol:0.55,
  bgm:{ idx:0, playing:false, step:0, nextT:0 },
  _cool:{},

  init(){
    if(this.ctx) return this.ready;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return false;
      this.ctx = new AC();
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.knee.value = 20;
      this.comp.ratio.value = 12; this.comp.attack.value = 0.003; this.comp.release.value = 0.25;
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9;
      this.bgmG = this.ctx.createGain(); this.bgmG.gain.value = this.bgmOn ? this.bgmVol : 0;
      this.sfxG = this.ctx.createGain(); this.sfxG.gain.value = this.sfxOn ? this.sfxVol : 0;
      this.bgmG.connect(this.comp); this.sfxG.connect(this.comp);
      this.comp.connect(this.master); this.master.connect(this.ctx.destination);
      const n = Math.floor(this.ctx.sampleRate * 1.5);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for(let i=0;i<n;i++) d[i] = Math.random()*2 - 1;
      this.noiseBuf = buf;
      this.ready = true;
    }catch(e){ this.ready = false; }
    return this.ready;
  },
  /* 브라우저 자동재생 정책상 첫 사용자 입력 이후에만 소리가 난다 */
  resume(){
    if(!this.init()) return;
    if(this.ctx.state === 'suspended') this.ctx.resume();
  },
  setBgmOn(v){ this.bgmOn = v; if(this.bgmG) this.bgmG.gain.value = v ? this.bgmVol : 0; },
  setSfxOn(v){ this.sfxOn = v; if(this.sfxG) this.sfxG.gain.value = v ? this.sfxVol : 0; },

  /* ---------------- 기본 음원 ---------------- */
  tone(freq, t0, dur, type, vol, glideTo, dest){
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(Math.max(20, freq), t0);
    if(glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.008, dur*0.2));
    g.gain.exponentialRampToValueAtTime(0.0006, t0 + dur);
    o.connect(g); g.connect(dest || this.sfxG);
    o.start(t0); o.stop(t0 + dur + 0.03);
  },
  noise(t0, dur, vol, fFrom, fTo, dest, q){
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(Math.max(60, fFrom), t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, fTo), t0 + dur);
    if(q) f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0006, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxG);
    s.start(t0); s.stop(t0 + dur + 0.03);
  },
  /* 같은 소리가 몰릴 때 겹침 방지 */
  _gate(key, ms){
    const now = performance.now();
    if(this._cool[key] && now - this._cool[key] < ms) return false;
    this._cool[key] = now; return true;
  },

  /* ---------------- 효과음 ---------------- */
  sfx(name, a){
    if(!this.ready || !this.sfxOn || this.ctx.state !== 'running') return;
    const c = this.ctx, t = c.currentTime;
    switch(name){
      case 'fire': {                       // 뚜뚜뚜 (레벨이 오를수록 낮고 굵게)
        if(!this._gate('fire', 55)) return;
        const lv = a || 1, k = 1 - (lv-1)/12;
        this.tone(760*k + 120, t, 0.05, 'square', 0.16, 300*k + 90);
        this.noise(t, 0.045, 0.13, 2600*k + 700, 500, null);
        if(lv >= 7) this.tone(96, t, 0.10, 'sawtooth', 0.16, 52);   // 저역 울림
        break;
      }
      case 'hit':                          // 퍽
        if(!this._gate('hit', 40)) return;
        this.noise(t, 0.07, 0.20, 3200, 700);
        this.tone(220, t, 0.06, 'square', 0.10, 110);
        break;
      case 'boomS':                        // 작은 펑
        if(!this._gate('boomS', 45)) return;
        this.noise(t, 0.26, 0.34, 2400, 180);
        this.tone(180, t, 0.22, 'sawtooth', 0.18, 46);
        break;
      case 'boomM':                        // 중형 펑펑 (2연발)
        if(!this._gate('boomM', 70)) return;
        this.noise(t, 0.42, 0.44, 2000, 110);
        this.tone(140, t, 0.34, 'sawtooth', 0.24, 34);
        this.noise(t + 0.09, 0.30, 0.30, 1500, 100);
        break;
      case 'boomL':                        // 대형 연쇄 폭발
        for(let i=0;i<4;i++){
          const d = i*0.11;
          this.noise(t + d, 0.6 - i*0.08, 0.46 - i*0.07, 1800 - i*300, 80);
          this.tone(120 - i*14, t + d, 0.5, 'sawtooth', 0.26 - i*0.04, 28);
        }
        break;
      case 'missile':                      // 쉬우우웅 + 펑
        this.noise(t, 0.42, 0.26, 400, 4200, null, 6);
        this.tone(180, t, 0.34, 'sawtooth', 0.14, 900);
        this.noise(t + 0.02, 0.14, 0.28, 2600, 300);
        break;
      case 'nuke': {                       // 쿠와아앙 (차징 -> 기폭 -> 여운)
        this.noise(t, 0.45, 0.22, 200, 5000, null, 8);          // 빨려들어가는 차징
        this.tone(60, t, 0.45, 'sawtooth', 0.16, 420);
        const b = t + 0.45;
        this.noise(b, 2.2, 0.75, 4000, 60);                     // 기폭
        this.tone(90, b, 1.8, 'sawtooth', 0.42, 22);
        this.tone(45, b, 2.4, 'sine', 0.45, 18);                // 서브 베이스
        for(let i=0;i<7;i++)                                    // 연쇄 폭발
          this.noise(b + 0.25 + i*0.16, 0.5, 0.24, 1600, 90);
        break;
      }
      case 'hurt':                         // 쾅
        this.noise(t, 0.32, 0.42, 1800, 120);
        this.tone(300, t, 0.28, 'sawtooth', 0.24, 60);
        break;
      case 'item':                         // 띠링
        this.tone(midiFreq(84), t, 0.09, 'square', 0.20);
        this.tone(midiFreq(91), t + 0.07, 0.16, 'square', 0.20);
        break;
      case 'levelup':                      // 파워업 상승음
        [72,76,79,84].forEach((n,i) => this.tone(midiFreq(n), t + i*0.06, 0.16, 'square', 0.20));
        break;
      case 'warn': {                       // 보스 사이렌 + 포효
        for(let i=0;i<3;i++){
          this.tone(520, t + i*0.42, 0.34, 'sawtooth', 0.16, 900);
          this.tone(900, t + i*0.42 + 0.17, 0.2, 'sawtooth', 0.12, 520);
        }
        this.tone(70, t + 0.2, 1.1, 'sawtooth', 0.30, 34);      // 드래곤 포효
        this.noise(t + 0.2, 1.1, 0.22, 900, 120);
        break;
      }
      case 'fanfare':                      // 짜라란 팡팡
        [72,76,79,84,88].forEach((n,i) => this.tone(midiFreq(n), t + i*0.10, 0.3, 'square', 0.22));
        for(let i=0;i<4;i++) this.noise(t + 0.55 + i*0.14, 0.34, 0.30, 2200, 140);
        break;
      case 'gameover':
        [72,68,64,59].forEach((n,i) => this.tone(midiFreq(n), t + i*0.20, 0.42, 'triangle', 0.22));
        this.noise(t, 0.9, 0.14, 700, 90);
        break;
      case 'coin':                         // 황금동전 : 짧고 밝은 "칭"
        if(!this._gate('coin', 30)) return;
        this.tone(midiFreq(93), t, 0.045, 'square', 0.13);
        this.tone(midiFreq(100), t + 0.04, 0.09, 'square', 0.12);
        break;
      case 'shield':                       // 쉴드 전개 : 차오르는 배음
        [64,71,76,83].forEach((n,i) =>
          this.tone(midiFreq(n), t + i*0.05, 0.55, 'triangle', 0.15));
        this.noise(t, 0.5, 0.09, 500, 4200);
        break;
      case 'ricochet':                     // 튕겨냄 : 짧은 금속성 "팅"
        if(!this._gate('ricochet', 45)) return;
        this.tone(midiFreq(96), t, 0.05, 'square', 0.12, midiFreq(84));
        this.noise(t, 0.06, 0.07, 5200, 1400);
        break;
      case 'blip':
        if(!this._gate('blip', 40)) return;
        this.tone(midiFreq(79), t, 0.05, 'square', 0.16);
        break;
      case 'confirm':
        this.tone(midiFreq(76), t, 0.07, 'square', 0.20);
        this.tone(midiFreq(83), t + 0.06, 0.14, 'square', 0.20);
        break;
      case 'deny':
        this.tone(160, t, 0.16, 'square', 0.20, 90);
        break;
    }
  },

  /* ---------------- BGM 시퀀서 ---------------- */
  playBgm(i){
    if(!this.init()) return;
    if(i !== undefined) this.bgm.idx = clamp(i, 0, BGM_TRACKS.length-1);
    if(this.bgm.playing) return;
    this.bgm.playing = true;
    this.bgm.step = 0;
    this.bgm.nextT = this.ctx.currentTime + 0.08;
  },
  switchBgm(i){
    const n = clamp(i, 0, BGM_TRACKS.length-1);
    if(n === this.bgm.idx && this.bgm.playing) return;
    this.bgm.idx = n; this.bgm.step = 0;
    if(this.ctx) this.bgm.nextT = this.ctx.currentTime + 0.08;
    this.bgm.playing = true;
  },
  stopBgm(){ this.bgm.playing = false; },

  update(){
    if(!this.ready || !this.bgm.playing || this.ctx.state !== 'running') return;
    const tr = BGM_TRACKS[this.bgm.idx];
    const stepDur = 60 / tr.bpm / 4;                    // 16분음표
    const now = this.ctx.currentTime;
    // 탭이 백그라운드로 갔다 오면 밀린 스텝을 몰아서 내지 않도록 재동기화
    if(this.bgm.nextT < now - 0.5) this.bgm.nextT = now + 0.05;
    const ahead = now + 0.25;
    let guard = 0;
    while(this.bgm.nextT < ahead && guard++ < 64){
      this.scheduleStep(tr, this.bgm.step % 32, this.bgm.nextT, stepDur);
      this.bgm.step++;
      this.bgm.nextT += stepDur;
    }
  },
  scheduleStep(tr, i, t, sd){
    const g = this.bgmG;
    const b = tr.bass[i];
    if(b !== undefined && b !== R_) this.tone(midiFreq(tr.root + b), t, sd*1.7, tr.bassType, 0.26, null, g);
    const l = tr.lead[i];
    if(l !== undefined && l !== R_) this.tone(midiFreq(tr.root + l), t, sd*1.9, tr.leadType, 0.15, null, g);
    const c = tr.chord[i];
    if(c !== undefined && c !== R_){
      this.tone(midiFreq(tr.root + c),     t, sd*3.2, 'triangle', 0.09, null, g);
      this.tone(midiFreq(tr.root + c + 7), t, sd*3.2, 'triangle', 0.07, null, g);
    }
    if(tr.kick[i]  === '1'){ this.tone(120, t, 0.16, 'sine', 0.44, 42, g); this.noise(t, 0.05, 0.16, 900, 120, g); }
    if(tr.snare[i] === '1'){ this.noise(t, 0.14, 0.26, 4200, 900, g); this.tone(220, t, 0.09, 'triangle', 0.10, 160, g); }
    if(tr.hat[i]   === '1'){ this.noise(t, 0.035, 0.10, 9000, 5000, g); }
  }
};

/* ==================================================================
   입력 시스템 (키보드 / 터치 / 게임패드 최소 지원)
   ================================================================== */
/* 키 식별 : 환경마다 keydown 이벤트가 주는 정보가 달라서 3단계로 해석한다.
   - e.code   : 물리 키 위치. 한글/영문 어느 상태여도 동일 (있으면 이게 최선)
   - e.key    : 안드로이드 OTG 키보드 등에서 code 가 비어 오는 경우 대비
   - e.keyCode: 위 둘이 모두 없을 때의 마지막 수단
   안드로이드 크롬 + OTG 키보드에서 Q/E/F 가 안 먹던 원인이 code 누락이었다. */
const KEYCODE_TO_CODE = {
  8:'Backspace', 9:'Tab', 13:'Enter', 16:'ShiftRight', 27:'Escape', 32:'Space',
  37:'ArrowLeft', 38:'ArrowUp', 39:'ArrowRight', 40:'ArrowDown',
  48:'Digit0', 49:'Digit1', 50:'Digit2', 51:'Digit3',
  /* ★ A~Z 를 전부 채운다 (2026-08-27) — 예전에는 열두 개만 있어서
     빠진 키는 한글 상태에서 되살릴 길이 없었다 */
  65:'KeyA', 66:'KeyB', 67:'KeyC', 68:'KeyD', 69:'KeyE', 70:'KeyF', 71:'KeyG',
  72:'KeyH', 73:'KeyI', 74:'KeyJ', 75:'KeyK', 76:'KeyL', 77:'KeyM', 78:'KeyN',
  79:'KeyO', 80:'KeyP', 81:'KeyQ', 82:'KeyR', 83:'KeyS', 84:'KeyT', 85:'KeyU',
  86:'KeyV', 87:'KeyW', 88:'KeyX', 89:'KeyY', 90:'KeyZ',
  114:'F3', 192:'Backquote', 219:'BracketLeft', 221:'BracketRight'
};
const KEYNAME_TO_CODE = {
  arrowleft:'ArrowLeft', arrowright:'ArrowRight', arrowup:'ArrowUp', arrowdown:'ArrowDown',
  escape:'Escape', esc:'Escape', enter:'Enter', ' ':'Space', spacebar:'Space',
  backspace:'Backspace', tab:'Tab',
  q:'KeyQ', e:'KeyE', f:'KeyF', m:'KeyM', p:'KeyP', x:'KeyX', z:'KeyZ',
  w:'KeyW', a:'KeyA', s:'KeyS', d:'KeyD',
  '`':'Backquote', '~':'Backquote', '1':'Digit1', '!':'Digit1',
  '[':'BracketLeft', ']':'BracketRight',
  alt:'AltRight', altgraph:'AltRight', control:'ControlRight', ctrl:'ControlRight',
  shift:'ShiftRight',
  /**
   * ★★ **한글 입력 상태에서도 물리 키 위치를 되찾는다.** (두벌식 전부)
   *
   * *"wsad이런 버튼들은 한영이 잘못되어 있거나 하면 작동 안하는 오류가 있어,
   *   무슨 경우가 있어도 무조건 작동되게 만들어"* (2026-08-27)
   *
   * 화살표·Shift·Alt·Esc 가 멀쩡한 이유는 **IME 가 그 키들은 안 건드리기** 때문이다.
   * 글자 키만 IME 를 지나면서 `e.code` 가 비거나 `keyCode` 가 229(조합 중)로 오고,
   * `e.key` 에는 자모(ㅈ)나 **조합된 음절(주)** 이 실려 온다.
   *
   * 그래서 세 겹으로 막는다:
   *   ① 두벌식 자모 **전부** (예전에는 열아홉 개만 있었다)
   *   ② 쌍자음·이중모음까지
   *   ③ 조합된 음절은 **첫 자음을 뽑아** 되돌린다 (`resolveKeyCode`)
   */
  'ㅂ':'KeyQ', 'ㅃ':'KeyQ', 'ㅈ':'KeyW', 'ㅉ':'KeyW', 'ㄷ':'KeyE', 'ㄸ':'KeyE',
  'ㄱ':'KeyR', 'ㄲ':'KeyR', 'ㅅ':'KeyT', 'ㅆ':'KeyT',
  'ㅛ':'KeyY', 'ㅕ':'KeyU', 'ㅑ':'KeyI', 'ㅐ':'KeyO', 'ㅒ':'KeyO',
  'ㅔ':'KeyP', 'ㅖ':'KeyP',
  'ㅁ':'KeyA', 'ㄴ':'KeyS', 'ㅇ':'KeyD', 'ㄹ':'KeyF', 'ㅎ':'KeyG',
  'ㅗ':'KeyH', 'ㅓ':'KeyJ', 'ㅏ':'KeyK', 'ㅣ':'KeyL',
  'ㅋ':'KeyZ', 'ㅌ':'KeyX', 'ㅊ':'KeyC', 'ㅍ':'KeyV',
  'ㅠ':'KeyB', 'ㅜ':'KeyN', 'ㅡ':'KeyM'
};
/**
 * 조합된 한글 음절의 **첫 자음**. IME 가 'ㅈ' 이 아니라 '주' 를 실어 보내는
 * 기기가 있다 — 그때도 W 라는 것을 알아내야 한다.
 */
const HANGUL_LEAD = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ',
                     'ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
function hangulLeadOf(ch){
  const c = ch.charCodeAt(0);
  if(c < 0xAC00 || c > 0xD7A3) return '';
  return HANGUL_LEAD[Math.floor((c - 0xAC00) / 588)] || '';
}

/**
 * ★★ **두벌식 표를 손으로 적지 않는다.** (2026-08-27)
 *
 * 자모를 하나씩 적으면 **적다가 빠뜨린 것이 그대로 버그**가 된다 (실제로 열아홉 개만
 * 적혀 있어서 절반이 안 먹었다). 자판 순서대로 늘어놓고 **만들어 쓴다.**
 *
 * 한글은 같은 글자가 **두 벌**로 온다 — 호환 자모(ㄱ U+3131)와 조합용 자모(U+1100).
 * 기기마다 어느 쪽을 보낼지 모르므로 둘 다 넣는다.
 */
(function buildHangulKeyMap(){
  const ROWS = [
    ['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP'],
    ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL'],
    ['KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM'],
  ];
  const PLAIN = [
    ['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'],
    ['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'],
    ['ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ'],
  ];
  const SHIFT = [
    ['ㅃ','ㅉ','ㄸ','ㄲ','ㅆ','','','','ㅒ','ㅖ'],
    ['','','','','','','','',''],
    ['','','','','','',''],
  ];
  /* 호환 자모 -> 조합용 자모 (같은 글자의 다른 코드점) */
  const LEAD_C = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const VOWEL_C = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const alt = (ch) => {
    const li = LEAD_C.indexOf(ch);
    if(li >= 0) return String.fromCharCode(0x1100 + li);
    const vi = VOWEL_C.indexOf(ch);
    if(vi >= 0) return String.fromCharCode(0x1161 + vi);
    return '';
  };
  for(let r=0;r<ROWS.length;r++){
    for(let i=0;i<ROWS[r].length;i++){
      for(const ch of [PLAIN[r][i], SHIFT[r][i]]){
        if(!ch) continue;
        KEYNAME_TO_CODE[ch] = ROWS[r][i];
        const a = alt(ch);
        if(a) KEYNAME_TO_CODE[a] = ROWS[r][i];
      }
    }
  }
})();
function resolveKeyCode(e){
  // Alt / Control 은 좌우를 구분해야 하므로 location 을 먼저 본다
  const kc = e.keyCode || e.which || 0;
  if(kc === 18 || e.key === 'Alt' || e.key === 'AltGraph')
    return e.location === 1 ? 'AltLeft' : 'AltRight';
  if(kc === 17 || e.key === 'Control')
    return e.location === 1 ? 'ControlLeft' : 'ControlRight';
  if(kc === 16 || e.key === 'Shift')
    return e.location === 1 ? 'ShiftLeft' : 'ShiftRight';
  const c = e.code;
  if(c && c !== 'Unidentified' && c !== '') return c;
  const raw = e.key || '';
  const k = raw.toLowerCase();
  if(KEYNAME_TO_CODE[k]) return KEYNAME_TO_CODE[k];
  /**
   * ★ 조합된 음절('주')이면 첫 자음('ㅈ')을 뽑아 되돌린다 (2026-08-27).
   * 자모 하나만 보내는 기기는 위에서 이미 걸리고, 여기는 그다음 그물이다.
   */
  if(raw.length === 1){
    const lead = hangulLeadOf(raw);
    if(lead && KEYNAME_TO_CODE[lead]) return KEYNAME_TO_CODE[lead];
  }
  /**
   * ★ `keyCode` 는 **자판 배열과 무관한 물리 위치**다 (2026-08-27).
   * 229 는 "IME 가 조합 중" 이라는 뜻이라 위치 정보가 없다 — 그때는 포기한다.
   * 그 외에는 여기서 거의 다 잡힌다: 한/영이 어느 쪽이든 W 는 늘 87 이다.
   */
  if(kc && kc !== 229 && KEYCODE_TO_CODE[kc]) return KEYCODE_TO_CODE[kc];
  return '';
}

/* ==================================================================
   입력 시스템 (키보드 2인 / 터치 / 게임패드)
   1P : 방향키 + 오른쪽 Alt(미사일) + 오른쪽 Ctrl(필살기)
   2P : WASD + ` (미사일) + 1 (필살기)
   ================================================================== */
const Input = {
  down: new Set(),      // 눌린 상태
  just: new Set(),      // 이번 프레임에 눌림
  /* 키 하나가 여러 동작에 대응할 수 있다 (메뉴 공용 + 플레이어별) */
  KEYMAP: {
    ArrowUp:   ['up','p1up'],    ArrowDown:  ['down','p1down'],
    ArrowLeft: ['left','p1left'],ArrowRight: ['right','p1right'],
    KeyW: ['up','p2up','p2join'],   KeyS: ['down','p2down','p2join'],
    KeyA: ['left','p2left','p2join'],KeyD: ['right','p2right','p2join'],
    Enter:['confirm'], NumpadEnter:['confirm'], Space:['confirm'], KeyZ:['confirm'],
    Escape:['pause'], KeyP:['pause'], Backspace:['back'], KeyX:['back'],
    ShiftRight:  ['p1missile'], AltRight:   ['p1bomb'],
    ShiftLeft:   ['p1missile'], AltLeft:    ['p1bomb'],
    ControlRight:['p1bomb'],    ControlLeft:['p1bomb'],
    KeyQ:['p1missile'], KeyE:['p1bomb'],          // PC 편의를 위한 별칭
    Backquote:['p2missile'], Digit1:['p2bomb'],
    BracketRight:['lvup'], BracketLeft:['lvdown'],
    KeyM:['mute'], KeyF:['fullscreen'], F3:['debug']
  },
  /**
   * ★ **게임패드 세 가지 방식** (2026-08-26, 사용자 지정)
   *
   *   패드 0개 : 키보드 / 터치
   *   패드 1개 : 기본은 1P 전용. **[스틱 나눠 쓰기]** 를 켜면 한 패드로 두 명이 논다 —
   *              오른쪽 스틱+RB/RT 가 1P, 왼쪽 스틱+LB/LT 가 2P.
   *   패드 2개 : 첫째가 1P, 둘째가 2P. 각자 A=미사일 B=핵무기.
   *
   * 표준 배치(`mapping === 'standard'`) 기준 번호다:
   *   버튼 0=A 1=B 2=X 3=Y / 4=LB 5=RB 6=LT 7=RT / 8=View 9=Menu(햄버거)
   *   축   0=왼쪽X 1=왼쪽Y / 2=오른쪽X 3=오른쪽Y
   */
  pads: [null, null],          // 사람별 패드 상태
  padCount: 0,                 // 지금 붙어 있는 패드 수
  splitPad: false,             // 패드 하나를 둘로 갈라 쓰는 중인가
  _prev: [{}, {}],             // 직전 프레임의 버튼 상태 (눌린 순간을 잡으려고)
  padAxis:{ x:0, y:0 },        // 1P 이동 (하위 호환)
  padAxis2:{ x:0, y:0 },       // 2P 이동
  padName: null, _padRef: null,
  taps: 0,                     // 이번 프레임 탭 횟수 (타이틀용)
  pointerHandler: null,        // 씬이 등록하는 포인터 핸들러 {down,move,up}
  lastKey: '',                 // 디버그용 : 마지막으로 인식한 키

  /* 게임패드 진동 (지원하지 않는 패드에서는 조용히 무시) */
  rumble(strong, weak, ms){
    const p = this._padRef;
    if(!p) return;
    try{
      if(p.vibrationActuator && p.vibrationActuator.playEffect)
        p.vibrationActuator.playEffect('dual-rumble',
          { startDelay:0, duration:ms|0, strongMagnitude:strong, weakMagnitude:weak });
      else if(p.hapticActuators && p.hapticActuators[0] && p.hapticActuators[0].pulse)
        p.hapticActuators[0].pulse(strong, ms|0);
    }catch(e){}
  },

  init(canvas){
    on(window, 'keydown', e => {
      SND.resume();                       // 자동재생 정책상 첫 입력에서 오디오 활성화
      const code = resolveKeyCode(e);
      this.lastKey = code || ('?' + (e.keyCode||0));
      /**
       * ★★ **못 알아들었으면 입력칸에서 손을 뗀다.** (2026-08-27, 사용자 지적)
       *
       * *"한글이던 영문이던 대문자던 소문자던 다 작동되게 만들면 되잖아"*
       *
       * 자모 표를 아무리 채워도 못 막는 경우가 하나 남는다 — **글자 입력칸에
       * 포커스가 남아 있으면** IME 가 글자 키를 통째로 삼켜서
       * `code` 도 비고 `keyCode` 도 229(조합 중)로 온다. 우리에게 오는 정보가 없다.
       * 화살표·Shift·Alt·Esc 가 멀쩡한 이유도 이것이다 — IME 는 그 키들을 안 삼킨다.
       *
       * 그래서 **못 알아들은 그 순간 포커스를 떼어 낸다.** 그 한 번은 놓치지만
       * 다음부터는 IME 를 거치지 않으므로 무조건 먹는다. 스스로 낫는다.
       */
      if(!code){
        const a = document.activeElement;
        if(a && a !== document.body &&
           (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)){
          try{ a.blur(); }catch(err){}
        }
      }
      const acts = this.KEYMAP[code];
      if(!acts) return;
      if(acts.indexOf('mute') >= 0 && !e.repeat){ SND.setBgmOn(!SND.bgmOn); SND.setSfxOn(SND.bgmOn); }
      // 전체화면은 반드시 이 이벤트 핸들러 안에서 직접 호출해야 브라우저가 허용한다
      if(acts.indexOf('fullscreen') >= 0 && !e.repeat){ e.preventDefault(); toggleFullscreen(); return; }
      // 브라우저 기본 동작(스크롤, 메뉴, 백스페이스 뒤로가기)을 막는다
      e.preventDefault();
      if(e.repeat) return;
      for(const a of acts){ this.down.add(a); this.just.add(a); }
    });
    on(window, 'keyup', e => {
      const acts = this.KEYMAP[resolveKeyCode(e)];
      if(acts) for(const a of acts) this.down.delete(a);
    });
    on(window, 'blur', () => { this.down.clear(); this.just.clear(); });

    /* --- 포인터(터치/마우스): 캔버스 CSS 좌표 -> 게임 좌표로 변환 --- */
    /**
     * 손가락/마우스 자리를 **게임 판 좌표**로 되돌린다.
     * 세로면 화면이 돌아 있으므로 거꾸로 풀어야 한다:
     *   논리x = GAME_W - 화면y      논리y = 화면x
     */
    /** 캔버스 픽셀 좌표 (UI 는 이 좌표로 그리고 이 좌표로 누른다) */
    const toScreen = e => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * UIW,
               y: (e.clientY - r.top) / r.height * UIH };
    };
    const toGame = e => {
      const r = canvas.getBoundingClientRect();
      const cw = portrait ? PORT_W : GAME_W, ch = portrait ? PORT_H : GAME_H;
      const sx = (e.clientX - r.left) / r.width * cw;
      const sy = (e.clientY - r.top) / r.height * ch;
      if (!portrait) return { x: sx, y: sy };
      if (sceneRotates()) return { x: GAME_W - sy, y: sx };
      const f = MENU_FIT();
      return { x: (sx - f.ox) / f.s, y: (sy - f.oy) / f.s };
    };
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      SND.resume();
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      const p = toGame(e), s = toScreen(e);
      this.taps++;
      /**
       * ★ 마우스인지 손가락인지, 그리고 **화면 좌표**도 같이 넘긴다.
       * 판(월드)은 세로에서 돌아 있지만 UI 는 안 돌아 있으므로,
       * 단추를 누르는 판정은 화면 좌표로 해야 그림과 맞는다.
       */
      if(this.pointerHandler && this.pointerHandler.down)
        this.pointerHandler.down(e.pointerId, p.x, p.y, e.pointerType || 'mouse', s.x, s.y);
    });
    canvas.addEventListener('pointermove', e => {
      if(!this.pointerHandler || !this.pointerHandler.move) return;
      const p = toGame(e), s = toScreen(e);
      this.pointerHandler.move(e.pointerId, p.x, p.y, s.x, s.y);
    });
    const up = e => { if(this.pointerHandler && this.pointerHandler.up) this.pointerHandler.up(e.pointerId); };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  },
  /** 스틱 하나를 데드존 처리해 0~1 로 재정규화 */
  _stick(p, xi, yi, out){
    const ax = p.axes[xi] || 0, ay = p.axes[yi] || 0;
    const d = Math.hypot(ax, ay), DZ = 0.18;
    if(d > DZ){
      const n = Math.min(1, (d - DZ) / (1 - DZ));
      out.x = ax/d * n; out.y = ay/d * n;
    }else{
      out.x = out.y = 0;
    }
  },

  /**
   * 눌린 **순간**만 잡아 동작으로 바꾼다.
   * @param {number} slot 0=1P 1=2P (직전 상태를 사람별로 따로 기억한다)
   */
  _edge(slot, name, nowDown, action){
    const prev = this._prev[slot];
    if(nowDown && !prev[name]) this.just.add(action);
    prev[name] = nowDown;
  },

  /* 게임패드는 프레임당 1회 폴링 */
  pollPad(){
    const raw = navigator.getGamepads ? navigator.getGamepads() : null;
    if(!raw){ this.padCount = 0; return; }
    const list = [];
    for(let i=0;i<raw.length;i++) if(raw[i]) list.push(raw[i]);
    this.padCount = list.length;

    if(!list.length){
      this._padRef = null; this.padName = null;
      this.padAxis.x = this.padAxis.y = 0;
      this.padAxis2.x = this.padAxis2.y = 0;
      this._prev[0] = {}; this._prev[1] = {};
      return;
    }

    this._padRef = list[0];
    if(!this.padName) this.padName = (list[0].id || 'GAMEPAD').slice(0, 22).toUpperCase();
    const held = (p, n) => !!(p.buttons[n] && p.buttons[n].pressed);

    /* ── 메뉴 버튼(햄버거)은 언제나 일시정지 ── */
    this._edge(0, 'menu', list.some(p => held(p, 9)), 'pause');
    this._edge(0, 'view', list.some(p => held(p, 8)), 'back');

    if(list.length >= 2){
      /* ── 패드 두 개 : 한 사람에 하나씩. 각자 A=미사일 B=핵무기 ── */
      this.splitPad = false;
      const [g1, g2] = list;
      this._stick(g1, 0, 1, this.padAxis);
      this._stick(g2, 0, 1, this.padAxis2);
      /* 2P 는 패드를 잡은 것만으로 난입한 것으로 친다 */
      if(held(g2,0)||held(g2,1)||Math.hypot(this.padAxis2.x,this.padAxis2.y) > 0.5)
        this.just.add('p2join');

      this._edge(0, 'a', held(g1,0) || held(g1,5), 'p1missile');   // A 또는 RB
      this._edge(0, 'b', held(g1,1) || held(g1,7), 'p1bomb');      // B 또는 RT
      this._edge(1, 'a', held(g2,0) || held(g2,5), 'p2missile');
      this._edge(1, 'b', held(g2,1) || held(g2,7), 'p2bomb');
      /* 메뉴 조작은 1P 패드가 맡는다 — 둘 다 먹으면 커서가 두 칸씩 뛴다 */
      this._edge(0, 'ok', held(g1,0), 'confirm');
      return;
    }

    const g = list[0];
    if(this.splitPad){
      /**
       * ── 패드 하나를 둘로 갈라 쓴다 ──
       *
       * 오른손잡이 기준으로 **오른쪽 스틱이 1P**, 왼쪽 스틱이 2P 다.
       * 무기는 같은 쪽 어깨로 몬다 — 1P 는 RB/RT, 2P 는 LB/LT.
       *
       * ★ 얼굴 버튼(A/B)은 여기서 **쓰지 않는다.** 오른손 엄지가 오른쪽 스틱을
       *   잡고 있어서 A 를 누르려면 스틱에서 손을 떼야 한다 — 그 순간 1P 가 멈춘다.
       *   어깨 버튼은 검지가 따로 맡으므로 스틱과 동시에 눌린다.
       */
      this._stick(g, 2, 3, this.padAxis);     // 오른쪽 스틱 = 1P
      this._stick(g, 0, 1, this.padAxis2);    // 왼쪽 스틱  = 2P
      this._edge(0, 'rb', held(g,5), 'p1missile');
      this._edge(0, 'rt', held(g,7), 'p1bomb');
      this._edge(1, 'lb', held(g,4), 'p2missile');
      this._edge(1, 'lt', held(g,6), 'p2bomb');
      if(held(g,4)||held(g,6)||Math.hypot(this.padAxis2.x,this.padAxis2.y) > 0.5)
        this.just.add('p2join');
      this._edge(0, 'ok', held(g,0), 'confirm');
      return;
    }

    /* ── 패드 하나, 혼자 : 두 스틱 모두 1P 이동으로 받는다 ── */
    this.splitPad = false;
    this._stick(g, 0, 1, this.padAxis);
    if(!this.padAxis.x && !this.padAxis.y) this._stick(g, 2, 3, this.padAxis);
    this.padAxis2.x = this.padAxis2.y = 0;
    this._edge(0, 'a', held(g,0) || held(g,5) || held(g,4), 'p1missile');
    this._edge(0, 'b', held(g,1) || held(g,7) || held(g,6), 'p1bomb');
    this._edge(0, 'ok', held(g,0), 'confirm');
  },
  /* 플레이어별 이동 벡터 (대각선 정규화). pid 1=방향키, 2=WASD */
  moveVectorFor(pid){
    const pre = pid === 2 ? 'p2' : 'p1';
    let x = 0, y = 0;
    if(this.held(pre+'left'))  x -= 1;
    if(this.held(pre+'right')) x += 1;
    if(this.held(pre+'up'))    y -= 1;
    if(this.held(pre+'down'))  y += 1;
    if(x || y){ const d = Math.hypot(x,y); return { x:x/d, y:y/d }; }
    const pa = pid === 2 ? this.padAxis2 : this.padAxis;
    if(pa.x || pa.y) return { x:pa.x, y:pa.y };
    return { x:0, y:0 };
  },
  moveVector(){ return this.moveVectorFor(1); },
  held(a){ return this.down.has(a); },
  pressed(a){ return this.just.has(a); },
  endFrame(){ this.just.clear(); this.taps = 0; }
};

/* ==================================================================
   Scene Manager (페이드 인/아웃 전환)
   ================================================================== */
class Scene {
  enter(){}  exit(){}  update(dt){}  render(ctx){}
}
/**
 * ★ **결과 화면 자리값.** (2026-08-26, 사용자 지적: "그게 뭐야 덕지덕지")
 *
 * 캔버스는 **세로 720px** 인데 예전 배치는 마지막 줄이 686 까지 내려가 있었다.
 * 제목 9배, 표 4배, 버튼 4배 — 전부 한 뼘씩 크고 줄간격은 54 라 다섯 줄이
 * 316~532 를 먹었다. 그 아래 문구·버튼·안내가 차례로 밀려 화면 끝에 닿았다.
 *
 * 글자를 한 단계씩 줄이고(제목 9->7, 표 4->3, 버튼 4->3) 줄간격을 54->44 로
 * 좁혀 표를 232~408 안에 넣는다. 아래로 문구 476, 버튼 528, 안내 616 —
 * 마지막 줄과 화면 끝 사이에 여백이 남는다.
 *
 * 한곳에 모아 둔 이유: 자리값이 그리는 코드 안에 흩어져 있으면
 * 한 줄을 옮길 때 아래 것들을 같이 못 옮겨서 또 겹친다.
 */
const END_TITLE_Y = 104;
/**
 * ★ **제목과 표 사이를 절반으로.** (2026-08-27, 사용자 지정)
 * 제목을 7 → 4 로 줄이면서 아래가 휑해졌다 — 제목 아래(약 148)와 표 시작(232)
 * 사이가 84px 이었다. 42px 로 좁힌다. 표 아래 것들은 표 길이에서 계산하므로
 * 여기만 바꾸면 화면 전체가 같이 올라온다.
 */
const END_ROW_Y   = 190;
/**
 * 줄간격. 줄이 많아지면 좁힌다 — 안 그러면 일곱 줄짜리(클리어 + 무피격 + 합산)가
 * 화면 아래로 넘친다. 아래 것들이 전부 표 끝에서 계산되므로 여기만 맞으면 된다.
 */
const END_ROW_GAP = 44, END_ROW_GAP_TIGHT = 38;
const END_LABEL_X = 452;                     // 이름 (왼쪽 정렬)
const END_NUM_R   = 828;                     // 숫자가 끝나는 자리 (오른쪽 정렬)
/* 단위(점·마리·초·개)는 뺐다 — 없어도 무슨 숫자인지 보면 안다 (2026-08-27, 사용자 지정) */
/* 아래쪽 자리(묻는 말·버튼·안내)는 표 길이에서 계산한다 — endAskY/endBtnY/endHintY */

class SceneManager {
  constructor(){ this.current = null; this.next = null; this.state = 'idle'; this.t = 0; this.fade = 0; this.dur = 0.26; }
  get busy(){ return this.state !== 'idle'; }
  set(scene){
    if(this.current) this.current.exit();
    this.current = scene; this.current.mgr = this; this.current.enter();
  }
  /**
   * 다음 씬으로 넘긴다. **받아들였는지 알려준다** — 전환 중이면 조용히 버려지는데,
   * 부르는 쪽이 그걸 모르면 금화를 치르고도 판이 안 넘어간다 (실제로 그랬다).
   */
  change(scene){
    if(this.busy) return false;
    this.next = scene; this.state = 'out'; this.t = 0;
    return true;
  }
  update(dt){
    if(this.state === 'out'){
      this.t += dt; this.fade = clamp(this.t/this.dur, 0, 1);
      if(this.t >= this.dur){ this.set(this.next); this.next = null; this.state = 'in'; this.t = 0; }
    }else if(this.state === 'in'){
      this.t += dt; this.fade = 1 - clamp(this.t/this.dur, 0, 1);
      if(this.t >= this.dur){ this.fade = 0; this.state = 'idle'; }
    }
    if(this.current) this.current.update(dt);
  }
  render(ctx){
    if(this.current) this.current.render(ctx);
    if(this.fade > 0){
      ctx.globalAlpha = this.fade;
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,GAME_W,GAME_H);
      ctx.globalAlpha = 1;
    }
  }
}

/* ==================================================================
   배경 파츠 프리렌더 (성능: 정적 요소는 오프스크린에 1회만 그림)
   ================================================================== */
function makeCanvas(w,h){
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  return { cv, c };
}

/* 하늘: 4px 밴드 그라데이션 (도트 느낌 유지) */
const SKY_TITLE = [
  {p:0.00,c:'#100820'},{p:0.26,c:'#1d0d3c'},{p:0.48,c:'#331452'},
  {p:0.64,c:'#5c1f5c'},{p:0.75,c:'#98324f'},{p:0.83,c:'#d1573a'},
  {p:0.90,c:'#f79a45'},{p:1.00,c:'#ffd07a'}
];
function buildSky(stops){
  const { cv, c } = makeCanvas(GAME_W, GAME_H);
  stops = stops || SKY_TITLE;
  for(let y=0; y<GAME_H; y+=PX){
    c.fillStyle = rampColor(stops, y/(GAME_H-PX));
    c.fillRect(0, y, GAME_W, PX);
  }
  return cv;
}

/* 능선 높이맵 : 정수 배수 사인파/주기 패턴이라 가로로 완벽히 순환(이음새 없음)
   형태 - hill 구릉 / peak 험준 / tree 침엽수 / leaf 활엽수 / temple 유적 / flat 평지 */
function ridgeHeights(seed, baseY, amp, rough, shape){
  const h = new Array(COLS);
  const rnd = mulberry32(seed);
  // 공통 기복 (모든 형태의 바닥선)
  const freqs = [1,2,3,5,8], amps = [0.46,0.26,0.15,0.09,0.04], waves = [];
  for(let k=0;k<freqs.length;k++) waves.push({ f:freqs[k], a:amps[k], p:rnd()*Math.PI*2 });
  const undulate = i => {
    let v = 0;
    for(const w of waves) v += w.a * Math.sin(2*Math.PI*w.f*i/COLS + w.p);
    return v;
  };
  for(let i=0;i<COLS;i++){
    let y = baseY;
    const n = (hash1(i, seed) - 0.5) * rough;
    if(shape === 'temple'){
      const P = 40, seg = (i/P)|0, u = (i%P)/P;      // 320/40 = 8개, 완전 순환
      const hgt = amp * (0.5 + hash1(seg, seed)*0.5);
      const w = 0.30 + hash1(seg, seed^0x51)*0.14;
      const d = Math.abs(u - 0.5);
      let t = d < w ? 1 - d/w : 0;
      t = Math.floor(t*5)/5;                          // 계단식으로 양자화
      y = baseY - hgt*t - amp*0.10*undulate(i);
    }else if(shape === 'tree'){
      const P = 8, seg = (i/P)|0, u = (i%P)/P;        // 40그루
      const hgt = amp * (0.42 + hash1(seg, seed)*0.58);
      const t = Math.max(0, 1 - Math.abs(u - 0.5)*2); // 삼각(침엽수)
      y = baseY - hgt*t - amp*0.22*undulate(i);
    }else if(shape === 'leaf'){
      const P = 12, seg = (i/P)|0, u = (i%P)/P;       // 26그루 (둥근 수관)
      const hgt = amp * (0.45 + hash1(seg, seed)*0.55);
      const d = Math.abs(u - 0.5)*2;
      const t = d < 1 ? Math.sqrt(1 - d*d) : 0;
      y = baseY - hgt*t - amp*0.24*undulate(i);
    }else if(shape === 'peak'){
      let v = 0;                                      // 삼각파로 날카롭게
      for(const w of waves) v += w.a * (1 - 2*Math.abs(((i*w.f/COLS + w.p) % 1) - 0.5)) * 1.2;
      y = baseY - amp*v;
    }else if(shape === 'flat'){
      y = baseY - amp*0.35*undulate(i);
    }else{                                            // hill
      y = baseY - amp*undulate(i);
    }
    h[i] = snap(y + n);
  }
  return h;
}

/* 능선 캔버스. shape 가 none 이면 null (레이어 생략) */
function buildRidge(seed, baseY, amp, rough, color, shape){
  if(shape === 'none') return null;
  const { cv, c } = makeCanvas(GAME_W, GAME_H);
  const cTop  = mixHex(color, '#ffffff', 0.32);
  const cBody = color;
  const cDeep = mixHex(color, '#000000', 0.40);
  const h = ridgeHeights(seed, baseY, amp, rough, shape);
  let top = GAME_H;
  for(let i=0;i<COLS;i++) if(h[i] < top) top = h[i];
  for(let i=0;i<COLS;i++){
    const x = i*PX, t = h[i];
    if(t >= GAME_H) continue;
    c.fillStyle = cBody; c.fillRect(x, t, PX, GAME_H - t);
    c.fillStyle = cTop;  c.fillRect(x, t, PX, PX*2);
    const dL = h[(i-1+COLS)%COLS] - t, dR = h[(i+1)%COLS] - t;
    if(dL > PX*3 || dR > PX*3){ c.fillStyle = cDeep; c.fillRect(x, t+PX*2, PX, PX*4); }
    if(hash1(i, seed ^ 0x9e37) > 0.87){
      c.fillStyle = cDeep;
      c.fillRect(x, t + PX*2, PX, PX * (3 + Math.floor(hash1(i, seed ^ 0x51)*7)));
    }
  }
  cv._top = Math.max(0, top - PX*2);
  return cv;
}

/**
 * ★★ **판마다 규칙이 하나씩 다르다.** (기획 4, 2026-08-27)
 *
 * 스무 판이 **배경만 다르고 규칙은 전부 같았다.** 랜드마크를 세워 눈은 즐거워졌지만
 * 하는 일은 1판과 20판이 똑같다 — 그게 뒤로 갈수록 늘어지는 이유 하나였다.
 *
 * 판마다 **딱 하나씩만** 바꾼다. 둘이 겹치면 무엇 때문에 죽었는지 알 수 없고,
 * 알 수 없으면 배울 수도 없다. 그리고 **판 시작에 한 줄로 예고한다** —
 * 모르고 당하는 것은 난이도가 아니라 사고다.
 *
 * 규칙이 없는 판도 그대로 둔다. 매 판 새로운 것이 나오면 새로운 것이
 * 새롭지 않게 된다 — 쉬는 판이 있어야 다음 규칙이 눈에 띈다.
 */
const STAGE_RULES = {
  gale:   { ko:'맞바람',   hint:'맞바람이 계속 왼쪽으로 민다' },
  rocks:  { ko:'낙석',     hint:'떠다니는 바위가 부딪힌다' },
  bolt:   { ko:'번개',     hint:'번개가 화면을 가로지른다' },
  fog:    { ko:'눈보라',   hint:'눈보라에 시야가 좁아진다' },
  swarm:  { ko:'벌떼',     hint:'적이 더 많이, 더 자주 온다' },
  dark:   { ko:'어둠',     hint:'빛이 닿는 곳만 보인다' },
};

/* ==================================================================
   ★ 스테이지 랜드마크 (2026-08-26)

   배경은 네 겹 능선인데 형태가 여섯 가지(구릉·험준·침엽수·활엽수·유적·평지)뿐이라
   **스무 판이 색만 다르고 구조가 같았다.** 13~20판은 아예 하늘과 구름뿐이라
   어디를 날고 있는지 알 수가 없었다.

   그래서 판마다 **한눈에 알아보는 큰 것 하나**를 세운다 — 피라미드, 등대, 빙산,
   비행선, 지구. 능선과 같은 명암 규칙(윗면 밝게 / 그늘 어둡게)으로 그려
   따로 노는 그림이 되지 않게 한다.

   중경 속도로 흐르므로 한 바퀴에 한 번 지나간다. 배경 캔버스는 GAME_W 폭으로
   순환하니 **가장자리에 걸치면 이음새가 보인다** — x 는 0.30~0.70 사이로 둔다.
   ================================================================== */
function drawLandmark(c, kind, cx, baseY, W, H, color, seed){
  const body = color;
  const top  = mixHex(color, '#ffffff', 0.30);
  const deep = mixHex(color, '#000000', 0.42);
  const lit  = mixHex(color, '#ffffff', 0.55);
  const R = (x, y, w, h, col) => {
    if(w <= 0 || h <= 0) return;
    c.fillStyle = col; c.fillRect(snap(x), snap(y), Math.max(PX, snap(w)), Math.max(PX, snap(h)));
  };
  /** 기둥 하나 — 세로로 긴 것들은 전부 이걸로 쌓는다 (도트 결이 유지된다) */
  const col1 = (x, yA, yB, cBody, cTop) => {
    R(x, yA, PX, yB - yA, cBody);
    if(cTop) R(x, yA, PX, PX*2, cTop);
  };
  /** 가로로 훑으며 위/아래 경계를 주는 것 — 원반·타원·소행성이 전부 이 모양이다 */
  const sweep = (x0, x1, fn) => {
    for(let x = snap(x0); x < x1; x += PX){
      const r = fn(x);
      if(!r) continue;
      col1(x, r[0], r[1], r[2] || body, r[3]);
    }
  };
  const rnd = mulberry32((seed | 0) ^ 0x5f3a);
  const yTop = baseY - H;

  if(kind === 'pyramid'){                                   // 대피라미드 — 계단식
    const N = 15, sh = H / N;
    for(let i = 0; i < N; i++){
      const w = W * (i + 1) / N, y = yTop + i * sh;
      R(cx - w/2, y, w, sh + PX, body);
      R(cx, y, w/2, sh + PX, deep);                          // 오른쪽 절반이 그늘
      R(cx - w/2, y, w, PX, top);                            // 단의 윗면
    }
    R(cx - W*0.06, baseY - H*0.30, W*0.12, H*0.30, deep);    // 입구
  }else if(kind === 'columns'){                              // 신전 — 박공지붕과 열주
    const pw = W, px0 = cx - pw/2;
    R(px0, baseY - PX*4, pw, PX*4, deep);                    // 기단
    R(px0 + PX*2, baseY - PX*8, pw - PX*4, PX*4, body);
    const colTop = yTop + H*0.34, nCol = 9;
    for(let i = 0; i < nCol; i++){                           // 기둥
      const x = px0 + PX*6 + (pw - PX*12) * i / (nCol - 1);
      R(x - PX*2, colTop, PX*4, baseY - PX*8 - colTop, body);
      R(x - PX*2, colTop, PX, baseY - PX*8 - colTop, top);   // 왼쪽에 빛
      R(x + PX,   colTop, PX, baseY - PX*8 - colTop, deep);
    }
    R(px0, colTop - PX*5, pw, PX*5, body);                   // 처마
    R(px0, colTop - PX*5, pw, PX, top);
    const ph = H*0.34 - PX*5;
    for(let i = 0; i * PX < ph; i++){                        // 삼각 박공
      const t = i * PX / ph, w = pw * (1 - t);
      R(cx - w/2, colTop - PX*5 - (i+1)*PX, w, PX, i < 2 ? top : body);
    }
  }else if(kind === 'ziggurat'){                             // 정글 유적 — 계단 신전
    const N = 6, sh = H*0.80 / N;
    for(let i = 0; i < N; i++){
      const w = W * (0.34 + 0.66 * (i + 1) / N), y = yTop + H*0.20 + i * sh;
      R(cx - w/2, y, w, sh + PX, body);
      R(cx + w*0.18, y, w*0.32, sh + PX, deep);
      R(cx - w/2, y, w, PX, top);
    }
    R(cx - W*0.16, yTop, W*0.32, H*0.20 + PX, body);         // 정상 신전
    R(cx - W*0.16, yTop, W*0.32, PX*2, top);
    R(cx - W*0.05, yTop + H*0.08, W*0.10, H*0.12, deep);     // 문
    for(let i = 0; i * PX*3 < H*0.80; i++)                   // 정면 계단
      R(cx - W*0.07, yTop + H*0.20 + i*PX*3, W*0.14, PX, deep);
  }else if(kind === 'bigtree'){                              // 거대 침엽수
    R(cx - PX*3, baseY - H*0.30, PX*6, H*0.30, deep);        // 줄기
    R(cx - PX*3, baseY - H*0.30, PX*2, H*0.30, body);
    const N = 5;
    for(let i = 0; i < N; i++){
      const t = i / N, w = W * (0.34 + 0.66*t);
      const yb = yTop + H*0.16 + (H*0.62)*t + H*0.24, hh = H*0.30;
      for(let k = 0; k*PX < hh; k++){
        const u = k*PX/hh, ww = w*u;
        R(cx - ww/2, yb - hh + k*PX, ww, PX, k < 2 ? top : (u > 0.6 ? body : mixHex(body,'#000000',0.15)));
      }
    }
  }else if(kind === 'arch'){                                 // 자연 아치 바위
    const hw = W/2, hole = W*0.30, hh = H*0.62;
    sweep(cx - hw, cx + hw, (x) => {
      const d = Math.abs(x - cx) / hw;
      const t = yTop + H*0.16*(d*d) + (rnd() < 0.10 ? PX*2 : 0);
      if(Math.abs(x - cx) < hole){                           // 구멍 위쪽만 남는다
        const u = Math.abs(x - cx) / hole;
        return [t, baseY - hh * Math.sqrt(Math.max(0, 1 - u*u)), body, top];
      }
      return [t, baseY, body, top];
    });
    R(cx - hw, baseY - PX*3, W, PX*3, deep);
  }else if(kind === 'pagoda'){                               // 오층탑
    const N = 5, th = H / (N + 0.6);
    for(let i = 0; i < N; i++){
      const t = i / (N - 1), ww = W * (0.52 + 0.48*t);   // 아래로 갈수록 넓다
      const y = yTop + H*0.14 + i * th;
      R(cx - ww/2, y, ww, PX*2, deep);                       // 처마 (넓게 뻗는다)
      R(cx - ww/2, y, ww, PX, top);
      R(cx - ww*0.34, y + PX*2, ww*0.68, th - PX*2, body);   // 몸통
      R(cx + ww*0.10, y + PX*2, ww*0.24, th - PX*2, deep);
    }
    R(cx - PX, yTop, PX*2, H*0.14, top);                     // 상륜
    R(cx - PX*3, yTop + H*0.05, PX*6, PX, top);
  }else if(kind === 'waterfall'){                            // 절벽 사이 폭포
    const gap = W*0.26;
    for(const s of [-1, 1]){                                 // 양쪽 절벽
      const xa = cx + s*gap/2, xb = cx + s*(W/2);
      sweep(Math.min(xa, xb), Math.max(xa, xb), (x) => {
        const d = Math.abs(x - cx) - gap/2;
        return [yTop + H*0.30 * Math.exp(-d/(W*0.14)), baseY, body, top];
      });
    }
    const wt = mixHex(color, '#ffffff', 0.70);
    R(cx - gap*0.40, yTop + H*0.26, gap*0.80, H*0.74, wt);   // 물줄기
    for(let i = 0; i < 26; i++){                             // 흰 물살
      const x = cx - gap*0.40 + rnd()*gap*0.80;
      const y = yTop + H*0.30 + rnd()*H*0.64;
      R(x, y, PX, PX*(2 + (rnd()*5|0)), '#ffffff');
    }
    R(cx - gap*0.52, baseY - PX*5, gap*1.04, PX*5, wt);      // 아래 물보라
  }else if(kind === 'iceberg'){                              // 빙산
    const hw = W/2;
    sweep(cx - hw, cx + hw, (x) => {
      const d = (x - cx) / hw;
      const t = yTop + H * (d < -0.2 ? (0.30 + 0.9*Math.abs(d + 0.2))
                          : d < 0.15 ? Math.abs(d + 0.2)*0.5
                          : 0.10 + 1.05*(d - 0.15));
      return [Math.min(t, baseY), baseY, d > 0.15 ? deep : body, top];
    });
    for(let i = 0; i < 7; i++){                              // 갈라진 면
      const x = cx - hw*0.5 + rnd()*hw, y = yTop + H*0.35 + rnd()*H*0.5;
      R(x, y, PX, PX*(4 + (rnd()*8|0)), lit);
    }
  }else if(kind === 'lighthouse'){                           // 등대
    const rockW = W*0.9;
    sweep(cx - rockW/2, cx + rockW/2, (x) => {
      const d = Math.abs(x - cx)/(rockW/2);
      return [baseY - H*0.16*(1 - d*d), baseY, deep, body];
    });
    const tb = baseY - H*0.16, tt = yTop + H*0.16;
    for(let y = snap(tt); y < tb; y += PX){                  // 위로 갈수록 가늘어진다
      const u = (y - tt)/(tb - tt), w = W*(0.16 + 0.16*u);
      const band = (((y - tt)/(PX*6))|0) % 2 === 0;
      R(cx - w/2, y, w, PX, band ? body : top);
      R(cx + w*0.14, y, w*0.36, PX, deep);
    }
    R(cx - W*0.13, tt - PX*5, W*0.26, PX*5, deep);           // 전망대
    R(cx - W*0.10, tt - PX*10, W*0.20, PX*5, '#ffe98a');     // 등불
    R(cx - W*0.13, tt - PX*13, W*0.26, PX*3, body);          // 지붕
    R(cx - PX, tt - PX*16, PX*2, PX*3, top);
  }else if(kind === 'deadtree'){                             // 죽은 나무
    const branch = (x, y, len, ang, w) => {
      if(len < PX*4) return;
      const ex = x + Math.cos(ang)*len, ey = y + Math.sin(ang)*len;
      const n = Math.max(2, (len/PX)|0);
      for(let i = 0; i <= n; i++){
        const px = x + (ex - x)*i/n, py = y + (ey - y)*i/n;
        R(px - w/2, py, w, PX, i < n*0.3 ? body : deep);
      }
      branch(ex, ey, len*0.68, ang - 0.5 - rnd()*0.35, Math.max(PX, w - PX));
      branch(ex, ey, len*0.66, ang + 0.5 + rnd()*0.35, Math.max(PX, w - PX));
    };
    R(cx - PX*4, baseY - H*0.42, PX*8, H*0.42, body);
    R(cx + PX,   baseY - H*0.42, PX*3, H*0.42, deep);
    branch(cx, baseY - H*0.42, H*0.30, -Math.PI/2, PX*5);
  }else if(kind === 'torii'){                                // 도리이
    const hw = W/2, pt = yTop + H*0.22;
    for(const s of [-1, 1]){                                 // 기둥
      const x = cx + s*hw*0.62;
      R(x - PX*3, pt, PX*6, baseY - pt, body);
      R(x + PX,   pt, PX*2, baseY - pt, deep);
      R(x - PX*3, pt, PX*2, baseY - pt, top);
    }
    R(cx - hw*0.74, pt + H*0.18, hw*1.48, PX*4, body);       // 아래 관통 기둥
    for(let i = 0; i < 6; i++){                              // 위 가사기 (양끝이 들린다)
      const w = hw*2 * (1 - i*0.02);
      R(cx - w/2, pt - PX*6 + i*PX, w, PX, i < 2 ? top : body);
    }
    R(cx - hw*0.9, pt - PX*8, hw*1.8, PX*2, deep);
  }else if(kind === 'windmill'){                             // 풍차
    const tb = baseY, tt = yTop + H*0.34;
    for(let y = snap(tt); y < tb; y += PX){
      const u = (y - tt)/(tb - tt), w = W*(0.20 + 0.24*u);
      R(cx - w/2, y, w, PX, body);
      R(cx + w*0.12, y, w*0.38, PX, deep);
      R(cx - w/2, y, PX*2, PX, top);
    }
    R(cx - W*0.24, tt - PX*4, W*0.48, PX*4, deep);           // 지붕
    /**
     * 날개 넷. 축에서 뻗는 **대와 돛**을 따로 그린다 — 굵은 점을 이어 붙이면
     * 네 갈래가 서로 뭉개져 X 자 얼룩이 된다 (한 번 그렇게 나왔다).
     */
    const hubY = tt - PX*4, bl = H*0.34;
    for(let k = 0; k < 4; k++){
      const a = k*Math.PI/2 + Math.PI/4;                     // 45도 — X 자로 읽힌다
      const ux = Math.cos(a), uy = Math.sin(a);
      const nx = -uy, ny = ux;                               // 대에 수직인 방향 (돛의 폭)
      /* 타일을 PX*2 로 겹쳐 찍는다 — PX 한 칸씩이면 비스듬한 선이 점선으로 끊긴다 */
      for(let i = 3; i*PX < bl; i++){
        const t = i*PX/bl;
        R(cx + ux*i*PX - PX, hubY + uy*i*PX - PX, PX*2, PX*2, top);
        if(t > 0.34) for(let j = 1; j <= 4; j++)             // 바깥쪽 돛
          R(cx + ux*i*PX + nx*j*PX - PX, hubY + uy*i*PX + ny*j*PX - PX, PX*2, PX*2, body);
      }
    }
    R(cx - PX*3, hubY - PX*3, PX*6, PX*6, deep);             // 축
  }else if(kind === 'airship'){                              // 비행선
    const hw = W/2, hh = H*0.30, cy = yTop + H*0.34;
    sweep(cx - hw, cx + hw, (x) => {
      const d = (x - cx)/hw, k = Math.sqrt(Math.max(0, 1 - d*d));
      return [cy - hh*k, cy + hh*k, body, top];
    });
    for(let i = -2; i <= 2; i++)                             // 세로 띠
      R(cx + i*W*0.16, cy - hh*0.92, PX*2, hh*1.84, deep);
    R(cx + hw*0.72, cy - hh*0.9, PX*3, hh*1.8, deep);        // 꼬리 날개
    R(cx + hw*0.60, cy - PX, hw*0.34, PX*2, deep);
    R(cx - W*0.11, cy + hh + PX*2, W*0.22, PX*6, deep);      // 곤돌라
    for(let i = 0; i < 4; i++) R(cx - W*0.08 + i*W*0.05, cy + hh + PX*3, PX*2, PX*2, '#ffe98a');
  }else if(kind === 'skyfort'){                              // 떠 있는 섬 요새
    const hw = W/2, gy = yTop + H*0.42;
    sweep(cx - hw, cx + hw, (x) => {                         // 아래로 뾰족한 바위섬
      const d = Math.abs(x - cx)/hw;
      return [gy, gy + H*0.52*(1 - d*d)*(0.6 + 0.4*rnd()), deep, body];
    });
    R(cx - hw, gy, W, PX*3, top);                            // 지면
    for(const s of [-1, 0, 1]){                              // 탑 셋
      const w = s === 0 ? W*0.18 : W*0.11, h = s === 0 ? H*0.42 : H*0.26;
      const x = cx + s*W*0.28;
      R(x - w/2, gy - h, w, h, body);
      R(x - w/2, gy - h, PX*2, h, top);
      for(let i = 0; i*PX*4 < w; i++)                        // 총안
        R(x - w/2 + i*PX*4, gy - h - PX*2, PX*2, PX*2, body);
      R(x - w*0.2, gy - h*0.6, w*0.2, PX*4, deep);
    }
  }else if(kind === 'sun'){                                  // 거대한 해
    const r = W/2, cy = yTop + r;
    sweep(cx - r, cx + r, (x) => {
      const d = (x - cx)/r, k = Math.sqrt(Math.max(0, 1 - d*d));
      return [cy - r*k, cy + r*k, body, null];
    });
    for(let i = 0; i < 7; i++){                              // 가로로 잘린 띠 (도트 해)
      const y = cy - r + r*2*(0.42 + i*0.09);
      const d = (y - cy)/r, k = Math.sqrt(Math.max(0, 1 - d*d));
      R(cx - r*k, y, r*2*k, PX*(1 + (i > 3 ? 1 : 0)), lit);
    }
  }else if(kind === 'raincloud'){                            // 거대 먹구름
    for(let i = 0; i < 22; i++){
      const t = i/21, x = cx - W/2 + W*t;
      const w = W*0.16*(0.5 + rnd()), h = H*(0.30 + 0.55*Math.sin(Math.PI*t)*rnd());
      R(x - w/2, yTop + H*0.55 - h/2, w, h, i % 3 === 0 ? deep : body);
    }
    R(cx - W/2, yTop + H*0.30, W, PX*2, top);
    for(let i = 0; i < 30; i++)                              // 아래로 늘어진 비
      R(cx - W/2 + rnd()*W, yTop + H*0.75 + rnd()*H*0.3, PX, PX*(3 + (rnd()*6|0)), deep);
  }else if(kind === 'spire'){                                // 폭풍의 첨탑
    const tb = baseY, tt = yTop + H*0.12;
    for(let y = snap(tt); y < tb; y += PX){
      const u = (y - tt)/(tb - tt), w = W*(0.06 + 0.34*u*u);
      R(cx - w/2, y, w, PX, body);
      R(cx + w*0.10, y, w*0.40, PX, deep);
      R(cx - w/2, y, PX*2, PX, top);
    }
    let bx = cx, by = tt;                                    // 내리치는 번개
    for(let i = 0; i < 14 && by > yTop - H*0.5; i++){
      R(bx, by - PX*4, PX*2, PX*4, '#fff6a0');
      by -= PX*4; bx += (rnd() < 0.5 ? -PX*3 : PX*3);
    }
  }else if(kind === 'planet'){                               // 지구의 곡률
    const r = W*1.10, cy = baseY + r - H;
    const edge = (x) => {
      const d = (x - cx)/r;
      return cy - r*Math.sqrt(Math.max(0, 1 - d*d));
    };
    sweep(cx - W/2, cx + W/2, (x) => [edge(x), baseY, body, null]);
    sweep(cx - W/2, cx + W/2, (x) => [edge(x) - PX*3, edge(x) + PX*2, lit, null]);
    for(let i = 0; i < 5; i++){                              // 대륙
      const x = cx - W*0.4 + rnd()*W*0.8, w = W*(0.08 + rnd()*0.14);
      R(x, edge(x) + PX*(4 + (rnd()*10|0)), w, PX*(3 + (rnd()*6|0)), deep);
    }
  }else if(kind === 'asteroid'){                             // 거대 소행성
    const hw = W/2, cy = yTop + H/2;
    const lump = (a) => 1 + 0.16*Math.sin(a*3 + seed) + 0.10*Math.sin(a*5 - seed*0.7);
    sweep(cx - hw, cx + hw, (x) => {
      const d = (x - cx)/hw;
      if(Math.abs(d) >= 1) return null;
      const k = Math.sqrt(1 - d*d), a = Math.acos(clamp(d, -1, 1));
      return [cy - (H/2)*k*lump(a), cy + (H/2)*k*lump(-a), body, top];
    });
    for(let i = 0; i < 9; i++){                              // 분화구
      const a = rnd()*Math.PI*2, rr = rnd()*0.6;
      const x = cx + Math.cos(a)*hw*rr, y = cy + Math.sin(a)*(H/2)*rr;
      const sz = PX*(2 + (rnd()*4|0));
      R(x - sz, y - sz/2, sz*2, sz, deep);
      R(x - sz, y - sz/2, sz*2, PX, mixHex(color, '#000000', 0.62));
    }
  }else if(kind === 'galaxy'){                               // 은하 원반
    const hw = W/2, cy = yTop + H/2, sq = H/W;
    sweep(cx - hw, cx + hw, (x) => {                         // 흐릿한 원반
      const d = (x - cx)/hw, k = Math.sqrt(Math.max(0, 1 - d*d));
      return [cy - hw*sq*k, cy + hw*sq*k, body, null];
    });
    for(let arm = 0; arm < 2; arm++){                        // 나선 팔
      for(let i = 4; i < 96; i++){
        const t = i/96, a = arm*Math.PI + t*3.4, rr = t*hw;
        R(cx + Math.cos(a)*rr, cy + Math.sin(a)*rr*sq, PX*2, PX*2,
          t < 0.5 ? lit : mixHex(color, '#ffffff', 0.28));
      }
    }
    R(cx - PX*4, cy - PX*3, PX*8, PX*6, '#fff4d0');          // 중심핵
    R(cx - PX*6, cy - PX*2, PX*12, PX*4, '#ffe8b0');
  }
}

/* 스테이지 미리보기 썸네일 (선택 화면용. 1회만 생성) */
function buildThumb(si, W, H){
  const st = STAGES[si];
  const { cv, c } = makeCanvas(W, H);
  for(let y=0; y<H; y+=2){ c.fillStyle = rampColor(st.sky, y/(H-1)); c.fillRect(0, y, W, 2); }
  if(st.fx === 'stars'){
    const rnd = mulberry32(si*77);
    c.fillStyle = '#ffffff';
    for(let i=0;i<40;i++) c.fillRect((rnd()*W)|0, (rnd()*H)|0, 1, 1);
  }
  for(let li=0; li<3; li++){
    const L = st.layers[li];
    if(!L || L.s === 'none') continue;
    const hh = ridgeHeights(1000 + si*17 + li, L.b, L.a, L.r, L.s);
    c.fillStyle = L.c;
    for(let x=0; x<W; x++){
      const y = Math.round(hh[((x/W*COLS)|0)] / GAME_H * H);
      if(y < H) c.fillRect(x, y, 1, H - y);
    }
  }
  return cv;
}

/* 능선 블릿 : 투명한 위쪽 영역을 잘라내 드로우 비용을 줄인다 */
function blitRidge(ctx, img, x){
  const t = img._top || 0, hh = GAME_H - t;
  if(hh <= 0) return;
  ctx.drawImage(img, 0, t, GAME_W, hh, x, t, GAME_W, hh);
}

/* 로고: 도트 텍스트를 오프스크린에 1회 렌더 (불꽃 그라데이션 + 외곽선 + 그림자) */
function buildLogo(text, s){
  const pad = s*4;
  const { cv, c } = makeCanvas(textWidth(text,s,s) + pad*2, FONT_H*s + pad*2);
  drawText(c, text, pad, pad, s, {
    shadow:'#000000', shadowOff: s*2,
    outline: PAL.outline,
    color: r => PAL.fire[r]
  });
  return cv;
}

/* 픽셀 원 (달, 구슬 등) */
function circleStep(r){
  // 큰 원일수록 도트를 굵게. 드로우 수가 줄고 오히려 더 도트다운 느낌이 난다.
  return r > 420 ? PX*8 : (r > 220 ? PX*6 : (r > 150 ? PX*4 : (r > 70 ? PX*2 : PX)));
}

function paintPixelCircle(ctx, cx, cy, r, color){
  ctx.fillStyle = color;
  const st = circleStep(r);
  for(let y = -r; y <= r; y += st){
    const dx = Math.sqrt(Math.max(0, r*r - y*y));
    const w = Math.round(dx*2 / st) * st;
    if(w <= 0) continue;
    ctx.fillRect(Math.round((cx - dx)/st)*st, Math.round((cy + y)/st)*st, w, st);
  }
}
/* 원 하나가 반지름 100 이면 fillRect 를 25번 쓴다. 폭발 하나가 원 3개,
   화면에 폭발이 15개면 그것만으로 프레임당 1000번이 넘는다.
   반지름을 도트 격자에 맞춰 반올림하면 실제로 나오는 모양은 몇 종류뿐이라
   구워두고 쓰면 된다. 너무 큰 원은 캔버스가 커지니 그냥 직접 그린다. */
/**
 * ★★ **150 은 너무 컸다 — 이것이 버벅임의 원인이었다.** (2026-08-27, 사용자 지적)
 *
 * *"이거 고사양 게임도 아닌데 화면이 왜 이렇게 버벅이는 느낌이 들까?"*
 *
 * 폭발과 충격파는 **반지름이 매 프레임 커진다.** 그래서 굽는 보람이 없는데도
 * 반지름마다 캐시가 하나씩 생긴다 — 반지름 150 짜리 하나가 310x310 = 96,000 px 다.
 * 충격파 한 번이 수십 개를 만들어 **스프라이트 예산(2.2M px)을 통째로 밀어내고**,
 * 그 바람에 드래곤·적 스프라이트가 쫓겨나 **다음 프레임에 다시 구워졌다.**
 * 실측: 300프레임 중 148프레임에서 스프라이트를 다시 구웠고(총 525번)
 * 최악 프레임이 70ms 까지 튀었다 (예산은 16.7ms).
 *
 * 44 로 낮춘다. 이보다 큰 원은 그냥 직접 그린다 — 반지름 150 이라도
 * fillRect 75번이라 굽는 것보다 싸다. **되풀이해서 쓰이는 작은 것만** 굽는다.
 */
const CIRCLE_CACHE_MAX_R = 44;
function fillPixelCircle(ctx, cx, cy, r, color){
  if(r <= 0) return;
  if(r > CIRCLE_CACHE_MAX_R){ paintPixelCircle(ctx, cx, cy, r, color); return; }
  const st = circleStep(r);
  const rq = Math.max(st, Math.round(r/st)*st);            // 격자에 맞춰 양자화
  const w  = rq*2 + st*2;
  blitCached(ctx, 'C|'+rq+'|'+color, w, w, Math.round(cx - w/2), Math.round(cy - w/2),
    (c, x, y) => paintPixelCircle(c, x + w/2, y + w/2, rq, color));
}

/* ==================================================================
   스프라이트 / 성장 시스템
   - 문자 그리드를 fillRect 로 그림 (동일 색 연속 구간은 1회 호출로 묶음)
   - 불 레벨 1~10 에 따라 형태(FORM)와 도트 크기(cell)와 부착 파츠가 단계적으로 커짐
   문자 : K외곽 D어둠 M중간 L밝음 T꼬리막 E눈 H눈광 N콧구멍
          G뿔 S등가시 C발톱 W송곳니 P갑주 w날개막 f날개뼈 k날개뒷선
   ================================================================== */

/* 1번 드래곤 : 노바트 (검정 + 붉은 눈) */
const NOVART_PAL = {
  K:'#0d0912', D:'#241d33', M:'#3a3050', L:'#544772', T:'#3d3358',
  E:'#ff2b3c', H:'#ffd9dc', N:'#120c1a', G:'#b8a9d4', S:'#8f7ec4',
  C:'#e6dff2', W:'#fff4f4', P:'#6b5a92', w:'#2e2743', f:'#4a3d68', k:'#1a1426'
};

/* ---------------- FORM A : 아기 ~ 청년 (30 x 28) ---------------- */
const A_BODY = [
  '..............................','..............................','..............................',
  '..............................','..............................','....................KKKKKK....',
  '..................KKDDDDDDKK..','.................KDDDDDDDDDDK.','.................KDDHEEDDDDDDK',
  '.................KDDHEEDDDDDDK','.................KDDDDDDDDNNDK','................KKDDDDDDDDDDDK',
  '................KDDDDDDDDWDKK.','...............KKDDDDDDDKKK...','..........KKKKKKDDDDDDKK......',
  '......KKKKKDDDDDDDDDKK........','...KKKTTDDDDDDDDDDDDK.........','..KTTTTDDDDDMMMMMMMDDK........',
  '.KTTTTTDDDDMMMLLLLLMMDK.......','KTTTTTTDDDMMMLLLLLLLMMDK......','.KTTTTTDDDMMMLLLLLLLMMDK......',
  '..KKTTTDDDDMMMLLLLLLMMDK......','....KKDDDDDDMMMMMMMMMDK.......','......KKDDDDDDDDDDDDDK........',
  '........KKDKKKKDDKKDKK........','.........KDK...KDK............','........KCCK..KCCK............',
  '..............................'
];
const A_CREST = [   // 뿔 (Lv2~)
  '..............................','..............................','.....................K...K....',
  '....................KGK.KGK...','....................KGKKGGK...','.....................KGGGGK...',
  '..............................','..............................','..............................',
  '..............................','..............................','..............................',
  '..............................','..............................','..............................',
  '..............................','..............................','..............................',
  '..............................','..............................','..............................',
  '..............................','..............................','..............................',
  '..............................','..............................','..............................',
  '..............................'
];
const A_RIDGE = [   // 등줄기 가시 (Lv4~)
  '..............................','..............................','..............................',
  '..............................','..............................','..............................',
  '..............................','..............................','..............................',
  '..............................','..............................','..............................',
  '................S.............','...........S....SS............','.......S...SS.................',
  '....S..SS.....................','....SS........................','..............................',
  '..............................','..............................','..............................',
  '..............................','..............................','..............................',
  '..............................','..............................','..............................',
  '..............................'
];
const A_WINGS = [
  [ // W0 위로 최대
    '..............................','..............................','..............................',
    '........KKKKKKK...............','......KKfwwwwwwK..............','.....Kfwwwwwwwwk..............',
    '.....Kfwwwwwwwwk..............','......Kfwwwwwwwk..............','.......Kfwwwwwwk..............',
    '........Kfwwwwwk..............','.........Kfwwwwk..............','..........Kfwwwk..............',
    '...........Kfwwwk.............','............Kfwwwk............','.............Kwwwk............',
    '.............Kwwwk............','..............KKKk............','..............................',
    '..............................','..............................','..............................',
    '..............................','..............................','..............................',
    '..............................','..............................','..............................',
    '..............................'
  ],
  [ // W1 뒤로 비스듬
    '..............................','..............................','..............................',
    '..............................','..............................','..KKKKKK......................',
    '.KfwwwwwKK....................','Kfwwwwwwwwwk..................','Kwwwwwwwwwwwwk................',
    '.KKwwwwwwwwwwwk...............','...KKwwwwwwwwwwk..............','.....KKwwwwwwwwk..............',
    '.......KKwwwwwwk..............','.........KKwwwwk..............','...........KKwwk..............',
    '.............Kwk..............','..............KK..............','..............................',
    '..............................','..............................','..............................',
    '..............................','..............................','..............................',
    '..............................','..............................','..............................',
    '..............................'
  ],
  [ // W2 수평 (원근 압축)
    '..............................','..............................','..............................',
    '..............................','..............................','..............................',
    '..............................','..............................','..............................',
    '..............................','.......KKKKKKK................','......KfffwwwwK...............',
    '.....Kfwwwwwwwk...............','.....Kwwwwwwwwk...............','......KKwwwwwwk...............',
    '........KKwwwwk...............','..........KKKKk...............','..............................',
    '..............................','..............................','..............................',
    '..............................','..............................','..............................',
    '..............................','..............................','..............................',
    '..............................'
  ],
  [ // W3 아래로 최대 (몸통 앞)
    '..............................','..............................','..............................',
    '..............................','..............................','..............................',
    '..............................','..............................','..............................',
    '..............................','..............................','..............................',
    '..............................','..............................','.............KKk..............',
    '............Kwwwk.............','...........Kfwwwk.............','..........Kfwwwwk.............',
    '.........Kfwwwwwk.............','........Kfwwwwwwk.............','.......Kfwwwwwwwk.............',
    '......Kfwwwwwwwwk.............','......Kwwwwwwwwwk.............','.......KKwwwwwwwk.............',
    '.........KKwwwwwk.............','...........KKKKKk.............','..............................',
    '..............................'
  ]
];

/* ---------------- FORM B : 성체 (우람) (36 x 32) ---------------- */
const B_BODY = [   // 오른쪽을 보는 드래곤 (36x32)
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................KDDDDDDDDKK.....',
  '...................KDDDDDDDDK.......',
  '..................KDDDDDDDDDDKK.....',
  '.................KDDHEEDDDDDDDDKK...',
  '................KDDHEEEDDDDDDDDDDK..',
  '................KDDDDDDDDDDDDDNNDK..',
  '................KDDDDDDDDDDDDDDDDK..',
  '.................KDDDWDWDWDWDKKKK...',
  '..................KKDDDDDDDKK.......',
  '...............KKKKDDDDDKK..........',
  '............KKKDDDDDDDKK............',
  '.........KKKDDDDDDDDKK..............',
  '......KKKDDDDDDDDDDK................',
  '....KKTTDDDDDPPPPPDDK...............',
  '..KTTTTTDDDPPMMMMMPPDK..............',
  '.KTTTTTTDDPPMMLLLMMPPDK.............',
  'KTTTTTTTDDPMMLLLLLMMPDK.............',
  '.KTTTTTTDDPMMLLLLLMMPDK.............',
  '..KTTTTTDDDPMMLLLMMPDDK.............',
  '...KKTTTDDDDPPMMMPPDDK..............',
  '.....KKDDDDDDPPPPPDDK...............',
  '.......KKDDDDDDDDDKK................',
  '.........KDDKKKDDKK.................',
  '.........KDDK.KDDK..................',
  '........KCCCK.KCCCK.................'
];
/**
 * 드래곤마다 다른 뿔 — 열 벌. (2026-08-26, 사용자 지정)
 *
 * 색만 다른 드래곤 열 마리는 멀리서 보면 다 같은 드래곤이다.
 * 실루엣이 달라야 구분이 된다. 가장 위에 있고 가장 눈에 띄는 것이 뿔이라
 * 여기부터 갈랐다 — 뒤로 젖힌 쌍뿔 / 햇살 / 지느러미 부채 / 사슴뿔 /
 * 황소뿔 / 가시다발 / 외뿔 / 서리 왕관 / 유선형 / 숫양뿔.
 *
 * `tools/_horns.py` 로 만들어 붙인 것이다 — 뼈대만 그리고 외곽선은 자동으로 둘렀다.
 * 드래곤을 서른 마리로 늘릴 때 여기에 한 벌씩 더 붙이면 된다.
 */
const B_HORNS = [
  [   // 0
    '....................................',
    '.....................KKK............',
    '.....................KGKK.......KKK.',
    '.....................KKGK......KKGK.',
    '......................KGKK.....KGKK.',
    '......................KKGKKK..KKGK..',
    '.......................KKGGKK.KGGK..',
    '........................KKGGK.KGGK..',
    '.........................KKKK.KKKK..',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................'
  ],
  [   // 1
    '....................................',
    '.........................KKK........',
    '.........................KGK........',
    '....................KKK..KGK..KKK...',
    '....................KGK..KGK..KGK...',
    '....................KGKKKKGKKKKGK...',
    '....................KKGGKKGGKKGGK...',
    '.....................KGGKKGGKKGGK...',
    '.....................KKKKKKKKKKKK...',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................'
  ],
  [   // 2
    '....................................',
    '....................................',
    '....................................',
    '...........................KKK......',
    '........................KKKKGKKKK...',
    '.....................KKKKGKKGKKGKKKK',
    '.....................KGKKGKKGKKGKKGK',
    '.....................KGGGGGGGGGGGGGK',
    '.....................KKKKKKKKKKKKKKK',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................'
  ],
  [   // 3
    '....................................',
    '......................KKK...........',
    '....................KKKGKK.....KKKKK',
    '....................KGKKGK.....KGKGK',
    '....................KKGGGK....KKGGKK',
    '.....................KKKGKKK.KKGKKK.',
    '.......................KKGGK.KGKGK..',
    '........................KGGK.KGGKK..',
    '........................KKKK.KKKK...',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................'
  ],
  [   // 4
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '...................KKK...........KKK',
    '...................KGKKKK......KKKGK',
    '...................KKGGGKKK...KKGGGK',
    '....................KKKGGGK...KGGGKK',
    '......................KKKKK...KKKKK.',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................'
  ],
  [   // 5
    '....................................',
    '....................................',
    '..........................KKK.......',
    '..........................KGK.......',
    '......................KKK.KGK.KKK...',
    '......................KGK.KGKKKGK...',
    '......................KGKKKGGKKGKK..',
    '......................KGGKKGGKKGGK..',
    '......................KKKKKKKKKKKK..',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................'
  ],
  [   // 6
    '....................................',
    '..........................KKK.......',
    '..........................KGK.......',
    '..........................KGKK......',
    '.........................KKGGK......',
    '.........................KGGKK......',
    '.........................KGGGK......',
    '.........................KGGGK......',
    '.........................KKKKK......',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................'
  ],
  [   // 7
    '....................................',
    '....................................',
    '....................................',
    '..........................KKK.......',
    '.......................KKKKGKKKK....',
    '.....................KKKGKKGKKGKK...',
    '.....................KGKKGKKGGKGKK..',
    '.....................KGGKGGKGGKGGK..',
    '.....................KKKKKKKKKKKKK..',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................'
  ],
  [   // 8
    '....................................',
    '....................................',
    '.....................KKKK...........',
    '.....................KGGKKKKKK......',
    '.....................KKKGGGGGKKKK...',
    '.......................KKKGGGGGGKKK.',
    '.........................KKKGGGGGGK.',
    '...........................KKKGGGKK.',
    '.............................KKKKK..',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................'
  ],
  [   // 9
    '....................................',
    '....................................',
    '........................KKKKKKK.....',
    '.......................KKGGGGGKKKK..',
    '......................KKGGKKKGGGGK..',
    '......................KGGKK.KGGKKK..',
    '......................KKKKK.KGGK....',
    '......................KGGGK.KKKKK...',
    '......................KKKKKK.KGGKKK.',
    '.......................KGGGKKKGGGGK.',
    '.......................KKGGGKKKKKKK.',
    '........................KKKKK.......',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................'
  ],
];

const B_RIDGE = [   // 목덜미~등 가시
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '......................S.............',
  '.....................S..............',
  '...................S................',
  '.................S..................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '.................S..................',
  '..............S.S...................',
  '...........S.S......................',
  '........S.S.........................',
  '.......S............................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................'
];
const B_TAIL = [    // 꼬리 칼날 (Lv9~)
  '....................................','....................................','....................................',
  '....................................','....................................','....................................',
  '....................................','....................................','....................................',
  '....................................','....................................','....................................',
  '....................................','....................................','....................................',
  '....................................','....................................','....................................',
  '..S.................................','.SS.................................','SSS.................................',
  'SSS.................................','SSS.................................','SSS.................................',
  'SSS.................................','.SS.................................','..S.................................',
  '....................................','....................................','....................................',
  '....................................','....................................'
];
const B_WINGS = [
  [ // W0 위로 최대
    '....................................','....................................','..........KKKKKKKK..................',
    '........KKfwwwwwwwK.................','.......Kfwwwwwwwwwk.................','......Kfwwwwwwwwwwk.................',
    '......Kfwwwwwwwwwwk.................','.......Kfwwwwwwwwwk.................','........Kfwwwwwwwwk.................',
    '.........Kfwwwwwwwk.................','..........Kfwwwwwwk.................','...........Kfwwwwwk.................',
    '............Kfwwwwwk................','.............Kfwwwwwk...............','..............Kfwwwwk...............',
    '...............Kwwwwk...............','...............Kwwwwk...............','................KKKKk...............',
    '....................................','....................................','....................................',
    '....................................','....................................','....................................',
    '....................................','....................................','....................................',
    '....................................','....................................','....................................',
    '....................................','....................................'
  ],
  [ // W1 뒤로 비스듬
    '....................................','....................................','....................................',
    '....................................','....................................','...KKKKKKK..........................',
    '..KfwwwwwwKK........................','.Kfwwwwwwwwwwk......................','Kfwwwwwwwwwwwwk.....................',
    'Kwwwwwwwwwwwwwwwk...................','.KKwwwwwwwwwwwwwwk..................','...KKwwwwwwwwwwwwwk.................',
    '.....KKwwwwwwwwwwwk.................','.......KKwwwwwwwwwk.................','.........KKwwwwwwwk.................',
    '...........KKwwwwwk.................','.............KKwwwk.................','...............Kwwk.................',
    '................KKk.................','....................................','....................................',
    '....................................','....................................','....................................',
    '....................................','....................................','....................................',
    '....................................','....................................','....................................',
    '....................................','....................................'
  ],
  [ // W2 수평 (원근 압축)
    '....................................','....................................','....................................',
    '....................................','....................................','....................................',
    '....................................','....................................','....................................',
    '....................................','....................................','....................................',
    '.........KKKKKKKK...................','........KffffwwwwK..................','.......Kfwwwwwwwwk..................',
    '.......Kwwwwwwwwwk..................','........KKwwwwwwwk..................','..........KKwwwwwk..................',
    '............KKKKKk..................','....................................','....................................',
    '....................................','....................................','....................................',
    '....................................','....................................','....................................',
    '....................................','....................................','....................................',
    '....................................','....................................'
  ],
  [ // W3 아래로 최대 (몸통 앞)
    '....................................','....................................','....................................',
    '....................................','....................................','....................................',
    '....................................','....................................','....................................',
    '....................................','....................................','....................................',
    '....................................','....................................','....................................',
    '....................................','................KKk.................','...............Kwwwk................',
    '..............Kfwwwk................','.............Kfwwwwk................','............Kfwwwwwk................',
    '...........Kfwwwwwwk................','..........Kfwwwwwwwk................','.........Kfwwwwwwwwk................',
    '........Kfwwwwwwwwwk................','........Kwwwwwwwwwwk................','.........KKwwwwwwwwk................',
    '...........KKwwwwwwk................','.............KKKKKKk................','....................................',
    '....................................','....................................'
  ]
];

/* 폼 정의. hit/bound 는 "셀" 단위 (실제 px = 값 * cell) */
/**
 * 턱을 벌린 순간의 아래턱. (2026-08-26, 사용자 지정)
 *
 * "날개만 퍼덕이고 얼굴이 안 움직여서 오리나 병아리 같다" 는 지적을 받았다.
 * 드래곤은 입을 떡 벌리는 짐승이다 — 닫힌 턱 위에 이 층을 덮어 그려서
 * 아래턱이 두 칸 내려가고 그 사이에 어두운 입속과 이빨이 드러나게 한다.
 *
 * 지우는 기능이 없는 그리기 방식이라 **덮어쓸 수 있게** 닫힌 턱 자리(13~15줄)를
 * 전부 다시 칠한다. 그래서 이 층은 뚫린 데가 없다.
 */
const B_MAW = [
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '................KDDDDDDDDDDDDDNNDK..',
  '................KDDDDDDDDDDDDDDDDK..',
  '.................KWRWRWRWRWRWRWKK...',
  '................KKRRRRRRRRRRRRRRK...',
  '................KDWRWRWRWRWRWRDKK...',
  '................KDDDDDDDDDDDDDKK....',
  '.................KKDDDDDDDDDKK......',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '....................................'
];

const FORMS = {
  A: { cols:30, rows:28, body:A_BODY, wings:A_WINGS,
       parts:{ crest:A_CREST, ridge:A_RIDGE },
       hit:{ ox: 1, oy: 6, w: 5, h: 4 }, bound:{ l: 9, r:14, t: 9, b:12 }, muzzle:{ x:14, y:-4 } },
  B: { cols:36, rows:32, body:B_BODY, wings:B_WINGS,
       parts:{ ridge:B_RIDGE, tail:B_TAIL }, horns:B_HORNS, maw:B_MAW,
       hit:{ ox: 0, oy: 7, w: 6, h: 5 }, bound:{ l:11, r:17, t:13, b:15 }, muzzle:{ x:16, y:-3 } }
};

/* 불 레벨 1~10 성장 테이블.
   크기는 전 레벨 완전 고정 (그려지는 실루엣 210 x 186).
   FORM B(큰뿔+갑주 내장)를 처음부터 쓰고 cell 도 고정이라 레벨이 올라도
   1픽셀도 커지지 않는다. 예전엔 Lv2 에서 뿔이 붙으며 높이가 154->175 로,
   Lv6 에서 폼이 바뀌며 175->186 으로 커져서 "점점 커진다" 는 인상을 줬다.
   등가시(Lv4)와 꼬리칼날(Lv9)은 몸통 실루엣 안쪽이라 크기를 바꾸지 않는다. */
const GROWTH = [
  null,
  /* ★ **크기는 전 레벨 고정.** (2026-08-26, 사용자 지정)
     cell 6(216x192) 은 너무 컸다 — 화면을 가리고 피하기도 어려웠다.
     보라색 악당 드래곤(HeavyRider, FORM A x4.8 = 144x134)과 같은 덩치로 맞춘다.
     FORM B x4 = 144 x 128. */
  { form:'B', cell:4, parts:[] },   // Lv1
  { form:'B', cell:4, parts:[] },   // Lv2
  { form:'B', cell:4, parts:[] },   // Lv3
  { form:'B', cell:4, parts:[] },   // Lv4
  { form:'B', cell:4, parts:[] },   // Lv5
  { form:'B', cell:4, parts:[] },   // Lv6
  { form:'B', cell:4, parts:[] },   // Lv7
  { form:'B', cell:4, parts:[] },   // Lv8
  { form:'B', cell:4, parts:[] },   // Lv9
  { form:'B', cell:4, parts:[] }    // Lv10
];
// 레벨로 붙는 파츠도 없앴다. 파츠 하나가 실루엣을 한 칸 넘기면
// 그것만으로 "커졌다" 로 보인다. 캐릭터 생김새는 고른 드래곤이 전부 결정하고,
// 레벨 성장은 불줄기(1줄 26px -> 12줄 228px)가 전부 보여준다.
const MAX_LEVEL = 10;
function growthOf(level){ return GROWTH[clamp(level|0, 1, MAX_LEVEL)]; }
function formOf(level){ return FORMS[growthOf(level).form]; }
function spriteSize(level){
  const g = growthOf(level), f = FORMS[g.form];
  return { w: f.cols*g.cell, h: f.rows*g.cell, cell: g.cell, form: f };
}

/* 문자 그리드 1장. 같은 색 연속 구간은 fillRect 1회.
   flip=true 면 좌우 반전 (왼쪽 보는 적에게 사용) */
function drawGrid(ctx, grid, ox, oy, cols, cell, pal, flip, tint){
  for(let r=0; r<grid.length; r++){
    const row = grid[r];
    // 소수 배율(예: 4.8)도 쓸 수 있도록 셀 경계를 정수로 반올림해서 그린다.
    // 인접 셀이 같은 경계를 공유하므로 틈이나 겹침이 생기지 않는다.
    const gy0 = Math.round(oy + r*cell), gh = Math.round(oy + (r+1)*cell) - gy0;
    let c = 0;
    while(c < row.length){
      const ch = row[c];
      if(ch === '.'){ c++; continue; }
      let e = c + 1;
      while(e < row.length && row[e] === ch) e++;
      ctx.fillStyle = tint || pal[ch] || '#ff00ff';
      const x0 = Math.round(ox + (flip ? (cols - e) : c) * cell);
      const x1 = Math.round(ox + (flip ? (cols - c) : e) * cell);
      ctx.fillRect(x0, gy0, x1 - x0, gh);
      c = e;
    }
  }
}

/* ------------------------------------------------------------------
   합성 스프라이트 캐시.
   드래곤/적 한 마리는 그리드 3~5장을 겹쳐 그리느라 fillRect 가 100~200번 든다.
   적이 45마리면 그것만으로 프레임당 4300번이라 폰에서 그대로 버벅인다.
   같은 (팔레트/레벨/포즈/반전/틴트) 조합은 캔버스에 한 번만 굽고 blit 만 한다.
   메모리는 총 픽셀 수로 제한하고 오래 안 쓴 것부터 버린다.
   ------------------------------------------------------------------ */
const SPRITE_BUDGET_PX = 2200000;         // 약 9MB (RGBA). 한 스테이지 작업집합은 1M 픽셀 정도다.
const _spriteCache = new Map();
let _spritePx = 0;
let _palSeq = 0;
function palId(pal){
  if(!pal) return '0';
  if(pal.__pid === undefined){ Object.defineProperty(pal, '__pid', { value: ++_palSeq }); }
  return pal.__pid;
}
/* paint(c, x, y) 를 (w x h) 캔버스에 한 번만 그려두고 이후엔 blit */
function blitCached(ctx, key, w, h, ox, oy, paint){
  w = Math.ceil(w) + 2; h = Math.ceil(h) + 2;
  // 캐시가 오히려 손해인 크기거나 좌표가 정수가 아니면 그냥 직접 그린다
  if(w > 700 || h > 700 || (ox|0) !== ox || (oy|0) !== oy){ paint(ctx, ox, oy); return; }
  let cv = _spriteCache.get(key);
  if(cv === undefined){
    const r = makeCanvas(w, h);
    paint(r.c, 0, 0);
    cv = r.cv;
    _spriteCache.set(key, cv); _spritePx += w*h;
    while(_spritePx > SPRITE_BUDGET_PX && _spriteCache.size > 1){
      const k0 = _spriteCache.keys().next().value;
      const v0 = _spriteCache.get(k0);
      _spritePx -= v0.width*v0.height;
      _spriteCache.delete(k0);
    }
  }else{
    _spriteCache.delete(key); _spriteCache.set(key, cv);    // 최근 사용으로 갱신
  }
  ctx.drawImage(cv, ox, oy);
}

/* 드래곤 1마리. cx,cy = 스프라이트 중심 / level = 불 레벨(성장 단계)
   레이어 : 날개(0~2) -> 몸통 -> 부착 파츠 -> 내려친 날개(W3) */
function paintDragon(ctx, pal, level, ox, oy, pose, flip, tint, always, horn, maw){
  const g = growthOf(level), f = FORMS[g.form], cell = g.cell;
  const front = (pose === 3);
  if(!front) drawGrid(ctx, f.wings[pose], ox, oy, f.cols, cell, pal, flip, tint);
  /* 뿔은 몸통보다 **먼저** — 밑동이 두개골에 가려 자연스럽게 박혀 보인다 */
  if(f.horns) drawGrid(ctx, f.horns[(horn|0) % f.horns.length], ox, oy, f.cols, cell, pal, flip, tint);
  drawGrid(ctx, f.body, ox, oy, f.cols, cell, pal, flip, tint);
  /* 입을 벌린 순간에는 아래턱을 덮어 그린다 (닫힌 턱 위에 얹는다) */
  if(maw && f.maw) drawGrid(ctx, f.maw, ox, oy, f.cols, cell, pal, flip, tint);
  const drawn = {};
  for(const name of g.parts){                       // 성장으로 붙는 파츠
    const layer = f.parts[name];
    if(layer && !drawn[name]){ drawn[name] = 1; drawGrid(ctx, layer, ox, oy, f.cols, cell, pal, flip, tint); }
  }
  if(always) for(const name of always){             // 캐릭터 고유 파츠 (Lv1 부터 항상)
    const layer = f.parts[name];
    if(layer && !drawn[name]){ drawn[name] = 1; drawGrid(ctx, layer, ox, oy, f.cols, cell, pal, flip, tint); }
  }
  if(front) drawGrid(ctx, f.wings[pose], ox, oy, f.cols, cell, pal, flip, tint);
}
function drawDragon(ctx, pal, level, cx, cy, pose, flip, tint, always, horn, maw){
  const g = growthOf(level), f = FORMS[g.form], cell = g.cell;
  const ox = snap(cx - f.cols*cell/2), oy = snap(cy - f.rows*cell/2);
  const key = 'D|'+palId(pal)+'|'+level+'|'+pose+'|'+(flip?1:0)+'|'+(tint||'-')
            + '|'+(always ? always.join(',') : '-')+'|'+(horn|0)+'|'+(maw?1:0);
  blitCached(ctx, key, f.cols*cell, f.rows*cell, ox, oy,
    (c, x, y) => paintDragon(c, pal, level, x, y, pose, flip, tint, always, horn, maw));
}

/**
 * 머리·다리 무장 장식.
 *
 * ★ **이 둘은 세지 않다. 대신 눈에 띈다.** (2026-08-26, 사용자 지정)
 * 산 사람이 산 티가 나야 사는 보람이 있는데, 효과가 약하니 티가 날 곳은 그림뿐이다.
 * 그래서 뿔 위에 관을 얹고 발톱에 광을 내고 반짝임을 흘린다.
 *
 * 드래곤 도트 자체를 고치지 않고 **위에 덧그린다** — 열 마리 x 열 레벨의 도트를
 * 스무 벌 더 만드는 것은 감당이 안 되고, 굽어 있는 그림 캐시도 전부 무효가 된다.
 */
/**
 * 마스크. (2026-08-26, 사용자 신고 — "아무것도 안 떠, 변화가 없어")
 *
 * ★ 마스크는 **그리는 코드가 아예 없었다.** 효과(받는 피해 감소)만 있고 얼굴에는
 * 아무 일도 안 일어났다. 산 사람이 산 티를 못 내는 물건이었다.
 *
 * 자리는 **주둥이**다. B 형태 격자에서 눈은 10~11줄, 주둥이는 11~14줄이고
 * 가로로는 22~33칸이다. 화면 좌표로 옮기면 얼굴 앞쪽 절반이 된다.
 *
 * 등급마다 덮는 범위가 넓어진다 — 코끈 → 무쇠판 → 송곳니 → 눈까지 → 용왕의 얼굴.
 * 값이 두 배씩 뛰는 물건이라 **눈에 보이는 차이**가 있어야 한다.
 */
function drawMask(ctx, cx, cy, m, tint, lv){
  const u = Math.max(2, Math.round(m.cell));
  /* 주둥이 앞끝과 위아래 — 격자 좌표에서 옮겨온 값이다 */
  const x0 = snap(cx + u*4);        // 주둥이 시작 (눈 바로 앞)
  const x1 = snap(cx + u*15);       // 코끝
  const yM = snap(cy - u*3);        // 주둥이 한가운데
  const dark = '#0a0616';

  const band = (bx, bw, by, bh, c) => {
    ctx.fillStyle = dark; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = c;    ctx.fillRect(bx, by, bw, bh);
  };

  /* 1등급 — 코를 가로지르는 가죽끈 하나 */
  band(x0 + u*4, u*5, yM - u, u*2, tint);

  /* 2등급부터 — 주둥이를 덮는 판 */
  if(lv >= 2){
    band(x0, x1 - x0, yM - u*2, u*4, tint);
    /* 대갈못 — 판이 판처럼 보이게 하는 것은 결국 이 점들이다 */
    ctx.fillStyle = dark;
    for(let i=0;i<4;i++) ctx.fillRect(snap(x0 + u*2 + i*u*3), yM - u, u, u);
  }

  /* 3등급부터 — 아래로 뻗은 송곳니 */
  if(lv >= 3){
    ctx.fillStyle = dark;
    for(let i=0;i<3;i++) ctx.fillRect(snap(x0 + u*3 + i*u*4) - 1, yM + u*2 - 1, u + 2, u*3 + 2);
    ctx.fillStyle = '#fff4f4';
    for(let i=0;i<3;i++) ctx.fillRect(snap(x0 + u*3 + i*u*4), yM + u*2, u, u*3);
  }

  /* 4등급부터 — 눈까지 덮는 면갑 */
  if(lv >= 4){
    band(snap(cx - u*2), u*7, yM - u*5, u*3, tint);
    /* 눈구멍 — 뚫려 있어야 눈이 살아 보인다 */
    ctx.fillStyle = dark;
    ctx.fillRect(snap(cx - u), yM - u*4, u*2, u);
  }

  /**
   * 5등급 — 용왕의 얼굴.
   * ★ "진짜 크고 멋진 용왕 얼굴" (사용자 지정). 앞의 넷이 '덮개' 라면 이건 **가면**이다:
   * 위로 뻗은 뿔 한 쌍, 이마의 보석, 볼을 감싸는 판, 아래로 자란 엄니.
   */
  if(lv >= 5){
    /* 뿔 한 쌍 — 이마에서 위로 */
    for(const dx of [-u*2, u*3]){
      ctx.fillStyle = dark;
      ctx.fillRect(snap(cx + dx) - 1, yM - u*10 - 1, u + 2, u*5 + 2);
      ctx.fillStyle = tint;
      ctx.fillRect(snap(cx + dx), yM - u*10, u, u*5);
      ctx.fillRect(snap(cx + dx) + (dx < 0 ? -u : u), yM - u*10, u, u*2);   // 갈라진 끝
    }
    /* 이마 보석 — 숨쉬듯 밝아진다 */
    ctx.fillStyle = dark;
    ctx.fillRect(snap(cx) - 1, yM - u*7 - 1, u*2 + 2, u*2 + 2);
    ctx.fillStyle = '#ff4d6a';
    ctx.fillRect(snap(cx), yM - u*7, u*2, u*2);
    /* 볼을 감싸는 판 */
    band(snap(cx + u*2), u*10, yM - u*2, u*5, tint);
    /* 엄니 — 아래로 크게 두 개 */
    for(const dx of [u*3, u*10]){
      ctx.fillStyle = dark;
      ctx.fillRect(snap(cx + dx) - 1, yM + u*3 - 1, u*2 + 2, u*5 + 2);
      ctx.fillStyle = '#fff4f4';
      ctx.fillRect(snap(cx + dx), yM + u*3, u*2, u*5);
    }
  }
}

function drawGear(ctx, cx, cy, m, t, headTint, legTint, maskTint, maskLv){
  if(!headTint && !legTint && !maskTint) return;
  const u = Math.max(2, Math.round(m.cell));           // 장식 한 칸 = 드래곤 한 칸
  const sh = Math.sin(t*4);
  ctx.save();

  if(headTint){
    /* 머리는 오른쪽 위 — 뿔이 난 자리 바로 위에 관을 얹는다 */
    const hx = snap(cx + m.w*0.16), hy = snap(cy - m.h*0.30);
    ctx.fillStyle = '#0a0616';
    ctx.fillRect(hx - u*5, hy - u, u*10, u*2 + 1);      // 관테 그림자
    ctx.fillStyle = headTint;
    ctx.fillRect(hx - u*4, hy - u, u*8, u*2);           // 관테
    for(let i=-2;i<=2;i++){                            // 뾰족한 다섯 갈래
      const h = (i === 0) ? u*3 : (Math.abs(i) === 1 ? u*2 : u);
      ctx.fillRect(hx + i*u*2 - u/2, hy - u - h, u, h);
    }
    /* 한가운데 보석이 숨쉰다 */
    ctx.globalAlpha = 0.55 + sh*0.35;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hx - u/2, hy - u*3, u, u);
    ctx.globalAlpha = 1;
  }

  if(maskTint) drawMask(ctx, cx, cy, m, maskTint, maskLv || 1);

  if(legTint){
    /* 다리는 아래쪽 두 갈래 — 각반을 두르고 발톱에 광을 낸다.
       ★ 숫자는 눈으로 맞췄다 — 첫 판에는 0.30 이라 각반이 **배에** 붙어 있었다.
       B 형태의 다리는 36x32 격자의 29~31줄, 가로로는 9~17칸이다. */
    const ly = snap(cy + m.h*0.42);
    for(const dx of [-m.w*0.21, -m.w*0.07]){
      const lx = snap(cx + dx);
      ctx.fillStyle = '#0a0616';
      ctx.fillRect(lx - u*2 - 1, ly - 1, u*4 + 2, u*3 + 2);
      ctx.fillStyle = legTint;
      ctx.fillRect(lx - u*2, ly, u*4, u*2);            // 각반
      ctx.fillRect(lx - u*2, ly + u*2, u, u);          // 발톱 셋
      ctx.fillRect(lx,       ly + u*2, u, u);
      ctx.fillRect(lx + u*2 - u, ly + u*2, u, u);
    }
    /* 뒤로 흐르는 잔광 — 빨라 보이게 하는 눈속임이다.
       몸 바로 뒤에서 시작해 점점 짧아진다 — 띄어진 자리에서 띄우면
       잔광이 아니라 그냥 흘러다니는 점으로 보인다. */
    for(let i=1;i<=3;i++){
      ctx.globalAlpha = (0.34 + sh*0.16) * (1 - (i-1)*0.28);
      ctx.fillStyle = legTint;
      ctx.fillRect(snap(cx - m.w*0.24 - i*u*3), ly + u, u*(4-i), u);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ==================================================================
   플레이어
   ================================================================== */
const PLAYER = {
  SPEED: 780,        // 초당 780px (탄막을 빠르게 피할 수 있는 속도)
  ACCEL: 11200,      // 780 / 0.07s => 0.07초만에 최고속 도달 (감속도 동일)
  MARGIN: 20,        // 화면 가장자리 여백
  FLY_FPS: 0.055,    // 이동 중 날갯짓 간격
  IDLE_FPS: 0.30     // 정지 중 날갯짓 간격
};
/* 날갯짓 핑퐁 순서 */
const FLY_SEQ  = [0,1,2,3,2,1];
const IDLE_SEQ = [2,1];

class Player {
  constructor(x, y, level, dragonIdx, pid){
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.animT = 0; this.animI = 0;
    this.t = 0;
    this.moving = false;
    this.level = level || 1;      // 불 레벨 = 성장 단계
    this.growT = 0;               // 레벨업 연출 타이머
    this.pose = 2;
    this.trail = [];              // 잔상용 위치 궤적
    // --- 플레이어별 상태 (2인 플레이용) ---
    this.pid = pid || 1;
    this.dragonIdx = clamp(dragonIdx === undefined ? (Save.data.dragon|0) : dragonIdx, 0, 9);
    this.hp = 100; this.hurtT = 0;
    /**
     * ★★ **하트를 잃으면 실제로 죽는다.** (2026-08-27, 사용자 지정)
     *
     * *"하트는 생명이야. 생명이 죽을때 아무런 액션이 없다는건 말이 안됨
     *   (...) 하트가 1개 잃을 때마다 실제 폭발해서 죽어야해"*
     *
     * 예전에는 하트만 하나 줄고 그 자리에서 그대로 계속 날았다. 폭발도 잠깐,
     * 무적도 1.8초뿐이라 **죽었다는 느낌이 아예 없었고**, 부활하자마자 같은
     * 탄에 또 맞는 일도 흔했다.
     *
     * `deadT` 가 0보다 크면 **화면에서 사라진 상태**다 — 안 그려지고, 안 쏘고,
     * 안 맞는다. 0이 되면 안전한 자리에서 되살아나 3초 동안 반짝인다.
     */
    this.deadT = 0;
    /**
     * ★ **한 방 맞았다는 표시.** (2026-08-27, 사용자 지정)
     * *"생명력이 조금이라도 줄어들때 주인공 캐릭터 얼굴이 해골로 변하는 액션"*
     * 0 보다 크면 머리에 해골이 겹쳐 뜬다.
     */
    this.hitT = 0;
    /* 연발 제한 (2026-08-27) */
    this.mslCool = 0; this.bombCool = 0; this.burstN = 0; this.burstT = 0;
    this.rollT = 0;                  // 회피 롤 남은 시간 (2026-08-27)
    /**
     * ★★ **리액션.** (2026-08-27, 사용자 지정)
     *
     * *"뭔가 애니메이션이 있으면 재밌을거 같아"*
     *
     * 무엇을 먹었는지·맞았는지가 **캐릭터의 몸짓**으로 읽혀야 한다.
     * 숫자와 글자는 화면 구석에 있어서 싸우는 동안 볼 겨를이 없다.
     *
     *   apple   사과   — 웃는 얼굴 + 날개가 쭉쭉 커졌다 작아진다
     *   power   레벨업 — 한 바퀴 돌면서 0.5초 붉어지고 얼굴이 커졌다 작아진다
     *   eat     무기   — 입을 벌려 삼킨다 (미사일·핵무기가 입으로 빨려 들어간다)
     *   stagger 피격   — 작아지며 얼굴이 뒤로 꺾이고 휘청한다
     */
    this.fxKind = ''; this.fxT = 0; this.fxDur = 0; this.fxItem = '';
    /* ★ 하트 3개로 시작한다. (2026-08-26, 사용자 지정)
       5개일 때는 일부러 맞으러 다녀도 죽기가 어려웠다 — 한 대에 25뿐이라
       목숨 하나에 4대, 다섯 목숨이면 스무 대를 맞아야 끝났다. */
    this.lives = 3; this.out = false;      // 잔기는 플레이어마다 따로
    this.shieldT = 0; this.shieldHits = [];   // 필살기 쉴드 남은 시간 / 튕겨낸 자국
    /**
     * ★ **빈손으로 시작하지 않는다.** (2026-08-26, 사용자 지정)
     * 미사일 아이템 첫 투하가 4초, 필살기가 16초였다 — 그때까지 쏠 게 기본 불뿐이라
     * 시작이 심심했다. 손에 뭔가 쥐고 시작해야 첫 화면부터 놀 거리가 있다.
     */
    /* 초기 보유 아이템은 1P 것이다 — 2P 는 지갑도 보관함도 없는 손님이다 */
    this.missileCount = this.pid === 1 ? clamp(EQ.startMissiles, START_MISSILES, MAX_MISSILE) : START_MISSILES;
    this.bombCount    = this.pid === 1 ? clamp(EQ.startBombs,    START_BOMBS,    MAX_BOMB)    : START_BOMBS;
    this.combo = 0; this.comboT = 0; this.fireT = 0;
    this.score = 0;                        // 플레이어별 점수
    this.coinChain = 0; this.coinT = 0;    // 황금동전 연쇄
    /**
     * 턱 벌리기. 불을 뿜는 순간에는 반드시 벌리고, 그 밖에는 가끔 혼자 으르렁댄다.
     * `mawT` 가 0 보다 크면 벌어져 있다.
     */
    this.mawT = 0; this.mawNext = 1.4 + Math.random()*2.6;
  }
  get dragon(){ return DRAGONS[this.dragonIdx]; }
  /* 쉴드 : 캐릭터 전체를 넉넉히 감싸는 원.
     몸통 판정만 감싸면 눈에 잘 안 띄어서 쉴드가 켜진 줄 모른다. */
  get shieldR(){ const m = this.metrics; return Math.hypot(m.w, m.h)*0.5 + 8; }
  get shieldC(){ return { x: this.x, y: this.y }; }
  /* 입 끝 (불이 나오는 지점) */
  get muzzle(){
    const g = growthOf(this.level), f = FORMS[g.form];
    return { x: this.x + f.muzzle.x*g.cell, y: this.y + f.muzzle.y*g.cell };
  }
  /** 리액션을 시작한다. 같은 것이 겹치면 새 것으로 갈아 끼운다 */
  startFx(kind, dur, item){
    this.fxKind = kind; this.fxDur = dur; this.fxT = dur; this.fxItem = item || '';
    if(kind === 'eat') this.mawT = Math.max(this.mawT || 0, dur);
  }
  /**
   * 지금 리액션이 만드는 **몸의 변형**.
   * 그리는 쪽은 이 값만 보고 변형을 걸면 된다 — 리액션이 늘어도 그리는 코드는 그대로다.
   */
  fxState(){
    const k = this.fxDur > 0 ? 1 - this.fxT/this.fxDur : 1;   // 0 -> 1 로 흐른다
    const s = { sx:1, sy:1, rot:0, ox:0, oy:0, tint:null, smile:false };
    /**
     * ★ **한 바퀴 도는 모습.** (2026-08-27)
     * 세로축을 중심으로 도는 것은 **가로 폭이 0 을 지나 음수가 되는 것**으로
     * 그린다 — 종이 한 장이 뒤집히는 것과 같은 셈이다.
     * 다른 리액션보다 먼저 본다: 도는 중에 먹거나 맞아도 도는 것이 우선이다.
     */
    if(this.rollT > 0){
      const a = (1 - this.rollT/ROLL_TIME) * Math.PI * 2 * ROLL_TURNS;
      s.sx = Math.cos(a);
      s.sy = 1 + Math.abs(Math.sin(a))*0.10;      // 얇아질 때 살짝 길어진다
      return s;
    }
    if(this.fxT <= 0) return s;
    if(this.fxKind === 'apple'){
      /* 슈퍼마리오처럼 쭉 커졌다 돌아온다. 세로를 먼저, 가로를 뒤따라 —
         한 축씩 어긋나야 "부풀었다" 로 보인다 */
      const p = Math.sin(k*Math.PI);
      s.sx = 1 + p*0.42; s.sy = 1 + p*0.30;
      s.smile = true;
    }else if(this.fxKind === 'power'){
      s.rot = k*Math.PI*2;                       // 한 바퀴
      const p = Math.sin(k*Math.PI);
      s.sx = 1 + p*0.26; s.sy = 1 + p*0.26;
      if(k < 0.62) s.tint = '#ff2b3c';           // 0.5초쯤 붉게
    }else if(this.fxKind === 'eat'){
      /* 삼키는 순간 목이 한 번 꿀렁인다 */
      const p = Math.sin(k*Math.PI*2);
      s.sx = 1 + p*0.16; s.sy = 1 - p*0.12;
    }else if(this.fxKind === 'stagger'){
      /* 뒤로 꺾이며 작아졌다 돌아온다. 휘청 — 좌우로 한 번 흔들린다 */
      const p = 1 - k;
      s.rot = -p*0.42;                           // 얼굴이 뒤로(위로) 꺾인다
      s.sx = 1 - p*0.20; s.sy = 1 - p*0.20;
      s.ox = -p*22 + Math.sin(k*Math.PI*3)*p*10;
      s.oy = -p*8;
    }
    return s;
  }
  setLevel(lv){
    const n = clamp(lv, 1, MAX_LEVEL);
    if(n === this.level) return false;
    this.level = n; this.growT = 0.45;
    return true;
  }
  /* 현재 성장 단계의 스프라이트 크기 / 판정값 (px) */
  get metrics(){
    const g = growthOf(this.level), f = FORMS[g.form], c = g.cell;
    return {
      w: f.cols*c, h: f.rows*c, cell: c, form: f,
      hitW: f.hit.w*c, hitH: f.hit.h*c, hitOX: f.hit.ox*c, hitOY: f.hit.oy*c,
      bL: f.bound.l*c, bR: f.bound.r*c, bT: f.bound.t*c, bB: f.bound.b*c
    };
  }
  get hitbox(){
    const m = this.metrics;
    return { x: this.x + m.hitOX - m.hitW/2, y: this.y + m.hitOY - m.hitH/2, w: m.hitW, h: m.hitH };
  }
  update(dt, mv){
    this.t += dt;
    if(this.growT > 0) this.growT -= dt;

    // --- 가감속: 목표 속도로 일정 가속도만큼 접근 (0.07초 도달) ---
    /* 손으로 잡아 끄는 중에는 위치를 직접 정하므로 가속 계산을 건너뛴다 */
    if(mv && mv.grabbed) return;
    /* 다리무장은 조금 빨라지게 해 준다 — 세게 만드는 것이 아니라
       피하기 편해지는 정도다 (최대 12%) */
    const sm = this.pid === 1 ? EQ.speed : 1;
    const tvx = mv.x * PLAYER.SPEED * sm, tvy = mv.y * PLAYER.SPEED * sm;
    const d = PLAYER.ACCEL * dt;
    this.vx += clamp(tvx - this.vx, -d, d);
    this.vy += clamp(tvy - this.vy, -d, d);
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // --- 화면 경계 (벽에 닿으면 해당 축 속도 0: 관성 누적 방지) ---
    // 비대칭: 머리(오른쪽)와 발(아래)은 항상 화면 안, 꼬리/날개는 살짝 벗어나도 됨
    const m = this.metrics;
    const minX = PLAYER.MARGIN + m.bL, maxX = GAME_W - PLAYER.MARGIN - m.bR;
    const minY = PLAYER.MARGIN + m.bT, maxY = GAME_H - PLAYER.MARGIN - m.bB;
    if(this.x < minX){ this.x = minX; this.vx = 0; }
    if(this.x > maxX){ this.x = maxX; this.vx = 0; }
    if(this.y < minY){ this.y = minY; this.vy = 0; }
    if(this.y > maxY){ this.y = maxY; this.vy = 0; }

    // --- 애니메이션 ---
    const nowMoving = Math.hypot(this.vx, this.vy) > 40;
    if(nowMoving !== this.moving){ this.moving = nowMoving; this.animT = 0; this.animI = 0; }
    const rate = this.moving ? PLAYER.FLY_FPS : PLAYER.IDLE_FPS;
    this.animT += dt;
    while(this.animT >= rate){ this.animT -= rate; this.animI++; }

    // 현재 포즈 확정 (상승/하강 시 날갯짓을 치우치게)
    const seq = this.moving ? FLY_SEQ : IDLE_SEQ;
    let pose = seq[this.animI % seq.length];
    if(this.vy < -PLAYER.SPEED*0.45)      pose = Math.min(3, pose + 1);
    else if(this.vy > PLAYER.SPEED*0.45)  pose = Math.max(0, pose - 1);
    this.pose = pose;

    /* 턱 — 불을 뿜으면 벌어지고, 조용할 때도 이따금 혼자 벌린다.
       숨 쉬듯 규칙적이면 기계 같아서 다음 간격을 매번 새로 뽑는다. */
    if(this.mawT > 0) this.mawT -= dt;
    else {
      this.mawNext -= dt;
      if(this.mawNext <= 0){ this.mawT = 0.34; this.mawNext = 1.6 + Math.random()*3.2; }
    }

    // 잔상 궤적 (최근 8프레임)
    this.trail.push({ x:this.x, y:this.y, pose:pose });
    if(this.trail.length > 8) this.trail.shift();
  }
  render(ctx){
    const pose = this.pose;
    // 정지 시 몸체가 위아래로 살짝 (도트 단위로 스냅)
    const bob = this.moving ? 0 : snap(Math.sin(this.t * 3.2) * 3);

    // --- 잔상 : 빠르게 움직일 때 뒤에 푸른 실루엣을 남겨 속도감을 준다 ---
    const spd = Math.hypot(this.vx, this.vy);
    if(spd > PLAYER.SPEED*0.5){
      const k = Math.min(1, (spd/PLAYER.SPEED - 0.5) / 0.5);
      for(let i=0; i<3; i++){
        const g = this.trail[this.trail.length - 1 - (i+1)*2];
        if(!g) continue;
        ctx.globalAlpha = (0.30 - i*0.09) * k;
        drawDragon(ctx, this.dragon.pal, this.level, g.x, g.y, g.pose, false, '#6fb8ff',
                   null, this.dragonIdx, false);
      }
      ctx.globalAlpha = 1;
    }

    // 레벨업 직후 잠깐 흰빛 (성장 연출)
    if(this.growT > 0){
      const k = this.growT / 0.45;
      if(Math.floor(this.growT * 24) % 2 === 0){
        const dg = this.dragon;
        drawDragon(ctx, dg.pal, this.level, this.x, this.y + bob, pose, false, '#fff2c0', dg.always,
                   this.dragonIdx, false);
        return;
      }
      ctx.globalAlpha = 1;
    }
    const dg = this.dragon;
    drawDragon(ctx, dg.pal, this.level, this.x, this.y + bob, pose, false, null, dg.always,
               this.dragonIdx, this.mawT > 0);
    /* 산 무장은 1P 것이다 — 2P 는 맨몸으로 낀 손님이다 */
    if(this.pid === 1 && (EQ.head || EQ.leg || EQ.mask))
      drawGear(ctx, this.x, this.y + bob, this.metrics, this.t,
               EQ.head, EQ.leg, EQ.mask, EQ.maskLv);
  }
}

/* ==================================================================
   Phase 7 : 20 스테이지 배경 / 진행 저장 / 해금
   ================================================================== */

/* ---------------- 저장 (localStorage. file:// 에서 막혀도 안전하게) ---------------- */
const Save = {
  KEY: 'dragonstriker.save.v1',
  data: { unlocked: 1, level: 1, dragon: 0, bgm: 0, best: {}, opt: null },
  available: true,
  load(){
    try{
      const j = localStorage.getItem(this.KEY);
      if(j) Object.assign(this.data, JSON.parse(j));
      localStorage.setItem(this.KEY + '.t', '1');      // 쓰기까지 되는지 확인
      localStorage.removeItem(this.KEY + '.t');
    }catch(e){ this.available = false; }               // 막힌 환경 - 메모리로만 진행
    this.data.unlocked = clamp(this.data.unlocked|0, 1, 20) || 1;
    this.data.level    = clamp(this.data.level|0, 1, MAX_LEVEL) || 1;
    this.data.dragon   = clamp(this.data.dragon|0, 0, 9);
    this.data.bgm      = clamp(this.data.bgm|0, 0, 2);
    if(!this.data.best) this.data.best = {};
  },
  save(){ try{ localStorage.setItem(this.KEY, JSON.stringify(this.data)); }catch(e){} },
  clearAll(){ this.data = { unlocked:1, level:1, dragon:0, bgm:0, best:{}, opt:null }; this.save(); }
};

/* ---------------- 스테이지 정의 ----------------
   layers : [원경, 중경, 근경, 전경] 각각 {s:형태, b:기준선, a:진폭, r:거칠기, c:색}
   형태 : hill(구릉) peak(험준) tree(침엽수) leaf(활엽수) temple(유적) flat(평지) none(없음)  */
const STAGES = [null,
  { n:'모래의 피라미드', mark:{ s:'pyramid', x:0.50, y:700, w:420, h:330, c:'#a4794c', l:'mid' }, acc:'#e0a83a', line:'#fff0c0', cloud:'#ffe6b0', cloudA:0.22, fx:null,
    sky:[{p:0,c:'#3a2a6b'},{p:.3,c:'#7a4a86'},{p:.58,c:'#d8874f'},{p:.8,c:'#f0b96a'},{p:1,c:'#f7dca0'}],
    layers:[{s:'temple',b:600,a:150,r:14,c:'#8a6a45'},{s:'temple',b:668,a:110,r:16,c:'#6b4f34'},
            {s:'flat',  b:736,a: 46,r:26,c:'#c79a5c'},{s:'flat',b:794,a:44,r:34,c:'#8a6535'}] },
  { n:'대리석 신전', mark:{ s:'columns', x:0.46, y:700, w:380, h:300, c:'#d6dbe4', l:'mid' }, acc:'#e8eef7', line:'#ffffff', cloud:'#ffffff', cloudA:0.30, fx:null,
    sky:[{p:0,c:'#2a5a9e'},{p:.35,c:'#5a9ccc'},{p:.65,c:'#a8d4e0'},{p:.85,c:'#dcecd8'},{p:1,c:'#f4f0dc'}],
    layers:[{s:'peak',  b:588,a:130,r:22,c:'#7e93b4'},{s:'temple',b:664,a:118,r:12,c:'#c9cfd8'},
            {s:'temple',b:736,a: 66,r:14,c:'#9aa3b0'},{s:'flat',b:792,a:44,r:30,c:'#6b7280'}] },
  { n:'잊혀진 정글 유적', mark:{ s:'ziggurat', x:0.52, y:706, w:400, h:320, c:'#7d7a54', l:'mid' },      acc:'#c9a227', line:'#e8ffd0', cloud:'#dff0d0', cloudA:0.24, fx:null,
    sky:[{p:0,c:'#1c3a4a'},{p:.32,c:'#2f6b6a'},{p:.6,c:'#5d9a6a'},{p:.84,c:'#a8c47a'},{p:1,c:'#e0d89a'}],
    layers:[{s:'temple',b:596,a:146,r:16,c:'#6d6a4a'},{s:'tree', b:672,a:104,r:20,c:'#2f5a38'},
            {s:'leaf',  b:738,a: 70,r:24,c:'#1e3f26'},{s:'flat',b:792,a:46,r:34,c:'#14291a'}] },
  { n:'북녘 침엽수림', rule:'swarm', mark:{ s:'bigtree', x:0.44, y:720, w:300, h:400, c:'#16413f', l:'mid' },  acc:'#6fd0c0', line:'#dffaff', cloud:'#cfe4f0', cloudA:0.26, fx:'snow',
    sky:[{p:0,c:'#122a4a'},{p:.34,c:'#28527e'},{p:.62,c:'#4f86a8'},{p:.85,c:'#9cc4cc'},{p:1,c:'#dcecec'}],
    layers:[{s:'peak',b:580,a:158,r:26,c:'#5e7a96'},{s:'tree',b:664,a:118,r:18,c:'#1f4442'},
            {s:'tree',b:740,a: 84,r:22,c:'#12302f'},{s:'tree',b:806,a:60,r:26,c:'#0a1e1e'}] },
  { n:'붉게 물든 단풍 계곡', mark:{ s:'arch', x:0.54, y:712, w:400, h:300, c:'#8d5a4a', l:'mid' },     acc:'#ff7a2e', line:'#ffe0c0', cloud:'#ffd9b8', cloudA:0.26, fx:'leaf',
    sky:[{p:0,c:'#4a2038'},{p:.32,c:'#8a3a44'},{p:.6,c:'#c96a44'},{p:.84,c:'#e8a45c'},{p:1,c:'#f6d89a'}],
    layers:[{s:'hill',b:594,a:132,r:22,c:'#7a4a55'},{s:'leaf',b:668,a:112,r:20,c:'#b84a2a'},
            {s:'leaf',b:742,a: 82,r:24,c:'#8a2f1e'},{s:'leaf',b:806,a:58,r:28,c:'#5a1d14'}] },
  { n:'안개 낀 대나무 숲', rule:'fog', mark:{ s:'pagoda', x:0.48, y:716, w:260, h:380, c:'#35704a', l:'mid' },     acc:'#8fe36b', line:'#eaffd0', cloud:'#e0f4d0', cloudA:0.22, fx:null,
    sky:[{p:0,c:'#1e4230'},{p:.34,c:'#3a7a4a'},{p:.62,c:'#6fae62'},{p:.85,c:'#b4d894'},{p:1,c:'#e6f2c4'}],
    layers:[{s:'hill',b:596,a:124,r:20,c:'#3f7a52'},{s:'tree',b:670,a:120,r:14,c:'#2b6238'},
            {s:'tree',b:744,a: 92,r:16,c:'#1a4526'},{s:'tree',b:808,a:64,r:20,c:'#0f2c18'}] },
  { n:'피오르드 절벽', mark:{ s:'waterfall', x:0.50, y:748, w:460, h:380, c:'#33526f', l:'mid' },     acc:'#6fb8ff', line:'#dff0ff', cloud:'#cfe0f0', cloudA:0.28, fx:null,
    sky:[{p:0,c:'#0e2440'},{p:.32,c:'#1f4a76'},{p:.6,c:'#3f7fa8'},{p:.84,c:'#8fbcc8'},{p:1,c:'#d0e4e4'}],
    layers:[{s:'peak',b:566,a:186,r:30,c:'#4a6684'},{s:'peak',b:660,a:140,r:28,c:'#2c4560'},
            {s:'flat',b:742,a: 38,r:12,c:'#1b3d5c'},{s:'flat',b:796,a:34,r:16,c:'#10283f'}] },
  { n:'얼어붙은 설원', rule:'rocks', mark:{ s:'iceberg', x:0.52, y:744, w:420, h:330, c:'#8ba3bb', l:'mid' },   acc:'#cfe8ff', line:'#ffffff', cloud:'#e8f2ff', cloudA:0.32, fx:'snow',
    sky:[{p:0,c:'#1b2a44'},{p:.34,c:'#3a5a80'},{p:.62,c:'#6f8fae'},{p:.85,c:'#b8cdd8'},{p:1,c:'#eef4f6'}],
    layers:[{s:'peak',b:578,a:162,r:26,c:'#7b90a8'},{s:'tree',b:668,a:112,r:18,c:'#2a4450'},
            {s:'tree',b:744,a: 80,r:22,c:'#1a2e36'},{s:'flat',b:800,a:48,r:30,c:'#dfe9f0'} ] },
  { n:'남쪽 바다의 해안', mark:{ s:'lighthouse', x:0.46, y:736, w:220, h:380, c:'#e8e2d2', l:'mid' },     acc:'#3fe0c8', line:'#dffff8', cloud:'#ffffff', cloudA:0.30, fx:null,
    sky:[{p:0,c:'#1a5a8e'},{p:.32,c:'#2f8fb4'},{p:.6,c:'#5fc4c4'},{p:.84,c:'#a8e4cc'},{p:1,c:'#f0e8c0'}],
    layers:[{s:'hill',b:592,a:118,r:20,c:'#3a7f86'},{s:'leaf',b:668,a: 96,r:20,c:'#237a5e'},
            {s:'flat',b:742,a: 40,r:10,c:'#2fb0a8'},{s:'flat',b:796,a:40,r:26,c:'#e8d69a'}] },
  { n:'검은 늪지대', rule:'dark', mark:{ s:'deadtree', x:0.50, y:740, w:300, h:360, c:'#2c3324', l:'mid' },      acc:'#9fc04a', line:'#d8e8b0', cloud:'#b8c49a', cloudA:0.26, fx:null,
    sky:[{p:0,c:'#20281c'},{p:.34,c:'#3d4a2c'},{p:.62,c:'#5f6f3a'},{p:.85,c:'#8a9450'},{p:1,c:'#b6b878'}],
    layers:[{s:'leaf',b:600,a:112,r:24,c:'#4a5730'},{s:'leaf',b:672,a: 96,r:26,c:'#333d20'},
            {s:'flat',b:744,a: 34,r:12,c:'#3f4a28'},{s:'flat',b:798,a:42,r:30,c:'#232a15'}] },
  { n:'봄빛 해안선', mark:{ s:'torii', x:0.50, y:736, w:320, h:300, c:'#c4423c', l:'mid' },     acc:'#ff9ec4', line:'#ffe8f2', cloud:'#ffd8e8', cloudA:0.28, fx:'leaf',
    sky:[{p:0,c:'#4a3a6b'},{p:.32,c:'#8a5f96'},{p:.6,c:'#d08fae'},{p:.84,c:'#f4c0cc'},{p:1,c:'#ffe8dc'}],
    layers:[{s:'hill',b:592,a:126,r:20,c:'#8f7aa8'},{s:'leaf',b:668,a: 98,r:20,c:'#d47f9e'},
            {s:'flat',b:742,a: 38,r:10,c:'#7fa8c4'},{s:'flat',b:796,a:40,r:28,c:'#5a6f96'}] },
  { n:'황금빛 해안', rule:'gale', mark:{ s:'windmill', x:0.46, y:736, w:260, h:360, c:'#b98a4e', l:'mid' },     acc:'#ffc44a', line:'#fff0c8', cloud:'#ffe2b0', cloudA:0.26, fx:'leaf',
    sky:[{p:0,c:'#40285a'},{p:.32,c:'#8a4a5e'},{p:.6,c:'#d08a4a'},{p:.84,c:'#f0bc6a'},{p:1,c:'#ffe8b8'}],
    layers:[{s:'hill',b:592,a:130,r:22,c:'#8a6a58'},{s:'leaf',b:668,a: 98,r:22,c:'#c98a3a'},
            {s:'flat',b:742,a: 38,r:10,c:'#7a86a8'},{s:'flat',b:796,a:40,r:28,c:'#4f5f80'}] },
  { n:'구름 한 점 없는 하늘', mark:{ s:'airship', x:0.50, y:470, w:520, h:300, c:'#d8dee8', l:'far' },        acc:'#6fc8ff', line:'#ffffff', cloud:'#ffffff', cloudA:0.42, fx:null,
    sky:[{p:0,c:'#1f5fae'},{p:.34,c:'#4a94d4'},{p:.64,c:'#8fc4ea'},{p:.86,c:'#c4e2f4'},{p:1,c:'#eaf6ff'}],
    layers:[{s:'none'},{s:'none'},{s:'none'},{s:'none'}] },
  { n:'잿빛 구름바다', rule:'bolt', mark:{ s:'skyfort', x:0.48, y:500, w:460, h:380, c:'#6d7688', l:'far' },         acc:'#b8c4d4', line:'#e8eef4', cloud:'#c8d2de', cloudA:0.5, fx:null,
    sky:[{p:0,c:'#3a4356'},{p:.34,c:'#5c6779'},{p:.64,c:'#848e9e'},{p:.86,c:'#aeb6c2'},{p:1,c:'#d2d8e0'}],
    layers:[{s:'none'},{s:'none'},{s:'none'},{s:'none'}] },
  { n:'노을이 타는 하늘', mark:{ s:'sun', x:0.52, y:640, w:460, h:460, c:'#ff9440', l:'far' },      acc:'#ff8a3a', line:'#ffd8b0', cloud:'#ffb884', cloudA:0.40, fx:null,
    sky:[{p:0,c:'#2a1a52'},{p:.28,c:'#6b2a6b'},{p:.55,c:'#c0455a'},{p:.78,c:'#f08040'},{p:1,c:'#ffd07a'}],
    layers:[{s:'none'},{s:'none'},{s:'none'},{s:'none'}] },
  { n:'쏟아지는 빗줄기', rule:'swarm', mark:{ s:'raincloud', x:0.50, y:430, w:700, h:280, c:'#4a5768', l:'far' },         acc:'#7fd0e0', line:'#cfe8f0', cloud:'#8fa0b0', cloudA:0.46, fx:'rain',
    sky:[{p:0,c:'#1e2836'},{p:.34,c:'#334154'},{p:.64,c:'#4f6072'},{p:.86,c:'#6f8090'},{p:1,c:'#8fa0ae'}],
    layers:[{s:'none'},{s:'none'},{s:'none'},{s:'none'}] },
  { n:'천둥이 치는 폭풍', rule:'bolt', mark:{ s:'spire', x:0.50, y:800, w:300, h:520, c:'#3b3155', l:'mid' },     acc:'#c8a0ff', line:'#e0d0ff', cloud:'#6a5f86', cloudA:0.5, fx:'storm',
    sky:[{p:0,c:'#14102a'},{p:.34,c:'#241e46'},{p:.64,c:'#3a2f62'},{p:.86,c:'#54467e'},{p:1,c:'#6f5f96'}],
    layers:[{s:'none'},{s:'none'},{s:'none'},{s:'none'}] },
  { n:'지구 궤도', rule:'rocks', mark:{ s:'planet', x:0.50, y:860, w:900, h:300, c:'#2a5a96', l:'far' },      acc:'#5fd0ff', line:'#bfe8ff', cloud:'#3a6fae', cloudA:0.16, fx:'stars',
    sky:[{p:0,c:'#05060f'},{p:.4,c:'#0a0f24'},{p:.7,c:'#101a3a'},{p:.9,c:'#1c2f5c'},{p:1,c:'#2a4a86'}],
    layers:[{s:'none'},{s:'none'},{s:'none'},{s:'none'}] },
  { n:'소행성 지대', rule:'gale', mark:{ s:'asteroid', x:0.46, y:480, w:420, h:320, c:'#6b6050', l:'far' },    acc:'#c8b89a', line:'#e0d8c8', cloud:'#4a4238', cloudA:0.18, fx:'stars',
    sky:[{p:0,c:'#07060c'},{p:.4,c:'#0d0b18'},{p:.72,c:'#171326'},{p:.92,c:'#241c38'},{p:1,c:'#33284a'}],
    layers:[{s:'peak',b:640,a:96,r:44,c:'#4a4238'},{s:'none'},{s:'peak',b:790,a:70,r:52,c:'#2b261f'},{s:'none'}] },
  { n:'은하의 끝', mark:{ s:'galaxy', x:0.52, y:430, w:620, h:260, c:'#7a45a8', l:'far' },       acc:'#c08fff', line:'#e8d0ff', cloud:'#6a3f9e', cloudA:0.22, fx:'stars',
    sky:[{p:0,c:'#06040f'},{p:.32,c:'#140b2a'},{p:.58,c:'#2a1250'},{p:.8,c:'#4a1f72'},{p:1,c:'#7a3f9e'}],
    layers:[{s:'none'},{s:'none'},{s:'none'},{s:'none'}] }
];

/* 스테이지 테마색을 입힌 최종보스 팔레트 (캐시) */
const _bossPalCache = {};
/* 최종보스 외형 등급. 스테이지가 오를수록 가시/칼날이 붙고 색이 험악해진다. */
function bossTierOf(stage){
  const s = clamp(stage|0, 1, 20);
  return s <= 4 ? 0 : s <= 8 ? 1 : s <= 12 ? 2 : s <= 16 ? 3 : 4;
}
/**
 * ★★ **보스의 부위.** (기획 5, 2026-08-27)
 *
 * 보스는 **통짜 체력 하나**였다. 어디를 쏘든 똑같으니 조준할 이유가 없고,
 * 보스전이 그냥 "오래 깎기" 였다.
 *
 * 뿔·등가시·꼬리칼날을 각각 부술 수 있게 하고, 부수면 **그 부위가 쓰던 패턴이
 * 봉인**된다. 그러면 보스전이 "깎기" 에서 **"고르기"** 가 된다 —
 * 꼬리를 먼저 부술까 뿔을 먼저 부술까. 같은 보스를 두 번째로 만나도
 * 다른 순서로 싸울 수 있다.
 *
 * 부위는 보스 본체 체력의 일부를 나눠 갖지 않는다. **따로 센다** —
 * 그래야 "부위를 부수느라 시간을 버렸다" 가 아니라 "부수면 편해진다" 가 된다.
 * 부순 만큼 본체도 조금 깎이므로 부수는 것이 손해는 아니다.
 *
 * 어디를 맞혔는지는 **높이로** 가른다. 가로로 나가는 불줄기에 대고
 * 세로 위치를 고르는 것이 이 게임에서 할 수 있는 유일한 조준이기 때문이다.
 *   위쪽 28%  -> 뿔    (소용돌이 브레스가 봉인된다)
 *   가운데     -> 몸통 (봉인 없음)
 *   아래 26%  -> 꼬리  (돌진이 봉인된다)
 *   등        -> 등가시 (화염벽이 봉인된다) — 뿔 바로 아래 띠
 */
const BOSS_PART_DEFS = [
  { key:'horn',  ko:'뿔',     lo:0.00, hi:0.20, seal:'swirl',  hp:0.10 },
  { key:'ridge', ko:'등가시', lo:0.20, hi:0.36, seal:'wall',   hp:0.10 },
  { key:'tail',  ko:'꼬리',   lo:0.76, hi:1.00, seal:'charge', hp:0.10 },
];

/**
 * ★ **보스 10종.** (2026-08-26)
 *
 * 예전에는 스무 판의 보스가 **전부 같은 실루엣**이었다 — 몸통도 날개도 하나뿐이고
 * 등급(4판마다)에 따라 등가시와 꼬리칼날이 붙는 것, 그리고 색이 스테이지 테마를
 * 따라가는 것이 전부였다. 10판째 보스와 18판째 보스를 나란히 놓으면 구별이 안 됐다.
 *
 * 새 그림을 그리는 대신 **이미 있는 파츠를 조합**한다. 뿔은 열 벌이 이미 있고
 * (`B_HORNS`, 플레이어 드래곤 열 마리가 쓰던 것), 벌린 아가리(`B_MAW`),
 * 등가시, 꼬리칼날, 왕관 기수가 있다. 여기에 크기와 색을 얹으면
 * **열 마리가 서로 다른 덩치와 윤곽**을 갖는다.
 *
 * 두 판에 한 마리씩 — 20판이면 열 마리를 두 번 만난다. 뒤로 갈수록 파츠가
 * 늘고 덩치가 커져서 "더 험한 놈이 나왔다" 가 눈으로 읽힌다.
 *
 * ## 덩치를 키우면 맞히기 쉬워진다
 *
 * 판정 상자를 크기에서 뽑으므로 큰 보스는 그만큼 잘 맞는다. 그래서 **체력을
 * 덩치에 비례해 올린다** — 안 그러면 마지막 보스가 제일 쉬운 보스가 된다.
 */
const BOSS_KINDS = [
  /* 뿔 / 등가시 / 꼬리칼날 / 벌린 아가리 / 덩치 / 색 */
  { n:'ROTGRAVE',  horn:0, ridge:0, tail:0, maw:0, cell:10.0, hue:'#7f9a6a' },
  { n:'SPINEBACK', horn:2, ridge:1, tail:0, maw:0, cell:10.3, hue:'#6a8fb4' },
  { n:'ASHMAW',    horn:4, ridge:0, tail:0, maw:1, cell:10.5, hue:'#b47a4a' },
  { n:'TWISTHORN', horn:6, ridge:1, tail:0, maw:0, cell:10.8, hue:'#8f6ab4' },
  { n:'BLADETAIL', horn:3, ridge:0, tail:1, maw:0, cell:10.8, hue:'#4aa494' },
  { n:'ABYSSJAW',  horn:7, ridge:1, tail:0, maw:1, cell:11.1, hue:'#3f5f9e' },
  { n:'CROWNWYRM', horn:5, ridge:1, tail:1, maw:0, cell:11.3, hue:'#c4a03a' },
  { n:'DOOMHORN',  horn:8, ridge:1, tail:1, maw:1, cell:11.6, hue:'#a4404a' },
  { n:'VOIDKING',  horn:9, ridge:1, tail:1, maw:1, cell:11.9, hue:'#5a3f8f' },
  { n:'CHAOSLORD', horn:1, ridge:1, tail:1, maw:1, cell:12.3, hue:'#d0402a' },
];
/** 두 판에 한 마리 — 1~2판이 첫째, 19~20판이 열째다 */
function bossKindOf(stage){
  return BOSS_KINDS[clamp(((clamp(stage | 0, 1, 20) - 1) / 2) | 0, 0, 9)];
}
/**
 * 이 보스가 걸치는 것들. 뿔은 **몸통보다 먼저** 그려야 밑동이 두개골에 가려
 * 자연스럽게 박혀 보인다 (`paintDragon` 이 같은 이유로 그렇게 한다).
 */
function bossPartsOf(kind){
  const f = FORMS.B;
  const under = f.horns ? [f.horns[kind.horn % f.horns.length]] : [];
  const over = [];
  if(kind.tail)  over.push(f.parts.tail);
  if(kind.ridge) over.push(f.parts.ridge);
  if(kind.maw && f.maw) over.push(f.maw);
  over.push(B_RIDER_KING);
  return { under, over };
}
function bossPalOf(stage){
  if(_bossPalCache[stage]) return _bossPalCache[stage];
  const acc = STAGES[clamp(stage,1,20)].acc;
  const tier = bossTierOf(stage);
  /**
   * ★ 스테이지 테마색만 섞으면 이웃한 판의 보스가 서로 닮는다 (2026-08-26).
   * 종류 고유색을 함께 섞어 **열 마리가 각자의 색**을 갖게 한다.
   */
  const hue = bossKindOf(stage).hue;
  const p = {};
  for(const k in BOSS_PAL) p[k] = mixHex(mixHex(BOSS_PAL[k], acc, 0.34), hue, 0.30);
  // 등급이 오를수록 몸을 어둡게 가라앉히고 가시/발톱은 핏빛으로 -> 악의 기운
  if(tier > 0){
    const dark = tier * 0.13;
    for(const k of ['K','D','M','L','T','w','f','k'])
      if(p[k]) p[k] = mixHex(p[k], '#090410', dark);
    const blood = ['#ff2b3c','#ff1f2e','#e01024','#c4001c','#a80018'][tier];
    p.S = mixHex(p.S || '#8f7ec4', blood, 0.35 + tier*0.12);
    p.C = mixHex(p.C || '#e6dff2', blood, 0.20 + tier*0.12);
    p.G = mixHex(p.G || '#b8a9d4', blood, 0.25 + tier*0.10);
  }
  p.E = ['#ff2b3c','#ff6a1e','#ffd12b','#8cff3a','#ff2bd0'][tier];   // 눈빛도 달라진다
  p.H = BOSS_PAL.H; p.W = BOSS_PAL.W;
  return (_bossPalCache[stage] = Object.assign(p, RIDER_EXTRA));
}

/* ==================================================================
   날씨 / 우주 연출
   ================================================================== */
class Weather {
  constructor(kind, seed){
    this.kind = kind; this.t = 0; this.flash = 0; this.next = 2 + Math.random()*4;
    const rnd = mulberry32(seed || 11);
    this.p = [];
    if(kind === 'rain' || kind === 'storm'){
      for(let i=0;i<150;i++)
        this.p.push({ x:rnd()*GAME_W, y:rnd()*GAME_H, v:900+rnd()*500, len:snap(18+rnd()*26) });
    }else if(kind === 'snow'){
      for(let i=0;i<90;i++)
        this.p.push({ x:rnd()*GAME_W, y:rnd()*GAME_H, v:70+rnd()*90, s:rnd()>0.7?PX*2:PX, ph:rnd()*6.3 });
    }else if(kind === 'leaf'){
      for(let i=0;i<46;i++)
        this.p.push({ x:rnd()*GAME_W, y:rnd()*GAME_H, v:120+rnd()*140, s:rnd()>0.6?PX*2:PX, ph:rnd()*6.3 });
    }else if(kind === 'stars'){
      for(let i=0;i<180;i++)
        this.p.push({ x:snap(rnd()*GAME_W), y:snap(rnd()*GAME_H), v:20+rnd()*140,
                      s:rnd()>0.88?PX*2:PX, ph:rnd()*6.3, sp:1+rnd()*3 });
    }
  }
  update(dt, K){
    this.t += dt;
    if(this.flash > 0) this.flash -= dt;
    if(this.kind === 'storm'){
      this.next -= dt;
      if(this.next <= 0){ this.next = 2.5 + Math.random()*5; this.flash = 0.26; Shake.add(4, 0.2); }
    }
    for(const q of this.p){
      if(this.kind === 'rain' || this.kind === 'storm'){
        q.y += q.v*dt; q.x -= q.v*0.34*dt*K;
        if(q.y > GAME_H){ q.y = -30; q.x = Math.random()*GAME_W*1.4; }
      }else if(this.kind === 'snow' || this.kind === 'leaf'){
        q.y += q.v*dt; q.x -= (140 + q.v)*K*dt*0.6;
        if(q.y > GAME_H || q.x < -20){ q.y = -20; q.x = Math.random()*GAME_W*1.3; }
      }else if(this.kind === 'stars'){
        q.x -= q.v*K*dt;
        if(q.x < -8){ q.x = GAME_W + Math.random()*80; q.y = snap(Math.random()*GAME_H); }
      }
    }
  }
  /* 배경 레이어 (별) */
  renderBack(ctx){
    if(this.kind !== 'stars') return;
    for(const q of this.p){
      ctx.globalAlpha = 0.35 + 0.65*(0.5 + 0.5*Math.sin(this.t*q.sp + q.ph));
      ctx.fillStyle = q.s > PX ? '#bfe8ff' : '#ffffff';
      ctx.fillRect(snap(q.x), q.y, q.s, q.s);
    }
    ctx.globalAlpha = 1;
  }
  /* 전경 레이어 (비/눈/낙엽 + 번개 플래시) */
  renderFront(ctx){
    if(this.kind === 'rain' || this.kind === 'storm'){
      ctx.globalAlpha = 0.42; ctx.fillStyle = '#cfe8ff';
      for(const q of this.p) ctx.fillRect(snap(q.x), snap(q.y), PX, q.len);
      ctx.globalAlpha = 1;
    }else if(this.kind === 'snow'){
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#ffffff';
      for(const q of this.p) ctx.fillRect(snap(q.x + Math.sin(this.t*1.6 + q.ph)*14), snap(q.y), q.s, q.s);
      ctx.globalAlpha = 1;
    }else if(this.kind === 'leaf'){
      const cols = ['#ff9a3a','#e05a2a','#ffc44a','#b8452a'];
      for(let i=0;i<this.p.length;i++){
        const q = this.p[i];
        ctx.fillStyle = cols[i & 3];
        ctx.fillRect(snap(q.x + Math.sin(this.t*2.2 + q.ph)*20), snap(q.y), q.s, q.s);
      }
    }
    if(this.flash > 0){
      ctx.globalAlpha = Math.min(0.75, this.flash * 2.6);
      ctx.fillStyle = '#e8e0ff'; ctx.fillRect(0,0,GAME_W,GAME_H);
      ctx.globalAlpha = 1;
    }
  }
}

/* ==================================================================
   Phase 3 : 전투 - 파이어 블레스 / 적 / 타격감
   ================================================================== */

/* ---------------- 화면 흔들림 ---------------- */
const Shake = {
  x:0, y:0, t:0, dur:0, mag:0,
  add(mag, dur){
    if(mag >= this.mag || this.t <= 0){ this.mag = mag; this.dur = dur; this.t = dur; }
  },
  update(dt){
    if(this.t <= 0){ this.x = this.y = 0; return; }
    this.t -= dt;
    if(this.t <= 0){ this.t = 0; this.x = this.y = 0; this.mag = 0; return; }
    const k = this.t / this.dur;                       // 점점 잦아듦
    const m = this.mag * k;
    this.x = snap((Math.random()*2 - 1) * m);
    this.y = snap((Math.random()*2 - 1) * m);
  }
};

/* ---------------- 히트스톱 : 타격 순간 화면을 아주 잠깐 얼려 임팩트를 만든다 ---------------- */
const Freeze = {
  t: 0,
  add(sec){ this.t = Math.min(0.16, Math.max(this.t, sec)); },
  reset(){ this.t = 0; }
};

/* ---------------- 화면 플래시 ---------------- */
const Flash = {
  t: 0, dur: 0, color: '#ffffff',
  add(color, dur, strength){
    if(this.t > 0 && this.dur >= dur) return;
    this.color = color; this.dur = dur; this.t = dur; this.k = strength || 0.5;
  },
  update(dt){ if(this.t > 0) this.t -= dt; },
  render(ctx){
    if(this.t <= 0) return;
    ctx.globalAlpha = (this.t / this.dur) * this.k;
    ctx.fillStyle = this.color; ctx.fillRect(0,0,GAME_W,GAME_H);
    ctx.globalAlpha = 1;
  },
  reset(){ this.t = 0; }
};

/* ---------------- 점수 팝업 ---------------- */
const Popups = {
  list: [],
  /**
   * @param {boolean} [hangul] 한글이 섞여 있으면 true —
   *   숫자·영문은 게임 자체 도트 글꼴이 예쁘고, 한글은 오락실 글꼴에만 있다.
   *   섞어 쓰는 대신 부르는 쪽이 어느 쪽인지 알려 준다.
   */
  /**
   * ★ **전부 한 단계씩 줄인다.** (2026-08-27, 사용자 지정)
   *
   * *"게임도중에 튀어나오는 문자들 (...) 글씨가 너무커, 적당히 커야지.
   *   왼쪽 맨 위에 점수, 금화 한글로 써 있는데 그정도 크기가 딱 좋아"*
   *
   * 좌상단 패널이 라벨 2 · 숫자 3 이다. 부르는 곳이 열두 군데라 하나씩 고치면
   * 또 어긋나므로 **들어오는 자리 한 곳에서** 줄인다 — 3->2 / 4->2 / 5->3 / 7->4.
   */
  add(x, y, text, color, size, hangul){
    if(this.list.length > 24) this.list.shift();
    size = clamp(Math.round((size || 3) * 0.6), 2, 4);
    this.list.push({ x, y, text:String(text), color: color || PAL.gold, size,
                     t: 0, max: 0.85, ko: !!hangul });
  },
  update(dt){
    for(let i=this.list.length-1;i>=0;i--){
      const o = this.list[i];
      o.t += dt; o.y -= 70*dt;
      if(o.t >= o.max) this.list.splice(i,1);
    }
  },
  render(ctx){
    for(const o of this.list){
      const k = o.t / o.max;
      const a = k < 0.7 ? 1 : (1-k)/0.3;
      if(o.ko){
        /* 오락실 글꼴에는 alpha 옵션이 없어서 컨텍스트로 건다 */
        const prev = ctx.globalAlpha; ctx.globalAlpha = prev * a;
        ko(ctx, o.text, o.x, o.y, o.size, { align:'center', color:o.color, outline:PAL.outline });
        ctx.globalAlpha = prev;
      }else{
        drawText(ctx, o.text, o.x, o.y, o.size,
          { align:'center', color:o.color, outline:PAL.outline, alpha: a });
      }
    }
  },
  clear(){ this.list.length = 0; }
};

/**
 * 남은 시간 게이지.
 *
 * ★ **신발을 찾아서의 게이지를 그대로 본떴다.** (2026-08-26, 사용자 지정)
 *
 * 그 게이지가 예쁜 이유는 장식이 많아서가 아니라 **층이 또렷해서**다.
 * `public/assets/ui/gauge_frame.png` 를 도트로 뜯어 보면 네 겹이다:
 *
 *     ┌ 모서리를 깎은 검은 외곽선          ← 배경에서 확실히 떨어진다
 *     │ ┌ 밝은 베벨 한 줄                  ← 금속처럼 도드라진다
 *     │ │ ┌ 깊고 어두운 우물                ← 채움이 "담겨" 보인다
 *     │ │ │ 채움 (30% 밑이면 경고색)
 *
 * 내 앞 판은 이 층이 없이 통짜 막대에 눈금만 그어서 자(尺)처럼 보였다.
 *
 * 체력바와 헷갈리지 않게 두 가지를 더한다:
 *   · 왼쪽 끝에 **모래시계** — 이게 시간이라는 걸 한 글자로 말한다
 *   · 채움이 **오른쪽에서 깎여 나간다** — 체력은 줄기만 하지만 시간은 '지나간다'
 */
function drawTimeBar(ctx, B, k, t){
  const low = k <= 0.25;
  const R = PX * 2;                       // 깎아 낼 모서리 크기

  /* ── 외곽선 (모서리를 깎아 둥글게) ── */
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(B.x - PX, B.y - PX + R, B.w + PX*2, B.h + PX*2 - R*2);
  ctx.fillRect(B.x - PX + R, B.y - PX, B.w + PX*2 - R*2, B.h + PX*2);

  /* ── 베벨 (윗면은 밝고 아랫면은 어둡다 — 빛이 위에서 온다) ── */
  ctx.fillStyle = '#5a6480';
  ctx.fillRect(B.x, B.y, B.w, B.h);
  ctx.fillStyle = '#8a94b0';
  ctx.fillRect(B.x + R, B.y, B.w - R*2, PX);
  ctx.fillStyle = '#2a3040';
  ctx.fillRect(B.x + R, B.y + B.h - PX, B.w - R*2, PX);

  /* ── 우물 (안쪽으로 파인 자리) ── */
  const w = { x: B.x + PX*2, y: B.y + PX*2, w: B.w - PX*4, h: B.h - PX*4 };
  ctx.fillStyle = '#10131c';
  ctx.fillRect(w.x, w.y, w.w, w.h);

  /* ── 채움 ── */
  const fw = Math.max(0, snap(w.w * k));
  if(fw > 0){
    ctx.fillStyle = low ? '#c81f2e' : '#2f8fd8';
    ctx.fillRect(w.x, w.y, fw, w.h);
    /* 위쪽 유리광 — 한 줄만 밝게 두면 유리에 담긴 것처럼 보인다 */
    ctx.fillStyle = low ? '#ff7a7a' : '#7fd8ff';
    ctx.fillRect(w.x, w.y, fw, PX);
    ctx.fillStyle = low ? '#8f0f1c' : '#1b5d94';
    ctx.fillRect(w.x, w.y + w.h - PX, fw, PX);

    /* 흐르는 빗금 — 시간이 '지나가는 중' 이라는 신호. 체력바는 안 움직인다 */
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * 0.16;
    ctx.fillStyle = '#ffffff';
    const step = PX * 8, off = Math.floor((t * 26) % step);
    for(let sx = -step + off; sx < fw; sx += step){
      for(let dy = 0; dy < w.h; dy += PX){
        const px_ = w.x + sx + (w.h - dy);      // 오른쪽으로 기운 빗금
        if(px_ >= w.x && px_ < w.x + fw) ctx.fillRect(snap(px_), w.y + dy, PX*2, PX);
      }
    }
    ctx.globalAlpha = prev;

    /* 깎여 나가는 끝 — 얼마 안 남았을 때만 깜빡인다 */
    if(low && Math.floor(t*6) % 2 === 0){
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(snap(w.x + fw - PX*2), w.y, PX*2, w.h);
    }
  }

  /* ── 모래시계 — 이게 시간이라는 표시 ── */
  drawHourglass(ctx, B.x - 22, B.y + B.h/2, low, t, k);
}

/**
 * 작은 모래시계 — 타임바 왼쪽에 붙는다.
 *
 * ★ **격자로 찍는다.** 처음엔 사각형을 계산해서 쌓았는데 48px 짜리 덩어리가 나왔다
 * (바는 26px 이다). 모래시계처럼 생긴 것을 만들려면 **모양을 직접 그리는 편**이
 * 계산으로 흉내내는 것보다 작고 정확하다 — 이 게임의 다른 도트들과 같은 방식이다.
 *
 *   X 유리   o 모래   . 빈칸
 */
/**
 * 모래시계 유리 — **모래는 여기 없다.**
 *
 * ★ 처음에는 윗부분 모래를 이 그림에 박아 뒀다. 그래서 시간이 다 지나도
 *   위쪽 모래가 그대로 남아 있었다 — 아래만 쌓이고 위는 안 줄어드는 이상한 시계였다.
 *   변하는 것은 그림이 아니라 **상태**다. 유리만 그려 두고 모래는 그때그때 채운다.
 */
const HOURGLASS = [
  'XXXXXXX',   // 0 윗 뚜껑
  'X.....X',   // 1 ─┐
  '.X...X.',   // 2  │ 위쪽 깔때기 (모래가 여기 담긴다)
  '..X.X..',   // 3 ─┘
  '...X...',   // 4 목
  '..X.X..',   // 5 ─┐
  '.X...X.',   // 6  │ 아래쪽 깔때기
  'X.....X',   // 7 ─┘
  'XXXXXXX',   // 8 아래 뚜껑
];

/**
 * 작은 모래시계 — 타임바 왼쪽에 붙는다.
 *
 * ★ **격자로 찍는다.** 처음엔 사각형을 계산해 쌓았는데 48px 짜리 덩어리가 나왔다
 * (바는 26px 이다). 모양을 만들 때는 **직접 그리는 편**이 계산으로 흉내내는 것보다
 * 작고 정확하다 — 이 게임의 다른 도트들과 같은 방식이다.
 *
 * @param {number} k 남은 시간 비율 (1=가득, 0=다 빠짐)
 */
function drawHourglass(ctx, cx, cy, low, t, k){
  const D = 2;                                   // 도트 한 칸 (7x9 격자 -> 14x18px)
  const W = 7, H = HOURGLASS.length;
  const ox = snap(cx - W*D/2), oy = snap(cy - H*D/2);
  const glass = low ? '#ff8f8f' : '#cfe6ff';
  const sand  = low ? '#ffd24a' : '#ffe9a8';

  /* 배경 — 하늘 위에 떠 있어도 읽히게 한 겹 깔아 준다 */
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(ox - D, oy - D, W*D + D*2, H*D + D*2);

  /* 유리 */
  for(let r=0;r<H;r++)
    for(let c=0;c<W;c++)
      if(HOURGLASS[r][c] === 'X'){ ctx.fillStyle = glass; ctx.fillRect(ox + c*D, oy + r*D, D, D); }

  /**
   * ★ **실제 남은 시간대로 줄어든다.** (2026-08-26, 사용자 지정)
   *
   * 깔때기가 세 층이라 남은 양을 세 칸으로만 나타낸다. 그래서 반올림이 아니라
   * **올림**으로 센다 — 한 톨이라도 남았으면 위에 모래가 보여야지, 20%가 남았는데
   * 위가 텅 비어 있으면 다 끝난 줄 안다.
   *
   * 층마다 담기는 폭이 다르다: 위에서부터 5칸 / 3칸 / 1칸.
   */
  const kk = clamp(k, 0, 1);
  ctx.fillStyle = sand;

  /* 위 — 목에서부터 차오른다 (3층 -> 2층 -> 1층 순으로 빈다) */
  const top = Math.ceil(kk * 3);
  const TOP = [[3, 1, 5], [2, 2, 3], [1, 3, 1]];   // [줄, 시작칸, 폭]
  for(let i=0;i<top;i++){ const [r, c0, w] = TOP[i]; ctx.fillRect(ox + c0*D, oy + r*D, w*D, D); }

  /* 아래 — 바닥부터 쌓인다 */
  const bot = Math.ceil((1 - kk) * 3);
  const BOT = [[7, 1, 5], [6, 2, 3], [5, 3, 1]];
  for(let i=0;i<bot;i++){ const [r, c0, w] = BOT[i]; ctx.fillRect(ox + c0*D, oy + r*D, w*D, D); }

  /* 떨어지는 한 알 — 아직 남았을 때만 */
  if(kk > 0 && Math.floor(t*8) % 2 === 0) ctx.fillRect(ox + 3*D, oy + 4*D, D, D);
}

/**
 * 금화 한 닢. (2026-08-26, 사용자 지정 — "슈퍼마리오 참고해서 다시")
 *
 * 예전 것은 그냥 **네모**였다. 가로만 줄였다 늘렸다 해서 회전을 흉내냈는데,
 * 네모가 납작해지는 것은 회전이 아니라 그냥 얇은 판으로 보인다.
 *
 * 마리오 동전이 동전으로 읽히는 이유는 셋이다:
 *   · 정면일 때 **동그랗다** (네모가 아니다)
 *   · 가운데에 **어두운 홈**이 있어 두께가 느껴진다
 *   · 옆으로 돌 때 **테두리는 남고 안쪽만 좁아진다**
 * 그래서 원을 그리고, 폭만 코사인으로 줄이고, 테두리를 항상 유지한다.
 */
function drawCoin(ctx, cx, cy, r, t){
  const a = t * 4.2;
  const w = Math.abs(Math.cos(a));                 // 1=정면, 0=옆모습
  const halfW = Math.max(PX, snap(r * w));
  const py = PX;                                   // 세로 도트 크기

  for(let dy = -r; dy <= r; dy += py){
    /* 이 높이에서 원이 갖는 반폭 — 이것이 '동그람' 을 만든다 */
    const k = Math.sqrt(Math.max(0, 1 - (dy/r)*(dy/r)));
    const half = Math.max(PX, snap(halfW * k));
    if(half < PX) continue;
    const yy = snap(cy + dy);
    ctx.fillStyle = '#6b4a08';                     // 테두리 (옆모습에서도 남는다)
    ctx.fillRect(snap(cx - half - PX), yy, half*2 + PX*2, py);
    ctx.fillStyle = '#ffd24a';                     // 금
    ctx.fillRect(snap(cx - half), yy, half*2, py);
    /* 왼쪽 위 하이라이트 — 빛이 한쪽에서 오는 느낌 */
    if(dy < 0 && half > PX*2){
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(snap(cx - half), yy, Math.max(PX, snap(half*0.7)), py);
    }
  }
  /* 가운데 홈 — 정면일 때만 보인다 (옆모습에서는 두께에 가린다) */
  if(w > 0.55){
    const ih = Math.max(PX, snap(r*0.9)), iw = Math.max(PX, snap(halfW*0.34));
    ctx.fillStyle = '#c8880f';
    ctx.fillRect(snap(cx - iw), snap(cy - ih/2), iw*2, ih);
  }
}

/* ---------------- 파티클 ---------------- */
const MAX_PARTICLES = 520;          // 순수 장식. 900개는 프레임당 fillRect 900번이라 과했다.
/* 파티클은 미리 전부 할당해두고 재사용한다.
   매 프레임 수십 개를 new/splice 하면 GC 가 몰려서 프레임이 튄다. */
const Particles = {
  pool: null, n: 0,
  init(){
    this.pool = new Array(MAX_PARTICLES);
    for(let i=0;i<MAX_PARTICLES;i++)
      this.pool[i] = { x:0,y:0,vx:0,vy:0,life:0,max:1,size:PX,grav:0,drag:0,pal:PAL.fire };
  },
  get count(){ return this.n; },
  spawn(x, y, n, opt){
    if(!this.pool) this.init();
    opt = opt || {};
    const spd  = opt.spd  || 200;
    const life = opt.life || 0.4;
    const grav = opt.grav === undefined ? 320 : opt.grav;
    const drag = opt.drag === undefined ? 2.2 : opt.drag;
    const pal  = opt.pal || PAL.fire;
    const hasAng = opt.ang !== undefined, spread = opt.spread || 1.2;
    for(let i=0;i<n;i++){
      if(this.n >= MAX_PARTICLES) return;
      const p = this.pool[this.n++];
      const a = hasAng ? opt.ang + (Math.random()-0.5)*spread : Math.random()*Math.PI*2;
      const v = spd * (0.35 + Math.random()*0.9);
      p.x = x; p.y = y;
      p.vx = Math.cos(a)*v; p.vy = Math.sin(a)*v;
      p.life = 0; p.max = life * (0.6 + Math.random()*0.8);
      p.size = opt.size || (Math.random() > 0.6 ? PX*2 : PX);
      p.grav = grav; p.drag = drag; p.pal = pal;
    }
  },
  update(dt){
    for(let i=this.n-1; i>=0; i--){
      const p = this.pool[i];
      p.life += dt;
      if(p.life >= p.max){                       // 스왑 제거 : 배열 이동 없음
        this.n--;
        this.pool[i] = this.pool[this.n];
        this.pool[this.n] = p;
        continue;
      }
      const d = 1 - p.drag*dt;
      p.vx *= d > 0 ? d : 0; p.vy *= d > 0 ? d : 0;
      p.vy += p.grav*dt;
      p.x += p.vx*dt; p.y += p.vy*dt;
    }
  },
  render(ctx){
    for(let i=0;i<this.n;i++){
      const p = this.pool[i];
      const k = p.life / p.max;
      ctx.fillStyle = p.pal[(k * p.pal.length)|0] || p.pal[p.pal.length-1];
      ctx.fillRect(snap(p.x), snap(p.y), p.size, p.size);
    }
  },
  clear(){ this.n = 0; }
};

/* ---------------- 폭발 (8프레임 도트 애니메이션) ---------------- */
const BOOM_FRAMES = 8;
class Boom {
  constructor(x, y, radius, dur){
    this.x = x; this.y = y; this.r = radius;
    this.dur = dur || 0.36; this.t = 0; this.dead = false;
  }
  update(dt){ this.t += dt; if(this.t >= this.dur) this.dead = true; }
  render(ctx){
    const f = Math.min(BOOM_FRAMES-1, Math.floor(this.t/this.dur * BOOM_FRAMES));
    const k = f / (BOOM_FRAMES-1);
    const r = this.r * (0.35 + k*0.95);
    const ci = Math.min(6, Math.floor(k*6) + 1);
    // 1) 터지는 순간 흰 코어
    if(k < 0.2){
      ctx.globalAlpha = 1;
      fillPixelCircle(ctx, this.x, this.y, r*1.15, '#ffffff');
    }
    // 2) 화염 덩어리 (겉 -> 속)
    if(k < 0.8){
      ctx.globalAlpha = 1 - k*0.3;
      fillPixelCircle(ctx, this.x, this.y, r,       PAL.fire[Math.min(6, ci+2)]);
      fillPixelCircle(ctx, this.x, this.y, r*0.66,  PAL.fire[ci]);
      if(k < 0.5) fillPixelCircle(ctx, this.x, this.y, r*0.33, PAL.fire[0]);
    }
    // 3) 바깥으로 빠르게 퍼지는 충격 링
    if(k > 0.05){
      ctx.globalAlpha = Math.max(0, 1 - k) * 0.9;
      drawPixelRing(ctx, this.x, this.y, this.r * (0.5 + k*1.9), PX*2, PAL.fire[1]);
    }
    // 4) 식으면서 남는 연기
    if(k > 0.55){
      ctx.globalAlpha = (1 - k) * 0.55;
      fillPixelCircle(ctx, this.x, this.y - r*0.25, r*0.8, '#4a4048');
    }
    ctx.globalAlpha = 1;
  }
}

/* ---------------- 파이어 블레스 (자동 연사) ---------------- */
/**
 * ★ **연발이 두 배로 빨라진다.** (2026-08-26, 사용자 지정)
 *
 * 적을 계속 늘려 왔는데 화력은 그대로라 "피하는 것 말고는 방법이 없다" 는 말이 나왔다.
 * 맞는 말이다 — 화면을 메운 적을 초당 10발로는 못 뚫는다.
 *
 * 그리고 **레벨이 오르면 연사도 같이 빨라진다.** 예전에는 레벨이 줄기의 굵기만
 * 바꿨는데, 그러면 레벨을 올린 보람이 "조금 두꺼워졌다" 뿐이었다.
 * 굵기와 속도가 같이 오르면 한 칸이 확실히 체감된다.
 *
 *   Lv1  0.050초 (초당 20발)  ← 예전 10발의 **두 배**
 *   Lv5  0.043초 (초당 23발)
 *   Lv10 0.033초 (초당 30발)
 *
 * 보스 체력은 `지금 내 화력`에 연동되어 있어(`missileDamageOf`) 자동으로 따라 오른다 —
 * 보스가 녹아버리지는 않는다. 반면 **잡몸은 체력이 고정**이라 두 배로 빨리 녹는다 —
 * 적이 화면을 메울 때 뚫고 나가라고 올린 것이다.
 */
const FIRE_INTERVAL = 0.05;                  // Lv1 기준
/* 예전엔 0.06(초당 16.7발)이라 Lv10 에서 화면에 불줄기가 26개나 깔렸다.
   한 발은 260x270 스프라이트라 그것만으로 프레임당 2화면분을 칠하고 있었다.
   간격을 늘리고 한 방 데미지를 그만큼 올려 DPS 는 1도 달라지지 않게 했다.
   대신 줄기 길이를 늘려 발과 발 사이가 끊겨 보이지 않게 맞췄다. */
/* 레벨별 불줄기.
   n  = 나란히 붙어서 나가는 줄 수 (벌어지지 않고 서로 맞닿아 한 덩어리)
   bt = 줄 하나의 두께.  전체 두께 th = n * bt */
/**
 * ★★ **강해지지 않는다.** (2026-08-26, 사용자 지정)
 *
 * *"너무 재미가 없어, 강해지지 않았으면 좋겠어 (...) 너무 강하니깐 재미가 없어"*
 *
 * 예전 Lv10 은 **두께 228px 에 관통 무한**이었다. 화면 세로의 4분의 1을 덮는
 * 빔이 앞의 모든 것을 뚫고 지나가니, 뒤로 갈수록 **피할 일도 조준할 일도**
 * 없어졌다. 적을 아무리 늘려도 빔 앞에서는 다 같은 벽지였다.
 * 재미가 없어진 진짜 원인이 난이도가 아니라 **내 화력**이었다.
 *
 * 그래서 열 단계를 **예전의 Lv1~Lv4 사이에 다시 욱여넣는다.**
 *   · 두께는 78px(예전 Lv3)에서 멈춘다 — 화면을 덮지 않는다
 *   · 관통은 1이 상한 — 줄줄이 꿰는 맛은 남기되 벽지는 안 된다
 *   · 데미지는 18.3 -> 31.0 (예전 Lv4 수준). 예전 상한 94.6 의 3분의 1이다
 *
 * 레벨업이 무의미해지지는 않는다 — 두께 1줄->3줄, 관통 0->1, 사거리 170->224,
 * 그리고 연사 속도가 함께 오른다. 다만 **판을 뒤집는 힘**은 주지 않는다.
 *
 * ## 보스 체력은 저절로 따라온다
 *
 * `bossPowerScale` 이 보스 체력을 **지금 내 화력**에 연동해 두었다. 표를 낮추면
 * 보스도 같이 얇아져서 보스전 길이는 거의 그대로다. 반면 **잡몹은 체력이 고정**이라
 * 그만큼 오래 버틴다 — 그게 이번에 노리는 것이다.
 */
const FIRE = [ null,
  /* ★ **Lv1 도 두 줄이다.** (2026-08-26, 사용자 지정 — 한 판 해보고)
     한 줄짜리 26px 는 너무 초라했다. 죽으면 여기로 돌아오는데 그 모습이
     "이걸로 뭘 하나" 싶으면 다시 붙을 마음이 안 든다.
     **데미지는 그대로 두고 보이는 것만** 두 줄로 올린다 —
     세기가 오르는 게 아니라 초라해 보이지 않게 하는 것이 목적이다. */
  /**
   * ★ **모양만 화려하고 공격력은 거의 안 오른다.** (2026-08-27, 사용자 지정)
   * *"파이어 레벨 업그레이드 해도 모양만 화려하고 공격력은 그다지 크게 업글 안된
   *   형태가 좋은거 같아, 적들이 녹아내리니 게임이 재미가 없음"*
   *
   * 데미지는 18.3 -> 22.4 (1.22배). 예전 31.0 에서 더 낮췄다.
   * 대신 두께(52->78) · 관통(0->1) · 사거리(170->224) · 연사는 그대로 오른다 —
   * **보기에는 세지는데 실제로는 조금만 세진다.** 레벨업의 즐거움은 남기고
   * 적이 녹아내리는 것만 막는다.
   */
  { n: 2, bt:26.0, th: 52, dmg:  18.3, spd:1500, pierce:0, len:170 },  // Lv1  2줄= 52px  (죽으면 여기로)
  { n: 2, bt:26.0, th: 52, dmg:  18.7, spd:1500, pierce:0, len:176 },  // Lv2
  { n: 2, bt:26.0, th: 52, dmg:  19.2, spd:1510, pierce:0, len:182 },  // Lv3
  { n: 2, bt:26.0, th: 52, dmg:  19.6, spd:1520, pierce:0, len:188 },  // Lv4
  { n: 2, bt:26.0, th: 52, dmg:  20.1, spd:1530, pierce:0, len:194 },  // Lv5
  { n: 3, bt:26.0, th: 78, dmg:  20.5, spd:1540, pierce:1, len:200 },  // Lv6  3줄= 78px  ← 두께 상한
  { n: 3, bt:26.0, th: 78, dmg:  21.0, spd:1550, pierce:1, len:206 },  // Lv7
  { n: 3, bt:26.0, th: 78, dmg:  21.4, spd:1560, pierce:1, len:212 },  // Lv8
  { n: 3, bt:26.0, th: 78, dmg:  21.9, spd:1570, pierce:1, len:218 },  // Lv9
  { n: 3, bt:26.0, th: 78, dmg:  22.4, spd:1580, pierce:1, len:224 }   // Lv10 Lv1 의 1.22배뿐
];

class FireBolt {
  constructor(x, y, vy, lv, pid){
    const c = FIRE[lv];
    this.x = x; this.y = y;
    this.vx = c.spd; this.vy = vy;
    this.th = c.th; this.len = c.len;
    this.pierce = c.pierce; this.lv = lv; this.pid = pid || 1;
    /* 불꽃 아이템은 1P 에게만 걸린다 (지갑의 주인이 1P 다) */
    this.dmg = this.pid === 1 ? c.dmg * EQ.atk : c.dmg;
    this.fp  = firePalOf(this.pid);
    this.ph = Math.random()*Math.PI*2;
    this.t = 0; this.dead = false;
    this.hitSet = null;                       // 관통 시 중복 타격 방지
  }
  get box(){ return { x:this.x - this.len, y:this.y - this.th/2, w:this.len, h:this.th }; }
  update(dt){
    this.t += dt;
    this.x += this.vx*dt; this.y += this.vy*dt;
    if(this.x - this.len > GAME_W + 40 || this.y < -80 || this.y > GAME_H + 80) this.dead = true;
  }
  render(ctx){
    if(this.x < -20 || this.x - this.len > GAME_W + 20) return;
    if(this.y < -80 || this.y > GAME_H + 80) return;
    drawFireBolt(ctx, snap(this.x), snap(this.y), this.lv, this.t, this.ph, this.fp);
  }
}

/* 불줄기 한 발.  줄(band)들이 서로 맞닿은 채 나란히 나간다.
   줄 하나하나를 가늘게 만들지 않고 "다발 전체"를 앞으로 갈수록 두껍게 한다.
   줄 간격과 줄 두께에 같은 배율을 걸기 때문에 어디서 잘라도 틈이 생기지 않는다. */
function paintFireBolt(ctx, L, cy, lv, ph, fp){
  const c = FIRE[lv];
  const F = fp || PAL.fire;
  const N = c.n, BT = c.bt, seg = 24;
  for(let sx=0; sx<L; sx+=seg){
    const p    = sx / L;
    const head = Math.min(1, (1 - p) / 0.10);              // 맨 앞만 둥글게
    const bs   = Math.min(1, 0.44 + 0.80*p) * (0.60 + 0.40*head);   // 다발 전체 배율
    const w    = Math.min(seg, L - sx);
    for(let bi=0; bi<N; bi++){
      const wob = 1 + Math.sin(ph + bi*1.7 + p*6) * 0.06;  // 줄마다 다른 결 (틈이 안 나게 소폭)
      const bh  = BT * bs * 1.10 * wob;                     // 1.10 = 이웃과 겹쳐 틈 제거
      const by  = cy + (bi - (N-1)/2) * BT * bs;
      const y0  = Math.round(by - bh/2), y1 = Math.round(by + bh/2);
      ctx.fillStyle = F[4];
      ctx.fillRect(sx, y0, w, Math.max(1, y1-y0));
      const ih = Math.max(1, Math.round((y1-y0)*0.5));
      ctx.fillStyle = F[1];
      ctx.fillRect(sx, Math.round(by - ih/2), w, ih);
    }
    // 덩어리 한가운데를 지나는 흰 코어
    const chh = Math.max(1, Math.round(N*BT*bs*0.13));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx, Math.round(cy - chh/2), w, chh);
  }
}

/* 레벨별로 8장만 구워두고 돌려 쓴다.
   Lv10 은 한 발에 fillRect 가 260번 넘게 드는데, 그대로 그리면
   화면에 12발이 깔릴 때 프레임당 3000번이 넘어가 폰에서 버벅인다. */
const FIRE_FRAMES = 6, FIRE_CACHE_MAX = 3;   // 6장이면 일렁임이 충분히 자연스럽다
const _fireCache = new Map();
function fireSheet(lv, fp){
  /* 색까지 열쇠에 넣는다 — 1P 가 파란 불을 끼면 2P 는 빨간 불이라
     레벨만으로 구워두면 둘이 서로의 그림을 빼앗는다. */
  const F = fp || PAL.fire;
  const key = lv + '|' + F[4];
  let sh = _fireCache.get(key);
  if(sh) return sh;
  const c = FIRE[lv];
  const W = c.len, H = Math.ceil(c.th * 1.15) + 8;
  const frames = [];
  for(let f=0; f<FIRE_FRAMES; f++){
    const { cv, c:cx } = makeCanvas(W, H);
    paintFireBolt(cx, W, H/2, lv, f * (Math.PI*2/FIRE_FRAMES), F);
    frames.push(cv);
  }
  sh = { frames, W, H };
  /* 두 색이 번갈아 들어올 수 있으니 칸을 두 배로 둔다 */
  if(_fireCache.size >= FIRE_CACHE_MAX*2) _fireCache.delete(_fireCache.keys().next().value);
  _fireCache.set(key, sh);
  return sh;
}
function drawFireBolt(ctx, x, y, lv, t, ph, fp){
  const sh = fireSheet(lv, fp);
  // 위상에 발마다 다른 ph 를 섞어 같은 프레임만 나란히 뜨지 않게 한다
  const fi = ((((t*26 + ph) / (Math.PI*2) * FIRE_FRAMES) | 0) % FIRE_FRAMES + FIRE_FRAMES) % FIRE_FRAMES;
  ctx.drawImage(sh.frames[fi], x - sh.W, y - (sh.H >> 1));
}

/* ---------------- 적 : 날개 좀비 ---------------- */
const ZOMBIE_PAL = {
  k:'#0a1408', z:'#6f9c4a', Z:'#3f5c28', R:'#ff3a2a',
  c:'#8a7550', C:'#54452c', b:'#e8e0c8', w:'#55703a', W:'#33471f'
};
const Z_COLS = 20, Z_ROWS = 20, Z_CELL = 4.8;      // 기존 4 에서 +20%
const Z_BODY = [
  '....................','....................','....................','...kkkkk............',
  '..kzzzzzk...........','..kRzzRzk...........','..kzzzzzk...........','..kzZZZzk...........',
  '...kzzzk............','.kzzkzkk............','.kzzcczcck..........','..kcczcck...........',
  '..kcCzCck...........','...kczck............','...kczck............','...kkzkk............',
  '...kz.zk............','..kz...zk...........','..kb...bk...........','....................'
];
const Z_BOW = [
  '....................','....................','....................','....................',
  '....................','....................','.b..................','b...................',
  'b...................','b...................','b...................','b...................',
  'b...................','.b..................','....................','....................',
  '....................','....................','....................','....................'
];
const Z_WINGS = [
  [ // 위로
    '....................','........kkkk........','.......kwWwwk.......','.......kwwwwwk......',
    '........kwwwwk......','.........kwwwk......','..........kwwk......','...........kkk......',
    '....................','....................','....................','....................',
    '....................','....................','....................','....................',
    '....................','....................','....................','....................'
  ],
  [ // 아래로
    '....................','....................','....................','....................',
    '....................','.........kkk........','..........kwwk......','.........kwwwwk.....',
    '........kwwwwwk.....','........kwWwwk......','.........kkkk.......','....................',
    '....................','....................','....................','....................',
    '....................','....................','....................','....................'
  ]
];
const Z_W = Z_COLS*Z_CELL, Z_H = Z_ROWS*Z_CELL;   // 80 x 80

/* 적 화살 */
class Arrow {
  constructor(x, y){
    this.x = x; this.y = y; this.vx = -340 * diffSpeed(); this.dead = false;
  }
  get box(){ return { x:this.x, y:this.y - 5, w:38, h:10 }; }
  update(dt){ this.x += this.vx*dt; if(this.x < -60) this.dead = true; }
  render(ctx){
    const x = snap(this.x), y = snap(this.y);
    blitCached(ctx, 'AR', 44, PX*4 + 2, x, y - PX*2, (c, bx, by) => {
      const yy = by + PX*2;
      c.fillStyle = '#5a4a2e'; c.fillRect(bx + 8, yy - PX/2, 30, PX);      // 화살대
      c.fillStyle = '#d8d2c0';                                            // 촉
      c.fillRect(bx, yy - PX, 10, PX*2);
      c.fillRect(bx + 8, yy - PX*2, PX, PX*4);
      c.fillStyle = '#c04a3a';                                            // 깃
      c.fillRect(bx + 32, yy - PX*2, PX*2, PX);
      c.fillRect(bx + 32, yy + PX,   PX*2, PX);
    });
  }
}

class WingZombie {
  constructor(x, y, speed){
    this.x = x; this.y = y;
    this.hp = this.maxHp = enemyHp(46);      // 스테이지에 비례해 단단해진다
    this.vx = -(speed || 175) * diffSpeed(); this.vy = 0;
    this.t = Math.random()*6;
    this.baseY = y;
    this.animT = 0; this.wing = 0;
    this.flash = 0; this.knock = 0;
    this.shootT = 0.8 + Math.random()*1.4;
    this.dead = false; this.score = 100;
  }
  get box(){ return { x:this.x - 31, y:this.y - 36, w:62, h:72 }; }
  update(dt, scene){
    this.t += dt;
    if(this.flash > 0) this.flash -= dt;
    // 넉백 감쇠
    if(this.knock > 0){ this.knock = Math.max(0, this.knock - 900*dt); }
    this.x += (this.vx + this.knock)*dt;
    applyDive(this, dt);
    this.y = this.baseY + Math.sin(this.t*2.2)*22;
    // 날갯짓
    this.animT += dt;
    if(this.animT >= 0.14){ this.animT = 0; this.wing ^= 1; }
    // 활 쏘기 (화면 안에 들어왔을 때만)
    if(this.x < GAME_W - 60){
      this.shootT -= dt;
      if(this.shootT <= 0){
        /* 레벨이 오르면 화살이 잦아진다 (1.6~2.8초 -> 0.9~1.6초) */
        this.shootT = (1.6 - 0.7*enemyLv()) + Math.random()*(1.2 - 0.5*enemyLv());
        scene.arrows.push(new Arrow(this.x - 30, this.y + 8));
      }
    }
    if(this.x < -Z_W) this.dead = true;
  }
  /**
   * ★ **정면 방패.** (기획 1, 2026-08-27)
   *
   * 플레이어는 늘 화면 왼쪽에 있고 불줄기는 **가로로만** 나간다. 그래서 자리를
   * 옮길 이유가 없었다 — 어디에 있든 앞의 것을 지진다.
   *
   * 방패는 적의 **가운데 띠**를 막는다. 위아래 끝은 열려 있으므로,
   * 잡으려면 **적의 위쪽 끝이나 아래쪽 끝에 줄을 맞춰야** 한다.
   * 완전히 못 잡게 만드는 것이 아니라 **겨냥하게** 만드는 것이 목적이다.
   *
   * 미사일과 핵무기는 방패를 무시한다 — 그게 이 적에 대한 답이고,
   * 손에 쥔 무기를 쓸 이유가 하나 생긴다.
   */
  shieldBlocks(bolt){
    if(!this.shield || !bolt || bolt.ignoreShield) return false;
    const box = this.box;
    const mid = box.y + box.h/2, half = box.h * this.shield * 0.5;
    return Math.abs(bolt.y - mid) < half;
  }
  hit(dmg, bolt, scene){
    if(this.shieldBlocks(bolt)){
      this.shieldT = 0.12;
      SND.sfx('deny');
      Particles.spawn(this.x - this.box.w*0.5, bolt.y, 5,
        { ang:Math.PI, spread:1.5, spd:300, life:0.22, pal:['#dff0ff','#9ad8ff','#4a86c8'] });
      if(bolt) bolt.dead = true;
      return;
    }
    if(bolt && bolt.pid) this.killPid = bolt.pid;      // 마지막으로 때린 사람에게 점수
    this.hp -= dmg;
    this.flash = 0.09;
    this.knock = 260;
    Shake.add(4, 0.05);
    Particles.spawn(this.x - 12, this.y, 8, { ang:-0.15, spread:2.6, spd:380, life:0.32 });
    SND.sfx('hit');
    if(this.hp <= 0) this.die(scene);
  }
  die(scene){
    this.dead = true; this.killed = true;
    /* ★ 화면에 뜨는 숫자는 **실제로 오른 점수**다 (2026-08-27, 점수 눈금 1/100).
       원래 값을 띄우면 표의 합계와 백 배 어긋난다. */
    this.gotScore = scene.addScore(this.score, this.killPid);
    scene.booms.push(new Boom(this.x, this.y, 62, 0.36));
    scene.waves.push(new Shockwave(this.x, this.y, 150, 0.26));
    Particles.spawn(this.x, this.y, 26, { spd:460, life:0.55 });
    Particles.spawn(this.x, this.y, 8, { spd:340, life:0.8, grav:760, size:PX*2,
      pal:['#e8e0c8','#cfc6a8','#9a9078'] });                       // 뼈다귀 파편
    if(this.gotScore > 0) Popups.add(this.x, this.y - 30, this.gotScore, PAL.fire[1], 3);
    Shake.add(7, 0.11);
    Freeze.add(0.028);
    SND.sfx('boomS');
  }
  render(ctx){
    const ox = snap(this.x - Z_W/2), oy = snap(this.y - Z_H/2);
    const tint = this.flash > 0 ? '#ffffff' : null;
    blitCached(ctx, 'Z|'+this.wing+'|'+(tint||'-'), Z_W, Z_H, ox, oy, (c, x, y) => {
      drawGrid(c, Z_WINGS[this.wing], x, y, Z_COLS, Z_CELL, ZOMBIE_PAL, false, tint);
      drawGrid(c, Z_BODY,             x, y, Z_COLS, Z_CELL, ZOMBIE_PAL, false, tint);
      drawGrid(c, Z_BOW,              x, y, Z_COLS, Z_CELL, ZOMBIE_PAL, false, tint);
    });
  }
}

/* ---------------- AABB 충돌 ---------------- */
function overlap(a, b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* ==================================================================
   Phase 4 : 적 2/3종 + 중간보스 + 최종보스 + 웨이브 시스템
   드래곤 폼(FORM A/B)을 팔레트/셀크기/좌우반전으로 재활용하고
   등에 태우는 "라이더" 오버레이만 따로 그려서 톤을 통일한다.
   ================================================================== */

/* ---------------- 라이더 오버레이 ----------------
   문자 : z피부 Z그늘 r붉은눈 a갑옷 A갑옷그늘 o금장식 b뼈 K외곽    */
const A_RIDER = [   // FORM A(30x28) 등에 앉은 작은 좀비
  '..............................','..............................','..............................',
  '..............................','..............................','..............................',
  '..............................','..............KKK.............','.............KzzzK............',
  '.............KrzrK............','.............KzZzK............','..........KKKKaaaKK...........',
  '.........KaaaaaaaaK...........','.........KaAaaaAaK............','..........KaKKKaK.............',
  '..........KK...KK.............','..............................','..............................',
  '..............................','..............................','..............................',
  '..............................','..............................','..............................',
  '..............................','..............................','..............................',
  '..............................'
];
const B_RIDER_KNIGHT = [   // FORM B(36x32) 등에 앉은 갑옷 기사
  '....................................','....................................','....................................',
  '....................................','..................o.................','.................ooo................',
  '.................KoK................','..............KKKKoKKK..............','.............KaaaaaaaaK.............',
  '.............KaarrraaK.............','.............KaaaaaaaK.............','..........KKKKaaaaaaKKKK...........',
  '.........KaaaaaaaaaaaaaaK..........','.........KaAAaaaaaaaaAAaK..........','.........KaAAaaaaaaaaAAaK..........',
  '..........KaaaaaaaaaaaaK...........','..........KaaKKaaaKKaaK............','...........KKK..KKK..KK............',
  '....................................','....................................','....................................',
  '....................................','....................................','....................................',
  '....................................','....................................','....................................',
  '....................................','....................................','....................................',
  '....................................','....................................'
];
const B_RIDER_KING = [     // FORM B(36x32) 왕관 쓴 좀비 로드
  '....................................','....................................','..............o.o.o.................',
  '..............ooooo.................','.............ooooooo................','.............KoooooK................',
  '..............KKKKK.................','.............KaaaaaK...............','.............KarrraK...............',
  '.............KaaaaaK...............','..........KKKKaaaaaKKKK............','.........KaaaaaaaaaaaaaaK..........',
  '.........KaAAaoooooaAAaK...........','.........KaAAaoooooaAAaK...........','.........KaaaaaaaaaaaaaK...........',
  '..........KaaaaaaaaaaaK............','..........KaaKKaaaKKaaK............','...........KKK..KKK..KK............',
  '....................................','....................................','....................................',
  '....................................','....................................','....................................',
  '....................................','....................................','....................................',
  '....................................','....................................','....................................',
  '....................................','....................................'
];

/* ---------------- 적 드래곤 팔레트 ---------------- */
const RIDER_EXTRA = { z:'#7fae52', Z:'#4a6b30', r:'#ff3a2a', a:'#8790a8', A:'#4d5468', o:'#ffd24a', b:'#e8e0c8' };
function mkPal(base){ return Object.assign({}, base, RIDER_EXTRA); }

const RED_DRAGON_PAL = mkPal({          // 적2 : 작은 빨간 드래곤
  K:'#1a0508', D:'#6b1420', M:'#93202c', L:'#c4343a', T:'#7a1a26',
  E:'#ffd24a', H:'#fff6c2', N:'#12070a', G:'#e8c07a', S:'#d9603f',
  C:'#f0e2c8', W:'#fff4f4', P:'#a8323a', w:'#5c1520', f:'#8a2430', k:'#2a0a10'
});
const PURPLE_DRAGON_PAL = mkPal({       // 적3 : 통통한 보라 드래곤
  K:'#140820', D:'#3e2263', M:'#573083', L:'#7b46b0', T:'#452770',
  E:'#ffe14a', H:'#fffbe0', N:'#0d0518', G:'#d8c6f0', S:'#b48ce0',
  C:'#efe6ff', W:'#fff4f4', P:'#6a3b9e', w:'#2e1747', f:'#4a2a70', k:'#1c0d2c'
});
/**
 * 돌진병. 다른 잡몹과 **색이 확실히 달라야** 한다 —
 * 조준선이 뜨기 전에도 "저건 돌진하는 놈" 인 것을 알아봐야 비킬 준비를 한다.
 * 잿빛 몸에 형광 주황 — 화면의 어느 배경 위에서도 튄다.
 */
/** 도둑. 노란 눈에 검은 몸 — 금화를 물고 있으면 더 눈에 띈다 */
const THIEF_PAL = mkPal({
  K:'#0a0a0c', D:'#1e1e26', M:'#2e2e3a', L:'#44445a', T:'#242430',
  E:'#ffd24a', H:'#fff6c2', N:'#060608', G:'#8a8aa0', S:'#ffd24a',
  C:'#d8d8e8', W:'#fff4f4', P:'#3a3a4a', w:'#141419', f:'#242430', k:'#0c0c10'
});
const CHARGER_PAL = mkPal({
  K:'#120c08', D:'#3a2a1c', M:'#5c422a', L:'#8a6038', T:'#46301e',
  E:'#ff5a1a', H:'#ffd8a0', N:'#0c0805', G:'#ffb070', S:'#ff7a2e',
  C:'#ffe8d0', W:'#fff4f4', P:'#a05028', w:'#2a1c10', f:'#46301e', k:'#180f08'
});
const MIDBOSS_PAL = mkPal({             // 중간보스 : 채도 낮은 회갈색
  K:'#14110d', D:'#413a30', M:'#5a5145', L:'#776c5c', T:'#4a4238',
  E:'#ff8a3a', H:'#ffe0c0', N:'#0e0c09', G:'#cfc4ae', S:'#9a8c74',
  C:'#e8e0cc', W:'#fff4f4', P:'#6b6152', w:'#38312a', f:'#544a3c', k:'#1d1913'
});
const BOSS_PAL = mkPal({                // 최종보스 : 스테이지 테마색 (기본 심록/보라)
  K:'#0a1410', D:'#1d4433', M:'#2b6247', L:'#3f8a5e', T:'#24513c',
  E:'#ff2b3c', H:'#ffd9dc', N:'#071009', G:'#d8e8c0', S:'#8fd48a',
  C:'#eaf6dc', W:'#fff4f4', P:'#356b4e', w:'#153025', f:'#245038', k:'#0d1c15'
});
const BOSS_PAL_RAGE = mkPal({           // HP 50% 이하에서 붉게 변함
  K:'#1a0508', D:'#5e1622', M:'#84202e', L:'#b32f38', T:'#6d1a26',
  E:'#ffe14a', H:'#fffbe0', N:'#12070a', G:'#ffd0c0', S:'#ff8a6a',
  C:'#ffeadc', W:'#fff4f4', P:'#963038', w:'#43101a', f:'#6d1c28', k:'#26080e'
});

/* 폼 드래곤 1마리 그리기 (적/보스 공용) */
let _ovSeq = 0;
function overlayId(ovs){
  if(!ovs) return '-';
  let k = '';
  for(const L of ovs){
    if(L.__oid === undefined) Object.defineProperty(L, '__oid', { value: ++_ovSeq });
    k += L.__oid + '.';
  }
  return k;
}
/**
 * @param overlays 몸통 **위**에 얹을 것들 (등가시·꼬리칼날·기수)
 * @param unders   몸통 **아래**에 깔 것들 (뿔 — 밑동이 두개골에 가려야 박혀 보인다)
 */
function drawFormDragon(ctx, pal, formKey, cell, cx, cy, pose, flip, tint, overlays, unders){
  const f = FORMS[formKey];
  const ox = snap(cx - f.cols*cell/2), oy = snap(cy - f.rows*cell/2);
  const key = 'F|'+formKey+'|'+palId(pal)+'|'+cell+'|'+pose+'|'+(flip?1:0)+'|'+(tint||'-')
            + '|'+overlayId(overlays)+'|'+overlayId(unders);
  blitCached(ctx, key, f.cols*cell, f.rows*cell, ox, oy, (c, x, y) => {
    drawGrid(c, f.wings[pose], x, y, f.cols, cell, pal, flip, tint);
    if(unders) for(const L of unders) drawGrid(c, L, x, y, f.cols, cell, pal, flip, tint);
    drawGrid(c, f.body,        x, y, f.cols, cell, pal, flip, tint);
    if(overlays) for(const L of overlays) drawGrid(c, L, x, y, f.cols, cell, pal, flip, tint);
  });
}

/* ==================================================================
   적 탄환
   ================================================================== */
/* 화염탄 스프라이트 캐시 (반지름 정수별로 1회만 구움) */
const _fireBallCache = {};
function fireBallSprite(r){
  const cached = _fireBallCache[r];
  if(cached) return cached;
  const size = snap(r*2) + PX*2;
  const { cv, c } = makeCanvas(size, size);
  const cx = size/2, cy = size/2;
  fillPixelCircle(c, cx, cy, r,      PAL.fire[5]);
  fillPixelCircle(c, cx, cy, r*0.66, PAL.fire[2]);
  fillPixelCircle(c, cx, cy, r*0.32, PAL.fire[0]);
  return (_fireBallCache[r] = cv);
}

class EnemyFire {                       // 드래곤 라이더의 3방향 불꽃
  constructor(x, y, ang, spd, r){
    this.x = x; this.y = y;
    this.vx = Math.cos(ang)*spd; this.vy = Math.sin(ang)*spd;
    this.r = r || 11; this.t = 0; this.dead = false;
  }
  get box(){ return { x:this.x - this.r, y:this.y - this.r, w:this.r*2, h:this.r*2 }; }
  update(dt){
    this.t += dt;
    this.x += this.vx*dt; this.y += this.vy*dt;
    if(this.x < -60 || this.x > GAME_W + 80 || this.y < -80 || this.y > GAME_H + 80) this.dead = true;
  }
  render(ctx){
    // 탄막이 100발을 넘어가므로 매번 원을 3겹 찍지 않고 미리 구운 스프라이트를 쓴다
    const w = 1 + Math.sin(this.t*22)*0.12;
    const spr = fireBallSprite(Math.max(4, Math.round(this.r*w)));
    ctx.drawImage(spr, snap(this.x - spr.width/2), snap(this.y - spr.height/2));
  }
}

class HomingMissile {                   // 헤비 라이더 / 보스의 유도 미사일
  constructor(x, y, target, spd, turn){
    this.x = x; this.y = y;
    this.ang = Math.PI;                 // 왼쪽으로 출발
    this.spd = spd || 260; this.turn = turn || 2.2;
    this.target = target; this.t = 0; this.dead = false; this.life = 6;
  }
  get box(){ return { x:this.x - 10, y:this.y - 8, w:20, h:16 }; }
  update(dt){
    this.t += dt;
    if(this.t > this.life){ this.dead = true; return; }
    const tg = this.target;
    if(tg){
      const want = Math.atan2(tg.y - this.y, tg.x - this.x);
      let d = want - this.ang;
      while(d >  Math.PI) d -= Math.PI*2;
      while(d < -Math.PI) d += Math.PI*2;
      this.ang += clamp(d, -this.turn*dt, this.turn*dt);
    }
    this.x += Math.cos(this.ang)*this.spd*dt;
    this.y += Math.sin(this.ang)*this.spd*dt;
    if(this.t > 0.05 && Math.random() < 0.7)
      Particles.spawn(this.x, this.y, 1, { spd:40, life:0.28, grav:-10, drag:4 });
    if(this.x < -80 || this.x > GAME_W + 120 || this.y < -100 || this.y > GAME_H + 100) this.dead = true;
  }
  render(ctx){
    const x = snap(this.x), y = snap(this.y);
    const back = 14, c = Math.cos(this.ang), s = Math.sin(this.ang);
    ctx.fillStyle = PAL.fire[2];                                   // 꼬리 불꽃
    ctx.fillRect(snap(x - c*back), snap(y - s*back), PX*2, PX*2);
    ctx.fillStyle = '#c9ccd8'; ctx.fillRect(x - 8, y - PX, 16, PX*2);   // 동체
    ctx.fillStyle = '#ff4d5a'; ctx.fillRect(x + 6, y - PX, PX*2, PX*2); // 탄두
    ctx.fillStyle = '#6b7285'; ctx.fillRect(x - 10, y - PX*2, PX, PX*4);// 꼬리날개
  }
}

class Bomb {                            // 헤비 라이더의 투하 폭탄
  constructor(x, y){ this.x = x; this.y = y; this.vx = -60; this.vy = 40; this.t = 0; this.dead = false; }
  get box(){ return { x:this.x - 12, y:this.y - 12, w:24, h:24 }; }
  update(dt, scene){
    this.t += dt;
    this.vy += 620*dt;
    this.x += this.vx*dt; this.y += this.vy*dt;
    if(this.y > GAME_H - 30 || this.t > 5){ this.explode(scene); }
  }
  explode(scene){
    if(this.dead) return;
    this.dead = true;
    scene.booms.push(new Boom(this.x, this.y, 60, 0.42));
    Particles.spawn(this.x, this.y, 20, { spd:380, life:0.55 });
    Shake.add(6, 0.14);
  }
  render(ctx){
    const x = snap(this.x), y = snap(this.y);
    fillPixelCircle(ctx, x, y, 11, '#2b2f3a');
    fillPixelCircle(ctx, x - 3, y - 3, 4, '#586074');
    ctx.fillStyle = '#8a7550'; ctx.fillRect(x - PX/2, y - 16, PX, PX*2);       // 심지
    ctx.fillStyle = PAL.fire[Math.floor(this.t*14) % 3]; ctx.fillRect(x - PX/2, y - 20, PX, PX);
  }
}

class Shockwave {                       // 충격파 링 (보스 분노 / 미사일 폭발 등)
  constructor(x, y, reach, dur, harmless){
    this.x = x; this.y = y; this.t = 0;
    this.dur = dur || 1.1; this.reach = reach || 1500;
    this.dead = false; this.hitDone = !!harmless || (reach !== undefined);
  }
  get r(){ return 60 + (this.t/this.dur) * this.reach; }
  update(dt){ this.t += dt; if(this.t >= this.dur) this.dead = true; }
  render(ctx){
    const k = this.t/this.dur;
    ctx.globalAlpha = (1 - k) * 0.85;
    drawPixelRing(ctx, this.x, this.y, this.r,        PX*4, PAL.fire[1]);
    drawPixelRing(ctx, this.x, this.y, this.r - PX*5, PX*2, PAL.fire[4]);
    ctx.globalAlpha = 1;
  }
}

/* ==================================================================
   적 공통 베이스
   ================================================================== */
/**
 * ★ **쏠 때 고개를 끄덕인다.** (2026-08-27, 사용자 지정)
 *
 * *"드래곤 타고 있는 적들은 공격을 쏠때 고개를 끄덕거린다거나,
 *   뭔가 공격하고 있다는 애니매이션 움직임이 있었음 좋겠다"*
 *
 * 예전에는 탄만 나갔다 — **누가 쏜 건지** 알 수가 없어서 화면이 그냥 시끄러웠다.
 * 쏘는 놈이 앞으로 한 번 숙였다 돌아오면 눈이 그쪽을 먼저 본다.
 * `castT` 를 세워 두면 그리는 쪽이 알아서 숙인다.
 */
function castPose(ctx, e, draw){
  if(!(e.castT > 0)) { draw(); return; }
  const k = e.castT / CAST_TIME;                 // 1 -> 0
  const dip = Math.sin(k*Math.PI);               // 숙였다 돌아온다
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(-dip*0.30);                         // 앞(왼쪽)으로 숙인다
  ctx.translate(-dip*10, dip*4);
  ctx.translate(-e.x, -e.y);
  draw();
  ctx.restore();
}
const CAST_TIME = 0.26;

class EnemyBase {
  /* 보스가 쏘는 것에 스테이지 비례 데미지를 실어준다 (일반 적은 기본값 25) */
  arm(o){ if(this.hurtDmg) o.hurt = this.hurtDmg; return o; }
  constructor(x, y, hp, score){
    this.x = x; this.y = y; this.baseY = y;
    this.hp = hp; this.maxHp = hp; this.score = score;
    this.t = Math.random()*6; this.animT = 0; this.pose = 2;
    this.flash = 0; this.knock = 0; this.dead = false;
    this.isBoss = false;
    this.diveTo = null; this.diveV = 0;      // 대각선 진입용 (DIAGONAL_STAGE 초과)
  }
  flapUpdate(dt, rate){
    this.animT += dt;
    if(this.animT >= (rate || 0.11)){ this.animT = 0; this.pose = this.pose === 0 ? 3 : 0; }
  }
  hit(dmg, bolt, scene){
    if(bolt && bolt.pid) this.killPid = bolt.pid;      // 마지막으로 때린 사람에게 점수
    this.hp -= dmg;
    this.flash = 0.09;
    this.knock = this.isBoss ? 60 : 220;
    Shake.add(this.isBoss ? 3 : 4, 0.05);
    Particles.spawn(this.x - 14, this.y, this.isBoss ? 6 : 9,
      { ang:-0.15, spread:2.6, spd:380, life:0.32 });
    SND.sfx('hit');
    if(this.hp <= 0) this.die(scene);
  }
  die(scene){
    this.dead = true; this.killed = true;
    /**
     * ★ **점수는 반드시 `addScore` 를 지난다.** (2026-08-27)
     * 여기서 `scene.score += this.score` 로 **직접** 더하고 있었다.
     * 그래서 점수 눈금(1/100)도 연쇄 배수도 안 먹었고, 잡은 사람에게 점수가
     * 안 갔다(2인 플레이에서 남의 점수가 됐다). 잡몹 대부분이 이 경로였다.
     */
    this.gotScore = scene.addScore(this.score, this.killPid);
  }
}

/* ---------------- 적2 : 드래곤 라이더 좀비 ---------------- */
const DR_CELL = 3.6;                                 // FORM A x3.6 = 108 x 101 (+20%)
class DragonRider extends EnemyBase {
  constructor(x, y){
    super(x, y, enemyHp(84), 300);
    this.vx = -(150 + Math.random()*50) * (1 + 0.30*enemyLv());   // 뒤로 갈수록 빨리 들어온다
    this.shootT = 1.0 + Math.random()*1.4;
    /**
     * ★ 중반부터 **넷에 하나는 방패**를 들고 온다 (기획 1).
     * 전부 들려 보내면 화면이 벽이 된다 — 한 무리에 하나둘이라야
     * "저건 위아래로 돌아가야겠다" 는 판단이 생긴다.
     */
    this.shield = (enemyLv() >= 0.30 && Math.random() < 0.28) ? 0.62 : 0;
    this.shieldT = 0;
  }
  get box(){ return { x:this.x - 38, y:this.y - 34, w:77, h:67 }; }
  update(dt, scene){
    this.t += dt;
    if(this.flash > 0) this.flash -= dt;
    if(this.castT > 0) this.castT -= dt;
    if(this.knock > 0) this.knock = Math.max(0, this.knock - 900*dt);
    this.x += (this.vx + this.knock)*dt;
    applyDive(this, dt);
    this.y = this.baseY + Math.sin(this.t*1.7)*30;
    this.flapUpdate(dt, 0.10);
    if(this.shieldT > 0) this.shieldT -= dt;
    if(this.x < GAME_W - 80){
      this.shootT -= dt;
      if(this.shootT <= 0){
        const el = enemyLv();
        /* 연사 2.2~3.1초 -> 1.2~1.7초 */
        this.shootT = (2.2 - 1.0*el) + Math.random()*(0.9 - 0.4*el);
        this.castT = CAST_TIME;                  // 쏘면서 고개를 숙인다
        const mx = this.x - 34, my = this.y + 6;
        const base = enemyAim(scene, mx, my), spd = 330 + 190*el;
        /**
         * ★ **잡몹도 모양이 있는 탄을 쏜다.** (기획 2, 2026-08-27)
         *
         * 예전에는 무엇이 나오든 **직선 세 갈래**뿐이었다. 탄을 늘리는 것보다
         * **탄이 그리는 모양**을 바꾸는 쪽이 훨씬 크게 다르다 —
         * 직선 열 발보다 원형 다섯 발이 어렵고 무엇보다 **기억에 남는다.**
         *
         * 스테이지가 오르면서 하나씩 열린다:
         *   부채(처음부터) -> 넓은 부채(중반) -> 원형 확산(후반)
         * 한 번에 다 열지 않는 이유: 새 모양이 처음 나오는 판에서 배울 틈이 있어야 한다.
         */
        if(el >= 0.62 && Math.random() < 0.45){
          /* 원형 확산 — 위아래 어디로 피해도 한 줄은 온다. 대신 사이가 넓다 */
          const n = 8, off = Math.random()*0.4;
          for(let i=0;i<n;i++)
            scene.eshots.push(new EnemyFire(mx, my, off + i*(Math.PI*2/n), spd*0.72, 11));
        }else{
          const spread = el >= 0.45
            ? [-Math.PI/5, -Math.PI/12, 0, Math.PI/12, Math.PI/5]
            : [-Math.PI/6, 0, Math.PI/6];
          for(const a of spread) scene.eshots.push(new EnemyFire(mx, my, base + a, spd, 11));
        }
      }
    }
    if(this.x < -120) this.dead = true;
  }
  die(scene){
    super.die(scene);
    scene.booms.push(new Boom(this.x, this.y, 104, 0.46));
    scene.booms.push(new Boom(this.x - 34, this.y + 18, 56, 0.4));
    scene.waves.push(new Shockwave(this.x, this.y, 260, 0.32));
    Particles.spawn(this.x, this.y, 40, { spd:560, life:0.65 });
    Particles.spawn(this.x, this.y, 12, { spd:420, life:0.9, grav:760, size:PX*2,
      pal:['#ffd0c8','#c4343a','#6b1420','#2a1014'] });
    if(this.gotScore > 0) Popups.add(this.x, this.y - 40, this.gotScore, PAL.fire[1], 4);
    Shake.add(11, 0.18);
    Flash.add('#ffb070', 0.08, 0.20);
    Freeze.add(0.05);
    SND.sfx('boomM');
  }
  render(ctx){
    castPose(ctx, this, () => drawFormDragon(ctx, RED_DRAGON_PAL, 'A', DR_CELL,
      this.x, this.y, this.pose, true, this.flash > 0 ? '#ffffff' : null, [A_RIDER]));
    if(this.shield) drawFrontShield(ctx, this, this.shieldT);
  }
}

/**
 * 정면 방패. 적의 **앞면 가운데**에 세로로 선 널빤지처럼 그린다 —
 * 어디가 막혔고 어디가 열렸는지 한눈에 읽혀야 한다.
 * 튕겨낸 직후에는 잠깐 하얗게 빛난다.
 */
/**
 * 맞은 순간 머리에 겹쳐 뜨는 해골. (2026-08-27, 사용자 지정)
 * 작게, 그러나 **눈이 이미 보고 있는 자리**에 — 그래야 싸우면서도 읽힌다.
 */
const SKULL = [
  '.WWWWW.',
  'WWWWWWW',
  'WKWWWKW',
  'WKWWWKW',
  'WWWKWWW',
  '.WWWWW.',
  '.W.W.W.',
];
/**
 * 사과를 먹었을 때 뜨는 웃는 얼굴. (2026-08-27, 사용자 지정)
 * 해골과 **같은 자리**에 뜬다 — 좋은 일이든 나쁜 일이든 얼굴을 보면 안다.
 */
const SMILE = [
  '.......',
  '.E...E.',
  '.E...E.',
  '.......',
  'M.....M',
  '.MMMMM.',
  '..MMM..',
];
/**
 * 미사일 아이콘. 오른쪽이 탄두, 왼쪽이 꼬리 — 플레이어가 쏘는 방향과 같다.
 * 도트 그리드로 그려야 게임 안의 다른 것들과 결이 맞는다.
 */
/**
 * ★ **세워진 로켓.** (2026-08-27, 사용자 지정)
 * *"로케트가 세워져 있는 디자인으로 (...) 위를 향하게 세워져 있고,
 *   누가봐도 로케트다 라는 느낌"*
 *
 * 눕힌 것은 미사일인지 물고기인지 헷갈렸다. **위를 향해 선 로켓**은
 * 뾰족한 코 · 몸통 · 창문 · 양옆 날개 · 아래로 뿜는 불꽃이 한 덩어리로 읽힌다.
 *   K 외곽 · W 흰 몸통 · R 붉은 코와 날개 · B 파란 창문
 */
const MISSILE_ART = [
  '.....KKK.....',
  '....KRRRK....',
  '....KRRRK....',
  '...KRRRRRK...',
  '...KWWWWWK...',
  '...KWBBBWK...',
  '...KWBBBWK...',
  '...KWWWWWK...',
  '..KKWWWWWKK..',
  '.KRRKWWWKRRK.',
  'KRRRKWWWKRRRK',
  'KRRKKWWWKKRRK',
  '.KK.KKKKK.KK.',
];
function drawMissileIcon(ctx, cx, cy, t){
  const cell = PX;
  const W = MISSILE_ART[0].length, H = MISSILE_ART.length;
  const ox = snap(cx - W*cell/2), oy = snap(cy - H*cell/2);
  /* 아래로 뿜는 불꽃 — 길이가 깜빡여서 "날고 있다" 로 보인다 */
  const f = Math.floor(t*18) % 2 === 0 ? 3 : 2;
  for(let i=0;i<f;i++){
    ctx.fillStyle = i === 0 ? '#fff6c2' : (i === 1 ? '#ffb03a' : '#ff5a2e');
    const w = (3 - i)*cell*2;
    ctx.fillRect(snap(cx - w/2), oy + H*cell + i*cell*2, w, cell*2);
  }
  for(let r=0;r<H;r++){
    for(let c=0;c<W;c++){
      const ch = MISSILE_ART[r][c];
      if(ch === '.') continue;
      ctx.fillStyle = ch === 'K' ? '#2b2f3a'
                    : ch === 'R' ? '#ff4d5a'
                    : ch === 'B' ? '#6fc8ff' : '#e8ecf6';
      ctx.fillRect(ox + c*cell, oy + r*cell, cell, cell);
    }
  }
}

function drawSmile(ctx, cx, cy, cell){
  const w = SMILE[0].length*cell, h = SMILE.length*cell;
  const ox = snap(cx - w/2), oy = snap(cy - h/2);
  for(let r=0;r<SMILE.length;r++){
    for(let c=0;c<SMILE[r].length;c++){
      const ch = SMILE[r][c];
      if(ch === '.') continue;
      ctx.fillStyle = ch === 'E' ? '#fff4f4' : '#ffd24a';
      ctx.fillRect(ox + c*cell, oy + r*cell, cell, cell);
    }
  }
}

function drawSkull(ctx, cx, cy, cell, k){
  const w = SKULL[0].length*cell, h = SKULL.length*cell;
  const ox = snap(cx - w/2), oy = snap(cy - h/2);
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * Math.min(1, k*3);      // 뜰 때 확 나타났다 사그라든다
  for(let r=0;r<SKULL.length;r++){
    for(let c=0;c<SKULL[r].length;c++){
      const ch = SKULL[r][c];
      if(ch === '.') continue;
      ctx.fillStyle = ch === 'K' ? '#1a0a10' : '#fff4f4';
      ctx.fillRect(ox + c*cell, oy + r*cell, cell, cell);
    }
  }
  ctx.globalAlpha = pa;
}

function drawFrontShield(ctx, e, flashT){
  const box = e.box;
  const mid = box.y + box.h/2, half = box.h * e.shield * 0.5;
  const x = snap(box.x - PX*4);
  const lit = flashT > 0;
  ctx.fillStyle = lit ? '#ffffff' : '#7fa8d8';
  ctx.fillRect(x, snap(mid - half), PX*3, snap(half*2));
  ctx.fillStyle = lit ? '#dff0ff' : '#c8e0f8';
  ctx.fillRect(x, snap(mid - half), PX*3, PX*2);
  ctx.fillRect(x, snap(mid + half - PX*2), PX*3, PX*2);
  ctx.fillStyle = lit ? '#ffffff' : '#3f5f8a';
  ctx.fillRect(x + PX*3, snap(mid - half + PX*3), PX, snap(half*2 - PX*6));
}

/* ---------------- 적5 : 동전 도둑 ----------------
   ★ **스스로 위험한 곳으로 가게 만든다.** (기획 9, 2026-08-27)

   떨어진 금화를 물고 화면 밖으로 달아난다. 잡으면 뱉는다.
   게임이 "저기 가라" 고 시키지 않아도 **플레이어가 알아서 간다** — 금화 경제와
   직결되기 때문이다. 강요하지 않고 올리는 압박이 가장 좋은 압박이다.

   훔쳐 간 금화는 **정말로 사라진다.** 안 그러면 무시하는 것이 최적이 되어
   이 적이 아무 의미가 없어진다. 대신 도둑은 약하고 느긋하게 도망간다 —
   쫓아갈 수 있어야 쫓을 마음이 든다. */
const THIEF_CELL = 3.4;
class CoinThief extends EnemyBase {
  constructor(x, y){
    super(x, y, enemyHp(52), 400);
    this.vx = -(210 + Math.random()*60);
    this.carry = 0;                  // 물고 있는 금화 개수
    this.fleeing = false;
  }
  get box(){ return { x:this.x - 26, y:this.y - 24, w:53, h:48 }; }
  update(dt, scene){
    this.t += dt;
    if(this.flash > 0) this.flash -= dt;
    if(this.knock > 0) this.knock = Math.max(0, this.knock - 900*dt);
    this.flapUpdate(dt, 0.09);

    if(!this.fleeing){
      /* 가장 가까운 금화로 간다 */
      let best = null, bd = 1e9;
      for(const it of scene.items){
        if(it.dead || it.kind !== ITEM_KIND.COIN) continue;
        const d = Math.hypot(it.x - this.x, it.y - this.y);
        if(d < bd){ bd = d; best = it; }
      }
      if(best){
        const a = Math.atan2(best.y - this.y, best.x - this.x);
        this.x += Math.cos(a)*300*dt; this.y += Math.sin(a)*300*dt;
        if(bd < 34){                 // 물었다
          best.dead = true; this.carry++;
          Popups.add(this.x, this.y - 34, '도둑!', '#ff9a5a', 3);
          SND.sfx('deny');
          if(this.carry >= 3) this.fleeing = true;
        }
      }else{
        this.x += this.vx*dt;
        this.y = this.baseY + Math.sin(this.t*2.4)*36;
      }
      /* 오래 못 찾으면 그냥 도망간다 — 화면에 눌러앉으면 성가시다 */
      if(this.t > 9) this.fleeing = true;
    }else{
      this.x += 420*dt;              // 오른쪽으로 달아난다
      this.y += Math.sin(this.t*7)*3;
    }
    this.baseY = this.y;
    if(this.x < -120 || this.x > GAME_W + 160) this.dead = true;
  }
  /** 잡히면 물고 있던 것을 전부 뱉는다 */
  die(scene){
    super.die(scene);
    for(let i=0;i<this.carry;i++)
      scene.items.push(new Item(this.x + (i-1)*26, this.y, ITEM_KIND.COIN));
    scene.booms.push(new Boom(this.x, this.y, 70, 0.36));
    Particles.spawn(this.x, this.y, 22, { spd:420, life:0.5, pal:['#fff6c2','#ffd24a','#c98a10'] });
    Popups.add(this.x, this.y - 34, this.carry > 0 ? '금화 회수' : this.gotScore, PAL.gold, 4, this.carry > 0);
    Shake.add(7, 0.12);
    SND.sfx('boomS');
  }
  render(ctx){
    drawFormDragon(ctx, THIEF_PAL, 'A', THIEF_CELL, this.x, this.y, this.pose, !this.fleeing,
      this.flash > 0 ? '#ffffff' : null, [A_RIDER]);
    /* 물고 있는 금화를 머리 위에 띄운다 — 잡을 값어치가 보여야 쫓는다 */
    for(let i=0;i<this.carry;i++)
      drawCoin(ctx, this.x - 22 + i*22, this.y - 44, 9, this.t*4 + i);
  }
}

/* ---------------- 적4 : 돌진병 ----------------
   ★ **읽고 피하는 첫 번째 적.** (기획 3, 2026-08-27)

   지금까지의 적은 전부 왼쪽으로 등속으로 흐른다 — 어디에 있든 결과가 같아서
   **자리를 고를 이유가 없었다.** 돌진병은 다르다:

     ① 화면 오른쪽에 멈춘다
     ② **조준선을 0.7초 보여준다**  ← 여기서 읽는다
     ③ 그 선을 따라 돌진한다

   반사신경이 아니라 **예고를 읽는 것**을 요구한다. 0.7초는 짧지 않다 —
   보고 비킬 수 있는 시간이어야 억울하지 않고, 억울하지 않아야 다시 한다.
   조준은 **멈춘 그 순간의 내 자리**로 고정된다. 계속 따라오면 피할 방법이 없다. */
const CHG_CELL = 4.2;
class Charger extends EnemyBase {
  constructor(x, y){
    super(x, y, enemyHp(120), 500);
    this.phase = 'come'; this.pt = 0;
    this.vx = -(320 + Math.random()*90);
    this.stopX = GAME_W - 180 - Math.random()*160;
    this.aimA = Math.PI; this.dashSpd = 0;
  }
  get box(){ return { x:this.x - 34, y:this.y - 30, w:69, h:60 }; }
  update(dt, scene){
    this.t += dt; this.pt += dt;
    if(this.flash > 0) this.flash -= dt;
    if(this.phase === 'come'){
      this.x += this.vx*dt;
      this.y = this.baseY + Math.sin(this.t*2.2)*22;
      if(this.x <= this.stopX){ this.phase = 'aim'; this.pt = 0; SND.sfx('deny'); }
    }else if(this.phase === 'aim'){
      /* 멈춰 서서 겨눈다. 여기서 조준선이 뜬다 */
      this.y = this.baseY + Math.sin(this.t*5.0)*7;      // 부르르 떤다 — 곧 온다는 신호
      if(this.pt >= CHARGE_TELL){
        const p = scene.nearestPlayer ? scene.nearestPlayer(this.x, this.y) : null;
        this.aimA = p ? Math.atan2(p.y - this.y, p.x - this.x) : Math.PI;
        this.dashSpd = 900 + 260*enemyLv();
        this.phase = 'dash'; this.pt = 0;
        Shake.add(4, 0.1);
      }
    }else{
      this.x += Math.cos(this.aimA)*this.dashSpd*dt;
      this.y += Math.sin(this.aimA)*this.dashSpd*dt;
      this.baseY = this.y;
      if(Math.random() < 0.7)
        Particles.spawn(this.x + 20, this.y, 1,
          { ang:this.aimA + Math.PI, spread:0.5, spd:220, life:0.3, pal:['#ffd8a0','#ff9a4a','#c4462a'] });
    }
    this.flapUpdate(dt, 0.08);
    if(this.x < -140 || this.y < -140 || this.y > GAME_H + 140) this.dead = true;
  }
  render(ctx){
    /* 겨누는 동안 **조준선**이 뜬다 — 이 선이 이 적의 전부다 */
    if(this.phase === 'aim'){
      const p = _aimPeek;
      const a = p ? Math.atan2(p.y - this.y, p.x - this.x) : Math.PI;
      const k = clamp(this.pt / CHARGE_TELL, 0, 1);
      ctx.globalAlpha = 0.30 + 0.55*k;
      ctx.fillStyle = k > 0.75 && Math.floor(this.pt*24) % 2 === 0 ? '#ffffff' : '#ff5a4a';
      for(let d = 46; d < 1500; d += PX*7){
        const x = this.x + Math.cos(a)*d, y = this.y + Math.sin(a)*d;
        if(x < -20 || x > GAME_W + 20 || y < -20 || y > GAME_H + 20) break;
        ctx.fillRect(snap(x), snap(y), PX*3, PX*3);
      }
      ctx.globalAlpha = 1;
    }
    drawFormDragon(ctx, CHARGER_PAL, 'A', CHG_CELL, this.x, this.y, this.pose, true,
      this.flash > 0 ? '#ffffff' : null, [A_RIDER]);
  }
  die(scene){
    super.die(scene);
    scene.booms.push(new Boom(this.x, this.y, 96, 0.42));
    Particles.spawn(this.x, this.y, 30, { spd:520, life:0.6 });
    if(this.gotScore > 0) Popups.add(this.x, this.y - 40, this.gotScore, PAL.fire[1], 4);
    Shake.add(9, 0.16);
    SND.sfx('boomM');
  }
}
/** 조준선을 그릴 때 참고할 플레이어 — 그리기는 scene 을 못 받는다 */
let _aimPeek = null;
const CHARGE_TELL = 0.70;          // 예고 시간. 짧으면 반사신경 시험이 된다

/* ---------------- 적3 : 헤비 드래곤 라이더 ---------------- */
const HV_CELL = 4.8;                                 // FORM A x4.8 = 144 x 134 (+20%)
class HeavyRider extends EnemyBase {
  constructor(x, y){
    super(x, y, enemyHp(220), 800);
    this.vx = -(95 + Math.random()*35);
    this.missileT = 1.6 + Math.random()*1.0;
    this.bombT    = 2.6 + Math.random()*1.2;
  }
  get box(){ return { x:this.x - 53, y:this.y - 43, w:106, h:86 }; }
  update(dt, scene){
    this.t += dt;
    if(this.flash > 0) this.flash -= dt;
    if(this.knock > 0) this.knock = Math.max(0, this.knock - 900*dt);
    // 화면 안으로 들어오면 감속해서 버팀
    if(this.x < GAME_W - 260) this.vx = Math.min(0, this.vx + 40*dt);
    this.x += (this.vx + this.knock)*dt;
    applyDive(this, dt);
    this.y = this.baseY + Math.sin(this.t*1.2)*38;
    this.flapUpdate(dt, 0.13);
    if(this.castT > 0) this.castT -= dt;
    if(this.x < GAME_W - 60){
      this.missileT -= dt;
      if(this.missileT <= 0){
        this.castT = CAST_TIME;                  // 쏘면서 고개를 숙인다
        const el = enemyLv();
        /* 유도탄이 잦아지고(2.6~3.6 -> 1.5~2.1초) 빨라지고(250 -> 380) 오래 쫓는다 */
        this.missileT = (2.6 - 1.1*el) + Math.random()*(1.0 - 0.4*el);
        scene.missiles.push(new HomingMissile(this.x - 46, this.y,
          scene.nearestPlayer(this.x, this.y), 250 + 130*el, 1.9 + 0.9*el));
      }
      this.bombT -= dt;
      if(this.bombT <= 0){
        this.bombT = (3.2 - 1.3*enemyLv()) + Math.random()*(1.4 - 0.5*enemyLv());
        scene.bombs.push(new Bomb(this.x, this.y + 30));
      }
    }
    if(this.x < -160) this.dead = true;
  }
  die(scene){
    super.die(scene);
    scene.booms.push(new Boom(this.x, this.y, 150, 0.58));
    for(let i=0;i<3;i++)
      scene.booms.push(new Boom(this.x + (Math.random()-0.5)*110, this.y + (Math.random()-0.5)*90,
        50 + Math.random()*44, 0.42));                                  // 연쇄 폭발
    scene.waves.push(new Shockwave(this.x, this.y, 420, 0.42));
    Particles.spawn(this.x, this.y, 56, { spd:640, life:0.8 });
    // 파편 8방향 (큰 덩어리)
    for(let i=0;i<8;i++)
      Particles.spawn(this.x, this.y, 4, { ang:i*Math.PI/4, spread:0.35, spd:560, life:1.0,
        grav:620, size:PX*3, pal:['#efe6ff','#b48ce0','#573083','#20102e'] });
    if(this.gotScore > 0) Popups.add(this.x, this.y - 56, this.gotScore, PAL.fire[0], 5);
    Shake.add(16, 0.3);
    Flash.add('#e0c0ff', 0.12, 0.34);
    Freeze.add(0.075);
    SND.sfx('boomM');
  }
  render(ctx){
    castPose(ctx, this, () => drawFormDragon(ctx, PURPLE_DRAGON_PAL, 'A', HV_CELL,
      this.x, this.y, this.pose, true, this.flash > 0 ? '#ffffff' : null, [A_RIDER]));
  }
}

/* ---------------- 중간보스 : 드래곤 나이트 ---------------- */
const MB_CELL = 7.2;                                 // FORM B x7.2 = 259 x 230 (+20%)
class MidBoss extends EnemyBase {
  constructor(stage, level){
    super(GAME_W + 180, GAME_H/2, midBossHpOf(stage, level), 5000);
    this.isBoss = true; this.name = '드래곤 기사';
    this.stageNo = stage;
    this.hurtDmg = Math.round(22 * stagePowerOf(stage));
    this.phase = 'enter'; this.pt = 0; this.pi = 0;
    this.homeX = GAME_W - 230; this.homeY = GAME_H/2;
    this.enraged = false;
    this.breathN = 0; this.breathT = 0;
  }
  get box(){ return { x:this.x - 98, y:this.y - 84, w:197, h:168 }; }
  get rate(){ return this.enraged ? 1.5 : 1; }
  update(dt, scene){
    this.t += dt;
    if(this.flash > 0) this.flash -= dt;
    if(!this.enraged && this.hp <= this.maxHp*0.5){
      this.enraged = true;
      Shake.add(8, 0.3);
      Particles.spawn(this.x, this.y, 26, { spd:400, life:0.6 });
    }
    this.flapUpdate(dt, 0.15);
    this.pt += dt * (this.phase === 'enter' ? 1 : this.rate);

    switch(this.phase){
      case 'enter':
        this.x += (this.homeX - this.x) * Math.min(1, 1.6*dt);
        this.y = this.homeY + Math.sin(this.t*1.1)*40;
        if(Math.abs(this.x - this.homeX) < 6){ this.phase = 'idle'; this.pt = 0; }
        break;
      case 'idle':                                    // 잠깐 부유하다 다음 패턴
        /**
         * ★ **가만히 떠 있지 않는다.** (2026-08-27, 사용자 지적)
         * *"중간보스와 최종보스 움직임이 너무 심심해"*
         * 위아래로만 흔들리던 것을 **앞뒤로도** 움직이게 하고, 다음 패턴을
         * 준비하는 동안 몸을 조금 크게 부풀린다 — 뭔가 온다는 신호가 된다.
         */
        this.y = this.homeY + Math.sin(this.t*1.1)*40;
        this.x = this.homeX + Math.sin(this.t*0.7)*26;
        if(this.pt > (this.enraged ? 0.5 : 0.8)){ this.nextPattern(scene); }
        break;
      case 'breath':                                  // 패턴1 : 3연속 화염 브레스
        this.y = this.homeY + Math.sin(this.t*1.1)*40;
        this.breathT -= dt * this.rate;
        if(this.breathT <= 0 && this.breathN > 0){
          this.breathN--; this.breathT = 0.45;
          for(let i=0;i<11;i++)
            scene.eshots.push(this.arm(new EnemyFire(this.x - 110, this.y + 10 + (i-5)*5,
              Math.PI + (i-5)*0.05, 470 + i*6, 15)));
          Shake.add(3, 0.08);
        }
        if(this.breathN <= 0 && this.breathT <= -0.6){ this.phase = 'idle'; this.pt = 0; }
        break;
      case 'wind': {                                  // 패턴2 : 날개 바람 (주인공 밀어냄)
        this.y = this.homeY + Math.sin(this.t*2.4)*26;
        for(const p of scene.livePlayers()) p.x -= 300*dt;   // 모든 플레이어를 왼쪽으로 밀어냄
        if(Math.random() < 0.6)
          Particles.spawn(this.x - 90, this.y + (Math.random()-0.5)*180, 1,
            { ang:Math.PI, spread:0.25, spd:520, life:0.42, grav:0, drag:0.6,
              pal:['#ffffff','#dfe9ff','#9fb6d8'] });
        if(this.pt > 1.8){ this.phase = 'idle'; this.pt = 0; }
        break;
      }
      case 'dash': {                                  // 패턴3 : 돌진 (좌 -> 우 복귀)
        const k = this.pt / 1.5;
        if(k < 0.55){
          this.x -= 1250*dt;
          if(this.x < -140) this.x = -140;
        }else{
          this.x += (this.homeX - this.x) * Math.min(1, 2.4*dt);
        }
        this.y += (scene.nearestPlayer(this.x, this.y).y - this.y) * Math.min(1, 1.2*dt);
        if(this.pt > 1.6){ this.phase = 'idle'; this.pt = 0; }
        break;
      }
    }
  }
  nextPattern(scene){
    const seq = ['breath','wind','dash'];
    this.phase = seq[this.pi % seq.length]; this.pi++;
    this.pt = 0;
    if(this.phase === 'breath'){ this.breathN = this.enraged ? 5 : 4; this.breathT = 0.2; }
    if(this.phase === 'dash')  Shake.add(4, 0.2);
  }
  die(scene){
    super.die(scene);
    scene.onBossKilled(this);
  }
  render(ctx){
    const tint = this.flash > 0 ? '#ffffff' : (this.enraged && Math.floor(this.t*5)%2 === 0 ? '#8f4a3a' : null);
    drawFormDragon(ctx, MIDBOSS_PAL, 'B', MB_CELL, this.x, this.y, this.pose, true, tint, [B_RIDER_KNIGHT]);
  }
}

/* ---------------- 최종보스 : 좀비 드래곤 로드 ---------------- */
const BOSS_CELL = 10.8;                              // FORM B x10.8 = 389 x 346 (+20%)
class Boss extends EnemyBase {
  constructor(stage, level){
    super(GAME_W + 280, GAME_H/2, bossHpOf(stage, level), 12000);
    this.kind = bossKindOf(stage);
    this.cell = this.kind.cell;
    this.isBoss = true; this.name = this.kind.n;
    /* 덩치가 크면 그만큼 잘 맞는다 — 체력을 비례해 올려 난이도를 맞춘다 */
    this.maxHp = Math.round(this.maxHp * this.cell / BOSS_CELL);
    this.hp = this.maxHp;
    this.phase = 'enter'; this.pt = 0; this.pi = 0;
    this.homeX = GAME_W - 250; this.homeY = GAME_H/2;
    this.enraged = false;
    this.swirlN = 0; this.swirlT = 0; this.swirlA = 0;
    this.windUp = 0;                 // 다음 패턴 직전에 1 로 오른다 (예고 연출)
    this.wallN = 0; this.wallT = 0;
    this.stageNo = stage;
    this.hurtDmg = Math.round(28 * stagePowerOf(stage));
    this.tier = bossTierOf(stage);               // 스테이지대별 외형 등급
    this.absorb = stage > 10 ? Math.min(0.5, 0.3 + (stage-11)*0.022) : 0;  // 미사일 흡수 확률
    this.absorbT = 0;
    this.pal = bossPalOf(stage);                 // 스테이지 테마색 + 종류 고유색
    /**
     * 부위. 그 보스가 **실제로 달고 있는 것만** 부술 수 있다 —
     * 꼬리칼날이 없는 보스의 꼬리를 부수라고 하면 말이 안 된다.
     */
    this.parts = BOSS_PART_DEFS
      .filter(d => d.key === 'horn' || this.kind[d.key])
      .map(d => ({ def:d, hp: Math.round(this.maxHp * d.hp), max: Math.round(this.maxHp * d.hp),
                   broken:false, flash:0 }));
    this.sealed = {};                            // 봉인된 패턴
  }
  /* 판정 상자는 **덩치에서 뽑는다** — 보이는 것과 맞는 것이 어긋나면 억울하다.
     144/125 는 BOSS_CELL(10.8) 일 때의 값이었다. */
  get box(){
    const hw = 13.333 * this.cell, hh = 11.574 * this.cell;
    return { x:this.x - hw, y:this.y - hh, w:hw*2, h:hh*2 };
  }
  get rate(){ return this.enraged ? 1.35 : 1; }
  /**
   * 이 높이에 맞았다면 어느 부위인가. 없으면 null (본체만 깎인다).
   * 이미 부서진 부위는 더 이상 판정하지 않는다 — 헛수고를 시키면 안 된다.
   */
  partAt(y){
    const b = this.box, u = (y - b.y) / b.h;
    for(const p of this.parts){
      if(p.broken) continue;
      if(u >= p.def.lo && u < p.def.hi) return p;
    }
    return null;
  }
  hit(dmg, bolt, scene){
    const p = bolt ? this.partAt(bolt.y) : null;
    if(p){
      p.hp -= dmg; p.flash = 0.1;
      if(p.hp <= 0){
        p.broken = true;
        this.sealed[p.def.seal] = true;
        /* 부순 값 — 본체도 함께 깎인다. 부수는 것이 손해면 아무도 안 한다 */
        this.hp -= this.maxHp * 0.06;
        scene.booms.push(new Boom(this.x, bolt.y, 120, 0.5));
        Particles.spawn(this.x, bolt.y, 34, { spd:520, life:0.7 });
        Popups.add(this.x, bolt.y - 40, p.def.ko + ' 파괴', PAL.gold, 5, true);
        Shake.add(14, 0.3); Freeze.add(0.06);
        SND.sfx('boomM');
      }
    }
    super.hit(dmg, bolt, scene);
  }
  update(dt, scene){
    this.t += dt;
    if(this.flash > 0) this.flash -= dt;
    if(this.absorbT > 0) this.absorbT -= dt;
    if(!this.enraged && this.hp <= this.maxHp*0.5){
      this.enraged = true;
      Shake.add(12, 0.5);
      scene.waves.push(new Shockwave(this.x, this.y));
      Particles.spawn(this.x, this.y, 40, { spd:520, life:0.8 });
    }
    this.flapUpdate(dt, 0.17);
    this.pt += dt * (this.phase === 'enter' ? 1 : this.rate);

    switch(this.phase){
      case 'enter':
        this.x += (this.homeX - this.x) * Math.min(1, 1.3*dt);
        this.y = this.homeY + Math.sin(this.t*0.9)*34;
        if(Math.abs(this.x - this.homeX) < 8){ this.phase = 'idle'; this.pt = 0; }
        break;
      case 'idle':
        /**
         * ★ **최종보스도 가만히 안 있는다.** (2026-08-27, 사용자 지적)
         * 위아래로만 흔들리면 큰 과녁일 뿐이다. 앞뒤로도 천천히 오가고,
         * 다음 패턴 직전에는 **한 번 크게 뒤로 물러났다 온다** — 예고가 된다.
         */
        this.y = this.homeY + Math.sin(this.t*0.9)*34;
        this.x = this.homeX + Math.sin(this.t*0.55)*38;
        this.windUp = clamp((this.pt - (this.enraged ? 0.20 : 0.40)) * 3.2, 0, 1);
        if(this.pt > (this.enraged ? 0.35 : 0.6)) this.nextPattern(scene);
        break;
      case 'swirl':                                   // 패턴1 : 화염 브레스 소용돌이
        this.y = this.homeY + Math.sin(this.t*0.9)*34;
        this.swirlT -= dt * this.rate;
        if(this.swirlT <= 0 && this.swirlN > 0){
          this.swirlN--; this.swirlT = 0.07;
          this.swirlA += 0.36;
          const arms = this.enraged ? 6 : 5;
          for(let i=0;i<arms;i++){
            const a = Math.PI + Math.sin(this.swirlA)*1.05 + i*(Math.PI*2/arms)*0.20;
            scene.eshots.push(this.arm(new EnemyFire(this.x - 130, this.y, a, 470, 15)));
          }
        }
        if(this.swirlN <= 0 && this.swirlT < -0.4){ this.phase = 'idle'; this.pt = 0; }
        break;
      case 'wall': {                                  // 패턴5 : 틈이 하나뿐인 화염 벽
        this.y = this.homeY + Math.sin(this.t*0.9)*34;
        this.wallT -= dt * this.rate;
        if(this.wallT <= 0 && this.wallN > 0){
          this.wallN--; this.wallT = 0.62;
          const gap = 120 + Math.random()*(GAME_H - 300);   // 통과할 수 있는 틈
          for(let y=60; y<GAME_H-40; y+=44){
            if(y > gap - 76 && y < gap + 76) continue;
            scene.eshots.push(this.arm(new EnemyFire(this.x - 120, y, Math.PI, 400, 15)));
          }
          Shake.add(4, 0.1);
        }
        if(this.wallN <= 0 && this.wallT < -0.5){ this.phase = 'idle'; this.pt = 0; }
        break;
      }
      case 'missile':                                 // 패턴2 : 미사일 10발
        this.y = this.homeY + Math.sin(this.t*0.9)*34;
        if(this.pt > 0.4 && !this.fired){
          this.fired = true;
          const n = this.enraged ? 18 : 14;
          for(let i=0;i<n;i++){
            const m = new HomingMissile(this.x - 90, this.y - 130 + i*(260/n),
              scene.nearestPlayer(this.x, this.y), 300 + i*10, 2.1);
            m.t = -i*0.05;                            // 약간씩 시차를 두고 유도 시작
            scene.missiles.push(m);
          }
          Shake.add(7, 0.18);
        }
        if(this.pt > 1.4){ this.phase = 'idle'; this.pt = 0; this.fired = false; }
        break;
      case 'charge': {                                // 패턴3 : 몸통 박치기
        const k = this.pt / 1.8;
        if(k < 0.25){
          this.x += 90*dt;                            // 살짝 뒤로 뺐다가
        }else if(k < 0.62){
          this.x -= 1650*dt;                          // 더 빠른 돌진
          if(this.x < -180) this.x = -180;
          // 지나간 자리에 불길을 남긴다
          if(Math.random() < 0.75){
            scene.eshots.push(this.arm(new EnemyFire(this.x + 60, this.y + (Math.random()-0.5)*200,
              Math.PI*0.5 + (Math.random()-0.5)*2.4, 120, 13)));
          }
          Particles.spawn(this.x + 90, this.y + (Math.random()-0.5)*200, 2,
            { spd:260, life:0.35, grav:0 });
        }else{
          this.x += (this.homeX - this.x) * Math.min(1, 2.2*dt);
        }
        this.y += (scene.nearestPlayer(this.x, this.y).y - this.y) * Math.min(1, 1.0*dt);
        if(this.pt > 1.9){ this.phase = 'idle'; this.pt = 0; }
        break;
      }
      case 'summon':                                  // 패턴4 : 일반 적 소환
        this.y = this.homeY + Math.sin(this.t*0.9)*34;
        if(this.pt > 0.4 && !this.fired){
          this.fired = true;
          const n = Math.min(14, Math.round(((this.enraged ? 6 : 4) + Math.floor(Math.random()*3))
                                             * enemyScale(this.stageNo || 1)));
          for(let i=0;i<n;i++)
            scene.enemies.push(new WingZombie(this.x - 40 + i*30,
              clamp(this.y - 130 + i*52, 110, 610), 250 + Math.random()*80));
          if(this.enraged) scene.enemies.push(new DragonRider(this.x - 60, this.y));
          Particles.spawn(this.x - 60, this.y, 20, { spd:300, life:0.5,
            pal:['#d8ffd0','#8fd48a','#3f8a5e','#1d4433'] });
        }
        if(this.pt > 1.2){ this.phase = 'idle'; this.pt = 0; this.fired = false; }
        break;
    }

    // 분노 상태에서는 주기적으로 전체 화면 충격파 추가
    if(this.enraged){
      this.shockT = (this.shockT === undefined ? 3.0 : this.shockT) - dt;
      if(this.shockT <= 0){ this.shockT = 3.4; scene.waves.push(new Shockwave(this.x, this.y)); Shake.add(9, 0.3); }
    }
  }
  nextPattern(scene){
    const seq = ['swirl','missile','wall','charge','summon','swirl','wall','charge'];
    /**
     * ★ 부서진 부위의 패턴은 건너뛴다 (기획 5). 전부 봉인되면
     * 남은 것(미사일·소환)만 돌린다 — 아무것도 안 하는 보스가 되면 안 된다.
     */
    let guard = 0;
    do { this.phase = seq[this.pi % seq.length]; this.pi++; guard++; }
    while(this.sealed[this.phase] && guard < seq.length * 2);
    if(this.sealed[this.phase]) this.phase = 'missile';
    this.pt = 0; this.fired = false;
    if(this.phase === 'swirl'){ this.swirlN = this.enraged ? 40 : 32; this.swirlT = 0.15; this.swirlA = 0; }
    if(this.phase === 'wall'){  this.wallN  = this.enraged ? 4 : 3;  this.wallT = 0.25; }
  }
  die(scene){
    super.die(scene);
    scene.onBossKilled(this);
  }
  /**
   * 부위 체력 막대. 보스 왼쪽에 **부위가 있는 높이에 맞춰** 세로로 세운다 —
   * 어디를 쏘면 무엇이 깎이는지 화면이 스스로 말해야 한다.
   */
  renderParts(ctx){
    const b = this.box, x = snap(b.x - PX*7);
    for(const p of this.parts){
      if(p.flash > 0) p.flash -= 1/60;
      if(p.broken) continue;
      const y0 = snap(b.y + b.h*p.def.lo + PX*2);
      const h = snap(b.h*(p.def.hi - p.def.lo) - PX*4);
      const k = clamp(p.hp / p.max, 0, 1);
      ctx.fillStyle = '#0a0a14'; ctx.fillRect(x - PX, y0 - PX, PX*5, h + PX*2);
      ctx.fillStyle = '#2a2030'; ctx.fillRect(x, y0, PX*3, h);
      ctx.fillStyle = p.flash > 0 ? '#ffffff' : '#7fd0e0';
      ctx.fillRect(x, snap(y0 + h*(1-k)), PX*3, snap(h*k));
    }
  }
  render(ctx){
    const pal = this.enraged ? BOSS_PAL_RAGE : this.pal;
    const P = bossPartsOf(this.kind);
    /**
     * ★ **다음 패턴 직전에 몸을 부풀린다.** (2026-08-27)
     * 큰 것이 숨을 들이켜는 것처럼 보여서 "온다" 를 읽을 수 있다.
     * 화내는 중이면 더 크게 — 물러났다 덮치는 결이 난다.
     */
    const wu = this.windUp || 0;
    if(wu > 0){
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(1 + wu*0.09, 1 - wu*0.05);
      ctx.translate(-this.x, -this.y);
    }
    /* 부서진 파츠는 그림에서도 빠진다 — 부순 것이 눈에 보여야 한 일이 된다 */
    const gone = {};
    for(const p of this.parts) if(p.broken) gone[p.def.key] = 1;
    const under = gone.horn ? [] : P.under;
    const over = P.over.filter((L) => {
      const f = FORMS.B;
      if(gone.ridge && L === f.parts.ridge) return false;
      if(gone.tail  && L === f.parts.tail)  return false;
      return true;
    });
    drawFormDragon(ctx, pal, 'B', this.cell, this.x, this.y, this.pose, true,
      this.flash > 0 ? '#ffffff' : null, over, under);
    if(wu > 0) ctx.restore();
    this.renderParts(ctx);
    // 미사일을 튕겨내는 보호막 (10스테이지 초과)
    if(this.absorbT > 0){
      const k = this.absorbT / 0.35;
      ctx.globalAlpha = k * 0.85;
      drawPixelRing(ctx, this.x, this.y, 150 + (1-k)*26, PX*3, '#9ad8ff');
      ctx.globalAlpha = k * 0.5;
      drawPixelRing(ctx, this.x, this.y, 132 + (1-k)*26, PX*2, '#ffffff');
      ctx.globalAlpha = 1;
    }
  }
}

/* ==================================================================
   웨이브 디렉터 : 90초 타임라인
   ================================================================== */
/**
 * ★ **한 판을 짧게 다시 짰다.** (2026-08-26, 사용자 지정)
 *
 * 20스테이지 완주에 41분이 걸렸다 — 그걸 끝까지 앉아서 할 사람은 많지 않다.
 * 스테이지당 124초를 **65초 안팎**으로 줄여 완주 20~25분을 노린다.
 * 잡몹 물결을 앞당기고 중간보스를 절반 시점에 내보낸다.
 */
const TIMELINE = [
  /* ★ **첫 3초에 환영 인사.** 시작하자마자 잡을 게 많아야 손이 바쁘다.
     예전에는 1초에 세 마리가 전부라 화면이 텅 빈 채로 시작했다. */
  { t: 0.6, k:'zombie', n:6 }, { t: 2.0, k:'zombie', n:6 }, { t: 3.2, k:'rider', n:2 },
  { t: 4.5, k:'zombie', n:5 }, { t: 6.0, k:'zombie', n:5 },
  { t: 8.0, k:'rider',  n:1 }, { t:10.0, k:'zombie', n:4 }, { t:12.0, k:'rider',  n:2 },
  { t:14.0, k:'zombie', n:5 }, { t:16.0, k:'heavy',  n:1 }, { t:18.0, k:'rider',  n:2 },
  /* ★ **20초에 리듬을 한 번 끊는다.** 중간보스까지 44초 동안 좀비만 오면 늘어진다.
     헤비 라이더 셋이 한꺼번에 오는 것으로 "작은 고비" 를 만든다. */
  { t:19.0, k:'heavy',  n:3 }, { t:21.0, k:'charger' },
  { t:22.0, k:'zombie', n:5 },
  { t:24.0, k:'rider',  n:2 }, { t:25.0, k:'thief' }, { t:26.0, k:'zombie', n:5 },
  { t:28.0, k:'heavy',  n:1 }, { t:30.0, k:'rider',  n:2 },
  { t:32.0, k:'zombie', n:6 }, { t:33.0, k:'charger' }, { t:34.0, k:'heavy',  n:1 },
  { t:36.0, k:'rider',  n:2 }, { t:37.0, k:'thief' }, { t:38.0, k:'zombie', n:6 },
  { t:40.0, k:'heavy',  n:1 }, { t:42.0, k:'rider',  n:2 },
  { t:44.0, k:'midboss' }
];
/* 스테이지가 오를수록 적이 20% 씩 늘어난다 (화면이 꽉 차도록).
   다만 무한정 늘리면 프레임이 무너지므로 배율과 동시 등장 수에 상한을 둔다. */
/**
 * 스테이지별 적 물량.
 *
 * ★ **첫판부터 많이 나오고, 그 뒤로 조금씩만 는다.** (2026-08-26, 사용자 지정)
 *
 * 예전에는 1스테이지가 기준값 1.0 이라 좀비가 진짜 세 마리씩 나왔다.
 * 1280px 화면에 셋이면 텅 빈다 — **첫판이 심심했던 가장 큰 이유**다.
 * 그리고 1.2^(n-1) 로 늘어 6스테이지쯤에 이미 상한에 닿았다.
 *
 * 시작을 2.2배로 올리고 증가율을 1.2 -> 1.055 로 낮춘다.
 *   S1 2.2 · S5 2.7 · S10 3.6 · S15 4.6 · S20 6.0(상한)
 * 첫판부터 손이 바쁘고, 뒤로 갈수록 "조금씩 더 빡세지는" 결이 된다.
 */
function enemyScale(stage){
  /* ★ '벌떼' 판은 물량이 한 단계 더 는다 (기획 4) */
  const rule = STAGES[clamp(stage|0, 1, 20)].rule === 'swarm' ? 1.35 : 1;
  return Math.min(7, 2.2 * Math.pow(1.055, (stage|0) - 1) * rule) * diffScale();
}
/* 화면 밖 위/아래에서 비스듬히 들어온 적을 목표 높이까지 내려/올려 보낸다.
   WingZombie 는 EnemyBase 를 상속하지 않으므로 공용 함수로 둔다. */
function applyDive(e, dt){
  if(e.diveTo == null) return;
  e.baseY += e.diveV*dt;
  if((e.diveV > 0 && e.baseY >= e.diveTo) || (e.diveV < 0 && e.baseY <= e.diveTo)){
    e.baseY = e.diveTo; e.diveTo = null;
  }
}
const MAX_ALIVE_ENEMIES = 64;       // 프레임 예산. 이보다 늘려도 화면에선 구분이 안 된다.
const DIAGONAL_STAGE = 10;          // 이 스테이지를 넘으면 위/아래 대각선 등장 추가

/* 최종보스는 "중간보스를 잡은 뒤" 에만 나온다.
   예전엔 시간이 되면 중간보스가 살아있어도 최종보스가 겹쳐 나와서 난장판이었다. */
const BOSS_AFTER_MID = 4;       // 중간보스 전멸 후 최종보스까지의 뜸
const BOSS_ADD_INTERVAL = 5.5;  // 보스전 중 잡몹 보충 주기
const TWIN_MID_STAGE = 10;      // 이 스테이지를 넘으면 중간보스가 2마리

/**
 * 적 대형. (2026-08-26, 사용자 지정)
 *
 * 예전에는 늘 격자였다 — 열을 세워 놓고 세로로 흩뿌리는 것 하나뿐이라,
 * 몇 마리가 오든 "또 그 줄" 이었다. 대형이 보이면 등장 자체가 볼거리가 된다.
 *
 * 각 대형은 **마리 수 n 을 받아 (dx, dy) 목록**을 돌려준다.
 *   dx : 오른쪽으로 얼마나 뒤에서 오는가 (0 이 맨 앞)
 *   dy : 대형 중심에서 위아래로 얼마나
 * 자리만 정하고 그리기·움직임은 건드리지 않는다 — 대형을 더 넣는 일이
 * 함수 하나 적는 일이 되게 하려는 것이다.
 */
const FORM_GAP = 92;          // 앞뒤 간격
const FORM_ROW = 62;          // 위아래 간격

/**
 * 다각형 둘레를 따라 n 마리를 **고르게** 세운다.
 *
 * 각도를 균등하게 나누면 뾰족한 대형(마름모·별)이 뭉개진다 — 꼭짓점 근처가 촘촘하고
 * 변 가운데가 비기 때문이다. 둘레 길이를 재서 나누면 어떤 모양이든 형태가 살아난다.
 */
function polyRing(pts, n) {
  const m = pts.length;
  const seg = [], len = [];
  let total = 0;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % m];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    seg.push([a, b]); len.push(d); total += d;
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    let want = (i / n) * total;
    for (let k = 0; k < m; k++) {
      if (want > len[k] && k < m - 1) { want -= len[k]; continue; }
      const [a, b] = seg[k];
      const t = len[k] > 0 ? want / len[k] : 0;
      out.push({ dx: a.x + (b.x - a.x) * t, dy: a.y + (b.y - a.y) * t });
      break;
    }
  }
  return out;
}

/**
 * 대형이 들어갈 세로 폭. 위아래로 이만큼 안에 모양이 다 들어와야
 * `clamp` 에 잘리지 않는다 (110 ~ 610).
 */
const FORM_TOP = 130, FORM_BAND = 460;

const FORMATIONS = [
  {
    /** 학익진 — 가운데가 앞서고 양 날개가 뒤로 감싼다 */
    ko: '학익진',
    at(n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const k = i - (n - 1) / 2;                 // 가운데가 0
        out.push({ dx: Math.abs(k) * FORM_GAP * 0.72, dy: k * FORM_ROW });
      }
      return out;
    },
  },
  {
    /** 쐐기 — 하나가 앞장서고 뒤로 넓어진다 (독수리) */
    ko: '독수리',
    at(n) {
      const out = [{ dx: 0, dy: 0 }];
      for (let i = 1; i < n; i++) {
        const rank = Math.ceil(i / 2), side = (i % 2 === 1) ? -1 : 1;
        out.push({ dx: rank * FORM_GAP * 0.8, dy: side * rank * FORM_ROW * 0.9 });
      }
      return out;
    },
  },
  {
    /** 마름모 — 앞뒤로 뾰족하고 가운데가 넓다 */
    ko: '다이아몬드',
    at(n) {
      const w = Math.max(2, n / 4) * FORM_ROW;        // 위아래 반지름
      const d = Math.max(2.2, n / 4) * FORM_GAP;      // 앞뒤 반지름
      return polyRing([{ x: 0, y: 0 }, { x: d, y: -w }, { x: d * 2, y: 0 }, { x: d, y: w }], n);
    },
  },
  {
    /** 원형 — 둥글게 뭉쳐서 굴러 들어온다 */
    ko: '원형',
    at(n) {
      const out = [];
      const r = Math.max(1.2, n / 5) * FORM_ROW;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        out.push({ dx: FORM_GAP + Math.cos(a) * r * 1.5, dy: Math.sin(a) * r });
      }
      return out;
    },
  },
  {
    /** 별 — 뾰족한 다섯 갈래. 꼭짓점 열 개(바깥 5, 안쪽 5)를 이은 선 위에 세운다 */
    ko: '별',
    at(n) {
      const R = Math.max(2, n / 4) * FORM_ROW;        // 바깥 반지름
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const rr = (i % 2 === 0) ? R : R * 0.42;      // 번갈아 길게/짧게 = 별
        pts.push({ x: Math.cos(a) * rr * 1.5, y: Math.sin(a) * rr });
      }
      return polyRing(pts, n);
    },
  },
  {
    /** 세로 벽 — 한 줄로 길게 서서 밀고 들어온다 */
    ko: '장벽',
    at(n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const k = i - (n - 1) / 2;
        out.push({ dx: (i % 2) * FORM_GAP * 0.35, dy: k * FORM_ROW * 0.95 });
      }
      return out;
    },
  },
  {
    /**
     * ★ **화살표** — 왼쪽(플레이어 쪽)을 겨눈 촉.
     * 촉 두 변과 자루로 이루어진 닫힌 선 위에 세운다.
     */
    ko: '화살표',
    at(n) {
      const R = Math.max(2, n / 5) * FORM_ROW;
      const D2 = Math.max(2.4, n / 5) * FORM_GAP;
      return polyRing([
        { x: 0,        y: 0 },            // 촉 끝 (왼쪽)
        { x: D2 * 1.5, y: -R * 1.5 },     // 위 날개
        { x: D2 * 1.5, y: -R * 0.5 },
        { x: D2 * 3.0, y: -R * 0.5 },     // 자루 위
        { x: D2 * 3.0, y:  R * 0.5 },     // 자루 아래
        { x: D2 * 1.5, y:  R * 0.5 },
        { x: D2 * 1.5, y:  R * 1.5 },     // 아래 날개
      ], n);
    },
  },
  {
    /**
     * ★ **하트** — 매개변수 곡선을 그대로 쓴다.
     * 손으로 점을 찍으면 하트처럼 안 보인다 — 수식이 훨씬 정직하다.
     */
    ko: '하트',
    at(n) {
      const S = Math.max(1.1, n / 13) * FORM_ROW;
      const out = [];
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
        /* **세워서** 온다 — 눕히면 하트로 안 보인다 (모로 누운 하트를 알아보기는 어렵다) */
        out.push({ dx: hx * S * 0.5, dy: -hy * S * 0.5 });
      }
      return out;
    },
  },
  {
    /** ★ **십자** — 네 갈래로 곧게 뻗는다. 가운데가 비어 뚫고 지나가기 쉽다 */
    ko: '십자',
    at(n) {
      const A = Math.max(2, n / 5) * FORM_ROW;
      const B = Math.max(2, n / 5) * FORM_GAP;
      const out = [];
      for (let i = 0; i < n; i++) {
        const arm = i % 4, k = 1 + ((i / 4) | 0);
        if (arm === 0) out.push({ dx: B * 2,          dy: -A * k });
        if (arm === 1) out.push({ dx: B * 2,          dy:  A * k });
        if (arm === 2) out.push({ dx: B * 2 - B * k,  dy: 0 });
        if (arm === 3) out.push({ dx: B * 2 + B * k,  dy: 0 });
      }
      return out;
    },
  },
  {
    /** ★ **나선** — 소용돌이처럼 감겨 들어온다 */
    ko: '나선',
    at(n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const t = i / Math.max(1, n - 1);
        const a = t * Math.PI * 3.2;
        const r = (0.4 + t * 1.5) * FORM_ROW * Math.max(1.4, n / 6);
        out.push({ dx: FORM_GAP * 2 + Math.cos(a) * r * 1.4, dy: Math.sin(a) * r });
      }
      return out;
    },
  },
  {
    /** ★ **물결** — 파도처럼 오르내리며 밀려온다 */
    ko: '물결',
    at(n) {
      const out = [];
      /* 파장을 **무리 전체에 두 번**으로 고정한다 — 마릿수가 달라져도 늘 파도로 보인다 */
      for (let i = 0; i < n; i++) {
        const t = i / Math.max(1, n - 1);
        out.push({ dx: t * FORM_GAP * n * 0.42,
                   dy: Math.sin(t * Math.PI * 4) * FORM_ROW * Math.max(2.2, n / 3) });
      }
      return out;
    },
  },
  {
    /** 예전의 그 격자 — 없애지 않는다. 늘 특별한 대형만 오면 특별하지 않다 */
    ko: '무리',
    at(n) {
      const out = [];
      const perCol = Math.max(1, Math.ceil(n / Math.ceil(n / 6)));
      for (let i = 0; i < n; i++) {
        const col = (i / perCol) | 0, row = i % perCol;
        out.push({ dx: col * 96 + (row % 2) * 34, dy: (row - perCol / 2) * 58 + (col % 2) * 29 });
      }
      return out;
    },
  },
];

class Director {
  constructor(scene, stage, duel){
    this.s = scene; this.stage = stage || 1;
    this.duel = !!duel;
    this.t = 0; this.idx = 0;
    this.midKilledAt = -1; this.bossSpawned = false; this.midSpawned = false;
    this.midAlive = 0;                 // 살아있는 중간보스 수 (2마리일 수 있다)
    this.addT = BOSS_ADD_INTERVAL;     // 보스전 중 잡몹 보충 타이머
    /**
     * 결투 : 보스 사다리.
     * 한 마리를 무너뜨리면 잠깐 숨 돌릴 틈을 주고 **더 센 놈**이 올라온다.
     * 세기는 스테이지 값으로 매긴다 — 이미 있는 눈금을 다시 만들 이유가 없다.
     */
    this.duelN = 0;                    // 지금까지 내보낸 보스 수
    this.duelWait = duel ? 2.5 : 0;    // 다음 보스까지 남은 시간
  }
  update(dt){
    this.t += dt;
    if(this.duel){ this.updateDuel(dt); return; }
    // 스크립트 소화
    while(this.idx < TIMELINE.length && this.t >= TIMELINE[this.idx].t){
      const e = TIMELINE[this.idx++];
      if(e.k === 'midboss'){ this.spawnMid(); }
      else if(e.k === 'thief'){
        /* 도둑은 **금화가 바닥에 있을 때만** 의미가 있다. 2스테이지부터 하나씩 */
        if(CUR_STAGE >= 2) this.spawnGroup('thief', 1);
      }
      else if(e.k === 'charger'){
        /* ★ 돌진병은 **4스테이지부터** 나온다 (기획 3).
           첫 세 판은 조작을 익히는 자리라 읽고 비키는 것까지 요구하지 않는다. */
        if(CUR_STAGE >= 4) this.spawnGroup('charger', CUR_STAGE >= 12 ? 2 : 1);
      }
      else this.spawnGroup(e.k, e.n);
    }
    // 최종보스는 중간보스를 전부 잡은 뒤에만. 둘이 동시에 나오지 않는다.
    if(!this.bossSpawned && this.midKilledAt >= 0 && this.t - this.midKilledAt >= BOSS_AFTER_MID)
      this.spawnBoss();
    // 보스전 중에도 잡몹이 계속 흘러들어온다 (보스만 덩그러니 있으면 심심하다)
    if(this.midSpawned){
      this.addT -= dt;
      if(this.addT <= 0){
        this.addT = BOSS_ADD_INTERVAL;
        this.spawnGroup(Math.random() < 0.72 ? 'zombie' : 'rider', Math.random() < 0.5 ? 2 : 3);
      }
    }
  }
  /**
   * 결투의 진행.
   * 보스가 없으면 다음 놈을 부르고, 그 사이사이 잡몹이 계속 흘러들어온다 —
   * 보스만 덩그러니 있으면 300초가 지루하다.
   */
  updateDuel(dt){
    const s = this.s;
    const bossAlive = s.enemies.some(e => e.isBoss && !e.dead);

    if(!bossAlive){
      this.duelWait -= dt;
      if(this.duelWait <= 0 && this.duelN < DUEL.BOSSES){
        this.duelN++;
        const st = DUEL.bossStage(this.duelN);
        this.stage = st;
        CUR_STAGE = st;                       // 적 생성자가 이 값을 본다
        /* 홀수 번째는 기사, 짝수 번째는 최종보스형 — 열 마리가 다 같으면 지겹다 */
        const b = (this.duelN % 2 === 1)
          ? new MidBoss(st, s.p1.level)
          : new Boss(st, s.p1.level);
        s.enemies.push(b); s.boss = b;
        s.bossBannerT = 2.2;
        s.duelBossNo = this.duelN;
        Shake.add(6, 0.4); SND.sfx('warn');
      }
    }else{
      this.duelWait = 2.5;                    // 다음 놈까지의 틈
    }

    /* 잡몹 보충 — 보스전 사이의 빈 시간을 채운다 */
    this.addT -= dt;
    if(this.addT <= 0){
      this.addT = BOSS_ADD_INTERVAL;
      this.spawnGroup(Math.random() < 0.7 ? 'zombie' : 'rider', Math.random() < 0.5 ? 2 : 3);
    }
  }

  spawnGroup(kind, n){
    const s = this.s;
    n = Math.max(1, Math.round(n * enemyScale(this.stage)));
    const alive = s.enemies.length;
    if(alive >= MAX_ALIVE_ENEMIES) return;                     // 과부하 방지
    n = Math.min(n, MAX_ALIVE_ENEMIES - alive);
    // 10스테이지를 넘으면 정면뿐 아니라 위/아래 대각선에서도 밀고 들어온다
    const diagonal = this.stage > DIAGONAL_STAGE && Math.random() < 0.5;
    const from = diagonal ? (Math.random() < 0.5 ? -1 : 1) : 0;
    let y0 = from === 0 ? 150 + Math.random()*380
             : (from < 0 ? -70 - Math.random()*90 : GAME_H + 70 + Math.random()*90);
    /**
     * ★ **대형을 짜서 들어온다.** (2026-08-26, 사용자 지정)
     * 세 마리 이하는 대형이라고 할 게 없으므로 그냥 무리로 온다 —
     * 두 마리로 학익진을 짜 봐야 그냥 두 마리다.
     */
    const F = n >= 4
      ? FORMATIONS[(Math.random() * FORMATIONS.length) | 0]
      : FORMATIONS[FORMATIONS.length - 1];
    let spots = F.at(n);
    /**
     * ★★ **모양이 화면에 들어오게 줄인다.** (2026-08-27, 사용자 지적)
     *
     * *"대형이 너무 흩어져서 등장하니 재미가 없다"*
     *
     * 자리는 제대로 잡고 있었는데, 바로 아래에서 `clamp(y0 + dy, 110, 610)` 로
     * **세로를 잘라 버렸다.** 대형이 세로 500px 보다 크면 넘치는 것들이 전부
     * 위아래 끝으로 눌려서 **두 줄로 뭉갰다** — 하트든 별이든 다 같은 모양이 됐다.
     *
     * 잘라서 맞추는 대신 **줄여서 맞춘다.** 가로도 같은 배율로 줄여야 모양이
     * 안 찌그러진다. 그리고 세로 한가운데에 놓아 위아래로 고르게 편다.
     */
    {
      let lo = Infinity, hi = -Infinity;
      for(const sp of spots){ if(sp.dy < lo) lo = sp.dy; if(sp.dy > hi) hi = sp.dy; }
      const span = hi - lo;
      if(span > FORM_BAND){
        const k = FORM_BAND / span;
        spots = spots.map(sp => ({ dx: sp.dx * k, dy: sp.dy * k }));
        lo *= k; hi *= k;
      }
      /* 세로 한가운데에 오도록 기준선을 다시 잡는다 (정면으로 올 때만) */
      if(from === 0) y0 = FORM_TOP + (FORM_BAND - (hi - lo))/2 - lo;
    }

    /* 이름이 뜨는 건 정면으로 밀고 들어오는 큰 대형일 때만 —
       위아래에서 파고드는 건 대형이 눈에 안 보이고, 매번 뜨면 시끄럽다 */
    /* 이름은 정면으로 밀고 들어오는 대형일 때만 — 위아래에서 파고들면 모양이 안 보인다 */
    if(from === 0 && n >= 5 && F.ko !== '무리') s.noteFormation(F.ko);

    const make = (x, y) => kind === 'zombie' ? new WingZombie(x, y, 160 + Math.random()*70)
                         : kind === 'rider'  ? new DragonRider(x, y)
                         : kind === 'charger'? new Charger(x, y)
                         : kind === 'thief'  ? new CoinThief(x, y)
                         :                     new HeavyRider(x, y);

    /**
     * ★★ **대형이 흩어지지 않게.** (2026-08-27, 사용자 지적)
     *
     * *"대형을 갖춰서 등장해야 재밌는데 대형이 너무 흩어져서 등장하니 재미가 없다"*
     *
     * 자리는 제대로 잡아 놓고 있었다. 그런데 구성원마다
     *   · 속도가 제각각이고 (`160 + Math.random()*70`)
     *   · 흔들림 위상이 제각각이라 (`this.t = Math.random()*6`)
     * **몇 초 만에 모양이 풀렸다.** 그래서 무슨 대형인지 볼 새가 없었다.
     *
     * 한 무리는 **같은 속도, 같은 위상**으로 들어온다 — 그래야 모양이 눈에 남는다.
     * 대신 무리마다 값이 다르므로 모든 적이 똑같이 움직이지는 않는다.
     */
    const groupSpd = 0.86 + Math.random()*0.28;     // 이 무리의 속도 배수
    const groupPh = Math.random()*Math.PI*2;        // 이 무리의 흔들림 위상
    for(let i=0;i<spots.length;i++){
      const sp = spots[i];
      const x = GAME_W + 80 + sp.dx;
      let e;
      if(from === 0){
        e = make(x, clamp(y0 + sp.dy, 110, 610));
      }else{
        // 화면 밖 위/아래에서 비스듬히 들어와 플레이 구역으로 자리잡는다
        e = make(x, y0 + sp.dy*0.8 + sp.dx*0.3*from);
        e.diveTo = clamp(140 + Math.random()*440, 120, 600);
        e.diveV  = (from < 0 ? 1 : -1) * (110 + Math.random()*70);
      }
      /* 한 무리는 같은 속도·같은 박자로 — 이게 있어야 대형이 보인다 */
      if(e){
        if(typeof e.vx === 'number') e.vx *= groupSpd;
        e.t = groupPh;
      }
      s.enemies.push(e);
    }
  }
  spawnMid(){
    if(this.midSpawned) return;
    this.midSpawned = true;
    // 10스테이지를 넘으면 한 번에 2마리. 한 마리당 체력은 65% 로 낮춰
    // 물량은 늘리되 무한정 길어지지는 않게 한다.
    const twin = this.stage > TWIN_MID_STAGE;
    const n = twin ? 2 : 1;
    for(let i=0;i<n;i++){
      const b = new MidBoss(this.stage, this.s.p1.level);
      if(twin){
        b.hp = b.maxHp = Math.round(b.maxHp * 0.65);
        b.homeY = GAME_H/2 + (i === 0 ? -140 : 140);
        b.y = b.baseY = b.homeY;
        b.x += i*150;
      }
      this.s.enemies.push(b);
      if(i === 0) this.s.boss = b;
    }
    this.midAlive = n;
    this.s.bossBannerT = 2.2;
    Shake.add(6, 0.4);
    SND.sfx('warn');
  }
  spawnBoss(){
    if(this.bossSpawned) return;
    this.bossSpawned = true;
    const b = new Boss(this.stage, this.s.p1.level);
    this.s.enemies.push(b); this.s.boss = b;
    this.s.bossBannerT = 2.6;
    Shake.add(9, 0.6);
    SND.sfx('warn');
  }
  onBossKilled(b){
    if(this.duel){
      /* 사다리는 `updateDuel` 이 "보스가 없으면 다음" 으로 굴린다 — 여기서 할 일이 없다 */
      this.s.boss = null;
      return;
    }
    if(b instanceof MidBoss){
      this.midAlive = Math.max(0, this.midAlive - 1);
      // 2마리일 때는 둘 다 잡아야 최종보스가 나온다
      if(this.midAlive === 0) this.midKilledAt = this.t;
      else this.s.boss = this.s.enemies.find(e => e instanceof MidBoss && !e.dead) || null;
    }
  }
}

/* ==================================================================
   Phase 5 : 탄도미사일 / 필살기 드래곤 뢰 / 아이템
   ================================================================== */

/* 보스 체력은 "지금 내 화력" 에 연동해서 정한다.
   불 DPS 가 Lv1 -> Lv10 사이에 11배 뛰기 때문에 체력을 고정하면
   레벨이 오르는 순간 보스가 1초만에 녹아버린다.
   완전 비례가 아니라 0.8 제곱으로 눌러서, 강해진 만큼은 더 빨리 잡히게 한다. */
function fireDpsOf(level){
  // 줄이 여러 개라도 한 발은 오브젝트 1개 = 타격 1회다
  const lv = clamp(level|0, 1, MAX_LEVEL);
  return FIRE[lv].dmg / fireGap(lv);
}
function bossPowerScale(level){ return Math.pow(fireDpsOf(level) / fireDpsOf(1), 0.8); }

/**
 * ★ **보스를 얇게.** (2026-08-26)
 *
 * 화력 상한을 낮추자 보스전이 전체 시간의 **51%** 를 차지했다 (판당 60초씩,
 * 그걸 스무 번). `bossPowerScale` 이 체력을 화력에 연동해 두었지만 지수가 0.8 이라
 * 화력이 내려가면 **오히려 보스전이 길어진다** (시간 = 화력^-0.2).
 *
 * 어차피 지금 노리는 재미는 **피하는 것**이지 두꺼운 과녁을 오래 깎는 것이 아니다.
 * 맷집은 지루함을 만들고 탄은 긴장을 만든다 — 8200 -> 2600 으로 내려
 * 보스전을 판당 20초 안팎으로 되돌린다. 미사일 데미지도 이 값에서 나오므로
 * (`missileDamageOf`) 함께 따라 내려간다.
 */
/**
 * ★ **최종보스를 두 배로.** (2026-08-27, 사용자 지정)
 * *"최종보스가 너무 약함 (...) 지금 딱 이 상태보다 2배정도 강하게"*
 * 중간보스는 그대로 두고 **최종보스만** 두껍게 한다 — 판의 마지막이
 * 중간보스와 비슷한 무게면 끝났다는 느낌이 안 난다.
 *
 * ★ 2.8 -> 5.6 으로 두 배를 걸었더니 실제로는 1.5배밖에 안 올랐다.
 *   보스 체력이 `bossPowerScale` 로 **내 화력에 연동**돼 있는데, 같은 작업에서
 *   화력을 낮췄으니 그만큼 같이 내려간 것이다. 두 배가 되려면 7.3 이 필요하다
 *   (2.8 x 2 / 0.768). 연동을 걷어내는 대신 값으로 맞춘다 —
 *   연동은 "레벨을 올리면 보스도 같이 두꺼워진다" 는 다른 일을 하고 있다.
 */
const MID_BOSS_BASE = 2600, BOSS_MUL = 7.3;
/* 스테이지가 1 오를 때마다 보스가 5% 씩 단단해지고 5% 씩 세게 때린다.
   1스테이지와 20스테이지 보스가 똑같으면 스테이지를 올라갈 이유가 없다.
   20스테이지 기준 2.53배. */
function stagePowerOf(stage){ return Math.pow(1.05, clamp(stage|0, 1, 20) - 1); }
/* 일반 적의 맷집도 스테이지에 비례해 오른다.
   이게 없으면 고스테이지에서도 불 몇 방에 녹아버려 난이도가 그대로다.
   S20 기준 4.3배. */
function enemyToughOf(stage){ return Math.pow(1.08, clamp(stage|0, 1, 20) - 1); }
/**
 * ★★ **적도 레벨업한다.** (2026-08-26, 사용자 지정)
 *
 * *"상대 캐릭터들도 랩업이 되면서 점점 강해져야 하는데 나 혼자만 강하니깐"*
 *
 * 예전에 스테이지가 올라가며 바뀌는 것은 **적의 수와 맷집뿐**이었다. 쏘는 속도도,
 * 쏘는 간격도, 쏘는 방향도 1스테이지와 20스테이지가 똑같았다. 그래서 뒤로 갈수록
 * "더 단단한 과녁이 더 많이" 나올 뿐, **피할 것이 늘지는 않았다** — 지루해지는
 * 두 번째 이유가 이것이다.
 *
 * 이제 스테이지를 적의 레벨로 삼아 세 가지를 함께 올린다:
 *   · **탄속** — 반응할 시간이 줄어든다
 *   · **연사** — 화면에 깔리는 탄이 늘어난다
 *   · **조준** — 중반부터 내 위치를 보고 쏜다 (가만히 있으면 맞는다)
 *
 * 맷집을 올리는 것과 다르다. 맷집은 **지루함**을 만들고 탄은 **긴장**을 만든다.
 */
function enemyLv(){ return clamp((CUR_STAGE - 1) / 19, 0, 1); }
/** 조준이 시작되는 지점. 초반에는 정직하게 앞으로만 쏜다 */
const AIM_FROM = 0.35;
/**
 * 쏘는 방향. 레벨이 낮으면 그냥 왼쪽(Math.PI), 높으면 **가까운 플레이어 쪽**이다.
 * 완전 조준이 아니라 레벨만큼만 조준선 쪽으로 기울인다 — 갑자기 백발백중이 되면
 * 피할 수 있는 게임이 아니라 운에 맡기는 게임이 된다.
 */
function enemyAim(scene, x, y){
  const el = enemyLv();
  if(el < AIM_FROM || !scene.nearestPlayer) return Math.PI;
  const p = scene.nearestPlayer(x, y);
  if(!p) return Math.PI;
  const want = Math.atan2(p.y - y, p.x - x);
  /* Math.PI 에서 조준선까지 (el - AIM_FROM) 만큼만 간다 */
  const k = clamp((el - AIM_FROM) / (1 - AIM_FROM), 0, 1) * 0.85;
  let d = want - Math.PI;
  while(d >  Math.PI) d -= Math.PI*2;
  while(d < -Math.PI) d += Math.PI*2;
  return Math.PI + d * k;
}

let CUR_STAGE = 1;                  // 적 생성 시 참조할 현재 스테이지
/**
 * ★ **모든 적이 20% 더 단단하다.** (2026-08-27, 사용자 지정)
 * *"공격이 쎄서 안맞는거 같다 (...) 적의 모든 캐릭터 방어력을 20% 정도 키우자"*
 * 화력을 깎는 대신 맷집을 올린 이유: 화력을 깎으면 **불줄기가 초라해 보이는데**,
 * 지금 문제는 그림이 아니라 적이 너무 빨리 녹는 것이다.
 */
const ENEMY_TOUGH = 1.20;
function enemyHp(base){
  return Math.round(base * ENEMY_TOUGH * enemyToughOf(CUR_STAGE) * diffHp());
}
function midBossHpOf(stage, level){
  return Math.round(MID_BOSS_BASE * bossPowerScale(level || 1) * stagePowerOf(stage) * diffBoss());
}
function bossHpOf(stage, level){ return Math.round(midBossHpOf(stage, level) * BOSS_MUL); }

/* 미사일 1회 발사는 3발(연속 사용 시 6/9발)이다.
   "3회 발사(3+6+9 = 18발)로 중간보스 격파" 가 되도록 1발 데미지를 정한다.
   같은 데미지로 최종보스는 6회 발사(누적 45발) 분량이 된다. */
const MISSILE_VOLLEYS_TO_KILL_MID = 3;
/**
 * ★ **미사일 50 · 핵무기 12.** (2026-08-26, 사용자 지정)
 *
 * 적은 계속 늘렸는데 손에 쥔 것은 그대로라 "화려하게 쏟아붓는" 순간이 없었다.
 * 상한을 올리고 투하도 두 배로 늘려서, 아끼지 말고 쓰라는 게임이 되게 한다.
 */
const MAX_MISSILE = 50, MAX_BOMB = 12;     // 보유 상한
/**
 * ★★ **연발에 제동을 건다.** (2026-08-27, 사용자 지정)
 *
 * *"너무 연발로 중간보스 최종보스 죽이니깐, 보스들이 너무 약하게 느껴짐"*
 *
 * 미사일은 연속으로 누를수록 한 번에 나가는 발수가 늘어난다(3 -> 6 -> 9...).
 * 그러니 손가락만 빠르면 보스가 몇 초 만에 녹았다 — **보스를 두껍게 하는 대신
 * 손을 묶는다.** 맷집을 올리는 것보다 이쪽이 옳다: 싸움이 길어지는 게 아니라
 * "언제 쏟아붓느냐" 를 고르게 된다.
 *
 * 두 발까지는 연달아 나간다. 세 번째부터는 막고 2초를 쉰다.
 */
const MISSILE_BURST = 2;                   // 연달아 나갈 수 있는 횟수
const MISSILE_COOL = 2.0;                  // 그 뒤 쉬는 시간 (초)
/**
 * 핵무기는 한 방이 화면을 비우고 10초 무적까지 준다 —
 * 연달아 쓰면 그냥 계속 무적이다. 한 번 쓰면 15초는 못 쓴다.
 */
const BOMB_COOL = 15.0;
/**
 * ★★ **미사일을 누르면 한 바퀴 돌며 피한다.** (2026-08-27, 사용자 지정)
 *
 * *"1945게임 보면 폭탄 쏘면 비행기가 한바퀴 돌아. 그것처럼 (...) 상대 미사일이
 *   넘 많이 날아와 피할곳이 없으면 이걸 누르면 종이가 가로 방향으로 360도
 *   뒤집는 것처럼 용이 한바퀴 돌며 상대 공격을 약 2초동안 피하는거야"*
 *
 * 탄이 화면을 덮으면 **피할 자리가 물리적으로 없는** 순간이 온다. 그때 쓸 수
 * 있는 것이 하나는 있어야 억울하지 않다 — 그런데 그것이 공짜면 안 된다.
 * 미사일에 묶어 두면 **총알을 태워서 사는 것**이 되어 값이 붙는다
 * (판당 다섯 개 + 연발 2회 제한).
 *
 * 도는 동안 계속 돈다 — 세 바퀴. 돌고 있는 것 자체가 "지금 안 맞는다" 는 표시다.
 */
/** 최종보스를 잡고 나서 금화를 주울 수 있는 시간 (초) */
const LOOT_TIME = 2.0;
/**
 * ★ **연발의 첫 발에만, 1.5초.** (2026-08-27, 사용자 지정)
 *
 * 두 발 다 붙였더니 너무 셌다 — 어려움에서 맞는 횟수가 39% 줄었다.
 * 연타로 무적을 이어 붙이는 것만 막는다: "위기에 한 번 빠져나가는 기술" 이라는
 * 성격은 그대로 남는다.
 *
 * 도는 모습과 무적을 **같이** 묶어 둔다 — 도는데 안 피해지면 그림이 거짓말을 한다.
 */
const ROLL_TIME = 1.5;
const ROLL_TURNS = 3;
/* 아무것도 안 산 사람의 손 안. 아이템 쇼핑의 계단으로 미사일 50 · 핵무기 12 까지 올린다.
   (`games/dragon/items.js` 의 BASE_MISSILES / BASE_BOMBS 와 같은 값이어야 한다) */
const START_MISSILES = 5, START_BOMBS = 2;
/**
 * 죽고 나서 되살아나기까지 (초). 짧으면 죽은 줄도 모르고,
 * 길면 손이 심심하다 — 폭발이 다 퍼질 만큼이면 된다.
 */
const RESPAWN_DELAY = 1.0;
/**
 * 되살아난 뒤 무적으로 반짝이는 시간 (초).
 * *"새로 태어나자마자 바로 또 죽으면 말이 안되잖아"* — 화면에 깔린 탄이
 * 지나갈 만큼은 되어야 한다.
 */
const RESPAWN_GRACE = 3.0;
/**
 * ★ **1부터 시작한다.** (2026-08-26, 사용자 지정)
 * 2로 시작하던 것은 "첫 판이 심심하다" 는 지적에 대한 임시방편이었다.
 * 이제 시작 5초에 레벨업이 하나 떠서 곧바로 2가 되므로,
 * **레벨이 오르는 장면을 보여 주면서** 같은 결과에 이른다.
 */
const START_FIRE_LV = 1;                   // 첫 판의 파이어 레벨
/** 첫 판 시작 몇 초에 레벨업 하나를 떨궈 주는가 (1스테이지에서 딱 한 번) */
const FIRST_POWER_AT = 5;
/**
 * 그 레벨의 발사 간격(초). 레벨이 오르면 짧아진다 — Lv10 은 Lv1 의 두 배 속도다.
 * `MAX_LEVEL` 은 아래에서 선언되지만 이 함수는 부를 때 읽으므로 문제없다.
 */
/**
 * ★ 연사도 완만하게. (2026-08-26)
 * 0.34 는 Lv10 에서 초당 30발이었다 — 두께·관통을 묶어도 연사가 그대로면
 * 화력은 결국 그만큼 오른다. 0.16 으로 낮춰 초당 20 -> 23.8 발에 그친다.
 */
const fireGap = (lv) =>
  FIRE_INTERVAL * (1 - 0.16 * (clamp(lv | 0, 1, MAX_LEVEL) - 1) / (MAX_LEVEL - 1));
function missileDamageOf(stage, level){
  // 1회 발사가 3발(연속 시 6/9발)이라 한 방이 너무 강했다. 기존의 1/3 로 낮춤
  return midBossHpOf(stage, level) / 54;
}

const MISSILE = {
  LOOP_TIME: 0.52,   // 발사 직후 크게 한 바퀴 도는 시간
  LOOP_SPD: 560,     // 선회 중 속도
  LOOP_OMEGA: 12.6,  // 선회 각속도 (2pi / LOOP_TIME) -> 정확히 한 바퀴
  CHASE_SPD: 980,    // 선회를 마치고 적에게 돌진하는 속도
  ACCEL: 2600,
  TURN: 7.0,         // 돌진 중 회전율 (공격적으로 물고 늘어짐)
  BLAST: 96,         // 폭발 반경 (데미지)
  BLAST_FX: 118,     // 폭발 연출 크기 (9발 동시 폭발 시 부하를 줄이려 축소)
  COMBO_WINDOW: 1.2, // 이 시간 안에 다시 쓰면 발수 증가 (3 -> 6 -> 9)
  MAX_COMBO: 3
};

class PlayerMissile {
  constructor(x, y, target, dmg, delay, dir){
    this.x = x; this.y = y;
    this.ang = -Math.PI/2 * (dir || 1);              // 위 또는 아래로 튀어나가며 선회 시작
    this.dir = dir || 1;                             // 선회 방향 (+1 시계 / -1 반시계)
    this.target = target; this.dmg = dmg;
    this.t = -(delay || 0); this.dead = false; this.life = 5.5;
    this.spd = MISSILE.LOOP_SPD; this.phase = 'loop';
    this.smokeT = 0;
  }
  get box(){ return { x:this.x - 26, y:this.y - 14, w:52, h:28 }; }
  update(dt, scene){
    this.t += dt;
    if(this.t < 0) return;                    // 발사 시차
    if(this.t > this.life){ this.explode(scene); return; }

    if(this.phase === 'loop'){
      // --- 크게 한 바퀴 선회 ---
      this.ang += MISSILE.LOOP_OMEGA * this.dir * dt;
      this.spd = MISSILE.LOOP_SPD;
      if(this.t >= MISSILE.LOOP_TIME){
        this.phase = 'chase';
        Particles.spawn(this.x, this.y, 10, { spd:280, life:0.3, grav:0 });   // 선회 종료 -> 가속 순간
      }
    }else{
      // --- 표적에게 돌진 ---
      this.spd = Math.min(MISSILE.CHASE_SPD, this.spd + MISSILE.ACCEL*dt);
      if(!this.target || this.target.dead) this.target = nearestEnemy(scene, this.x, this.y);
      if(this.target){
        const want = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        let d = want - this.ang;
        while(d >  Math.PI) d -= Math.PI*2;
        while(d < -Math.PI) d += Math.PI*2;
        this.ang += clamp(d, -MISSILE.TURN*dt, MISSILE.TURN*dt);
      }else{
        let d = 0 - this.ang;
        while(d >  Math.PI) d -= Math.PI*2;
        while(d < -Math.PI) d += Math.PI*2;
        this.ang += clamp(d, -MISSILE.TURN*dt, MISSILE.TURN*dt);
      }
    }
    this.x += Math.cos(this.ang)*this.spd*dt;
    this.y += Math.sin(this.ang)*this.spd*dt;

    // 고스테이지 최종보스는 날아오는 미사일 일부를 보호막으로 흡수한다
    if(!this.rolled && scene && scene.boss && scene.boss.absorb > 0 && !scene.boss.dead){
      const b = scene.boss;
      if(Math.hypot(b.x - this.x, b.y - this.y) < 190){
        this.rolled = true;
        if(Math.random() < b.absorb){
          this.dead = true;
          b.absorbT = 0.35;
          const a = Math.atan2(this.y - b.y, this.x - b.x);
          Particles.spawn(this.x, this.y, 8, { ang:a, spread:1.3, spd:400, life:0.3, size:PX*2,
            pal:['#ffffff','#cfeaff','#9ad8ff','#2b5cff'] });
          SND.sfx('ricochet');
          return;
        }
      }
    }

    // 굵은 화염 + 연기 궤적
    const bx = this.x - Math.cos(this.ang)*26, by = this.y - Math.sin(this.ang)*26;
    // 다발 발사 시 파티클 포화를 막는다
    Particles.spawn(bx, by, 1, { spd:70, life:0.26, grav:-30, drag:3.2, size:PX*2 });
    this.smokeT -= dt;
    if(this.smokeT <= 0){
      this.smokeT = 0.075;
      Particles.spawn(bx, by, 1, { spd:40, life:0.55, grav:-8, drag:2.4, size:PX*2,
        pal:['#e8e4f0','#a8a2b8','#6b6678','#3a3644'] });
    }
    if(this.x < -120 || this.x > GAME_W + 180 || this.y < -160 || this.y > GAME_H + 160) this.dead = true;
  }
  explode(scene){
    if(this.dead) return;
    this.dead = true;
    // 한 번에 9발이 터지므로 연출을 인원수에 따라 줄인다
    const busy = scene.booms.length;
    scene.booms.push(new Boom(this.x, this.y, MISSILE.BLAST_FX, 0.45));
    if(busy < 6) scene.waves.push(new Shockwave(this.x, this.y, 260, 0.32));
    Particles.spawn(this.x, this.y, busy < 6 ? 16 : 6, { spd:520, life:0.5 });
    if(busy < 6)
      Particles.spawn(this.x, this.y, 4, { spd:400, life:0.7, grav:640, size:PX*3,
        pal:['#ffffff','#ffd24a','#c81f2e','#4a4048'] });
    Shake.add(busy < 6 ? 11 : 5, 0.2);
    if(busy < 3) Flash.add('#ffd9a0', 0.08, 0.28);
    Freeze.add(busy < 3 ? 0.04 : 0);
    SND.sfx('boomM');
    // 반경 내 전체 타격
    for(const e of scene.enemies){
      if(e.dead) continue;
      const b = e.box, cx = b.x + b.w/2, cy = b.y + b.h/2;
      if(Math.hypot(cx - this.x, cy - this.y) <= MISSILE.BLAST + Math.max(b.w, b.h)*0.35){
        this.ignoreShield = true;            // 유도 미사일도 방패를 무시한다
        e.hit(this.dmg, this, scene);
        if(e.dead) scene.kills++;
      }
    }
  }
  render(ctx){
    if(this.t < 0) return;
    if(this.x < -80 || this.x > GAME_W + 80 || this.y < -80 || this.y > GAME_H + 80) return;
    // 미리 구워둔 16방향 스프라이트를 blit. 회전+수십 개 fillRect 를
    // 발마다 하면 한 번에 50발 넘게 떴을 때 그대로 프레임이 튄다.
    const i = Math.round(this.ang / (Math.PI*2/16)) & 15;
    ctx.drawImage(missileSprite(i), snap(this.x) - MSL_SPR/2, snap(this.y) - MSL_SPR/2);
  }
}

/* 아군 미사일 16방향 스프라이트 (쓰이는 방향만 그때그때 굽는다) */
const MSL_SPR = 112;  // 그림이 x -52..32 로 뻗어 회전 반경이 56 이다. 더 줄이면 잘린다.
const _mslSprites = [];
function missileSprite(i){
  const hit = _mslSprites[i];
  if(hit) return hit;
  const { cv, c } = makeCanvas(MSL_SPR, MSL_SPR);
  c.save();
  c.translate(MSL_SPR/2, MSL_SPR/2);
  c.rotate(i * Math.PI*2/16);
  for(let k=0;k<4;k++){                        // 분사 화염
    c.fillStyle = PAL.fire[k];
    const Ln = 26 - k*5, h = 16 - k*3;
    c.fillRect(-26 - Ln, -h/2, Ln, h);
  }
  c.fillStyle = '#ffffff'; c.fillRect(-34, -PX, 10, PX*2);
  c.fillStyle = '#0d0912'; c.fillRect(-28, -13, 52, 26);      // 동체
  c.fillStyle = '#e8ecf6'; c.fillRect(-26, -11, 46, 12);
  c.fillStyle = '#8b93a8'; c.fillRect(-26,   1, 46, 10);
  c.fillStyle = '#5a6072'; c.fillRect(-32, -20, 12, 40);      // 꼬리 날개
  c.fillStyle = '#0d0912'; c.fillRect(-34, -20,  4, 40);
  c.fillStyle = '#0d0912'; c.fillRect(20, -13, 12, 26);       // 탄두
  c.fillStyle = '#ff4d5a'; c.fillRect(20, -10, 10, 20);
  c.fillStyle = '#ffd0d4'; c.fillRect(22,  -8,  4,  6);
  c.restore();
  return (_mslSprites[i] = cv);
}

function nearestEnemy(scene, x, y, exclude){
  let best = null, bd = Infinity;
  for(const e of scene.enemies){
    if(e.dead || (exclude && exclude.has(e))) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if(d < bd){ bd = d; best = e; }
  }
  return best;
}
/* 가까운 순으로 최대 n체를 뽑되, 부족하면 순환해서 채움 */
function pickTargets(scene, x, y, n){
  const alive = scene.enemies.filter(e => !e.dead)
    .sort((a,b) => Math.hypot(a.x-x, a.y-y) - Math.hypot(b.x-x, b.y-y));
  if(alive.length === 0) return new Array(n).fill(null);
  const out = [];
  for(let i=0;i<n;i++) out.push(alive[i % Math.min(alive.length, n)] || alive[0]);
  return out;
}

/* ==================================================================
   필살기 : 드래곤 뢰
   1단계 흰 플래시 -> 2단계 포효 -> 3단계 전체화면 충격파 -> 적 소멸
   ================================================================== */
/* 드래곤 뢰 = 초필살 핵. 5단계로 온 화면을 덮는다.
   0 차징(빛이 빨려들어옴) -> 1 섬광 -> 2 핵 화구 팽창 -> 3 다중 충격파 -> 4 잔광/재 */
// 화면을 다 덮지 않도록 짧고 작게. 대신 위력과 쉴드로 강해진다.
/**
 * 핵무기 한 방으로 금화가 될 수 있는 적탄의 최대 개수.
 * 후반에는 화면에 아흔 개도 뜨는데 전부 주면 한 방에 한 판치를 번다.
 */
const BOMBER_COIN_MAX = 30;

/* 필살기 쉴드 : 어떤 공격도 튕겨내는 10초짜리 보호막 */
function drawShield(ctx, p){
  const c = p.shieldC, R = p.shieldR, T = p.shieldT;
  const col = p.pid === 1 ? '#6ec8ff' : '#ff9ae0';
  // 꺼지기 2초 전부터 깜빡여서 남은 시간을 알린다
  const fade = T < 3 ? 0.35 + Math.abs(Math.sin(T*11))*0.65 : 1;
  ctx.globalAlpha = 0.12 * fade;
  fillPixelCircle(ctx, c.x, c.y, R, col);
  ctx.globalAlpha = 0.9 * fade;
  drawPixelRing(ctx, c.x, c.y, R, PX*2, '#ffffff');
  ctx.globalAlpha = 0.55 * fade;
  drawPixelRing(ctx, c.x, c.y, R - PX*3, PX*2, col);
  // 천천히 도는 룬
  ctx.globalAlpha = 0.95 * fade;
  for(let i=0;i<6;i++){
    const a = p.t*1.4 + i*Math.PI/3;
    ctx.fillStyle = (i & 1) ? '#ffffff' : col;
    ctx.fillRect(snap(c.x + Math.cos(a)*R - PX), snap(c.y + Math.sin(a)*R - PX), PX*2, PX*2);
  }
  // 튕겨낸 자리에 번지는 파문
  ctx.fillStyle = '#ffffff';
  for(const h of p.shieldHits){
    const k = h.t / 0.35;
    ctx.globalAlpha = (1 - k) * fade;
    for(let j=-3;j<=3;j++){
      const a = h.a + j*0.10*(1 + k*2.2), rr = R - k*12;
      ctx.fillRect(snap(c.x + Math.cos(a)*rr - PX), snap(c.y + Math.sin(a)*rr - PX), PX*2, PX*2);
    }
  }
  ctx.globalAlpha = 1;
  drawText(ctx, Math.ceil(T) + '', c.x, c.y - R - 26, 3,
    { align:'center', color:col, outline:PAL.outline });
}

const BOMB_FX = { CHARGE:0.32, FLASH:0.46, FIREBALL:1.15, WAVE:1.70, TOTAL:2.20 };
const BOMB_R  = 360;                // 화구 최대 반경 (화면 면적의 약 1/2)
const SHIELD_TIME = 15;             // 필살기 사용 후 무적 쉴드 지속 시간(초)

class DragonRoar {
  constructor(scene, owner){
    this.t = 0; this.applied = false; this.dead = false;
    const o = owner || scene.p1;
    this.owner = o;                    // 누구의 필살기인지 (2인 플레이에서 서로 막지 않도록)
    this.pid = o.pid;                  // 이걸로 죽인 적의 점수는 이 사람 몫
    this.px = o.x; this.py = o.y;
    this.ringN = 0;
    this.debris = [];
    for(let i=0;i<70;i++){                       // 화구 표면에서 솟구치는 불덩이
      const a = Math.random()*Math.PI*2, r = Math.random();
      this.debris.push({ a, r, sp: 0.5 + Math.random()*1.1, s: PX*(2 + (Math.random()*3|0)) });
    }
  }
  update(dt, scene){
    this.t += dt;
    const T = this.t;

    // 차징 : 화면 가장자리에서 빛이 빨려들어오는 동안 살짝 흔들림
    if(T < BOMB_FX.CHARGE){
      if(Math.random() < 0.5){
        const a = Math.random()*Math.PI*2, d = 520 + Math.random()*420;
        Particles.spawn(this.px + Math.cos(a)*d, this.py + Math.sin(a)*d, 1,
          { ang: a + Math.PI, spread:0.2, spd: 1500, life:0.34, grav:0, drag:0,
            size:PX*2, pal:['#ffffff','#ffe14a','#ffa32e'] });
      }
      Shake.add(3, 0.1);
      return;
    }

    // 기폭 : 실제 효과 적용
    if(!this.applied){
      this.applied = true;
      Shake.add(24, 1.0);
      Flash.add('#ffffff', 0.16, 0.35);     // 시야를 가리지 않을 만큼만
      Freeze.add(0.12);
      /**
       * ★★ **적탄이 금화로 바뀐다.** (기획 8, 2026-08-27)
       *
       * 예전 핵무기는 그냥 **강한 버튼**이었다. 빨리 쓰든 늦게 쓰든 결과가 같으니
       * "언제 쓰나" 라는 물음 자체가 없었다.
       *
       * 터지는 순간 화면의 적탄을 **전부 금화로** 바꾼다. 그러면 셈이 생긴다 —
       * 일찍 쓰면 안전하고, **탄이 가장 많을 때까지 버티다 쓰면 크게 번다.**
       * 아끼는 이유와 쓰는 쾌감이 같은 버튼에 들어간다.
       *
       * 한도를 둔다: 후반에는 화면에 탄이 아흔 개도 뜨는데 그걸 전부 금화로
       * 주면 한 방에 한 판치를 번다. 서른 개까지만 바꾸고 나머지는 그냥 지운다.
       */
      let turned = 0;
      for(const list of [scene.arrows, scene.eshots, scene.missiles, scene.bombs]){
        for(const o of list){
          if(!o.dead && turned < BOMBER_COIN_MAX && o.x > -40 && o.x < GAME_W + 40){
            turned++;
            scene.items.push(new Item(o.x, o.y, ITEM_KIND.COIN));
          }
          o.dead = true;
        }
      }
      if(turned > 0){
        Popups.add(scene.p1.x, scene.p1.y - 150, '적탄 ' + turned + ' → 금화', PAL.gold, 5, true);
        SND.sfx('coin');
      }
      // 일반 적 즉사 / 보스는 최대 HP 의 28% 감소
      for(const e of scene.enemies){
        if(e.dead) continue;
        if(e.isBoss){
          this.ignoreShield = true;            // 미사일은 방패를 무시한다 (기획 1)
        e.hit(e.maxHp * 0.42, this, scene);   // 연출은 줄이고 위력은 올린다
        }else{
          this.ignoreShield = true;          // 핵무기도 방패를 무시한다
          e.hit(99999, this, scene);
          if(e.dead) scene.kills++;
        }
      }
      // 화면 전체에 연쇄 폭발을 깔아둔다
      for(let i=0;i<18;i++){
        const d = i * 0.04;
        const a = Math.random()*Math.PI*2, r = Math.random()*BOMB_R*0.9;
        scene.booms.push(Object.assign(
          new Boom(this.px + Math.cos(a)*r, this.py + Math.sin(a)*r,
                   60 + Math.random()*90, 0.5), { t: -d }));
      }
    }

    // 충격파 링을 시간차로 4겹
    if(T > BOMB_FX.FIREBALL && this.ringN < 2 && T > BOMB_FX.FIREBALL + this.ringN*0.14){
      this.ringN++;
      scene.waves.push(new Shockwave(this.px, this.py, 1500, 0.7, true));
      Shake.add(12, 0.3);
    }
    // 잔재가 흩날림
    if(T > BOMB_FX.FLASH && T < BOMB_FX.WAVE && Math.random() < 0.7){
      Particles.spawn(Math.random()*GAME_W, GAME_H + 10, 1,
        { ang:-Math.PI/2, spread:1.0, spd: 300 + Math.random()*500, life:1.4,
          grav:-120, drag:0.7, size:PX*2, pal:['#ffe14a','#ff7a1e','#c81f2e','#4a4048'] });
    }
    if(T >= BOMB_FX.TOTAL) this.dead = true;
  }

  render(ctx){
    const T = this.t, F = BOMB_FX;

    // ---- 0) 차징 : 화면이 어두워지고 중심에 빛이 모임 ----
    if(T < F.CHARGE){
      const k = T / F.CHARGE;
      ctx.globalAlpha = k * 0.14;                 // 살짝만 어둡게
      ctx.fillStyle = '#0a0410'; ctx.fillRect(0,0,GAME_W,GAME_H);
      ctx.globalAlpha = 1;
      // 수축하는 링
      for(let i=0;i<3;i++){
        const rr = (1 - k) * (BOMB_R - i*70) + 40;
        ctx.globalAlpha = k * (0.9 - i*0.22);
        drawPixelRing(ctx, this.px, this.py, rr, PX*3, PAL.fire[i]);
      }
      ctx.globalAlpha = Math.min(1, k*1.4);
      fillPixelCircle(ctx, this.px, this.py, 20 + k*46, '#ffffff');
      ctx.globalAlpha = 1;
      return;
    }

    // ---- 1) 섬광 : 화면 전체가 하얗게 ----
    if(T < F.FLASH){
      const k = (T - F.CHARGE) / (F.FLASH - F.CHARGE);
      // 화면을 하얗게 덮지 않고, 폭심에만 강한 섬광을 남긴다
      ctx.globalAlpha = (1 - k) * 0.10;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,GAME_W,GAME_H);
      ctx.globalAlpha = 1 - k*0.2;
      fillPixelCircle(ctx, this.px, this.py, 60 + k*220, '#ffffff');
      ctx.globalAlpha = 1;
      return;
    }

    // ---- 2) 핵 화구 : 거대한 불덩이가 화면을 전부 삼킨다 ----
    if(T < F.FIREBALL){
      const k = (T - F.FLASH) / (F.FIREBALL - F.FLASH);       // 0 -> 1
      const R = 70 + Math.pow(k, 0.62) * BOMB_R;              // 화면의 절반 정도까지만 팽창
      // 바깥 -> 안쪽으로 색이 뜨거워지는 다중 껍질
      const shells = [
        { m:1.00, c:'#3a1010' }, { m:0.92, c:PAL.fire[6] }, { m:0.82, c:PAL.fire[5] },
        { m:0.70, c:PAL.fire[4] }, { m:0.56, c:PAL.fire[3] }, { m:0.42, c:PAL.fire[2] },
        { m:0.28, c:PAL.fire[1] }, { m:0.15, c:'#ffffff' }
      ];
      ctx.globalAlpha = Math.min(1, k*4);
      for(const sh of shells) fillPixelCircle(ctx, this.px, this.py, R*sh.m, sh.c);
      ctx.globalAlpha = 1;
      // 표면에서 솟구치는 불덩이
      for(const d of this.debris){
        const rr = R * (0.75 + d.r*0.5) * (0.7 + k*d.sp*0.7);
        ctx.fillStyle = PAL.fire[(d.r*4)|0];
        ctx.fillRect(snap(this.px + Math.cos(d.a)*rr), snap(this.py + Math.sin(d.a)*rr), d.s, d.s);
      }
      return;
    }

    // ---- 3) 충격파 : 화염이 걷히며 다중 링 ----
    if(T < F.WAVE){
      const k = (T - F.FIREBALL) / (F.WAVE - F.FIREBALL);
      // 화면 전체를 화염색으로 칠하던 것을 없애고 사그라드는 화구만 남긴다
      ctx.globalAlpha = (1 - k) * 0.85;
      for(const sh of [{m:1.0,c:PAL.fire[5]},{m:0.66,c:PAL.fire[3]},{m:0.34,c:PAL.fire[1]}])
        fillPixelCircle(ctx, this.px, this.py, BOMB_R*(1 - k*0.55)*sh.m, sh.c);
      ctx.globalAlpha = 1;
      for(let i=0;i<3;i++){
        const rr = 120 + (k + i*0.18) * 1100;
        ctx.globalAlpha = Math.max(0, 1 - k - i*0.2) * 0.8;
        drawPixelRing(ctx, this.px, this.py, rr, PX*4, PAL.fire[i]);
      }
      ctx.globalAlpha = 1;
      return;
    }

    // ---- 4) 잔광 ----
    const k = (T - F.WAVE) / (F.TOTAL - F.WAVE);
    ctx.globalAlpha = (1 - k) * 0.10;
    ctx.fillStyle = '#ff7a1e'; ctx.fillRect(0,0,GAME_W,GAME_H);
    ctx.globalAlpha = 1;
  }
}

/* ==================================================================
   아이템
   ================================================================== */
const ITEM_KIND = { APPLE:'apple', HEART:'heart', MISSILE:'missile', BOMB:'bomb',
                    POWER:'power', COIN:'coin' };
/**
 * ★ **점수 눈금.** (2026-08-27, 사용자 지정)
 * 완벽하게 스무 판을 깨도 20만 점 언저리가 되도록 100 으로 나눈다.
 * 한 스테이지는 1만 점 안팎 — 최고점(999,999)이 멀어져야 노릴 값어치가 생긴다.
 */
const SCORE_DIV = 100;

const COIN_BASE = 100;              // 연속으로 먹을수록 배수가 붙는다
const COIN_CHAIN_MAX = 10;
const COIN_WINDOW = 2.2;            // 이 안에 다음 동전을 먹으면 연쇄 유지
const ITEM_R = 26;                                    // 획득 반경 (넉넉하게)

const ITEM_BIG_R = 58;                     // LvUp 은 필살기 버튼만큼 큼직하게
class Item {
  constructor(x, y, kind){
    this.r = kind === ITEM_KIND.POWER ? ITEM_BIG_R : (kind === ITEM_KIND.COIN ? 19 : ITEM_R);
    // 보스가 돌진으로 화면 밖에 있을 때 죽어도 회수 가능하도록 화면 안으로 보정
    this.x = clamp(x, 90, GAME_W - 90);
    this.y = clamp(y, 80, GAME_H - 80);
    this.kind = kind;
    this.vx = -110; this.t = Math.random()*6; this.dead = false; this.life = 14;
  }
  get box(){ return { x:this.x - this.r, y:this.y - this.r, w:this.r*2, h:this.r*2 }; }
  update(dt, pull){
    this.t += dt; this.life -= dt;
    /**
     * 머리무장의 금화 자석.
     * ★ **금화에만 걸린다.** 사과나 목숨까지 빨려오면 잡아야 할 것을 잡지 않고도
     * 다 먹게 돼서 게임이 쉬워진다. 자석이 하는 일은 "동전 줍기" 하나뿐이다.
     */
    if(pull && this.kind === ITEM_KIND.COIN){
      const dx = pull.x - this.x, dy = pull.y - this.y;
      const d  = Math.hypot(dx, dy);
      if(d > 1 && d < pull.r){
        const k = (1 - d/pull.r) * 900;          // 가까울수록 세게 끌린다
        this.x += (dx/d)*k*dt;
        this.y += (dy/d)*k*dt;
      }
    }
    this.x += this.vx*dt;
    this.y += Math.sin(this.t*2.4)*38*dt;
    if(this.x < -60 || this.life <= 0) this.dead = true;
  }
  render(ctx){
    const x = snap(this.x), y = snap(this.y + Math.sin(this.t*3)*3);
    // 후광 (동전은 스스로 번쩍이므로 생략 -> 동전이 많이 깔려도 부담이 없다)
    if(this.kind !== ITEM_KIND.COIN){
      ctx.globalAlpha = 0.28 + Math.sin(this.t*6)*0.12;
      fillPixelCircle(ctx, x, y, this.r, '#ffffff');
      ctx.globalAlpha = 1;
    }
    // 사라지기 직전 점멸
    if(this.life < 3 && Math.floor(this.life*8) % 2 === 0) return;

    switch(this.kind){
      case ITEM_KIND.COIN: {
        drawCoin(ctx, x, y, 15, this.t);
        break;
      }
      case ITEM_KIND.APPLE:
        fillPixelCircle(ctx, x, y + 2, 15, '#d92b3a');
        fillPixelCircle(ctx, x - 5, y - 3, 5, '#ff6b6b');
        ctx.fillStyle = '#6b4a24'; ctx.fillRect(x - PX/2, y - 18, PX, PX*3);
        ctx.fillStyle = '#4fae3a'; ctx.fillRect(x + PX, y - 18, PX*3, PX*2);
        break;
      case ITEM_KIND.HEART: {
        ctx.fillStyle = '#ff2b4a';
        const rows = ['.XX.XX.','XXXXXXX','XXXXXXX','.XXXXX.','..XXX..','...X...'];
        for(let r=0;r<rows.length;r++) for(let c=0;c<7;c++)
          if(rows[r][c] === 'X') ctx.fillRect(x - 14 + c*PX, y - 12 + r*PX, PX, PX);
        ctx.fillStyle = '#ff8fa0'; ctx.fillRect(x - 10, y - 8, PX*2, PX);
        break;
      }
      case ITEM_KIND.MISSILE:
        /**
         * ★ **미사일처럼 보이게.** (2026-08-27, 사용자 지적)
         * *"아이콘이 사각형이고 무슨 모양인지 저거 먹으면 뭐인지 모르겠어"*
         * 예전에는 그냥 회색 네모였다. 뾰족한 탄두 · 몸통 · 꼬리날개 ·
         * 뒤로 뿜는 불꽃까지 그려야 한눈에 미사일로 읽힌다.
         */
        drawMissileIcon(ctx, x, y, this.t);
        break;
      case ITEM_KIND.BOMB:
        fillPixelCircle(ctx, x, y, 16, PAL.fire[3]);
        fillPixelCircle(ctx, x, y, 11, PAL.fire[1]);
        fillPixelCircle(ctx, x - 4, y - 4, 4, '#fffbe0');
        break;
      case ITEM_KIND.POWER: {
        // 필살기 버튼 크기의 큰 원판 + LV UP 문구
        const rr = this.r - 6;
        fillPixelCircle(ctx, x, y, rr, PAL.fire[6]);
        fillPixelCircle(ctx, x, y, rr - PX*2, PAL.fire[4]);
        fillPixelCircle(ctx, x, y, rr - PX*5, PAL.fire[2]);
        drawPixelRing(ctx, x, y, rr, PX*2, PAL.fire[0]);
        // 위로 솟는 화살표
        ctx.fillStyle = '#ffffff';
        for(let i=0;i<5;i++) ctx.fillRect(snap(x - (4-i)*PX), snap(y - 26 + i*PX), (4-i)*2*PX, PX);
        ctx.fillRect(snap(x - PX*2), snap(y - 6), PX*4, PX*4);
        drawText(ctx, 'LV UP', x, y + 12, 3,
          { align:'center', color:'#ffffff', outline:PAL.outline });
        break;
      }
    }
  }
}

/* ==================================================================
   화면 버튼 (우하단 미사일 / 필살기) - 도트 아이콘
   ================================================================== */
const ICON_PAL = {
  K:'#0d0912',  // 외곽선
  w:'#e8ecf6',  // 동체 밝은 면
  s:'#8b93a8',  // 동체 그늘
  r:'#ff4d5a',  // 탄두
  F:'#ffd24a',  // 화염 밝음
  f:'#ff7a1e',  // 화염
  o:'#c81f2e',  // 화염 그늘
  L:'#fffbe0'   // 번개
};
/* 미사일 아이콘 (18 x 11) : 두툼한 동체 + 큰 탄두 + 굵은 분사 화염 */
const ICON_MISSILE = [
  '...KK.............',
  '...KKK............',
  '.fFKKKKKKKKKKK....',
  'fFFKwwwwwwwwwKK...',
  'FFFKwwwwwwwwwwKrK.',
  'FFFKwwwwwwwwwwwrrK',
  'FFFKssssssssssKrK.',
  'fFFKsssssssssKK...',
  '.fFKKKKKKKKKKK....',
  '...KKK............',
  '...KK.............'
];
/* 필살기(드래곤 뢰) 아이콘 (12 x 12) : 화염 구슬 안의 번개 */
const ICON_BOMB = [
  '....KKKK....',
  '..KKffffKK..',
  '.KffFFLLFfK.',
  'KffFFFLLFFfK',
  'KfFFFFLLFFfK',
  'KfFFLLLLLFfK',
  'KfFFFLLLFFfK',
  'KfFFFLLFFFfK',
  'KffFFLLFFFfK',
  '.KffFLFFFfK.',
  '..KKooooKK..',
  '....KKKK....'
];
class TouchButton {
  constructor(x, y, r, icon, cell, color, tag){
    this.x = x; this.y = y; this.r = r; this.color = color; this.tag = tag || '';
    this.icon = icon; this.cols = icon[0].length; this.cell = cell;
    this.iw = this.cols * cell; this.ih = icon.length * cell;
    this.pid = null; this.just = false; this.flash = 0;
  }
  down(id, px, py){
    if(this.pid !== null) return false;
    if(Math.hypot(px - this.x, py - this.y) > this.r * 1.25) return false;
    this.pid = id; this.just = true; return true;
  }
  up(id){ if(this.pid === id) this.pid = null; }
  consume(){ const j = this.just; this.just = false; return j; }
  update(dt){ if(this.flash > 0) this.flash -= dt; }
  render(ctx, count){
    const pressed = this.pid !== null, usable = count > 0;
    const A = this.alpha === undefined ? 0.5 : this.alpha;
    ctx.globalAlpha = usable ? (pressed ? Math.min(1, A + 0.35) : A + 0.1) : A * 0.42;
    fillPixelCircle(ctx, this.x, this.y, this.r, pressed ? this.color : '#141c2c');
    drawPixelRing(ctx, this.x, this.y, this.r,        PX*3, this.color);   // 두꺼운 테두리
    drawPixelRing(ctx, this.x, this.y, this.r - PX*4, PX,   mixHex(this.color, '#000000', 0.45));
    ctx.globalAlpha = 1;
    // 사용 가능할 때만 원색, 아니면 회색 톤으로 통일
    ctx.globalAlpha = usable ? 1 : 0.35;
    drawGrid(ctx, this.icon, snap(this.x - this.iw/2), snap(this.y - this.ih/2 - 10),
      this.cols, this.cell, ICON_PAL, false, usable ? null : '#5a6478');
    ctx.globalAlpha = 1;
    drawText(ctx, 'x' + count, this.x, this.y + this.ih/2 - 2, 4,
      { align:'center', color: usable ? this.color : '#5a6478', outline:PAL.outline, shadow:'#000' });
    if(this.tag)
      drawText(ctx, this.tag, this.x, this.y - this.r - 22, 3,
        { align:'center', color:this.color, outline:PAL.outline, shadow:'#000' });
  }
}

/* ==================================================================
   가상 아날로그 스틱 (좌하단)
   ================================================================== */
const STICK_CFG = { x:158, y:GAME_H-158, radius:78, knob:30, alpha:0.42, dead:0.16 };

class VirtualStick {
  constructor(cfg){
    this.cfg = cfg;
    this.active = false; this.pid = null;
    this.dx = 0; this.dy = 0;
  }
  down(id, x, y){
    if(this.active) return false;
    if(this.cfg.float){
      // 화면 좌측 절반 어디를 눌러도 그 자리에 스틱이 생긴다
      if(x > UIW*0.55) return false;
      this.cfg.x = snap(clamp(x, 130, UIW*0.5));
      this.cfg.y = snap(clamp(y, 200, UIH - 120));
    }else{
      // 스틱 주변 넓은 영역을 터치하면 잡히도록 (모바일 조작 편의)
      if(Math.hypot(x - this.cfg.x, y - this.cfg.y) > this.cfg.radius * 2.0) return false;
    }
    this.active = true; this.pid = id;
    this.move(id, x, y);
    return true;
  }
  move(id, x, y){
    if(!this.active || this.pid !== id) return;
    let dx = x - this.cfg.x, dy = y - this.cfg.y;
    const d = Math.hypot(dx, dy);
    if(d > this.cfg.radius){ dx = dx/d * this.cfg.radius; dy = dy/d * this.cfg.radius; }
    this.dx = dx; this.dy = dy;
  }
  up(id){
    if(this.pid !== id) return;
    this.active = false; this.pid = null; this.dx = this.dy = 0;
  }
  /**
   * 스틱이 가리키는 방향을 **판(월드) 좌표**로 돌려준다.
   *
   * ★ 세로에서는 화면이 90도 돌아 있다 (2026-08-27).
   * 손가락은 화면을 보고 미는데 캐릭터는 판 위에서 움직이므로 한 번 돌려 줘야
   * "위로 밀면 위로 간다" 가 맞는다:
   *     화면 위(-sy)  ->  판 +x (앞)
   *     화면 오른쪽(+sx) -> 판 +y (아래)
   */
  vector(){
    const d = Math.hypot(this.dx, this.dy);
    if(d < this.cfg.radius * this.cfg.dead) return { x:0, y:0 };
    const n = Math.min(1, d / this.cfg.radius);
    const vx = this.dx/d * n, vy = this.dy/d * n;
    return portrait ? { x: -vy, y: vx } : { x: vx, y: vy };
  }
  /** 화면이 돌면 스틱 자리도 화면 안으로 다시 넣는다 */
  relayout(){
    const c = this.cfg;
    c.x = snap(clamp(c.x, c.radius + 20, UIW - c.radius - 20));
    c.y = snap(clamp(c.y, c.radius + 20, UIH - c.radius - 20));
    this.active = false; this.pid = null; this.dx = this.dy = 0;
  }
  render(ctx){
    const { x, y, radius, knob, alpha } = this.cfg;
    if(this.cfg.float && !this.active) return;      // 플로팅 모드는 누를 때만 보임
    ctx.globalAlpha = this.active ? alpha + 0.22 : alpha;
    drawPixelRing(ctx, x, y, radius, PX*2, '#e6dcff');
    drawPixelRing(ctx, x, y, radius - PX*3, PX, '#7a6aa8');
    // 방향 눈금
    ctx.fillStyle = '#e6dcff';
    for(const [ax,ay] of [[0,-1],[0,1],[-1,0],[1,0]]){
      ctx.fillRect(snap(x + ax*(radius-PX*8) - PX), snap(y + ay*(radius-PX*8) - PX), PX*2, PX*2);
    }
    const kx = x + this.dx, ky = y + this.dy;
    fillPixelCircle(ctx, kx, ky, knob, this.active ? '#ffd24a' : '#c9bcf0');
    drawPixelRing(ctx, kx, ky, knob, PX, '#3a2f52');
    ctx.globalAlpha = 1;
  }
}

/* 픽셀 링(원 테두리) */
function paintPixelRing(ctx, cx, cy, r, thick, color){
  ctx.fillStyle = color;
  const ri = r - thick;
  const PXs = circleStep(r);
  for(let y = -r; y <= r; y += PXs){
    const xo = Math.sqrt(Math.max(0, r*r - y*y));
    const yy = snap(cy + y);
    if(Math.abs(y) >= ri){
      ctx.fillRect(snap(cx - xo), yy, snap(xo*2), PXs);       // 위/아래 뚜껑 부분
    }else{
      const xi = Math.sqrt(Math.max(0, ri*ri - y*y));
      ctx.fillRect(snap(cx - xo), yy, snap(xo - xi), PXs);    // 좌측 벽
      ctx.fillRect(snap(cx + xi), yy, snap(xo - xi), PXs);    // 우측 벽
    }
  }
}
function drawPixelRing(ctx, cx, cy, r, thick, color){
  if(r <= 0) return;
  if(r > CIRCLE_CACHE_MAX_R){ paintPixelRing(ctx, cx, cy, r, thick, color); return; }
  const st = circleStep(r);
  const rq = Math.max(st, Math.round(r/st)*st);
  const tq = Math.max(PX, Math.round(thick/PX)*PX);
  const w  = rq*2 + st*2;
  blitCached(ctx, 'R|'+rq+'|'+tq+'|'+color, w, w, Math.round(cx - w/2), Math.round(cy - w/2),
    (c, x, y) => paintPixelRing(c, x + w/2, y + w/2, rq, tq, color));
}

/* ==================================================================
   TitleScene
   ================================================================== */
class TitleScene extends Scene {
  enter(){
    this.t = 0;
    this.bgmSel = Save.data.bgm | 0;
    SND.playBgm(this.bgmSel);
    this.sky   = buildSky();
    this.far   = buildRidge(1337, 604, 150, 26, '#2b1440', 'peak');
    this.near  = buildRidge(4242, 700,  92, 44, '#170a26', 'peak');
    this.logoA = buildLogo('DRAGON', 13);
    this.logoB = buildLogo('STRIKER', 13);
    this.offFar = 0; this.offNear = 0;

    // 별
    const rnd = mulberry32(77);
    this.stars = [];
    for(let i=0;i<170;i++){
      this.stars.push({
        x: snap(rnd()*GAME_W), y: snap(rnd()*470),
        s: rnd() > 0.88 ? PX*2 : PX,
        ph: rnd()*Math.PI*2, sp: 1.2 + rnd()*2.6,
        c: rnd() > 0.8 ? PAL.cyan : (rnd() > 0.5 ? PAL.white : '#cbb6ff')
      });
    }
    // 구름 (지평선 근처, 느린 패럴랙스)
    this.clouds = [];
    for(let i=0;i<7;i++){
      this.clouds.push({
        x: rnd()*GAME_W, y: snap(340 + rnd()*160),
        w: snap(140 + rnd()*220), h: snap(12 + rnd()*16),
        sp: 5 + rnd()*9, c: rnd() > 0.5 ? '#3d1b4e' : '#4d2350'
      });
    }
    this.embers = [];
    this.emberT = 0;
    this.shoot  = null;
    this.shootT = 2.5;
  }

  update(dt){
    this.t += dt;
    this.offFar  = (this.offFar  + 6*dt)  % GAME_W;
    this.offNear = (this.offNear + 15*dt) % GAME_W;

    // 구름
    for(const c of this.clouds){
      c.x -= c.sp*dt;
      if(c.x + c.w < 0){ c.x = GAME_W + Math.random()*200; c.y = snap(340 + Math.random()*160); }
    }
    // 불씨 파티클
    this.emberT -= dt;
    if(this.emberT <= 0){
      this.emberT = 0.05 + Math.random()*0.07;
      this.embers.push({
        x: Math.random()*GAME_W, y: GAME_H + 8,
        vy: -(28 + Math.random()*55), sw: Math.random()*Math.PI*2,
        life: 0, max: 3.2 + Math.random()*2.6,
        s: Math.random() > 0.75 ? PX*2 : PX,
        c: PAL.fire[1 + Math.floor(Math.random()*4)]
      });
    }
    for(let i=this.embers.length-1; i>=0; i--){
      const e = this.embers[i];
      e.life += dt; e.y += e.vy*dt; e.sw += dt*2.2;
      if(e.life >= e.max || e.y < -10) this.embers.splice(i,1);
    }
    // 별똥별
    this.shootT -= dt;
    if(!this.shoot && this.shootT <= 0){
      this.shoot = { x: Math.random()*GAME_W*0.7, y: -20, vx: 220, vy: 150, life: 0 };
    }
    if(this.shoot){
      const s = this.shoot;
      s.life += dt; s.x += s.vx*dt; s.y += s.vy*dt;
      if(s.y > 460 || s.x > GAME_W + 40){ this.shoot = null; this.shootT = 4 + Math.random()*6; }
    }

    if(!this.mgr.busy && Input.pressed('down')){ SND.sfx('confirm'); this.mgr.change(new OptionsScene()); return; }
    // BGM 3곡 미리듣기 : 좌우로 즉시 전환 (스펙 7.1)
    if(Input.pressed('left') || Input.pressed('right')){
      this.bgmSel = (this.bgmSel + (Input.pressed('right') ? 1 : BGM_TRACKS.length - 1)) % BGM_TRACKS.length;
      Save.data.bgm = this.bgmSel; Save.save();
      SND.resume(); SND.switchBgm(this.bgmSel);
    }
    if(!this.mgr.busy && (Input.pressed('confirm') || Input.taps > 0)){
      SND.resume(); SND.playBgm(this.bgmSel); SND.sfx('confirm');
      this.mgr.change(new CharacterSelectScene());
    }
  }

  render(ctx){
    const t = this.t;
    ctx.drawImage(this.sky, 0, 0);

    // ---- 별 (반짝임) ----
    for(const st of this.stars){
      const a = 0.30 + 0.70 * (0.5 + 0.5*Math.sin(t*st.sp + st.ph));
      ctx.globalAlpha = a;
      ctx.fillStyle = st.c;
      ctx.fillRect(st.x, st.y, st.s, st.s);
      if(st.s > PX && a > 0.8){   // 큰 별은 십자 반짝임
        ctx.fillRect(st.x - PX, st.y + PX*0.5, PX, PX);
        ctx.fillRect(st.x + st.s, st.y + PX*0.5, PX, PX);
        ctx.fillRect(st.x + PX*0.5, st.y - PX, PX, PX);
        ctx.fillRect(st.x + PX*0.5, st.y + st.s, PX, PX);
      }
    }
    ctx.globalAlpha = 1;

    // ---- 별똥별 ----
    if(this.shoot){
      const s = this.shoot;
      for(let i=0;i<10;i++){
        ctx.globalAlpha = 1 - i/10;
        ctx.fillStyle = i < 3 ? PAL.white : PAL.cyan;
        ctx.fillRect(snap(s.x - s.vx*0.012*i), snap(s.y - s.vy*0.012*i), PX, PX);
      }
      ctx.globalAlpha = 1;
    }

    // ---- 달 ----
    const mx = 1096, my = 132;
    for(let i=3;i>=1;i--){
      ctx.globalAlpha = 0.05*i;
      fillPixelCircle(ctx, mx, my, 60 + i*14, '#ffdfa0');
    }
    ctx.globalAlpha = 1;
    fillPixelCircle(ctx, mx, my, 60, '#f7e6bd');
    fillPixelCircle(ctx, mx - 18, my - 14, 13, '#e2cda0');
    fillPixelCircle(ctx, mx + 20, my + 10, 17, '#e2cda0');
    fillPixelCircle(ctx, mx + 2,  my + 34, 9,  '#e2cda0');

    // ---- 구름 ----
    for(const c of this.clouds){
      ctx.fillStyle = c.c;
      const x = snap(c.x);
      ctx.fillRect(x, c.y, c.w, c.h);
      ctx.fillRect(x + snap(c.w*0.18), c.y - PX*2, snap(c.w*0.5), PX*2);
      ctx.fillRect(x + snap(c.w*0.34), c.y - PX*4, snap(c.w*0.24), PX*2);
      ctx.fillRect(x - PX*3, c.y + c.h - PX*2, c.w + PX*6, PX*2);
    }

    // ---- 산 (패럴랙스 2레이어) ----
    const fx = -snap(this.offFar), nx = -snap(this.offNear);
    blitRidge(ctx, this.far,  fx); blitRidge(ctx, this.far,  fx + GAME_W);
    blitRidge(ctx, this.near, nx); blitRidge(ctx, this.near, nx + GAME_W);

    // ---- 불씨 ----
    for(const e of this.embers){
      const k = e.life / e.max;
      ctx.globalAlpha = k < 0.15 ? k/0.15 : (1 - k) * 0.95;
      ctx.fillStyle = e.c;
      ctx.fillRect(snap(e.x + Math.sin(e.sw)*10), snap(e.y), e.s, e.s);
    }
    ctx.globalAlpha = 1;

    // ---- 로고 ----
    const bob = snap(Math.sin(t*1.6)*6);
    this.drawLogo(ctx, this.logoA, 640, 104 + bob, t);
    this.drawLogo(ctx, this.logoB, 640, 214 + bob, t + 0.35);

    // 장식 라인
    const lw = 300 + Math.round(Math.sin(t*2)*4)*PX;
    ctx.fillStyle = PAL.goldDim;
    ctx.fillRect(snap(640 - lw/2), 380, lw, PX);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(snap(640 - PX*5), 376, PX*10, PX*3);

    drawText(ctx, 'PIXEL DRAGON SHOOTER', 640, 400, 3,
      { align:'center', color:PAL.gold, shadow:'#000', spacing:4 });

    // ---- PRESS ENTER (깜빡임) ----
    const on = (t*1.55 % 1) < 0.62;
    if(on){
      drawText(ctx, 'PRESS ENTER TO START', 640, 462, 5,
        { align:'center', color:(r)=> r<2 ? PAL.white : PAL.gold, outline:PAL.outline, shadow:'#000', shadowOff:8 });
    }
    drawText(ctx, 'OR TAP / CLICK ANYWHERE', 640, 528, 2,
      { align:'center', color:PAL.dim, alpha:0.85 });

    // ---- 하단 정보 ----
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#000';
    ctx.fillRect(0, 656, GAME_W, 64); ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.outline; ctx.fillRect(0, 652, GAME_W, PX);

    // BGM 선택기
    const tr = BGM_TRACKS[this.bgmSel | 0];
    drawText(ctx, '< BGM ' + (this.bgmSel+1) + '  ' + tr.name + ' >', 640, 596, 3,
      { align:'center', color:PAL.gold, outline:PAL.outline, shadow:'#000' });
    drawText(ctx, 'LEFT / RIGHT: BGM PREVIEW      DOWN: OPTIONS      F: FULLSCREEN', 640, 624, 2,
      { align:'center', color:PAL.dim });
    drawText(ctx, 'MOVE: WASD / ARROWS   MISSILE: Q   BOMB: E   PAUSE: ESC', 640, 672, 2,
      { align:'center', color:PAL.dim });
    drawText(ctx, 'BUILD ' + BUILD, 1264, 700, 2, { align:'right', color:PAL.goldDim });
    drawText(ctx, 'F3: DEBUG', 16, 700, 2, { color:PAL.goldDim });

    if(DEBUG) drawHUDDebug(ctx);
  }

  /* 로고 1개 그리기: 소프트 블룸 + 픽셀 원본 */
  drawLogo(ctx, img, cx, y, t){
    const x = snap(cx - img.width/2);
    const g = 1.06, pulse = 0.16 + 0.10*Math.sin(t*2.2);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = pulse;
    ctx.drawImage(img, x - img.width*(g-1)/2, y - img.height*(g-1)/2, img.width*g, img.height*g);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x, y);
  }
}

/* ==================================================================
   GameScene - Phase 2 : 이동 테스트
   (배경은 Phase 7 에서 20종 스테이지로 교체될 임시 플레이스홀더)
   ================================================================== */
const SKY_TEST = [
  {p:0.00,c:'#123a6b'},{p:0.28,c:'#1f5c96'},{p:0.52,c:'#3a8ab4'},
  {p:0.72,c:'#69b6c6'},{p:0.86,c:'#a4d9c8'},{p:1.00,c:'#dcefc4'}
];
const MAX_LIVES = 10;
/* 한 스테이지에서 "1명당" 나오는 아이템 개수. 스테이지나 적 수와 무관하게 고정.
   물량이 아니라 위치를 노려서 먹게 만들고, 그 사이는 황금동전으로 채운다. */
/**
 * ★ **미사일과 핵무기 투하를 정확히 두 배로.** (2026-08-26, 사용자 지정)
 *
 * 사과는 그대로 둔다 — 회복까지 두 배가 되면 죽지를 않는다.
 * 핵무기는 최종보스가 따로 하나 더 떨구므로 7 + 1 = 8, 예전 3 + 1 = 4 의 두 배다.
 */
const DROP_PLAN = [
  /**
   * ★ **남아돌지 않게 줄인다.** (2026-08-26, 사용자 지적)
   * *"핵무기 미사일 남아돌고 진짜 너무 재미가 없어"*
   *
   * 한 판에 20개씩 주우면 상한 50 을 늘 꽉 채운 채로 다닌다. 그러면 미사일은
   * **아껴 쓰는 물건이 아니라 그냥 두 번째 발사 버튼**이 된다.
   * 절반으로 줄여서 "지금 쓸까 아낄까" 를 생각하게 만든다.
   */
  /**
   * ★ **또 절반으로.** (2026-08-27, 사용자 지적)
   * *"미사일이 너무 많으니 재미가 없다 (...) 미사일을 아껴 써야 하는데"*
   * 판당 10개도 많았다 — 연발 제한(2번)까지 걸린 마당에 개수까지 넉넉하면
   * 아낄 이유가 없다. 5개로 줄이고 간격도 두 배로.
   */
  { kind:'missile', rounds: 5, every:11.0, first: 6 },
  { kind:'apple',   rounds:10, every: 6.5, first: 7 },   // 1인당 10개 (그대로)
  /**
   * ★ **핵무기는 30초에 하나.** (2026-08-26, 사용자 지적)
   *
   * 8초에 하나씩 떨어뜨렸더니 **핵무기가 핵무기가 아니게 됐다.** 한 방이
   * 15초짜리 무적 쉰드를 같이 주는 물건인데 그게 계속 손에 들어오면 그냥 계속 무적이다.
   * 30초 간격이면 한 스테이지에 두세 개 — 아껴 쓰다가 위험할 때 꺼내는 물건이 된다.
   * 처음에 두 개를 들고 시작하고 상점에서 열두 개까지 늘릴 수 있으니
   * 떨어지는 것을 줄여도 쓸 기회는 충분하다.
   */
  { kind:'bomb',    rounds: 3, every:42.0, first:20 }   // 핵무기 (5/30초 -> 3/42초)
];
/**
 * ★ **스칠수록 번다.** (기획 6, 2026-08-27)
 *
 * 금화는 **줍는 것**뿐이었다. 그래서 잘하는 길이 "동전을 쫓아다니기" 가 되고
 * **피하는 행위 자체에는 아무 보상이 없었다** — 안전한 구석에 붙어 있는 것이
 * 언제나 옳았다.
 *
 * 적탄 둘레에 얇은 띠를 하나 더 두고, 맞지 않고 그 띠를 지나가면 점수를 준다.
 * 일정 수를 채울 때마다 금화 한 닢. 그러면 **회피가 곧 수입**이 되어
 * 구석이 아니라 탄 사이로 들어가게 된다.
 *
 * 판정 상자는 **좌우로만** 넓힌다. 탄은 대개 가로로 오므로 위아래로 넓히면
 * "스쳤다" 가 아니라 "맞을 뻔했다" 가 되어 셈이 헐거워진다.
 */
const GRAZE_PAD = 36;              // 판정 상자를 좌우로 이만큼 넓힌다
const GRAZE_SCORE = 20;            // 한 번 스칠 때 점수
/* 25 로 뒀더니 1분에 한 닢도 안 나왔다 — 있으나 마나 한 보상은 안 하느니만 못하다 */
const GRAZE_PER_COIN = 12;

/**
 * ★ **연쇄가 끊기기 전에.** (기획 7, 2026-08-27)
 *
 * 연속 처치는 예전부터 세고 있었지만 **화면에 거의 안 보였고 끊기지도 않았다.**
 * 시간 제한을 두면 이야기가 달라진다 — 끊기지 않으려면 가만히 있을 수가 없어서
 * **플레이어가 스스로 위험한 쪽으로 간다.** 난이도를 강요하지 않고 올리는 길이다.
 */
const CHAIN_HOLD = 2.6;            // 이 시간 안에 다음을 못 잡으면 끊긴다
/**
 * 배수 상한. 처음에 9.9 로 뒀더니 봇이 60초 만에 66연속으로 **상한에 닿았다** —
 * 적이 늘 열댓 마리 떠 있으니 2.6초 안에 하나 잡는 것은 어렵지 않다.
 * 그러면 점수가 통째로 열 배가 되어 옛 기록과 비교가 안 되고,
 * 무엇보다 **상한에 닿는 순간 배수가 사라진 것과 같아진다.**
 * 4.0 이면 계속 오를 여지가 남으면서 점수 눈금도 안 무너진다.
 */
const CHAIN_MAX = 4.0;

const COIN_INTERVAL = 2.6;          // 황금동전 뭉치가 나오는 주기
const COIN_PER_ARC  = 6;            // 한 뭉치에 몇 개
/**
 * ★ **드래곤 결투** (2026-08-26 F단계, 사용자 지정)
 *
 * 싱글게임과 규칙이 아예 다르다. 스테이지가 없고, **한 판 300초 안에 보스 열 마리**를
 * 누가 더 많이 무너뜨렸는지로 겨룬다.
 *
 * ★ **둘이 같은 판을 따로 뛴다.** 화면을 실시간으로 맞추지 않는다 —
 * 같은 씨앗으로 같은 순서의 보스가 나오고, 오가는 것은 **점수·금화·보스 수뿐**이다.
 * 탄막 게임을 프레임 단위로 동기화하려면 서버가 필요하고, 그건 이 게임의 규모가 아니다.
 * 대신 끊겨도 내 판은 안 멈추고, 지연이 있어도 억울할 일이 없다.
 *
 * 하트 아이템이 안 나오고 목숨이 다섯으로 고정인 이유: 목숨이 늘어나는 판은
 * "누가 오래 버티나" 가 되어 300초 제한이 무의미해진다.
 */
const DUEL = {
  TIME: 300,            // 한 판 300초
  LIVES: 5,             // 하트 다섯 고정 (아이템으로 안 늘어난다)
  BOSSES: 10,           // 보스 열 마리
  DIFFICULTY: 'hard',   // 어려움 고정 — 둘이 같은 조건이어야 겨루기가 된다
  /** 보스 n(1부터) 이 몇 스테이지짜리 세기인가. 열째가 20스테이지 보스만큼 세다 */
  bossStage: (n) => Math.min(20, n * 2),
  /** 죽으면 점수를 이만큼 잃는다 — 뺏기는 게 아니라 사라진다 */
  DEATH_PENALTY: 0.20,
  /** 보스 하나를 무너뜨릴 때마다 받는 몫 */
  BOSS_SCORE: 30,          // 점수 눈금(1/100)에 맞춘 값
};

/**
 * ★ **금화로 사는 컨티뉴.** (2026-08-26)
 *
 * 20판 완주가 24분이다. 18판에서 죽으면 그 24분이 통째로 날아가고 1판부터 다시다 —
 * 한 번의 실수에 물리는 값으로 너무 크다.
 *
 * 죽은 자리에서 이어 붙이되 **값을 매긴다**: 금화 500, 한 판에 두 번까지.
 *   · 금화 소비처가 하나 늘어 버는 이유가 생긴다
 *   · 무한이면 죽는 것이 무의미해지므로 두 번으로 묶는다
 *   · 값이 오르는 것도 아니게 둔다 — 계산이 복잡해지면 살지 말지를 못 정한다
 *
 * 파이어 레벨은 **1로 돌아간다.** 목숨 하나 잃는 것과 판을 다시 사는 것은 다르다 —
 * 화력까지 그대로면 컨티뉴가 그냥 목숨 추가가 된다.
 */
const CONTINUE_COST = 500;
const CONTINUE_MAX = 2;

const STAGE_TIME = 80;              // 중간보스가 나올 때까지의 제한 시간 (초).
                                    // 보스가 등장하면 타이머는 멈춘다. 보스전은 시간제한 없이.
/**
 * 상단 가운데 시간 게이지 (누르면 일시정지).
 * ★ 화면 폭에서 뽑는다 (2026-08-27) — 세로에서는 화면이 720 밖에 안 되므로
 * 1280 기준으로 박아 두면 화면 밖으로 나간다.
 */
function timeBar(){
  const w = Math.min(480, UIW - 300);
  return { x: Math.round(UIW/2 - w/2), y: 16, w, h: 26 };
}
/**
 * ★★ **전체화면 단추를 화면에 박아 둔다.** (2026-08-27, 사용자 지정)
 *
 * *"가끔 폰으로 하다보면 전체화면이 안된 상태에서 가로 모드 돌입하는데 그럼 너무
 *   불편해.. 그냥 게임 우측 상단에 전체화면 그림으로 박아놓자"*
 *
 * 예전에는 키보드(F) 로만 켤 수 있었다 — 폰에는 키보드가 없다. 세로에서 가로로
 * 돌리면 게임은 시작되는데 주소창이 남아 화면이 반쪽이 되고, 거기서 빠져나갈
 * 길이 화면에 없었다.
 *
 * **누가 봐도 아는 네 모서리 꺾쇠**를 오른쪽 위에 고정한다. 한 번 더 누르면
 * 안쪽을 향하는 창모드 아이콘으로 바뀐다.
 */
const FS_BTN = { size: 44, pad: 14 };
const P1_COLOR = '#8fd0ff', P2_COLOR = '#ffa8d0';

/**
 * ★★ **금화 정산 — 부자가 된 기분.** (2026-08-27, 사용자 지정)
 *
 * *"핵심은 보유 금화. 획득 금화 합친다. 애니메이션 효과. 합쳐졌다.
 *   금화가 쏟아진다. 이걸 시각적으로 애니메이션 넣어. 부자가 된듯한 애니메이션"*
 *
 * 판이 끝나면 표가 툭 뜨는 것이 전부였다. 30분을 들여 모은 금화가
 * **표의 한 줄**로 끝나니 번 것 같지가 않다.
 *
 * 여섯 걸음으로 나눠 보여 준다. 각 걸음이 **하나씩만** 말하게 해야
 * 눈이 따라온다 — 한꺼번에 다 움직이면 아무것도 안 읽힌다.
 *
 *   ① 보유    가운데에 지금까지 모은 금화가 크게 튀어나온다
 *   ② 더하기  그 오른쪽에 `+` 가 튀어나온다
 *   ③ 획득    그 오른쪽에 이번 판에서 번 금화가 뜬다
 *   ④ 합체    획득이 0.5초에 걸쳐 보유 쪽으로 날아가 부딪히며 꿀렁인다
 *   ⑤ 슬롯    합쳐진 숫자가 슬롯머신처럼 빠르게 올라간다
 *   ⑥ 폭발    다 오르면 화면 절반만 하게 커졌다 작아지고, 뒤로 금화가 쏟아진다
 *
 * 걸음마다 시각을 못 박아 두면(`TALLY`) 순서를 바꾸거나 늘리기가 쉽다.
 */
/**
 * ★ **다시 짰다 — 공식으로 보여 준다.** (2026-08-27, 사용자 지적)
 *
 * *"오른쪽 숫자가 왼쪽으로 합쳐지는거 만들지마. 예를 들어 0 + 200 = 최종숫자.
 *   이렇게 공식뜨게 하고. 오른쪽 최종숫자가 계속 올라가다가 멈추는 슬롯머신"*
 *
 * 처음에는 획득을 보유 쪽으로 날려 붙였는데, **두 숫자가 겹치는 순간이
 * 지저분했고** 무엇이 무엇과 합쳐지는지도 안 읽혔다.
 * 셈은 셈처럼 보여야 한다 — `보유 + 획득 = 합계` 를 한 줄에 늘어놓고,
 * **오른쪽 합계만** 슬롯머신처럼 굴린다. 눈이 한 곳만 보면 된다.
 */
const TALLY = {
  own:   [0.00, 0.50],      // ① 보유
  plus:  [0.50, 0.75],      // ② +
  gain:  [0.75, 1.15],      // ③ 획득
  eq:    [1.15, 1.40],      // ④ =
  roll:  [1.40, 3.60],      // ⑤ 합계가 굴러 올라간다 (2.2초 — 예전보다 1초 이상 길게)
  boom:  [3.60, 4.10],      // ⑥ 팡 터지고 숫자가 확정된다
  hold:  [4.10, 4.60],      // ⑦ 0.5초 머문다
  end:    4.60,
};
/** 0~1 로 편 진행도. 아직 안 왔으면 -1, 지났으면 2 */
function tallyK(t, span){
  if(t < span[0]) return -1;
  if(t > span[1]) return 2;
  return (t - span[0]) / (span[1] - span[0]);
}
/** 튀어나오는 곡선 — 살짝 넘겼다 제자리로 (뻣뻣하지 않게) */
function popEase(k){
  if(k <= 0) return 0;
  if(k >= 1) return 1;
  return 1 + Math.sin((1 - k) * Math.PI * 1.5) * (1 - k) * 0.55;
}

class GameScene extends Scene {
  /** ★ 이 씬만 세로에서 판을 90도 돌려 그린다 (2026-08-27) */
  rotates = true;

  /* carry : 이전 스테이지에서 이어받는 플레이어 상태 (컨티뉴) */
  /**
   * @param {number} stage
   * @param {object} [carry] 이전 스테이지에서 이어받는 상태 (컨티뉴)
   * @param {boolean} [duel]  결투 한 판인가
   */
  constructor(stage, carry, duel){
    super();
    this.duel = !!duel;
    this.stageNo = clamp(stage || 1, 1, 20);
    CUR_STAGE = this.stageNo;         // 적 생성자가 참조한다
    this.carry = carry || null;
  }
  enter(){
    /* ★ 생성자에서도 넣지만 여기서 다시 넣는다 — 씬을 다시 `enter` 하면
       (검사·재시작) 생성자를 안 타므로 적 레벨이 옛 스테이지에 묶인다 */
    CUR_STAGE = this.stageNo;
    this.t = 0; this.stage = this.stageNo;
    /* ★ 이 판의 규칙 (기획 4). 없는 판이 더 많다 — 쉬는 판이 있어야 눈에 띈다 */
    this.rule = STAGES[this.stageNo].rule || null;
    this.ruleT = this.rule ? 3.4 : 0;      // 예고 배너가 떠 있는 시간
    this.rocks = [];                       // '낙석' 이 쓰는 바위들
    this.boltT = 2.2;                      // '번개' 까지 남은 시간
    const st = STAGES[this.stage];
    this.theme = st;
    this.sky = buildSky(st.sky);
    const L = st.layers, sd = 1000 + this.stage*17;
    this.far  = L[0].s === 'none' ? null : buildRidge(sd+0, L[0].b, L[0].a, L[0].r, L[0].c, L[0].s);
    this.mid  = L[1].s === 'none' ? null : buildRidge(sd+1, L[1].b, L[1].a, L[1].r, L[1].c, L[1].s);
    this.near = L[2].s === 'none' ? null : buildRidge(sd+2, L[2].b, L[2].a, L[2].r, L[2].c, L[2].s);
    this.fg   = L[3].s === 'none' ? null : buildRidge(sd+3, L[3].b, L[3].a, L[3].r, L[3].c, L[3].s);

    /**
     * ★ **판마다 하나뿐인 큰 것.** (2026-08-26)
     *
     * 배경 겹 위에 그대로 얹는다 — 그러면 그 겹의 시차 속도로 같이 흐르고,
     * 겹이 아예 없는 하늘 판(13~20)에서는 빈 캔버스를 하나 새로 만들어 얹는다.
     * 능선 캔버스는 GAME_W 폭으로 순환하므로 랜드마크도 한 바퀴에 한 번 지나간다.
     */
    const mk = st.mark;
    if(mk){
      const key = mk.l === 'far' ? 'far' : 'mid';
      if(!this[key]){
        const made = makeCanvas(GAME_W, GAME_H);
        made.cv._top = 0; this[key] = made.cv;
      }
      drawLandmark(this[key].getContext('2d'), mk.s, snap(GAME_W*mk.x),
                   mk.y, mk.w, mk.h, mk.c, sd);
      /* 랜드마크가 능선보다 높이 솟으면 잘림 판정(_top)도 같이 올려야 한다 */
      this[key]._top = Math.min(this[key]._top ?? 0, Math.max(0, mk.y - mk.h - PX*8));
    }
    this.weather = st.fx ? new Weather(st.fx, sd) : null;
    this.offFar = 0; this.offMid = 0; this.offNear = 0; this.offFg = 0;
    this.scrollK = 1; this.camLead = 0;

    // --- 플레이어 ---
    // 파이어 레벨은 절대 저장하지 않는다. 컨티뉴로 이어받을 때만 유지된다.
    // 게임을 나가거나 게임오버가 나면 무조건 Lv1 부터 다시 시작.
    /**
     * ★ **1스테이지는 파이어 레벨 2로 시작한다.** (2026-08-26, 사용자 지정)
     * Lv1 은 26px 한 줄에 관통 0 이라 적 하나 잡으면 사라진다 — 첫인상이 초라했다.
     * Lv2 는 두 줄 52px 이라 화면이 확 달라진다. 죽으면 어차피 1스테이지부터라
     * "처음부터 조금 세게" 가 맞다. (이어지는 스테이지는 carry 가 이긴다)
     */
    this.p1 = new Player(320, GAME_H/2 - 60, START_FIRE_LV, Save.data.dragon|0, 1);
    this.p2 = null;                 // 2P 는 게임 도중 WASD 로 난입
    // 컨티뉴로 넘어왔으면 하트/HP/불레벨/무기/드래곤을 그대로 이어받는다
    if(this.carry){
      for(const c of this.carry.players){
        const np = c.pid === 1 ? this.p1
                 : (this.p2 = new Player(320, GAME_H/2 + 90, c.level, c.dragonIdx, 2));
        np.dragonIdx = c.dragonIdx; np.level = c.level;
        np.lives = c.lives; np.hp = c.hp; np.out = false;
        np.score = c.score || 0;                     // 점수도 이어진다
        np.missileCount = c.missileCount; np.bombCount = c.bombCount;
      }
      this.p1UsesKeysCarry = this.carry.p1UsesKeys;
    }
    this.joining = false;           // 2P 캐릭터 선택 중
    this.joinSel = 0; this.joinT = 0;
    this.p1UsesKeys = !!this.p1UsesKeysCarry;   // 1P 가 방향키를 쓴 적이 있는가

    this.stick = new VirtualStick(makeStickCfg());
    this.buildButtons();
    Input.pointerHandler = {
      /**
       * `x,y` 는 **판(월드)** 좌표 — 캐릭터 잡기가 쓴다.
       * `sx,sy` 는 **화면** 좌표 — 단추·메뉴가 쓴다 (세로에서는 판이 돌아 있다).
       */
      down:(id,x,y,type,sx,sy) => {
        if(sx === undefined){ sx = x; sy = y; }
        /**
         * ★ **마우스 더블클릭 = 따라가기 켜기/끄기.** (2026-08-27)
         * 320ms 안에 40px 안쪽을 두 번 누르면 더블클릭이다.
         * 손가락은 제외한다 — 누르지 않으면 좌표가 안 와서 뜻이 없다.
         */
        if(type === 'mouse' && this.state === 'play'){
          const now = this.t;
          if(now - this.lastClickT < 0.32 &&
             Math.hypot(x - this.lastClickX, y - this.lastClickY) < 40){
            this.lastClickT = -9;
            this.toggleFollow();
            return;
          }
          this.lastClickT = now; this.lastClickX = x; this.lastClickY = y;
        }
        /**
         * ★ 전체화면 단추. **이 핸들러 안에서 바로** 불러야 브라우저가 허용한다 —
         * 나중으로 미루면 "사용자가 누른 것" 으로 안 쳐 준다 (2026-08-27).
         * 어느 상태에서도 눌린다 — 결과 화면에서도 전체화면을 켜고 끌 수 있어야 한다.
         */
        {
          const r = this.fsRect();
          if(sx >= r.x - 8 && sx <= r.x + r.w + 8 && sy >= r.y - 8 && sy <= r.y + r.h + 8){
            toggleFullscreen(); SND.sfx('blip'); this.uiTap = true; return;
          }
        }
        {
          const tb = timeBar();
          if(this.state === 'play' &&
             sx >= tb.x - 10 && sx <= tb.x + tb.w + 10 &&
             sy >= tb.y - 10 && sy <= tb.y + tb.h + 10){
            this.setPause(true); return;
          }
        }
        if(this.state === 'pause'){
          this.tapIdx = this.pauseHit(sx, sy);
          if(this.tapIdx >= 0){ this.menuIdx = this.tapIdx; this.uiTap = true; SND.sfx('blip'); }
          return;
        }
        if(this.state === 'clear' || this.state === 'over'){
          this.tapIdx = this.endHit(sx, sy);
          if(this.tapIdx >= 0){ this.endIdx = this.tapIdx; SND.sfx('blip'); }
          this.uiTap = true; return;
        }
        if(this.state !== 'play'){ this.uiTap = true; return; }
        /* 무기 버튼이 먼저다 — 버튼 위에서 시작한 터치는 이동이 아니다 */
        /* 무기 단추도 화면 좌표다 — 그림과 판정이 같은 자리를 봐야 한다 */
        if(this.btnMsl.down(id,sx,sy)) return;
        if(this.btnBomb.down(id,sx,sy)) return;
        if(this.btnMsl2 && this.btnMsl2.down(id,sx,sy)) return;
        if(this.btnBomb2 && this.btnBomb2.down(id,sx,sy)) return;
        /* 그다음이 **캐릭터 잡기**. 스틱보다 먼저 봐야 한다 —
           스틱이 화면 아무 데나 뜨는 설정이면 캐릭터 위에서도 스틱이 잡힌다 */
        if(this.grabDown(id,x,y)) return;
        if(this.stickVisible()) this.stick.down(id,sx,sy);
      },
      move:(id,x,y,sx,sy) => {
        if(sx === undefined){ sx = x; sy = y; }
        if(this.grabMove(id,x,y)) return;          // 캐릭터 잡기는 판 좌표
        if(this.stickVisible()) this.stick.move(id,sx,sy);
      },
      up:  (id)     => {
        this.btnMsl.up(id); this.btnBomb.up(id);
        if(this.btnMsl2) this.btnMsl2.up(id);
        if(this.btnBomb2) this.btnBomb2.up(id);
        if(this.dragId === id) this.dragId = null;
        this.stick.up(id);
      }
    };

    // 전투 상태
    this.bolts = []; this.enemies = []; this.arrows = []; this.booms = [];
    this.eshots = []; this.missiles = []; this.bombs = []; this.waves = [];
    this.pmissiles = []; this.items = []; this.roars = [];
    this.score = this.carry ? this.carry.score : 0;
    this.scoreFrac = 0;               // 점수의 소수 자리 (100 으로 나누며 생긴다)
    this.kills = 0;
    /* 새 판이 아니라 **이어지는 스테이지**면 동전을 이어서 센다 */
    if(!this.carry){
      RUN.coins = 0; RUN.coinFrac = 0; RUN.banked = 0; RUN.noHitRun = 0;
      RUN.wallet0 = DG.coins() | 0;      // 이 판을 시작할 때의 지갑 (고정)
    }
    this.boss = null; this.bossBannerT = 0; this.bossDeathT = 0;
    this.lootT = undefined;           // 최종보스 뒤 금화 줍는 시간
    this.killStreak = 0;
    this.chainT = 0;                 // 연쇄가 끊기기까지 남은 시간
    this.chainBest = 0;              // 이 스테이지에서 가장 길었던 연쇄
    this.grazeN = 0;                 // 스친 횟수 (금화로 바뀔 몫)
    this.grazeTotal = 0;             // 이 판 전체
    this.grazeFlash = 0;             // 표시가 잠깐 커지는 연출
    this.stageHits = 0;              // 이 스테이지에서 맞은 횟수 (무피격 보너스)
    this.noHit = false; this.noHitBonus = 0; this.noHitCoin = 0;
    // 아이템 투하 예약표 (인원수만큼 위아래로 나눠 떨어진다)
    this.dropQ = DROP_PLAN.map(d => ({ kind:d.kind, left:d.rounds, t:d.first, every:d.every }));
    /* ★ **첫 뭉치를 곧바로 뿌린다.** 뭔가 먹을 게 있어야 움직인다 (사용자 지정) */
    this.coinT = 0.8; this.heartDropped = false;
    /**
     * ★ **1스테이지 5초에 파이어 레벨업 하나.** (2026-08-26, 사용자 지정)
     *
     * 이것 하나로 레벨 눈금이 딱 떨어진다 —
     *   1스테이지 : 시작 1 → 5초에 2 → 중간보스 잡고 3
     *   2스테이지 : 중간보스 잡고 4
     *   그 뒤로 한 스테이지에 한 칸씩
     *
     * 이어지는 스테이지(`carry`)에서는 안 준다 — 주면 스테이지마다 두 칸씩 오른다.
     */
    this.firstPowerT = (!this.carry && this.stage === 1 && !this.duel) ? FIRST_POWER_AT : -1;
    this.pickupMsg = null; this.pickupT = 0;
    Freeze.reset(); Flash.reset(); Popups.clear();

    this.state = 'play'; this.stateT = 0;
    this.timeLeft = this.duel ? DUEL.TIME : STAGE_TIME;
    this.endReason = ''; this.bonus = 0;
    this.duelBossKills = 0;           // 무너뜨린 보스 수 (결투 점수의 뼈대)
    /* 이어하기로 들어왔으면 몇 번 썼는지 이어받는다 (한 판에 두 번까지) */
    this.continuesUsed = (this.carry && this.carry.continues) | 0;
    this.runEnded = false;      // 이 판의 끝을 이미 알렸는가
    this.endRows = 5;                 // 결과 표의 줄 수 (자리 계산에 쓴다)
    /* 금화 정산 애니메이션 (판이 진짜 끝났을 때만 돈다) */
    this.tallyT = -1;                 // -1 = 안 함
    this.tallyCoins = []; this.tallyShown = 0;
    this.finalBossKilled = false; this.menuIdx = 0; this.endIdx = 0;
    this.tapIdx = -1;                 // 터치로 고른 메뉴 번호
    /**
     * ★ **캐릭터를 직접 잡고 끄는 조작.** (2026-08-26, 사용자 지정)
     *
     * 스틱은 방향만 주므로 **최고 속도가 정해져 있다.** 화면을 가로지르려면
     * 스틱을 끝까지 밀고 기다려야 한다. 캐릭터를 손가락으로 집어서 끌면
     * 손이 움직인 만큼 그대로 따라오니 훨씬 빠르고, 정확히 원하는 자리에 놓인다.
     *
     * 잡는 범위는 **필살기 쉴드만 한 원**이다 — 몸통만 하면 너무 작아서 못 잡고,
     * 화면 아무 데나면 실수로 잡힌다. 쉴드는 이미 이 게임에서 "내 몸 주변" 을
     * 뜻하는 크기라 손이 기억하기 좋다.
     *
     * `dragOff` : 잡은 순간의 (캐릭터 - 손가락) 차이. 이걸 유지해야 캐릭터가
     *   손가락 밑으로 순간이동하지 않고 **잡은 그 자세 그대로** 따라온다.
     */
    this.dragId = null; this.dragOff = { x:0, y:0 }; this.dragT = 0;
    /* 마우스 더블클릭으로 켜는 '따라가기' (2026-08-27) */
    this.followMouse = false; this.followT = 0;
    this.lastClickT = -9; this.lastClickX = 0; this.lastClickY = 0;
    this.formName = ''; this.formT = 0;   // 방금 나온 적 대형 이름

    this.director = new Director(this, this.stage, this.duel);
    if(this.duel) for(const p of this.allPlayers()) p.lives = DUEL.LIVES;
    this.best = Save.data.best[this.stage] || 0;
    applyAudioOpt();

    const rnd = mulberry32(909 + this.stage*13);
    this.clouds = [];
    const cn = st.cloudA > 0.36 ? 18 : 12;
    for(let i=0;i<cn;i++)
      this.clouds.push({ x: rnd()*GAME_W, y: snap(40 + rnd()*380),
        w: snap(90 + rnd()*230), h: snap(12 + rnd()*20), sp: 34 + rnd()*58,
        a: st.cloudA * (0.6 + rnd()*0.7) });
    this.lines = [];
    for(let i=0;i<70;i++)
      this.lines.push({ x: rnd()*GAME_W, y: snap(rnd()*GAME_H), len: snap(40+rnd()*110), sp: 900+rnd()*900 });
    this.fgWisps = [];
    for(let i=0;i<7;i++)
      this.fgWisps.push({ x: rnd()*GAME_W*1.6, y: snap(30 + rnd()*640),
        w: snap(160 + rnd()*280), h: snap(10 + rnd()*20), sp: 1100 + rnd()*700, a: 0.10 + rnd()*0.12 });
  }
  exit(){ Input.pointerHandler = null; }

  /* 1P 가 터치로 조작 중이면(방향키를 쓴 적이 없으면) 스틱을 남겨둔다.
     폰에서 1P 터치 + 2P 키보드 조합도 가능하도록. */
  /**
   * 스틱을 보여 줄 때.
   * ★ **캐릭터를 잡고 끄는 동안에는 감춘다.** (2026-08-26, 사용자 지정)
   * 두 조작이 같이 떠 있으면 뭘로 움직이고 있는지 헷갈리고, 스틱이 화면을 가린다.
   */
  stickVisible(){ return this.dragId === null && !this.followMouse && (!this.p2 || !this.p1UsesKeys); }

  /* 1인일 때는 오른쪽에만, 2인일 때는 좌우로 나눠 배치한다 */
  buildButtons(){
    const o = optGet();
    // 2인이면 화면이 복잡해지므로 버튼을 30% 줄인다
    const shrink = this.p2 ? 0.7 : 1;
    const br = Math.round(BTN_R[clamp(o.btnSize,0,2)] * shrink), br2 = Math.round(br*0.92);
    /* ★ 화면 크기에서 뽑는다 — 세로면 720x1280 이다 (2026-08-27) */
    const my = UIH - br - 52;
    const rx = UIW < 900 ? UIW - br - 24 : UIW - br - 140;   // 세로는 폭이 좁아 더 붙인다
    this.btnMsl  = new TouchButton(rx, my, br, ICON_MISSILE, 4, P1_COLOR, this.p2 ? '1P' : '');
    this.btnBomb = new TouchButton(UIW - br2 - 24, my - br - 40, br2, ICON_BOMB, 4, PAL.gold, this.p2 ? '1P' : '');
    this.btnMsl.alpha = this.btnBomb.alpha = o.btnAlpha;
    if(this.p2){
      // 스틱이 남아 있으면 겹치지 않도록 2P 버튼을 위로 올린다
      const y2 = this.stickVisible() ? Math.round(UIH*0.42) : my;
      this.btnMsl2  = new TouchButton(br + 140, y2, br, ICON_MISSILE, 4, P2_COLOR, '2P');
      this.btnBomb2 = new TouchButton(br2 + 24, y2 - br - 40, br2, ICON_BOMB, 4, PAL.gold, '2P');
      this.btnMsl2.alpha = this.btnBomb2.alpha = o.btnAlpha;
    }else{
      this.btnMsl2 = this.btnBomb2 = null;
    }
  }
  /**
   * ★ 화면이 가로↔세로로 돌았다 (2026-08-27).
   * 판(게임 로직)은 그대로다 — **화면에 붙어 있는 것**만 자리를 다시 잡는다.
   */
  onOrient(){
    this.buildButtons();
    if(this.stick && this.stick.relayout) this.stick.relayout();
  }
  /* 2P 퇴장 (실수로 참가했을 때 되돌리기) */
  leave2P(){
    if(!this.p2) return;
    this.p1.missileCount = Math.min(MAX_MISSILE, this.p1.missileCount + this.p2.missileCount);
    this.p1.bombCount    = Math.min(MAX_BOMB, this.p1.bombCount + this.p2.bombCount);
    this.p2 = null; this.joining = false;
    this.buildButtons();
    Popups.add(this.p1.x, this.p1.y - 90, '1P SOLO', P1_COLOR, 4);
    SND.sfx('deny');
  }

  /* out = 잔기를 모두 잃어 탈락한 플레이어. 남은 사람은 계속 진행한다 */
  allPlayers(){ return this.p2 ? [this.p1, this.p2] : [this.p1]; }
  players(){ return this.allPlayers().filter(p => !p.out); }
  /**
   * ★ **지금 화면에 있는 사람.** (2026-08-27)
   * 죽어서 사라진 동안(`deadT`)은 여기에 안 들어간다 — 안 그려지고, 안 맞고,
   * 적의 조준선도 이 목록을 보므로 **없는 사람을 겨누지 않는다.**
   */
  livePlayers(){ return this.allPlayers().filter(p => !p.out && p.deadT <= 0); }
  totalLives(){ let n = 0; for(const p of this.allPlayers()) n += p.lives; return n; }
  nearestPlayer(x, y){
    const ps = this.players();
    if(ps.length === 1) return ps[0];
    return Math.hypot(ps[0].x-x, ps[0].y-y) <= Math.hypot(ps[1].x-x, ps[1].y-y) ? ps[0] : ps[1];
  }

  onBossKilled(b){
    this.director.onBossKilled(b);
    if(this.boss === b) this.boss = null;
    if(this.duel){
      this.duelBossKills++;
      /* 보스는 결투 점수의 뼈대다 — 잡몹만 잡아서는 이길 수 없어야 한다 */
      this.addScore(DUEL.BOSS_SCORE, 1);
      Popups.add(GAME_W/2, 220, '보스 ' + this.duelBossKills + ' / ' + DUEL.BOSSES,
                 PAL.gold, 5, true);
    }
    const big = !(b instanceof MidBoss);
    if(big) this.finalBossKilled = true;
    this.bossDeathT = big ? 3.0 : 2.0;
    this.bossDeathX = b.x; this.bossDeathY = b.y; this.bossDeathR = big ? 150 : 100;
    Shake.add(big ? 22 : 15, big ? 1.0 : 0.6);
    Flash.add('#ffffff', big ? 0.3 : 0.18, big ? 0.75 : 0.5);
    Freeze.add(big ? 0.16 : 0.11);
    this.waves.push(new Shockwave(b.x, b.y, big ? 1400 : 900, big ? 0.7 : 0.5));
    Popups.add(b.x, b.y - 80, b.gotScore || 0, PAL.fire[0], 7);
    SND.sfx('boomL');
    Input.rumble(1.0, 0.9, 700);
  }

  onEnemyKilled(e){
    if(e instanceof MidBoss){
      // 파이어 레벨을 올릴 수 있는 유일한 기회.
      // 하트는 한 스테이지에 1명당 딱 1개. 중간보스가 2마리여도 처음 한 번만.
      /**
       * ★ **2P 를 켜도 레벨업은 하나다.** (2026-08-26, 사용자 지정 — 앞의 지정을 취소)
       *
       * 잠깐 "2P 특전" 으로 두 개를 주기로 했다가 취소됐다. 사람 수에 따라 레벨이
       * 달라지면 **한 스테이지에 한 칸** 이라는 눈금이 깨진다 —
       * 죽어도 레벨이 안 내려가게 바뀐 뒤로 그 눈금이 더 중요해졌다.
       */
      /**
       * ★ **1스테이지에는 하트가 없다.** (2026-08-27, 사용자 지정)
       *
       * *"하트가 너무 많으니 죽지 않고, 무적이 되는거 같아"*
       *
       * 하트는 **중간보스를 잡아야만** 나오고, 한 판에 하나뿐이며,
       * 첫 판에는 아예 없다. 시작할 때 셋을 들고 시작하므로 첫 판부터
       * 늘려 주면 죽는다는 감각이 아예 안 생긴다.
       */
      const giveHeart = !this.heartDropped && this.stage >= 2;
      this.heartDropped = true;
      this.items.push(new Item(e.x - 80, e.y, ITEM_KIND.POWER));
      /* 결투에서는 하트가 안 나온다 — 목숨이 늘면 300초 제한이 무의미해진다 */
      if(giveHeart && !this.duel) this.items.push(new Item(e.x + 80, e.y, ITEM_KIND.HEART));
      return;
    }
    if(e instanceof Boss){
      /* 사람 수와 무관하게 하나 — 나눠 먹으라고 두는 것이다 */
      this.items.push(new Item(e.x, e.y, ITEM_KIND.BOMB));
      return;
    }
    // 잡몹은 아이템을 떨구지 않는다. 적이 늘어난다고 아이템까지 늘면
    // 먹는 재미가 사라진다. 대신 가끔 황금동전 하나를 남긴다.
    /**
     * ★ **적을 잡으면 금화가 나온다.** (2026-08-26)
     *
     * 예전에는 네 마리에 한 닢이었다. 그런데 금화는 하늘에서 곡선으로 뿌려지는 것이
     * 대부분이라, **잘 잡는 것보다 돌아다니며 줍는 것이 훨씬 많이 벌렸다.**
     * 실측으로 안 움직이는 봇이 1,349, 동전만 쫓는 봇이 6,700 — 다섯 배다.
     * 그러면 아이템 값을 정할 기준이 없다.
     *
     * 두 마리에 한 닢으로 올려 **싸우는 것도 버는 길**로 만든다.
     */
    this.killStreak++;
    /* ★ 연쇄를 이어 붙인다. 끊기기 전에 다음을 잡으면 배수가 오른다 (기획 7) */
    this.chainT = CHAIN_HOLD;
    if(this.killStreak > this.chainBest) this.chainBest = this.killStreak;
    if(this.killStreak % 2 === 0) this.items.push(new Item(e.x, e.y, ITEM_KIND.COIN));
  }

  pickup(it, who){
    const p = who || this.p1;
    let msg = '';
    switch(it.kind){
      case ITEM_KIND.COIN: {
        p.coinChain = (p.coinT > 0) ? Math.min(COIN_CHAIN_MAX, p.coinChain + 1) : 1;
        p.coinT = COIN_WINDOW;
        /* 용왕의 관을 쓴 사람은 금화 점수가 조금 더 붙는다 (지갑 개수는 그대로) */
        const gain = Math.round(COIN_BASE * p.coinChain * (p.pid === 1 ? (1 + EQ.coinBonus) : 1));
        /**
         * ★ 난이도 배수 — 어려움이면 한 닢이 1.4 개다. (2026-08-26)
         * 소수를 쌓아 두고 정수가 될 때만 지갑에 넣는다 — 한 닢마다 반올림하면
         * 1.4 가 1 로 깎여서 배수가 통째로 사라진다.
         */
        RUN.coinFrac = (RUN.coinFrac || 0) + diffCoin();
        while(RUN.coinFrac >= 1){ RUN.coins++; RUN.coinFrac -= 1; }
        const got = this.addScore(gain, p.pid);
        /**
         * ★ **"+1000 x10" 이 무슨 뜻인지 아무도 몰랐다.** (2026-08-26, 사용자 지적)
         *
         * 금화는 **한 닢이 한 개**다. 늘 +1 이다.
         * 저 숫자는 금화 개수가 아니라 **점수**였고, `x10` 은 연속으로 주웠을 때
         * 붙는 배수였다(100점 x 연쇄 10 = 1000점). 개수와 점수가 한 줄에 섞여 있으니
         * "금화가 10개 들어왔나?" 로 읽힐 수밖에 없었다.
         *
         * 그래서 갈라 놓는다 — 위에 `금화 +1`, 아래에 `점수 +1000 (10연속)`.
         */
        Popups.add(it.x, it.y - 34, '금화 +1', '#ffd24a', 4, true);
        /* 화면에 뜨는 숫자는 **실제로 오른 점수**여야 한다 — 표와 어긋나면 안 된다 */
        if(got > 0)
          Popups.add(it.x, it.y - 6, '+' + got + (p.coinChain > 1 ? ' (' + p.coinChain + '연속)' : ''),
                     '#cfe6ff', 3, p.coinChain > 1);
        SND.sfx('coin');
        return;                                  // 동전은 안내 문구를 띄우지 않는다
      }
      /* ★ 무기 이름을 한글로 못박는다 — 이 게임에서 이것은 '핵무기' 다 (사용자 지정) */
      case ITEM_KIND.APPLE:   p.hp = Math.min(100, p.hp + 20); msg = '체력 +20'; break;
      case ITEM_KIND.HEART:   p.lives = Math.min(MAX_LIVES, p.lives + 1); msg = '하트 +1'; break;
      case ITEM_KIND.MISSILE:
        p.missileCount = Math.min(MAX_MISSILE, p.missileCount + 1);
        msg = p.missileCount >= MAX_MISSILE ? '미사일 가득' : '미사일 +1'; break;
      case ITEM_KIND.BOMB:
        p.bombCount = Math.min(MAX_BOMB, p.bombCount + 1);
        msg = p.bombCount >= MAX_BOMB ? '핵무기 가득' : '핵무기 +1'; break;
      case ITEM_KIND.POWER:
        msg = p.setLevel(p.level + 1) ? 'FIRE LV UP!' : 'MAX LEVEL';
        p.startFx('power', 0.8); break;
    }
    /* ★ 무엇을 먹었는지 몸짓으로 (2026-08-27) */
    if(it.kind === ITEM_KIND.APPLE || it.kind === ITEM_KIND.HEART) p.startFx('apple', 0.6);
    else if(it.kind === ITEM_KIND.MISSILE) p.startFx('eat', 0.5, 'missile');
    else if(it.kind === ITEM_KIND.BOMB)    p.startFx('eat', 0.5, 'bomb');
    this.addScore(50, p.pid, true);            // 아이템 줍기 (점수 눈금을 함께 탄다)
    SND.sfx(it.kind === ITEM_KIND.POWER ? 'levelup' : 'item');
    this.pickupMsg = (this.p2 ? (p.pid + 'P ') : '') + msg; this.pickupT = 1.2;
    Particles.spawn(it.x, it.y, 14, { spd:260, life:0.45, grav:-60,
      pal:['#ffffff','#ffe14a','#ffa32e','#ff7a1e'] });
  }

  /* 2P 난입 : WASD 를 누르면 상단에서 캐릭터를 고른다 */
  startJoin(){
    if(this.p2 || this.joining) return;
    this.joining = true; this.joinT = 0;
    /* 1P 와 다른 놈으로 시작하되, 산 것 중에서 고른다 */
    this.joinSel = 0;
    for(let n=1;n<=10;n++){
      const i = (Save.data.dragon + n) % DRAGONS.length;
      if(ownsDragon(i)){ this.joinSel = i; break; }
    }
    SND.sfx('confirm');
  }
  confirmJoin(){
    if(!ownsDragon(this.joinSel)){ SND.sfx('deny'); return; }
    this.joining = false;
    this.p2 = new Player(320, GAME_H/2 + 90, START_FIRE_LV, this.joinSel, 2);
    this.p2.lives = Math.max(1, this.p1.lives);      // 난입 시 1P 와 비슷한 잔기로 시작
    this.p2.missileCount = this.p1.missileCount;      // 난입 시 같은 수량으로 시작
    this.p2.bombCount = this.p1.bombCount;
    if(this.p1UsesKeys) this.stick.up(this.stick.pid);
    this.buildButtons();
    Popups.add(this.p2.x, this.p2.y - 90, '2P 참가!', P2_COLOR, 5, true);
    SND.sfx('levelup'); Flash.add(P2_COLOR, 0.2, 0.35);
  }

  setPause(on){
    if(on && this.state === 'play'){ this.state = 'pause'; this.stateT = 0; this.menuIdx = 0; this.stick.up(this.stick.pid); }
    else if(!on && this.state === 'pause'){ this.state = 'play'; this.stateT = 0; }
  }
  finish(kind, reason){
    if(this.state === 'clear' || this.state === 'over') return;
    this.state = kind; this.stateT = 0; this.endReason = reason || '';
    this.stick.up(this.stick.pid);
    /* 오락실에 기록을 올린다. 클리어든 게임오버든 한 판은 한 판이다.
       ★ 계정의 주인은 **1P** 다. 2P 는 같은 화면에 낀 손님이라 씬 합계를 보내면
       남이 번 점수까지 내 기록이 된다. */
    /**
     * ★★ **스테이지마다 보낸다. 금화는 차액만.** (2026-08-27, 사용자 신고)
     *
     * *"올클리어 30-40분 넘게 20판까지 다 깻는데 (...) 금화가 1도 늘어나지 않았어"*
     *
     * 이 함수는 **스테이지가 끝날 때마다** 불린다 — 20판을 깨면 스무 번이다.
     * 그런데 받는 쪽(`DragonGame.onFinish`)에 `if (settled) return` 한 줄이 있어서
     * **첫 번째만 통과**했다. 그래서 1스테이지에서 주운 것만 지갑에 들어가고
     * 2~20스테이지의 30분치가 통째로 버려졌다.
     * "1판만 하면 잘 수집된다" 던 것도 같은 이유다 — 1판은 첫 번째라서 통과한다.
     *
     * 래치를 떼는 것만으로는 안 된다. `RUN.coins` 는 **판 전체의 누적**이라
     * 그대로 스무 번 보내면 이번엔 금화가 스무 배로 불어난다.
     * **이미 넣은 만큼(`banked`)을 빼고 차액만** 보낸다.
     *
     * 스테이지마다 넣는 편이 판 끝에 한 번 몰아 넣는 것보다 낫다 —
     * 30분 하다 창을 닫아도 그때까지 번 것은 남는다.
     */
    const delta = Math.max(0, RUN.coins - RUN.banked);
    RUN.banked = RUN.coins;
    /* 게임오버·포기는 그 자체로 판의 끝이다 — 나갈 때 또 세지 않는다
       (금화는 바로 위에서 차액으로 이미 넣었다) */
    if(kind !== 'clear' || this.stage >= 20) this.runEnded = true;
    DG.onFinish({
      duel: !!this.duel,
      bosses: this.duelBossKills | 0,
      score: this.p1.score,
      total: this.score,
      stage: kind === 'clear' ? this.stage : Math.max(0, this.stage - 1),
      level: this.p1.level,
      coins: delta,
      cleared: kind === 'clear' && this.stage >= 20,
      /* 판이 계속되는가 — 판수(`dragonPlays`)는 진짜 끝났을 때만 센다 */
      midRun: kind === 'clear' && this.stage < 20,
    });
    /**
     * ★ **판이 진짜 끝났을 때만** 정산 애니메이션을 돌린다 (2026-08-27).
     * 스테이지마다 돌리면 스무 번을 보게 되고, 스무 번째에는 아무 감흥이 없다.
     */
    if(kind === 'over' || (kind === 'clear' && this.stage >= 20)){
      this.tallyT = 0; this.tallyCoins = []; this.tallyShown = 0;
    }
    if(kind === 'clear'){
      /* 결투는 남은 목숨으로 점수를 주지 않는다 — 겨루는 값은 오직 보스와 금화다 */
      /**
       * ★ **안 맞고 깨면 크게 준다.** (기획 10, 2026-08-27)
       *
       * 지금까지는 피하든 몸으로 밀든 결과가 같았다. 다섯 판을 무피격으로 깬
       * 사람과 겨우 살아 깬 사람이 같은 금화를 받으면 **잘하려는 이유가
       * 순위표밖에 없다.** 안 맞는 것에 값이 붙어야 피하는 것이 실력이 된다.
       *
       * 연속으로 이어 가면 더 준다 — 한 판 잘한 것보다 **계속 잘하는 것**이
       * 훨씬 어렵고 그래서 훨씬 값지다. 다섯 판에서 멈춘다(끝이 없으면 셈이 무너진다).
       *
       * 금화로도 준다 — 점수만 주면 순위표를 안 보는 사람에겐 없는 것과 같다.
       */
      this.noHit = !this.duel && this.stageHits === 0;
      if(this.noHit){
        RUN.noHitRun = (RUN.noHitRun || 0) + 1;
        const step = Math.min(5, RUN.noHitRun);
        this.noHitBonus = 15 * step;               // 점수 눈금(1/100)에 맞춘 값
        this.noHitCoin = 10 * step;
        RUN.coins += this.noHitCoin;
      }else{
        RUN.noHitRun = 0; this.noHitBonus = 0; this.noHitCoin = 0;
      }
      /* 시간 100/초 · 목숨 500 이던 것을 눈금에 맞춰 1/5 로 (2026-08-27) */
      this.bonus = this.duel ? 0
        : Math.round(this.timeLeft) * 1 + this.totalLives() * 5 + this.noHitBonus;
      const alive = this.players();
      if(alive.length){
        const each = Math.round(this.bonus / alive.length);
        for(const p of alive) p.score += each;
      }
      this.score += this.bonus;   // 보너스는 이미 눈금에 맞춘 값이다
      for(const p of this.allPlayers()) if(!p.out) p.lives = Math.min(MAX_LIVES, p.lives + 1);
      SND.sfx('fanfare');
      Save.data.unlocked = Math.max(Save.data.unlocked, Math.min(20, this.stage + 1));
      // 클리어 보너스로 레벨을 주지 않는다.
      // 파이어 레벨은 오직 중간보스가 떨어뜨리는 LvUp 으로만 오른다.
      this.levelUpReward = false;
    }else{
      SND.sfx('gameover');
      // 파이어 레벨은 저장하지 않는다. 나가면 무조건 Lv1 부터 다시.

    }
    if(this.score > (Save.data.best[this.stage] || 0)) Save.data.best[this.stage] = this.score;
    Save.save();
  }
  /** 일시정지 메뉴. 라벨은 화면에 그대로 나가는 한글이다 */
  pauseItems(){
    return this.p2
      ? [{ k:'resume', t:'계속하기' }, { k:'leave2p', t:'2인 플레이 종료' }, { k:'quit', t:'게임 포기' }]
      : [{ k:'resume', t:'계속하기' }, { k:'quit', t:'게임 포기' }];
  }
  /** 메뉴 한 줄이 차지하는 사각형 — 그리기와 터치 판정이 **같은 값**을 쓴다 */
  /**
   * ★ 박스를 키우고 사이를 벌렸다. (2026-08-27, 사용자 지적)
   * 예전에는 높이 56 인데 글자를 배율 5 로 그려 **위아래로 박스를 뚫고 나왔고**,
   * 간격 74 라 두 박스가 거의 붙어 있었다.
   */
  pauseRect(i){
    const w = Math.min(440, UIW - 60), h = 74;
    return { x: (UIW - w)/2, y: Math.round(UIH*0.46) + i*92, w, h };
  }
  /** 화면 좌표로 눌린 메뉴를 찾는다 (없으면 -1) */
  pauseHit(x, y){
    const n = this.pauseItems().length;
    for(let i=0;i<n;i++){
      const r = this.pauseRect(i);
      if(x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }
  doPausePick(){
    const pick = this.pauseItems()[this.menuIdx];
    if(!pick) return;
    if(pick.k === 'resume'){ SND.sfx('confirm'); this.setPause(false); }
    else if(pick.k === 'leave2p'){ this.leave2P(); this.menuIdx = 0; this.setPause(false); }
    else { SND.sfx('deny'); this.giveUp(); }
  }
  /**
   * ★ **게임 포기도 한 판이다.** (2026-08-26, 사용자 지정)
   *
   * 예전에는 그냥 로비로 나가서 **그때까지 먹은 금화도 점수도 전부 사라졌다.**
   * 잠깐 하다 나가면 아무것도 안 남으니 짧게 할 이유가 없어진다.
   * 죽은 것과 똑같이 기록하고 나간다.
   */
  giveUp(){
    this.finish('over', '게임 포기');
    DG.onExit();
  }
  /**
   * ★ **판이 여기서 끝난다고 알린다.** (2026-08-27)
   *
   * `finish('clear')` 는 스테이지마다 불리므로 `midRun` 을 달고 나간다 —
   * 그래야 판수(`dragonPlays`)가 스무 번 세지 않는다. 그런데 클리어 화면에서
   * **다음 판으로 안 가고 나가면** 그 판은 영영 안 세진다.
   * 나가는 그 순간에 한 번만 더 알린다. 금화는 0 이다 —
   * 이미 스테이지마다 차액으로 다 넣었다.
   */
  /**
   * ★★ **어느 문으로 나가든 여기를 지난다.** (2026-08-27, 사용자 신고)
   *
   * *"보유금화가 안올라가는 오류가 있어 (...) 금화들이 어디로 사라진건지 알 수 없다"*
   *
   * 금화는 스테이지가 끝날 때마다 넣는다. 그런데 **나가는 길이 여러 개**다 —
   * ESC · 안드로이드 뒤로가기 · 세로 화면 안내의 [게임 포기하고 나가기] ·
   * 그리고 창을 그냥 닫는 것. 그중 `finish()` 를 안 거치는 길로 나가면
   * **그 스테이지에서 주운 금화가 통째로 사라진다.**
   *
   * 그래서 여기서 **남은 차액까지 마저 넣는다.** 이미 넣은 만큼(`banked`)을
   * 빼고 보내므로 두 번 들어가지 않는다.
   */
  endRun(){
    if(this.duel || this.runEnded) return;
    this.runEnded = true;
    const delta = Math.max(0, RUN.coins - RUN.banked);
    RUN.banked = RUN.coins;
    DG.onFinish({
      duel: false, bosses: 0,
      score: this.p1.score, total: this.score,
      stage: this.state === 'clear' ? this.stage : Math.max(0, this.stage - 1),
      level: this.p1.level,
      coins: delta,             // 아직 안 넣은 것이 있으면 여기서 넣는다
      cleared: this.state === 'clear' && this.stage >= 20,
      midRun: false,
    });
  }
  updatePaused(dt){
    this.stateT += dt;
    const tap = this.uiTap; this.uiTap = false;
    const n = this.pauseItems().length;
    if(Input.pressed('up'))   this.menuIdx = (this.menuIdx + n - 1) % n;
    if(Input.pressed('down')) this.menuIdx = (this.menuIdx + 1) % n;
    if(Input.pressed('pause')){ SND.sfx('confirm'); this.setPause(false); return; }
    /* 터치는 **누른 자리**의 항목을 고른다. 예전에는 아무 데나 눌러도
       그때 선택돼 있던 항목이 실행돼서, 키보드 없는 사람은 나갈 수가 없었다. */
    if(tap && this.tapIdx >= 0){ this.menuIdx = this.tapIdx; this.tapIdx = -1; this.doPausePick(); return; }
    if(Input.pressed('confirm')) this.doPausePick();
  }
  /* 다음 스테이지로 그대로 넘길 상태 */
  /* 점수는 씬 합계와 플레이어별로 같이 쌓는다 */
  /**
   * 이 판의 규칙을 굴린다. 규칙마다 **한 가지만** 한다 —
   * 하나가 두 가지 일을 하면 무엇 때문에 죽었는지 알 수가 없다.
   */
  updateRule(dt){
    const r = this.rule;
    if(!r) return;
    if(r === 'gale'){
      /* 맞바람 — 가만히 있으면 뒤로 밀린다. 계속 앞으로 눌러야 한다 */
      for(const p of this.livePlayers()) p.x = Math.max(40, p.x - 86*dt);
    }else if(r === 'rocks'){
      /* 낙석 — 오른쪽에서 굴러온다. 부술 수 없고 피하기만 한다 */
      this.boltT -= dt;
      if(this.boltT <= 0){
        this.boltT = 1.5 + Math.random()*1.2;
        this.rocks.push({ x: GAME_W + 60, y: 120 + Math.random()*(GAME_H - 260),
                          r: 26 + Math.random()*22, v: 300 + Math.random()*180, t: 0 });
      }
      for(const k of this.rocks){ k.x -= k.v*dt; k.t += dt; }
      this.rocks = this.rocks.filter(k => k.x > -80);
    }else if(r === 'bolt'){
      /* 번개 — 세로 줄기가 떨어진다. 떨어지기 전에 자리가 번쩍여 예고한다 */
      this.boltT -= dt;
      if(this.boltT <= 0){
        this.boltT = 2.6 + Math.random()*1.6;
        const p = this.livePlayers()[0];
        this.rocks.push({ bolt:true, x: (p ? p.x : 400) + (Math.random()-0.5)*160,
                          y:0, r:0, v:0, t:-0.65 });   // 음수 = 예고 시간
      }
      for(const k of this.rocks) k.t += dt;
      this.rocks = this.rocks.filter(k => k.t < 0.5);
    }else if(r === 'swarm'){
      /* 벌떼는 물량으로 간다 — 디렉터가 알아서 본다 (enemyScale) */
    }
  }
  /**
   * ★★ **빵 터져서 죽는다.** (2026-08-27, 사용자 지정)
   *
   * *"현재 액션이 에니메이션 효과가 너무 심심해, 조금더 화려하게 폭발해서
   *   죽었으면 좋겠어, 빵 터져서 죽는 것 같은 느낌으로"*
   *
   * 폭발 하나로는 "맞았다" 로 읽힌다. **터지는 것에도 순서가 있어야** 큰 사고로
   * 보인다 — 흰 섬광으로 한 번 멎었다가, 가운데가 크게 터지고, 그 둘레로
   * 여덟 방향의 작은 폭발이 **시차를 두고** 번지고, 파편과 불티가 흩어진다.
   *
   * 하트를 하나 잃든 마지막 하나가 없어지든 **같은 연출**이다 (사용자 지정) —
   * 죽는 것은 죽는 것이고, 마지막이라고 더 초라할 이유가 없다.
   */
  playerDeathFx(p){
    Shake.add(30, 1.1);
    Freeze.add(0.14);                                   // 한 박자 멎는다
    Flash.add('#ffffff', 0.08, 0.18);                   // 흰 섬광
    Flash.add('#ff6a4a', 0.22, 0.40);                   // 이어서 붉게 물든다
    /* 가운데 큰 불덩이 + 겹치는 두 겹 */
    this.booms.push(new Boom(p.x, p.y, 210, 0.85));
    this.booms.push(new Boom(p.x, p.y, 130, 0.55));
    /* 둘레로 번지는 여덟 방향 — `delay` 대신 시차를 반지름으로 준다 */
    for(let i=0;i<8;i++){
      const a = i*Math.PI/4 + 0.3;
      const d = 52 + (i % 3)*26;
      this.booms.push(new Boom(p.x + Math.cos(a)*d, p.y + Math.sin(a)*d,
                               70 + (i % 3)*22, 0.5 + (i % 4)*0.09));
    }
    /* 충격파 세 겹 — 크기와 속도를 달리해 퍼지는 결이 보이게 */
    this.waves.push(new Shockwave(p.x, p.y, 240, 0.34));
    this.waves.push(new Shockwave(p.x, p.y, 400, 0.52));
    this.waves.push(new Shockwave(p.x, p.y, 560, 0.72));
    /* 불티 · 파편 · 재 */
    Particles.spawn(p.x, p.y, 90, { spd:760, life:1.1 });
    Particles.spawn(p.x, p.y, 34, { spd:520, life:1.4, grav:900, size:PX*2,
      pal:['#ffe6c0','#ff9a5a','#c4343a','#5c1520'] });
    Particles.spawn(p.x, p.y, 26, { spd:300, life:1.6, grav:-40, size:PX,
      pal:['#ffffff','#ffd8a0','#8a8a96','#3a3a44'] });
    SND.sfx('boomL'); SND.sfx('nuke');
    Input.rumble(1.0, 0.9, 500);
  }
  /**
   * 금화가 터져 쏟아진다. 숫자 **뒤에서** 튀어나와 화면을 채운다 —
   * 앞에서 쏟아지면 정작 봐야 할 숫자를 가린다.
   */
  burstCoins(){
    for(let i=0;i<90;i++){
      const a = -Math.PI/2 + (Math.random() - 0.5) * 2.4;
      const sp = 420 + Math.random()*680;
      this.tallyCoins.push({
        x: 640 + (Math.random()-0.5)*220, y: 360 + (Math.random()-0.5)*90,
        vx: Math.cos(a)*sp, vy: Math.sin(a)*sp,
        r: 10 + Math.random()*9, t: -Math.random()*0.22, ph: Math.random()*7,
      });
    }
    Shake.add(16, 0.5);
    Flash.add(PAL.gold, 0.10, 0.22);
    SND.sfx('coin'); SND.sfx('fanfare');
  }
  /** 지금 연쇄 배수 (1.0 ~ CHAIN_MAX). 세 마리째부터 붙는다 */
  chainMul(){
    if(this.chainT <= 0 || this.killStreak < 3) return 1;
    return Math.min(CHAIN_MAX, 1 + (this.killStreak - 2) * 0.06);
  }
  /**
   * @param raw 참이면 배수를 안 먹인다 (스침·보너스처럼 이미 정해진 값)
   *
   * ★ 연쇄 배수는 **적을 잡아 버는 점수에만** 곱한다 (기획 7).
   * 스침 점수에까지 곱하면 탄 많은 판에서 숫자가 통제 불능으로 커진다.
   */
  /**
   * ★★ **점수를 100분의 1로.** (2026-08-27, 사용자 지정)
   *
   * *"점수가 너무 말도 안됨 (...) 1게임에 1만점, 20게임 20만점, 이정도가
   *   현실적이지 않아? (...) 랩 10정도만 가도 999,999 채워지는데 그게 뭐야"*
   *
   * 상한이 999,999 인데 열 판이면 찼다. 그러면 **최고점을 노리는 재미가 통째로
   * 사라진다** — 이미 만점이니 더 잘할 이유가 없다.
   *
   * 값을 하나하나 고치는 대신 **점수가 지나가는 이 한 곳**에서 나눈다.
   * 다만 그냥 나누면 좀비 한 마리(100점)가 1점이 되고 반올림에서 자꾸 깎인다 —
   * 소수를 쌓아 두고 정수가 될 때만 더한다(금화와 같은 방법).
   *
   * @returns 이번에 실제로 오른 점수 (팝업이 이 값을 띄운다 — 화면과 표가 어긋나면 안 된다)
   */
  addScore(v, pid, raw){
    const before = this.score;
    this.scoreFrac = (this.scoreFrac || 0) + (raw ? v : v * this.chainMul()) / SCORE_DIV;
    const whole = Math.floor(this.scoreFrac);
    this.scoreFrac -= whole;
    this.score += whole;
    const p = pid === 2 ? this.p2 : (pid === 1 ? this.p1 : null);
    if(p) p.score += whole;
    return this.score - before;
  }
  makeCarry(){
    return {
      score: this.score,
      p1UsesKeys: this.p1UsesKeys,
      players: this.allPlayers().filter(p => !p.out).map(p => ({
        pid: p.pid, dragonIdx: p.dragonIdx, level: p.level,
        lives: p.lives, hp: p.hp, score: p.score,
        missileCount: p.missileCount, bombCount: p.bombCount
      }))
    };
  }
  endItems(){
    /* 결투는 한 판으로 끝난다 — 이어서 갈 스테이지도, 다시 할 것도 없다 */
    if(this.duel) return [{ k:'quit', t:'결과 보기' }];
    /**
     * ★ **언제나 버튼 셋.** (2026-08-27, 사용자 지정)
     *
     * 예전에는 이어하기를 살 수 있을 때만 보여 줘서 버튼 개수가 둘이었다 셋이었다
     * 했다. 자리가 흔들리면 **누르려던 것이 다른 것으로 바뀐다.**
     * 못 사면 흐리게 두고 눌러도 안 되게 한다 — "금화가 있으면 이어할 수 있다" 는
     * 것 자체가 알려 줄 값어치가 있다.
     */
    if(this.state !== 'clear'){
      const canCont = this.continuesUsed < CONTINUE_MAX && DG.coins() >= CONTINUE_COST;
      return [
        { k:'continue2', t:'이어하기 (금화 ' + CONTINUE_COST + ')', off: !canCont },
        { k:'retry', t:'처음부터 다시' },
        { k:'quit', t:'게임 종료' },
      ];
    }
    return this.stage < 20
      ? [{ k:'continue', t:'다음 스테이지' }, { k:'retry', t:'처음부터 다시' }, { k:'quit', t:'게임 종료' }]
      : [{ k:'retry', t:'처음부터 다시' }, { k:'quit', t:'게임 종료' }];
  }
  /**
   * 결과 화면 버튼 자리 — 그리기와 터치가 같은 값을 쓴다.
   *
   * ★ **개수를 세어 나눈다.** (2026-08-26, 사용자 지적)
   * 예전에는 `i === 0 ? 420 : 860` 이라 **한 개나 두 개일 때만** 맞았다.
   * 이어하기가 생겨 세 개가 되자 2번과 3번이 **같은 자리에 겹쳐** 그려졌다 —
   * 글자 위에 글자가 찍히니 덕지덕지로 보일 수밖에 없다.
   */
  /**
   * ★ **박스를 키웠다.** (2026-08-27, 사용자 지적)
   * 296x52 는 `이어하기 (금화 500)` 이 좌우로 뚫고 나오는 크기였다.
   * 글자는 `koFitBox` 가 알아서 맞추지만, 박스 자체가 작으면 글자가 너무 작아진다.
   */
  /**
   * ★★ **아래쪽 자리를 표 길이에서 뽑는다.** (2026-08-27)
   *
   * 예전에는 버튼 y 가 상수(512)였다. 그런데 표는 줄 수가 다섯일 때도 여섯일 때도
   * 있고(무피격 보너스가 붙으면 한 줄 는다), "갈까요?" 문구가 버튼 크기로 커지면서
   * **여섯 줄일 때 문구와 표가 겹쳤다.** 자리를 손으로 박아 두면 이런 것이 계속 난다.
   *
   * 표가 끝나는 곳 → 묻는 말 → 버튼 → 안내 순서로 **밀어서** 잡는다.
   */
  /**
   * 표가 끝나는 줄(가로줄) 아래로 **30px 을 더 띄운다.** (2026-08-27, 사용자 지정)
   * *"획득금화 아래로 30px정도 여백을 만들라고"*
   * 아래 것들(묻는 말·버튼·안내)이 전부 이 값에서 나오므로 여기만 바꾸면 된다.
   */
  /**
   * 전체화면 단추 자리.
   *
   * ★ **2P 가 들어오면 왼쪽으로 비킨다.** (2026-08-27, 사용자 지정)
   * 2인이 되면 1P 패널이 오른쪽 위로 옮겨 온다(`GAME_W - 240`).
   * 그 자리에 단추가 그대로 있으면 점수 위에 겹친다.
   */
  fsRect(){
    const s = FS_BTN.size, p = FS_BTN.pad;
    return { x: this.p2 ? (UIW - 240 - s - 12) : (UIW - s - p), y: p, w: s, h: s };
  }
  endRowGap(){ return (this.endRows || 5) >= 7 ? END_ROW_GAP_TIGHT : END_ROW_GAP; }
  endTableBottom(){ return END_ROW_Y + ((this.endRows || 5) - 1)*this.endRowGap() + 34 + 30; }
  endAskY(){ return this.endTableBottom() + 26; }
  endBtnY(){
    const ask = this.state === 'clear' && this.stage < 20;
    return Math.round(this.endTableBottom() + (ask ? 84 : 44));
  }
  endHintY(){ return this.endBtnY() + 74 + 30; }
  endRect(i){
    const n = this.endItems().length;
    /* 세로에서는 폭이 720 뿐이라 셋을 나란히 못 세운다 — 세로로 쌓는다 */
    const h = 74;
    if(UIW < 900){
      const w = Math.min(440, UIW - 60), gap = 12;
      return { x: Math.round(UIW/2 - w/2), y: this.endBtnY() + i*(h + gap), w, h };
    }
    const gap = 20, w = n >= 3 ? 384 : 340;
    const total = n*w + (n - 1)*gap;
    return { x: Math.round(UIW/2 - total/2 + i*(w + gap)), y: this.endBtnY(), w, h };
  }
  endHit(px, py){
    for(let i=0;i<this.endItems().length;i++){
      const r = this.endRect(i);
      if(px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
    }
    return -1;
  }
  doEndPick(){
    const pick = (this.endItems()[this.endIdx] || {}).k;
    if(pick === 'continue2'){
      /**
       * 죽은 그 스테이지를 다시 연다. 지금까지 번 금화·점수는 그대로 들고 간다 —
       * 이어하기는 "판을 사는" 것이지 "처음부터"가 아니다.
       */
      /**
       * ★ **넘어가는 것이 확실할 때만 값을 치른다.**
       * `change` 는 전환 중이면 씬을 버린다. 금화를 먼저 빼면 그때 **증발**한다.
       */
      if(this.mgr.busy) return;
      if(this.continuesUsed >= CONTINUE_MAX || DG.coins() < CONTINUE_COST){ SND.sfx('deny'); return; }
      if(!DG.spendCoins(CONTINUE_COST)){ SND.sfx('deny'); return; }
      /**
       * carry 는 이미 있는 모양을 그대로 쓴다(`makeCarry`) — 형식을 새로 만들면
       * 이어받는 자리가 두 갈래가 되고, 한쪽만 고치는 사고가 난다.
       * 다만 **부활 조건은 컨티뉴답게** 다시 매긴다: 하트 셋, 화력 1, 무기 기본.
       */
      const carry = {
        players: [{
          pid: 1, dragonIdx: this.p1.dragonIdx, level: START_FIRE_LV,
          lives: 3, hp: 100, score: this.p1.score,
          missileCount: EQ.startMissiles, bombCount: EQ.startBombs,
        }],
        score: this.score,
        p1UsesKeys: this.p1UsesKeys,
        continues: this.continuesUsed + 1,
      };
      if(!this.mgr.change(new GameScene(this.stage, carry))){
        DG.addCoins(CONTINUE_COST);          // 못 넘어갔으면 돌려준다 (여기로 오면 안 되지만)
        SND.sfx('deny'); return;
      }
      SND.sfx('levelup');
      return;
    }
    if(pick === 'continue'){
      SND.sfx('confirm');
      this.mgr.change(new GameScene(this.stage + 1, this.makeCarry()));
    }else if(pick === 'retry'){
      /* 스테이지 선택을 없앴으므로 다시하기는 언제나 1스테이지부터다.
         죽으면 처음부터 — 그게 이 게임의 한 판이다. */
      SND.sfx('confirm');
      this.mgr.change(new GameScene(1));
    }else{
      this.endRun();            // 여기서 판이 끝난다 — 판수를 센다
      DG.onExit();
    }
  }
  updateEnd(dt){
    this.stateT += dt;
    if(this.tallyT >= 0){
      const was = this.tallyT;
      this.tallyT += dt;
      /* ⑥ 다 오른 순간 금화가 터진다 */
      if(was < TALLY.boom[0] && this.tallyT >= TALLY.boom[0]) this.burstCoins();
      /**
       * ★ **끝나도 동전은 안 멈춘다.** (2026-08-27, 사용자 지정)
       * *"게임 오버 상태에서 하단에 금화랑 동전이 계속 멈추지 않고 떨어지고
       *   동전이 구르고 계속 동전 터지는 애니메이션이 멈추지 않고 계속"*
       *
       * 위에서 계속 떨어뜨리고, 이따금 아래에서 작게 터뜨린다.
       * 바닥에 닿은 것은 튀었다가 **굴러간다** — 굴러가는 것이 있어야 화면이 산다.
       */
      if(this.tallyT >= TALLY.boom[0]){
        this.rainT = (this.rainT || 0) - dt;
        if(this.rainT <= 0){
          this.rainT = 0.09;
          for(let i=0;i<2;i++) this.tallyCoins.push({
            x: Math.random()*GAME_W, y: -30,
            vx: (Math.random()-0.5)*90, vy: 120 + Math.random()*220,
            r: 9 + Math.random()*8, t: 0, ph: Math.random()*7, roll: 0,
          });
        }
        this.popT = (this.popT || 0) - dt;
        if(this.popT <= 0){
          this.popT = 0.55 + Math.random()*0.5;
          const bx = 120 + Math.random()*(GAME_W - 240);
          for(let i=0;i<14;i++){
            const a = -Math.PI/2 + (Math.random()-0.5)*1.9;
            const sp = 300 + Math.random()*380;
            this.tallyCoins.push({ x: bx, y: GAME_H - 20,
              vx: Math.cos(a)*sp, vy: Math.sin(a)*sp,
              r: 8 + Math.random()*7, t: 0, ph: Math.random()*7, roll: 0 });
          }
          SND.sfx('coin');
        }
      }
      for(const c of this.tallyCoins){
        c.vy += 1400*dt; c.x += c.vx*dt; c.y += c.vy*dt; c.t += dt;
        c.roll = (c.roll || 0) + Math.abs(c.vx)*dt*0.05;
        if(c.y > GAME_H - 30 && c.vy > 0){
          c.y = GAME_H - 30; c.vy *= -0.42;
          /* 바닥에서는 구른다 — 멈추면 죽은 화면이 된다 */
          if(Math.abs(c.vy) < 90){ c.vy = 0; c.vx = (c.vx || 1) * 0.98 + (Math.random()-0.5)*20; }
          else c.vx *= 0.8;
        }
      }
      /* 화면 밖으로 나갔거나 아주 오래된 것만 치운다 */
      this.tallyCoins = this.tallyCoins.filter(c => c.t < 9 && c.x > -60 && c.x < GAME_W + 60);
      if(this.tallyCoins.length > 260) this.tallyCoins.splice(0, this.tallyCoins.length - 260);
    }
    for(const b of this.booms) b.update(dt);
    Particles.update(dt); Popups.update(dt); Flash.update(dt); Shake.update(dt);
    this.booms = this.booms.filter(o => !o.dead);
    if(this.bossDeathT > 0){
      this.bossDeathT -= dt;
      if(Math.random() < 0.5){
        this.booms.push(new Boom(this.bossDeathX + (Math.random()-0.5)*240,
                                 this.bossDeathY + (Math.random()-0.5)*200, 30 + Math.random()*46, 0.4));
        Shake.add(6, 0.12);
      }
    }
    const tap = this.uiTap; this.uiTap = false;
    if(this.stateT < 1.0) return;
    const n = this.endItems().length;
    if(tap && this.tapIdx >= 0){ this.endIdx = this.tapIdx; this.tapIdx = -1; this.doEndPick(); return; }
    if(Input.pressed('up') || Input.pressed('left') || Input.pressed('p2left'))
      { this.endIdx = (this.endIdx + n - 1) % n; SND.sfx('blip'); }
    if(Input.pressed('down') || Input.pressed('right') || Input.pressed('p2right'))
      { this.endIdx = (this.endIdx + 1) % n; SND.sfx('blip'); }
    if(Input.pressed('confirm') || tap
       || Input.pressed('p1missile') || Input.pressed('p2missile')) this.doEndPick();
  }

  /* 플레이어 1명분의 이동 / 발사 / 무기 */
  updatePlayer(p, dt){
    let mv;
    if(p.pid === 1){
      const kv = Input.moveVectorFor(1);
      if(kv.x || kv.y) this.p1UsesKeys = true;          // 방향키를 쓰면 스틱을 감춘다
      const sv = this.stickVisible() ? this.stick.vector() : {x:0,y:0};
      mv = (sv.x || sv.y) ? sv : kv;
      /**
       * ★ **잡아 끄는 것은 '이동 방법' 일 뿐이다.** (2026-08-26, 사용자 지적)
       *
       * 처음엔 여기서 `return` 해 버렸다 — 그래서 손가락을 대고 있는 동안
       * **불도 안 나가고 무기도 안 먹혔다.** 게임이 멈춘 것처럼 보였다.
       *
       * 잡기가 바꾸는 것은 **자리를 어떻게 정하느냐** 하나뿐이다.
       * 발사·무기·무적시간·쉴드·콤보는 키보드로 놀 때와 **완전히 똑같이** 돌아야 하고,
       * 적과 부딪히면 당연히 아파야 한다. `grabbed` 는 가속 계산만 건너뛰게 한다.
       */
      if(this.dragId !== null || this.followMouse){ this.dragT += dt; mv = { x:0, y:0, grabbed:true }; }
    }else{
      mv = Input.moveVectorFor(2);
    }
    /**
     * ★ **죽어 있는 동안.** (2026-08-27)
     * 움직이지도 쏘지도 않는다. 시간이 다 되면 **가운데 왼쪽**에서 되살아난다 —
     * 죽은 그 자리는 대개 위험한 자리라 거기서 살아나면 또 죽는다.
     */
    if(p.deadT > 0){
      p.deadT -= dt;
      if(p.deadT <= 0){
        p.deadT = 0;
        p.x = 320; p.y = GAME_H/2; p.vx = 0; p.vy = 0;
        p.hp = 100;
        p.hurtT = RESPAWN_GRACE;            // 이 동안은 맞아도 안 깎인다
        p.fireT = 0;
        Particles.spawn(p.x, p.y, 26, { spd:300, life:0.5,
          pal:['#ffffff','#cfe8ff','#7fb8ff','#3f6fae'] });
        SND.sfx('levelup');
      }
      return;
    }
    p.update(dt, mv);
    if(p.hurtT > 0) p.hurtT -= dt;
    if(p.hitT > 0) p.hitT -= dt;
    if(p.rollT > 0) p.rollT -= dt;
    if(p.fxT > 0){ p.fxT -= dt; if(p.fxT <= 0){ p.fxKind = ''; p.fxItem = ''; } }
    if(p.shieldT > 0){
      p.shieldT -= dt;
      for(const h of p.shieldHits) h.t += dt;
      if(p.shieldHits.length) p.shieldHits = p.shieldHits.filter(h => h.t < 0.35);
      if(p.shieldT <= 0){ p.shieldT = 0; p.shieldHits.length = 0; SND.sfx('deny'); }
    }
    if(p.comboT > 0) p.comboT -= dt;
    if(p.coinT > 0){ p.coinT -= dt; if(p.coinT <= 0) p.coinChain = 0; }

    // 파이어 블레스 (자동 연사)
    const c = FIRE[p.level];
    p.fireT -= dt;
    if(p.fireT <= 0){
      p.fireT += fireGap(p.level);
      const m = p.muzzle;
      this.bolts.push(new FireBolt(m.x, m.y, 0, p.level, p.pid));
      Particles.spawn(m.x, m.y, 2, { ang:0, spread:0.9, spd:210, life:0.16, grav:0, drag:5 });
      p.mawT = Math.max(p.mawT, 0.22);      // 불을 뿜는 동안은 반드시 벌린다
      SND.sfx('fire', p.level);
    }

    // 무기 입력
    const pre = 'p' + p.pid;
    const btnM = p.pid === 1 ? this.btnMsl : this.btnMsl2;
    const btnB = p.pid === 1 ? this.btnBomb : this.btnBomb2;
    const wantMsl  = Input.pressed(pre+'missile') || (btnM && btnM.consume());
    const wantBomb = Input.pressed(pre+'bomb')    || (btnB && btnB.consume());
    // 자기 필살기 연출 중에만 막는다. 예전엔 전역이라 1P 가 쓰면 2P 가 2초 넘게 아무것도 못 했다.
    const busyFx = this.roars.some(r => r.owner === p);

    /* ★ 연발 제한 (2026-08-27) — 남은 쿨다운을 먼저 센다 */
    if(p.mslCool > 0) p.mslCool -= dt;
    if(p.bombCool > 0) p.bombCool -= dt;
    if(p.burstT > 0){ p.burstT -= dt; if(p.burstT <= 0) p.burstN = 0; }

    if(wantMsl && p.mslCool > 0 && p.missileCount > 0 && !busyFx){
      /* 쉬는 중에 누르면 왜 안 나가는지 알려 준다 — 말이 없으면 고장인 줄 안다 */
      Popups.add(p.x, p.y - 110, '미사일 연발은 ' + MISSILE_BURST + '번만 가능', '#ff9a5a', 4, true);
      SND.sfx('deny');
    }else if(wantMsl && p.missileCount > 0 && !busyFx){
      p.missileCount--;
      /* 두 번까지 연달아. 세 번째부터 막고 쉰다 */
      p.burstN = (p.burstT > 0 ? p.burstN : 0) + 1;
      p.burstT = MISSILE.COMBO_WINDOW;
      if(p.burstN >= MISSILE_BURST){ p.mslCool = MISSILE_COOL; p.burstN = 0; p.burstT = 0; }
      p.combo = (p.comboT > 0) ? Math.min(MISSILE.MAX_COMBO, p.combo + 1) : 1;
      p.comboT = MISSILE.COMBO_WINDOW;
      const n = p.combo * 3;
      const m = p.muzzle;
      const tg = pickTargets(this, m.x, m.y, n);
      const dmg = missileDamageOf(this.stage, p.level);
      for(let i=0;i<n;i++)
        this.pmissiles.push(Object.assign(
          new PlayerMissile(m.x, m.y, tg[i], dmg, i*0.045, (i % 2) ? 1 : -1), { pid: p.pid }));
      Particles.spawn(m.x, m.y, 14, { ang:0, spread:2.2, spd:520, life:0.36, size:PX*2 });
      Shake.add(7, 0.15);
      /**
       * ★ 쏘면서 한 바퀴 — 이 동안 안 맞는다.
       * **연발의 첫 발에만** 붙는다 (`burstN === 1`). 두 발째는 그냥 미사일이다.
       */
      if(p.burstN === 1 || p.burstN === 0){
        p.rollT = ROLL_TIME;
        Particles.spawn(p.x, p.y, 16, { spd:360, life:0.5,
          pal:['#ffffff','#cfe8ff','#7fb8ff','#3f6fae'] });
        SND.sfx('shield');
      }
      SND.sfx('missile'); Input.rumble(0.35, 0.25, 120);
    }
    if(wantBomb && p.bombCool > 0 && p.bombCount > 0 && !busyFx){
      Popups.add(p.x, p.y - 110,
        '다음 핵 버튼은 ' + Math.ceil(p.bombCool) + '초 후에 사용가능', '#ff9a5a', 4, true);
      SND.sfx('deny');
    }else if(wantBomb && p.bombCount > 0 && !busyFx){
      p.bombCount--;
      p.bombCool = BOMB_COOL;                  // 15초 동안 다시 못 쓴다
      p.shieldT = SHIELD_TIME; p.shieldHits.length = 0;   // 10초 무적 쉴드
      p.hurtT = 0;
      this.roars.push(new DragonRoar(this, p));
      Popups.add(p.x, p.y - 100, '쉴드 ' + SHIELD_TIME + '초', '#6ec8ff', 4, true);
      SND.sfx('nuke'); SND.sfx('shield'); Input.rumble(1.0, 1.0, 1200);
    }
  }

  update(dt){
    this.lastDt = dt;                 // 끌기가 속도를 되계산할 때 쓴다
    if(this.state === 'pause'){ this.updatePaused(dt); return; }
    if(this.state !== 'play'){ this.updateEnd(dt); return; }
    if(Freeze.t > 0){ Freeze.t -= dt; Flash.update(dt); return; }

    this.t += dt;
    if(this.duel){
      /* 결투는 시계가 멈추지 않는다 — 300초가 곧 한 판이다 */
      this.timeLeft -= dt;
      if(this.timeLeft <= 0){ this.timeLeft = 0; this.finish('clear', '시간 종료'); return; }
      /* 오락실에 지금 상황을 알린다 (상대 화면의 숫자가 여기서 움직인다) */
      this.duelPushT = (this.duelPushT ?? 0) - dt;
      if(this.duelPushT <= 0){
        this.duelPushT = 1.0;
        DG.onProgress({ score: this.p1.score, coins: RUN.coins,
                        bosses: this.duelBossKills, alive: !this.p1.out,
                        timeLeft: Math.max(0, Math.round(this.timeLeft)) });
      }
    }else{
      // 중간보스가 등장하기 전까지만 시간이 흐른다.
      // 보스전까지 90초로 묶으면 고스테이지에서 물리적으로 못 깬다.
      if(!this.director.midSpawned){
        this.timeLeft -= dt;
        if(this.timeLeft <= 0){ this.timeLeft = 0; this.finish('over', 'TIME UP'); return; }
      }
    }
    /**
     * ★ **결투는 보스를 잡았다고 안 끝난다.** (2026-08-26 F단계)
     * 사다리의 짝수 번째가 최종보스형이라 두 번째 보스를 무너뜨리는 순간
     * `finalBossKilled` 가 서서 **41초 만에 판이 끝났다.** 결투를 끝내는 것은
     * 오직 300초와 목숨 다섯뿐이다.
     */
    /**
     * ★ **최종보스를 잡고 나서 2초를 더 준다.** (2026-08-27, 사용자 지정)
     *
     * *"최종 보스 죽고 나면 바로 종료 되는데 눈에 보이는 금화 먹을시간 2초정도"*
     *
     * 보스가 터지면서 금화가 우수수 떨어지는데 그 순간 판이 끝나 버렸다 —
     * 눈앞에 있는 것을 못 줍고 끝나면 억울하다.
     * 줍는 동안 **화면의 금화가 스스로 다가온다** — 2초는 뛰어다니기엔 짧다.
     */
    if(!this.duel && this.finalBossKilled && this.bossDeathT <= 0){
      if(this.lootT === undefined) this.lootT = LOOT_TIME;
      this.lootT -= dt;
      const p = this.livePlayers()[0];
      if(p) for(const it of this.items){
        if(it.dead || it.kind !== ITEM_KIND.COIN) continue;
        const a = Math.atan2(p.y - it.y, p.x - it.x);
        it.x += Math.cos(a)*620*dt; it.y += Math.sin(a)*620*dt;
      }
      if(this.lootT <= 0){ this.finish('clear'); return; }
    }

    // ---- 2P 난입 / 캐릭터 선택 ----
    if(!this.p2 && !this.joining && Input.pressed('p2join')) this.startJoin();
    if(this.joining){
      this.joinT += dt;
      if(Input.pressed('pause') || Input.pressed('back')){    // 선택 취소
        this.joining = false; SND.sfx('deny');
        return;
      }
      /* 잠긴 것은 건너뛴다 — 고를 수 없는 칸에 커서가 서면 왜 안 되는지 모른다 */
      const step = (dir) => {
        for(let n=1;n<=10;n++){
          const i = (this.joinSel + dir*n + 100) % 10;
          if(ownsDragon(i)){ this.joinSel = i; SND.sfx('blip'); return; }
        }
      };
      if(Input.pressed('p2left'))  step(-1);
      if(Input.pressed('p2right')) step(1);
      if(Input.pressed('p2up'))    step(-5);
      if(Input.pressed('p2down'))  step(5);
      if(Input.pressed('p2missile') || Input.pressed('p2bomb') || Input.pressed('confirm')) this.confirmJoin();
    }

    this.btnMsl.update(dt); this.btnBomb.update(dt);
    if(this.btnMsl2){ this.btnMsl2.update(dt); this.btnBomb2.update(dt); }
    for(const p of this.players()) this.updatePlayer(p, dt);

    // ---- 웨이브 / 아이템 ----
    this.director.update(dt);
    if(this.bossBannerT > 0) this.bossBannerT -= dt;
    if(this.formT > 0) this.formT -= dt;
    if(this.pickupT > 0) this.pickupT -= dt;
    // ---- 정해진 개수만큼만 투하한다 ----
    const KIND = { missile:ITEM_KIND.MISSILE, apple:ITEM_KIND.APPLE, bomb:ITEM_KIND.BOMB };
    for(const d of this.dropQ){
      if(d.left <= 0) continue;
      d.t -= dt;
      if(d.t > 0) continue;
      d.t = d.every; d.left--;
      /**
       * ★ **혼자 하든 둘이 하든 똑같이 뜬다.** (2026-08-26, 사용자 지적)
       *
       * 사람 수만큼 뿌리고 있었다 — 2인이면 미사일·핵무기·사과가 **정확히 두 배**였다.
       * 그러면 혼자 놀 때도 2P 를 켜 두는 게 무조건 이득이라 "안 켜면 손해" 인
       * 게임이 되고, 화면도 정신없어진다.
       */
      const y0 = 220 + Math.random()*180;
      this.items.push(new Item(GAME_W + 50, y0, KIND[d.kind]));
    }
    /* 첫 판의 레벨업 한 개 — 한 번 떨어지면 다시 안 온다 */
    if(this.firstPowerT > 0){
      this.firstPowerT -= dt;
      if(this.firstPowerT <= 0){
        this.firstPowerT = -1;
        this.items.push(new Item(GAME_W + 50, GAME_H/2, ITEM_KIND.POWER));
      }
    }

    // ---- 황금동전 : 점수용. 움직여서 훑어 먹으라고 곡선으로 뿌린다 ----
    this.coinT -= dt;
    if(this.coinT <= 0){
      this.coinT = COIN_INTERVAL;
      const cy = 150 + Math.random()*400, amp = 60 + Math.random()*110;
      const ph = Math.random()*Math.PI*2, dir = Math.random() < 0.5 ? 1 : -1;
      for(let i=0;i<COIN_PER_ARC;i++){
        const k = i/(COIN_PER_ARC-1);
        this.items.push(new Item(GAME_W + 40 + i*54,
          clamp(cy + Math.sin(ph + k*2.2)*amp*dir, 90, 630), ITEM_KIND.COIN));
      }
    }
    if(this.bossDeathT > 0){
      this.bossDeathT -= dt;
      if(Math.random() < 0.55){
        const r = this.bossDeathR;
        this.booms.push(new Boom(this.bossDeathX + (Math.random()-0.5)*r*1.6,
                                 this.bossDeathY + (Math.random()-0.5)*r*1.4,
                                 30 + Math.random()*46, 0.4));
        Shake.add(6, 0.12);
      }
    }

    // ---- 갱신 ----
    /* 돌진병의 조준선이 참고할 사람. 그리기는 scene 을 못 받으므로 여기서 건넨다 */
    _aimPeek = this.livePlayers()[0] || null;
    for(const b of this.bolts)     b.update(dt);
    for(const e of this.enemies)   e.update(dt, this);
    for(const a of this.arrows)    a.update(dt);
    for(const e of this.eshots)    e.update(dt);
    for(const m of this.missiles)  m.update(dt);
    for(const b of this.bombs)     b.update(dt, this);
    for(const w of this.waves)     w.update(dt);
    for(const b of this.booms)     b.update(dt);
    for(const m of this.pmissiles) m.update(dt, this);
    /* 머리무장을 낀 1P 만 금화를 끌어당긴다. 죽어 있는 동안에는 안 끌린다 —
       화면에 없는 드래곤한테 동전이 빨려가면 보기에 이상하다. */
    const pull = (EQ.magnet > 0 && this.p1 && !this.p1.out && this.p1.hp > 0)
      ? (this.p1.deadT > 0 ? null : { x: this.p1.x, y: this.p1.y, r: EQ.magnet })
      : null;
    for(const it of this.items)    it.update(dt, pull);
    for(const r of this.roars)     r.update(dt, this);
    Particles.update(dt); Popups.update(dt); Flash.update(dt); Shake.update(dt);
    if(this.grazeFlash > 0) this.grazeFlash -= dt;
    if(this.followT > 0) this.followT -= dt;
    if(this.ruleT > 0) this.ruleT -= dt;
    this.updateRule(dt);
    /* 연쇄는 가만히 있으면 끊긴다 — 이것이 이 장치의 전부다 */
    if(this.chainT > 0){
      this.chainT -= dt;
      if(this.chainT <= 0 && this.killStreak >= 3){
        Popups.add(this.p1.x, this.p1.y - 120, '연쇄 끊김', '#8a9bbf', 4, true);
        SND.sfx('deny');
      }
      if(this.chainT <= 0) this.killStreak = 0;
    }

    // ---- 충돌: 불 vs 적 ----
    for(const b of this.bolts){
      if(b.dead) continue;
      const bb = b.box;
      for(const e of this.enemies){
        if(e.dead) continue;
        if(!overlap(bb, e.box)) continue;
        if(b.hitSet && b.hitSet.has(e)) continue;
        /* 방패에 막히면 관통이고 뭐고 거기서 끝난다 — 뚫으라고 둔 것이 아니다 */
        if(e.shieldBlocks && e.shieldBlocks(b)){ e.hit(0, b, this); break; }
        e.hit(b.dmg, b, this);
        if(e.dead) this.kills++;
        if(b.pierce > 0){ b.pierce--; (b.hitSet || (b.hitSet = new Set())).add(e); }
        else {
          b.dead = true;
          Particles.spawn(b.x, b.y, 6, { ang:Math.PI, spread:2.0, spd:240, life:0.26 });
          break;
        }
      }
    }
    // ---- 충돌: 아군 미사일 vs 적 ----
    for(const mi of this.pmissiles){
      if(mi.dead || mi.t < 0) continue;
      const mb = mi.box;
      for(const e of this.enemies){
        if(e.dead) continue;
        if(overlap(mb, e.box)){ mi.explode(this); break; }
      }
    }
    // ---- 아이템 획득 (가까운 플레이어가 먹음) ----
    for(const it of this.items){
      if(it.dead) continue;
      for(const p of this.players()){
        const pb = { x:p.x - 46, y:p.y - 46, w:92, h:92 };
        if(overlap(it.box, pb)){ this.pickup(it, p); it.dead = true; break; }
      }
    }
    // ---- 격파 처리 (드롭) ----
    for(const e of this.enemies){
      if(e.killed && !e.dropped){ e.dropped = true; this.onEnemyKilled(e); }
    }
    // ---- 충돌: 적 공격 vs 각 플레이어 ----
    for(const p of this.livePlayers()){
      if(p.shieldT > 0){ this.shieldDeflect(p); continue; }   // 쉴드 중엔 전부 튕겨낸다
      if(p.hurtT > 0) continue;
      const hb = p.hitbox;
      let struck = false;
      let dmg = 34;
      for(const list of [this.arrows, this.eshots, this.missiles, this.bombs]){
        for(const o of list){
          if(o.dead || !overlap(o.box, hb)) continue;
          dmg = o.hurt || 25;                       // 보스 탄은 스테이지에 비례해 더 아프다
          if(o instanceof Bomb) o.explode(this); else o.dead = true;
          struck = true; break;
        }
        if(struck) break;
      }
      /**
       * ★ **스침.** 맞지 않은 탄만 센다 — 위에서 `struck` 이 참이면 여기 안 온다.
       * 탄 하나는 **한 번만** 세어진다(`grazed`). 안 그러면 느린 탄 하나가
       * 옆에 붙어 있는 동안 점수가 무한히 오른다.
       */
      if(!struck && p.pid === 1){
        const gz = { x: hb.x - GRAZE_PAD, y: hb.y, w: hb.w + GRAZE_PAD*2, h: hb.h };
        for(const list of [this.arrows, this.eshots]){
          for(const o of list){
            if(o.dead || o.grazed || !overlap(o.box, gz)) continue;
            o.grazed = true;
            this.grazeN++; this.grazeTotal++; this.grazeFlash = 0.3;
            this.addScore(GRAZE_SCORE, 1, true);
            Particles.spawn(o.x, o.y, 3,
              { spd:170, life:0.24, pal:['#ffffff','#cfe8ff','#7fb8ff'] });
            if(this.grazeN >= GRAZE_PER_COIN){
              this.grazeN = 0;
              this.items.push(new Item(p.x + 60, p.y, ITEM_KIND.COIN));
              SND.sfx('coin');
            }
          }
        }
      }
      if(!struck) for(const e of this.enemies){ if(!e.dead && overlap(e.box, hb)){ struck = true; break; } }
      /* ★ 판 규칙이 만든 것들도 때린다 (기획 4) */
      if(!struck) for(const k of this.rocks){
        if(k.bolt){
          if(k.t < 0) continue;                         // 아직 예고 중
          if(Math.abs(p.x - k.x) < 26){ struck = true; dmg = 30; break; }
        }else if(Math.hypot(p.x - k.x, p.y - k.y) < k.r + 20){ struck = true; dmg = 30; break; }
      }
      if(!struck) for(const w of this.waves){
        if(w.hitDone) continue;
        const d = Math.hypot(p.x - w.x, p.y - w.y);
        if(Math.abs(d - w.r) < 30){ w.hitDone = true; struck = true; break; }
      }
      if(struck) this.hurtPlayer(p, Math.round(dmg * diffAtk()));
    }

    // ---- 정리 ----
    this.bolts     = this.bolts.filter(o => !o.dead);
    this.enemies   = this.enemies.filter(o => !o.dead);
    this.arrows    = this.arrows.filter(o => !o.dead);
    this.eshots    = this.eshots.filter(o => !o.dead);
    this.missiles  = this.missiles.filter(o => !o.dead);
    this.bombs     = this.bombs.filter(o => !o.dead);
    this.waves     = this.waves.filter(o => !o.dead);
    this.booms     = this.booms.filter(o => !o.dead);
    // 폭발은 반경 118 짜리 원을 3겹으로 그린다. 20개가 겹치면 그것만으로
    // 프레임당 0.9화면분을 칠한다. 14개를 넘으면 오래된 것부터 버린다.
    if(this.booms.length > 14) this.booms.splice(0, this.booms.length - 14);
    this.pmissiles = this.pmissiles.filter(o => !o.dead);
    this.items     = this.items.filter(o => !o.dead);
    this.roars     = this.roars.filter(o => !o.dead);

    // ---- 배경 ----
    const drive = clamp(this.p1.vx / PLAYER.SPEED, -1, 1);
    this.scrollK += (1 + drive*0.7 - this.scrollK) * Math.min(1, 4*dt);
    this.camLead += (drive*30 - this.camLead) * Math.min(1, 5*dt);
    const K = this.scrollK;
    this.offFar  = (this.offFar  +  120*K*dt) % GAME_W;
    this.offMid  = (this.offMid  +  330*K*dt) % GAME_W;
    this.offNear = (this.offNear +  700*K*dt) % GAME_W;
    this.offFg   = (this.offFg   + 1350*K*dt) % GAME_W;
    for(const cl of this.clouds){
      cl.x -= cl.sp*K*dt;
      if(cl.x + cl.w < -20){ cl.x = GAME_W + Math.random()*260; cl.y = snap(40 + Math.random()*380); }
    }
    for(const l of this.lines){
      l.x -= l.sp*K*dt;
      if(l.x + l.len < -20){ l.x = GAME_W + Math.random()*300; l.y = snap(Math.random()*GAME_H); }
    }
    for(const w of this.fgWisps){
      w.x -= w.sp*K*dt;
      if(w.x + w.w < -40){ w.x = GAME_W + Math.random()*500; w.y = snap(30 + Math.random()*640); }
    }
    if(this.weather) this.weather.update(dt, K);

    if(DEBUG){
      if(Input.pressed('lvup'))   for(const p of this.players()) p.setLevel(p.level + 1);
      if(Input.pressed('lvdown')) for(const p of this.players()) p.setLevel(p.level - 1);
    }
    if(!this.mgr.busy && Input.pressed('pause')) this.setPause(true);
    /* 'back'(백스페이스/X) 도 곧바로 나가지 않고 일시정지를 띄운다 —
       한 번의 실수로 판이 날아가면 안 된다 */
    if(!this.mgr.busy && Input.pressed('back'))  this.setPause(true);
  }

  /* 쉴드에 닿은 적 공격을 빗물처럼 튕겨낸다 */
  shieldDeflect(p){
    const c = p.shieldC, R = p.shieldR, R2 = R*R;
    for(const list of [this.arrows, this.eshots, this.missiles, this.bombs]){
      for(const o of list){
        if(o.dead) continue;
        const b = o.box;
        const nx = clamp(c.x, b.x, b.x + b.w) - c.x;
        const ny = clamp(c.y, b.y, b.y + b.h) - c.y;
        if(nx*nx + ny*ny > R2) continue;
        o.dead = true;
        const a = Math.atan2(o.y - c.y, o.x - c.x);
        if(p.shieldHits.length < 12) p.shieldHits.push({ a, t:0 });
        Particles.spawn(c.x + Math.cos(a)*R, c.y + Math.sin(a)*R, 7,
          { ang:a, spread:1.2, spd:430, life:0.32, size:PX*2,
            pal:['#ffffff','#cfeaff','#6ec8ff','#2b5cff'] });
        SND.sfx('ricochet');
      }
    }
  }
  /**
   * 맞았다. **아플지 말지는 여기서만 정한다.**
   *
   * ★ 무적(`hurtT`) 검사가 예전에는 **충돌 루프 안에만** 있었다 (2026-08-27).
   * 그러면 다른 경로로 부르는 순간(판 규칙의 낙석·번개, 밀어내기 등) 무적이
   * 통째로 뚫린다. 부활 직후 3초를 지켜야 하는 마당에 그런 구멍이 있으면 안 된다.
   */
  hurtPlayer(p, dmg){
    if(p.out || p.deadT > 0 || p.shieldT > 0 || p.hurtT > 0 || p.rollT > 0) return;
    /* 맞고 나서의 무적 시간. 1.1초는 너무 길어 연달아 맞는 일이 거의 없었다 */
    p.hurtT = 0.85;
    Shake.add(10, 0.25);
    SND.sfx('hurt'); Input.rumble(0.9, 0.7, 260);
    /* 기본 피해 25 -> 34. 목숨 하나가 네 대에서 세 대로 줄어든다 */
    /* 마스크를 꼈으면 피해가 줄어든다 (1P 한테만) */
    if(p.pid === 1) this.stageHits++;      // 무피격 보너스 판정용 (기획 10)
    /**
     * ★ **맞은 티가 나야 한다.** (2026-08-27, 사용자 지정)
     *
     * *"생명력이 조금씩 사라졌잖아, 이때 액션이 없으니깐 (...) 내가 당하고 있는건지
     *   모르겠어"*
     *
     * 체력 막대는 화면 구석에 있어서 싸우는 동안 볼 겨를이 없다.
     * **얼굴이 해골로 바뀌면** 눈이 이미 보고 있는 자리에서 바로 읽힌다.
     */
    p.hitT = 0.55;
    p.startFx('stagger', 0.45);          // 작아지며 뒤로 꺾이고 휘청 (2026-08-27)
    Flash.add('#ff2b3c', 0.06, 0.14);
    Particles.spawn(p.x + 20, p.y - 10, 10,
      { spd:300, life:0.4, pal:['#ffffff','#ff9a5a','#ff2b3c','#8f1230'] });
    p.hp -= (dmg || 34) * (p.pid === 1 ? (1 - EQ.dmgCut) : 1);
    if(p.hp <= 0){
      p.lives = Math.max(0, p.lives - 1);
      /**
       * ★★ **죽으면 파이어 레벨이 1로 돌아간다.** (2026-08-26, 사용자 지정)
       *
       * *"랩업을 하다가도 하트가 1개 죽으면 다시 1부터 랩업을 해야 하는걸로 가자"*
       *
       * 전에는 안 내렸다. 레벨이 중간보스 격파로만 오르는데 죽을 때마다 깎으면
       * 되돌릴 길이 없다는 이유였다. 그 이유가 **이번 표 개편으로 사라졌다** —
       * Lv1 과 Lv10 의 차이가 예전만큼 크지 않으므로(데미지 18.3 대 31.0,
       * 두께 26 대 78) 1 로 떨어져도 게임을 못 할 정도가 아니다.
       * 스테이지마다 한 칸씩 다시 오르므로 남은 판으로 되찾을 수도 있다.
       *
       * 그리고 이게 있어야 **맞는 것이 아프다.** 목숨만 깎이고 화력이 그대로면
       * 몸으로 밀고 들어가는 편이 이득이라 피할 이유가 없었다.
       */
      p.setLevel(1);
      /**
       * ★ **터져서 죽는다.** (2026-08-27, 사용자 지정)
       * 큰 폭발 하나로는 "맞았다" 로 읽힌다 — 여러 겹으로 터뜨리고 화면을 흔들어야
       * **죽었다**로 읽힌다. 죽은 동안에는 그리지도 않는다(`deadT`).
       */
      p.deadT = RESPAWN_DELAY;
      p.hurtT = 0;
      this.playerDeathFx(p);
      /**
       * ★ **결투에서 죽으면 점수를 20% 잃는다.** (2026-08-26, 사용자 지정)
       * 목숨이 다섯이라 그냥 몸으로 밀고 들어가는 게 이득이 되면 안 된다 —
       * 죽는 데 값을 매겨야 피하는 것도 실력이 된다.
       */
      if(this.duel && p.pid === 1){
        const lost = Math.round(p.score * DUEL.DEATH_PENALTY);
        if(lost > 0){
          p.score = Math.max(0, p.score - lost);
          this.score = Math.max(0, this.score - lost);
          Popups.add(p.x, p.y - 100, '-' + lost.toLocaleString('en-US'), '#ff4d5a', 5);
        }
      }
      if(p.lives <= 0){
        // 이 플레이어만 탈락. 남은 사람이 있으면 게임은 계속된다
        p.hp = 0; p.out = true;
        Popups.add(p.x, p.y - 60, p.pid + 'P 탈락', '#ff4d5a', 5, true);
        if(this.players().length === 0){ this.finish('over', 'GAME OVER'); }
        return;
      }
      p.hp = 100;
    }
    Particles.spawn(p.x, p.y, 18, { spd:340, life:0.5, pal:['#fff','#ff9a5a','#ff4d5a','#8f1230'] });
  }

  render(ctx){
    ctx.drawImage(this.sky, 0, 0);
    if(this.weather) this.weather.renderBack(ctx);
    for(const cl of this.clouds){
      ctx.globalAlpha = cl.a; ctx.fillStyle = this.theme.cloud;
      const x = snap(cl.x);
      ctx.fillRect(x, cl.y, cl.w, cl.h);
      ctx.fillRect(x + snap(cl.w*0.2), cl.y - PX*2, snap(cl.w*0.5), PX*2);
      ctx.fillRect(x - PX*2, cl.y + cl.h, snap(cl.w*0.7), PX*2);
    }
    ctx.globalAlpha = 1;
    const lead = this.camLead;
    const draw2 = (img, off, k) => {
      const x = -snap(((off + lead*k) % GAME_W + GAME_W) % GAME_W);
      blitRidge(ctx, img, x); blitRidge(ctx, img, x + GAME_W);
    };
    if(this.far)  draw2(this.far,  this.offFar,  0.25);
    if(this.mid)  draw2(this.mid,  this.offMid,  0.55);
    if(this.near) draw2(this.near, this.offNear, 1.0);
    const sk = clamp((this.scrollK - 0.6) / 1.1, 0, 1);
    ctx.globalAlpha = 0.14 + sk*0.30; ctx.fillStyle = this.theme.line;
    for(const l of this.lines) ctx.fillRect(snap(l.x), l.y, snap(l.len*(0.6 + sk*0.9)), PX);
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(Shake.x, Shake.y);
    for(const e of this.enemies)   e.render(ctx);
    for(const a of this.arrows)    a.render(ctx);
    this.renderRule(ctx);
    for(const e of this.eshots)    e.render(ctx);
    for(const m of this.missiles)  m.render(ctx);
    for(const b of this.bombs)     b.render(ctx);
    for(const it of this.items)    it.render(ctx);
    for(const b of this.bolts)     b.render(ctx);
    for(const m of this.pmissiles) m.render(ctx);
    for(const p of this.livePlayers()){
      /**
       * ★ 리액션이 만드는 변형을 여기서 한 번에 건다 (2026-08-27).
       * 리액션이 늘어도 `fxState()` 만 늘면 되고 그리는 코드는 그대로다.
       */
      const fx = p.fxState();
      const moved = fx.sx !== 1 || fx.sy !== 1 || fx.rot !== 0 || fx.ox !== 0 || fx.oy !== 0;
      if(moved){
        ctx.save();
        ctx.translate(p.x + fx.ox, p.y + fx.oy);
        ctx.rotate(fx.rot);
        ctx.scale(fx.sx, fx.sy);
        ctx.translate(-p.x, -p.y);
      }
      /* 무적 동안 **반투명하게 깜빡인다** — 지금 안 맞는다는 것이 보여야 한다 */
      if(p.hurtT > 0){
        ctx.globalAlpha = Math.floor(p.hurtT*12) % 2 === 0 ? 0.32 : 0.78;
        p.render(ctx); ctx.globalAlpha = 1;
      }else p.render(ctx);
      /* 레벨업은 붉게 물든다 — 원본 위에 같은 그림을 색만 바꿔 얹는다 */
      if(fx.tint){
        const pa = ctx.globalAlpha;
        ctx.globalAlpha = pa * 0.72;
        drawDragon(ctx, p.dragon.pal, p.level, p.x, p.y, p.pose, false, fx.tint,
                   p.dragon.always, p.dragonIdx, p.mawT > 0);
        ctx.globalAlpha = pa;
      }
      if(moved) ctx.restore();
      /* 사과를 먹으면 웃는다 */
      if(fx.smile){
        const m = p.metrics;
        drawSmile(ctx, p.x + m.w*0.20, p.y - m.h*0.14,
                  Math.max(PX, Math.round(m.h*0.05/PX)*PX));
      }
      /* ★ 맞은 직후에는 머리에 해골 (2026-08-27) */
      if(p.hitT > 0){
        const m = p.metrics;
        drawSkull(ctx, p.x + m.w*0.20, p.y - m.h*0.16,
                  Math.max(PX, Math.round(m.h*0.055/PX)*PX), p.hitT / 0.55);
      }
      if(p.shieldT > 0) drawShield(ctx, p);
      if(this.p2){                      // 2인일 때 누가 누군지 표시
        const c = p.pid === 1 ? P1_COLOR : P2_COLOR;
        drawText(ctx, p.pid + 'P', p.x, p.y - p.metrics.h/2 - 6, 2,
          { align:'center', color:c, outline:PAL.outline });
      }
    }
    Particles.render(ctx);
    for(const w of this.waves) w.render(ctx);
    for(const b of this.booms) b.render(ctx);
    Popups.render(ctx);
    ctx.restore();
    Flash.render(ctx);

    const fgx = -snap(((this.offFg + this.camLead*1.6) % GAME_W + GAME_W) % GAME_W);
    if(this.fg){ blitRidge(ctx, this.fg, fgx); blitRidge(ctx, this.fg, fgx + GAME_W); }
    if(this.weather) this.weather.renderFront(ctx);
    for(const r of this.roars) r.render(ctx);

    /**
     * ★★ **여기부터는 화면 좌표다.** (2026-08-27)
     * 판은 세로에서 90도 돌아 있지만 **글자와 단추는 돌면 안 된다** —
     * 돌아 있는 글씨는 읽을 수가 없다. 변환을 풀고 화면 좌표로 그린다.
     * 누르는 판정도 같은 좌표(`sx,sy`)를 쓰므로 그림과 어긋나지 않는다.
     */
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if(this.stickVisible()) this.stick.render(ctx);
    this.btnMsl.render(ctx, this.p1.missileCount);
    this.btnBomb.render(ctx, this.p1.bombCount);
    if(this.btnMsl2){
      this.btnMsl2.render(ctx, this.p2.missileCount);
      this.btnBomb2.render(ctx, this.p2.bombCount);
    }
    this.renderHUD(ctx);
    if(this.joining) this.renderJoin(ctx);
    ctx.restore();
    if(DEBUG) this.renderDebug(ctx);
  }

  /* 2P 캐릭터 선택 (화면 상단) */
  renderJoin(ctx){
    const H = 172, y0 = 140;
    ctx.globalAlpha = 0.88; ctx.fillStyle = '#0a0618';
    ctx.fillRect(0, y0, UIW, H); ctx.globalAlpha = 1;
    ctx.fillStyle = P2_COLOR; ctx.fillRect(0, y0, UIW, PX); ctx.fillRect(0, y0+H-PX, UIW, PX);
    ko(ctx, '2P 드래곤 고르기', uiCx(), y0 + 8, 4,
      { align:'center', color:P2_COLOR, outline:PAL.outline });

    for(let i=0;i<10;i++){
      const d = DRAGONS[i], on = i === this.joinSel, has = ownsDragon(i);
      const x = 130 + i*110, y = y0 + 52;
      ctx.fillStyle = on ? P2_COLOR : '#241c3e';
      ctx.fillRect(x - 44, y - 4, 88, 56);
      ctx.fillStyle = on ? '#2a2140' : '#120d24';
      ctx.fillRect(x - 40, y, 80, 48);
      /* 안 산 것은 실루엣만 — 생김새를 숨겨야 사고 싶어진다 */
      const cell = 1.5, f = FORMS.B;
      const ox = snap(x - f.cols*cell/2), oy = snap(y - 2);
      const pal = has ? d.pal : null;
      if(has){
        drawGrid(ctx, f.wings[2], ox, oy, f.cols, cell, pal, false, null);
        if(f.horns) drawGrid(ctx, f.horns[i], ox, oy, f.cols, cell, pal, false, null);
        drawGrid(ctx, f.body,    ox, oy, f.cols, cell, pal, false, null);
      }else{
        drawGrid(ctx, f.body, ox, oy, f.cols, cell, d.pal, false, '#3a3350');
        ko(ctx, '잠김', x, y + 30, 2, { align:'center', color:'#6b6280' });
      }
      ctx.fillStyle = has ? d.pal.M : '#332c4a';
      ctx.fillRect(x - 40, y + 42, 80, 6);
    }

    ko(ctx, DRAGONS[this.joinSel].ko + (ownsDragon(this.joinSel) ? '' : '  (아직 안 샀습니다)'),
      uiCx(), y0 + H - 58, 3,
      { align:'center', color: ownsDragon(this.joinSel) ? PAL.white : '#8a7bb8', outline:PAL.outline });

    /**
     * ★ **기록은 1P 것이라고 여기서 못박는다.** (2026-08-26, 사용자 지정)
     *
     * 이 문구가 있어야 "혼자서 2P 를 하나 더 켜 두는" 놀이가 성립한다 —
     * 2P 는 보조로 쓰고 1P 로 금화를 쓸어 담으면 된다는 걸 알아야 그렇게 논다.
     * 중간보스를 잡으면 파이어 레벨업이 **두 개** 떨어지는 것도 그래서 켜 둘 만하다.
     */
    ko(ctx, '금화 및 스코어의 점수 기록은 1P 기준으로 기록됩니다.', uiCx(), y0 + H - 36, 2,
      { align:'center', color:PAL.gold });

    if(Math.floor(this.joinT*2.4) % 2 === 0)
      ko(ctx, 'A D : 고르기      ` 또는 1 : 참가      ESC : 취소', uiCx(), y0 + H - 16, 2,
        { align:'center', color:'#8a93b8' });
  }

  /* 플레이어 정보 블록 : 하트 -> 생명 게이지 -> 레벨.
     1인일 땐 왼쪽 위, 2P 가 합류하면 1P 는 오른쪽 위로 옮기고 2P 가 왼쪽 위를 쓴다 */
  /**
   * 캐릭터를 잡았는가. 잡았으면 이 터치는 이동 전용이 된다.
   * 1P 만 잡을 수 있다 — 2P 는 키보드/패드로 들어온 사람이라 화면을 만지지 않는다.
   */
  grabDown(id, x, y){
    if(this.state !== 'play' || this.dragId !== null) return false;
    const p = this.p1;
    if(!p || p.out) return false;
    const r = p.shieldR;
    if(Math.hypot(x - p.x, y - p.y) > r) return false;
    this.dragId = id;
    this.dragOff.x = p.x - x; this.dragOff.y = p.y - y;
    this.dragT = 0;
    /* 스틱이 떠 있었다면 놓아 준다 — 둘이 동시에 밀면 서로 싸운다 */
    this.stick.up(this.stick.pid);
    return true;
  }

  /**
   * ★★ **더블클릭하면 버튼을 안 눌러도 따라온다.** (2026-08-27, 사용자 지정)
   *
   * *"드래그 하는건 버튼을 꾹 누르고 움직여야 하는데, 더블클릭하면 (...)
   *   클릭 버튼을 누르지 않고 마우스만 움직이면서 게임을 할 수 있게"*
   *
   * 손가락에는 없는 기능이다(누르지 않으면 좌표 자체가 안 온다). 마우스는
   * 누르지 않아도 `pointermove` 가 계속 오므로 **잡은 것과 똑같이** 굴릴 수 있다.
   * 한 번 더 더블클릭하면 풀린다.
   */
  toggleFollow(){
    this.followMouse = !this.followMouse;
    if(this.followMouse){
      this.dragId = null;
      this.stick.up(this.stick.pid);       // 스틱과 동시에 밀면 서로 싸운다
      SND.sfx('confirm');
    }else SND.sfx('blip');
    this.followT = 1.6;                    // 안내 문구가 떠 있는 시간
  }
  /** 잡은 손가락을 따라간다. 화면 밖으로는 안 나가게 가둔다 */
  grabMove(id, x, y){
    if(this.followMouse) return this.moveTo(x, y, 0, 0);
    if(this.dragId !== id) return false;
    const p = this.p1;
    if(!p || p.out){ this.dragId = null; return false; }
    const m = p.metrics;
    return this.moveTo(x, y, this.dragOff.x, this.dragOff.y);
  }
  /** 화면 좌표로 1P 를 옮긴다. 잡기와 따라가기가 **같은 셈**을 쓴다 */
  moveTo(x, y, offX, offY){
    const p = this.p1;
    if(!p || p.out || this.state !== 'play') return false;
    const m = p.metrics;
    const nx = clamp(x + offX, m.bL + PLAYER.MARGIN, GAME_W - m.bR - PLAYER.MARGIN);
    const ny = clamp(y + offY, m.bT + PLAYER.MARGIN, GAME_H - m.bB - PLAYER.MARGIN);
    /**
     * 속도를 기록해 둔다 — 잔상과 날갯짓이 "지금 얼마나 빠른가" 를 보고 정해지는데,
     * 끌어서 옮기면 위치만 바뀌고 속도가 0 이라 **날개가 멈춘 채 미끄러진다.**
     */
    const dt = Math.max(1/240, this.lastDt || 1/60);
    p.vx = (nx - p.x) / dt; p.vy = (ny - p.y) / dt;
    p.x = nx; p.y = ny;
    return true;
  }

  /**
   * 대형 이름을 잠깐 띄운다. (2026-08-26, 사용자 지정)
   * "우와 좀비들의 등장하는 대형 봐봐" 가 나오려면 **그게 대형이라는 걸 알아야** 한다.
   * 같은 이름이 연달아 뜨면 잔소리가 되므로 직전과 같으면 안 띄운다.
   */
  noteFormation(name){
    if(this.formName === name && this.formT > 0) return;
    this.formName = name; this.formT = 1.8;
  }

  /** 모은 금화 — 동전 그림 + 개수 */
  drawCoinCounter(ctx){
    /* 2P 가 붙으면 1P 정보창이 오른쪽으로 가므로 금화도 같이 간다 */
    const right = !!this.p2;
    const x = right ? GAME_W - 150 : 150;
    const y = GAME_H - 54;

    /* 동전 (아이템으로 떨어지는 것과 같은 모양이라 뭘 센 건지 바로 안다) */
    const t = this.t * 3.4;
    const w = Math.max(PX, snap(20 * Math.abs(Math.sin(t))) || PX);
    ctx.fillStyle = '#6b4a08'; ctx.fillRect(x - w/2 - PX, y - 15, w + PX*2, 30);
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(x - w/2, y - 12, w, 24);
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(x - w/2, y - 12, w, PX*2);

    drawText(ctx, String(RUN.coins), x + 22, y - 10, 4,
      { color:'#ffd24a', outline:PAL.outline, shadow:'#000' });
  }

  drawPlayerPanel(ctx, p, x, y0, col){
    const W = 216;
    let y = y0;
    /**
     * ★ **한 줄에 몰지 않는다.** (2026-08-26, 사용자 지적)
     *
     * 점수와 금화를 나란히 놨더니 여섯 자리 점수가 길어질 때 **글자가 겹쳤다.**
     * 폭을 재서 밀어 넣는 방법도 있지만, 자릿수가 바뀔 때마다 금화가 좌우로
     * 흔들려서 읽기 나쁘다. 줄을 하나 늘리는 편이 낫다 —
     *
     *     점수 000000
     *     금화 000
     *     (하트)
     */
    const LBL = 52;                      // 라벨 뒤 숫자가 시작하는 자리
    ko(ctx, '점수', x, y - 2, 2, { color:'#8a93b8' });
    drawDigits(ctx, String(Math.min(999999, p.score|0)).padStart(6, '0'), x + LBL, y - 2, 3,
      { color: col, outline:PAL.outline });
    y += 24;
    if(p.pid === 1){
      /**
       * 금화는 1P 것만 센다 — 지갑의 주인이 1P 다.
       *
       * ★ **이번 판에서 번 것과 지갑에 있는 것을 같이 보여준다.** (2026-08-27, 사용자 지정)
       * *"금화 0 (보유금화 0000) 이렇게 표기되서, 내가 보유한 금화는 얼마이고
       *   이번판에서 이정도 모아서 합치면 얼마가 되겠다 라는걸 알 수 있게"*
       *
       * 앞은 **이번 판에서 주운 것**, 괄호 안은 **지갑 + 이번 판**이다 —
       * 즉 지금 판을 끝내면 갖게 될 금화다. 그래야 "이어하기 500 이 되나",
       * "저 드래곤을 살 수 있나" 를 게임 중에 바로 셈할 수 있다.
       */
      const run = RUN.coins | 0;
      const wallet = RUN.wallet0 | 0;    // 고정 — 이번 판에서 번 것은 왼쪽 숫자가 센다
      ko(ctx, '금화', x, y - 2, 2, { color:'#8a93b8' });
      /* `drawDigits` 는 고정폭이라 `textWidth` 와 다르다 — 그리면서 준 폭을 그대로 쓴다 */
      const dw = drawDigits(ctx, String(Math.min(9999, run)), x + LBL, y - 2, 3,
        { color:'#ffd24a', outline:PAL.outline });
      /**
       * ★ **괄호 안은 흐리게.** (2026-08-27, 사용자 지정)
       * 지금 보는 숫자는 **이번 판에서 번 금화**다. 보유액은 참고로 곁들이는 것이라
       * 같은 밝기면 둘 중 무엇을 봐야 하는지 눈이 헷갈린다.
       * 색을 낮추고 반투명까지 걸어 한 걸음 뒤로 물린다.
       */
      const pa = ctx.globalAlpha;
      ctx.globalAlpha = pa * 0.55;
      ko(ctx, '(보유 ' + wallet.toLocaleString('en-US') + ')', x + LBL + dw + 10, y, 2,
        { color:'#8a6a30' });
      ctx.globalAlpha = pa;
      y += 24;
    }
    // 하트
    const rows = ['.XX.XX.','XXXXXXX','.XXXXX.','..XXX..','...X...'];
    for(let i=0;i<Math.min(MAX_LIVES, 8);i++){
      ctx.fillStyle = i < p.lives ? (p.out ? '#4a2030' : '#ff2b4a') : '#2b3448';
      const hx = x + i*26;
      for(let r=0;r<rows.length;r++) for(let c=0;c<7;c++)
        if(rows[r][c] === 'X') ctx.fillRect(hx + c*3, y + r*3, 3, 3);
    }
    if(p.lives > 8)
      drawText(ctx, 'x' + p.lives, x + 8*26 + 4, y + 2, 2, { color:'#ff8fa0' });
    y += 22;
    // 생명(HP) 게이지
    ctx.fillStyle = '#0a1420'; ctx.fillRect(x, y, W, 18);
    ctx.fillStyle = '#20344d'; ctx.fillRect(x+3, y+3, W-6, 12);
    const hk = clamp(p.hp/100, 0, 1);
    ctx.fillStyle = p.out ? '#3a2030' : (hk > 0.5 ? '#5ee07a' : (hk > 0.25 ? '#ffd24a' : '#ff4d5a'));
    ctx.fillRect(x+3, y+3, snap((W-6)*hk), 12);
    y += 22;
    // 레벨
    drawText(ctx, p.pid + 'P  LV' + p.level + (p.out ? '  OUT' : ''), x, y, 2,
      { color: p.out ? '#7a6a80' : col, shadow:'#0a1830' });
    for(let i=1;i<=MAX_LEVEL;i++){
      ctx.fillStyle = i <= p.level ? PAL.fire[Math.min(6, 6 - Math.floor(i*0.55))] : '#20344d';
      ctx.fillRect(x + 92 + (i-1)*12, y + 1, 9, 10);
    }
  }

  /** 규칙이 만든 것들. 눈으로 읽혀야 피할 수 있으므로 크고 분명하게 */
  renderRule(ctx){
    for(const k of this.rocks){
      if(k.bolt){
        const x = snap(k.x);
        if(k.t < 0){
          /* 예고 — 떨어질 자리가 깜빡인다 */
          ctx.globalAlpha = 0.30 + 0.4*Math.abs(Math.sin(k.t*26));
          ctx.fillStyle = '#fff6a0';
          ctx.fillRect(x - PX, 0, PX*2, GAME_H);
          ctx.globalAlpha = 1;
        }else{
          const a = 1 - k.t/0.5;
          ctx.globalAlpha = a;
          ctx.fillStyle = '#ffffff'; ctx.fillRect(x - PX*3, 0, PX*6, GAME_H);
          ctx.fillStyle = '#fff6a0'; ctx.fillRect(x - PX*6, 0, PX*3, GAME_H);
          ctx.fillRect(x + PX*3, 0, PX*3, GAME_H);
          ctx.globalAlpha = 1;
        }
      }else{
        /* 바위 — 도트 원에 그늘 */
        fillPixelCircle(ctx, k.x, k.y, k.r, '#6b5a48');
        fillPixelCircle(ctx, k.x - k.r*0.22, k.y - k.r*0.22, k.r*0.58, '#8a7a64');
        fillPixelCircle(ctx, k.x + k.r*0.3, k.y + k.r*0.28, k.r*0.3, '#4a3d30');
      }
    }
    /* 맞바람 — 왼쪽으로 흐르는 선 */
    if(this.rule === 'gale'){
      ctx.globalAlpha = 0.34; ctx.fillStyle = '#cfe6ff';
      for(let i=0;i<18;i++){
        const y = 90 + ((i*53) % (GAME_H - 180));
        const x = ((this.t*900 + i*211) % (GAME_W + 300)) - 150;
        ctx.fillRect(snap(GAME_W - x), snap(y), 90, PX);
      }
      ctx.globalAlpha = 1;
    }
    /* 눈보라·어둠 — 화면을 가린다. 셋 중 가장 답답하므로 옅게 */
    if(this.rule === 'fog' || this.rule === 'dark'){
      const p = this.livePlayers()[0];
      const R = this.rule === 'dark' ? 300 : 420;
      const col = this.rule === 'dark' ? '#05040a' : '#dfe9f0';
      ctx.save();
      ctx.globalAlpha = this.rule === 'dark' ? 0.80 : 0.46;
      ctx.fillStyle = col;
      if(p){
        /**
         * ★ 그라디언트를 **매 프레임 새로 만들지 않는다.** (2026-08-27)
         * 화면 전체를 덮는 그라디언트는 만드는 값이 싸지 않은데, 16px 안쪽으로
         * 움직인 것은 눈에 보이지도 않는다. 그만큼 움직였을 때만 다시 만든다.
         */
        const gx = Math.round(p.x / 16) * 16, gy = Math.round(p.y / 16) * 16;
        if(!this._fogG || this._fogX !== gx || this._fogY !== gy || this._fogC !== col){
          const g = ctx.createRadialGradient(gx, gy, R*0.45, gx, gy, R);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(1, col);
          this._fogG = g; this._fogX = gx; this._fogY = gy; this._fogC = col;
        }
        ctx.fillStyle = this._fogG;
      }
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.restore();
    }
  }
  renderHUD(ctx){
    // 1인 : 왼쪽 위 고정 / 2인 : 2P 왼쪽 위, 1P 오른쪽 위
    const LX = 24, RX = UIW - 240, TY = 20;
    if(this.p2){
      this.drawPlayerPanel(ctx, this.p2, LX, TY, P2_COLOR);
      this.drawPlayerPanel(ctx, this.p1, RX, TY, P1_COLOR);
    }else{
      this.drawPlayerPanel(ctx, this.p1, LX, TY, P1_COLOR);
    }

    /**
     * ★ **물음표의 정체는 가운뎃점(·) 이었다.** (2026-08-26, 사용자 지적)
     * 오락실 한글 글꼴은 실제로 쓰는 글자만 구워 넣는데(`tools/build-font.mjs` 가
     * 소스에서 한글만 훑는다) '·' 는 한글이 아니라서 빠졌고, 없는 글자는 '?' 로 나온다.
     * 하이픈으로 바꿨다 — 굳이 글꼴을 늘릴 이유가 없다.
     */
    /* ★ 한 단계 작게 (2026-08-27, 사용자 지정) */
    ko(ctx, this.stage + '스테이지 - ' + this.theme.n, uiCx(), 46, 2,
      { align:'center', color:'#cfe6ff' });

    /* 전체화면 단추 — 늘 같은 자리에 있어야 찾는다 */
    {
      const r = this.fsRect();
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = '#0a0a14'; ctx.fillRect(r.x - PX, r.y - PX, r.w + PX*2, r.h + PX*2);
      ctx.globalAlpha = 0.66;
      drawFsIcon(ctx, r.x, r.y, r.w, '#cfe6ff', isFullscreen());
      ctx.globalAlpha = 1;
    }

    /**
     * ★ **연쇄와 스침.** (기획 7·6, 2026-08-27)
     *
     * 연쇄는 **남은 시간을 막대로** 같이 보여준다 — 숫자만 있으면 언제 끊기는지를
     * 몰라서 서두를 이유가 안 생긴다. 그 막대가 줄어드는 것을 보는 것이
     * 이 장치의 전부다.
     */
    if(!this.p2){
      const CX = UIW - 150;
      if(this.chainT > 0 && this.killStreak >= 3){
        const mul = this.chainMul();
        const k = clamp(this.chainT / CHAIN_HOLD, 0, 1);
        const hot = k < 0.34 && Math.floor(this.t*10) % 2 === 0;   // 끊기기 직전에 깜빡
        drawText(ctx, 'x' + mul.toFixed(1), CX, 86, 5,
          { align:'center', color: hot ? '#ff4d5a' : PAL.gold, outline:PAL.outline, shadow:'#000' });
        ko(ctx, this.killStreak + '연속', CX, 130, 2, { align:'center', color:'#cfe6ff' });
        ctx.fillStyle = '#1a2440'; ctx.fillRect(CX - 60, 152, 120, PX*2);
        ctx.fillStyle = hot ? '#ff4d5a' : PAL.fire[3];
        ctx.fillRect(CX - 60, 152, snap(120*k), PX*2);
      }
      if(this.grazeTotal > 0){
        const big = this.grazeFlash > 0;
        ctx.globalAlpha = big ? 1 : 0.62;
        ko(ctx, '스침 ' + this.grazeTotal, CX, 174, big ? 3 : 2,
          { align:'center', color: big ? '#ffffff' : '#8fb8e0' });
        ctx.globalAlpha = 1;
      }
    }
    if(false) drawText(ctx, 'STAGE ' + this.stage, uiCx(), 52, 2,
      { align:'center', color:'#dff0ff', shadow:'#0a1830' });
    /**
     * ★ **스테이지 제목과 겹치던 것을 내렸다.** (2026-08-26, 사용자 지정)
     *
     * 제목은 y=46 에 크기 3(약 33px)이라 y=68 까지 내려온다. 그 자리에 안내를
     * 겹쳐 놓았으니 글자가 서로 파먹었다. 제목 아래로 완전히 비켜 세우고,
     * 안내는 안내답게 흐리게 — 계속 떠 있는 글씨가 진하면 화면이 시끄럽다.
     */
    if(!this.p2 && !this.joining){
      /* ★ 맨 아래로 내렸다 — 위쪽은 보스 이름·체력바와 겹쳐서 글자가 서로 파먹었다 */
      const pa = ctx.globalAlpha;
      ctx.globalAlpha = pa * 0.28;
      ko(ctx, 'W A S D 를 누르면 2인 플레이', uiCx(), UIH - 20, 2,
        { align:'center', color:P2_COLOR });
      ctx.globalAlpha = pa;
    }
    /**
     * 잡고 있다는 표시 — 필살기 쉴드와 **같은 크기**지만 훨씬 옅다.
     * 쉴드처럼 진하게 그리면 무적인 줄 안다. "눌린 느낌" 만 나면 된다.
     */
    if(this.dragId !== null && this.p1 && !this.p1.out){
      const p = this.p1, r = p.shieldR;
      const k = Math.min(1, this.dragT * 6);          // 잡는 순간 부드럽게 나타난다
      ctx.globalAlpha = 0.16 * k;
      fillPixelCircle(ctx, p.x, p.y, r, '#9fd8ff');
      ctx.globalAlpha = 0.42 * k;
      drawPixelRing(ctx, p.x, p.y, r, PX*2, '#9fd8ff');
      ctx.globalAlpha = 1;
    }

    /* 따라가기를 켜고 끌 때 짧게 알린다 — 눌러도 안 움직이면 고장인 줄 안다 */
    if(this.followT > 0){
      const pa = ctx.globalAlpha;
      ctx.globalAlpha = pa * Math.min(1, this.followT / 0.4);
      ko(ctx, this.followMouse ? '마우스 따라가기 켜짐 (더블클릭으로 끄기)' : '마우스 따라가기 꺼짐',
        uiCx(), 636, 2, { align:'center', color:'#9fe8ff', outline:PAL.outline });
      ctx.globalAlpha = pa;
    }

    /**
     * 방금 짜고 들어온 적 대형 이름.
     *
     * ★ **오른쪽 위에서 왼쪽 가운데로 옮겼다.** (2026-08-27, 사용자 지적)
     * *"장벽대형, 별대형, 등등 이름이 등장하는데, 그건 화면 왼쪽 중간에 나오게해,
     *   콤보로 올라가는거 글씨랑 겹친다"*
     *
     * 연쇄 배수(`x3.4`)와 스침 수를 오른쪽 위에 세우면서 자리가 겹쳤다.
     * 왼쪽 가운데는 좌상단 패널 아래이고 플레이어가 노는 자리(x 320 안팎)보다
     * 왼쪽이라 **아무것도 안 가린다.**
     */
    if(this.formT > 0 && this.formName){
      const pa = ctx.globalAlpha;
      ctx.globalAlpha = pa * Math.min(1, this.formT / 0.5) * 0.85;
      ko(ctx, this.formName + ' 대형', UIW - 30, UIH/2 - 12, 3,
        { align:'right', color:'#9fe8ff', outline:PAL.outline });
      ctx.globalAlpha = pa;
    }

    /**
     * ★ **금화를 화면에 띄운다.** (2026-08-26, 사용자 지정)
     *
     * 이 게임에서 금화는 점수만큼 중요한데(순위표가 따로 있다) 정작 게임 중에는
     * 몇 개를 모았는지 볼 데가 없었다. 먹는 재미가 숫자로 보여야 더 먹으러 다닌다.
     *
     * 자리는 **1P 정보창 반대쪽 아래**다. 혼자면 정보창이 왼쪽 위라 금화는 왼쪽 아래,
     * 2P 가 붙으면 1P 정보창이 오른쪽 위로 가므로 금화도 오른쪽 아래로 따라간다 —
     * 내 정보는 한쪽에 모여 있어야 눈이 왔다 갔다 하지 않는다.
     */
    /* 금화는 이제 점수 옆(정보창)에 있다 — 여기서 또 그리면 두 군데가 된다 */

    /**
     * ★ **2P 는 손님이다.** (2026-08-26, 사용자 지정)
     *
     * 점수도 금화도 기록도 전부 1P 계정으로만 간다. 둘이 붙어 앉아 점수를
     * 올릴 생각이면 1P 를 잡아야 한다 — 그걸 모르고 2P 로 열심히 하면 억울하다.
     * 진짜 둘이 겨루고 싶으면 멀티게임으로 가라는 뜻이기도 하다.
     */
    if(this.p2){
      const pa = ctx.globalAlpha;
      ctx.globalAlpha = pa * 0.42;
      ko(ctx, '점수와 금화는 1P 에게만 쌓입니다', uiCx(), UIH - 20, 2,
        { align:'center', color:P2_COLOR });
      ctx.globalAlpha = pa;
    }

    for(const p of this.players()){
      if(p.comboT <= 0 || p.combo <= 0) continue;
      const bx = p.pid === 1 ? this.btnMsl.x : (this.btnMsl2 ? this.btnMsl2.x : 0);
      drawText(ctx, 'x' + (p.combo*3), bx, UIH - 42, 3,
        { align:'center', color:PAL.fire[1], outline:PAL.outline });
    }
    if(this.pickupT > 0 && this.pickupMsg){
      const pa = ctx.globalAlpha;
      ctx.globalAlpha = pa * Math.min(1, this.pickupT/0.4);
      /* ★ 5 → 3 (2026-08-27, 사용자 지정). `Popups` 와 다른 경로라 따로 남아 있었다 */
      ko(ctx, this.pickupMsg, uiCx(), 200, 3,
        { align:'center', color:PAL.gold, outline:PAL.outline });
      ctx.globalAlpha = pa;
    }

    const b = this.boss;
    if(b && !b.dead){
      const w = 720, x = uiCx() - w/2, y = 110;
      ctx.fillStyle = '#0a0a14'; ctx.fillRect(x - PX, y - PX, w + PX*2, 20 + PX*2);
      ctx.fillStyle = '#2a2030'; ctx.fillRect(x, y, w, 20);
      const k = clamp(b.hp / b.maxHp, 0, 1);
      ctx.fillStyle = b.enraged ? PAL.fire[5] : PAL.fire[3];
      ctx.fillRect(x, y, snap(w*k), 20);
      ctx.fillStyle = PAL.fire[1]; ctx.fillRect(x, y, snap(w*k), 6);
      drawText(ctx, b.name, uiCx(), y - 24, 3, { align:'center', color:PAL.white, outline:PAL.outline, shadow:'#000' });
    }
    /**
     * ★ **판 시작에 규칙을 한 줄 예고한다.** (기획 4)
     * 모르고 당하는 것은 난이도가 아니라 사고다.
     */
    if(this.ruleT > 0 && this.rule && STAGE_RULES[this.rule]){
      const R = STAGE_RULES[this.rule];
      const a = Math.min(1, this.ruleT / 0.6);
      ctx.globalAlpha = a;
      ko(ctx, R.ko, uiCx(), 210, 8,
        { align:'center', color:PAL.gold, outline:PAL.outline, shadow:'#000' });
      ko(ctx, R.hint, uiCx(), 280, 3,
        { align:'center', color:'#ffe6b0', outline:PAL.outline });
      ctx.globalAlpha = 1;
    }
    if(this.bossBannerT > 0 && Math.floor(this.bossBannerT*6) % 2 === 0){
      drawText(ctx, 'WARNING', uiCx(), 300, 10,
        { align:'center', color:(r)=>PAL.fire[r], outline:PAL.outline, shadow:'#000', shadowOff:10 });
    }

    /* 남은 시간 — 신발게임 게이지와 같은 짜임새 (아래 drawTimeBar 주석) */
    drawTimeBar(ctx, timeBar(), clamp(this.timeLeft / (this.duel ? DUEL.TIME : STAGE_TIME), 0, 1), this.t);

    drawText(ctx, this.p2 ? '1P: ARROWS / RSHIFT / RALT     2P: WASD / ` / 1'
                          : '1P: ARROWS / RSHIFT / RALT     ESC: PAUSE', uiCx(), 700, 2,
      { align:'center', color:'#cfe6ff', shadow:'#0a1830' });

    if(this.state === 'pause') this.renderPause(ctx);
    else if(this.state !== 'play') this.renderEnd(ctx);
  }

  renderPause(ctx){
    ctx.globalAlpha = 0.78; ctx.fillStyle = '#0a0616'; ctx.fillRect(0,0,UIW,UIH);
    ctx.globalAlpha = 1;
    ko(ctx, '일시정지', uiCx(), 208, 6, { align:'center', color:PAL.gold, outline:PAL.outline });

    const items = this.pauseItems();
    const pRects = items.map((_, i) => this.pauseRect(i));
    const pScale = koFitAll(items.map(it => it.t), pRects, 4);
    for(let i=0;i<items.length;i++){
      const on = i === this.menuIdx;
      const r = pRects[i];
      /* 버튼처럼 보이게 그린다 — 눌러도 되는 자리라는 걸 알아야 누른다 */
      ctx.fillStyle = on ? PAL.gold : '#2a2140';
      ctx.fillRect(r.x - PX, r.y - PX, r.w + PX*2, r.h + PX*2);
      ctx.fillStyle = on ? '#3a2a05' : '#150f26';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      koFitBox(ctx, items[i].t, r, pScale,
        { color: on ? PAL.gold : '#8a93b8', outline:PAL.outline });
    }
    const last = this.pauseRect(items.length - 1);
    ko(ctx, '화면을 눌러도 됩니다', uiCx(), last.y + last.h + 28, 2,
      { align:'center', color:'#8a7bb8' });
  }

  /**
   * 금화 정산. 여섯 걸음을 순서대로 그린다 — `TALLY` 가 시각을 갖고 있으므로
   * 여기서는 **지금 몇 번째 걸음인지**만 보고 그린다.
   * @returns 아직 도는 중이면 true (표와 버튼은 그동안 기다린다)
   */
  renderTally(ctx){
    const t = this.tallyT;
    if(t < 0) return false;
    const own = RUN.wallet0 | 0, gain = RUN.coins | 0, total = own + gain;
    const done = t >= TALLY.end;

    /**
     * ★ **다 끝난 뒤에는 절반만 남긴다.** (2026-08-27, 사용자 지적)
     * *"게임오버 뜨는 순간 뒤 숫자 화면은 투명도 50프로 먹어. 뒤에 숫자가 너무 밝아"*
     * 게임오버 글씨와 표가 앞에 올라오므로, 뒤의 숫자가 그대로 밝으면 서로 싸운다.
     */
    ctx.save();
    if(done) ctx.globalAlpha = 0.5;
    else {
      /* 정산 동안에는 배경을 더 어둡게 깐다 — 이 순간만큼은 이것 하나만 보여야 한다 */
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = '#07040e'; ctx.fillRect(0, 0, UIW, UIH);
      ctx.globalAlpha = 1;
    }

    /* 쏟아지는 금화는 **숫자 뒤에** — 앞에 있으면 정작 볼 것을 가린다 */
    for(const c of this.tallyCoins){
      if(c.t < 0) continue;
      drawCoin(ctx, snap(c.x), snap(c.y), c.r, c.ph + c.t*6 + (c.roll || 0));
    }

    /**
     * ★ **끝나면 위로 물러난다.** (2026-08-27)
     * 50% 로 낮춰도 화면 한가운데에 그대로 있으면 **표를 정통으로 가린다.**
     * 다 끝난 뒤에는 제목 뒤(위쪽)로 올라가 배경 노릇만 한다 —
     * "지금 이만큼 있다" 는 것만 남기고 자리는 표에 내준다.
     */
    const CY = done ? 118 : 300;
    const kOwn = tallyK(t, TALLY.own), kPlus = tallyK(t, TALLY.plus);
    const kGain = tallyK(t, TALLY.gain), kEq = tallyK(t, TALLY.eq);
    const kRoll = tallyK(t, TALLY.roll), kBoom = tallyK(t, TALLY.boom);

    /**
     * 한 줄짜리 공식 — `보유 + 획득 = 합계`.
     * 자리는 **글자 폭을 재서** 잡는다. 자릿수가 늘어도 가운데가 안 흔들린다.
     */
    const FS = 4;                                   // 왼쪽 셈 부분
    const own$ = num(own), gain$ = num(gain);
    let shown = total;
    if(kRoll >= 0 && kRoll < 1){
      /* 슬롯머신 — 끝에 가까울수록 천천히 (착 붙는 느낌) */
      const e = 1 - Math.pow(1 - kRoll, 3);
      shown = Math.round(own + gain*e);
      if(Math.floor(t*40) % 2 === 0) shown += Math.floor(Math.random()*9);
    }else if(kRoll < 0) shown = own;
    const tot$ = num(shown);

    /* ⑥ 팡 터진 뒤에는 합계만 크게 남는다 */
    const bigK = kBoom >= 0 ? Math.min(1, kBoom*1.6) : 0;
    let rs = 6;
    if(kBoom >= 0 && kBoom <= 1) rs = 6 + Math.sin(bigK*Math.PI)*14 + Math.sin(kBoom*Math.PI*3.2)*1.4;
    else if(kBoom > 1) rs = 19 + Math.sin(t*3.2)*0.7;
    if(done) rs = 11;                               // 물러난 뒤에는 배경 크기로
    rs = Math.min(rs, (UIW - 80) / Math.max(1, koMeasure(tot$, 1)));

    /* 공식 왼쪽은 터질 때 스며들어 사라진다 — 볼 것이 하나로 좁혀진다 */
    const lhsA = kBoom < 0 ? 1 : Math.max(0, 1 - kBoom*2.2);
    const gapW = 22;
    const wOwn = koMeasure(own$, FS), wPlus = koMeasure('+', FS);
    const wGain = koMeasure(gain$, FS), wEq = koMeasure('=', FS);
    const wTot = koMeasure(tot$, rs);
    const lhsW = (kOwn >= 0 ? wOwn : 0) + (kPlus >= 0 ? wPlus + gapW : 0)
               + (kGain >= 0 ? wGain + gapW : 0) + (kEq >= 0 ? wEq + gapW : 0);
    /* 터지면 합계만 남으므로 그때는 합계를 화면 한가운데에 놓는다 */
    const groupW = lhsW*lhsA + (kRoll >= 0 ? wTot + gapW*lhsA : 0);
    let x = uiCx() - groupW/2;

    if(lhsA > 0){
      ctx.globalAlpha = lhsA;
      if(kOwn >= 0){
        const sc2 = FS * (kOwn < 1 ? popEase(kOwn) : 1);
        ko(ctx, own$, x + wOwn/2, CY - KO_H*sc2/2, Math.max(1, sc2),
          { align:'center', color:PAL.gold, outline:PAL.outline, shadow:'#000' });
        ko(ctx, '보유', x + wOwn/2, CY + 40, 2, { align:'center', color:'#8a9bbf' });
        x += wOwn;
      }
      if(kPlus >= 0){
        x += gapW;
        const sc2 = FS * (kPlus < 1 ? popEase(kPlus) : 1);
        ko(ctx, '+', x + wPlus/2, CY - KO_H*sc2/2, Math.max(1, sc2),
          { align:'center', color:'#ffffff', outline:PAL.outline });
        x += wPlus;
      }
      if(kGain >= 0){
        x += gapW;
        const sc2 = FS * (kGain < 1 ? popEase(kGain) : 1);
        ko(ctx, gain$, x + wGain/2, CY - KO_H*sc2/2, Math.max(1, sc2),
          { align:'center', color:'#7fffa8', outline:PAL.outline, shadow:'#000' });
        ko(ctx, '획득', x + wGain/2, CY + 40, 2, { align:'center', color:'#8a9bbf' });
        x += wGain;
      }
      if(kEq >= 0){
        x += gapW;
        const sc2 = FS * (kEq < 1 ? popEase(kEq) : 1);
        ko(ctx, '=', x + wEq/2, CY - KO_H*sc2/2, Math.max(1, sc2),
          { align:'center', color:'#ffffff', outline:PAL.outline });
        x += wEq;
      }
      ctx.globalAlpha = 1;
    }
    if(kRoll >= 0){
      const cx = lhsA > 0 ? (x + gapW*lhsA + wTot/2) : uiCx();
      ko(ctx, tot$, cx, CY - KO_H*rs/2, Math.max(4, rs),
        { align:'center', color:PAL.gold, outline:PAL.outline, shadow:'#000' });
      /**
       * ★ 큰 숫자 아래의 '보유 금화' 딱지를 뺐다. (2026-08-27, 사용자 지정)
       * 화면을 채운 금화 더미와 커다란 숫자면 그것이 금화라는 걸 이미 안다 —
       * 글자를 하나라도 덜어야 숫자가 더 커 보인다.
       */
    }
    ctx.restore();
    /* 다 끝났으면 뒤로 물러나고 표·버튼에 자리를 내준다 */
    return !done;
  }

  renderEnd(ctx){
    const clear = this.state === 'clear';
    ctx.globalAlpha = Math.min(0.78, this.stateT * 1.6);
    ctx.fillStyle = clear ? '#0d1a10' : '#160a0e'; ctx.fillRect(0,0,UIW,UIH);
    ctx.globalAlpha = 1;
    if(this.stateT < 0.35) return;
    /* 정산이 도는 동안에는 표도 버튼도 안 낸다 — 한 번에 하나만 봐야 읽힌다 */
    if(this.renderTally(ctx)) return;
    const title = clear ? (this.duel ? '결투 종료' : '스테이지 클리어')
                        : (this.endReason || '게임오버');
    /* ★ 세 단계 작게 (2026-08-27, 사용자 지정) */
    ko(ctx, title, uiCx(), END_TITLE_Y, 4,
      { align:'center', color: clear ? PAL.gold : '#c81f2e', outline:PAL.outline });
    if(this.stateT > 0.6){
      /**
       * ★ 한글로 바꾸고 **획득 금화**를 넣었다. (2026-08-26, 사용자 지정)
       * 금화가 이 게임의 화폐인데 정작 한 판 끝나고 얼마 벌었는지 볼 데가 없었다.
       * 왼쪽 이름은 한글이라 오락실 글꼴로, 오른쪽 값은 숫자가 많아 게임 글꼴로 그린다.
       */
      /**
       * ★ **[이름, 숫자, 단위] 세 칸이다.** (2026-08-26, 사용자 지적)
       *
       * 예전에는 숫자와 단위를 한 덩어리로 붙여 `'12초'` 를 게임 글꼴로 그렸다.
       * 그 글꼴에는 **'초' 가 없다** — 이 게임 글꼴은 영문·숫자용이고 한글은
       * 오락실 글꼴(`ko`)에만 있다. 없는 글자가 끼면 폭 계산이 어긋나서
       * **오른쪽 정렬이 그 줄만 밀렸다.** "남은시간만 왼쪽 정렬 같다" 는 게 이것이다.
       *
       * 셋으로 가르면 숫자는 같은 오른쪽 끝에 딱 맞고, 단위는 그 뒤에서 왼쪽으로
       * 나란히 선다 — 표가 표처럼 보인다.
       */
      /**
       * ★ **단위를 뺐다.** (2026-08-27, 사용자 지정)
       * *"점/마리/초/개 이런건 빼, 없어도 딱 보면 알지"*
       * 그리고 단위가 빠지면서 오른쪽 끝이 저절로 한 줄로 곧게 선다.
       */
      /**
       * ★ **합산 총 금화 한 줄.** (2026-08-27, 사용자 지정)
       * *"뒤에 있으니 지금 총 보유 금화를 알 수가 없다"*
       * 큰 숫자는 뒤로 물러나 절반만 보이므로, 표 안에도 또박또박 적어 준다.
       */
      const totalCoins = (RUN.wallet0 | 0) + (RUN.coins | 0);
      const rows = clear
        ? [['점수', num(this.score)],
           ['시간 보너스', '+' + num(this.bonus)],
           ...(this.noHit ? [['무피격 금화', '+' + this.noHitCoin]] : []),
           ['킬수', num(this.kills)],
           ['파이어 레벨', String(this.p1.level)],
           ['획득 금화', num(RUN.coins)],
           ['합산 총 금화', num(totalCoins)]]
        : [['점수', num(this.score)],
           ['킬수', num(this.kills)],
           ['파이어 레벨', String(this.p1.level)],
           ['남은 시간', String(Math.ceil(this.timeLeft))],
           ['획득 금화', num(RUN.coins)],
           ['합산 총 금화', num(totalCoins)]];

      this.endRows = rows.length;      // 아래 문구·버튼 자리가 이 값에서 나온다
      /* 표의 위아래에 얇은 줄 — 어디서 시작하고 끝나는지 눈이 먼저 안다 */
      const gap = rows.length >= 7 ? END_ROW_GAP_TIGHT : END_ROW_GAP;
      const ruleW = END_NUM_R + 4 - END_LABEL_X;
      ctx.fillStyle = '#3a3358';
      ctx.fillRect(END_LABEL_X, END_ROW_Y - 22, ruleW, PX);
      ctx.fillRect(END_LABEL_X, END_ROW_Y + (rows.length - 1)*gap + 34, ruleW, PX);

      /**
       * ★★ **숫자도 이름과 같은 글꼴·같은 크기로.** (2026-08-27, 사용자 지적)
       *
       * *"점수 숫자의 숫자 폰트와 글씨 크기를 그 왼쪽 한글과 비슷한 크기로 맞춰,
       *   글씨 두께도 비슷하게 (...) 그 옆에 숫자는 너무 비현실적으로 작다"*
       *
       * 예전에는 이름은 오락실 글꼴(`ko`), 숫자는 게임 글꼴(`drawText`)이었다.
       * 두 글꼴은 같은 배율이어도 **글자 높이도 획 두께도 다르다.**
       * 오락실 글꼴에도 숫자가 있으므로 둘 다 그걸로 그린다 — 한 줄로 읽힌다.
       */
      for(let i=0;i<rows.length;i++){
        const y = END_ROW_Y + i*gap;
        if(this.stateT < 0.6 + i*0.10) break;
        const gold = rows[i][0] === '획득 금화' || rows[i][0] === '무피격 금화'
                  || rows[i][0] === '합산 총 금화';
        ko(ctx, rows[i][0], END_LABEL_X, y, 3,
          { color: gold ? '#ffd24a' : '#8a9bbf', outline:PAL.outline });
        ko(ctx, rows[i][1], END_NUM_R, y, 3,
          { align:'right', color: gold ? '#ffd24a' : PAL.white, outline:PAL.outline });
      }
    }
    if(this.stateT <= 1.1) return;
    // ---- 다음 행동 선택 ----
    const items = this.endItems();
    /* 셋이 같은 글자 크기로 — 가장 빡빡한 문구에 맞춘다 */
    const rects = items.map((_, i) => this.endRect(i));
    const bScale = koFitAll(items.map(it => it.t), rects, 4);
    /**
     * ★ **묻는 말은 버튼 글씨만 하게.** (2026-08-27, 사용자 지정)
     * *"'2스테이지로 갈까요?' 라는 메세지 크기를 '다음 스테이지'라는 글씨 크기 만큼 키워"*
     * 버튼이 정한 배율을 그대로 쓴다 — 버튼이 커지든 작아지든 늘 같이 간다.
     */
    if(clear && this.stage < 20)
      ko(ctx, (this.stage + 1) + '스테이지로 갈까요?', uiCx(), this.endAskY(), bScale,
        { align:'center', color:'#cfe6ff', outline:PAL.outline });
    for(let i=0;i<items.length;i++){
      const on = i === this.endIdx;
      const r = rects[i];
      const off = !!items[i].off;                 // 못 누르는 버튼 (금화 부족 등)
      ctx.fillStyle = off ? '#2a2438' : (on ? PAL.gold : '#241c3e');
      ctx.fillRect(r.x - PX, r.y - PX, r.w + PX*2, r.h + PX*2);
      ctx.fillStyle = off ? '#15121f' : (on ? '#3a2a05' : '#120d24');
      ctx.fillRect(r.x, r.y, r.w, r.h);
      /* 글자는 박스가 정한다 — 문구가 길어져도 뚫고 나오지 않는다 */
      koFitBox(ctx, items[i].t, r, bScale,
        { color: off ? '#4f4a60' : (on ? PAL.gold : '#7f8bb0'), outline:PAL.outline });
      if(on && !off){
        const g = Math.round(Math.sin(this.stateT*7))*PX;
        ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2;
        ctx.strokeRect(r.x - PX*2 - g, r.y - PX*2 - g, r.w + (PX*2+g)*2, r.h + (PX*2+g)*2);
      }
    }
    ko(ctx, '화면을 눌러도 됩니다', uiCx(), this.endHintY(), 2, { align:'center', color:'#8a7bb8' });
  }

  renderDebug(ctx){
    ctx.save(); ctx.translate(Shake.x, Shake.y);
    ctx.lineWidth = 2;
    for(const p of this.players()){
      const m = p.metrics, hb = p.hitbox;
      ctx.strokeStyle = p.pid === 1 ? '#00ff88' : '#ff88ff'; ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
      ctx.strokeStyle = 'rgba(255,80,120,.5)'; ctx.strokeRect(snap(p.x - m.w/2), snap(p.y - m.h/2), m.w, m.h);
    }
    ctx.strokeStyle = '#ff4d5a';
    for(const e of this.enemies){ const b = e.box; ctx.strokeRect(b.x, b.y, b.w, b.h); }
    ctx.restore();
    drawText(ctx, 'ENEMY ' + this.enemies.length + '  BOLT ' + this.bolts.length
      + '  PMSL ' + this.pmissiles.length + '  PART ' + Particles.count
      + '  KEY ' + Input.lastKey, 16, 604, 2, { color:'#00ff88' });
    drawText(ctx, '1P msl' + this.p1.missileCount + ' bomb' + this.p1.bombCount + ' hp' + this.p1.hp
      + (this.p2 ? ('   2P msl' + this.p2.missileCount + ' bomb' + this.p2.bombCount + ' hp' + this.p2.hp) : ''),
      16, 622, 2, { color:'#00ff88' });
    drawHUDDebug(ctx);
  }
}

function mkDragonPal(o){
  return {
    K: o.line, D: o.dark, M: o.mid, L: o.light, T: o.tail || o.wing,
    E: o.eye,  H: o.eyeHi || '#ffffff', N: o.line,
    G: o.horn, S: o.spike, C: o.claw || '#eae4f2', W: '#fff4f4',
    P: o.armor || o.mid, w: o.wing, f: o.bone, k: mixHex(o.line, '#ffffff', 0.12),
    /* 목구멍 — 입을 벌렸을 때만 쓴다. 몸통보다 훨씬 어둠고 붉어야
       '입을 벌렸다' 로 읽힌다 — 같은 어두운 색이면 그냥 턱이 넣은 것처럼 보인다 */
    R: o.maw || '#59060f'
  };
}

const DRAGONS = [
  { id:'NOVART', ko:'노바트', koTheme:'검은 비늘 · 붉은 눈', koTrait:'처음 함께하는 드래곤',    theme:'BLACK / CRIMSON EYE', trait:'THE STARTER',       always:[],
    pal: mkDragonPal({ line:'#0d0912', dark:'#241d33', mid:'#3a3050', light:'#544772',
      wing:'#2e2743', bone:'#4a3d68', eye:'#ff2b3c', eyeHi:'#ffd9dc',
      horn:'#b8a9d4', spike:'#8f7ec4' }) },

  { id:'SOLARIS', ko:'솔라리스', koTheme:'황금빛 · 호박색 배', koTrait:'태양에서 태어났다',   theme:'YELLOW / AMBER BELLY', trait:'BORN OF THE SUN',  always:[],
    pal: mkDragonPal({ line:'#3a1c05', dark:'#a85f12', mid:'#d98b1c', light:'#ffc93c',
      wing:'#b56a15', bone:'#e0952a', eye:'#ff5a1e', eyeHi:'#fff0c0',
      horn:'#fff0b0', spike:'#ffae3a' }) },

  { id:'AQUANTIS', ko:'아쿠안티스', koTheme:'하늘색 · 흰 배', koTrait:'지느러미 날개',  theme:'SKY / WHITE',          trait:'FINNED WINGS',     always:[],
    pal: mkDragonPal({ line:'#0a2540', dark:'#1d5a86', mid:'#2f86b4', light:'#7fd0e8',
      wing:'#2a6f9e', bone:'#4fa8cc', eye:'#d8f6ff', eyeHi:'#ffffff',
      horn:'#eaffff', spike:'#9fe4f4' }) },

  { id:'FORESTIA', ko:'포레스티아', koTheme:'초록 · 잎사귀 무늬', koTrait:'숲의 수호자',  theme:'GREEN / LEAF',         trait:'LEAF PATTERNED',   always:[],
    pal: mkDragonPal({ line:'#0d2410', dark:'#245c26', mid:'#3d8a34', light:'#8fd44a',
      wing:'#2c6b2a', bone:'#57a83e', eye:'#ffe14a', eyeHi:'#fffbe0',
      horn:'#d8f0a0', spike:'#a8d860' }) },

  { id:'CRIMSONDE', ko:'크림슨데', koTheme:'진홍 · 검정', koTrait:'쌍뿔의 전사', theme:'SCARLET / BLACK',      trait:'TWIN HORNS',       always:['crest'],
    pal: mkDragonPal({ line:'#14040a', dark:'#6b0f22', mid:'#a3162e', light:'#d93a44',
      wing:'#4a0a18', bone:'#7d1526', eye:'#ffd24a', eyeHi:'#fffbe0',
      horn:'#ffd0c0', spike:'#ff6a4a' }) },

  { id:'FROSTWING', ko:'프로스트윙', koTheme:'흰빛 · 얼음 파랑', koTrait:'서리 날개', theme:'WHITE / BLUE',         trait:'FROSTED WINGS',    always:[],
    pal: mkDragonPal({ line:'#0e2440', dark:'#6f93b8', mid:'#a8c8e0', light:'#e8f6ff',
      wing:'#7fa8cc', bone:'#b8d8f0', eye:'#4fd0ff', eyeHi:'#ffffff',
      horn:'#ffffff', spike:'#cfeaff' }) },

  { id:'VOLTTAIL', ko:'볼트테일', koTheme:'보라 · 번개 노랑', koTrait:'번개 꼬리',  theme:'VIOLET / YELLOW',      trait:'LIGHTNING TAIL',   always:['ridge'],
    pal: mkDragonPal({ line:'#150829', dark:'#45208a', mid:'#6a35b8', light:'#9a5fe0',
      wing:'#3a1a70', bone:'#7a45c0', eye:'#ffe14a', eyeHi:'#fffbe0',
      horn:'#ffe14a', spike:'#ffd24a' }) },

  { id:'SANDSCALE', ko:'샌드스케일', koTheme:'모래빛 · 갈색', koTrait:'가시 등딱지', theme:'SAND / BROWN',         trait:'SPINED BACK',      always:['ridge'],
    pal: mkDragonPal({ line:'#2a1a08', dark:'#8a6a34', mid:'#b8934a', light:'#e0c078',
      wing:'#6b4f26', bone:'#a07a3a', eye:'#ff9a3a', eyeHi:'#ffe8c0',
      horn:'#f0dcb0', spike:'#c9a05a' }) },

  { id:'SHADOWFEN', ko:'섀도우펜', koTheme:'남색 · 은빛', koTrait:'은빛 눈동자', theme:'NAVY / SILVER',        trait:'SILVER EYES',      always:[],
    pal: mkDragonPal({ line:'#05060f', dark:'#141a3a', mid:'#232c56', light:'#3a4578',
      wing:'#101632', bone:'#2b3560', eye:'#e0e8f8', eyeHi:'#ffffff',
      horn:'#c8d0e0', spike:'#9aa8c8' }) },

  { id:'GOLDREX', ko:'골드렉스', koTheme:'황금 · 흰빛', koTrait:'전설의 드래곤',   theme:'GOLD / WHITE',         trait:'THE LEGEND',       always:['crest','ridge'],
    pal: mkDragonPal({ line:'#3a2a05', dark:'#a8801a', mid:'#d9a92c', light:'#ffe07a',
      wing:'#b8891f', bone:'#e8c04a', eye:'#ffffff', eyeHi:'#fffbe0',
      horn:'#fffbe0', spike:'#ffe8a0', armor:'#fff0b0' }) }
];

function currentDragon(){ return DRAGONS[clamp(Save.data.dragon | 0, 0, DRAGONS.length - 1)]; }

/* ==================================================================
   Phase 10 : 컨트롤러 설정 / 전체화면 / 게임패드
   ================================================================== */
const OPT_DEFAULT = {
  stickSize:1, stickAlpha:0.42, stickFloat:0,     // 0=좌하단 고정, 1=터치한 곳에 생성
  btnSize:1,   btnAlpha:0.5,
  bgmOn:1, sfxOn:1,
  /**
   * 패드 하나를 스틱 둘로 갈라 두 사람이 쓰는가. (2026-08-26, 사용자 지정)
   * 패드가 하나뿐인 사람도 2인 플레이를 볼 수 있게 하려는 것이고,
   * 혼자서 캐릭터 둘을 굴리는 것도 된다.
   */
  splitPad:0
};
const STICK_R = [62, 78, 96], BTN_R = [54, 68, 82];

function optGet(){
  // 매번 새 객체를 만들면 참조가 끊기고 프레임마다 할당이 생기므로 1회만 정규화한다
  const o = Save.data.opt;
  if(!o || o._v !== 1)
    Save.data.opt = Object.assign({ _v:1 }, OPT_DEFAULT, o || {});
  Input.splitPad = !!Save.data.opt.splitPad;
  return Save.data.opt;
}
/* 설정을 실제 컨트롤에 반영 */
/**
 * ★ 화면이 돌면 단추 자리를 다시 잡는다 (2026-08-27).
 * 세로에서는 화면이 720 밖에 안 되므로 1280 기준 자리는 화면 밖이다.
 */
function makeStickCfg(){
  const o = optGet(), r = STICK_R[clamp(o.stickSize,0,2)];
  return { x:158, y:GAME_H-158, radius:r, knob:Math.round(r*0.38),
           alpha:o.stickAlpha, dead:0.16, float:!!o.stickFloat };
}
function applyAudioOpt(){
  const o = optGet();
  SND.setBgmOn(!!o.bgmOn); SND.setSfxOn(!!o.sfxOn);
}

/* 전체화면 — 오락실의 core/fullscreen.js 가 맡는다.
   단일 HTML 이던 시절에는 이 게임이 자체 구현(전체화면 버튼·안내 토스트·
   유사 전체화면 폴백)을 들고 있었다. 이제 그 DOM 이 없고, 무엇보다 오락실에
   같은 일을 하는 모듈이 이미 있다 — 두 벌을 두면 한쪽만 고치게 된다.

   방향은 여기서 가로로 건다. 신발을 찾아서는 세로라 각자 자기 것을 건다. */
function toggleFullscreen(){
  if(isFullscreen()){ exitFullscreen(); return; }
  enterFullscreen().then((ok) => { if(ok) lockLandscape(); });
}

/* 전체화면 아이콘 (네 모서리 꺾쇠). on=true 면 안쪽을 향하는 축소 아이콘 */
function drawFsIcon(ctx, x, y, size, color, on){
  const t = Math.max(PX, Math.round(size/9));      // 선 두께
  const l = Math.round(size*0.40);                 // 꺾쇠 길이
  ctx.fillStyle = color;
  const corner = (cx, cy, sx, sy) => {
    ctx.fillRect(cx - (sx<0 ? l : 0), cy - (sy<0 ? t : 0), l, t);
    ctx.fillRect(cx - (sx<0 ? t : 0), cy - (sy<0 ? l : 0), t, l);
  };
  const x0 = x, y0 = y, x1 = x + size, y1 = y + size;
  if(!on){
    corner(x0, y0,  1,  1); corner(x1, y0, -1,  1);
    corner(x0, y1,  1, -1); corner(x1, y1, -1, -1);
  }else{
    const m = Math.round(size*0.28);
    corner(x0+m, y0+m, -1, -1); corner(x1-m, y0+m,  1, -1);
    corner(x0+m, y1-m, -1,  1); corner(x1-m, y1-m,  1,  1);
  }
}

/* ==================================================================
   OptionsScene
   ================================================================== */
class OptionsScene extends Scene {
  enter(){
    this.t = 0; this.sel = 0; this.confirmReset = 0;
    this.bg = buildSky([{p:0,c:'#0a0818'},{p:.5,c:'#161030'},{p:1,c:'#2c1a44'}]);
    optGet();
    // 미리보기용 컨트롤
    this.rebuildPreview();
    Input.pointerHandler = {
      down:(id,x,y) => {
        for(let i=0;i<this.rows.length;i++){
          const y0 = this.rowY(i);
          if(y >= y0 - 8 && y <= y0 + 30 && x < 720){
            if(this.sel === i) this.act(1); else { this.sel = i; SND.sfx('blip'); }
            return;
          }
        }
      }
    };
  }
  exit(){ Input.pointerHandler = null; Save.save(); }

  rebuildPreview(){
    this.pStick = new VirtualStick(makeStickCfg());
    const o = optGet(), r = BTN_R[clamp(o.btnSize,0,2)];
    this.pMsl  = new TouchButton(880,  520, r, ICON_MISSILE, 4, '#8fd0ff');
    this.pBomb = new TouchButton(1080, 440, r, ICON_BOMB,    4, PAL.gold);
    this.pAlpha = o.btnAlpha;
  }

  /**
   * 설정 항목. **12줄에서 8줄로 줄였다.** (2026-08-26)
   *
   * 덜어낸 것과 이유:
   *   · 전체화면  — 오락실 화면에 있다. 두 곳에 두면 어느 쪽이 진짜인지 헷갈린다.
   *   · 게임패드  — 연결 상태를 보여줄 뿐 바꿀 수 있는 게 없다. 설정이 아니다.
   *   · 진행 초기화 — 기록이 계정에 있는 지금은 여기서 지울 것이 없다. 위험하기만 하다.
   *   · 스틱/버튼 투명도 두 줄 — 따로 맞출 이유가 없어 「조작 투명도」 하나로 합쳤다.
   */
  get rows(){
    const o = optGet();
    const pct = v => Math.round(v*100) + '%';
    const SIZE = ['작게','보통','크게'];
    return [
      { k:'스틱 크기',   v:SIZE[o.stickSize],  set:d=>{ o.stickSize = clamp(o.stickSize+d,0,2); } },
      { k:'스틱 방식',   v:o.stickFloat ? '누른 자리에' : '고정',
        set:d=>{ o.stickFloat = o.stickFloat ? 0 : 1; } },
      { k:'버튼 크기',   v:SIZE[o.btnSize],    set:d=>{ o.btnSize = clamp(o.btnSize+d,0,2); } },
      { k:'조작 투명도', v:pct(o.btnAlpha),
        set:d=>{ const a = clamp(+(o.btnAlpha + d*0.1).toFixed(2), 0.2, 0.8);
                 o.btnAlpha = a; o.stickAlpha = a; } },
      { k:'패드 스틱 나눠쓰기', v:o.splitPad ? '켜짐 (1P 오른쪽 · 2P 왼쪽)' : '꺼짐',
        set:d=>{ o.splitPad = o.splitPad?0:1; Input.splitPad = !!o.splitPad; } },
      { k:'배경음',      v:o.bgmOn ? '켜짐' : '꺼짐', set:d=>{ o.bgmOn = o.bgmOn?0:1; applyAudioOpt(); } },
      { k:'효과음',      v:o.sfxOn ? '켜짐' : '꺼짐', set:d=>{ o.sfxOn = o.sfxOn?0:1; applyAudioOpt(); } },
      { k:'배경음 곡',   v:(Save.data.bgm+1) + '. ' + BGM_TRACKS[Save.data.bgm].name,
        set:d=>{ Save.data.bgm = (Save.data.bgm + d + BGM_TRACKS.length) % BGM_TRACKS.length;
                 SND.resume(); SND.switchBgm(Save.data.bgm); } },
      { k:'게임로비로 돌아가기', v:'',  act:()=>{ backOut(this.mgr); } }
    ];
  }
  rowY(i){ return 132 + i*40; }

  act(fromTap){
    const r = this.rows[this.sel];
    if(r.act){ r.act(); SND.sfx('confirm'); }
    else if(r.set && fromTap){ r.set(1); this.rebuildPreview(); SND.sfx('blip'); }
  }

  update(dt){
    this.t += dt;
    if(this.confirmReset > 0) this.confirmReset -= dt;
    if(this.mgr.busy) return;
    const rows = this.rows;
    if(Input.pressed('up')){   this.sel = (this.sel + rows.length - 1) % rows.length; SND.sfx('blip'); }
    if(Input.pressed('down')){ this.sel = (this.sel + 1) % rows.length; SND.sfx('blip'); }
    const r = rows[this.sel];
    if(r.set){
      if(Input.pressed('left')){  r.set(-1); this.rebuildPreview(); SND.sfx('blip'); }
      if(Input.pressed('right')){ r.set( 1); this.rebuildPreview(); SND.sfx('blip'); }
    }
    if(Input.pressed('confirm')) this.act(0);
    if(Input.pressed('back') || Input.pressed('pause')) backOut(this.mgr);
  }

  render(ctx){
    ctx.drawImage(this.bg, 0, 0);
    ko(ctx, '설정', 640, 34, 6,
      { align:'center', color:PAL.gold, outline:PAL.outline });
    if(false) drawText(ctx, 'OPTIONS', 640, 40, 7,
      { align:'center', color:(r)=>PAL.fire[r], outline:PAL.outline, shadow:'#000', shadowOff:8 });

    const rows = this.rows;
    for(let i=0;i<rows.length;i++){
      const y = this.rowY(i), on = i === this.sel;
      if(on){
        ctx.fillStyle = 'rgba(255,210,74,.14)'; ctx.fillRect(48, y - 8, 660, 34);
        drawText(ctx, '>', 56, y, 4, { color:PAL.gold, outline:PAL.outline });
      }
      ko(ctx, rows[i].k, 92, y - 2, 3, { color: on ? PAL.white : '#7f8bb0' });
      if(rows[i].v)
        ko(ctx, rows[i].v, 700, y - 2, 3,
          { align:'right', color: on ? PAL.gold : '#5f6a8c' });
      if(on && rows[i].set){
        drawText(ctx, '<', 716, y, 3, { color:PAL.gold });
      }
    }

    // ---- 미리보기 ----
    ctx.fillStyle = 'rgba(10,8,22,.55)'; ctx.fillRect(760, 120, 496, 480);
    ctx.fillStyle = PAL.outline; ctx.fillRect(760, 120, 496, PX);
    ko(ctx, '미리보기', 1008, 130, 3, { align:'center', color:'#8a7bb8' });
    const o = optGet();
    // 스틱 (설정한 크기/투명도로)
    const sc = makeStickCfg();
    this.pStick.cfg = Object.assign({}, sc, { x:900, y:430 });
    this.pStick.dx = Math.cos(this.t*1.6)*sc.radius*0.5;
    this.pStick.dy = Math.sin(this.t*1.6)*sc.radius*0.5;
    this.pStick.render(ctx);
    if(o.stickFloat)
      drawText(ctx, 'APPEARS WHERE YOU TOUCH', 900, 430 + sc.radius + 26, 2,
        { align:'center', color:'#8a7bb8' });
    // 버튼
    ctx.globalAlpha = 1;
    this.pMsl.render(ctx, 3);
    this.pBomb.render(ctx, 2);

    ko(ctx, '위아래 : 고르기      좌우 : 바꾸기      엔터 : 확인', 640, 676, 3,
      { align:'center', color:'#8a7bb8' });
    if(false) drawText(ctx, 'UP-DOWN: SELECT    LEFT-RIGHT: CHANGE    ENTER: OK    ESC: BACK',
      640, 668, 2, { align:'center', color:'#8a7bb8' });
    if(DEBUG) drawHUDDebug(ctx);
  }
}

/* ==================================================================
   CharacterSelectScene
   ================================================================== */
class CharacterSelectScene extends Scene {
  constructor(){ super(); this.sel = 0; }
  enter(){
    this.t = 0;
    this.sel = clamp(Save.data.dragon | 0, 0, 9);
    this.pop = 0;                       // 선택 전환 시 확대 애니메이션
    this.bg = buildSky([{p:0,c:'#0b0818'},{p:.45,c:'#181031'},{p:.8,c:'#33184a'},{p:1,c:'#5a2450'}]);
    // 하단 썸네일 (FORM A 를 작게 1회만 구움)
    this.portraits = DRAGONS.map(d => {
      const f = FORMS.A, cell = 2.6;
      const { cv, c } = makeCanvas(Math.round(f.cols*cell), Math.round(f.rows*cell));
      drawGrid(c, f.wings[2], 0, 0, f.cols, cell, d.pal, false, null);
      drawGrid(c, f.body,     0, 0, f.cols, cell, d.pal, false, null);
      for(const nm of d.always) if(f.parts[nm]) drawGrid(c, f.parts[nm], 0, 0, f.cols, cell, d.pal, false, null);
      return cv;
    });
    this.stars = [];
    const rnd = mulberry32(51);
    for(let i=0;i<90;i++)
      this.stars.push({ x:snap(rnd()*GAME_W), y:snap(rnd()*420), s:rnd()>0.85?PX*2:PX,
                        ph:rnd()*6.3, sp:1+rnd()*2.6 });
    Input.pointerHandler = {
      down:(id,x,y) => {
        for(let i=0;i<10;i++){
          const r = this.slotRect(i);
          if(x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h){
            if(i === this.sel) this.confirm(); else this.move(i);
            return;
          }
        }
        this.confirm();
      }
    };
  }
  exit(){ Input.pointerHandler = null; }

  slotRect(i){ return { x: 96 + i*112, y: 556, w: 96, h: 84 }; }
  move(i){ if(i === this.sel) return; this.sel = i; this.pop = 1; SND.sfx('blip'); }
  confirm(){
    if(this.mgr.busy) return;
    SND.sfx('confirm');
    Save.data.dragon = this.sel; Save.save();
    DG.onCharacter(this.sel);
    /* 로비에서 [드래곤 변경] 으로 들어왔으면 고르는 순간 볼일이 끝났다 */
    DG.onExit();
  }

  update(dt){
    this.t += dt;
    if(this.pop > 0) this.pop = Math.max(0, this.pop - dt*3.4);
    if(this.mgr.busy) return;
    if(Input.pressed('left'))  this.move((this.sel + 9) % 10);
    if(Input.pressed('right')) this.move((this.sel + 1) % 10);
    if(Input.pressed('up'))    this.move((this.sel + 5) % 10);
    if(Input.pressed('down'))  this.move((this.sel + 5) % 10);
    if(Input.pressed('confirm')) this.confirm();
    if(Input.pressed('back') || Input.pressed('pause')) backOut(this.mgr);
  }

  render(ctx){
    ctx.drawImage(this.bg, 0, 0);
    for(const st of this.stars){
      ctx.globalAlpha = 0.3 + 0.7*(0.5 + 0.5*Math.sin(this.t*st.sp + st.ph));
      ctx.fillStyle = '#ffffff'; ctx.fillRect(st.x, st.y, st.s, st.s);
    }
    ctx.globalAlpha = 1;

    const d = DRAGONS[this.sel];
    ko(ctx, '드래곤 고르기', 640, 30, 6,
      { align:'center', color:PAL.gold, outline:PAL.outline });
    if(false) drawText(ctx, 'SELECT DRAGON', 640, 34, 6,
      { align:'center', color:(r)=>PAL.fire[r], outline:PAL.outline, shadow:'#000', shadowOff:7 });

    // ---- 가운데 큰 드래곤 (전환 시 확대 -> 원래대로) ----
    const f = FORMS.B;
    const bounce = 1 + this.pop*0.22;
    const cell = 7 * bounce;
    const cx = 640, cy = 300 + snap(Math.sin(this.t*2.2)*5);
    const ox = snap(cx - f.cols*cell/2), oy = snap(cy - f.rows*cell/2);
    const pose = FLY_SEQ[(this.t / 0.13 | 0) % FLY_SEQ.length];
    // 뒤쪽 광배
    ctx.globalAlpha = 0.16 + Math.sin(this.t*3)*0.05;
    fillPixelCircle(ctx, cx, cy + 20, 210, d.pal.M);
    ctx.globalAlpha = 1;
    if(pose !== 3) drawGrid(ctx, f.wings[pose], ox, oy, f.cols, cell, d.pal, false, null);
    drawGrid(ctx, f.body, ox, oy, f.cols, cell, d.pal, false, null);
    for(const nm of d.always) if(f.parts[nm]) drawGrid(ctx, f.parts[nm], ox, oy, f.cols, cell, d.pal, false, null);
    if(pose === 3) drawGrid(ctx, f.wings[pose], ox, oy, f.cols, cell, d.pal, false, null);

    // ---- 이름 / 설명 ----
    ko(ctx, d.ko, 640, 448, 7, { align:'center', color:PAL.gold, outline:PAL.outline });
    if(false) drawText(ctx, d.id, 640, 452, 8,
      { align:'center', color:(r)=>PAL.fire[r], outline:PAL.outline, shadow:'#000', shadowOff:8 });
    ko(ctx, d.koTheme, 640, 512, 3, { align:'center', color:'#cfe0ff' });
    ko(ctx, d.koTrait, 640, 542, 3, { align:'center', color:PAL.gold });
    drawText(ctx, String(this.sel+1).padStart(2,'0') + ' / 10', 1252, 34, 3,
      { align:'right', color:PAL.gold, outline:PAL.outline });

    // ---- 하단 10칸 ----
    for(let i=0;i<10;i++){
      const r = this.slotRect(i), on = i === this.sel, dd = DRAGONS[i];
      ctx.fillStyle = on ? PAL.gold : '#241c3e';
      ctx.fillRect(r.x - PX, r.y - PX, r.w + PX*2, r.h + PX*2);
      ctx.fillStyle = on ? '#2a2140' : '#120d24';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      const pt = this.portraits[i];
      ctx.globalAlpha = on ? 1 : 0.6;
      ctx.drawImage(pt, snap(r.x + (r.w - pt.width)/2), snap(r.y + (r.h - pt.height)/2 + 4));
      ctx.globalAlpha = 1;
      // 색 테마 띠
      ctx.fillStyle = dd.pal.M; ctx.fillRect(r.x, r.y + r.h - 6, r.w, 6);
      if(on){
        const g = PX + Math.round(Math.sin(this.t*7))*PX;
        ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2;
        ctx.strokeRect(r.x - PX - g, r.y - PX - g, r.w + (PX+g)*2, r.h + (PX+g)*2);
        drawText(ctx, 'V', r.x + r.w/2, r.y - 26, 3, { align:'center', color:PAL.gold });
      }
    }

    ko(ctx, '방향키 : 고르기      엔터 : 확인', 640, 674, 3,
      { align:'center', color:'#8a7bb8' });
    if(false) drawText(ctx, 'ARROWS: SELECT    ENTER: OK    ESC: TITLE', 640, 676, 2,
      { align:'center', color:'#8a7bb8' });
    if(DEBUG) drawHUDDebug(ctx);
  }
}

/* ==================================================================
   StageSelectScene : 20 스테이지 선택 / 해금
   ================================================================== */
const SEL = { cols:5, rows:4, tw:192, th:108, gx:224, gy:132, ox:96, oy:150 };

class StageSelectScene extends Scene {
  constructor(start){ super(); this.sel = clamp((start || 1) - 1, 0, 19); }
  enter(){
    this.t = 0;
    this.thumbs = [];
    for(let i=1;i<=20;i++) this.thumbs[i] = buildThumb(i, SEL.tw, SEL.th);
    this.bg = buildSky([{p:0,c:'#0d0a1c'},{p:.5,c:'#181233'},{p:1,c:'#2a1c4a'}]);
    Input.pointerHandler = {
      down:(id,x,y) => {
        for(let i=0;i<20;i++){
          const r = this.cellRect(i);
          if(x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h){
            if(i === this.sel) this.launch(); else this.sel = i;
            return;
          }
        }
      }
    };
  }
  exit(){ Input.pointerHandler = null; }

  cellRect(i){
    const c = i % SEL.cols, r = (i / SEL.cols) | 0;
    return { x: SEL.ox + c*SEL.gx, y: SEL.oy + r*SEL.gy, w: SEL.tw, h: SEL.th };
  }
  unlocked(i){ return (i + 1) <= Save.data.unlocked; }
  launch(){
    if(this.mgr.busy) return;
    if(!this.unlocked(this.sel)){ this.denyT = 0.4; SND.sfx('deny'); return; }
    SND.sfx('confirm');
    this.mgr.change(new GameScene(this.sel + 1));
  }

  update(dt){
    this.t += dt;
    if(this.denyT > 0) this.denyT -= dt;
    if(this.mgr.busy) return;
    const c = this.sel % SEL.cols, r = (this.sel / SEL.cols) | 0;
    if(Input.pressed('left') || Input.pressed('right') || Input.pressed('up') || Input.pressed('down')) SND.sfx('blip');
    if(Input.pressed('left'))  this.sel = r*SEL.cols + (c + SEL.cols - 1) % SEL.cols;
    if(Input.pressed('right')) this.sel = r*SEL.cols + (c + 1) % SEL.cols;
    if(Input.pressed('up'))    this.sel = ((r + SEL.rows - 1) % SEL.rows)*SEL.cols + c;
    if(Input.pressed('down'))  this.sel = ((r + 1) % SEL.rows)*SEL.cols + c;
    if(Input.pressed('confirm')) this.launch();
    if(Input.pressed('back') || Input.pressed('pause')) this.mgr.change(new CharacterSelectScene());
  }

  render(ctx){
    ctx.drawImage(this.bg, 0, 0);
    drawText(ctx, 'SELECT STAGE', 640, 42, 7,
      { align:'center', color:(r)=>PAL.fire[r], outline:PAL.outline, shadow:'#000', shadowOff:8 });

    for(let i=0;i<20;i++){
      const r = this.cellRect(i), on = i === this.sel, open = this.unlocked(i);
      const st = STAGES[i+1];
      // 테두리
      ctx.fillStyle = on ? PAL.gold : '#2b2448';
      ctx.fillRect(r.x - PX, r.y - PX, r.w + PX*2, r.h + PX*2);
      // 썸네일
      ctx.globalAlpha = open ? 1 : 0.25;
      ctx.drawImage(this.thumbs[i+1], r.x, r.y);
      ctx.globalAlpha = 1;
      if(!open){
        ctx.globalAlpha = 0.55; ctx.fillStyle = '#050408';
        ctx.fillRect(r.x, r.y, r.w, r.h); ctx.globalAlpha = 1;
        // 자물쇠 도트
        const lx = r.x + r.w/2, ly = r.y + r.h/2;
        ctx.fillStyle = '#6b7a99';
        ctx.fillRect(snap(lx-14), snap(ly-2), 28, 22);
        drawPixelRing(ctx, lx, ly - 8, 11, PX, '#6b7a99');
        ctx.fillStyle = '#2b2448'; ctx.fillRect(snap(lx-3), snap(ly+5), 6, 8);
      }
      // 번호
      ctx.fillStyle = 'rgba(6,6,14,.72)'; ctx.fillRect(r.x, r.y, 46, 26);
      drawText(ctx, String(i+1).padStart(2,'0'), r.x + 8, r.y + 6, 3,
        { color: open ? PAL.gold : '#5a6478' });
      // 클리어 표시
      if(Save.data.best[i+1]){
        ctx.fillStyle = 'rgba(6,6,14,.72)'; ctx.fillRect(r.x + r.w - 30, r.y, 30, 26);
        drawText(ctx, '*', r.x + r.w - 22, r.y + 6, 3, { color:PAL.fire[1] });
      }
      // 선택 강조
      if(on){
        const g = 2 + Math.round(Math.sin(this.t*6)*1)*PX;
        ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2;
        ctx.strokeRect(r.x - PX - g, r.y - PX - g, r.w + (PX+g)*2, r.h + (PX+g)*2);
      }
    }

    // 하단 정보
    const st = STAGES[this.sel + 1], open = this.unlocked(this.sel);
    ctx.fillStyle = 'rgba(6,6,14,.66)'; ctx.fillRect(0, 656, GAME_W, 64);
    ctx.fillStyle = PAL.outline; ctx.fillRect(0, 652, GAME_W, PX);
    drawText(ctx, 'STAGE ' + (this.sel+1) + '   ' + st.n, 24, 668, 4,
      { color: open ? PAL.white : '#5a6478', outline:PAL.outline });
    const best = Save.data.best[this.sel+1] || 0;
    drawText(ctx, 'BEST ' + String(best).padStart(7,'0'), 1264, 668, 3,
      { align:'right', color:PAL.gold, outline:PAL.outline });
    drawText(ctx, 'FIRE LV STARTS AT 1 - RAISE IT BY BEATING MID-BOSSES',
      1264, 630, 2, { align:'right', color:'#8a7bb8' });
    drawText(ctx, 'UNLOCKED ' + Save.data.unlocked + '/20',
      1264, 606, 2, { align:'right', color:'#8a7bb8' });
    if(!Save.available)
      drawText(ctx, 'PROGRESS NOT SAVED - BROWSER STORAGE BLOCKED', 640, 606, 2,
        { align:'center', color:'#ff8a6a' });
    drawText(ctx, 'ARROWS: MOVE    ENTER: START    ESC: DRAGON', 24, 630, 2, { color:'#8a7bb8' });
    drawText(ctx, 'DRAGON: ' + currentDragon().id, 640, 630, 2,
      { align:'center', color:currentDragon().pal.L });

    if(this.denyT > 0)
      drawText(ctx, 'LOCKED', 640, 350, 8,
        { align:'center', color:'#ff4d5a', outline:PAL.outline, shadow:'#000',
          alpha: Math.min(1, this.denyT/0.2) });

    if(DEBUG) drawHUDDebug(ctx);
  }
}

/* ==================================================================
   디버그 HUD
   ================================================================== */
let DEBUG = false;
const Perf = { fps: 0, _acc: 0, _n: 0, ms: 0 };
function drawHUDDebug(ctx){
  ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(GAME_W-186, 8, 178, 40); ctx.globalAlpha = 1;
  drawText(ctx, 'FPS ' + Perf.fps, GAME_W-178, 14, 3, { color: Perf.fps >= 57 ? PAL.fire[1] : '#ff4d5a' });
  drawText(ctx, Perf.ms.toFixed(2) + ' MS', GAME_W-178, 34, 2, { color: PAL.dim });
}


/* ==================================================================
   모듈 경계 — 오락실이 붙였다 뗐다 한다
   ------------------------------------------------------------------
   이 아래만 새로 쓴 코드다. 위쪽 5,200여 줄(렌더·물리·보스·사운드 합성)은
   단일 HTML 이던 시절 그대로다.

   예전에는 이 게임이 iframe 으로 떴다. 그러면 **화면 아무 데나 터치한 뒤
   키보드가 죽는다**(포커스가 부모로 가면 keydown 이 게임에 닿지 않는다).
   전체화면·뒤로가기·소리가 따로 노는 것도 전부 같은 뿌리였다.
   이제 같은 문서 안에서 돈다.
   ================================================================== */

/** 오락실이 넘겨준 것들. mount() 가 채운다 */
const DG = {
  difficulty: 'normal',
  onFinish() {},
  onExit() {},
  onCharacter() {},
  /** 결투 중 1초마다 — 상대 화면의 숫자가 이걸로 움직인다 */
  onProgress() {},
  /**
   * 이어하기 값을 치를 지갑. 게임은 오락실 지갑을 모르므로 창구로만 만진다.
   * 기본값은 "돈이 없다" 다 — 창구가 안 붙었으면 이어하기가 안 보인다.
   */
  coins: () => 0,
  spendCoins: () => false,
  addCoins: () => {},
};

/** 한 판 동안 쌓이는 것 — 판이 끝나면 오락실이 가져간다 */
/**
 * 한 판(스테이지 1~20 전체) 동안의 금화.
 *
 * `banked` 는 **이미 오락실 지갑에 넣은 만큼**이다. 스테이지가 끝날 때마다
 * 보내는데 `coins` 는 누적값이라, 뺀 만큼을 기억해 두지 않으면 같은 금화를
 * 스무 번 넣게 된다.
 */
/**
 * `wallet0` — **판을 시작할 때의 지갑.**
 *
 * ★ (2026-08-27, 사용자 지정) *"보유금화는 고정시켜. 현재 금화만 올라가게"*
 * 예전에는 지갑 + 이번 판을 더해 보여 줬는데, 스테이지가 끝날 때마다 지갑에
 * 넣으므로 **판이 바뀔 때마다 괄호 안 숫자가 툭 뛰었다.** 기준이 움직이면
 * "얼마를 벌었나" 를 셀 수가 없다. 시작할 때의 값으로 못 박는다.
 */
const RUN = { coins: 0, coinFrac: 0, banked: 0, noHitRun: 0, wallet0: 0 };

/**
 * ★ **낀 아이템은 1P 것이다.** (2026-08-26)
 *
 * 이 게임은 오락실 계정 하나로 돌아간다. 2P 는 같은 화면에 끼어든 손님이라
 * 지갑도 보관함도 없다. 그래서 모든 효과는 `pid === 1` 에게만 걸린다 —
 * 안 그랬다가는 내가 산 물건으로 남이 세지는 이상한 일이 된다.
 */
const EQ = { dmgCut:0, atk:1, magnet:0, coinBonus:0, speed:1, pal:null, head:null, leg:null, mask:null, maskLv:0,
             startMissiles: START_MISSILES, startBombs: START_BOMBS };

/**
 * 산 드래곤 번호들. 오락실이 알려준다.
 * ★ **2P 도 산 드래곤만 고를 수 있다.** (2026-08-26, 사용자 지정)
 * 안 산 것은 회색으로 보여 준다 — 감추면 뭘 더 살 수 있는지 모른다.
 */
let OWNED = null;
const ownsDragon = (i) => (OWNED ? OWNED.has(i | 0) : (i | 0) < 5);

/**
 * 오락실이 낀 것을 알려준다. 한 판 중에는 바뀔 수 없고,
 * 로비에서 바꿔 다시 들어올 때마다 mount() 가 다시 불러준다.
 */
export function setEquipment(eff){
  const e = eff || {};
  EQ.dmgCut    = Math.min(0.20, +e.dmgCut    || 0);
  EQ.atk       = Math.min(1.30, +e.atk       || 1);
  EQ.magnet    = Math.min(200,  +e.magnet    || 0);
  EQ.coinBonus = Math.min(0.20, +e.coinBonus || 0);
  EQ.speed     = Math.min(1.15, +e.speed     || 1);
  EQ.pal       = e.pal  || null;
  EQ.head      = e.head || null;   // 장식 색 (그림에만 쓴다)
  EQ.leg       = e.leg  || null;
  EQ.mask      = e.mask || null;
  EQ.maskLv    = clamp(+e.maskLv || 0, 0, 5);
  /* 계단 아이템 — 끼고 벗는 게 아니라 산 만큼 들고 시작한다 */
  EQ.startMissiles = clamp(+e.startMissiles || START_MISSILES, START_MISSILES, MAX_MISSILE);
  EQ.startBombs    = clamp(+e.startBombs    || START_BOMBS,    START_BOMBS,    MAX_BOMB);
  OWNED = Array.isArray(e.owned) ? new Set(e.owned.map(Number)) : null;
  _fireCache.clear();              // 불꽃 색이 바뀌었을 수 있다 — 구워둔 그림을 버린다
}

/** 불꽃 색 — 안 꼈거나 2P 면 기본 빨간 불이다 */
function firePalOf(pid){
  return (pid === 1 && EQ.pal && FLAME_PALS[EQ.pal]) ? FLAME_PALS[EQ.pal] : PAL.fire;
}

/* 난이도 : 적 수 · 적 속도 · 적 체력 세 축으로 가른다.
   ★ **플레이어 속도는 건드리지 않는다.** 내 드래곤까지 느려지면 쉬운 게 아니라
   그냥 답답해진다. 어려움을 어렵게 만드는 것은 "적이 빠른 것" 이다.

   점수 배율은 두지 않는다 — 순위를 난이도별로 나눌 것이라 배율을 곱해 봐야
   그 난이도 전원이 똑같이 부풀 뿐이고, 나중에 배율을 손대면 과거 기록이 의미를 잃는다.
   어려움을 고를 이유는 배율이 아니라 **적이 많아 잡을 게 많다는 것**이 만든다. */
/**
 * ★ **난이도는 다섯 축을 한꺼번에 움직인다.** (2026-08-26, 사용자 지정)
 *
 * 예전에는 적 수·속도·체력 셋뿐이라 "빨라지고 많아질 뿐" 이었다.
 * 실제로 어려우려면 **맞았을 때 아픈 정도**와 **내 화력이 통하는 정도**가 같이 변해야 한다.
 *
 *   count  적이 몇 마리 나오나
 *   speed  적과 적탄이 얼마나 빠른가
 *   hp     적이 얼마나 단단한가
 *   atk    적의 한 방이 얼마나 아픈가      <- 새로 넣었다
 *   boss   보스가 얼마나 단단한가          <- 새로 넣었다
 */
const DIFFS = {
  /* atk 은 **목숨당 맞는 횟수**가 실제로 갈리도록 잡았다 (기본 한 방 34, 체력 100):
     쉬움 26 -> 4대 · 보통 34 -> 3대 · 어려움 53 -> 2대.
     1.45 로 두었을 때는 49 라 어려움도 3대였다 — 반올림에 묻혀 차이가 안 났다. */
  easy:   { count: 0.80, speed: 0.88, hp: 0.80, atk: 0.75, boss: 0.80, coin: 0.8 },
  normal: { count: 1.00, speed: 1.00, hp: 1.00, atk: 1.00, boss: 1.00, coin: 1.0 },
  /**
   * ★ **어려움을 눅였다.** (2026-08-26, 실제로 해 보고)
   *
   * atk 1.55 는 목숨 하나가 두 대였다. 적 수까지 1.4 배라 화면을 볼 새가 없었다.
   * 1.30 이면 세 대 — 보통(세 대)과 같은 횟수지만 적이 많고 빨라서 여전히 어렵다.
   * 어려움이 어려워야 할 이유는 "한 대가 아픈 것" 이 아니라 "쉴 틈이 없는 것" 이다.
   */
  /* ★ 어려움의 보스만 20% 더 (2026-08-27, 사용자 지정): 1.20 -> 1.44.
     쉬움·보통은 그대로다 — 어려움을 고른 사람에게만 더 얹는다 */
  hard:   { count: 1.28, speed: 1.18, hp: 1.30, atk: 1.30, boss: 1.44, coin: 1.4 },
};
function diffOf() { return DIFFS[DG.difficulty] || DIFFS.normal; }
function diffScale() { return diffOf().count; }
function diffSpeed() { return diffOf().speed; }
function diffHp() { return diffOf().hp; }
function diffAtk() { return diffOf().atk; }     // 적의 공격력
function diffBoss() { return diffOf().boss; }   // 보스 체력
/**
 * ★ **어려울수록 금화를 더 준다.** (2026-08-26)
 *
 * 예전에는 어려움으로 깨나 쉬움으로 깨나 금화가 같았다 — 그러면 어려움을 고를
 * 이유가 순위표뿐이고, 대부분은 쉬움으로 돌린다. 위험을 더 지면 더 받아야 한다.
 *
 * 점수가 아니라 **금화**에 배수를 거는 이유: 점수는 순위표가 난이도별로 이미 갈려
 * 있어서 배수를 걸면 비교가 오히려 흐려진다. 금화는 하나뿐이라 여기가 맞는 자리다.
 */
function diffCoin() { return diffOf().coin; }

/* 타이틀로 나가던 자리. 이제 타이틀이 없다 — 오락실 로비로 돌아간다 */
function backOut() { DG.onExit(); }

/* ------------------------------------------------------------------
   붙인 것을 반드시 되돌린다.
   window/document 에 건 리스너가 남으면 로비로 돌아온 뒤에도 방향키가 먹고,
   오디오 노드가 남으면 소리가 계속 난다. 캔버스에 건 것은 캔버스가 사라질 때
   같이 죽으므로 여기 기록하지 않아도 된다.
   ------------------------------------------------------------------ */
const bound = [];
function on(target, ev, fn, opt) {
  target.addEventListener(ev, fn, opt);
  bound.push([target, ev, fn, opt]);
}
function unbindAll() {
  for (const [t, e, f, o] of bound) t.removeEventListener(e, f, o);
  bound.length = 0;
}

let canvas = null;
let ctx = null;
let scenes = null;
let rafId = 0;
/**
 * ★★ **세로 모드 — 판을 돌린다.** (2026-08-27, 사용자 지정)
 *
 * *"세로로 돌리면 내 캐릭터는 아래쪽에서 위로 올라가는 느낌이고 적들은 위에서
 *   아래로 떨어지는 느낌이야 (...) 게임은 똑같아 (...) 요즘 폰은 다 세로로
 *   들고 있으니 세로 모드 게임 형태가 기본형"*
 *
 * ## 왜 게임을 다시 안 짜는가
 *
 * 이 게임은 **가로로 흐르는 좌표계**(1280x720) 위에 지어져 있다.
 * 적은 -x 로 오고, 불줄기는 +x 로 나가고, 대형은 dy 로 퍼지고, 보스는 오른쪽
 * 끝에 자리잡는다. 세로로 만들겠다고 이걸 전부 뒤집으면 **이동·대형·보스 패턴·
 * 충돌·배경**을 모두 다시 계산해야 하고, 그러면 지금까지 맞춰 놓은 밸런스가
 * 통째로 흔들린다.
 *
 * 대신 **화면을 돌린다.** 게임은 그대로 가로 판 위에서 돌고, 그리는 순간에만
 * 90도 돌려 세로 캔버스(720x1280)에 얹는다:
 *
 *     논리 +x (오른쪽, 적이 오는 쪽)  ->  화면 위쪽
 *     논리 +y (아래)                 ->  화면 오른쪽
 *
 * 그러면 **적은 위에서 내려오고 나는 아래에서 위로 쏜다** — 원하신 그림 그대로다.
 * 게임 코드는 한 줄도 안 바뀌므로 밸런스도 그대로다.
 *
 * ## 뒤집히는 것들
 *
 * 손가락 좌표는 **거꾸로** 풀어야 한다(`toGame`). 그리고 글자와 HUD 는
 * 같이 돌면 안 되므로 **돌리기 전 화면 좌표**로 따로 그린다.
 */
const PORT_W = GAME_H, PORT_H = GAME_W;      // 세로 캔버스 720 x 1280
/** 지금 세로로 도는가 */
let portrait = false;
/**
 * **UI 좌표계** — 화면 그대로다 (가로 1280x720 / 세로 720x1280).
 *
 * 글자와 단추는 판과 **같이 돌면 안 된다.** 돌아 있는 글씨는 읽을 수가 없다.
 * 그래서 UI 는 판을 그린 뒤 변환을 풀고 **화면 좌표**로 그린다.
 * 그리는 자리와 누르는 자리가 어긋나면 안 되므로, 포인터도 화면 좌표를 같이 넘긴다.
 */
let UIW = GAME_W, UIH = GAME_H;
const uiCx = () => UIW / 2;
let hostEl = null;
let rotateEl = null;
let last = 0, acc = 0;

const FIXED = 1 / 60, MAX_STEPS = 5;
/** 레터박스. 오락실 캔버스(180x320 정수배)와 달리 이 게임은 1280x720 을 소수배로 맞춘다 */
function resize() {
  if (!canvas) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  const wasPortrait = portrait;
  portrait = vh > vw;
  /* 세로로도 돌아가므로 "돌려주세요" 안내는 더 이상 안 띄운다 */
  if (rotateEl) rotateEl.classList.remove('show');
  /* 화면이 돌면 캔버스의 가로세로도 바꾼다 — 게임 판은 그대로다 */
  const cw = portrait ? PORT_W : GAME_W;
  const ch = portrait ? PORT_H : GAME_H;
  UIW = cw; UIH = ch;
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw; canvas.height = ch;
    if (ctx) ctx.imageSmoothingEnabled = false;
  }
  const scale = Math.min(vw / cw, vh / ch);
  canvas.style.width = Math.floor(cw * scale) + 'px';
  canvas.style.height = Math.floor(ch * scale) + 'px';
  if (wasPortrait !== portrait) onOrientationChanged();
}
/** 화면이 돌았다 — 자리를 다시 잡아야 하는 것들에게 알린다 */
function onOrientationChanged() {
  const sc = scenes && scenes.current;
  if (sc && sc.onOrient) sc.onOrient();
}
/**
 * 게임 판(1280x720)을 화면에 얹는 변환.
 * 세로면 90도 돌린다 — 논리 +x 가 화면 위로 간다.
 *   화면x = 논리y          화면y = GAME_W - 논리x
 */
/**
 * 지금 씬이 **판을 돌려서** 그리는 씬인가.
 *
 * 돌리는 것은 **싸우는 화면(`GameScene`)뿐**이다. 메뉴·캐릭터 선택·스테이지
 * 선택은 글자와 그림표가 전부라 돌아가면 읽을 수가 없다.
 */
function sceneRotates() {
  const sc = scenes && scenes.current;
  return !!(sc && sc.rotates);
}
/**
 * 게임 판(1280x720)을 화면에 얹는 변환.
 *
 * - 싸우는 화면 + 세로 : **90도 돌린다.** 논리 +x 가 화면 위로 간다.
 *       화면x = 논리y          화면y = GAME_W - 논리x
 * - 메뉴 + 세로 : 돌리지 않고 **줄여서 가운데에** 넣는다.
 *   메뉴를 세로용으로 다시 짜는 것은 별개의 일이고, 줄여 넣으면 지금 당장
 *   전부 멀쩡하게 눌린다.
 * - 가로 : 그대로.
 */
const MENU_FIT = () => {
  const s = PORT_W / GAME_W;                       // 0.5625
  return { s, ox: 0, oy: (PORT_H - GAME_H * s) / 2 };
};
function setWorldTransform(c) {
  if (!portrait) { c.setTransform(1, 0, 0, 1, 0, 0); return; }
  if (sceneRotates()) { c.setTransform(0, -1, 1, 0, 0, GAME_W); return; }
  const f = MENU_FIT();
  c.setTransform(f.s, 0, 0, f.s, f.ox, f.oy);
}

function frame(now) {
  rafId = requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;

  if (dt > 0.25) dt = 0.25;

  const t0 = performance.now();
  Input.pollPad();
  SND.update();
  if (Input.pressed('debug')) DEBUG = !DEBUG;

  acc += dt;
  let steps = 0;
  while (acc >= FIXED && steps < MAX_STEPS) {
    scenes.update(FIXED);
    /**
     * ★ **누른 순간은 한 걸음에서만 소비된다.** (2026-08-26, 실측으로 찾음)
     *
     * `pressed()` 는 `just` 집합을 **읽기만 하고 비우지 않는다.** 그런데 이 루프는
     * 한 화면에 최대 다섯 걸음까지 돈다 — 프레임이 한 번 밀리면 두세 걸음이 몰아서
     * 도는데, 그동안 `just` 에 남아 있는 'p1missile' 을 **걸음마다 다시 읽어서
     * 한 번 누른 미사일이 두세 발 나갔다.**
     *
     * 미사일이 늘 모자란 느낌이었던 원인 중 하나가 이것이다.
     * 프레임 끝이 아니라 **걸음 끝**에서 비워야 한 번 누른 것이 한 번만 먹힌다.
     */
    Input.endFrame();
    acc -= FIXED; steps++;
  }
  if (steps === MAX_STEPS) acc = 0;

  /* 화면을 지우는 것은 **변환 없이** — 세로면 캔버스가 720x1280 이다 */
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setWorldTransform(ctx);
  scenes.render(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (steps === 0) Input.endFrame();     // 한 걸음도 안 돌았으면 여기서 비운다

  Perf._acc += dt; Perf._n++;
  if (Perf._acc >= 0.5) { Perf.fps = Math.round(Perf._n / Perf._acc); Perf._acc = 0; Perf._n = 0; }
  Perf.ms = performance.now() - t0;
}

/**
 * 게임을 띄운다.
 * @param {HTMLElement} host  이 안에 캔버스를 만든다. 비어 있어야 한다.
 * @param {{difficulty?:string, character?:number, mode?:'play'|'chars',
 *          onFinish?:Function, onExit?:Function, onCharacter?:Function}} opts
 */
export function mount(host, opts = {}) {
  if (canvas) unmount();                       // 두 번 붙는 사고 방지

  /* 결투는 둘이 같은 조건이어야 겨루기가 된다 — 난이도를 고른 값으로 두면 안 된다 */
  DG.difficulty = opts.mode === 'duel' ? DUEL.DIFFICULTY : (opts.difficulty || 'normal');
  DG.onFinish = opts.onFinish || (() => {});
  DG.onExit = opts.onExit || (() => {});
  DG.onCharacter = opts.onCharacter || (() => {});
  DG.onProgress = opts.onProgress || (() => {});
  /* 게임이 뜨는 순간에도 한 번 떼어 둔다 — 닉네임·채팅 입력 뒤에 들어오면
     포커스가 남아 있어 첫 키부터 IME 에 먹힌다 (2026-08-27) */
  try{
    const a = document.activeElement;
    if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) a.blur();
  }catch(e){}
  DG.coins = opts.coins || (() => 0);
  DG.spendCoins = opts.spendCoins || (() => false);
  DG.addCoins = opts.addCoins || (() => {});
  setEquipment(opts.equipment);        // 낌 아이템은 한 판 내내 고정이다
  RUN.coins = 0; RUN.coinFrac = 0; RUN.banked = 0;

  hostEl = host;
  host.innerHTML = '';

  const stage = document.createElement('div');
  stage.className = 'dg-stage';
  canvas = document.createElement('canvas');
  canvas.width = GAME_W; canvas.height = GAME_H;
  canvas.className = 'dg-canvas';
  stage.appendChild(canvas);

  /* 가로 전용이다. 오락실(신발게임)은 세로 전용이라 이 안내를 들고 있지 않다 */
  rotateEl = document.createElement('div');
  rotateEl.className = 'dg-rotate';
  rotateEl.innerHTML =
    '<div class="dg-rot-icon"></div>' +
    '<p>가로 모드로 돌려주세요</p>' +
    '<p class="dg-sub">PLEASE ROTATE YOUR DEVICE</p>';
  /**
   * ★ **여기에도 나갈 길을 둔다.** (2026-08-26, 사용자 지정)
   * 가로로 못 돌리는 상황이 있는데 안내만 띄우면 갇힌다 —
   * "선택의 여지가 없는 느낌" 이라는 게 정확히 그것이다.
   */
  const quit = document.createElement('button');
  quit.type = 'button';
  quit.className = 'dg-quit';
  quit.textContent = '게임 포기하고 나가기';
  quit.addEventListener('click', () => DG.onExit());
  rotateEl.appendChild(quit);
  stage.appendChild(rotateEl);
  host.appendChild(stage);

  ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  Save.load();
  optGet();
  if (typeof opts.character === 'number') {
    Save.data.dragon = clamp(opts.character | 0, 0, 9);
    Save.save();
  }
  Input.init(canvas);

  on(window, 'resize', resize);
  on(window, 'orientationchange', () => setTimeout(resize, 120));
  on(document, 'visibilitychange', () => { if (!document.hidden) last = performance.now(); });
  resize();

  scenes = new SceneManager();
  /* 타이틀도 스테이지 선택도 없다. 로비가 이미 "시작" 을 받았고,
     이 게임의 한 판은 언제나 1스테이지에서 시작한다. */
  scenes.set(
    opts.mode === 'duel' ? new GameScene(1, null, true)
    : opts.mode === 'chars' ? new CharacterSelectScene()
    : opts.mode === 'options' ? new OptionsScene()
    : new GameScene(1)
  );

  last = performance.now(); acc = 0;
  rafId = requestAnimationFrame(frame);
}

/**
 * 게임로비의 「로비유저상태창」에 고른 드래곤을 그려 준다.
 *
 * 드래곤 도트는 이 모듈 안의 그리드·팔레트로만 그려진다 — 그림 파일이 없다.
 * 그래서 로비가 직접 그릴 수가 없고, 여기서 캔버스 하나를 만들어 넘긴다.
 * (로비는 어차피 `prefetchDragon()` 으로 이 모듈을 미리 받아 둔다)
 *
 * @param {number} idx 드래곤 번호 0~9
 * @param {number} cell 도트 한 칸 크기 (로비에서는 작게)
 */
/**
 * 가만히 있는 드래곤 그림.
 * @param {boolean} [padFlame] 움직이는 그림과 폭을 맞춘다 (상점이 나란히 놓을 때)
 */
/**
 * @param {{head?:string, leg?:string}} [gear] 무장 색을 **직접** 지정한다.
 *   상점의 "입어 본 모습" 은 아직 안 산 것을 걸쳐 봐야 하므로 지금 낀 것(EQ)이 아니라
 *   부르는 쪽이 정해 준 것을 그려야 한다.
 */
export function dragonPortrait(idx, cell = 3, padFlame, gear) {
  const i = clamp(idx | 0, 0, DRAGONS.length - 1);
  const d = DRAGONS[i];
  const f = FORMS.B;
  const w = Math.ceil(f.cols * cell), h = Math.ceil(f.rows * cell);
  const { cv, c } = makeCanvas(w + (padFlame ? flamePad(cell) : 0), h);
  /* 날개를 편 자세(pose 2)가 가장 드래곤처럼 보인다 */
  drawGrid(c, f.wings[2], 0, 0, f.cols, cell, d.pal, false, null);
  if(f.horns) drawGrid(c, f.horns[i % f.horns.length], 0, 0, f.cols, cell, d.pal, false, null);
  drawGrid(c, f.body,     0, 0, f.cols, cell, d.pal, false, null);
  for(const nm of (d.always || [])) if(f.parts[nm]) drawGrid(c, f.parts[nm], 0, 0, f.cols, cell, d.pal, false, null);
  /**
   * ★ **산 무장은 로비에서도 보여야 한다.** (2026-08-26 D단계)
   * 머리무장과 다리무장은 세지 않은 대신 비싸고 화려한 물건이라,
   * 게임 안에서만 보이면 산 보람이 절반으로 줄어든다.
   */
  const gh = gear ? gear.head : EQ.head;
  const gl = gear ? gear.leg  : EQ.leg;
  const gm = gear ? gear.mask : EQ.mask;
  const gmv = gear ? (gear.maskLv || 1) : EQ.maskLv;
  if(gh || gl || gm) drawGear(c, w/2, h/2, { w, h, cell }, 0.4, gh, gl, gm, gmv);
  return cv;
}

/**
 * 살아 움직이는 드래곤 한 마리. (2026-08-26, 사용자 지정)
 *
 * ★ **고른 놈만 움직인다.**
 * 열 마리가 다 같이 퍼덕이면 어느 것을 골랐는지 알 수 없고, 캔버스 열 장이
 * 매 프레임 도는 것도 낭비다. 상점은 **한 마리분만** 이걸 띄우고 나머지는
 * 가만히 있는 그림(`dragonPortrait`)을 쓴다.
 *
 * 드래곤을 서른 마리로 늘려도 도는 것은 언제나 하나다.
 *
 * @param {number} idx  드래곤 번호
 * @param {number} cell 도트 한 칸 크기
 * @returns {{cv:HTMLCanvasElement, stop:()=>void}} 화면에서 뗄 때 반드시 stop()
 */
/** 불이 뿜어 나갈 오른쪽 여백 — 움직이는 그림과 가만히 있는 그림이 **같은 폭**이어야
    한 줄에 늘어놨을 때 고른 놈만 작아 보이지 않는다 */
export const flamePad = (cell = 3) => Math.round(Math.ceil(FORMS.B.cols * cell) * 0.52);

/**
 * 게임 설정을 오락실 화면(DOM)에서 읽고 쓴다. (2026-08-26 설정 분리)
 *
 * 설정이 게임 안 캔버스 화면에만 있으면 **가로로 돌려야** 소리를 끌 수 있다.
 * 값은 여전히 게임이 들고 있고(같은 저장소를 써야 게임 안 화면과 어긋나지 않는다),
 * 바깥에서는 이 창구로만 만진다.
 */
export function gameOptions() {
  const o = optGet();
  return {
    stickSize: o.stickSize | 0,
    stickFloat: o.stickFloat ? 1 : 0,
    btnSize: o.btnSize | 0,
    btnAlpha: o.btnAlpha,
    splitPad: o.splitPad ? 1 : 0,
    bgmOn: o.bgmOn ? 1 : 0,
    sfxOn: o.sfxOn ? 1 : 0,
    bgm: Save.data.bgm | 0,
    tracks: BGM_TRACKS.map((t) => t.name),
  };
}

/** 위에서 받은 값을 되돌려 준다. 준 것만 바꾼다 */
export function setGameOption(key, value) {
  const o = optGet();
  switch (key) {
    case 'stickSize':  o.stickSize = clamp(value | 0, 0, 2); break;
    case 'stickFloat': o.stickFloat = value ? 1 : 0; break;
    case 'btnSize':    o.btnSize = clamp(value | 0, 0, 2); break;
    case 'btnAlpha':   o.btnAlpha = clamp(+value || 0.5, 0.2, 0.8); o.stickAlpha = o.btnAlpha; break;
    case 'splitPad':   o.splitPad = value ? 1 : 0; Input.splitPad = !!value; break;
    case 'bgmOn':      o.bgmOn = value ? 1 : 0; applyAudioOpt(); break;
    case 'sfxOn':      o.sfxOn = value ? 1 : 0; applyAudioOpt(); break;
    case 'bgm':
      Save.data.bgm = clamp(value | 0, 0, BGM_TRACKS.length - 1);
      /* 로비에서는 곡이 돌고 있지 않을 수 있다 — 그때는 조용히 저장만 한다 */
      try { SND.switchBgm(Save.data.bgm); } catch (e) {}
      break;
    default: return false;
  }
  Save.save();
  return true;
}

export function dragonAnim(idx, cell = 3) {
  const i = clamp(idx | 0, 0, DRAGONS.length - 1);
  const d = DRAGONS[i];
  const f = FORMS.B;
  const bw = Math.ceil(f.cols * cell), bh = Math.ceil(f.rows * cell);
  const FLAME = flamePad(cell);                   // 오른쪽에 불이 뿜어 나갈 자리
  const { cv, c } = makeCanvas(bw + FLAME, bh);

  /* 한 바퀴 3.4초 : 2.0 날갯짓 → 0.3 턱 벌리기 → 0.7 불 → 0.4 닫기 */
  const CYCLE = 3.4, MAW_AT = 2.0, FIRE_AT = 2.3, FIRE_END = 3.0;
  const WINGS = [0, 1, 2, 1];                     // 3번은 정면 포즈라 쓰지 않는다

  let raf = 0, t0 = 0, stopped = false;

  /* 입 끝 — 불이 나오는 자리 (몸통 격자 기준) */
  const mx = f.muzzle.x * cell + bw / 2;
  const my = f.muzzle.y * cell + bh / 2;

  function flame(k) {
    /* k: 0~1. 앞으로 뻗었다가 사그라든다. 게임의 불줄기를 그대로 쓰기엔
       초상화에 비해 너무 길어서, 같은 색으로 짧은 화염만 따로 그린다. */
    const grow = k < 0.25 ? k / 0.25 : (k > 0.75 ? (1 - k) / 0.25 : 1);
    const len = FLAME * grow;
    if (len < 2) return;
    const seg = Math.max(2, Math.round(cell));
    for (let x = 0; x < len; x += seg) {
      const p = x / Math.max(1, len);
      const h = (cell * 3.2) * (0.45 + 0.9 * p) * grow;
      const y = my - h / 2;
      c.fillStyle = d.pal.K;
      c.fillRect(mx + x, Math.round(y) - 1, seg, Math.round(h) + 2);
      c.fillStyle = PAL.fire[4];
      c.fillRect(mx + x, Math.round(y), seg, Math.max(1, Math.round(h)));
      c.fillStyle = PAL.fire[1];
      c.fillRect(mx + x, Math.round(my - h * 0.22), seg, Math.max(1, Math.round(h * 0.44)));
    }
    c.fillStyle = '#ffffff';
    c.fillRect(mx, Math.round(my - cell * 0.5), Math.round(len), Math.max(1, Math.round(cell)));
  }

  /** 한 바퀴 안의 시각 t(초) 를 그린다 */
  function draw(t) {
    t = ((t % CYCLE) + CYCLE) % CYCLE;
    c.clearRect(0, 0, cv.width, cv.height);
    const pose = WINGS[Math.floor(t * 7) % WINGS.length];
    const maw = t >= MAW_AT && t < FIRE_END + 0.4;
    paintDragon(c, d.pal, 1, 0, 0, pose, false, null, d.always, i, maw);
    if (t >= FIRE_AT && t < FIRE_END) flame((t - FIRE_AT) / (FIRE_END - FIRE_AT));
  }

  function frame(now) {
    if (stopped) return;
    if (!t0) t0 = now;
    draw((now - t0) / 1000);
    raf = requestAnimationFrame(frame);
  }

  /* ★ 첫 장은 **지금 당장** 그린다. rAF 를 기다리면 카드가 한 프레임 비어 보이고,
     탭이 뒤에 있을 때는 rAF 가 아예 안 돌아서 영영 빈 칸으로 남는다. */
  draw(0);
  raf = requestAnimationFrame(frame);

  return {
    cv,
    draw,                       // 시각을 지정해 한 장만 그린다 (검사·정지 화면용)
    stop() {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}

/**
 * 불꽃 한 줄기를 그려 돌려준다 — 상점에서 고르기 전에 **보고** 고르라고. (2026-08-26, 사용자 지정)
 *
 * ★ **게임에서 쓰는 그 그림 그대로다.** 미리보기용으로 따로 그리면 언젠가 둘이
 * 다른 모양이 되고, 그러면 미리보기가 거짓말을 한다. `paintFireBolt` 을 같이 쓴다.
 *
 * 레벨은 2로 고정한다(사용자 지정) — 1은 한 줄이라 색만 보이고 굵기 차이를 모르고,
 * 10은 화면 절반이라 작은 칸에 안 들어간다. 2가 "불꽃답게 보이는" 최소 크기다.
 *
 * @param {string} palKey  FLAME_PALS 의 열쇠 ('red'|'ember'|'blue'|'yellow'|'green'|'abyss')
 * @param {number} [lv]    파이어 레벨 (기본 2)
 * @param {number} [scale] 0~1 로 줄인다 (칸에 맞추려고)
 */
export function flamePreview(palKey, lv = 2, scale = 1) {
  const L = clamp(lv | 0, 1, MAX_LEVEL);
  const c = FIRE[L];
  const pal = FLAME_PALS[palKey] || PAL.fire;
  const W = Math.max(8, Math.round(c.len * scale));
  const H = Math.max(8, Math.round((c.th * 1.15 + 8) * scale));
  const { cv, c: ctx } = makeCanvas(W, H);
  ctx.save();
  ctx.scale(scale, scale);
  /* 위상 0 — 정지 그림이므로 가장 곧게 뻗은 순간을 고른다 */
  paintFireBolt(ctx, c.len, (c.th * 1.15 + 8) / 2, L, 0, pal);
  ctx.restore();
  return cv;
}

/**
 * 드래곤 열 마리의 명단. 상점 화면이 쓴다.
 *
 * ★ **앞의 다섯은 처음부터 갖고 있고, 뒤의 다섯은 금화로 산다.** (2026-08-26, 사용자 지정)
 *   1,000 → 2,000 → 3,000 → 4,000 → 5,000
 *   전부 모으려면 15,000 금화 — 올클리어 네 판 남짓이라 손에 잡히는 목표다.
 */
export const DRAGON_PRICES = [0, 0, 0, 0, 0, 1000, 2000, 3000, 4000, 5000];

export function dragonList() {
  return DRAGONS.map((d, i) => ({
    idx: i,
    id: d.id,
    ko: d.ko,
    theme: d.koTheme,
    trait: d.koTrait,
    price: DRAGON_PRICES[i] || 0,
  }));
}

/** 드래곤 이름 (로비에서 "지금 고른 드래곤" 을 보여줄 때) */
export function dragonName(idx) {
  const d = DRAGONS[clamp(idx | 0, 0, 9)];
  return (d && (d.ko || d.name)) || '';
}

/**
 * 검사용 창구. 게임 내부는 모듈 스코프라 밖에서 보이지 않는데,
 * "붙였다 뗐을 때 정말 아무것도 안 남는가" 같은 것은 안을 봐야만 확인된다.
 * 화면 코드는 이걸 쓰지 않는다 — `tools/_dragongame-preview.html` 전용이다.
 */
export const __test = {
  get scene() { return scenes && scenes.current ? scenes.current.constructor.name : null; },
  get stage() { return scenes && scenes.current ? scenes.current.stage : null; },
  get difficulty() { return DG.difficulty; },
  get coins() { return RUN.coins; },
  get boundCount() { return bound.length; },
  /* 검사용 — 그 스테이지의 보스를 하나 만들어 준다 (열 마리가 정말 다른지 보려면 필요하다) */
  boss(stage, level) {
    const b = new Boss(stage, level || 1);
    return {
      name: b.name, cell: b.cell, hp: b.maxHp, box: b.box,
      draw(c, cx, cy) { b.x = cx; b.y = cy; b.pose = 2; b.render(c); },
    };
  },
  /* 검사용 — 랜드마크만 따로 그려 본다 (능선과 섞이면 픽셀을 셀 수 없다) */
  landmark(c, mk, seed) {
    if (mk) drawLandmark(c, mk.s, snap(GAME_W * mk.x), mk.y, mk.w, mk.h, mk.c, seed);
  },
  /* 씬 전환(페이드) 중인가 — 전환 중에는 다음 change 가 버려진다 */
  get busy() { return !!(scenes && scenes.busy); },
  get running() { return rafId !== 0; },
  get keysDown() { return Input.down.size; },
  /* 검사용 — 마지막 keydown 이 어느 물리 키로 해석됐나 (한/영 무관 검사에 쓴다) */
  get lastKey() { return Input.lastKey; },
  press(action) { Input.just.add(action); },
  scene0() { return scenes ? scenes.current : null; },
  /* 검사용 — rAF 가 멈춰 있는 환경에서 패드 폴링과 설정을 직접 부른다 */
  pollPad() { Input.pollPad(); },
  endFrame() { Input.endFrame(); },
  /**
   * 검사용 — **씨 매니저**를 한 걸음 돌린다.
   *
   * 씨를 직접 `update` 하면 스테이지 전환(`mgr.change`)이 **안 일어난다** —
   * 전환은 매니저의 페이드 타이머가 끜다. 그걸 몰라서 재면
   * 다음 판이 **0초에 끝난 것처럼** 보인다 (실제로 한 번 속았다).
   */
  pump(dt) { if (scenes) scenes.update(dt); Input.endFrame(); },
  /**
   * 검사용 — **한 장을 그린다.**
   * 숨은 탭에서는 rAF 가 멈추므로 눈으로 확인하려면 직접 불러야 한다.
   * `frame()` 의 그리는 부분과 **같은 순서**여야 의미가 있다.
   */
  draw() {
    if (!ctx || !canvas) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setWorldTransform(ctx);
    scenes.render(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },
  get portrait() { return portrait; },
  get splitPad() { return Input.splitPad; },
  set splitPad(v) { optGet().splitPad = v ? 1 : 0; Input.splitPad = !!v; },
  get padAxis() { return { p1: { ...Input.padAxis }, p2: { ...Input.padAxis2 } }; },
  get padCount() { return Input.padCount; },
};

/**
 * 바깥(ESC · 안드로이드 뒤로가기 · 게임패드 메뉴)에서 "나가고 싶다" 고 알려 올 때.
 * 곧바로 나가지 않고 **일시정지 메뉴를 띄운다** — 한 번의 실수로 판이 날아가면 안 된다.
 */
export function requestPause() {
  const sc = scenes && scenes.current;
  if (!sc || typeof sc.setPause !== 'function') { DG.onExit(); return; }
  if (sc.state === 'play') sc.setPause(true);
  else if (sc.state === 'pause') sc.setPause(false);
  else {
    if (sc.endRun) sc.endRun();          // 나가기 전에 정산부터 (2026-08-27)
    DG.onExit();
  }
}

/** 게임을 뗀다. 붙인 것을 하나도 남기지 않는다 */
export function unmount() {
  /**
   * ★★ **마지막 그물.** (2026-08-27, 사용자 신고)
   * 어떤 길로 화면을 떠나든 여기는 반드시 지난다 — 창을 닫든, 라우터가 갈아치우든.
   * 아직 안 넣은 금화가 남아 있으면 여기서 넣는다. 이미 넣었으면 `runEnded` 가
   * 막으므로 두 번 들어가지 않는다.
   */
  try {
    const sc = scenes && scenes.current;
    if (sc && sc.endRun) sc.endRun();
  } catch (e) { /* 정산에 실패해도 화면은 닫아야 한다 */ }
  if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  unbindAll();
  try { SND.stopBgm(); } catch (e) { /* 소리를 못 껐다고 화면이 멈추면 안 된다 */ }
  try { Input.down.clear(); Input.just.clear(); } catch (e) { /* 위와 같다 */ }
  scenes = null;
  ctx = null;
  canvas = null;
  rotateEl = null;
  if (hostEl) { hostEl.innerHTML = ''; hostEl = null; }
}
