# 좀비와 드래곤 — 디자인 스타일 시트 (UI 키트 1차 · 2026-11-12)

> 대표님: «어떤 버튼을 눌러도 어떤 페이지가 나와도 통일감».
> 본보기 = **결과 창** (`render/hud.js` resultCard · `iandragon-game.css` «결과 창 새 디자인»).
> 모든 새 창 · 서브 창 · 상점 · 설정은 이 한 장의 규칙과 키트 부품으로만 만든다.

- 모양: `src/styles/idg-kit.css` (`.idg-k-*`)
- 만드는 함수: `src/screens/idgKit.js` (`kit*`)
- 재화 아이콘+숫자: `src/games/iandragon_game/render/money.js` (`money()` · 서브 창 보조 작) 를 키트가 그대로 가져다 씀
- 견본: `tools/idg-kit-sample.html` → `http://127.0.0.1:5320/tools/idg-kit-sample.html`

---

## 1. 기본 원칙

1. **도트(픽셀) 그림이 기본.** 테 · 단추 · 판은 그림(9-slice)으로, CSS 로 둥근 네모를 새로 그리지 않는다 (예외: 보라 평범한 단추).
2. **글씨 = Pretendard 굵게(700~900) + 1px 8방향 딱딱한 외곽선** (`--k-o1`), 큰 글씨 · 단추는 2px (`--k-o2`). 흐린 그림자 · 글로우 금지.
3. **종이 판 위 글씨만 예외**: 짙은 갈색(`--k-ink`), 외곽선 없음.
4. **움직임은 은은하게.** 누르면 1px 내려가고 조금 어두워짐. 투명하게 서서히 사라지는 효과(페이드 아웃) 금지. 반짝 · 통통은 `steps()` 로 딱딱하게.
5. **크기는 em.** `.idg-k` 의 `--k-fs` 하나(세로 `clamp(14px, 3.9vw, 18px)` · 가로 `clamp(13px, 3.4vh, 18px)`)가 전체 크기를 정한다. px 고정 금지.

## 2. 색

| 변수 | 값 | 쓰는 곳 |
|---|---|---|
| `--k-o` | `#2a1238` | 글씨 외곽선 · 부품 바깥 테 |
| `--k-gold` | `#d9a441` | 금테 · 칸막이 |
| `--k-gold-hi` | `#ffd45a` | 금 강조 글씨 · 소제목 · 금화 숫자 |
| `--k-bg` | `#2a1f45` | 창 바탕 |
| `--k-bg2` | `#1d1233` | 판 속 어두운 칸 |
| `--k-purple` / `--k-purple2` / `--k-purple-b` | `#57458c` / `#44356e` / `#8e7bcc` | 평범한 단추 위 · 아래 · 테 |
| `--k-text` / `--k-sub` / `--k-mute` | `#fff` / `#e6dcff` / `#b3a3dc` | 본문 / 보조 / 흐림(잠김 · 꺼짐) |
| `--k-good` / `--k-bad` | `#8af06a` / `#ff8f7f` | 좋음 · 켜짐 / 모자람 · 경고 |
| `--k-coin` / `--k-gem` | `#ffd45a` / `#f0b8ff` | 금화 숫자 / 젬 숫자 |
| `--k-ink` / `--k-ink2` | `#4a2c12` / `#7a4f22` | 종이 판 위 글씨 / 보조 |

## 3. 글씨 크기 단계 (5단계만)

| 클래스 | 크기 | 굵기 · 외곽선 | 쓰는 곳 |
|---|---|---|---|
| `.idg-k-t1` | 1.6em | 900 · 2px | 큰 제목 · 큰 숫자 |
| `.idg-k-t2` | 1.25em | 900 · 2px | 소제목 · 단추 글씨 |
| `.idg-k-t3` | 1em | 800 · 1px | 본문 · 목록 이름 |
| `.idg-k-t4` | .85em | 700 · 1px · `--k-sub` | 보조 설명 |
| `.idg-k-t5` | .72em | 700 · 1px · `--k-mute` | 아주 작은 꼬리 글 |
| `.idg-k-sec` | 1.1em | 900 · 금색 | 목록 묶음 소제목 («모자») |
| `.idg-k-title` | 1.3em | 900 · 짙은 빨강 2px | 창 머리 현판 |

