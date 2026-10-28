/**
 * 캐치볼 화면 뼈대 — 스타일과 DOM (2026-10-29 떼어 냄)
 *
 * 전부 `.cb-root` 아래에 가둔다 — 오락실 화면(`styles/*.css`)과 섞이지 않게.
 * 오락실 리셋이 `button` 에 이것저것 걸어 두므로 버튼 모양은 `!important` 로 못 박는다.
 */

export const CSS = `
.cb-root{
  --sky:#4db6f2;--grass:#4fae46;--ink:#15304b;--chalk:#fffaf0;--stitch:#e23b2e;
  --leather:#b5652b;--leather-dk:#7a3f17;--board:#183f2b;--bulb:#ffd84a;--green:#2fbf5a;--orange:#ff9f2e;--red:#ff5a4a;
  --font-display:"Black Han Sans","Jua","Apple SD Gothic Neo","Malgun Gothic",sans-serif;
  --font-ui:"Jua","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;
  --btn:clamp(86px,25vmin,128px);
  --gut-l:max(16px,env(safe-area-inset-left,0px));--gut-r:max(16px,env(safe-area-inset-right,0px));
  --st:env(safe-area-inset-top,0px);--sb:env(safe-area-inset-bottom,0px);
  position:fixed;inset:0;z-index:2;overflow:hidden;
  background:linear-gradient(var(--sky) 55%,var(--grass) 55%);
  color:var(--ink);font-family:var(--font-ui);word-break:keep-all;
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none;
}
.cb-root *{box-sizing:border-box}
.cb-root [hidden]{display:none!important}
.cb-root button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;touch-action:manipulation;min-height:0;min-width:0;width:auto;height:auto;box-shadow:none;text-shadow:none;letter-spacing:normal;line-height:normal}
.cb-root button:focus-visible{outline:3px solid var(--bulb);outline-offset:3px}
.cb-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;image-rendering:auto}
/* 3D캐치볼 — 3D 캔버스는 아래, 2D 캔버스(조준경 · 링 · 글자)는 투명하게 위 */
.cb-gl{pointer-events:none}
.cb-3d .cb-logo{font-size:clamp(46px,14.5vw,100px)}
.cb-3d .cb-closet-top canvas{width:100%}

/* ---------- HUD ---------- */
.cb-hud{position:absolute;z-index:5;top:calc(var(--st) + 10px);left:var(--gut-l);right:var(--gut-r);
  display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:8px;pointer-events:none}
.cb-plate{background:var(--board);border:3px solid #0c2617;border-radius:12px;padding:5px 10px 6px;min-width:80px;text-align:center;
  box-shadow:0 3px 0 rgba(0,0,0,.25),inset 0 0 0 2px rgba(255,255,255,.07)}
.cb-plate-label{font-size:12px;color:#cfe8d6;letter-spacing:.06em}
.cb-plate-num{font-family:var(--font-display);font-size:32px;line-height:1.05;color:var(--bulb);text-shadow:0 0 10px rgba(255,216,74,.55);font-variant-numeric:tabular-nums}
.cb-plate-num.bump{animation:cb-bump .35s ease-out}
.cb-plate-best{font-size:11px;color:#cfe8d6;font-variant-numeric:tabular-nums;white-space:nowrap}
@keyframes cb-bump{0%{transform:scale(1)}35%{transform:scale(1.4)}100%{transform:scale(1)}}
.cb-mid{display:flex;flex-direction:column;align-items:center;gap:5px;padding-top:6px;min-width:0}
.cb-chip{background:var(--chalk);color:var(--ink);border:2.5px solid var(--ink);border-radius:999px;padding:4px 11px 3px;
  font-size:clamp(12px,3.3vw,15px);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 0 var(--ink)}
.cb-chip b{font-family:var(--font-display);font-weight:400;color:var(--stitch);margin-right:5px}
.cb-combo,.cb-strk{font-family:var(--font-display);font-size:17px;color:var(--chalk);min-height:20px;white-space:nowrap;
  text-shadow:0 2px 0 var(--ink),2px 0 0 var(--ink),-2px 0 0 var(--ink),0 -2px 0 var(--ink)}
.cb-combo.hot{color:var(--bulb)}
.cb-strk{color:#9dffb0}
.cb-opp{display:flex;align-items:center;gap:6px;max-width:100%;background:rgba(21,48,75,.88);color:var(--chalk);
  border-radius:12px;padding:4px 10px 4px 8px;font-size:clamp(12px,3.4vw,14px)}
.cb-opp-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.cb-opp-score{font-family:var(--font-display);color:var(--bulb);white-space:nowrap}
.cb-opp .cb-life{width:16px;height:16px}
.cb-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.cb-hbtns{display:flex;gap:5px;pointer-events:auto}
.cb-icon{width:38px!important;height:38px!important;border-radius:12px;background:rgba(255,250,240,.94)!important;border:2.5px solid var(--ink)!important;
  box-shadow:0 2px 0 var(--ink)!important;display:grid;place-items:center}
.cb-icon:active{transform:translateY(2px)}
.cb-icon svg{width:21px;height:21px}
.cb-icon.off{opacity:.55}
.cb-lives{display:flex;gap:3px}
.cb-life{width:21px;height:21px;transition:transform .3s,opacity .3s,filter .3s}
.cb-life.lost{opacity:.3;filter:grayscale(1);transform:scale(.78)}
.cb-life.pop{animation:cb-lifepop .55s ease-out}
@keyframes cb-lifepop{0%{transform:scale(1)}30%{transform:scale(1.6) rotate(-20deg)}100%{transform:scale(.78)}}
.cb-errs{display:flex;align-items:center;gap:3px;background:rgba(21,48,75,.85);color:var(--chalk);border-radius:10px;padding:2px 7px 2px 8px;font-size:12px}
.cb-errs i{width:14px;height:14px;border-radius:50%;border:2px solid #ffb3a9;display:inline-grid;place-items:center;font-style:normal;font-size:10px;line-height:1}
.cb-errs i.on{background:var(--red);border-color:var(--red)}
.cb-errs i.on::after{content:"✕";color:#fff;font-weight:700}

/* ---------- 잡기 · 던지기 ---------- */
.cb-act{position:absolute;z-index:6;bottom:calc(var(--sb) + 16px);width:var(--btn)!important;height:var(--btn)!important;border-radius:50%;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;
  border:4px solid var(--ink)!important;box-shadow:0 6px 0 var(--ink),0 12px 18px rgba(0,0,0,.22)!important;
  transition:transform .08s,opacity .2s,filter .2s;touch-action:none}
.cb-act svg{width:50%;height:50%;pointer-events:none}
.cb-act span{font-family:var(--font-display);font-size:calc(var(--btn)*.17);line-height:1;pointer-events:none;text-align:center}
.cb-throw{left:calc(var(--gut-l) + 2px);background:radial-gradient(circle at 34% 28%,#ffffff,#f2ebdb 66%,#d6c9ad)!important;color:var(--ink)}
.cb-catch{right:calc(var(--gut-r) + 2px);background:radial-gradient(circle at 34% 28%,#e59a5c,var(--leather) 58%,var(--leather-dk))!important;color:var(--chalk)}
.cb-catch span{text-shadow:0 2px 0 var(--leather-dk)}
.cb-act.down{transform:translateY(5px) scale(.95)}
.cb-act.off{opacity:.42;filter:saturate(.25)}
.cb-act.ready::after{content:"";position:absolute;inset:-11px;border-radius:50%;border:4px solid var(--bulb);animation:cb-ring 1s ease-out infinite;pointer-events:none}
@keyframes cb-ring{0%{transform:scale(.9);opacity:1}100%{transform:scale(1.22);opacity:0}}
/* 던지기 판 — 빠르기 셋 + 구종 넷 (던질 차례에만) */
.cb-tpanel{position:absolute;z-index:6;left:calc(var(--gut-l) + 2px);bottom:calc(var(--sb) + 30px + var(--btn));display:flex;gap:6px}
.cb-tcol{display:flex;flex-direction:column;gap:5px;width:78px}
.cb-tcol-h{font-size:11px;color:var(--chalk);text-align:center;text-shadow:0 1px 0 var(--ink),1px 0 0 var(--ink),-1px 0 0 var(--ink)}
.cb-sp,.cb-pt{width:100%!important;height:31px!important;border-radius:11px;font-family:var(--font-display)!important;font-size:14px!important;color:var(--ink)!important;
  background:rgba(255,250,240,.94)!important;border:3px solid var(--ink)!important;box-shadow:0 3px 0 var(--ink)!important;opacity:.8;transition:transform .08s,opacity .15s}
.cb-sp[aria-checked="true"],.cb-pt[aria-checked="true"]{opacity:1;transform:scale(1.06);color:var(--chalk)!important}
.cb-sp.sp2[aria-checked="true"]{background:var(--stitch)!important}
.cb-sp.sp1[aria-checked="true"]{background:#d8960c!important}
.cb-sp.sp0[aria-checked="true"]{background:#2f78c9!important}
.cb-pt[aria-checked="true"]{background:#7a3fd6!important}
.cb-pt[data-pt="0"][aria-checked="true"]{background:var(--ink)!important}
.cb-pt.spin{animation:cb-spin .6s cubic-bezier(.3,1.5,.5,1)}
@keyframes cb-spin{0%{transform:scale(1) rotate(0)}40%{transform:scale(1.35) rotate(200deg)}100%{transform:scale(1.06) rotate(360deg)}}
.cb-swipe{position:absolute;z-index:6;right:calc(var(--gut-r) + 2px);bottom:calc(var(--sb) + 16px);width:var(--btn);height:calc(var(--btn) * 1.25);
  border-radius:24px;border:3px dashed rgba(255,250,240,.9);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding-bottom:8px;
  color:var(--chalk);font-family:var(--font-display);font-size:14px;text-align:center;pointer-events:none;
  text-shadow:0 2px 0 var(--ink),1px 0 0 var(--ink),-1px 0 0 var(--ink);background:rgba(21,48,75,.25)}
.cb-swipe b{font-size:30px;line-height:1;animation:cb-up 1.1s ease-in-out infinite}
@keyframes cb-up{0%{transform:translateY(18px);opacity:0}30%{opacity:1}100%{transform:translateY(-26px);opacity:0}}

/* ---------- 안내 · 배너 ---------- */
.cb-hint{position:absolute;z-index:7;left:50%;top:calc(var(--st) + 104px);transform:translateX(-50%);
  width:max-content;max-width:calc(100% - 32px);padding:8px 16px 7px;border-radius:14px;white-space:pre-line;
  background:rgba(21,48,75,.9);color:var(--chalk);font-size:clamp(14px,3.9vw,17px);text-align:center;
  box-shadow:0 4px 0 rgba(0,0,0,.18);pointer-events:none;animation:cb-hintIn .25s ease-out}
.cb-duel .cb-hint{top:calc(var(--st) + 128px)}
@keyframes cb-hintIn{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}
.cb-step{position:absolute;z-index:7;left:50%;top:calc(var(--st) + 104px);transform:translateX(-50%);
  background:var(--chalk);color:var(--ink);border:3px solid var(--ink);border-radius:14px;padding:6px 14px 5px;text-align:center;box-shadow:0 3px 0 var(--ink);
  width:max-content;max-width:min(330px,calc(100% - 32px));pointer-events:none}
.cb-duel .cb-step{top:calc(var(--st) + 128px)}
.cb-step b{display:block;font-family:var(--font-display);font-weight:400;font-size:21px;color:var(--stitch)}
.cb-step span{font-size:13px}
.cb-banner{position:absolute;z-index:8;left:0;right:0;top:30%;text-align:center;pointer-events:none;padding:0 16px}
.cb-banner.show{animation:cb-bannerIn 1.8s ease-out forwards}
.cb-banner.long.show{animation-duration:2.8s}
.cb-bmain{font-family:var(--font-display);font-size:clamp(42px,13vw,88px);line-height:1;color:var(--chalk);
  text-shadow:0 5px 0 var(--ink),3px 0 0 var(--ink),-3px 0 0 var(--ink),0 -3px 0 var(--ink),3px 3px 0 var(--ink),-3px 3px 0 var(--ink),3px -3px 0 var(--ink),-3px -3px 0 var(--ink)}
.cb-bsub{display:inline-block;margin-top:10px;padding:5px 14px 4px;border-radius:999px;background:var(--stitch);color:var(--chalk);
  font-size:clamp(15px,4.4vw,21px);border:3px solid var(--ink);box-shadow:0 3px 0 var(--ink);max-width:100%}
@keyframes cb-bannerIn{0%{opacity:0;transform:scale(.4) rotate(-6deg)}14%{opacity:1;transform:scale(1.12) rotate(-3deg)}
  24%{transform:scale(1) rotate(-3deg)}80%{opacity:1;transform:scale(1) rotate(-3deg)}100%{opacity:0;transform:scale(1.05) translateY(-18px) rotate(-3deg)}}

/* ---------- 타이틀 ---------- */
.cb-title{position:absolute;inset:0;z-index:10;display:grid;grid-template-rows:auto minmax(100px,1fr) auto;justify-items:center;
  padding:calc(var(--st) + 16px) var(--gut-r) calc(var(--sb) + 14px) var(--gut-l)}
.cb-ttools{position:absolute;top:calc(var(--st) + 10px);right:var(--gut-r);display:flex;gap:6px;z-index:2}
.cb-ttop{display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center}
.cb-kicker{margin:0;font-size:14px;color:var(--chalk);letter-spacing:.14em;background:var(--ink);padding:4px 12px 3px;border-radius:999px}
.cb-logo{margin:2px 0 0;font-family:var(--font-display);font-weight:400;font-size:clamp(58px,19vw,124px);line-height:.92;color:var(--chalk);transform:rotate(-4deg);
  text-shadow:0 7px 0 var(--ink),4px 0 0 var(--ink),-4px 0 0 var(--ink),0 -4px 0 var(--ink),4px 4px 0 var(--ink),-4px 4px 0 var(--ink),4px -4px 0 var(--ink),-4px -4px 0 var(--ink),0 12px 0 var(--stitch)}
.cb-seam{display:block;width:min(240px,58vw);height:18px;margin-top:2px}
.cb-tag{margin:0;font-size:clamp(15px,4.2vw,19px);color:var(--ink);background:rgba(255,250,240,.88);padding:4px 13px 3px;border-radius:12px;text-align:center}
.cb-stage{width:100%;min-height:0}
.cb-tbot{display:flex;flex-direction:column;align-items:center;gap:8px;width:min(430px,100%)}
.cb-statrow{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}
.cb-stat{background:var(--board);color:#cfe8d6;border:3px solid #0c2617;border-radius:11px;padding:4px 10px 3px;font-size:13.5px;white-space:nowrap}
.cb-stat b{font-family:var(--font-display);font-weight:400;color:var(--bulb);font-size:17px;margin:0 1px;font-variant-numeric:tabular-nums}
.cb-diffs{display:flex;align-items:center;gap:4px;background:rgba(255,250,240,.92);border:2.5px solid var(--ink);border-radius:999px;padding:4px 5px 4px 12px}
.cb-dlabel{font-size:15px;margin-right:4px}
.cb-dbtn{padding:6px 13px 5px!important;border-radius:999px;font-family:var(--font-display)!important;font-size:17px!important;color:var(--ink)!important;background:transparent!important}
.cb-dbtn[aria-checked="true"]{color:var(--chalk)!important;box-shadow:0 2px 0 var(--ink)!important}
.cb-dbtn[data-diff="easy"][aria-checked="true"]{background:#2f9a4f!important}
.cb-dbtn[data-diff="normal"][aria-checked="true"]{background:#d8960c!important}
.cb-dbtn[data-diff="hard"][aria-checked="true"]{background:var(--stitch)!important}
.cb-big{width:100%!important;padding:12px 0 10px!important;border-radius:18px;background:var(--stitch)!important;color:var(--chalk)!important;
  font-family:var(--font-display)!important;font-size:28px!important;letter-spacing:.04em;border:4px solid var(--ink)!important;box-shadow:0 6px 0 var(--ink)!important}
.cb-big:active{transform:translateY(5px)}
.cb-ghost{width:100%!important;padding:10px 0 8px!important;border-radius:16px;background:var(--chalk)!important;color:var(--ink)!important;font-size:19px!important;
  border:3px solid var(--ink)!important;box-shadow:0 4px 0 var(--ink)!important}
.cb-ghost:active{transform:translateY(3px)}
.cb-duelbtn{background:var(--bulb)!important;font-family:var(--font-display)!important;font-size:21px!important}
.cb-iconrow{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;width:100%}
.cb-ib{position:relative;display:flex!important;flex-direction:column;align-items:center;gap:1px;padding:6px 0 5px!important;border-radius:14px;
  background:rgba(255,250,240,.94)!important;border:2.5px solid var(--ink)!important;box-shadow:0 3px 0 var(--ink)!important;font-size:12px!important;color:var(--ink)!important}
.cb-ib i{font-style:normal;font-size:22px;line-height:1.1}
.cb-ib span{white-space:nowrap}
.cb-ib em{position:absolute;top:-8px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--stitch);color:#fff;
  font-style:normal;font-family:var(--font-display);font-size:13px;line-height:20px;border:2px solid var(--ink);animation:cb-rec .8s ease-in-out infinite alternate}
.cb-ib:active{transform:translateY(2px)}
.cb-howto{margin:0;font-size:13px;line-height:1.45;text-align:center;color:var(--chalk);background:rgba(21,48,75,.82);padding:6px 13px 5px;border-radius:12px}
.cb-howto b{color:var(--bulb);font-weight:400}
@media (orientation:portrait) and (max-height:820px){.cb-howto{display:none}.cb-tag{display:none}}
@media (orientation:landscape) and (max-height:560px){
  .cb-title{grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);grid-template-rows:auto 1fr;column-gap:16px;align-items:center}
  .cb-ttop{grid-column:2;grid-row:1;align-self:end}
  .cb-tbot{grid-column:2;grid-row:2;align-self:start;margin-top:8px;gap:6px}
  .cb-stage{grid-column:1;grid-row:1/3;height:100%}
  .cb-logo{font-size:clamp(44px,10vh,80px)}
  .cb-tag,.cb-howto,.cb-seam,.cb-kicker{display:none}
  .cb-big{padding:7px 0 5px!important;font-size:22px!important}
  .cb-ghost{padding:5px 0 3px!important;font-size:16px!important}
  .cb-ib{padding:3px 0 2px!important}.cb-ib i{font-size:18px}
}

/* ---------- 창 (경기 끝 · 일시정지) ---------- */
.cb-overlay{position:absolute;inset:0;z-index:12;display:grid;place-items:center;background:rgba(10,30,50,.5);
  padding:calc(var(--st) + 16px) var(--gut-r) calc(var(--sb) + 16px) var(--gut-l);overflow:auto}
.cb-card{width:min(360px,100%);background:var(--chalk);border:4px solid var(--ink);border-radius:24px;box-shadow:0 8px 0 var(--ink);
  padding:18px 18px 20px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;animation:cb-cardIn .35s cubic-bezier(.2,1.4,.4,1)}
@keyframes cb-cardIn{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
.cb-ctitle{margin:0;font-family:var(--font-display);font-weight:400;font-size:34px;color:var(--ink)}
.cb-board{width:100%;background:var(--board);border:4px solid #0c2617;border-radius:16px;padding:8px 10px 10px}
.cb-blabel{color:#cfe8d6;font-size:15px;letter-spacing:.06em}
.cb-bnum{font-family:var(--font-display);font-size:64px;line-height:1;color:var(--bulb);text-shadow:0 0 14px rgba(255,216,74,.6);font-variant-numeric:tabular-nums}
.cb-vsboard{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;color:#cfe8d6}
.cb-vsboard .cb-bnum{font-size:50px}
.cb-vsname{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cb-vsmid{font-family:var(--font-display);font-size:22px;color:var(--chalk)}
.cb-newrec{margin:-4px 0 0;padding:4px 14px 3px;border-radius:999px;background:var(--bulb);border:3px solid var(--ink);font-family:var(--font-display);font-size:19px;
  animation:cb-rec .9s ease-in-out infinite alternate}
@keyframes cb-rec{from{transform:rotate(-3deg) scale(1)}to{transform:rotate(3deg) scale(1.08)}}
.cb-rank{margin:0;font-size:16px}
.cb-rank b{font-family:var(--font-display);font-weight:400;color:var(--stitch);font-size:21px;margin-left:4px}
.cb-stats{list-style:none;margin:0;padding:0;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:7px}
.cb-stats li{display:flex;justify-content:space-between;align-items:baseline;background:#f1e8d4;border-radius:10px;padding:6px 9px 5px;font-size:13.5px}
.cb-stats b{font-family:var(--font-display);font-weight:400;font-size:18px;font-variant-numeric:tabular-nums}
.cb-btns{display:flex;flex-direction:column;gap:9px;width:100%;margin-top:2px}

/* ---------- 대결 시작 ---------- */
.cb-vs{position:absolute;inset:0;z-index:11;display:grid;place-items:center;background:rgba(10,30,50,.35);pointer-events:none}
.cb-vscard{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:0 16px}
.cb-vsline{display:flex;align-items:center;gap:14px;font-family:var(--font-display);font-size:clamp(22px,6.5vw,34px);color:var(--chalk);
  text-shadow:0 3px 0 var(--ink),2px 0 0 var(--ink),-2px 0 0 var(--ink),0 -2px 0 var(--ink)}
.cb-vsline em{font-style:normal;color:var(--bulb);font-size:1.3em}
.cb-vsline span{max-width:38vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cb-vscount{font-family:var(--font-display);font-size:clamp(72px,24vw,140px);line-height:1;color:var(--chalk);
  text-shadow:0 6px 0 var(--ink),4px 0 0 var(--ink),-4px 0 0 var(--ink),0 -4px 0 var(--ink)}
.cb-vsrule{background:rgba(21,48,75,.9);color:var(--chalk);border-radius:14px;padding:8px 14px 7px;font-size:clamp(13px,3.6vw,16px);max-width:min(420px,100%)}

/* ---------- 시트 (꾸미기 · 선물함 · 자세 배우기) ---------- */
.cb-sheet{position:absolute;inset:0;z-index:13;display:flex;justify-content:center;background:rgba(10,30,50,.55);
  padding:calc(var(--st) + 10px) var(--gut-r) calc(var(--sb) + 10px) var(--gut-l)}
.cb-sheet-in{width:min(480px,100%);height:100%;display:flex;flex-direction:column;background:var(--chalk);border:4px solid var(--ink);border-radius:22px;
  box-shadow:0 8px 0 var(--ink);overflow:hidden;animation:cb-cardIn .3s cubic-bezier(.2,1.3,.4,1)}
.cb-sheet-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px 8px 16px;border-bottom:3px solid var(--ink);background:#ffe9a8}
.cb-sheet-hd h2{margin:0;font-family:var(--font-display);font-weight:400;font-size:26px}
.cb-close{padding:7px 16px 5px!important;border-radius:12px;background:var(--stitch)!important;color:var(--chalk)!important;font-family:var(--font-display)!important;font-size:18px!important;
  border:3px solid var(--ink)!important;box-shadow:0 3px 0 var(--ink)!important}
.cb-closet-top{position:relative;display:flex;justify-content:center;align-items:flex-end;height:min(36vh,230px);flex:0 0 auto;
  background:linear-gradient(#bfe9ff,#e5f6ff 62%,#8fd06f 62%,#6fba55)}
.cb-closet-top canvas{height:100%;width:auto;max-width:100%}
.cb-emoji{position:absolute;top:10px;right:12px;font-size:30px;background:#fff;border:3px solid var(--ink);border-radius:50%;width:48px;height:48px;display:grid;place-items:center;box-shadow:0 3px 0 var(--ink)}
.cb-tabs{display:flex;gap:4px;padding:8px 8px 0;overflow-x:auto;flex:0 0 auto;border-bottom:3px solid var(--ink);background:#f6edd8;scrollbar-width:none}
.cb-tab{flex:0 0 auto;padding:7px 12px 6px!important;border-radius:12px 12px 0 0;background:#e8dcc0!important;border:3px solid var(--ink)!important;border-bottom:0!important;
  font-family:var(--font-display)!important;font-size:15px!important;color:var(--ink)!important;margin-bottom:-3px!important}
.cb-tab[aria-selected="true"]{background:var(--chalk)!important;color:var(--stitch)!important}
.cb-panel{flex:1 1 auto;overflow-y:auto;padding:12px 14px 18px;display:flex;flex-direction:column;gap:14px;touch-action:pan-y}
.cb-sec h3{margin:0 0 7px;font-family:var(--font-display);font-weight:400;font-size:17px}
.cb-sec p{margin:0 0 7px;font-size:13px;color:#4b5b6b}
.cb-opts{display:flex;flex-wrap:wrap;gap:8px}
.cb-opt{position:relative;min-width:44px;height:44px;padding:0 10px!important;border-radius:12px;background:#fff!important;border:3px solid #c9bfa8!important;
  font-size:14px!important;color:var(--ink)!important;display:inline-flex!important;align-items:center;justify-content:center;gap:4px}
.cb-opt.sw{width:44px;padding:0!important;border-radius:50%}
.cb-opt.sw::before{content:"";width:28px;height:28px;border-radius:50%;background:var(--c);border:2px solid rgba(0,0,0,.25)}
.cb-opt.big{width:76px;height:84px;padding:4px 2px 2px!important;flex-direction:column;font-size:11.5px!important;line-height:1.15;text-align:center}
.cb-opt.big canvas{flex:0 0 auto}
.cb-opt[aria-checked="true"]{border-color:var(--ink)!important;box-shadow:0 0 0 3px var(--bulb)!important}
.cb-opt.locked{background:#ece7dc!important;color:#8d8577!important}
.cb-opt.locked canvas{filter:grayscale(1) brightness(1.15);opacity:.45}
.cb-opt.locked::after{content:"🔒";position:absolute;top:2px;right:3px;font-size:14px}
.cb-opt.gift::after{content:"🎁";position:absolute;top:2px;right:3px;font-size:14px}
.cb-opt.emo{font-size:24px!important;width:48px;padding:0!important}
.cb-info{flex:0 0 auto;min-height:20px;line-height:1.45;font-size:13.5px;background:#fff5d6;border:2px dashed #d8b45a;border-radius:10px;padding:6px 10px 5px}
.cb-step-ctl{display:flex;align-items:center;gap:10px}
.cb-step-ctl button{min-width:44px;height:40px;border-radius:12px;background:#fff!important;border:3px solid var(--ink)!important;font-family:var(--font-display)!important;font-size:18px!important;padding:0 10px!important}
.cb-num{font-family:var(--font-display);font-size:26px;min-width:52px;text-align:center}
.cb-gift{display:flex;align-items:center;gap:12px;background:#fff;border:3px solid var(--ink);border-radius:14px;padding:8px 10px}
.cb-gift > div{flex:1;min-width:0}
.cb-gift b{display:block;font-family:var(--font-display);font-weight:400;font-size:17px}
.cb-gift small{font-size:12.5px;color:#56606b}
.cb-gift button{padding:8px 14px 6px!important;border-radius:12px;background:var(--stitch)!important;color:#fff!important;font-family:var(--font-display)!important;font-size:16px!important;border:3px solid var(--ink)!important;box-shadow:0 3px 0 var(--ink)!important}
.cb-empty{text-align:center;padding:30px 10px;color:#56606b;font-size:15px}
.cb-lesson-cv{display:block;width:100%;height:min(46vh,330px);background:linear-gradient(#bfe9ff,#e5f6ff 66%,#8fd06f 66%,#6fba55);flex:0 0 auto}
.cb-lesson-step{font-family:var(--font-display);font-size:24px;color:var(--stitch)}
.cb-lesson-tip{font-size:16px;line-height:1.5}
.cb-dots{display:flex;gap:6px}
.cb-dots i{width:12px;height:12px;border-radius:50%;background:#d9cfb8;border:2px solid var(--ink)}
.cb-dots i.on{background:var(--stitch)}
@media (prefers-reduced-motion:reduce){
  .cb-banner.show,.cb-card,.cb-newrec,.cb-act.ready::after,.cb-plate-num.bump,.cb-life.pop,.cb-hint,.cb-pt.spin,.cb-swipe b,.cb-ib em{animation-duration:.01s!important;animation-iteration-count:1!important}
}
`;

