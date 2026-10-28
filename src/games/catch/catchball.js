/**
 * 캐치볼 — 오락실 이안월드의 3번째 게임. (2026-10-28)
 *
 * 처음에는 `cowork/catchball/index.html` 한 파일짜리 게임이었다. 드래곤처럼
 * iframe 으로 붙이지 않고 **모듈로 옮겼다** — iframe 은 포커스가 부모로 새서
 * 키보드가 죽는다(DragonGame.js 머리 주석, 같은 이유).
 *
 * ## 이 파일은 Firebase 를 모른다
 * 혼자 하는 판은 그대로 돌고, 1:1 대결(`mode: 'duel'`)은 화면(`screens/CatchGame.js`)이
 * 넣어 주는 두 통로로만 바깥과 이어진다.
 *   · 나가는 쪽 : `opts.duel.send(fields)` — 내 참가자 칸에 쓸 값
 *   · 들어오는 쪽: `setRemote(node)` — 상대 참가자 칸 스냅샷 (없어지면 `null`)
 * 그래서 두 판을 한 페이지에 띄워 놓고 서로 잇기만 하면 네트워크 없이 검사할 수 있다.
 *
 * ## 대결은 차례대로 주고받는다 (lockstep 이 아니다)
 * 공은 한 번에 하나뿐이라 **던진 사람이 공을 쥐고 있는 동안 상대는 할 일이 없다.**
 * 그래서 세상을 맞출 필요가 없다 — 던질 때 "어디로·어떤 공·몇 초" 를 한 줄로 보내고,
 * 받는 쪽이 자기 화면에서 그 공을 날려 잡았는지 직접 판정한 뒤 결과 한 줄을 돌려준다.
 *   · `th` = `판|순번|공종류|x(cm)|y(cm)|비행(ms)`  — 좌표는 **받는 사람 기준**
 *   · `ct` = `판|순번|결과`  (p 퍼펙트 · g 그레이트 · n 나이스 · l 아슬아슬 · m 놓침 · w 악송구)
 * 순번은 두 사람이 번갈아 하나씩 올리므로 덮어쓸 일이 없다. 지연(100~300ms)은
 * 공이 날아가는 시간 안에 묻힌다.
 *
 * ## 승부
 * 각자 공 3개(목숨). 잡을 수 있는 공을 놓치면 받은 사람이 하나 잃고,
 * 손이 닿지 않는 곳으로 던지면(악송구) **던진 사람이** 하나 잃는다.
 * 먼저 0개가 되는 사람이 진다. 랠리가 길어질수록 공이 빨라지고 과녁이 더 흔들린다.
 */

/* ======================================================================
   스타일 (전부 .cb-root 아래로 가둔다 — 오락실 화면과 섞이지 않게)
   ====================================================================== */
const CSS = `
.cb-root{
  --sky:#4db6f2;--grass:#4fae46;--ink:#15304b;--chalk:#fffaf0;--stitch:#e23b2e;
  --leather:#b5652b;--leather-dk:#7a3f17;--board:#183f2b;--bulb:#ffd84a;
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

.cb-hud{position:absolute;z-index:5;top:calc(var(--st) + 10px);left:var(--gut-l);right:var(--gut-r);
  display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:10px;pointer-events:none}
.cb-plate{background:var(--board);border:3px solid #0c2617;border-radius:12px;padding:5px 12px 6px;min-width:82px;text-align:center;
  box-shadow:0 3px 0 rgba(0,0,0,.25),inset 0 0 0 2px rgba(255,255,255,.07)}
.cb-plate-label{font-size:12px;color:#cfe8d6;letter-spacing:.06em}
.cb-plate-num{font-family:var(--font-display);font-size:34px;line-height:1.05;color:var(--bulb);text-shadow:0 0 10px rgba(255,216,74,.55);font-variant-numeric:tabular-nums}
.cb-plate-num.bump{animation:cb-bump .35s ease-out}
.cb-plate-best{font-size:11.5px;color:#cfe8d6;font-variant-numeric:tabular-nums}
@keyframes cb-bump{0%{transform:scale(1)}35%{transform:scale(1.4)}100%{transform:scale(1)}}
.cb-mid{display:flex;flex-direction:column;align-items:center;gap:6px;padding-top:6px;min-width:0}
.cb-chip{background:var(--chalk);color:var(--ink);border:2.5px solid var(--ink);border-radius:999px;padding:4px 12px 3px;
  font-size:clamp(12px,3.4vw,15px);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 0 var(--ink)}
.cb-chip b{font-family:var(--font-display);font-weight:400;color:var(--stitch);margin-right:5px}
.cb-combo{font-family:var(--font-display);font-size:19px;color:var(--chalk);min-height:22px;
  text-shadow:0 2px 0 var(--ink),2px 0 0 var(--ink),-2px 0 0 var(--ink),0 -2px 0 var(--ink)}
.cb-combo.hot{color:var(--bulb)}
.cb-opp{display:flex;align-items:center;gap:6px;max-width:100%;background:rgba(21,48,75,.88);color:var(--chalk);
  border-radius:12px;padding:4px 10px 4px 8px;font-size:clamp(12px,3.4vw,14px)}
.cb-opp-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.cb-opp-score{font-family:var(--font-display);color:var(--bulb);white-space:nowrap}
.cb-opp .cb-life{width:16px;height:16px}
.cb-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.cb-hbtns{display:flex;gap:6px;pointer-events:auto}
.cb-icon{width:40px;height:40px;border-radius:12px;background:rgba(255,250,240,.94)!important;border:2.5px solid var(--ink)!important;
  box-shadow:0 2px 0 var(--ink)!important;display:grid;place-items:center}
.cb-icon:active{transform:translateY(2px)}
.cb-icon svg{width:22px;height:22px}
.cb-lives{display:flex;gap:3px}
.cb-life{width:22px;height:22px;transition:transform .3s,opacity .3s,filter .3s}
.cb-life.lost{opacity:.3;filter:grayscale(1);transform:scale(.78)}
.cb-life.pop{animation:cb-lifepop .55s ease-out}
@keyframes cb-lifepop{0%{transform:scale(1)}30%{transform:scale(1.6) rotate(-20deg)}100%{transform:scale(.78)}}

.cb-act{position:absolute;z-index:6;bottom:calc(var(--sb) + 16px);width:var(--btn)!important;height:var(--btn)!important;border-radius:50%;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;
  border:4px solid var(--ink)!important;box-shadow:0 6px 0 var(--ink),0 12px 18px rgba(0,0,0,.22)!important;
  transition:transform .08s,opacity .2s,filter .2s;touch-action:none}
.cb-act svg{width:50%;height:50%;pointer-events:none}
.cb-act span{font-family:var(--font-display);font-size:calc(var(--btn)*.19);line-height:1;pointer-events:none}
.cb-throw{left:calc(var(--gut-l) + 2px);background:radial-gradient(circle at 34% 28%,#ffffff,#f2ebdb 66%,#d6c9ad)!important;color:var(--ink)}
.cb-catch{right:calc(var(--gut-r) + 2px);background:radial-gradient(circle at 34% 28%,#e59a5c,var(--leather) 58%,var(--leather-dk))!important;color:var(--chalk)}
.cb-catch span{text-shadow:0 2px 0 var(--leather-dk)}
.cb-act.down{transform:translateY(5px) scale(.95)}
.cb-act.off{opacity:.42;filter:saturate(.25)}
.cb-act.ready::after{content:"";position:absolute;inset:-11px;border-radius:50%;border:4px solid var(--bulb);animation:cb-ring 1s ease-out infinite;pointer-events:none}
@keyframes cb-ring{0%{transform:scale(.9);opacity:1}100%{transform:scale(1.22);opacity:0}}

.cb-hint{position:absolute;z-index:7;left:50%;top:calc(var(--st) + 98px);transform:translateX(-50%);
  width:max-content;max-width:calc(100% - 32px);padding:8px 16px 7px;border-radius:14px;white-space:pre-line;
  background:rgba(21,48,75,.9);color:var(--chalk);font-size:clamp(14px,3.9vw,17px);text-align:center;
  box-shadow:0 4px 0 rgba(0,0,0,.18);pointer-events:none;animation:cb-hintIn .25s ease-out}
.cb-duel .cb-hint{top:calc(var(--st) + 128px)}
@keyframes cb-hintIn{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}
.cb-banner{position:absolute;z-index:8;left:0;right:0;top:30%;text-align:center;pointer-events:none;padding:0 16px}
.cb-banner.show{animation:cb-bannerIn 1.8s ease-out forwards}
.cb-bmain{font-family:var(--font-display);font-size:clamp(46px,14vw,92px);line-height:1;color:var(--chalk);
  text-shadow:0 5px 0 var(--ink),3px 0 0 var(--ink),-3px 0 0 var(--ink),0 -3px 0 var(--ink),3px 3px 0 var(--ink),-3px 3px 0 var(--ink),3px -3px 0 var(--ink),-3px -3px 0 var(--ink)}
.cb-bsub{display:inline-block;margin-top:10px;padding:5px 14px 4px;border-radius:999px;background:var(--stitch);color:var(--chalk);
  font-size:clamp(16px,4.6vw,22px);border:3px solid var(--ink);box-shadow:0 3px 0 var(--ink)}
@keyframes cb-bannerIn{0%{opacity:0;transform:scale(.4) rotate(-6deg)}14%{opacity:1;transform:scale(1.12) rotate(-3deg)}
  24%{transform:scale(1) rotate(-3deg)}80%{opacity:1;transform:scale(1) rotate(-3deg)}100%{opacity:0;transform:scale(1.05) translateY(-18px) rotate(-3deg)}}

.cb-title{position:absolute;inset:0;z-index:10;display:grid;grid-template-rows:auto minmax(110px,1fr) auto;justify-items:center;
  padding:calc(var(--st) + 22px) var(--gut-r) calc(var(--sb) + 18px) var(--gut-l)}
.cb-ttop{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
.cb-kicker{margin:0;font-size:15px;color:var(--chalk);letter-spacing:.14em;background:var(--ink);padding:4px 12px 3px;border-radius:999px}
.cb-logo{margin:4px 0 0;font-family:var(--font-display);font-weight:400;font-size:clamp(66px,21vw,132px);line-height:.92;color:var(--chalk);transform:rotate(-4deg);
  text-shadow:0 7px 0 var(--ink),4px 0 0 var(--ink),-4px 0 0 var(--ink),0 -4px 0 var(--ink),4px 4px 0 var(--ink),-4px 4px 0 var(--ink),4px -4px 0 var(--ink),-4px -4px 0 var(--ink),0 12px 0 var(--stitch)}
.cb-seam{display:block;width:min(260px,60vw);height:20px;margin-top:4px}
.cb-tag{margin:0;font-size:clamp(16px,4.4vw,20px);color:var(--ink);background:rgba(255,250,240,.88);padding:5px 14px 4px;border-radius:12px;text-align:center}
.cb-stage{width:100%;min-height:0}
.cb-tbot{display:flex;flex-direction:column;align-items:center;gap:10px;width:min(420px,100%)}
.cb-row{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:10px 14px}
.cb-bestpill{background:var(--board);color:#cfe8d6;border:3px solid #0c2617;border-radius:12px;padding:5px 12px 4px;font-size:15px}
.cb-bestpill b{font-family:var(--font-display);font-weight:400;color:var(--bulb);font-size:20px;margin:0 2px;font-variant-numeric:tabular-nums}
.cb-uni{display:flex;align-items:center;gap:10px;background:rgba(255,250,240,.9);border:2.5px solid var(--ink);border-radius:999px;padding:5px 8px 5px 14px;font-size:15px}
.cb-sws{display:flex;gap:8px}
.cb-sw{width:32px!important;height:32px!important;border-radius:50%;background:var(--c)!important;border:3px solid var(--chalk)!important;box-shadow:0 0 0 2.5px var(--ink)!important}
.cb-sw[aria-checked="true"]{box-shadow:0 0 0 2.5px var(--ink),0 0 0 6px var(--bulb)!important}
.cb-big{width:100%!important;padding:14px 0 12px!important;border-radius:18px;background:var(--stitch)!important;color:var(--chalk)!important;
  font-family:var(--font-display)!important;font-size:30px!important;letter-spacing:.04em;border:4px solid var(--ink)!important;box-shadow:0 6px 0 var(--ink)!important}
.cb-big:active{transform:translateY(5px)}
.cb-ghost{width:100%!important;padding:11px 0 9px!important;border-radius:16px;background:var(--chalk)!important;color:var(--ink)!important;font-size:20px!important;
  border:3px solid var(--ink)!important;box-shadow:0 4px 0 var(--ink)!important}
.cb-ghost:active{transform:translateY(3px)}
.cb-duelbtn{background:var(--bulb)!important;font-family:var(--font-display)!important;font-size:22px!important}
.cb-diffs{display:flex;align-items:center;gap:4px;background:rgba(255,250,240,.92);border:2.5px solid var(--ink);border-radius:999px;padding:4px 5px 4px 12px}
.cb-dlabel{font-size:15px;margin-right:4px}
.cb-dbtn{padding:6px 13px 5px!important;border-radius:999px;font-family:var(--font-display)!important;font-size:17px!important;color:var(--ink)!important;background:transparent!important}
.cb-dbtn[aria-checked="true"]{color:var(--chalk)!important;box-shadow:0 2px 0 var(--ink)!important}
.cb-dbtn[data-diff="easy"][aria-checked="true"]{background:#2f9a4f!important}
.cb-dbtn[data-diff="normal"][aria-checked="true"]{background:#d8960c!important}
.cb-dbtn[data-diff="hard"][aria-checked="true"]{background:var(--stitch)!important}
.cb-speeds{position:absolute;z-index:6;left:calc(var(--gut-l) + 2px);bottom:calc(var(--sb) + 30px + var(--btn));width:var(--btn);display:flex;flex-direction:column;gap:6px}
.cb-sp{width:100%!important;height:34px!important;border-radius:12px;font-family:var(--font-display)!important;font-size:15px!important;color:var(--ink)!important;
  background:rgba(255,250,240,.94)!important;border:3px solid var(--ink)!important;box-shadow:0 3px 0 var(--ink)!important;opacity:.78;transition:transform .08s,opacity .15s}
.cb-sp[aria-checked="true"]{opacity:1;transform:scale(1.06);color:var(--chalk)!important}
.cb-sp.sp2[aria-checked="true"]{background:var(--stitch)!important}
.cb-sp.sp1[aria-checked="true"]{background:#d8960c!important}
.cb-sp.sp0[aria-checked="true"]{background:#2f78c9!important}
@media (orientation:portrait) and (max-height:760px){.cb-howto{display:none}}
.cb-howto{margin:0;font-size:14px;line-height:1.5;text-align:center;color:var(--chalk);background:rgba(21,48,75,.82);padding:7px 14px 6px;border-radius:12px}
.cb-howto b{color:var(--bulb);font-weight:400}
@media (orientation:landscape) and (max-height:560px){
  .cb-title{grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:auto 1fr;column-gap:18px;align-items:center}
  .cb-ttop{grid-column:2;grid-row:1;align-self:end}
  .cb-tbot{grid-column:2;grid-row:2;align-self:start;margin-top:10px;gap:8px}
  .cb-stage{grid-column:1;grid-row:1/3;height:100%}
  .cb-logo{font-size:clamp(54px,12vh,96px)}
  .cb-big{padding:9px 0 7px!important;font-size:24px!important}
  .cb-ghost{padding:7px 0 5px!important;font-size:17px!important}
  .cb-howto{font-size:13px}
}

.cb-overlay{position:absolute;inset:0;z-index:12;display:grid;place-items:center;background:rgba(10,30,50,.5);
  padding:calc(var(--st) + 16px) var(--gut-r) calc(var(--sb) + 16px) var(--gut-l);overflow:auto}
.cb-card{width:min(360px,100%);background:var(--chalk);border:4px solid var(--ink);border-radius:24px;box-shadow:0 8px 0 var(--ink);
  padding:20px 20px 22px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;animation:cb-cardIn .35s cubic-bezier(.2,1.4,.4,1)}
@keyframes cb-cardIn{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
.cb-ctitle{margin:0;font-family:var(--font-display);font-weight:400;font-size:36px;color:var(--ink)}
.cb-board{width:100%;background:var(--board);border:4px solid #0c2617;border-radius:16px;padding:8px 10px 10px}
.cb-blabel{color:#cfe8d6;font-size:15px;letter-spacing:.06em}
.cb-bnum{font-family:var(--font-display);font-size:68px;line-height:1;color:var(--bulb);text-shadow:0 0 14px rgba(255,216,74,.6);font-variant-numeric:tabular-nums}
.cb-vsboard{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;color:#cfe8d6}
.cb-vsboard .cb-bnum{font-size:52px}
.cb-vsname{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cb-vsmid{font-family:var(--font-display);font-size:22px;color:var(--chalk)}
.cb-newrec{margin:-4px 0 0;padding:4px 14px 3px;border-radius:999px;background:var(--bulb);border:3px solid var(--ink);font-family:var(--font-display);font-size:20px;
  animation:cb-rec .9s ease-in-out infinite alternate}
@keyframes cb-rec{from{transform:rotate(-3deg) scale(1)}to{transform:rotate(3deg) scale(1.08)}}
.cb-rank{margin:0;font-size:17px}
.cb-rank b{font-family:var(--font-display);font-weight:400;color:var(--stitch);font-size:22px;margin-left:4px}
.cb-stats{list-style:none;margin:0;padding:0;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cb-stats li{display:flex;justify-content:space-between;align-items:baseline;background:#f1e8d4;border-radius:10px;padding:7px 10px 6px;font-size:14px}
.cb-stats b{font-family:var(--font-display);font-weight:400;font-size:19px;font-variant-numeric:tabular-nums}
.cb-btns{display:flex;flex-direction:column;gap:10px;width:100%;margin-top:4px}

.cb-vs{position:absolute;inset:0;z-index:11;display:grid;place-items:center;background:rgba(10,30,50,.35);pointer-events:none}
.cb-vscard{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:0 16px}
.cb-vsline{display:flex;align-items:center;gap:14px;font-family:var(--font-display);font-size:clamp(22px,6.5vw,34px);color:var(--chalk);
  text-shadow:0 3px 0 var(--ink),2px 0 0 var(--ink),-2px 0 0 var(--ink),0 -2px 0 var(--ink)}
.cb-vsline em{font-style:normal;color:var(--bulb);font-size:1.3em}
.cb-vsline span{max-width:38vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cb-vscount{font-family:var(--font-display);font-size:clamp(72px,24vw,140px);line-height:1;color:var(--chalk);
  text-shadow:0 6px 0 var(--ink),4px 0 0 var(--ink),-4px 0 0 var(--ink),0 -4px 0 var(--ink)}
.cb-vsrule{background:rgba(21,48,75,.9);color:var(--chalk);border-radius:14px;padding:8px 14px 7px;font-size:clamp(13px,3.6vw,16px);max-width:min(420px,100%)}
@media (prefers-reduced-motion:reduce){
  .cb-banner.show,.cb-card,.cb-newrec,.cb-act.ready::after,.cb-plate-num.bump,.cb-life.pop,.cb-hint{animation-duration:.01s!important;animation-iteration-count:1!important}
}
`;

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Jua&display=swap';

const BALL_SVG = '<svg class="cb-life" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#15304b" stroke-width="2"/><path d="M6.5 5.5c2.4 3.6 2.4 9.4 0 13M17.5 5.5c-2.4 3.6-2.4 9.4 0 13" fill="none" stroke="#e23b2e" stroke-width="1.8" stroke-linecap="round"/></svg>';