## 4. 창 구조 — 항상 이 순서

```
┌ 호박 창 테 (ai/lobby/dialog9.webp · slice 104 100)  .idg-k-win
│   [현판] 빨간 리본 (ai/lobby/ribbon.webp · slice 30 72)   .idg-k-win-head > .idg-k-title  (+ 오른쪽 작은 X : 단추 줄이 없을 때만)
│   [지갑 판] 상점이면 맨 위에 «내 보유량»                    .idg-k-wallet
│   [탭]                                                      .idg-k-tabs
│   [종이 안내 판] 안내 · 도움말 글                           .idg-k-paper
│   [본문] 목록 줄 · 스크롤 목록 상자                         .idg-k-win-body > .idg-k-row / .idg-k-scroll
│   [단추 줄] 큰 단추(빨강 · 초록) → 아래 작은 보라 단추      .idg-k-win-foot
└
```

- 닫는 방법은 **하나만**: 단추 줄에 보라 «닫기» 가 있으면 X 를 붙이지 않는다 (`kitWin` 이 자동 판단).
- 창 너비: 세로 `min(94vw, 34em)` · 가로 `min(92vw, 44em)`. 본문이 넘치면 본문만 스크롤.

## 5. 단추 — 언제 무엇

| 종류 | 클래스 · 함수 | 그림 | 언제 |
|---|---|---|---|
| 빨강 큰 단추 | `.idg-k-btn.red` · `kitBtn({kind:'red'})` | `ai/result/btn_red3.webp` (slice 92 140) | **앞으로 가는 주 행동** 하나: 전투 개시 · 시작 · 도전 |
| 초록 큰 단추 | `.idg-k-btn.green` · `kitBtn({kind:'green'})` | `ai/result/btn_green3.webp` (slice 92 140) | 좋은 일: 강화 · 받기 · 사기 · 확인 |
| 가격 단추 | `.idg-k-btn.price` · `kitPriceBtn({coin\|gem, label?, wide?})` | 초록(또는 빨강) 큰 단추 + 재화 아이콘+숫자 | 무언가를 살 때 **항상** |
| 보라 평범한 단추 | `.idg-k-btn.purple` · `kitBtn({kind:'purple'})` | CSS (결과 창 «다시하기 · 나가기» 와 같음) | 보조: 다시 · 닫기 · 나가기 · 뒤로 |
| 작은 닫기 X | `.idg-k-close` · `kitClose()` | `ai/kit/btn_close.webp` | 현판 오른쪽 (단추 줄이 없을 때) |

- 한 창에 빨강은 하나만. 크기 `.sm`(목록 줄 안) · `.wide`(가로 꽉).
- 단추 아이콘은 글씨 **왼쪽**, `.ico` (결과 창 아이콘 `ai/result/ico_*`).
- 모자람: `kitPriceBtn({poor:true})` → 숫자 빨강 · 단추 회색 · 눌리지 않음.
- 노란 네모 단추 · 글자만 있는 단추 금지.

## 6. 재화 — 항상 그림 + 숫자

- **글자 «금화» «코인» «젬» 을 화면에 쓰지 않는다.** 언제나 `[금화 그림] 14,799` · `[젬 그림] 390`.
  (화면 읽기 프로그램용 이름은 그림 `alt` · `aria-label` 에만)