export const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Jua&display=swap';

export const BALL_SVG = '<svg class="cb-life" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#15304b" stroke-width="2"/><path d="M6.5 5.5c2.4 3.6 2.4 9.4 0 13M17.5 5.5c-2.4 3.6-2.4 9.4 0 13" fill="none" stroke="#e23b2e" stroke-width="1.8" stroke-linecap="round"/></svg>';

const SVG_SOUND = '<svg data-on viewBox="0 0 24 24" fill="none" stroke="#15304b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#15304b"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg><svg data-off viewBox="0 0 24 24" fill="none" stroke="#15304b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#15304b"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>';
const SVG_MUSIC = '<svg data-on viewBox="0 0 24 24" fill="#15304b"><path d="M9 4v11.2A3.5 3.5 0 1 0 11 18V8h7V4z"/></svg><svg data-off viewBox="0 0 24 24" fill="#15304b"><path d="M9 4v11.2A3.5 3.5 0 1 0 11 18V8h7V4z" opacity=".45"/><path d="M4 4l16 16" stroke="#e23b2e" stroke-width="2.6" stroke-linecap="round"/></svg>';

export const HTML = `
<canvas class="cb-canvas" aria-label="야구 캐치볼 게임 화면"></canvas>
<div class="cb-hud" hidden>
  <div class="cb-plate">
    <div class="cb-plate-label">잡은 공</div>
    <div class="cb-plate-num" data-cb="score">0</div>
    <div class="cb-plate-best" data-cb="bestline"><span data-cb="bestDiffHud">보통</span> 최고 <span data-cb="best">0</span></div>
  </div>
  <div class="cb-mid">
    <div class="cb-chip" data-cb="level"><b>Lv.1</b>동네 캐치볼</div>
    <div class="cb-opp" data-cb="opp" hidden><span class="cb-opp-name" data-cb="oppname"></span><span class="cb-lives" data-cb="opplives"></span><span class="cb-opp-score" data-cb="oppscore">0</span></div>
    <div class="cb-combo" data-cb="combo"></div>
    <div class="cb-strk" data-cb="strk"></div>
  </div>
  <div class="cb-right">
    <div class="cb-hbtns">
      <button class="cb-icon" data-cb="bgm" type="button" aria-label="배경음악">${SVG_MUSIC}</button>
      <button class="cb-icon" data-cb="mute" type="button" aria-label="효과음">${SVG_SOUND}</button>
      <button class="cb-icon" data-cb="pause" type="button" aria-label="일시정지">
        <svg viewBox="0 0 24 24" fill="#15304b"><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>
      </button>
    </div>
    <div class="cb-lives" data-cb="lives" aria-label="남은 공"></div>
    <div class="cb-errs" data-cb="errs" hidden>실책 <i></i><i></i><i></i></div>
  </div>
</div>
<div class="cb-hint" data-cb="hint" hidden></div>
<div class="cb-step" data-cb="step" hidden><b data-cb="stepT"></b><span data-cb="stepTip"></span></div>
<div class="cb-banner" data-cb="banner" hidden><div class="cb-bmain" data-cb="bmain"></div><div class="cb-bsub" data-cb="bsub"></div></div>
<div data-cb="controls" hidden>
  <div class="cb-tpanel" data-cb="tpanel" hidden>
    <div class="cb-tcol" role="radiogroup" aria-label="공 빠르기">
      <div class="cb-tcol-h">빠르기</div>
      <button class="cb-sp sp2" type="button" role="radio" data-sp="2">빠른 볼</button>
      <button class="cb-sp sp1" type="button" role="radio" data-sp="1">중간 볼</button>
      <button class="cb-sp sp0" type="button" role="radio" data-sp="0">느린 볼</button>
    </div>
    <div class="cb-tcol" role="radiogroup" aria-label="구종">
      <div class="cb-tcol-h">구종</div>
      <button class="cb-pt" type="button" role="radio" data-pt="0">직구</button>
      <button class="cb-pt" type="button" role="radio" data-pt="1">커브</button>
      <button class="cb-pt" type="button" role="radio" data-pt="2">슬라이더</button>
      <button class="cb-pt" type="button" role="radio" data-pt="3">포크볼</button>
    </div>
  </div>
  <button class="cb-act cb-throw off" data-cb="throwBtn" type="button" aria-label="던지기">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M6 22h12M3 32h14M6 42h12" stroke="#15304b" stroke-width="4" stroke-linecap="round"/>
      <circle cx="40" cy="32" r="19" fill="#fff" stroke="#15304b" stroke-width="3.5"/>
      <path d="M28 18c5 8 5 20 0 28M52 18c-5 8-5 20 0 28" fill="none" stroke="#e23b2e" stroke-width="3" stroke-linecap="round" stroke-dasharray="3 3.2"/>
    </svg>
    <span data-cb="throwLabel">던지기</span>
  </button>
  <button class="cb-act cb-catch off" data-cb="catchBtn" type="button" aria-label="잡기">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M17 44C11 37 9 25 12 18c2-4 7-4 8 1l2 9 1-17c0-4 3-6 6-6s5 3 5 6l-1 15 4-13c1-4 5-5 8-3 3 1 3 5 2 8l-4 14 6-5c3-2 7-1 8 2 1 3-1 6-4 8L42 50c-5 5-10 7-15 6-4 0-8-4-10-12z" fill="#f6c08c" stroke="#15304b" stroke-width="3.2" stroke-linejoin="round"/>
      <ellipse cx="31" cy="40" rx="8" ry="7" fill="#c47a40"/>
      <path d="M21 30l-2-11M29 27l0-16M37 28l3-12" stroke="#c47a40" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <span>잡기</span>
  </button>
  <div class="cb-swipe" data-cb="swipe" hidden><b>⬆</b>위로 밀어<br>던지기</div>
</div>
<section class="cb-title" data-cb="title" hidden>
  <div class="cb-ttools">
    <button class="cb-icon" data-cb="tBgm" type="button" aria-label="배경음악">${SVG_MUSIC}</button>
    <button class="cb-icon" data-cb="tMute" type="button" aria-label="효과음">${SVG_SOUND}</button>
  </div>
  <header class="cb-ttop">
    <p class="cb-kicker">주말 공원 야구</p>
    <h1 class="cb-logo">캐치볼</h1>
    <svg class="cb-seam" viewBox="0 0 260 20" aria-hidden="true"><path d="M6 6q124 18 248 0" fill="none" stroke="#e23b2e" stroke-width="4" stroke-linecap="round" stroke-dasharray="7 7"/></svg>
    <p class="cb-tag">날아오는 공을 잡고, 친구에게 다시 던져요!</p>
  </header>
  <div class="cb-stage" data-cb="stage"></div>
  <footer class="cb-tbot">
    <div class="cb-statrow">
      <div class="cb-stat"><span data-cb="bestDiff">보통</span> 최고 <b data-cb="bestTitle">0</b> · 콤보 <b data-cb="comboTitle">0</b></div>
      <div class="cb-stat">최고 <b>Lv.<span data-cb="lvTitle">1</span></b> · 연속 스트라이크 <b data-cb="strTitle">0</b></div>
      <div class="cb-stat" data-cb="duelRec" hidden>1:1 <b data-cb="duelWins">0</b>승 <b data-cb="duelLosses">0</b>패</div>
    </div>
    <div class="cb-diffs" role="radiogroup" aria-label="난이도" data-cb="diffs">
      <span class="cb-dlabel">난이도</span>
      <button class="cb-dbtn" type="button" role="radio" data-diff="easy">쉬움</button>
      <button class="cb-dbtn" type="button" role="radio" data-diff="normal">보통</button>
      <button class="cb-dbtn" type="button" role="radio" data-diff="hard">어려움</button>
    </div>
    <button class="cb-big" data-cb="start" type="button">혼자 하기</button>
    <button class="cb-ghost cb-duelbtn" data-cb="duelBtn" type="button" hidden>친구랑 1:1 대결</button>
    <div class="cb-iconrow">
      <button class="cb-ib" data-cb="openCloset" type="button"><i>👕</i><span>꾸미기</span></button>
      <button class="cb-ib" data-cb="openGifts" type="button"><i>🎁</i><span>선물함</span><em data-cb="giftCount" hidden>0</em></button>
      <button class="cb-ib" data-cb="openRank" type="button"><i>🏆</i><span>명예의 전당</span></button>
      <button class="cb-ib" data-cb="openLesson" type="button"><i>🎓</i><span>자세 배우기</span></button>
      <button class="cb-ib" data-cb="exitTitle" type="button"><i>🚪</i><span>나가기</span></button>
    </div>
    <p class="cb-howto" data-cb="howto">화면을 <b>끌면</b> 글러브가 움직여요 · 공이 오면 <b>잡기</b>(화면을 톡!) · 던질 땐 화면을 <b>위로 밀어요</b></p>
  </footer>
</section>
<section class="cb-vs" data-cb="vs" hidden>
  <div class="cb-vscard">
    <div class="cb-vsline"><span data-cb="vsMe">나</span><em>VS</em><span data-cb="vsOpp">상대</span></div>
    <div class="cb-vscount" data-cb="vsCount">3</div>
    <div class="cb-vsrule" data-cb="vsRule">공 3개씩</div>
  </div>
</section>
<section class="cb-overlay" data-cb="over" hidden>
  <div class="cb-card" role="dialog" aria-modal="true">
    <h2 class="cb-ctitle" data-cb="overTitle">경기 끝!</h2>
    <div class="cb-board" data-cb="soloBoard">
      <div class="cb-blabel" data-cb="soloLabel">오늘 잡은 공</div>
      <div class="cb-bnum" data-cb="overScore">0</div>
    </div>
    <div class="cb-board cb-vsboard" data-cb="duelBoard" hidden>
      <div><div class="cb-vsname">나</div><div class="cb-bnum" data-cb="dMe">0</div></div>
      <div class="cb-vsmid">VS</div>
      <div><div class="cb-vsname" data-cb="dOppName">상대</div><div class="cb-bnum" data-cb="dOpp">0</div></div>
    </div>
    <p class="cb-newrec" data-cb="newRec" hidden>신기록!</p>
    <p class="cb-rank" data-cb="rankLine">오늘의 실력<b data-cb="overRank">동네 캐치볼</b></p>
    <ul class="cb-stats" data-cb="stats">
      <li><span>최고 기록</span><b data-cb="overBest">0</b></li>
      <li><span>최대 콤보</span><b data-cb="overCombo">0</b></li>
      <li><span>PERFECT</span><b data-cb="overPerfect">0</b></li>
      <li><span>연속 스트라이크</span><b data-cb="overStrikes">0</b></li>
      <li><span>스트라이크</span><b data-cb="overStrikeAll">0</b></li>
      <li><span>실책</span><b data-cb="overErrors">0</b></li>
    </ul>
    <div class="cb-btns">
      <button class="cb-big" data-cb="retry" type="button">다시 하기</button>
      <button class="cb-ghost" data-cb="home" type="button">처음으로</button>
    </div>
  </div>
</section>
<section class="cb-overlay" data-cb="pauseBox" hidden>
  <div class="cb-card" role="dialog" aria-modal="true">
    <h2 class="cb-ctitle" data-cb="pauseTitle">잠깐 쉬어요</h2>
    <div class="cb-btns">
      <button class="cb-big" data-cb="resume" type="button">계속하기</button>
      <button class="cb-ghost" data-cb="quit" type="button">나가기</button>
    </div>
  </div>
</section>
<section class="cb-sheet" data-cb="closet" hidden>
  <div class="cb-sheet-in" role="dialog" aria-modal="true" aria-label="꾸미기">
    <header class="cb-sheet-hd"><h2>꾸미기</h2><button class="cb-close" data-cb="closetDone" type="button">완료</button></header>
    <div class="cb-closet-top"><canvas data-cb="closetCv" width="400" height="460"></canvas><div class="cb-emoji" data-cb="closetEmoji">😀</div></div>
    <nav class="cb-tabs" data-cb="closetTabs" role="tablist"></nav>
    <div class="cb-panel" data-cb="closetPanel"></div>
  </div>
</section>
<section class="cb-sheet" data-cb="gifts" hidden>
  <div class="cb-sheet-in" role="dialog" aria-modal="true" aria-label="선물함">
    <header class="cb-sheet-hd"><h2>선물함</h2><button class="cb-close" data-cb="giftsDone" type="button">닫기</button></header>
    <div class="cb-panel" data-cb="giftPanel"></div>
  </div>
</section>
<section class="cb-sheet" data-cb="lesson" hidden>
  <div class="cb-sheet-in" role="dialog" aria-modal="true" aria-label="자세 배우기">
    <header class="cb-sheet-hd"><h2>던지기 자세 배우기</h2><button class="cb-close" data-cb="lessonDone" type="button">닫기</button></header>
    <canvas class="cb-lesson-cv" data-cb="lessonCv"></canvas>
    <div class="cb-panel">
      <div class="cb-dots" data-cb="lessonDots"></div>
      <div class="cb-lesson-step" data-cb="lessonStep"></div>
      <div class="cb-lesson-tip" data-cb="lessonTip"></div>
      <div class="cb-step-ctl">
        <button type="button" data-cb="lessonPrev">◀</button>
        <button type="button" data-cb="lessonPlay">자동 재생</button>
        <button type="button" data-cb="lessonNext">▶</button>
      </div>
    </div>
  </div>
</section>
<div data-cb="probe" aria-hidden="true" style="position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;width:var(--btn);height:1px;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);box-sizing:content-box"></div>
`;