const HTML = `
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
  </div>
  <div class="cb-right">
    <div class="cb-hbtns">
      <button class="cb-icon" data-cb="mute" type="button" aria-label="소리 끄기">
        <svg data-cb="icoSound" viewBox="0 0 24 24" fill="none" stroke="#15304b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#15304b"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>
        <svg data-cb="icoMute" viewBox="0 0 24 24" fill="none" stroke="#15304b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" hidden><path d="M4 9h4l5-4v14l-5-4H4z" fill="#15304b"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>
      </button>
      <button class="cb-icon" data-cb="pause" type="button" aria-label="일시정지">
        <svg viewBox="0 0 24 24" fill="#15304b"><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>
      </button>
    </div>
    <div class="cb-lives" data-cb="lives" aria-label="남은 공"></div>
  </div>
</div>
<div class="cb-hint" data-cb="hint" hidden></div>
<div class="cb-banner" data-cb="banner" hidden><div class="cb-bmain" data-cb="bmain"></div><div class="cb-bsub" data-cb="bsub"></div></div>
<div data-cb="controls" hidden>
  <div class="cb-speeds" data-cb="speeds" role="radiogroup" aria-label="공 빠르기" hidden>
    <button class="cb-sp sp2" type="button" role="radio" data-sp="2">빠른 볼</button>
    <button class="cb-sp sp1" type="button" role="radio" data-sp="1">중간 볼</button>
    <button class="cb-sp sp0" type="button" role="radio" data-sp="0">느린 볼</button>
  </div>
  <button class="cb-act cb-throw off" data-cb="throwBtn" type="button" aria-label="던지기">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M6 22h12M3 32h14M6 42h12" stroke="#15304b" stroke-width="4" stroke-linecap="round"/>
      <circle cx="40" cy="32" r="19" fill="#fff" stroke="#15304b" stroke-width="3.5"/>
      <path d="M28 18c5 8 5 20 0 28M52 18c-5 8-5 20 0 28" fill="none" stroke="#e23b2e" stroke-width="3" stroke-linecap="round" stroke-dasharray="3 3.2"/>
    </svg>
    <span>던지기</span>
  </button>
  <button class="cb-act cb-catch off" data-cb="catchBtn" type="button" aria-label="잡기">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M17 44C11 37 9 25 12 18c2-4 7-4 8 1l2 9 1-17c0-4 3-6 6-6s5 3 5 6l-1 15 4-13c1-4 5-5 8-3 3 1 3 5 2 8l-4 14 6-5c3-2 7-1 8 2 1 3-1 6-4 8L42 50c-5 5-10 7-15 6-4 0-8-4-10-12z" fill="#f6c08c" stroke="#15304b" stroke-width="3.2" stroke-linejoin="round"/>
      <ellipse cx="31" cy="40" rx="8" ry="7" fill="#c47a40"/>
      <path d="M21 30l-2-11M29 27l0-16M37 28l3-12" stroke="#c47a40" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <span>잡기</span>
  </button>
</div>
<section class="cb-title" data-cb="title" hidden>
  <header class="cb-ttop">
    <p class="cb-kicker">주말 공원 야구</p>
    <h1 class="cb-logo">캐치볼</h1>
    <svg class="cb-seam" viewBox="0 0 260 20" aria-hidden="true"><path d="M6 6q124 18 248 0" fill="none" stroke="#e23b2e" stroke-width="4" stroke-linecap="round" stroke-dasharray="7 7"/></svg>
    <p class="cb-tag">날아오는 공을 잡고, 친구에게 다시 던져요!</p>
  </header>
  <div class="cb-stage" data-cb="stage"></div>
  <footer class="cb-tbot">
    <div class="cb-row">
      <div class="cb-bestpill"><span data-cb="bestDiff">보통</span> 최고 <b data-cb="bestTitle">0</b>개</div>
      <div class="cb-bestpill" data-cb="duelRec" hidden>1:1 대결 <b data-cb="duelWins">0</b>승 <b data-cb="duelLosses">0</b>패</div>
      <div class="cb-uni">
        <span>유니폼</span>
        <div class="cb-sws" role="radiogroup" aria-label="유니폼 색">
          <button class="cb-sw" type="button" role="radio" data-team="red" aria-label="빨강" style="--c:#e23b2e"></button>
          <button class="cb-sw" type="button" role="radio" data-team="blue" aria-label="파랑" style="--c:#2f6fe0"></button>
          <button class="cb-sw" type="button" role="radio" data-team="yellow" aria-label="노랑" style="--c:#f5c22b"></button>
          <button class="cb-sw" type="button" role="radio" data-team="purple" aria-label="보라" style="--c:#8b5cf0"></button>
        </div>
      </div>
    </div>
    <div class="cb-diffs" role="radiogroup" aria-label="난이도" data-cb="diffs">
      <span class="cb-dlabel">난이도</span>
      <button class="cb-dbtn" type="button" role="radio" data-diff="easy">쉬움</button>
      <button class="cb-dbtn" type="button" role="radio" data-diff="normal">보통</button>
      <button class="cb-dbtn" type="button" role="radio" data-diff="hard">어려움</button>
    </div>
    <button class="cb-big" data-cb="start" type="button">혼자 하기</button>
    <button class="cb-ghost cb-duelbtn" data-cb="duelBtn" type="button" hidden>친구랑 1:1 대결</button>
    <button class="cb-ghost" data-cb="exitTitle" type="button">나가기</button>
    <p class="cb-howto" data-cb="howto">화면을 <b>끌면</b> 글러브가 움직여요 · 공이 오면 <b>잡기</b> · 잡았으면 <b>던지기</b></p>
  </footer>
</section>
<section class="cb-vs" data-cb="vs" hidden>
  <div class="cb-vscard">
    <div class="cb-vsline"><span data-cb="vsMe">나</span><em>VS</em><span data-cb="vsOpp">상대</span></div>
    <div class="cb-vscount" data-cb="vsCount">3</div>
    <div class="cb-vsrule" data-cb="vsRule">공 3개씩 · 놓치면 하나 잃어요 · 손 닿지 않게 던지면 던진 사람이 잃어요</div>
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
      <li><span>PERFECT</span><b data-cb="overPerfect">0</b></li>
      <li><span>최대 연속</span><b data-cb="overCombo">0</b></li>
      <li><span>나이스 볼</span><b data-cb="overNice">0</b></li>
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
<div data-cb="probe" aria-hidden="true" style="position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;width:var(--btn);height:1px;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);box-sizing:content-box"></div>
`;

/* ======================================================================
   모듈 경계
   ====================================================================== */
let inst = null;

/**
 * @param {HTMLElement} host
 * @param {object} opts
 * @param {'solo'|'duel'} [opts.mode]
 * @param {string} [opts.team]            유니폼 색 (red|blue|yellow|purple)
 * @param {number} [opts.best]            지금까지 최고 기록
 * @param {(n:number)=>void} [opts.onBest]      혼자 하기 신기록
 * @param {(score:number)=>void} [opts.onFinish] 혼자 하기 한 판 끝 (기록은 화면이 저장한다)
 * @param {()=>void} [opts.onDuel]          타이틀의 [친구랑 1:1 대결] — 없으면 버튼을 감춘다
 * @param {{wins:number, losses:number}} [opts.duelRecord]  타이틀에 띄울 대결 전적
 * @param {(team:string)=>void} [opts.onTeam]   유니폼을 바꿨다
 * @param {(kind:string)=>void} [opts.onExit]   'leave' | 'rematch' | 'forfeit'
 * @param {'easy'|'normal'|'hard'} [opts.difficulty]  혼자 하기 난이도 (대결은 duel.difficulty = 방 난이도)
 * @param {{easy:number, normal:number, hard:number}} [opts.bests]  난이도별 최고 기록
 * @param {(d:string)=>void} [opts.onDifficulty]  타이틀에서 난이도를 바꿨다
 * @param {object} [opts.duel]  { gid, iStart, myName, oppName, difficulty, startInMs, send(fields), onEnd(r) }
 */
export function mount(host, opts = {}) {
  unmount();
  inst = createGame(host, opts);
}
export function unmount() {
  if (inst) { inst.destroy(); inst = null; }
}
/** ESC · 안드로이드 뒤로가기 — 곧바로 나가지 않고 멈춘다(대결은 기권을 묻는다) */
export function requestPause() { inst?.requestPause(); }
/** 대결 상대의 참가자 칸 (없어졌으면 null) */
export function setRemote(node) { inst?.remote(node); }
/** 검사 도구 전용 (tools/_catch-*.html) — 게임 상태를 들여다본다 */
export function _debug() { return inst?.dbg; }

/* ======================================================================
   게임 본체
   ====================================================================== */