- 그림: `ai/ui/coin.svg`(정원 금화) · `ai/ui/gem.svg`(우리 젬). 함수: `kitCoin(n)` · `kitGem(n)` (= `money()`), 보상은 `{sign:'+'}`, 작은 알약은 `{pill:true}`.
- **상점 · 부화장 맨 위에는 «내 보유량» 지갑 판** `kitWallet({coins, gems})` — 금화 | 젬 한 판, 값이 바뀌면 `.update({coins, gems})`.
- 숫자는 천 단위 쉼표 (`kitFmt`).

## 7. 안내 글 — 항상 종이 판

- 규칙 · 도움말 · «~하면 열려요» 같은 안내 문장은 **옛날 종이(양피지) 판** `kitPaper([...])` (`.idg-k-paper`, `ai/kit/paper.webp` slice 34) 위에.
- 글씨 짙은 갈색, 강조는 `<b>`(짙은 주홍), 둘째 줄은 `<small>`. 창 바탕에 안내 글을 맨글씨로 늘어놓지 않는다.

## 8. 토글 · 체크 · 슬라이더 · 탭 · 목록

| 부품 | 함수 | 클래스 | 그림 | 접근성 |
|---|---|---|---|---|
| 토글 | `kitToggle({on, onChange, label})` · `.set(v)` | `.idg-k-toggle` | `kit/toggle_on` 초록 · `kit/toggle_off` 회보라 | `role=switch` `aria-checked` |
| 체크 | `kitCheck({on, onChange, label})` | `.idg-k-check` (+ `.idg-k-checkline`) | `kit/check_on` · `kit/check_off` | `role=checkbox` |
| 슬라이더 | `kitSlider({value, min, max, step, onInput, onChange, label})` · `.set(v)` | `.idg-k-slider` | `kit/slider_groove`(30) · `kit/slider_fill`(32) · `kit/slider_knob` | 진짜 `input[type=range]` |
| 탭 (보라) | `kitTabs({tabs:[{id,label,icon?}], value, onPick})` · `.set(id)` | `.idg-k-tabs` `.idg-k-tab` | `kit/tab_on` · `kit/tab_off` (36) | `role=tablist/tab` `aria-selected` · ←→ 키 |
| 탭 (고풍 · 상점) | `kitTabs({..., old:true})` | `.idg-k-tabs.old` | `kit/tab2_on` 빨간 비단 · `kit/tab2_off` (42) | 같음 |
| 목록 줄 | `kitRow({icon, title, sub, right, hi, locked, onClick})` | `.idg-k-row` (`.hi` `.locked`) | `kit/row2` · `kit/row2_hi` (14) — 11/12 바깥 보라 테 없앤 판 | `role=group` / 누르면 button |
| 게이지 | `kitGauge({value, max, color, size, floor, label})` · `.set(v, max?)` | `.idg-k-gauge` (`.green` `.orange` `.gold` `.red` `.blue` `.purple` · `.sm` `.lg`) | `kit/gauge` (16) 금테 홈 · 양 끝 마감 + CSS 채움 3단 · 끝 1px 마감선 | `role=progressbar` `aria-valuenow/max` |
| 소제목 | `kitSection('모자')` | `.idg-k-sec` | — | `h3` |
| 스크롤 목록 상자 | `kitScroll(rows, {height:'16em'})` · `.inner` `.refresh()` | `.idg-k-scroll` (`.more`) | `kit/scroll_edge` 위아래 · `kit/more_arrow` 더 있음 | 키보드로 스크롤 (`tabindex=0`) |
| 잠금 | `kitLock()` | `.idg-k-lock` | `lobby/ico_lock.png` | `aria-label=잠김` |
| 알림 점 | `kitBadge(target, on)` | `.idg-k-badge` | `lobby2/alert.webp` | `aria-label=새 소식` |