function createGame(host, opts) {
  const DUEL = opts.mode === 'duel' && opts.duel ? opts.duel : null;

  /* ---------- DOM ---------- */
  if (!document.getElementById('cb-style')) {
    const st = document.createElement('style');
    st.id = 'cb-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  if (!document.getElementById('cb-font')) {
    const ln = document.createElement('link');
    ln.id = 'cb-font'; ln.rel = 'stylesheet'; ln.href = FONT_HREF;
    document.head.appendChild(ln);
  }
  const root = document.createElement('div');
  root.className = 'cb-root' + (DUEL ? ' cb-duel' : '');
  root.innerHTML = HTML;
  host.appendChild(root);
  const $ = (k) => root.querySelector(`[data-cb="${k}"]`);
  const cvs = root.querySelector('.cb-canvas');
  const ctx = cvs.getContext('2d');
  const hudEl = root.querySelector('.cb-hud');

  /* 나중에 한꺼번에 떼어 낸다 */
  const offs = [];
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  let dead = false;

  /* ---------- 도구 ---------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const lp = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  const TAU = Math.PI * 2;

  const local = {
    get(k, d) { try { const v = localStorage.getItem('catchball.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('catchball.' + k, JSON.stringify(v)); } catch (e) { /* 저장 불가 */ } },
  };

  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 색 · 상수 ---------- */
  const TEAMS = {
    red:    { jersey: '#e23b2e', dark: '#a3241b', cap: '#c9291f', num: '#fffaf0', partner: 'blue' },
    blue:   { jersey: '#2f6fe0', dark: '#1d4697', cap: '#2456bb', num: '#fffaf0', partner: 'red' },
    yellow: { jersey: '#f5c22b', dark: '#b8860c', cap: '#e3a713', num: '#15304b', partner: 'purple' },
    purple: { jersey: '#8b5cf0', dark: '#5a34b2', cap: '#7243d6', num: '#fffaf0', partner: 'yellow' },
  };
  const OUT = '#2a2238';
  const SKIN = '#ffd3ae', SKIN_D = '#e9a77c';
  const HAIR_P = '#3a281d', HAIR_M = '#6b3d22';
  const PANTS = '#f7f3ea';
  const GLOVE = '#b5652b', GLOVE_D = '#7a3f17', GLOVE_L = '#e0995a';
  const LEVELS = ['동네 캐치볼', '리틀 야구', '중학 야구부', '고교 에이스', '대학 야구', '프로 2군', '프로 1군', '국가대표', '메이저리그', '야구의 전설'];

  const PARTNER_Z = 11;
  const GLOVE_Z = 0.35;
  const BALL_R = 0.075;
  let EARLY = 0.24;          // 난이도가 넓히고 좁힌다 (applyDiff)
  const LATE = 0.075;
  /* 대결: 이 밖으로 던지면 악송구 (받는 사람 글러브가 닿는 곳 + 여유) */
  const REACH_X = 1.82, REACH_YMAX = 2.62, REACH_YMIN = -0.02;
  const reachable = (x, y) => Math.abs(x) <= REACH_X && y <= REACH_YMAX && y >= REACH_YMIN;
  /* 대결: 공을 쥐고 이만큼 버티면 저절로 던진다 */
  const HOLD_LIMIT = 12;

  /**
   * ★ **난이도** (2026-10-28, 사용자 지정 — 쉬움 · 보통 · 어려움)
   *   T      공 비행시간 배율 (작을수록 빠르다)       R      글러브가 잡아 주는 반경 배율
   *   early  '미리 눌러도 잡히는' 시간 배율             sway   던질 때 과녁이 흔들리는 정도
   *   spread 공이 오는 자리의 폭                        typeGap 새 공(뜬공·땅볼·커브·너클)이 나오는 점수 간격
   *   minT   가장 빠른 공의 비행시간 하한 (초)
   * 대결에서는 방장이 대기방에서 고른 방 난이도를 두 사람이 똑같이 쓴다.
   */
  const DIFFS = {
    easy:   { label: '쉬움',   T: 1.25, R: 1.22, early: 1.3,  sway: 0.6,  spread: 0.75, typeGap: 1.6, minT: 0.6 },
    normal: { label: '보통',   T: 1.0,  R: 1.0,  early: 1.0,  sway: 1.0,  spread: 1.0,  typeGap: 1.0, minT: 0.48 },
    hard:   { label: '어려움', T: 0.82, R: 0.84, early: 0.78, sway: 1.35, spread: 1.15, typeGap: 0.6, minT: 0.4 },
  };
  /**
   * ★ **공 빠르기 — 던지는 사람이 고른다.** (2026-10-28, 사용자 지정)
   * 빠른 볼은 잡기 어렵지만 과녁이 더 흔들려 악송구가 나기 쉽고, 느린 볼은 정확하지만 잡기 쉽다.
   * 대결에서는 내가 고르고, 혼자 할 때 날아오는 공은 친구(컴퓨터)가 난이도에 맞춰 섞어 던진다.
   * 순서가 곧 번호다: 0 느린 볼 · 1 중간 볼 · 2 빠른 볼 (대결 th 의 공종류 칸에 (번호+1)×10 으로 싣는다)
   */
  const SPEEDS = [
    { label: '느린 볼', T: 1.35, sway: 0.5, add: 0, calls: ['느린 볼~', '살살 간다~'] },
    { label: '중간 볼', T: 1.0, sway: 1.0, add: 0, calls: ['간다~!', '받아!'] },
    { label: '빠른 볼', T: 0.62, sway: 1.6, add: 0.18, calls: ['빠른 볼!!', '세게 간다!'] },
  ];
  const TYPE_NAME = { lob: '뜬공', grounder: '땅볼', curve: '커브', fast: '강속구', knuckle: '너클볼' };
  function callFor(type, speed) {
    if (speed == null || speed === 1) return pick(CALLS[type]);
    if (type === 'normal') return pick(SPEEDS[speed].calls);
    return (speed === 2 ? '빠른 ' : '느린 ') + TYPE_NAME[type] + (speed === 2 ? '!' : '~');
  }

  const CALLS = {
    normal: ['간다~!', '받아!', '잡아봐!', '자, 간다!'],
    lob: ['높이 간다!', '하늘 높이~!'],
    grounder: ['땅볼이다!', '낮게 간다!'],
    curve: ['커브!', '휘어진다~!'],
    fast: ['강속구!!', '빠르다!'],
    knuckle: ['흔들흔들~', '너클볼!'],
  };
  const TYPE_HINT = {
    lob: '높이 뜬 공! 글러브를 위로 올려요',
    grounder: '땅볼! 한 번 튀어요. 글러브를 낮게!',
    curve: '커브! 공이 옆으로 휘어요',
    fast: '강속구! 엄청 빨라요',
    knuckle: '너클볼! 공이 흔들흔들 날아와요',
  };
  const TYPES = ['normal', 'lob', 'grounder', 'curve', 'fast', 'knuckle'];

  /* ---------- 소리 ---------- */
  const Snd = {
    ac: null, out: null, nbuf: null, muted: !!local.get('muted', false),
    init() {
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this.ac = new AC(); } catch (e) { return; }
        this.out = this.ac.createGain();
        this.out.gain.value = 0.55;
        this.out.connect(this.ac.destination);
        const len = Math.floor(this.ac.sampleRate * 0.5);
        this.nbuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
        const d = this.nbuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
    },
    ok() { return this.ac && !this.muted && this.ac.state === 'running'; },
    tone(f, dur, type = 'sine', vol = 0.3, f2 = null, delay = 0) {
      if (!this.ok()) return;
      const t = this.ac.currentTime + delay;
      const o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.out);
      o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, f, q, vol, f2 = null, delay = 0) {
      if (!this.ok()) return;
      const t = this.ac.currentTime + delay;
      const s = this.ac.createBufferSource();
      s.buffer = this.nbuf;
      const bp = this.ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(f, t);
      if (f2) bp.frequency.exponentialRampToValueAtTime(f2, t + dur);
      bp.Q.value = q;
      const g = this.ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(bp); bp.connect(g); g.connect(this.out);
      s.start(t); s.stop(t + dur + 0.03);
    },
    pop(big) {
      this.noise(0.07, 1500, 1.1, big ? 1 : 0.8);
      this.tone(150, 0.12, 'sine', 0.9, 55);
      if (big) { this.tone(1318, 0.14, 'triangle', 0.22, null, 0.03); this.tone(1976, 0.22, 'triangle', 0.18, null, 0.1); }
    },
    softPop() { this.noise(0.05, 1300, 1.2, 0.32); this.tone(130, 0.08, 'sine', 0.32, 60); },
    whoosh(hi) { this.noise(0.32, hi ? 700 : 450, 1.4, 0.32, hi ? 2600 : 1800); },
    swish() { this.noise(0.08, 2400, 2, 0.1); },
    thud() { this.tone(95, 0.1, 'sine', 0.45, 45); this.noise(0.04, 420, 1, 0.18); },
    ting() { this.tone(1700, 0.13, 'triangle', 0.25, 1250); },
    miss() { this.tone(392, 0.16, 'triangle', 0.28, 330); this.tone(311, 0.28, 'triangle', 0.28, 220, 0.16); },
    click() { this.tone(880, 0.04, 'square', 0.07); },
    beep(hi) { this.tone(hi ? 1046 : 659, hi ? 0.3 : 0.12, 'triangle', 0.22); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.24, null, i * 0.1)); this.tone(1047, 0.45, 'triangle', 0.2, null, 0.42); },
    over() { [523, 440, 392, 330].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.22, null, i * 0.15)); },
  };

  /* ---------- 카메라 · 원근 ---------- */
  const cam = { x: 0, y: 4.2, z: -6.3, pitch: 0.4 };
  let cosP = 1, sinP = 0;
  let W = 0, H = 0, DPR = 1, F = 500, CX = 0, CY = 0, portrait = true, APEX_MAX = 6;
  const SAFE = { t: 0, r: 0, b: 0, l: 0 };

  function proj(x, y, z) {
    const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    const depth = dz * cosP - dy * sinP;
    const up = dy * cosP + dz * sinP;
    const s = F / depth;
    return { x: CX + dx * s, y: CY - up * s, s, depth };
  }
  function upRatio(y, z) {
    const dy = y - cam.y, dz = z - cam.z;
    return (dy * cosP + dz * sinP) / (dz * cosP - dy * sinP);
  }
  function depthOf(y, z) { return (z - cam.z) * cosP - (y - cam.y) * sinP; }
  function unproject(sx, sy, z0) {
    const px = (sx - CX) / F, py = (CY - sy) / F;
    const dX = px, dY = py * cosP - sinP, dZ = py * sinP + cosP;
    const t = (z0 - cam.z) / dZ;
    return { x: cam.x + dX * t, y: cam.y + dY * t };
  }
  const horizonY = () => CY - F * sinP / cosP;

  const probe = $('probe');
  function readSafe() {
    const cs = getComputedStyle(probe);
    SAFE.t = parseFloat(cs.paddingTop) || 0;
    SAFE.r = parseFloat(cs.paddingRight) || 0;
    SAFE.b = parseFloat(cs.paddingBottom) || 0;
    SAFE.l = parseFloat(cs.paddingLeft) || 0;
  }

  function layout() {
    const r = root.getBoundingClientRect();
    W = Math.max(1, r.width || window.innerWidth); H = Math.max(1, r.height || window.innerHeight);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
    readSafe();
    const btn = probe.offsetWidth || 110;
    portrait = H >= W * 0.95;
    if (portrait) { cam.y = 4.2; cam.z = -6.3; cam.pitch = 0.4; }
    else { cam.y = 2.6; cam.z = -6.6; cam.pitch = 0.05; }
    cosP = Math.cos(cam.pitch); sinP = Math.sin(cam.pitch);
    const topY = SAFE.t + (portrait ? (DUEL ? 128 : 100) : 80);
    let feetY, side;
    if (portrait) { feetY = H - SAFE.b - btn - 24; side = 6; }
    else { feetY = H - SAFE.b - 10; side = Math.max(SAFE.l, SAFE.r) + btn + 24; }
    const dG = depthOf(1.1, GLOVE_Z);
    const Fw = (W / 2 - side) * dG / 2.05;
    const a = upRatio(0, 0), b = upRatio(2.42, GLOVE_Z);
    const Fv = (feetY - topY) / (b - a);
    F = Math.max(120, Math.min(Fw, portrait ? Fv : Fv * 0.86));
    CX = W / 2;
    CY = feetY + a * F;
    APEX_MAX = Math.max(2.6, unproject(CX, SAFE.t + 70, 5.5).y - 0.25);
    buildLayers();
    titleRect = null;
  }

  /* ---------- 고정 배경 ---------- */
  let skyL = null, groundL = null, cloudSpr = null;
  function mkLayer() {
    const c = document.createElement('canvas');
    c.width = cvs.width; c.height = cvs.height;
    const x = c.getContext('2d');
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    return [c, x];
  }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.0001, r), 0, TAU); }
  function rr(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function fillStroke(c, fill, lw) {
    c.fillStyle = fill; c.fill();
    if (lw) { c.lineWidth = lw; c.strokeStyle = OUT; c.stroke(); }
  }
  function buildCloud() {
    const c = document.createElement('canvas');
    c.width = 360; c.height = 160;
    const x = c.getContext('2d');
    const puffs = [[70, 105, 46], [125, 78, 60], [195, 70, 66], [255, 92, 50], [300, 112, 36], [160, 112, 50], [230, 118, 44]];
    x.fillStyle = 'rgba(150,190,220,.45)';
    for (const [px, py, r] of puffs) { x.beginPath(); x.arc(px + 4, py + 10, r, 0, TAU); x.fill(); }
    x.fillStyle = '#ffffff';
    for (const [px, py, r] of puffs) { x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); }
    x.fillStyle = 'rgba(214,235,250,.9)';
    x.beginPath(); x.ellipse(185, 140, 135, 14, 0, 0, TAU); x.fill();
    cloudSpr = c;
  }
  function buildLayers() {
    const hz = horizonY();
    const [sc, s] = mkLayer();
    const g = s.createLinearGradient(0, 0, 0, Math.max(40, hz));
    g.addColorStop(0, '#2a8fe3'); g.addColorStop(0.6, '#5fbdf5'); g.addColorStop(1, '#c6f0ff');
    s.fillStyle = g; s.fillRect(0, 0, W, H);
    const sr = clamp(Math.min(W, H) * 0.065, 24, 60);
    const sx = W * 0.8, sy = clamp(hz * 0.3, sr + SAFE.t + 70, Math.max(sr + SAFE.t + 70, hz - sr * 2));
    const sg = s.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 3.4);
    sg.addColorStop(0, 'rgba(255,246,190,.85)'); sg.addColorStop(1, 'rgba(255,246,190,0)');
    s.fillStyle = sg; circ(s, sx, sy, sr * 3.4); s.fill();
    s.fillStyle = '#fff7c9'; circ(s, sx, sy, sr); s.fill();
    skyL = sc;

    const [gc, c] = mkLayer();
    const rnd = seeded(7);
    hills(c, 190, 24, '#a3d6c6', 0.021, 1.3);
    hills(c, 120, 13, '#82c5a3', 0.037, 4.1);
    for (const tx of [-17, 17]) tower(c, tx, 57);
    const trees = [];
    for (let x = -95; x <= 95; x += 2.5) trees.push({ x: x + rnd() * 1.2, z: 59 + rnd() * 3, h: 4.4 + rnd() * 2.4, r: 2.2 + rnd() * 1.2 });
    for (const t of trees) { const p = proj(t.x, t.h, t.z); c.fillStyle = '#2b8148'; circ(c, p.x, p.y, t.r * p.s); c.fill(); }
    for (const t of trees) { const p = proj(t.x - 0.5, t.h + 0.6, t.z); c.fillStyle = '#3d9c58'; circ(c, p.x, p.y, t.r * 0.62 * p.s); c.fill(); }
    const ft = proj(0, 2.6, 46), fb = proj(0, 0, 46);
    c.fillStyle = '#1e6a44'; c.fillRect(0, ft.y, W, fb.y - ft.y + 1);
    c.fillStyle = '#ffd84a'; c.fillRect(0, ft.y, W, Math.max(2, 0.17 * fb.s));
    c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1;
    for (let x = -100; x <= 100; x += 5) { const p = proj(x, 0, 46); c.beginPath(); c.moveTo(p.x + 0.5, ft.y + 0.17 * fb.s); c.lineTo(p.x + 0.5, fb.y); c.stroke(); }
    const sp = proj(0, 1.2, 46);
    c.font = `${Math.max(10, 1.2 * sp.s)}px "Black Han Sans","Jua",sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fffaf0';
    c.fillText('122m', sp.x, sp.y);
    const gg = c.createLinearGradient(0, fb.y, 0, H);
    gg.addColorStop(0, '#83c962'); gg.addColorStop(1, '#3e9b3a');
    c.fillStyle = gg; c.fillRect(0, fb.y, W, H - fb.y);
    const wt = proj(0, 0, 43.2);
    c.fillStyle = '#c98e5c'; c.fillRect(0, fb.y, W, wt.y - fb.y);
    const zNear = cam.z + 0.9;
    let k = 0;
    for (let z = 43.2; z > zNear; z -= 3, k++) {
      if (k % 2) continue;
      const y0 = proj(0, 0, z).y, y1 = proj(0, 0, Math.max(zNear, z - 3)).y;
      c.fillStyle = 'rgba(255,255,255,.075)'; c.fillRect(0, y0, W, y1 - y0);
    }
    for (let i = -18; i < 18; i += 2) {
      const x0 = i * 3, x1 = x0 + 3;
      const a = proj(x0, 0, 43.2), b = proj(x1, 0, 43.2), cc = proj(x1, 0, zNear), d = proj(x0, 0, zNear);
      c.fillStyle = 'rgba(20,80,20,.075)';
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(cc.x, cc.y); c.lineTo(d.x, d.y); c.closePath(); c.fill();
    }
    c.lineCap = 'round';
    for (let i = 0; i < 110; i++) {
      const x = (rnd() * 2 - 1) * 8, z = -2.5 + rnd() * 28;
      const p = proj(x, 0, z); const l = 0.09 * p.s;
      c.strokeStyle = 'rgba(38,112,40,.55)'; c.lineWidth = Math.max(1, 0.018 * p.s);
      c.beginPath(); c.moveTo(p.x - l * 0.55, p.y - l); c.lineTo(p.x, p.y); c.lineTo(p.x + l * 0.55, p.y - l); c.moveTo(p.x, p.y); c.lineTo(p.x + l * 0.05, p.y - l * 1.25); c.stroke();
    }
    for (let i = 0; i < 26; i++) {
      const x = (rnd() * 2 - 1) * 9, z = 1 + rnd() * 30;
      const p = proj(x, 0, z);
      c.fillStyle = rnd() < 0.5 ? '#fff6d8' : '#ffe066';
      circ(c, p.x, p.y, Math.max(1, 0.035 * p.s)); c.fill();
    }
    groundL = gc;
  }
  function hills(c, z, hBase, col, freq, ph) {
    const base = proj(0, 0, z); const s = base.s;
    c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
    for (let sx = 0; sx <= W + 8; sx += 8) {
      const x = (sx - CX) / s;
      const h = hBase + Math.sin(x * freq + ph) * hBase * 0.35 + Math.sin(x * freq * 2.3 + ph * 2) * hBase * 0.18;
      c.lineTo(sx, proj(x, h, z).y);
    }
    c.lineTo(W, H); c.closePath(); c.fill();
  }
  function tower(c, x, z) {
    const b = proj(x, 0, z), t = proj(x, 23, z), s = b.s;
    c.fillStyle = '#b7c4cf'; c.fillRect(b.x - 0.35 * s, t.y, 0.7 * s, b.y - t.y);
    const pw = 5.4 * s, ph = 3.3 * s, px = t.x - pw / 2, py = t.y - ph;
    c.fillStyle = '#7b8a98'; c.fillRect(px, py, pw, ph);
    c.fillStyle = '#f2f8ff';
    for (let r = 0; r < 3; r++) for (let q = 0; q < 5; q++) { circ(c, px + (q + 0.5) * pw / 5, py + (r + 0.5) * ph / 3, Math.min(pw / 5, ph / 3) * 0.32); c.fill(); }
  }

  /* ---------- 그리기 : 공 · 글러브 · 사람 ---------- */
  function drawBall(c, x, y, r, rot) {
    c.save(); c.translate(x, y);
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.65, '#f4efe4'); g.addColorStop(1, '#cdbfa6');
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = g; c.fill();
    c.lineWidth = r * 0.12; c.strokeStyle = 'rgba(42,34,56,.6)'; c.stroke();
    c.rotate(rot);
    c.beginPath(); c.arc(0, 0, r * 0.97, 0, TAU); c.clip();
    c.strokeStyle = '#e23b2e'; c.lineWidth = r * 0.14; c.lineCap = 'round';
    c.beginPath(); c.arc(-r * 1.32, 0, r * 0.92, -0.85, 0.85); c.stroke();
    c.beginPath(); c.arc(r * 1.32, 0, r * 0.92, Math.PI - 0.85, Math.PI + 0.85); c.stroke();
    c.restore();
  }
  function leather(c) {
    const g = c.createLinearGradient(-0.45, -0.6, 0.45, 0.55);
    g.addColorStop(0, GLOVE_L); g.addColorStop(0.5, GLOVE); g.addColorStop(1, GLOVE_D);
    return g;
  }
  function drawGloveBack(c, x, y, u, cl, ball, rot, ow) {
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(u, u);
    const o = ow / u, L = leather(c);
    if (ball) drawBall(c, 0.3, -0.36, BALL_R / u, 0.5);
    const F4 = [[-0.33, 0.4, -0.24], [-0.12, 0.5, -0.09], [0.08, 0.53, 0.03], [0.27, 0.47, 0.14]];
    for (const [bx, len, ang] of F4) {
      c.save(); c.translate(bx, 0.02); c.rotate(ang + cl * 0.5);
      const l = len * (1 - cl * 0.32);
      rr(c, -0.105, -l, 0.21, l + 0.12, 0.105); fillStroke(c, L, o);
      c.strokeStyle = GLOVE_L; c.lineWidth = 0.028; c.beginPath(); c.moveTo(-0.045, -l + 0.075); c.lineTo(0.045, -l + 0.075); c.stroke();
      c.restore();
    }
    if (cl < 0.7 && !ball) {
      c.strokeStyle = GLOVE_D; c.lineWidth = 0.05;
      c.beginPath(); c.moveTo(0.36, -0.36); c.lineTo(0.55, -0.12); c.moveTo(0.3, -0.2); c.lineTo(0.5, 0); c.stroke();
    }
    c.save(); c.translate(0.33, 0.28); c.rotate(0.62 - cl * 0.55);
    rr(c, -0.11, -0.47, 0.22, 0.53, 0.11); fillStroke(c, L, o); c.restore();
    c.beginPath(); c.moveTo(-0.44, -0.03); c.quadraticCurveTo(-0.47, 0.38, -0.2, 0.5); c.lineTo(0.24, 0.5); c.quadraticCurveTo(0.45, 0.4, 0.43, 0.0); c.closePath();
    fillStroke(c, L, o);
    rr(c, -0.37, 0.16, 0.64, 0.13, 0.065); c.fillStyle = GLOVE_D; c.fill();
    c.beginPath(); c.ellipse(-0.05, 0.225, 0.09, 0.046, 0, 0, TAU); c.fillStyle = '#f3d9b5'; c.fill();
    c.beginPath(); c.ellipse(0, 0.47, 0.22, 0.06, 0, 0, TAU); c.fillStyle = '#3a1d0c'; c.fill();
    c.restore();
  }
  function drawGloveFront(c, x, y, u, cl, ball, rot, ow) {
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(u, u);
    const o = ow / u, L = leather(c);
    if (cl < 0.8) {
      c.beginPath(); c.moveTo(-0.5, -0.14); c.lineTo(-0.37, -0.44); c.lineTo(-0.19, -0.36); c.lineTo(-0.19, 0.02); c.closePath();
      fillStroke(c, GLOVE_D, o);
      c.strokeStyle = GLOVE_L; c.lineWidth = 0.028;
      c.beginPath(); c.moveTo(-0.44, -0.28); c.lineTo(-0.22, -0.2); c.moveTo(-0.46, -0.1); c.lineTo(-0.22, -0.02); c.moveTo(-0.34, -0.4); c.lineTo(-0.3, -0.02); c.stroke();
    }
    c.save(); c.translate(-0.31, 0.27); c.rotate(-0.62 + cl * 0.55);
    rr(c, -0.11, -0.5, 0.22, 0.56, 0.11); fillStroke(c, L, o); c.restore();
    c.beginPath(); c.ellipse(0.03, 0.14, 0.42, 0.38, 0, 0, TAU); fillStroke(c, L, o);
    const pg = c.createRadialGradient(0, 0.06, 0.02, 0, 0.08, 0.27);
    pg.addColorStop(0, '#6a3412'); pg.addColorStop(1, '#a65c27');
    c.beginPath(); c.ellipse(0, 0.08, 0.25, 0.23, 0, 0, TAU); c.fillStyle = pg; c.fill();
    if (ball) drawBall(c, 0, 0.04, BALL_R / u, 0.6);
    const F4 = [[-0.17, 0.5, -0.1], [0.03, 0.55, 0], [0.21, 0.5, 0.11], [0.36, 0.41, 0.24]];
    for (const [bx, len, ang] of F4) {
      c.save(); c.translate(bx, -0.05); c.rotate(ang - cl * 0.5);
      const l = len * (1 - cl * 0.45);
      rr(c, -0.1, -l, 0.2, l + 0.12, 0.1); fillStroke(c, L, o);
      c.strokeStyle = GLOVE_L; c.lineWidth = 0.028; c.beginPath(); c.moveTo(-0.045, -l + 0.075); c.lineTo(0.045, -l + 0.075); c.stroke();
      c.restore();
    }
    rr(c, -0.27, 0.42, 0.58, 0.12, 0.05); fillStroke(c, GLOVE_D, o);
    c.restore();
  }
  function joint(ax, ay, bx, by, L, prefX, prefY, stretch) {
    let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1e-4;
    const max = 2 * L * 0.999;
    if (d >= max) {
      if (!stretch) { bx = ax + dx / d * max; by = ay + dy / d * max; }
      return { jx: (ax + bx) / 2, jy: (ay + by) / 2, ex: bx, ey: by };
    }
    const h = Math.sqrt(L * L - (d / 2) * (d / 2));
    let px = -dy / d, py = dx / d;
    if (px * prefX + py * prefY < 0) { px = -px; py = -py; }
    return { jx: ax + dx / 2 + px * h, jy: ay + dy / 2 + py * h, ex: bx, ey: by };
  }
  function drawArm(c, sx, sy, hx, hy, prefX, prefY, sleeve, ow, stretch) {
    const k = joint(sx, sy, hx, hy, 0.235, prefX, prefY, stretch);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = OUT; c.lineWidth = 0.11 + ow * 2;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(k.jx, k.jy); c.lineTo(k.ex, k.ey); c.stroke();
    c.strokeStyle = SKIN; c.lineWidth = 0.095;
    c.beginPath(); c.moveTo(k.jx, k.jy); c.lineTo(k.ex, k.ey); c.stroke();
    c.strokeStyle = sleeve; c.lineWidth = 0.115;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(lerp(sx, k.jx, 0.78), lerp(sy, k.jy, 0.78)); c.stroke();
    circ(c, k.ex, k.ey, 0.058); fillStroke(c, SKIN, ow);
    return k;
  }
  function drawLeg(c, hx, hy, fx, fy, side, T, ow) {
    const k = joint(hx, hy, fx, fy, 0.27, side, -0.2, false);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = OUT; c.lineWidth = 0.15 + ow * 2;
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(k.jx, k.jy); c.lineTo(k.ex, k.ey); c.stroke();
    const mx = lerp(k.jx, k.ex, 0.45), my = lerp(k.jy, k.ey, 0.45);
    c.strokeStyle = PANTS; c.lineWidth = 0.15;
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(k.jx, k.jy); c.lineTo(mx, my); c.stroke();
    c.strokeStyle = T.dark; c.lineWidth = 0.12;
    c.beginPath(); c.moveTo(mx, my); c.lineTo(k.ex, k.ey); c.stroke();
    c.beginPath(); c.ellipse(k.ex + side * 0.015, k.ey + 0.03, 0.09, 0.05, 0, 0, TAU); fillStroke(c, '#20263a', ow);
  }
  function basePose() {
    return { fL: { x: -0.11, y: 0 }, fR: { x: 0.11, y: 0 }, rh: { x: -0.27, y: 0.58 }, gh: { x: 0.2, y: 0.7 },
      gloveClosed: 0, gloveRot: 0, rot: 0, lift: 0, crouch: 0, offX: 0, face: 'smile', ballHand: false, ballGlove: false };
  }
  function drawFace(c, hy, face, blink) {
    const ey = hy + 0.075;
    for (const sx of [-1, 1]) {
      const ex = sx * 0.09;
      if (face === 'grin') {
        c.strokeStyle = '#2a1d1a'; c.lineWidth = 0.024; c.lineCap = 'round';
        c.beginPath(); c.arc(ex, ey + 0.015, 0.036, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
      } else if (blink) {
        c.strokeStyle = '#2a1d1a'; c.lineWidth = 0.022; c.lineCap = 'round';
        c.beginPath(); c.moveTo(ex - 0.03, ey); c.lineTo(ex + 0.03, ey); c.stroke();
      } else {
        c.fillStyle = '#2a1d1a';
        c.beginPath(); c.ellipse(ex, ey, 0.034, face === 'oops' ? 0.028 : 0.048, 0, 0, TAU); c.fill();
        c.fillStyle = '#ffffff'; circ(c, ex + 0.011, ey - 0.017, 0.012); c.fill();
      }
    }
    c.fillStyle = 'rgba(255,110,110,.42)';
    circ(c, -0.16, hy + 0.135, 0.042); c.fill(); circ(c, 0.16, hy + 0.135, 0.042); c.fill();
    c.strokeStyle = '#7a2a22'; c.fillStyle = '#7a2a22'; c.lineWidth = 0.02; c.lineCap = 'round';
    if (face === 'o' || face === 'oops') { c.beginPath(); c.ellipse(0, hy + 0.158, 0.03, 0.035, 0, 0, TAU); c.fill(); }
    else if (face === 'grin') { c.beginPath(); c.arc(0, hy + 0.128, 0.058, 0.12, Math.PI - 0.12); c.closePath(); c.fill(); }
    else if (face === 'focus') { c.beginPath(); c.moveTo(-0.035, hy + 0.158); c.lineTo(0.035, hy + 0.158); c.stroke(); }
    else { c.beginPath(); c.arc(0, hy + 0.12, 0.048, 0.25, Math.PI - 0.25); c.stroke(); }
  }
  function drawKidFront(c, fx, fy, S, teamKey, p, t, hair, big) {
    const T = TEAMS[teamKey], ow = Math.max(1, S * 0.018) / S;
    c.save(); c.translate(fx, fy); c.scale(S, S);
    c.fillStyle = 'rgba(16,48,20,.26)';
    c.beginPath(); c.ellipse(p.offX, 0, 0.34 * (1 - Math.min(0.5, p.lift * 0.6)), 0.075, 0, 0, TAU); c.fill();
    c.translate(p.offX, -p.lift);
    if (p.rot) { c.translate(0, -0.45); c.rotate(p.rot); c.translate(0, 0.45); }
    const cr = p.crouch;
    const hipY = -(0.56 - cr * 0.17), shY = hipY - 0.4, hy = shY - 0.215;
    drawLeg(c, -0.085, hipY, p.fL.x, -p.fL.y - 0.035, -1, T, ow);
    drawLeg(c, 0.085, hipY, p.fR.x, -p.fR.y - 0.035, 1, T, ow);
    rr(c, -0.185, hipY - 0.07, 0.37, 0.15, 0.06); fillStroke(c, PANTS, ow);
    rr(c, -0.205, shY, 0.41, hipY - shY + 0.01, 0.1); fillStroke(c, T.jersey, ow);
    c.beginPath(); c.moveTo(-0.065, shY + 0.005); c.lineTo(0, shY + 0.085); c.lineTo(0.065, shY + 0.005); c.closePath(); c.fillStyle = T.dark; c.fill();
    c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = 0.014;
    c.beginPath(); c.moveTo(0, shY + 0.09); c.lineTo(0, hipY - 0.03); c.stroke();
    if (big) drawBall(c, -0.105, shY + 0.14, 0.042, 0.5);
    c.fillStyle = '#20263a'; c.fillRect(-0.185, hipY - 0.03, 0.37, 0.04);
    c.fillStyle = SKIN_D; c.fillRect(-0.06, hy + 0.17, 0.12, 0.08);
    for (const sx of [-1, 1]) { circ(c, sx * 0.245, hy + 0.03, 0.055); fillStroke(c, SKIN, ow); }
    circ(c, 0, hy, 0.25); fillStroke(c, SKIN, ow);
    c.fillStyle = hair;
    c.beginPath(); c.ellipse(-0.205, hy - 0.05, 0.06, 0.1, 0.35, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(0.205, hy - 0.05, 0.06, 0.1, -0.35, 0, TAU); c.fill();
    drawFace(c, hy, p.face, (t % 3.4) < 0.12);
    c.beginPath(); c.ellipse(0, hy - 0.045, 0.265, 0.235, 0, Math.PI, 0); c.closePath(); fillStroke(c, T.cap, ow);
    c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 0.012;
    c.beginPath(); c.moveTo(0, hy - 0.27); c.lineTo(0, hy - 0.06); c.stroke();
    if (big) { c.fillStyle = '#fffaf0'; circ(c, 0, hy - 0.15, 0.062); c.fill(); drawBall(c, 0, hy - 0.15, 0.046, 0.2); }
    c.beginPath(); c.ellipse(0, hy - 0.04, 0.25, 0.066, 0, 0, Math.PI); c.closePath(); fillStroke(c, T.dark, ow);
    circ(c, 0, hy - 0.283, 0.026); fillStroke(c, T.dark, ow);
    const R = drawArm(c, -0.2, shY + 0.07, p.rh.x, -p.rh.y, -1, 0.5, T.jersey, ow, false);
    if (p.ballHand) drawBall(c, R.ex, R.ey - 0.015, BALL_R, t * 3);
    const G2 = drawArm(c, 0.2, shY + 0.07, p.gh.x, -p.gh.y, 1, 0.5, T.jersey, ow, false);
    const gcx = G2.ex + 0.035, gcy = G2.ey - 0.09;
    drawGloveFront(c, gcx, gcy, 0.36, p.gloveClosed, p.ballGlove, p.gloveRot, ow);
    const m = c.getTransform();
    const pt = m.transformPoint(new DOMPoint(gcx, gcy));
    c.restore();
    return { x: pt.x / DPR, y: pt.y / DPR };
  }
  function drawKidBack(c, fx, fy, S, teamKey, p, glove, t, hair) {
    const T = TEAMS[teamKey], ow = Math.max(1.1, S * 0.018) / S;
    c.save(); c.translate(fx, fy); c.scale(S, S);
    c.fillStyle = 'rgba(16,48,20,.28)';
    c.beginPath(); c.ellipse(0, 0, 0.36 * (1 - Math.min(0.55, p.lift * 0.6)), 0.09, 0, 0, TAU); c.fill();
    c.translate(0, -p.lift);
    const cr = p.crouch;
    const hipY = -(0.56 - cr * 0.2), shY = hipY - 0.4, hy = shY - 0.215;
    drawLeg(c, -0.085, hipY, p.fL.x, -p.fL.y - 0.035, -1, T, ow);
    drawLeg(c, 0.085, hipY, p.fR.x, -p.fR.y - 0.035, 1, T, ow);
    rr(c, -0.185, hipY - 0.07, 0.37, 0.16, 0.06); fillStroke(c, PANTS, ow);
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 0.012;
    rr(c, -0.15, hipY + 0.005, 0.1, 0.06, 0.02); c.stroke(); rr(c, 0.05, hipY + 0.005, 0.1, 0.06, 0.02); c.stroke();
    rr(c, -0.205, shY, 0.41, hipY - shY + 0.01, 0.1); fillStroke(c, T.jersey, ow);
    c.fillStyle = '#20263a'; c.fillRect(-0.185, hipY - 0.03, 0.37, 0.04);
    c.save(); c.scale(1 / S, 1 / S);
    c.font = `${0.24 * S}px "Black Han Sans","Jua",sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round'; c.lineWidth = Math.max(1.5, 0.035 * S); c.strokeStyle = T.dark;
    c.strokeText('7', 0, (shY + 0.2) * S); c.fillStyle = T.num; c.fillText('7', 0, (shY + 0.2) * S);
    c.restore();
    rr(c, -0.07, hy + 0.14, 0.14, 0.12, 0.03); c.fillStyle = SKIN; c.fill();
    c.beginPath(); c.moveTo(-0.09, shY + 0.01); c.quadraticCurveTo(0, shY + 0.07, 0.09, shY + 0.01); c.strokeStyle = T.dark; c.lineWidth = 0.03; c.stroke();
    for (const sx of [-1, 1]) { circ(c, sx * 0.24, hy + 0.03, 0.05); fillStroke(c, SKIN, ow); }
    circ(c, 0, hy, 0.25); fillStroke(c, hair, ow);
    c.beginPath(); c.ellipse(0, hy - 0.04, 0.265, 0.235, 0, Math.PI, 0); c.closePath(); fillStroke(c, T.cap, ow);
    c.beginPath(); c.ellipse(0, hy - 0.04, 0.075, 0.062, 0, Math.PI, 0); c.closePath(); c.fillStyle = hair; c.fill();
    rr(c, -0.09, hy - 0.058, 0.18, 0.03, 0.012); c.fillStyle = T.dark; c.fill();
    c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 0.012;
    c.beginPath(); c.moveTo(0, hy - 0.27); c.lineTo(0, hy - 0.11); c.stroke();
    circ(c, 0, hy - 0.283, 0.026); fillStroke(c, T.dark, ow);
    const R = drawArm(c, 0.2, shY + 0.07, p.rh.x, -p.rh.y, 1, 0.5, T.jersey, ow, false);
    if (p.ballHand) drawBall(c, R.ex, R.ey - 0.02, BALL_R, t * 3);
    const gx = (glove.x - fx) / S, gy = (glove.y - fy) / S + p.lift;
    const wr = Math.sin(glove.rot), wc = Math.cos(glove.rot);
    const wx = gx - wr * 0.15, wy = gy + wc * 0.15;
    drawArm(c, -0.2, shY + 0.07, wx, wy, -1, 0.4, T.jersey, ow, true);
    drawGloveBack(c, gx, gy, glove.u / S, glove.closed, glove.ball, glove.rot, ow);
    c.restore();
  }

  /* ---------- 상태 ---------- */
  const startTeam = TEAMS[opts.team] ? opts.team : (TEAMS[local.get('team', 'red')] ? local.get('team', 'red') : 'red');
  const G = {
    phase: 'title', t: 0, phaseT: 0, paused: false, freeze: 0,
    score: 0, best: 0, lives: 3, combo: 0, maxCombo: 0, perfects: 0, nice: 0,
    round: 0, team: startTeam, plan: null, holdDur: 0.6, seenTypes: new Set(), tut: {}, recordShown: false,
    shakeT: 0, shakeMag: 0, easyNext: false,
  };
  const P = { gx: 0, gy: 1.05, tgx: 0, tgy: 1.05, bodyX: 0.36, bodyV: 0, runPh: 0, crouch: 0, lift: 0,
    glove: 0, closeT: 0, cooldown: 0, pending: null, whiffAt: -9, throwT: -1, hop: 0 };
  const A = { bx: 0, by: 1.05, x: 0, y: 1.05, fx: 0, fy: 1.05 };
  const M = { x: 0, z: PARTNER_Z, tx: 0, pose: 'wave', poseT: 0, windDur: 0.8, say: '', sayT: 0, runPh: 0,
    judge: 'ok', dir: 1, catchLocal: { x: 0.2, y: 1.05 }, fetch: 0, glove: null, head: null };
  const B = { state: 'partner', segs: [], launch: 0, dur: 1, arriveAt: 0, target: { x: 0, y: 1, z: 0 }, type: 'normal',
    pos: { x: 0, y: 1, z: PARTNER_Z }, vel: { x: 0, y: 0, z: 0 }, rot: 0, spin: 14, toPlayer: true,
    arrDist: 9, arrGlove: { x: 0, y: 0 }, segIdx: 0, trail: [], judge: 'ok', bounces: 0, wild: false };

  /* 대결 상태 */
  const D = DUEL ? {
    gid: String(DUEL.gid ?? '0'),
    iStart: !!DUEL.iStart,
    myName: DUEL.myName || '나',
    oppName: DUEL.oppName || '상대',
    seq: 0,             // 끝난 던지기 수 (두 사람 합)
    mySeq: 0,           // 내가 던져 놓고 결과를 기다리는 순번
    result: null,       // 그 결과
    inThrow: null,      // 상대가 던진, 아직 안 날린 공
    rally: 0,
    opp: { lives: 3, score: 0, gx: 0, gy: 1.05, lastSeen: performance.now(), seenAt: null, alive: true },
    ended: false, win: null, reason: '',
    ghost: { at: 0, x: 9, y: 9 },
    lastSentTh: '', lastSentCt: '',
  } : null;

  /* 난이도 · 공 빠르기 */
  const BESTS = { easy: 0, normal: 0, hard: 0, ...(opts.bests || {}) };
  if (opts.best && !opts.bests) BESTS.normal = opts.best | 0;
  const wantDiff = (DUEL && DUEL.difficulty) || opts.difficulty;
  G.diff = DIFFS[wantDiff] ? wantDiff : 'normal';
  G.speed = clamp(local.get('speed', 1) | 0, 0, 2);
  const DF = () => DIFFS[G.diff];
  function applyDiff() { EARLY = 0.24 * DF().early; G.best = BESTS[G.diff] | 0; }
  applyDiff();

  const catchR = () => DF().R * (D ? Math.max(0.28, 0.34 - D.rally * 0.003) : Math.max(0.27, 0.36 - G.score * 0.0025));
  const swayAmp = () => {
    const base = D ? Math.min(1.1, Math.max(0, (D.rally - 1) * 0.07)) : Math.min(1.25, Math.max(0, (G.score - 3) * 0.045));
    const sp = SPEEDS[G.speed];
    return (base * sp.sway + sp.add) * DF().sway;
  };
  const levelOf = (s) => Math.min(LEVELS.length - 1, Math.floor(s / 10));
  const isPlaying = () => !['title', 'over', 'vs'].includes(G.phase);
  const fineMouse = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- 공 궤적 ---------- */
  function mkSeg(p0, p1, T, g, ax = 0) {
    return { p0: { x: p0.x, y: p0.y, z: p0.z }, T, a: { x: ax, y: -g },
      v: { x: (p1.x - p0.x - 0.5 * ax * T * T) / T, y: (p1.y - p0.y + 0.5 * g * T * T) / T, z: (p1.z - p0.z) / T }, wob: null };
  }
  function fitSeg(p0, p1, T, g, ax = 0) {
    let s = mkSeg(p0, p1, T, g, ax);
    for (let i = 0; i < 14; i++) {
      const apex = s.v.y > 0 ? p0.y + s.v.y * s.v.y / (2 * g) : p0.y;
      if (apex <= APEX_MAX || g < 2.4) break;
      g *= 0.88; s = mkSeg(p0, p1, T, g, ax);
    }
    return s;
  }
  function evalBall(tr, out) {
    let i = 0, tau = tr;
    for (; i < B.segs.length - 1; i++) { if (tau <= B.segs[i].T) break; tau -= B.segs[i].T; }
    const s = B.segs[i];
    tau = Math.min(tau, s.T);
    out.x = s.p0.x + s.v.x * tau + 0.5 * s.a.x * tau * tau;
    out.y = s.p0.y + s.v.y * tau + 0.5 * s.a.y * tau * tau;
    out.z = s.p0.z + s.v.z * tau;
    if (s.wob) {
      out.x += s.wob.ax * Math.sin(Math.PI * s.wob.kx * tau / s.T);
      out.y += s.wob.ay * Math.sin(Math.PI * s.wob.ky * tau / s.T);
    }
    return i;
  }
  function endVel() {
    const s = B.segs[B.segs.length - 1], T = s.T;
    const v = { x: s.v.x + s.a.x * T, y: s.v.y + s.a.y * T, z: s.v.z };
    if (s.wob) {
      v.x += s.wob.ax * Math.PI * s.wob.kx / T * Math.cos(Math.PI * s.wob.kx);
      v.y += s.wob.ay * Math.PI * s.wob.ky / T * Math.cos(Math.PI * s.wob.ky);
    }
    return v;
  }
  /** 공 종류 · 도착점 · 비행시간이 정해졌을 때 실제 궤적을 짓는다 (혼자·대결 공용) */
  function buildSegs(type, rel, tx, ty, T) {
    const tgt = { x: tx, y: ty, z: GLOVE_Z };
    switch (type) {
      case 'lob': return [fitSeg(rel, tgt, T, 9.8)];
      case 'grounder': {
        const bz = rand(2.6, 4.2), bx = lerp(rel.x, tx, 0.72);
        const T1 = Math.max(0.42, T * 0.72);
        const s1 = mkSeg(rel, { x: bx, y: BALL_R, z: bz }, T1, 6.5);
        const T2 = Math.max(0.2, T - T1);
        return [s1, mkSeg({ x: bx, y: BALL_R, z: bz }, tgt, T2, 9.8)];
      }
      case 'curve': {
        const ax = (Math.random() < 0.5 ? -1 : 1) * rand(2.4, 3.8);
        return [fitSeg(rel, tgt, T, 6.5, ax)];
      }
      case 'fast': return [fitSeg({ ...rel, y: 1.72 }, tgt, T, 4.5)];
      case 'knuckle': {
        const sg = fitSeg(rel, tgt, T, 6.5);
        sg.wob = { ax: (Math.random() < 0.5 ? -1 : 1) * rand(0.16, 0.26), kx: 3, ay: rand(0.08, 0.14), ky: 2 };
        return [sg];
      }
      default: return [fitSeg(rel, tgt, T, 6.5)];
    }
  }
  /** 혼자 하기: 친구가 고르는 공 빠르기 (난이도가 높을수록 빠른 볼이 잦다) */
  function pickSpeed(type) {
    const s = G.score, d = G.diff;
    let w = d === 'easy' ? [5, 4, s >= 10 ? 1 : 0] : d === 'hard' ? [2, 3.5, 4.5] : [2.5, 5, s >= 5 ? 2.5 : 0];
    if (type === 'lob') w = [w[0], w[1], w[2] * 0.4];
    const tot = w[0] + w[1] + w[2];
    let r = Math.random() * tot;
    for (let i = 0; i < 3; i++) { r -= w[i]; if (r <= 0) return i; }
    return 1;
  }
  function planThrow() {
    const s = G.score;
    const gap = DF().typeGap;
    /* '강속구' 공종류는 뺐다 — 빠르기는 이제 따로 고른다(SPEEDS) */
    const pool = [['normal', 3]];
    if (s >= 5 * gap) pool.push(['lob', 1.2]);
    if (s >= 9 * gap) pool.push(['grounder', 1.2]);
    if (s >= 14 * gap) pool.push(['curve', 1.3]);
    if (s >= 28 * gap) pool.push(['knuckle', 1.0]);
    let type = 'normal';
    if (G.round > 2 && !G.easyNext) {
      let tot = 0; for (const [, w] of pool) tot += w;
      let r = Math.random() * tot;
      for (const [k, w] of pool) { r -= w; if (r <= 0) { type = k; break; } }
      for (const [k] of pool) if (!G.seenTypes.has(k)) { type = k; break; }
    }
    G.easyNext = false;
    G.seenTypes.add(type);
    const spreadX = Math.min(1.45, (0.2 + s * 0.045) * DF().spread);
    const yr = Math.min(0.85, (0.12 + s * 0.03) * DF().spread);
    let tx = rand(-spreadX, spreadX), ty = clamp(1.1 + rand(-yr * 0.95, yr), 0.3, 2.1);
    let T = 1.55 - Math.min(s, 40) * 0.017 + rand(-0.06, 0.06);
    if (G.round <= 2) { tx = clamp(P.gx, -0.5, 0.5) + rand(-0.12, 0.12); ty = rand(0.95, 1.2); T = 1.75; }
    if (type === 'lob') { ty = rand(1.4, 2.1); T = Math.max(1.45, 2.05 - s * 0.009); }
    if (type === 'grounder') { ty = rand(0.2, 0.5); tx *= 0.85; }
    if (type === 'curve') T += 0.08;
    if (type === 'fast') T = Math.max(0.56, 0.86 - (s - 20) * 0.01);
    if (type === 'knuckle') T += 0.18;
    const speed = G.round > 2 ? pickSpeed(type) : 1;
    T = Math.max(DF().minT, T * DF().T * SPEEDS[speed].T);
    const rel = { x: M.x - 0.2, y: 1.6, z: M.z - 0.3 };
    return { type, speed, segs: buildSegs(type, rel, tx, ty, T), target: { x: tx, y: ty, z: GLOVE_Z } };
  }
  /** 대결: 랠리가 길어질수록 빠르고, 공 종류가 늘어난다 */
  function duelPick() {
    const r = D.rally, gap = DF().typeGap;
    const pool = [['normal', 3]];
    if (r >= 3 * gap) pool.push(['lob', 1.1]);
    if (r >= 5 * gap) pool.push(['grounder', 1.1]);
    if (r >= 7 * gap) pool.push(['curve', 1.2]);
    if (r >= 14 * gap) pool.push(['knuckle', 0.9]);
    let tot = 0; for (const [, w] of pool) tot += w;
    let x = Math.random() * tot, type = 'normal';
    for (const [k, w] of pool) { x -= w; if (x <= 0) { type = k; break; } }
    let T = Math.max(0.8, 1.45 - r * 0.035);
    if (type === 'lob') T = Math.max(1.4, 1.9 - r * 0.02);
    if (type === 'knuckle') T += 0.15;
    if (type === 'curve') T += 0.06;
    /* 빠르기는 던지는 내가 고른 것 (SPEEDS) */
    T = Math.max(DF().minT, T * DF().T * SPEEDS[G.speed].T);
    return { type, T };
  }

  /* ---------- 진행 단계 ---------- */
  /* 대결이 끝난 뒤에는 늦게 도착한 연출이 '끝' 화면을 덮지 못한다 */
  function setPhase(p) { if (D && D.ended && p !== 'over') return; G.phase = p; G.phaseT = 0; }
  function say(text, dur) { M.say = text; M.sayT = dur; }
  function setPose(p) { M.pose = p; M.poseT = 0; }

  function resetRun() {
    Object.assign(G, { score: 0, lives: 3, combo: 0, maxCombo: 0, perfects: 0, nice: 0, round: 0, paused: false, freeze: 0, recordShown: false, easyNext: false });
    G.seenTypes = new Set();
    Object.assign(P, { gx: 0, gy: 1.05, tgx: 0, tgy: 1.05, bodyX: 0.36, bodyV: 0, crouch: 0, lift: 0, glove: 0, closeT: 0, cooldown: 0, pending: null, throwT: -1 });
    Object.assign(M, { x: 0, z: PARTNER_Z, tx: 0, sayT: 0 });
    B.state = 'partner'; B.trail.length = 0;
    fx.parts.length = 0; fx.pops.length = 0; fx.rings.length = 0; fx.confetti.length = 0;
  }
  function startGame() {
    if (G.phase !== 'title' && G.phase !== 'over') return;
    Snd.init(); Snd.click();
    resetRun();
    $('title').hidden = true; $('over').hidden = true; $('pauseBox').hidden = true;
    hudEl.hidden = false; $('controls').hidden = false;
    hud.score(false); hud.lives(); hud.level(); hud.combo();
    setPose('cheer'); say('캐치볼 하자!', 1.4);
    setPhase('intro');
    banner('플레이 볼!', '공을 잡으면 1점!');
  }
  function goTitle() {
    setPhase('title'); G.paused = false;
    $('over').hidden = true; $('pauseBox').hidden = true; hudEl.hidden = true; $('controls').hidden = true;
    $('hint').hidden = true; $('banner').hidden = true;
    $('title').hidden = false; $('bestTitle').textContent = G.best;
    Object.assign(M, { x: 0, z: PARTNER_Z, tx: 0, sayT: 0 }); setPose('wave');
    B.state = 'partner';
  }
  function nextRound() {
    G.round++;
    const s = G.score;
    if (s >= 8) { const r = Math.min(1.5, 0.35 + (s - 8) * 0.05); M.tx = clamp(rand(-r, r), -1.6, 1.6); }
    else M.tx = 0;
    setPose('idle');
    setPhase('reposition');
  }
  function startWindup() {
    G.plan = planThrow();
    setPose('windup');
    M.windDur = Math.max(0.5, 0.95 - G.score * 0.009);
    say(callFor(G.plan.type, G.plan.speed), M.windDur + 0.5);
    if (G.plan.speed === 2 && !G.tut.fastIn) tutorial('fastIn', '빠른 볼! 금방 날아와요');
    else if (G.plan.speed === 0 && !G.tut.slowIn) tutorial('slowIn', '느린 볼~ 너무 일찍 누르지 마세요');
    setPhase('windup');
    if (G.round <= 1) tutorial('move', fineMouse ? '마우스를 움직이면 글러브가 따라와요' : '화면을 손가락으로 끌면 글러브가 움직여요');
    if (G.plan.type !== 'normal' && !G.tut['type_' + G.plan.type]) tutorial('type_' + G.plan.type, TYPE_HINT[G.plan.type]);
  }
  function launchPartnerBall() {
    const pl = G.plan;
    B.segs = pl.segs; B.launch = G.t; B.dur = pl.segs.reduce((a, s) => a + s.T, 0);
    B.arriveAt = G.t + B.dur; B.target = pl.target; B.type = pl.type; B.wild = !!pl.wild;
    B.state = 'flight'; B.toPlayer = true; B.segIdx = 0; B.trail.length = 0; B.bounces = 0;
    B.spin = pl.type === 'knuckle' ? 0.6 : 14;
    evalBall(0, B.pos);
    P.pending = null;
    setPose('follow');
    Snd.whoosh(pl.type === 'fast');
    setPhase('flying');
    if (!D && G.round <= 2) tutorial('catch', '작아지는 링이 공에 닿을 때 잡기!');
    if (D && !G.tut.dcatch) tutorial('dcatch', '작아지는 링이 공에 닿을 때 잡기!');
  }
  function onArrivePlayer() {
    B.arrGlove = { x: P.gx, y: P.gy };
    B.arrDist = Math.hypot(B.target.x - P.gx, B.target.y - P.gy);
    const R = catchR();
    if (B.wild) { B.state = 'free'; B.vel = endVel(); wildIn(); return; }
    if (P.pending) { resolveCatch(P.pending.dtA); return; }
    if (B.arrDist <= R) {
      if (P.closeT > 0) { deflect('early'); return; }
      B.state = 'atGlove';
      return;
    }
    B.state = 'free'; B.vel = endVel();
    miss('pos');
  }
  function resolveCatch(dtA) {
    const R = catchR(), d = B.arrDist;
    if (d > R) { B.state = 'free'; B.vel = endVel(); miss('pos'); return; }
    let grade;
    if (dtA >= -0.005 && dtA <= 0.11 && d <= R * 0.62) grade = 'perfect';
    else if (dtA >= -0.04 && dtA <= 0.17) grade = 'great';
    else grade = dtA < 0 ? 'late' : 'nice';
    caught(grade);
  }
  function caught(grade) {
    B.state = 'player'; P.pending = null; P.closeT = 0; P.glove = 1; P.hop = 0.28;
    G.score++; G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
    if (grade === 'perfect') G.perfects++;
    const gp = proj(P.gx, P.gy, GLOVE_Z);
    const big = grade === 'perfect';
    burst(gp.x, gp.y, big ? 16 : 10, big ? ['#ffd84a', '#fff', '#ffb02e'] : ['#fff', '#ffe9a8'], big ? 340 : 240, 'star');
    burst(gp.x, gp.y, 7, ['#e9d7b8', '#fff4dc'], 120, 'puff');
    fx.rings.push({ x: gp.x, y: gp.y, r: 10, vr: big ? 420 : 300, life: 0.35, max: 0.35, col: big ? '#ffd84a' : '#ffffff' });
    const label = { perfect: 'PERFECT!', great: 'GREAT!', nice: 'NICE CATCH!', late: '아슬아슬!' }[grade];
    const col = { perfect: '#ffd84a', great: '#ffb347', nice: '#ffffff', late: '#bff0ff' }[grade];
    popText(label, gp.x, gp.y - 46, col, big ? 40 : 32, 0.9);
    popText('+1', gp.x + 46, gp.y - 10, '#ffffff', 26, 0.7);
    Snd.pop(big);
    shake(big ? 7 : 4, 0.18);
    vibrate(big ? 30 : 18);
    G.freeze = big ? 0.09 : 0.04;
    hud.score(true); hud.combo(); hud.level();
    if (D) {
      D.rally++;
      sendResult({ perfect: 'p', great: 'g', nice: 'n', late: 'l' }[grade]);
      hud.level();
    } else if (G.score % 10 === 0) {
      const lv = levelOf(G.score);
      banner(`Lv.${lv + 1}`, LEVELS[lv]); confettiBurst(); Snd.fanfare();
      setPose('cheer'); say(pick(['대단해!', '최고야!', '와아~!']), 1.2);
    } else if (!G.recordShown && G.best > 0 && G.score === G.best + 1) {
      G.recordShown = true; banner('신기록!', `${G.score}개 돌파`); Snd.fanfare();
    } else if (G.combo >= 3 && G.combo % 5 === 0) {
      say(`${G.combo}개 연속!`, 1);
    }
    setPhase('caught');
  }
  function deflect(reason) {
    B.state = 'free';
    B.pos = { x: B.target.x, y: B.target.y, z: GLOVE_Z };
    B.vel = { x: rand(-2.2, 2.2), y: rand(2.6, 4), z: rand(-2.6, -1.2) };
    Snd.ting();
    const gp = proj(B.pos.x, B.pos.y, GLOVE_Z);
    burst(gp.x, gp.y, 6, ['#fff'], 160, 'star');
    miss(reason);
  }
  function miss(reason) {
    if (G.phase !== 'flying') return;
    G.lives--; G.combo = 0;
    hud.lives(true); hud.combo();
    const gp = proj(P.gx, P.gy, GLOVE_Z);
    popText('놓쳤다!', gp.x, gp.y - 40, '#ff6b5e', 34, 1);
    let tip;
    if (reason === 'early') tip = '너무 빨리 눌렀어요!\n링이 공에 닿을 때 잡기';
    else if (reason === 'nopress') tip = '글러브 위치는 딱 좋았어요!\n이제 잡기 버튼을 눌러요';
    else {
      const dx = B.target.x - B.arrGlove.x, dy = B.target.y - B.arrGlove.y;
      if (Math.abs(dx) >= Math.abs(dy) * 0.9) tip = dx > 0 ? '공은 조금 더 오른쪽이었어요' : '공은 조금 더 왼쪽이었어요';
      else tip = dy > 0 ? '공이 더 높았어요. 글러브를 위로!' : '공이 더 낮았어요. 글러브를 아래로!';
    }
    showHint(tip, 2.2);
    Snd.miss(); shake(5, 0.2); vibrate([40, 40, 40]);
    setPose(D ? 'cheerSmall' : 'oops');
    if (D) {
      D.rally = 0; hud.level();
      sendResult('m');
    }
    setPhase('missed');
  }
  /** 대결: 상대 악송구 — 손이 안 닿는 공. 나는 아무것도 안 잃는다 */
  function wildIn() {
    if (G.phase !== 'flying') return;
    G.combo = 0; hud.combo();
    const p = proj(B.target.x, clamp(B.target.y, 0.3, 2.3), GLOVE_Z);
    popText('악송구!', p.x, p.y - 30, '#ffb84a', 32, 1);
    showHint('손이 닿지 않는 공이에요\n상대가 공 하나를 잃어요', 2.2);
    Snd.ting();
    setPose('oops');
    D.rally = 0; hud.level();
    sendResult('w');
    setPhase('missed');
  }
  function beginHolding() {
    setPhase('holding');
    A.bx = M.x; A.by = 1.05; A.x = A.bx; A.y = A.by;
    setPose('ready');
    if (D) {
      if (!G.tut.dthrow) tutorial('dthrow', '내 차례! 빠르기를 고르고 과녁을 맞춰 던지기\n빠른 볼일수록 과녁이 더 흔들려요');
      return;
    }
    if (G.round <= 3 || Math.random() < 0.35) say(pick(['여기!', '이쪽이야!', '던져~!']), 0.9);
    if (G.round <= 3) tutorial('throw', '던지기 버튼을 눌러 친구에게 던져요!');
    else if (!G.tut.speed) tutorial('speed', '던지기 위 버튼으로 공 빠르기를 골라요\n빠른 볼일수록 과녁이 더 흔들려요');
    if (swayAmp() > 0.05) tutorial('aim', '과녁이 친구 몸에 왔을 때 던지면 나이스 볼!\n' + (fineMouse ? '마우스로 과녁을 옮길 수도 있어요' : '끌어서 과녁을 옮길 수도 있어요'));
  }
  function judgeThrow(ax, ay) {
    if (D) {
      /* 대결: 받는 사람 기준으로 손이 닿는가 (좌우는 거울) */
      const tx = -ax, ty = ay;
      if (!reachable(tx, ty)) return 'miss';
      const dx = ax - M.x, dy = ay - 1.05;
      if (Math.hypot(dx, dy * 0.85) < 0.38) return 'nice';
      return Math.abs(tx) > 1.35 || ty > 2.15 || ty < 0.3 ? 'dive' : 'ok';
    }
    const dx = ax - M.x, dy = ay - 1.05;
    if (Math.hypot(dx, dy * 0.85) < 0.38) return 'nice';
    if (Math.abs(dx) < 0.75 && ay > 0.25 && ay < 1.95) return 'ok';
    if (Math.abs(dx) < 1.9 && ay < 1.6) return 'dive';
    if (Math.abs(dx) < 0.9 && ay < 2.9) return 'jump';
    return 'miss';
  }
  function launchPlayerBall() {
    const hand = { x: P.bodyX + 0.22, y: 1.5 + P.lift, z: 0.2 };
    const tgt = { x: A.fx, y: A.fy, z: M.z - 0.25 };
    let T = Math.max(0.42, Math.max(0.62, 0.82 - G.score * 0.004) * SPEEDS[G.speed].T);
    if (D) {
      /* 대결: 공 종류와 비행시간은 던지는 쪽이 정해 보낸다. 내 화면에서는 조금 느리게 —
         상대의 판정이 도착할 틈을 준다 (도착했는데 결과가 없으면 공을 잠깐 붙든다) */
      const pk = duelPick();
      D.mySeq = D.seq + 1; D.result = null;
      const th = `${D.gid}|${D.mySeq}|${TYPES.indexOf(pk.type) + (G.speed + 1) * 10}|${Math.round(-A.fx * 100)}|${Math.round(A.fy * 100)}|${Math.round(pk.T * 1000)}`;
      D.lastSentTh = th;
      DUEL.send({ th });
      T = pk.T + 0.12;
    }
    B.segs = [mkSeg(hand, tgt, T, 6.5)];
    B.launch = G.t; B.dur = T; B.arriveAt = G.t + T; B.target = tgt;
    B.state = 'flight'; B.toPlayer = false; B.segIdx = 0; B.trail.length = 0; B.spin = 16; B.bounces = 0;
    evalBall(0, B.pos);
    B.judge = judgeThrow(A.fx, A.fy);
    B.speed = G.speed;
    M.judge = B.judge; M.dir = A.fx >= M.x ? 1 : -1;
    M.catchLocal = { x: clamp(A.fx - M.x, -0.5, 0.7), y: clamp(A.fy, 0.4, 1.85) };
    setPose('track');
    Snd.whoosh(true);
    setPhase('toPartner');
  }
  function onArrivePartner() {
    if (D) {
      /* 상대가 직접 판정한다 — 결과가 아직이면 공을 친구 앞에 붙들어 둔다 */
      if (D.result == null) { B.state = 'hang'; setPhase('awaitResult'); return; }
      resolveMyThrow(D.result);
      return;
    }
    const j = B.judge;
    if (j === 'miss') {
      B.state = 'free'; B.vel = endVel();
      G.combo = 0; hud.combo();
      setPose('oops'); say('어이쿠!', 0.9);
      const hp = proj(M.x, 1.9, M.z);
      popText('공이 빠졌어요', hp.x, hp.y - 10, '#ffffff', 22, 1.1);
      M.fetch = 0;
      setPhase('fetch');
      return;
    }
    B.state = 'partner';
    Snd.softPop();
    const hp = proj(M.x + (j === 'dive' ? M.dir * 1.2 : 0), 1.85, M.z);
    const txt = (B.speed === 2
      ? { nice: '강속구 나이스 볼!', ok: '와, 빠르다!', dive: '다이빙 캐치!', jump: '점프 캐치!' }
      : { nice: '나이스 볼!', ok: '좋아!', dive: '다이빙 캐치!', jump: '점프 캐치!' })[j];
    popText(txt, hp.x, hp.y - 8, j === 'nice' ? '#7cff6b' : '#ffffff', j === 'nice' ? 28 : 24, 1);
    if (j === 'nice') { G.nice++; burst(M.glove ? M.glove.x : hp.x, M.glove ? M.glove.y : hp.y, 8, ['#7cff6b', '#fff'], 140, 'star'); }
    setPose(j === 'dive' ? 'diveHold' : j === 'jump' ? 'jumpLand' : 'caught');
    G.holdDur = j === 'dive' ? 1.15 : j === 'jump' ? 0.8 : 0.5;
    setPhase('partnerHold');
  }
  /** 대결: 내가 던진 공의 결과 (상대가 판정해 돌려준 것) */
  function resolveMyThrow(res) {
    D.seq = D.mySeq; D.result = null;
    const hp = proj(M.x, 1.9, M.z);
    if (res === 'm' || res === 'w') {
      B.state = 'free';
      B.vel = { x: rand(-1.5, 1.5) + (B.target.x - M.x) * 0.5, y: rand(1.5, 3), z: 6 };
      if (res === 'w') {
        G.lives--; hud.lives(true);
        popText('악송구! -1', hp.x, hp.y - 10, '#ff6b5e', 28, 1.2);
        showHint('손이 닿지 않는 곳으로 던졌어요\n내 공이 하나 줄어요', 2.2);
        Snd.miss(); shake(4, 0.18);
        setPose('oops');
        DUEL.send({ lives: Math.max(0, G.lives), ...(G.lives <= 0 ? { alive: false, done: true } : {}) });
        if (G.lives <= 0) { endDuel(false, 'lives'); return; }
      } else {
        popText('상대가 놓쳤다!', hp.x, hp.y - 10, '#7cff6b', 26, 1.2);
        Snd.click();
        setPose('oops');
      }
      D.rally = 0; G.combo = 0; hud.combo(); hud.level();
      G.holdDur = 1.1;
      setPhase('partnerHold');
      return;
    }
    B.state = 'partner';
    Snd.softPop();
    const txt = { p: 'PERFECT 캐치!', g: '잡았다!', n: '잡았다!', l: '아슬아슬!' }[res] || '잡았다!';
    popText(txt, hp.x, hp.y - 8, '#ffffff', 24, 1);
    if (M.judge === 'nice') G.nice++;
    D.rally++; hud.level();
    setPose('caught');
    G.holdDur = 0.5;
    setPhase('partnerHold');
  }
  /** 대결: 내 판정을 보낸다 (목숨·점수를 한 번에 — 같은 스냅샷으로 도착해야 상대가 헷갈리지 않는다) */
  function sendResult(code) {
    const seq = D.seq + 1;
    D.seq = seq;
    const ct = `${D.gid}|${seq}|${code}`;
    D.lastSentCt = ct;
    const out = { ct, lives: Math.max(0, G.lives), score: G.score };
    if (G.lives <= 0) { out.alive = false; out.done = true; }
    DUEL.send(out);
    if (G.lives <= 0) later(() => endDuel(false, 'lives'), 900);
  }
  function startRemoteWindup(th) {
    D.inThrow = null;
    /* 공종류 칸 = 종류 + (빠르기+1)×10. 10 미만이면 빠르기를 안 보내던 판(중간 볼로 본다) */
    const tc = th.type | 0, sc = Math.floor(tc / 10);
    const type = TYPES[tc % 10] || 'normal';
    const speed = sc >= 1 && sc <= 3 ? sc - 1 : 1;
    const tx = th.x / 100, ty = th.y / 100, T = clamp(th.T / 1000, 0.45, 3);
    const rel = { x: M.x - 0.2, y: 1.6, z: M.z - 0.3 };
    G.plan = { type, segs: buildSegs(type, rel, tx, ty, T), target: { x: tx, y: ty, z: GLOVE_Z }, wild: !reachable(tx, ty) };
    setPose('windup');
    M.windDur = 0.42;
    say(callFor(type, speed), 0.9);
    setPhase('windup');
    if (type !== 'normal' && !G.tut['type_' + type]) tutorial('type_' + type, TYPE_HINT[type]);
  }
  function endDuel(win, reason) {
    if (!D || D.ended) return;
    D.ended = true; D.win = win; D.reason = reason;
    hud.lives(); hud.opp();
    setPose(win ? 'oops' : 'cheer');
    if (win) { confettiBurst(); Snd.fanfare(); } else Snd.over();
    banner(win ? '승리!' : '패배', win ? (reason === 'gone' || reason === 'forfeit' ? '상대가 나갔어요' : '상대의 공이 다 떨어졌어요') : '내 공이 다 떨어졌어요');
    setPhase('over');
    try { DUEL.onEnd?.({ win, reason, myScore: G.score, oppScore: D.opp.score }); } catch (e) { /* 화면 쪽 실패는 게임을 멈추지 않는다 */ }
    later(() => showDuelOver(), 1500);
  }
  function showDuelOver() {
    if (dead || G.phase !== 'over') return;
    $('soloBoard').hidden = true; $('duelBoard').hidden = false;
    $('stats').hidden = true; $('newRec').hidden = true;
    $('dMe').textContent = G.score; $('dOpp').textContent = D.opp.score;
    $('dOppName').textContent = D.oppName;
    $('overTitle').textContent = D.win ? '승리!' : '아쉽게 졌어요';
    $('rankLine').innerHTML = '';
    $('rankLine').append(document.createTextNode(D.win ? (D.reason === 'gone' || D.reason === 'forfeit' ? '상대가 경기장을 떠났어요' : '끝까지 잘 잡았어요!') : '다음엔 꼭 이겨요!'));
    $('retry').textContent = '한 판 더';
    $('home').textContent = '나가기';
    $('over').hidden = false;
    $('controls').hidden = true;
    $('retry').focus({ preventScroll: true });
  }
  function gameOver() {
    setPhase('over');
    const newBest = G.score > G.best;
    if (newBest) { G.best = G.score; BESTS[G.diff] = G.best; try { opts.onBest?.(G.best, G.diff); } catch (e) { /* 무시 */ } }
    setPose(G.score >= 10 ? 'cheer' : 'idle');
    Snd.over();
    try { opts.onFinish?.(G.score, G.diff); } catch (e) { /* 화면 쪽 실패는 게임을 멈추지 않는다 */ }
    later(() => {
      if (G.phase !== 'over') return;
      $('overScore').textContent = G.score;
      $('soloLabel').textContent = `오늘 잡은 공 · ${DF().label}`;
      $('overBest').textContent = G.best;
      $('overPerfect').textContent = G.perfects;
      $('overCombo').textContent = G.maxCombo;
      $('overNice').textContent = G.nice;
      $('overRank').textContent = LEVELS[levelOf(G.score)];
      $('newRec').hidden = !newBest || G.score === 0;
      $('overTitle').textContent = G.score >= 30 ? '굉장한 경기였어요!' : G.score >= 10 ? '멋진 경기!' : '경기 끝!';
      $('over').hidden = false;
      $('controls').hidden = true;
      $('retry').focus({ preventScroll: true });
    }, 750);
  }

  /* ---------- 대결: 들어오는 값 ---------- */
  function parsePkt(s, n) {
    if (typeof s !== 'string') return null;
    const a = s.split('|');
    if (a.length !== n) return null;
    return a;
  }
  function remote(node) {
    if (!D || D.ended || dead) return;
    if (!node) { if (G.phase !== 'vs') endDuel(true, 'gone'); return; }
    if (node.seenAt !== undefined && node.seenAt !== D.opp.seenAt) { D.opp.seenAt = node.seenAt; D.opp.lastSeen = performance.now(); }
    if (typeof node.lives === 'number') D.opp.lives = node.lives;
    if (typeof node.score === 'number') D.opp.score = node.score;
    if (typeof node.gx === 'number') D.opp.gx = clamp((node.gx - 700) / 100, -1.6, 1.6);
    if (typeof node.gy === 'number') D.opp.gy = clamp(node.gy / 100, 0.1, 2.5);
    if (typeof node.nickname === 'string' && node.nickname) D.oppName = node.nickname;
    D.lastNode = node;
    /* 판정 → 던지기 순서로 본다. 둘이 한 스냅샷에 실려 오면 판정이 먼저 끝나야
       다음 순번의 던지기가 '기다리던 공'이 된다 */
    const ct = parsePkt(node.ct, 3);
    if (ct && ct[0] === D.gid && (ct[1] | 0) === D.mySeq && D.mySeq > D.seq && D.result == null) {
      D.result = ct[2];
      if (G.phase === 'awaitResult') resolveMyThrow(D.result);
    }
    takeThrow(node);
    hud.opp();
    /* 상대가 끝났다 — 내 판정과 같은 스냅샷에 실려 오므로 결과부터 보고 끝낸다 */
    if (node.alive === false || node.done === true || node.lives === 0) {
      later(() => { if (!D.ended) endDuel(true, node.lives === 0 ? 'lives' : 'forfeit'); }, G.phase === 'awaitResult' || G.phase === 'toPartner' ? 900 : 300);
    }
  }
  /** 상대가 던진 공 — 내가 기다리던 순번일 때만 받는다 */
  function takeThrow(node) {
    if (!node || D.inThrow) return;
    const th = parsePkt(node.th, 6);
    if (!th || th[0] !== D.gid) return;
    const seq = th[1] | 0;
    if (seq === D.seq + 1 && D.mySeq !== seq) {
      D.inThrow = { seq, type: th[2] | 0, x: +th[3], y: +th[4], T: +th[5] };
    }
  }
  function publishGhost(force) {
    if (!D || D.ended) return;
    const now = performance.now();
    if (!force && now - D.ghost.at < 160) return;
    if (!force && Math.abs(P.gx - D.ghost.x) < 0.03 && Math.abs(P.gy - D.ghost.y) < 0.03) return;
    D.ghost = { at: now, x: P.gx, y: P.gy };
    DUEL.send({ gx: Math.round(P.gx * 100) + 700, gy: Math.round(clamp(P.gy, 0.1, 2.5) * 100) });
  }

  /* ---------- 입력 ---------- */
  function tryCatch() {
    if (G.paused || !isPlaying()) return;
    if (P.cooldown > 0 || B.state === 'player') return;
    P.closeT = 0.3; P.cooldown = 0.36;
    Snd.swish();
    pressBtn('catchBtn');
    if (G.phase !== 'flying') return;
    if (B.state === 'flight' && B.toPlayer) {
      const dtA = B.arriveAt - G.t;
      if (dtA <= EARLY) { P.pending = { dtA }; P.closeT = dtA + 0.25; }
      else P.whiffAt = G.t;
    } else if (B.state === 'atGlove') {
      resolveCatch(B.arriveAt - G.t);
    }
  }
  function doThrow() {
    if (G.paused || G.phase !== 'holding') return;
    A.fx = A.x; A.fy = A.y;
    P.throwT = 0;
    pressBtn('throwBtn');
    Snd.click();
    setPhase('throwing');
  }
  function contextAction() {
    if (G.phase === 'holding') doThrow(); else tryCatch();
  }
  const aimPhase = () => G.phase === 'holding';
  function moveBy(dx, dy) {
    if (aimPhase()) {
      const sp = proj(M.x, 1, M.z).s;
      A.bx = clamp(A.bx + dx / sp * 0.55, M.x - 3.2, M.x + 3.2);
      A.by = clamp(A.by - dy / sp * 0.55, 0.1, 3.2);
    } else {
      const sg = F / depthOf(1.1, GLOVE_Z);
      P.tgx = clamp(P.tgx + dx / sg * 1.35, -1.55, 1.55);
      P.tgy = clamp(P.tgy - dy / sg * 1.35, 0.15, 2.4);
    }
  }
  let drag = null, mouseLast = null;
  const toLocal = (e) => { const r = cvs.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  on(cvs, 'pointerdown', (e) => {
    Snd.init();
    if (e.pointerType === 'mouse') {
      mouseLast = { x: e.clientX, y: e.clientY };
      if (e.button === 0 && isPlaying()) contextAction();
      return;
    }
    if (drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { cvs.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    e.preventDefault();
  });
  on(cvs, 'pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      if (mouseLast && Math.abs(mouseLast.x - e.clientX) + Math.abs(mouseLast.y - e.clientY) < 1.5) return;
      if (!isPlaying() || G.paused) { mouseLast = { x: e.clientX, y: e.clientY }; return; }
      if (aimPhase()) {
        if (mouseLast) moveBy(e.clientX - mouseLast.x, e.clientY - mouseLast.y);
      } else {
        const lpnt = toLocal(e);
        const w = unproject(lpnt.x, lpnt.y, GLOVE_Z);
        P.tgx = clamp(w.x, -1.55, 1.55); P.tgy = clamp(w.y, 0.15, 2.4);
      }
      mouseLast = { x: e.clientX, y: e.clientY };
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!G.paused && isPlaying()) moveBy(dx, dy);
  });
  const endDrag = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  on(cvs, 'pointerup', endDrag);
  on(cvs, 'pointercancel', endDrag);
  on(cvs, 'contextmenu', (e) => e.preventDefault());

  function bindAct(key, fn) {
    const el = $(key);
    let viaPointer = false;
    on(el, 'pointerdown', (e) => { e.preventDefault(); Snd.init(); viaPointer = true; fn(); });
    on(el, 'click', () => { if (viaPointer) { viaPointer = false; return; } fn(); });
  }
  bindAct('catchBtn', tryCatch);
  bindAct('throwBtn', doThrow);
  function pressBtn(key) {
    const el = $(key);
    el.classList.add('down');
    later(() => el.classList.remove('down'), 110);
  }

  const keys = {};
  const ARROWS = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1 };
  on(window, 'keydown', (e) => {
    const code = e.code;
    if (ARROWS[code]) e.preventDefault();
    keys[code] = true;
    if (e.repeat) { if (code === 'Space') e.preventDefault(); return; }
    Snd.init();
    if (G.phase === 'title') {
      if ((code === 'Enter' || code === 'Space') && !(document.activeElement && root.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON')) { e.preventDefault(); startGame(); }
      return;
    }
    if (code === 'KeyP') { requestPause(); return; }
    if (G.paused || G.phase === 'over') return;
    if (code === 'Space' || code === 'Enter') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON' && root.contains(document.activeElement)) document.activeElement.blur();
      e.preventDefault(); contextAction();
    }
    else if (code === 'KeyZ' || code === 'KeyJ') tryCatch();
    else if (code === 'KeyX' || code === 'KeyK') doThrow();
    else if (code === 'Digit1' || code === 'Numpad1') setSpeed(0);
    else if (code === 'Digit2' || code === 'Numpad2') setSpeed(1);
    else if (code === 'Digit3' || code === 'Numpad3') setSpeed(2);
  });
  on(window, 'keyup', (e) => { keys[e.code] = false; });
  on(window, 'blur', () => { for (const k in keys) keys[k] = false; });
  function keysUpdate(dt) {
    const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    const ky = (keys.ArrowUp || keys.KeyW ? 1 : 0) - (keys.ArrowDown || keys.KeyS ? 1 : 0);
    if (!kx && !ky) return;
    if (aimPhase()) {
      A.bx = clamp(A.bx + kx * 2.6 * dt, M.x - 3.2, M.x + 3.2);
      A.by = clamp(A.by + ky * 2.0 * dt, 0.1, 3.2);
    } else {
      P.tgx = clamp(P.tgx + kx * 3.8 * dt, -1.55, 1.55);
      P.tgy = clamp(P.tgy + ky * 3.2 * dt, 0.15, 2.4);
    }
  }

  /* ---------- 업데이트 ---------- */
  function update(dt) {
    if (G.freeze > 0) { G.freeze -= dt; dt *= 0.1; }
    G.t += dt; G.phaseT += dt;
    keysUpdate(dt);
    updatePlayer(dt);
    updatePartner(dt);
    updateBall(dt);
    phaseLogic(dt);
    updateFx(dt);
    updateShake(dt);
    if (D && !D.ended) {
      if (['oppHold', 'windup', 'flying', 'reposition'].includes(G.phase)) publishGhost(false);
      /* 상대 신호가 끊긴 지 오래면 이긴 것으로 친다 */
      if (G.phase !== 'vs' && performance.now() - D.opp.lastSeen > (DUEL.absentMs || 30000)) endDuel(true, 'gone');
    }
  }
  function updatePlayer(dt) {
    const holding = B.state === 'player';
    let gx = P.tgx, gy = P.tgy;
    if (holding) {
      if (G.phase === 'caught' && G.phaseT < 0.22) { gx = P.gx; gy = P.gy; }
      else { gx = P.bodyX - 0.26; gy = 1.0; }
    }
    const k = 1 - Math.exp(-dt * (holding ? 12 : 30));
    P.gx += (gx - P.gx) * k; P.gy += (gy - P.gy) * k;
    if (!holding && G.phase !== 'throwing') { P.tgx = clamp(P.tgx, -1.55, 1.55); }
    else { P.tgx = P.gx; P.tgy = P.gy; }
    const bx = clamp(P.gx + 0.36, -1.3, 1.62);
    const prev = P.bodyX;
    P.bodyX += (bx - P.bodyX) * (1 - Math.exp(-dt * 9));
    P.bodyV = (P.bodyX - prev) / Math.max(dt, 1e-4);
    P.runPh += Math.abs(P.bodyV) * dt * 9;
    const wantCrouch = clamp((0.72 - P.gy) / 0.5, 0, 1);
    const wantLift = clamp(P.gy - 1.42, 0, 0.8) + (P.hop > 0 ? Math.sin((0.28 - P.hop) / 0.28 * Math.PI) * 0.08 : 0);
    const kk = 1 - Math.exp(-dt * 14);
    P.crouch += (wantCrouch - P.crouch) * kk;
    P.lift += (wantLift - P.lift) * kk;
    if (P.hop > 0) P.hop -= dt;
    P.closeT -= dt; P.cooldown -= dt;
    let gt;
    if (holding) gt = 1;
    else if (P.pending) gt = (B.arriveAt - G.t) < 0.06 ? 1 : 0.35;
    else gt = P.closeT > 0 ? 1 : 0;
    P.glove += (gt - P.glove) * (1 - Math.exp(-dt * 30));
    if (P.throwT >= 0) { P.throwT += dt; if (P.throwT > 0.55) P.throwT = -1; }
  }
  function moveToward(tx, tz, step) {
    const dx = tx - M.x, dz = tz - M.z, d = Math.hypot(dx, dz);
    if (d <= step || d < 1e-4) { M.x = tx; M.z = tz; return true; }
    M.x += dx / d * step; M.z += dz / d * step;
    return false;
  }
  function updatePartner(dt) {
    M.poseT += dt;
    if (M.sayT > 0) M.sayT -= dt;
    if (G.phase === 'reposition') {
      const arrived = moveToward(M.tx, PARTNER_Z, 2.6 * dt);
      M.pose = arrived ? 'idle' : 'shuffle';
      M.runPh += dt * 14;
    }
    if (G.phase === 'fetch') M.runPh += dt * 16;
    if (D && ['holding', 'throwing', 'toPartner', 'awaitResult', 'oppHold', 'vs'].includes(G.phase)) {
      /* 상대 몸은 상대 글러브를 따라다닌다 (좌우 거울) */
      const want = -clamp(D.opp.gx + 0.33, -1.3, 1.62);
      M.x += (want - M.x) * (1 - Math.exp(-dt * 6));
    }
  }
  function updateBall(dt) {
    B.rot += B.spin * dt;
    if (B.state === 'flight') {
      const tr = G.t - B.launch;
      if (tr < B.dur) {
        const idx = evalBall(tr, B.pos);
        if (idx !== B.segIdx) {
          B.segIdx = idx; Snd.thud();
          const p = proj(B.pos.x, 0, B.pos.z);
          burst(p.x, p.y, 6, ['#d9c39a', '#efe1c0'], 70, 'puff');
        }
      } else {
        evalBall(B.dur, B.pos);
        if (B.toPlayer) onArrivePlayer(); else onArrivePartner();
      }
    } else if (B.state === 'atGlove') {
      B.pos.x = B.target.x; B.pos.y = B.target.y; B.pos.z = GLOVE_Z;
      if (G.t > B.arriveAt + LATE) deflect('nopress');
    } else if (B.state === 'hang') {
      /* 대결: 상대 판정을 기다리는 동안 공을 친구 글러브 앞에 띄워 둔다 */
      B.pos.y = B.target.y + Math.sin(G.t * 9) * 0.02;
    } else if (B.state === 'free') {
      const v = B.vel, p = B.pos;
      v.y -= 9.8 * dt;
      p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
      if (p.y < BALL_R) {
        p.y = BALL_R;
        if (v.y < -1.2) {
          v.y = -v.y * 0.42; v.x *= 0.78; v.z *= 0.72;
          if (B.bounces++ < 3 && p.z > cam.z + 2) Snd.thud();
        } else {
          v.y = 0; const f = Math.exp(-dt * 3.2); v.x *= f; v.z *= f;
        }
      }
      if (p.z > 43 && v.z > 0) { p.z = 43; v.z = -v.z * 0.35; }
    }
    if (B.state === 'flight' || B.state === 'free') {
      const p = proj(B.pos.x, B.pos.y, B.pos.z);
      if (p.depth > 0.9) { B.trail.push({ x: p.x, y: p.y, r: Math.max(2.6, BALL_R * p.s) }); if (B.trail.length > 6) B.trail.shift(); }
    } else if (B.trail.length) B.trail.shift();
  }
  function phaseLogic(dt) {
    switch (G.phase) {
      case 'intro':
        if (G.phaseT > 1.7) nextRound();
        break;
      case 'vs': {
        const left = D.startAt - performance.now();
        const n = Math.ceil(left / 1000);
        const el = $('vsCount');
        const txt = left > 0 ? String(Math.max(1, n)) : '';
        if (el.textContent !== txt) { el.textContent = txt; if (txt) Snd.beep(false); }
        if (left <= 0) beginDuel();
        break;
      }
      case 'reposition':
        if (G.phaseT > 0.3 && M.x === M.tx && M.z === PARTNER_Z) startWindup();
        break;
      case 'windup':
        if (M.poseT >= M.windDur) launchPartnerBall();
        break;
      case 'caught':
        if (G.phaseT > 0.55) beginHolding();
        break;
      case 'holding': {
        const amp = swayAmp(), tt = G.phaseT;
        A.x = A.bx + amp * (Math.sin(tt * 1.7) * 0.8 + Math.sin(tt * 3.9 + 1.3) * 0.3);
        A.y = clamp(A.by + amp * 0.5 * Math.sin(tt * 2.3 + 0.7), 0.05, 3.3);
        if (D) {
          const left = HOLD_LIMIT - G.phaseT;
          if (left < 5 && !G.tut['hold' + D.seq]) { G.tut['hold' + D.seq] = true; showHint('5초 안에 던져요!', 2); }
          if (left <= 0) doThrow();
        } else if (G.phaseT > 3.2 && G.round <= 6 && !G.tut.throwNag) { G.tut.throwNag = true; showHint('잡은 공은 던지기 버튼으로 돌려줘요', 2.4); }
        break;
      }
      case 'throwing':
        if (P.throwT >= 0.27 && B.state === 'player') launchPlayerBall();
        break;
      case 'partnerHold':
        if (G.phaseT > G.holdDur) {
          if (D) { B.state = 'partner'; setPose('idle'); setPhase('oppHold'); }
          else nextRound();
        }
        break;
      case 'oppHold':
        if (!D.inThrow) takeThrow(D.lastNode);   // 판정보다 먼저 와서 지나쳤던 던지기
        if (D.inThrow && G.phaseT > 0.35) startRemoteWindup(D.inThrow);
        else if (G.phaseT > 4 && M.sayT <= 0 && !D.inThrow) say(pick(['어디로 던질까~', '조준 중...', '흐음~']), 1.6);
        break;
      case 'fetch': fetchLogic(dt); break;
      case 'missed':
        if (G.phaseT > 1.6) {
          if (D) {
            if (D.ended) break;
            /* 놓친 공은 내가 주워서 던진다 */
            B.state = 'player'; P.glove = 1;
            if (G.lives <= 0) break;
            beginHolding();
          } else if (G.lives <= 0) gameOver();
          else { B.state = 'partner'; G.easyNext = true; say('괜찮아! 다시 간다~', 1.3); nextRound(); }
        }
        break;
    }
  }
  function beginDuel() {
    $('vs').hidden = true;
    hudEl.hidden = false; $('controls').hidden = false;
    banner('플레이 볼!', D.iStart ? '내가 먼저 던져요' : '상대가 먼저 던져요');
    Snd.beep(true);
    publishGhost(true);
    if (D.iStart) { B.state = 'player'; P.glove = 1; beginHolding(); }
    else { B.state = 'partner'; setPose('idle'); setPhase('oppHold'); }
  }
  function fetchLogic(dt) {
    if (M.fetch === 0) {
      if (G.phaseT > 0.5) { M.fetch = 1; setPose('runAway'); }
    } else if (M.fetch === 1) {
      const tz = Math.max(PARTNER_Z, B.pos.z + 0.3);
      moveToward(B.pos.x, tz, 6.5 * dt);
      const d = Math.hypot(B.pos.x - M.x, tz - M.z);
      if ((d < 0.6 && Math.hypot(B.vel.x, B.vel.z) < 3) || G.phaseT > 5) {
        B.state = 'partner'; M.fetch = 2; setPose('runBack'); say('잡았다~', 0.8);
        const s = G.score; const r = s >= 8 ? Math.min(1.5, 0.35 + (s - 8) * 0.05) : 0;
        M.tx = clamp(rand(-r, r), -1.6, 1.6);
      }
    } else if (M.fetch === 2) {
      if (moveToward(M.tx, PARTNER_Z, 6 * dt)) { G.round++; startWindup(); }
    }
  }

  /* ---------- 친구(상대) 자세 ---------- */
  function partnerPose(t) {
    const p = basePose();
    const inGlove = B.state === 'partner';
    p.ballGlove = inGlove;
    const bob = Math.sin(t * 3) * 0.012;
    switch (M.pose) {
      case 'wave':
        p.rh = { x: -0.3 + Math.sin(t * 9) * 0.07, y: 1.42 }; p.face = 'grin'; break;
      case 'cheer': {
        const j = Math.abs(Math.sin(M.poseT * 7));
        p.lift = j * 0.12; p.rh = { x: -0.33, y: 1.42 }; p.gh = { x: 0.33, y: 1.4 }; p.face = 'grin';
        p.fL.y = j * 0.05; p.fR.y = j * 0.05;
        if (M.poseT > 1.3 && G.phase !== 'over') setPose('idle');
        break;
      }
      case 'cheerSmall':
        p.rh = { x: -0.33, y: 1.4 }; p.face = 'grin';
        if (M.poseT > 1.2) setPose('idle');
        break;
      case 'shuffle': {
        const ph = M.runPh;
        p.fL = { x: -0.13 + Math.sin(ph) * 0.04, y: Math.max(0, Math.sin(ph)) * 0.07 };
        p.fR = { x: 0.13 + Math.sin(ph) * 0.04, y: Math.max(0, -Math.sin(ph)) * 0.07 };
        p.gh = { x: 0.2, y: 0.72 }; break;
      }
      case 'windup': {
        const u = clamp(M.poseT / M.windDur, 0, 1);
        p.ballHand = true; p.ballGlove = false; p.face = 'focus';
        if (u < 0.35) { const k = u / 0.35; p.rh = lp({ x: -0.12, y: 0.82 }, { x: -0.04, y: 0.9 }, k); p.gh = { x: 0.1, y: 0.9 }; }
        else if (u < 0.8) {
          const k = ease((u - 0.35) / 0.45);
          p.rh = lp({ x: -0.04, y: 0.9 }, { x: -0.43, y: 1.32 }, k);
          p.gh = lp({ x: 0.1, y: 0.9 }, { x: 0.38, y: 1.05 }, k);
          p.fR = { x: 0.11 + 0.04 * k, y: 0.22 * Math.sin(k * Math.PI) };
          p.rot = -0.12 * k;
        } else {
          const k = (u - 0.8) / 0.2;
          p.rh = lp({ x: -0.43, y: 1.32 }, { x: 0.02, y: 1.02 }, k);
          p.gh = lp({ x: 0.38, y: 1.05 }, { x: 0.26, y: 0.7 }, k);
          p.rot = -0.12 + 0.22 * k; p.fR = { x: 0.15 + 0.05 * k, y: 0 };
        }
        break;
      }
      case 'follow': {
        const k = ease(clamp(M.poseT / 0.4, 0, 1));
        p.rh = lp({ x: 0.04, y: 1.0 }, { x: 0.12, y: 0.5 }, k); p.rot = 0.1 * (1 - k);
        p.gh = lp({ x: 0.26, y: 0.7 }, { x: 0.2, y: 0.7 }, k);
        if (M.poseT > 0.6) setPose('watch');
        break;
      }
      case 'watch':
        p.gh = { x: 0.2, y: 0.7 + bob }; p.face = 'o'; break;
      case 'ready':
        if (D) {
          /* 대결: 상대가 실제로 든 글러브 높이를 보여 준다 — 과녁을 고를 단서다 */
          p.gh = { x: 0.24, y: clamp(D.opp.gy, 0.35, 1.9) }; p.rh = { x: -0.26, y: 0.6 }; p.face = 'focus';
          if (D.opp.gy < 0.7) p.crouch = clamp((0.7 - D.opp.gy) / 0.5, 0, 1);
        } else { p.gh = { x: 0.24, y: 0.98 + bob }; p.rh = { x: -0.26, y: 0.6 }; p.face = 'grin'; }
        break;
      case 'track': {
        const rem = B.launch + B.dur - G.t;
        const tg = M.catchLocal;
        if (M.judge === 'dive') {
          const d = ease(clamp(1 - rem / 0.4, 0, 1));
          p.rot = M.dir * 1.2 * d; p.offX = M.dir * 0.6 * d;
          p.gh = { x: M.dir * 0.15, y: lerp(1.05, 1.5, d) }; p.face = 'o';
          p.fL.y = d * 0.1;
        } else if (M.judge === 'jump') {
          const d = clamp(1 - rem / 0.45, 0, 1);
          p.lift = Math.sin(d * Math.PI * 0.5) * clamp(B.target.y - 1.75, 0.25, 0.9);
          p.gh = { x: tg.x, y: Math.min(1.85, B.target.y - p.lift) }; p.face = 'o';
          p.fL.y = 0.12 * d; p.fR.y = 0.08 * d;
        } else {
          const k = ease(clamp(1 - rem / (B.dur * 0.8), 0, 1));
          p.gh = lp({ x: 0.24, y: 0.98 }, tg, k); p.face = 'smile';
          if (Math.abs(tg.x) > 0.45) p.offX = Math.sign(tg.x) * 0.15 * k;
        }
        break;
      }
      case 'caught': {
        const k = ease(clamp((M.poseT - 0.15) / 0.35, 0, 1));
        p.gh = lp(M.catchLocal, { x: 0.2, y: 0.72 }, k); p.gloveClosed = 1 - k * 0.6; p.face = 'grin';
        break;
      }
      case 'diveHold': {
        const d = 1 - ease(clamp((M.poseT - 0.5) / 0.5, 0, 1));
        p.rot = M.dir * 1.2 * d; p.offX = M.dir * 0.6 * d;
        p.gh = { x: M.dir * 0.15, y: lerp(0.9, 1.5, d) }; p.gloveClosed = 1; p.face = d > 0.5 ? 'o' : 'grin';
        break;
      }
      case 'jumpLand': {
        const k = clamp(M.poseT / 0.3, 0, 1);
        p.lift = (1 - k) * 0.3; p.gh = lp({ x: M.catchLocal.x, y: 1.8 }, { x: 0.2, y: 0.72 }, ease(k)); p.gloveClosed = 1; p.face = 'grin';
        break;
      }
      case 'oops':
        p.face = 'oops'; p.rh = { x: -0.13, y: 1.28 }; p.gh = { x: 0.25, y: 0.72 }; break;
      case 'runAway':
      case 'runBack': {
        const ph = M.runPh;
        p.fL = { x: -0.1, y: Math.max(0, Math.sin(ph)) * 0.16 };
        p.fR = { x: 0.1, y: Math.max(0, -Math.sin(ph)) * 0.16 };
        p.rh = { x: -0.3, y: 0.75 + Math.sin(ph) * 0.12 };
        p.gh = { x: 0.3, y: 0.78 - Math.sin(ph) * 0.12 };
        p.lift = Math.abs(Math.sin(ph)) * 0.04;
        if (M.pose === 'runBack') { p.ballHand = true; p.ballGlove = false; p.face = 'grin'; }
        break;
      }
      default:
        p.gh = { x: 0.2, y: 0.7 + bob };
    }
    if (D && G.phase === 'oppHold' && inGlove) { p.face = 'focus'; p.gh = { x: 0.12, y: 0.86 }; p.rh = { x: -0.05, y: 0.86 }; }
    return p;
  }
  function playerPose() {
    const p = basePose();
    p.crouch = P.crouch; p.lift = P.lift;
    p.fL = { x: -0.11 - P.crouch * 0.09, y: 0 };
    p.fR = { x: 0.11 + P.crouch * 0.09, y: 0 };
    p.rh = { x: 0.28, y: 0.56 - P.crouch * 0.12 };
    const mv = Math.min(1, Math.abs(P.bodyV) * 0.7);
    if (mv > 0.05 && P.lift < 0.05) {
      p.fL.y = Math.max(0, Math.sin(P.runPh)) * 0.13 * mv;
      p.fR.y = Math.max(0, -Math.sin(P.runPh)) * 0.13 * mv;
      p.rh.y += Math.sin(P.runPh) * 0.06 * mv;
    }
    if (P.lift > 0.03) { p.fL.y = Math.min(0.12, P.lift * 0.3); p.fR.y = Math.min(0.16, P.lift * 0.4); }
    if (P.throwT >= 0) {
      const u = P.throwT;
      if (u < 0.1) p.rh = lp({ x: 0.28, y: 0.56 }, { x: 0.0, y: 0.95 }, u / 0.1);
      else if (u < 0.22) p.rh = lp({ x: 0.0, y: 0.95 }, { x: 0.42, y: 1.32 }, ease((u - 0.1) / 0.12));
      else if (u < 0.3) p.rh = lp({ x: 0.42, y: 1.32 }, { x: 0.1, y: 1.42 }, (u - 0.22) / 0.08);
      else p.rh = lp({ x: 0.1, y: 1.42 }, { x: -0.08, y: 0.7 }, ease(clamp((u - 0.3) / 0.22, 0, 1)));
      p.ballHand = u > 0.08 && u < 0.27;
    }
    return p;
  }

  /* ---------- 효과 ---------- */
  const fx = { parts: [], pops: [], rings: [], confetti: [] };
  function burst(x, y, n, cols, spd, kind) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(0.35, 1) * spd;
      fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.25, life: rand(0.35, 0.65), max: 0.6,
        r: kind === 'puff' ? rand(5, 10) : rand(4, 8), col: pick(cols), kind, rot: rand(0, TAU) });
    }
  }
  function popText(text, x, y, col, size, life) {
    fx.pops.push({ text, x: clamp(x, 70, W - 70), y, col, size, life, max: life });
  }
  function confettiBurst() {
    const cols = ['#e23b2e', '#ffd84a', '#2f6fe0', '#7cff6b', '#ffffff', '#ff8ad8'];
    for (let i = 0; i < 90; i++) {
      fx.confetti.push({ x: rand(0, W), y: rand(-H * 0.3, -10), vx: rand(-40, 40), vy: rand(80, 220), rot: rand(0, TAU), vr: rand(-8, 8),
        w: rand(6, 11), h: rand(3, 6), col: pick(cols), life: 3.2 });
    }
  }
  function updateFx(dt) {
    for (const q of fx.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.kind === 'puff' ? 60 : 420) * dt; q.vx *= 0.96; q.rot += dt * 6; }
    fx.parts = fx.parts.filter((q) => q.life > 0);
    for (const q of fx.pops) { q.life -= dt; q.y -= dt * 40; }
    fx.pops = fx.pops.filter((q) => q.life > 0);
    for (const q of fx.rings) { q.life -= dt; q.r += q.vr * dt; }
    fx.rings = fx.rings.filter((q) => q.life > 0);
    for (const q of fx.confetti) { q.life -= dt; q.x += (q.vx + Math.sin(q.rot) * 30) * dt; q.y += q.vy * dt; q.rot += q.vr * dt; }
    fx.confetti = fx.confetti.filter((q) => q.life > 0 && q.y < H + 20);
  }
  let shaking = false;
  function shake(mag, dur) { G.shakeMag = mag; G.shakeT = dur; }
  function updateShake(dt) {
    if (G.shakeT > 0) {
      G.shakeT -= dt;
      const m = G.shakeMag * Math.max(0, G.shakeT) / 0.2;
      cvs.style.transform = `translate(${rand(-m, m).toFixed(1)}px,${rand(-m, m).toFixed(1)}px)`;
      shaking = true;
    } else if (shaking) { cvs.style.transform = ''; shaking = false; }
  }
  function vibrate(p) {
    try {
      const ua = navigator.userActivation;
      if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(p);
    } catch (e) { /* 막힌 환경 */ }
  }

  /* ---------- 렌더 ---------- */
  const clouds = [{ x: 0.08, y: 0.32, s: 1.0, v: 7 }, { x: 0.5, y: 0.2, s: 0.72, v: 5 }, { x: 0.82, y: 0.48, s: 1.15, v: 9 }, { x: 0.32, y: 0.62, s: 0.6, v: 4 }];
  let titleRect = null;
  function drawClouds() {
    const hz = horizonY();
    const k = clamp(Math.min(W, 1000) / 640, 0.7, 1.4);
    for (const cl of clouds) {
      const w = 200 * cl.s * k, h = w * 160 / 360;
      const span = W + w * 2;
      const x = ((cl.x * span + G.t * cl.v) % span) - w;
      ctx.drawImage(cloudSpr, x, hz * cl.y - h / 2, w, h);
    }
  }
  const ballVisible = () => B.state === 'flight' || B.state === 'free' || B.state === 'atGlove' || B.state === 'hang';
  function drawBallShadow() {
    if (!ballVisible()) return;
    const p = proj(B.pos.x, 0, B.pos.z);
    if (p.depth < 1.2) return;
    const h = Math.max(0, B.pos.y - BALL_R);
    const r = BALL_R * p.s * 1.25 * (1 + h * 0.12);
    ctx.fillStyle = `rgba(20,50,20,${(0.34 / (1 + h * 0.35)).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, Math.max(1.5, r), Math.max(0.8, r * 0.38), 0, 0, TAU); ctx.fill();
  }
  function drawFlyingBall() {
    const p = proj(B.pos.x, B.pos.y, B.pos.z);
    if (p.depth < 0.9) return;
    const r = Math.max(2.6, BALL_R * p.s);
    for (let i = 0; i < B.trail.length - 1; i++) {
      const q = B.trail[i], a = (i + 1) / B.trail.length;
      ctx.fillStyle = `rgba(255,255,255,${(a * 0.32).toFixed(3)})`;
      circ(ctx, q.x, q.y, q.r * (0.45 + 0.45 * a)); ctx.fill();
    }
    drawBall(ctx, p.x, p.y, r, B.rot);
  }
  function drawPartner() {
    const mp = proj(M.x, 0, M.z);
    const p = partnerPose(G.t);
    const team = TEAMS[G.team].partner;
    if (M.pose === 'runAway') {
      drawKidBack(ctx, mp.x, mp.y, mp.s, team, p, { x: mp.x - 0.34 * mp.s, y: mp.y - 0.8 * mp.s, u: 0.34 * mp.s, rot: 0.25, closed: 0, ball: false }, G.t, HAIR_M);
      M.glove = null;
    } else {
      M.glove = drawKidFront(ctx, mp.x, mp.y, mp.s, team, p, G.t, HAIR_M, false);
    }
    M.head = { x: mp.x + p.offX * mp.s, y: mp.y - (1.62 + p.lift) * mp.s };
    if (D && G.phase !== 'title') {
      /* 상대 이름표 */
      const fs = portrait ? 12 : 13;
      ctx.font = `${fs}px "Jua","Black Han Sans",sans-serif`;
      const name = D.oppName.length > 8 ? D.oppName.slice(0, 8) + '…' : D.oppName;
      const w = ctx.measureText(name).width + 14;
      const x = clamp(mp.x - w / 2, 4, W - w - 4), y = mp.y + 6;
      rr(ctx, x, y, w, fs + 8, 6); ctx.fillStyle = 'rgba(21,48,75,.82)'; ctx.fill();
      ctx.fillStyle = '#fffaf0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name, x + w / 2, y + (fs + 8) / 2 + 1);
    }
  }
  function drawPlayer() {
    const feet = proj(P.bodyX, 0, 0);
    const gp = proj(P.gx, P.gy, GLOVE_Z);
    const low = clamp((0.8 - P.gy) / 0.45, 0, 1);
    const rot = -low * 2.5 + clamp((P.gx - (P.bodyX - 0.36)) * 0.5, -0.4, 0.4);
    const glove = { x: gp.x, y: gp.y, u: 0.4 * gp.s, rot, closed: P.glove, ball: B.state === 'player' && !(P.throwT > 0.08) };
    drawKidBack(ctx, feet.x, feet.y, feet.s, G.team, playerPose(), glove, G.t, HAIR_P);
  }
  function drawGuides() {
    if (G.phase === 'windup' || G.phase === 'flying' || G.phase === 'reposition' || G.phase === 'oppHold') {
      const gp = proj(P.gx, P.gy, GLOVE_Z);
      const R = catchR();
      let inPos = false, rem = 9;
      if (G.phase === 'flying' && (B.state === 'flight' || B.state === 'atGlove') && B.toPlayer) {
        rem = B.arriveAt - G.t;
        const tg = B.target;
        inPos = Math.hypot(tg.x - P.gx, tg.y - P.gy) <= R;
        /* 쉬움은 처음부터 끝까지 링을 보여 주고, 어려움은 마지막 0.6초에만 보여 준다 */
        const showFrom = G.diff === 'easy' ? 99 : G.diff === 'hard' ? 0.6 : (!D && G.score < 6 ? 99 : 0.95);
        if (rem < showFrom && !B.wild) {
          const p = proj(tg.x, tg.y, GLOVE_Z);
          const rb = BALL_R * p.s * 1.3 + 3;
          const k = clamp(rem / 0.9, 0, 1);
          const timing = rem <= EARLY;
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(21,48,75,.55)'; circ(ctx, p.x, p.y, rb + 1.5); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; circ(ctx, p.x, p.y, rb); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p.x - rb * 0.5, p.y); ctx.lineTo(p.x + rb * 0.5, p.y); ctx.moveTo(p.x, p.y - rb * 0.5); ctx.lineTo(p.x, p.y + rb * 0.5); ctx.stroke();
          const r2 = rb + k * R * p.s * 2.2;
          ctx.globalAlpha = 0.45 + 0.55 * (1 - k);
          ctx.lineWidth = 4; ctx.strokeStyle = timing ? '#7cff6b' : '#ffffff';
          circ(ctx, p.x, p.y, r2); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      const good = inPos && rem <= EARLY && rem > -LATE;
      ctx.setLineDash([7, 6]); ctx.lineWidth = good ? 4 : 2.5;
      ctx.strokeStyle = good ? '#7cff6b' : inPos ? 'rgba(124,255,107,.85)' : 'rgba(255,255,255,.6)';
      circ(ctx, gp.x, gp.y, R * gp.s); ctx.stroke(); ctx.setLineDash([]);
      if (good) {
        ctx.fillStyle = 'rgba(124,255,107,.18)'; circ(ctx, gp.x, gp.y, R * gp.s); ctx.fill();
        if (G.diff === 'easy' || (G.diff === 'normal' && (D || G.score < 15))) outlinedText('지금!', gp.x, gp.y - R * gp.s - 14, '#7cff6b', 26);
      }
    } else if (G.phase === 'holding') {
      const z = M.z - 0.25;
      const q = judgeThrow(A.x, A.y);
      const col = { nice: '#7cff6b', ok: '#fff27a', dive: '#ffb84a', jump: '#ffb84a', miss: '#ff6b5e' }[q];
      const hand = { x: P.bodyX + 0.22, y: 1.5 + P.lift, z: 0.2 };
      const sg = mkSeg(hand, { x: A.x, y: A.y, z }, 0.8, 6.5);
      for (let i = 2; i <= 13; i++) {
        const tau = sg.T * i / 14;
        const pp = proj(sg.p0.x + sg.v.x * tau, sg.p0.y + sg.v.y * tau - 3.25 * tau * tau, sg.p0.z + sg.v.z * tau);
        ctx.fillStyle = `rgba(255,255,255,${(0.75 - i * 0.03).toFixed(2)})`;
        circ(ctx, pp.x, pp.y, Math.max(1.6, 0.045 * pp.s)); ctx.fill();
      }
      const p = proj(A.x, A.y, z);
      const r = Math.max(9, 0.24 * p.s);
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(21,48,75,.6)'; circ(ctx, p.x, p.y, r); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = col; circ(ctx, p.x, p.y, r); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x - r * 1.6, p.y); ctx.lineTo(p.x - r * 0.5, p.y); ctx.moveTo(p.x + r * 0.5, p.y); ctx.lineTo(p.x + r * 1.6, p.y);
      ctx.moveTo(p.x, p.y - r * 1.6); ctx.lineTo(p.x, p.y - r * 0.5); ctx.moveTo(p.x, p.y + r * 0.5); ctx.lineTo(p.x, p.y + r * 1.6);
      ctx.stroke();
      ctx.fillStyle = col; circ(ctx, p.x, p.y, 2.5); ctx.fill();
      if (D) {
        const left = Math.ceil(HOLD_LIMIT - G.phaseT);
        if (left <= 5) outlinedText(String(Math.max(0, left)), p.x, p.y - r - 20, '#ffd84a', 24);
        if (q === 'miss') outlinedText('악송구!', p.x, p.y + r + 18, '#ff6b5e', 18);
      }
    } else if (G.phase === 'awaitResult' && M.glove) {
      outlinedText('...', M.glove.x, M.glove.y - 26, '#ffffff', 22);
    }
  }
  function outlinedText(text, x, y, col, size) {
    ctx.font = `${size}px "Black Han Sans","Jua",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size * 0.2); ctx.strokeStyle = '#15304b'; ctx.strokeText(text, x, y);
    ctx.fillStyle = col; ctx.fillText(text, x, y);
  }
  function drawBubble() {
    if (M.sayT <= 0 || !M.head) return;
    const fs = portrait ? 15 : 17;
    ctx.font = `${fs}px "Jua","Black Han Sans",sans-serif`;
    const w = ctx.measureText(M.say).width + 24, h = fs + 15;
    const tipX = M.head.x, tipY = M.head.y - 4;
    const bx = clamp(tipX - w / 2, 8, W - w - 8), by = tipY - h - 9;
    ctx.globalAlpha = Math.min(1, M.sayT * 5);
    rr(ctx, bx, by, w, h, h / 2);
    ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#15304b'; ctx.stroke();
    const tx = clamp(tipX, bx + 14, bx + w - 14);
    ctx.beginPath(); ctx.moveTo(tx - 7, by + h - 1.5); ctx.lineTo(tx, by + h + 8); ctx.lineTo(tx + 7, by + h - 1.5); ctx.closePath();
    ctx.fillStyle = '#fffaf0'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx - 7, by + h); ctx.lineTo(tx, by + h + 8); ctx.lineTo(tx + 7, by + h); ctx.stroke();
    ctx.fillStyle = '#15304b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(M.say, bx + w / 2, by + h / 2 + 1);
    ctx.globalAlpha = 1;
  }
  function star(c, x, y, r, rot) {
    c.beginPath();
    for (let i = 0; i < 8; i++) { const rad = i % 2 ? r * 0.42 : r; const a = rot + i * Math.PI / 4; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    c.closePath();
  }
  function drawFx() {
    for (const q of fx.rings) {
      ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.lineWidth = 4; ctx.strokeStyle = q.col;
      circ(ctx, q.x, q.y, q.r); ctx.stroke();
    }
    for (const q of fx.parts) {
      const a = Math.max(0, Math.min(1, q.life / q.max * 1.4));
      ctx.globalAlpha = a; ctx.fillStyle = q.col;
      if (q.kind === 'star') { star(ctx, q.x, q.y, q.r, q.rot); ctx.fill(); }
      else { circ(ctx, q.x, q.y, q.r * (1.4 - a * 0.4)); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    for (const q of fx.pops) {
      const age = q.max - q.life;
      const sc = age < 0.12 ? 1.5 - age / 0.12 * 0.5 : 1;
      ctx.globalAlpha = Math.min(1, q.life / (q.max * 0.3));
      ctx.font = `${q.size}px "Black Han Sans","Jua",sans-serif`;
      const half = ctx.measureText(q.text).width / 2 * sc + 10;
      ctx.save(); ctx.translate(clamp(q.x, half, Math.max(half, W - half)), q.y); ctx.scale(sc, sc);
      outlinedText(q.text, 0, 0, q.col, q.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const q of fx.confetti) {
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.col;
      ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h * Math.abs(Math.cos(q.rot * 0.7)) + 1); ctx.restore();
    }
  }
  function drawTitleKid() {
    if (!titleRect) {
      const a = $('stage').getBoundingClientRect(), b = root.getBoundingClientRect();
      titleRect = { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height, bottom: a.bottom - b.top };
    }
    const r = titleRect;
    if (r.height < 40) return;
    const S = Math.min(r.height * 0.86 / 1.62, r.width * 0.55 / 0.9);
    const fx0 = r.left + r.width / 2, fy0 = r.bottom - Math.max(6, r.height * 0.04);
    const t = G.t;
    const k = Math.pow((Math.sin(t * 6.5) + 1) / 2, 3);
    const p = basePose();
    p.fL = { x: -0.13, y: 0 }; p.fR = { x: 0.13, y: 0 };
    p.rh = { x: lerp(-0.14, 0.08, k), y: lerp(0.66, 0.72, k) };
    p.gh = { x: 0.2, y: 0.7 };
    p.gloveClosed = 0.18 * k; p.ballHand = true;
    p.face = (t % 5) > 4.2 ? 'grin' : 'smile';
    p.lift = Math.abs(Math.sin(t * 3.25)) * 0.015;
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.ellipse(fx0, fy0, 0.75 * S, 0.17 * S, 0, 0, TAU); ctx.fill();
    drawKidFront(ctx, fx0, fy0, S, G.team, p, t, HAIR_P, true);
  }
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.drawImage(skyL, 0, 0, W, H);
    drawClouds();
    ctx.drawImage(groundL, 0, 0, W, H);
    if (G.phase === 'title') { drawTitleKid(); return; }
    drawPartner();
    drawBallShadow();
    const front = B.pos.z <= 0.05;
    if (ballVisible() && !front) drawFlyingBall();
    drawPlayer();
    if (ballVisible() && front) drawFlyingBall();
    drawGuides();
    drawFx();
    drawBubble();
  }

  /* ---------- HUD · 안내 ---------- */
  const hud = {
    score(bump) {
      const el = $('score'); el.textContent = G.score;
      $('best').textContent = Math.max(G.best, G.score);
      $('bestDiffHud').textContent = DF().label;
      if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    },
    lives(lost) {
      const box = $('lives');
      if (box.children.length !== 3) box.innerHTML = BALL_SVG + BALL_SVG + BALL_SVG;
      [...box.children].forEach((n, i) => {
        const off = i >= G.lives;
        if (lost && off && !n.classList.contains('lost')) { n.classList.add('pop'); later(() => n.classList.remove('pop'), 600); }
        n.classList.toggle('lost', off);
      });
      box.setAttribute('aria-label', `남은 공 ${G.lives}개`);
    },
    level() {
      if (D) { $('level').innerHTML = `<b>${DF().label}</b>랠리 ${D.rally}`; return; }
      const lv = levelOf(G.score); $('level').innerHTML = `<b>Lv.${lv + 1}</b>${LEVELS[lv]}`;
    },
    combo() {
      const el = $('combo');
      el.textContent = G.combo >= 2 ? `${G.combo} 연속 캐치!` : '';
      el.classList.toggle('hot', G.combo >= 10);
    },
    opp() {
      if (!D) return;
      $('oppname').textContent = D.oppName;
      $('oppscore').textContent = `${D.opp.score}개`;
      const box = $('opplives');
      if (box.children.length !== 3) box.innerHTML = BALL_SVG + BALL_SVG + BALL_SVG;
      [...box.children].forEach((n, i) => n.classList.toggle('lost', i >= D.opp.lives));
    },
  };
  let btnState = '';
  function syncButtons() {
    const catchOn = ['windup', 'flying', 'reposition', 'oppHold'].includes(G.phase) && B.state !== 'player';
    const catchReady = G.phase === 'flying';
    const throwOn = G.phase === 'holding';
    const s = `${catchOn}${catchReady}${throwOn}`;
    if (s === btnState) return;
    btnState = s;
    const c = $('catchBtn'), t = $('throwBtn');
    c.classList.toggle('off', !catchOn); c.classList.toggle('ready', catchReady);
    t.classList.toggle('off', !throwOn); t.classList.toggle('ready', throwOn);
    $('speeds').hidden = !throwOn;
  }
  let hintTimer = 0;
  function showHint(text, sec) {
    const el = $('hint');
    el.textContent = text; el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(hintTimer); timers.delete(hintTimer);
    hintTimer = later(() => { el.hidden = true; }, sec * 1000);
  }
  function tutorial(key, text) {
    if (G.tut[key]) return;
    G.tut[key] = true;
    showHint(text, 3.2);
  }
  let bannerTimer = 0;
  function banner(main, sub) {
    const el = $('banner');
    $('bmain').textContent = main;
    $('bsub').textContent = sub || ''; $('bsub').hidden = !sub;
    el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bannerTimer); timers.delete(bannerTimer);
    bannerTimer = later(() => { el.hidden = true; el.classList.remove('show'); }, 1850);
  }

  /* ---------- 일시정지 (대결은 기권을 묻는다) ---------- */
  function requestPause() {
    if (G.phase === 'title') { exit('leave'); return; }
    if (G.phase === 'over') { if (D) exit('leave'); else goTitle(); return; }
    if (G.phase === 'vs') return;
    togglePause();
  }
  function togglePause() {
    if (!isPlaying()) return;
    if (D) {
      /* 대결은 멈추지 않는다 — 상대 화면은 계속 돈다. 기권할지만 묻는다 */
      const show = $('pauseBox').hidden;
      $('pauseTitle').textContent = '기권하고 나갈까요?';
      $('resume').textContent = '계속하기';
      $('quit').textContent = '기권하기';
      $('pauseBox').hidden = !show;
      if (show) $('resume').focus({ preventScroll: true });
      return;
    }
    G.paused = !G.paused;
    $('pauseBox').hidden = !G.paused;
    if (G.paused) $('resume').focus({ preventScroll: true });
    else last = performance.now();
  }
  function exit(kind) {
    try { opts.onExit?.(kind); } catch (e) { /* 무시 */ }
  }

  /* ---------- DOM 연결 ---------- */
  function setTeam(key) {
    if (!TEAMS[key]) return;
    G.team = key; local.set('team', key);
    root.querySelectorAll('.cb-sw').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.team === key)));
    try { opts.onTeam?.(key); } catch (e) { /* 무시 */ }
  }
  root.querySelectorAll('.cb-sw').forEach((b) => on(b, 'click', () => { Snd.init(); Snd.click(); setTeam(b.dataset.team); }));
  on($('start'), 'click', (e) => { e.currentTarget.blur(); startGame(); });
  on($('exitTitle'), 'click', () => exit('leave'));
  if (opts.onDuel) {
    $('duelBtn').hidden = false;
    on($('duelBtn'), 'click', () => { Snd.init(); Snd.click(); try { opts.onDuel(); } catch (e) { /* 무시 */ } });
  }
  if (opts.duelRecord) {
    $('duelRec').hidden = false;
    $('duelWins').textContent = opts.duelRecord.wins | 0;
    $('duelLosses').textContent = opts.duelRecord.losses | 0;
  }
  on($('retry'), 'click', (e) => {
    e.currentTarget.blur();
    if (D) { exit('rematch'); return; }
    startGame();
  });
  on($('home'), 'click', () => {
    Snd.click();
    if (D) { exit('leave'); return; }
    goTitle();
  });
  on($('pause'), 'click', (e) => { e.currentTarget.blur(); Snd.init(); requestPause(); });
  on($('resume'), 'click', (e) => {
    e.currentTarget.blur();
    if (D) { $('pauseBox').hidden = true; return; }
    togglePause();
  });
  on($('quit'), 'click', () => {
    if (D) {
      $('pauseBox').hidden = true;
      if (!D.ended) {
        DUEL.send({ lives: 0, alive: false, done: true });
        D.ended = true; D.win = false; D.reason = 'quit';
      }
      exit('forfeit');
      return;
    }
    G.paused = false; goTitle();
  });
  function syncMute() {
    $('icoSound').hidden = Snd.muted; $('icoMute').hidden = !Snd.muted;
    $('mute').setAttribute('aria-label', Snd.muted ? '소리 켜기' : '소리 끄기');
  }
  on($('mute'), 'click', (e) => {
    e.currentTarget.blur(); Snd.init();
    Snd.muted = !Snd.muted; local.set('muted', Snd.muted); syncMute();
    if (!Snd.muted) Snd.click();
  });
  /* 난이도 (혼자 하기 타이틀) */
  function setDiff(d) {
    if (!DIFFS[d] || D) return;
    G.diff = d; applyDiff();
    root.querySelectorAll('.cb-dbtn').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.diff === d)));
    $('bestDiff').textContent = DF().label; $('bestTitle').textContent = G.best;
    try { opts.onDifficulty?.(d); } catch (e) { /* 무시 */ }
  }
  root.querySelectorAll('.cb-dbtn').forEach((b) => on(b, 'click', () => { Snd.init(); Snd.click(); setDiff(b.dataset.diff); }));
  /* 공 빠르기 (던질 차례에만 보인다) */
  function setSpeed(i) {
    G.speed = clamp(i | 0, 0, 2); local.set('speed', G.speed);
    root.querySelectorAll('.cb-sp').forEach((b) => b.setAttribute('aria-checked', String((b.dataset.sp | 0) === G.speed)));
  }
  root.querySelectorAll('.cb-sp').forEach((b) => on(b, 'pointerdown', (e) => { e.preventDefault(); Snd.init(); Snd.click(); setSpeed(b.dataset.sp | 0); }));
  setSpeed(G.speed);
  if (D) $('diffs').hidden = true;
  else {
    root.querySelectorAll('.cb-dbtn').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.diff === G.diff)));
    $('bestDiff').textContent = DF().label;
  }

  if (fineMouse) $('howto').innerHTML = '마우스로 글러브 이동 · 공이 오면 <b>클릭/스페이스</b>로 잡기 · 잡았으면 <b>한 번 더</b> 눌러 던지기';
  on(window, 'resize', layout);
  on(window, 'orientationchange', () => later(layout, 200));
  on(document, 'visibilitychange', () => {
    if (document.hidden && !D && isPlaying() && !G.paused) togglePause();
  });

  /* ---------- 루프 ---------- */
  let last = performance.now(), raf = 0;
  function frame(now) {
    if (dead) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (G.phase === 'title') { G.t += dt; M.poseT += dt; }
    else if (!G.paused) update(dt);
    render();
    if (G.phase !== 'title') syncButtons();
    raf = requestAnimationFrame(frame);
  }

  buildCloud();
  layout();
  setTeam(G.team);
  syncMute();
  $('bestTitle').textContent = G.best;
  hud.lives(); hud.level();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!dead) layout(); });

  if (D) {
    /* 대결은 타이틀을 건너뛴다 — 대기방에서 이미 레디를 눌렀다 */
    D.startAt = performance.now() + Math.max(0, DUEL.startInMs | 0);
    $('title').hidden = true;
    $('vs').hidden = false;
    $('vsMe').textContent = D.myName;
    $('vsOpp').textContent = D.oppName;
    $('vsRule').textContent = `난이도 ${DF().label} · 공 3개씩 · 놓치면 하나 잃어요 · 빠르기는 던지는 사람이 골라요`;
    $('opp').hidden = false;
    $('bestline').hidden = true;
    hud.opp();
    Object.assign(M, { x: 0, z: PARTNER_Z, tx: 0 });
    setPose('idle');
    B.state = D.iStart ? 'player' : 'partner';
    setPhase('vs');
    hud.score(false);
  } else {
    goTitle();
  }
  raf = requestAnimationFrame((t) => { last = t; frame(t); });

  return {
    requestPause,
    remote,
    dbg: { G, P, B, M, A, D, tryCatch, doThrow, catchR },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      for (const off of offs) off();
      for (const id of timers) clearTimeout(id);
      timers.clear();
      try { Snd.ac && Snd.ac.close(); } catch (e) { /* 무시 */ }
      root.remove();
    },
  };
}