- 설정 화면 = 목록 줄 하나에 [아이콘] 이름 ……… [토글 또는 슬라이더]. 줄 사이는 `.3em` (row2 는 바깥 테가 없어 줄 사이가 곧 금테 사이).
- 게이지 색 약속 : 체력 초록 · 공격 주황 · 사거리 파랑 · 빠르기 보라 · 진행(아직) 금 · 다 됨 초록. 게임 안 막대는 전부 `kitGauge` (도감 · 파워업 카드 · 도전과제 · 도감 모은 비율). 다른 색은 `color:'#hex'` (밝음 · 어두움 저절로).
- **누르면 다시 그리는 창은 스크롤을 지킨다** : 줄만 바꾸거나(`도전과제`) `kitKeepScroll(node, draw)` 로 감싼다. 로비 창(`.dialog.idg-*`)은 `idgFrame` 이 «누른 순간의 scrollTop» 을 저장했다가 본문이 바뀌면 되살린다(연구소 · 상점 · 꾸미기 포함). 스크롤 칸은 `overflow-anchor: none`.
- 받을 것이 2개 이상인 목록은 맨 위에 초록 `kitPriceBtn({gem: 합계, label: '모두 받기 (n개)', wide: true})`, 받을 수 있는 줄을 맨 위 · 받은 줄을 맨 아래로.
- 상점 화면 = 지갑 판 → 고풍 탭 → 종이 안내 → 소제목 → 스크롤 목록(줄 끝에 가격 단추) → 보라 «닫기».

## 9. 부품 그림 · 9-slice 값

새 그림 = `public/assets/iandragon_game/ai/kit/` (제미나이 flash 1K, 자홍 배경 키잉, 원본 = `iandragon/docs/style_refs/gen/kit_*`).

| 파일 | 크기(px) | slice (위 오른 아래 왼) | CSS |
|---|---|---|---|
| `kit/toggle_on.webp` · `toggle_off.webp` | 293×130 · 291×130 | 통그림 | `.idg-k-toggle` 3.9×1.73em |
| `kit/check_on.webp` · `check_off.webp` | 206×206 · 200×206 | 통그림 | `.idg-k-check` 1.7em |
| `kit/btn_close.webp` | 200×206 | 통그림 | `.idg-k-close` 2.2em |
| `kit/tab_on.webp` · `tab_off.webp` | 610×136 · 603×136 | 36 | `.idg-k-tab` 테 .6em |
| `kit/tab2_on.webp` · `tab2_off.webp` | 636×161 · 636×155 | 42 | `.idg-k-tabs.old` 테 .62em |
| `kit/slider_groove.webp` | 610×84 | 30 | 테 .27em .3em |
| `kit/slider_fill.webp` | 622×90 | 32 | 테 .27em .3em |
| `kit/slider_knob.webp` | 116×116 | 통그림 | 1.45em |
| `kit/row.webp` · `row_hi.webp` | 662×128 · 662×130 | 26 | `.idg-k-row` 테 .55em .6em |
| `kit/paper.webp` | 662×352 | 34 | `.idg-k-paper` 테 .8em .85em |
| `kit/wallet.webp` | 662×122 | 26 60 | `.idg-k-wallet` 테 .52em 1.15em |
| `kit/scroll_edge.webp` | 532×58 | 통그림(가로로 늘림) | `.idg-k-scroll::before/::after` |
| `kit/more_arrow.webp` | 84×64 | 통그림 | `.idg-k-more` |
| `kit/row2.webp` · `row2_hi.webp` (11/12) | 638×105 · 638×107 | 14 | `.idg-k-row` 테 .3em .32em (row · row_hi 에서 바깥 보라 테를 잘라 냄 · `tools/_kit2-make.py`) |
| `kit/gauge.webp` (11/12) | 160×56 (원본 40×14 ×4) | 16 | `.idg-k-gauge` 높이 1em · 테 .286em (`tools/_kit2-make.py` 로 직접 그림) |
| `kit/cx_card.webp` · `cx_card_off.webp` (11/12) | 278×366 | 통그림 / 9-slice 44 | 도감 카드(금테 · 미수집 은테) · 도감 자세히 판 · 배경 카드 (제미나이 `cx_card2_403`) |

재사용 (새로 안 그림):

| 파일 | slice | 쓰는 곳 |
|---|---|---|
| `lobby/dialog9.webp` (호박 창 테) | 104 100 | `.idg-k-win` |
| `lobby/ribbon.webp` (빨간 리본 현판 · 부화장 창과 같음) | 30 72 | `.idg-k-title` |
| `result/btn_red3.webp` · `btn_green3.webp` | 92 140 | `.idg-k-btn.red/.green/.price` |
| `result/plate_tab.webp` · `plate_reward.webp` | 40 60 · 통그림 | 결과 창 전용 (보상 판 · 꼬리표) |
| `result/ico_*` | — | 단추 아이콘 |
| `ui/coin.svg` · `ui/gem.svg` | — | 재화 (money.js) |
| `lobby/ico_lock.png` · `lobby2/alert.webp` | — | 잠금 · 알림 점 |
| `settings/switch_on/off · slider_*` (옛 보라테) | — | 키트 그림으로 대체 — 새 화면에선 쓰지 않기 |

## 10. 금지

- 글자로 쓴 재화 («금화 100», «젬 390», «코인 14,799»).
- 흐린 `text-shadow` · 글로우 · 빛번짐 · `box-shadow` 번짐 (딱딱한 0-blur 그림자만).
- 투명하게 서서히 사라지기(페이드 아웃) — 부서지면 깜박 · 무너짐 · 잔해.
- 키트 밖 새 단추 모양(노란 네모 · 둥근 회색 등), 한 창에 빨강 큰 단추 둘.
- px 고정 크기 · 화면마다 다른 글씨 크기 (5단계 밖).
- 창 바탕에 맨글씨 안내문 (→ 종이 판).
- 시키지 않은 디자인 교체 — 바꾸고 싶으면 후보를 먼저 보여 드리고 대표님이 고른 뒤.
- 누를 때마다 창 전체를 다시 그려 스크롤이 맨 위로 가는 것 (→ 줄만 바꾸기 · `kitKeepScroll`).
- 끝이 잘린 막대(마감 없는 CSS 막대) — 게이지는 `kitGauge` 만.

## 12. 큰 그림 보기 (11/12)

- 배경 · 큰 그림은 작은 미리보기를 누르면 **전체 덮개**(`.idg-cx-big`)로 연다 : 처음 = 화면 높이에 꽉 · 한 손가락/마우스 끌기 · 두 손가락/휠 확대 · 두 번 누르면 2배 ↔ 원래 · 오른쪽 위 `kitClose` · Esc.
- 미리보기에는 오른쪽 아래 작은 돋보기 표(`.idg-cx-zoom`), 안내는 «그림을 눌러서 크게 보기».

## 11. 쓰는 예

```js
import { kitWin, kitWallet, kitTabs, kitPaper, kitSection, kitScroll, kitRow, kitPriceBtn, kitBtn } from './idgKit.js';
const rows = items.map((it) => kitRow({ icon: it.img, title: it.name, sub: it.slot,
  right: kitPriceBtn({ [it.cur]: it.price, size: 'sm', poor: have[it.cur] < it.price, onClick: () => buy(it) }) }));
const win = kitWin({ title: '드래곤샵', body: [
  kitWallet({ coins: g.coins, gems: g.gems }),
  kitTabs({ old: true, tabs: [{ id: 'deco', label: '꾸미기' }, { id: 'deal', label: '오늘의 특가' }, { id: 'item', label: '편의품' }], onPick }),
  kitPaper(['꾸미기는 멋만 내요. 힘은 세지지 않아요.']),
  kitSection('모자'), kitScroll(rows),
], foot: [kitBtn({ kind: 'purple', text: '닫기', onClick: close })] });
```
