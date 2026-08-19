/**
 * 배경 검사 — `npm run qa:bg`
 *
 * 배경은 **데이터(목록) · 그림(파일) · 명단(빌드 입력)** 셋이 따로 산다.
 * 셋 중 하나만 어긋나도 화면에는 깨진 그림이나 빈 칸으로 나올 뿐 오류가 안 난다.
 * 그래서 셋을 서로 대조하는 검사가 필요하다 — 시즌2로 30종이 한꺼번에 들어오면서
 * 손으로 확인할 수 있는 규모를 넘었다.
 */
import fs from 'node:fs';
import { BUILDINGS, buildingAssets } from '../src/data/backgrounds.js';
import S from '../src/config/strings.ko.js';

let fails = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  (${JSON.stringify(got)} ≠ ${JSON.stringify(want)})`}`);
};
const has = (label, src, needle) => eq(label, src.includes(needle), true);

const manifest = JSON.parse(fs.readFileSync('tools/bg-season2.json', 'utf8'));
delete manifest._readme;
const season2 = Object.values(manifest);

console.log('1) 목록 자체');
eq('배경 44종', BUILDINGS.length, 44);
eq('id 중복 없음', new Set(BUILDINGS.map((b) => b.id)).size, 44);
eq('이름 중복 없음', new Set(BUILDINGS.map((b) => b.name)).size, 44);
// 사용자가 겹친다고 지목한 둘 — 다시 살아나면 안 된다
eq('동물의 집 제거(build_06)', BUILDINGS.some((b) => b.id === 'build_06'), false);
eq('숲속의 별장 II 제거(build_15)', BUILDINGS.some((b) => b.id === 'build_15'), false);
eq('그 이름도 없다', BUILDINGS.some((b) => b.name === '동물의 집' || b.name === '숲속의 별장 II'), false);
/**
 * ★ 빠진 자리를 **메우지 않았는지** 본다. build_NN 은 그림 파일 이름이자
 * 사용자가 설정에 저장해 둔 값이라, 뒤를 당기면 남의 배경이 바뀐다.
 */
eq('시즌1 번호가 안 밀렸다', BUILDINGS.slice(0, 5).map((b) => b.id),
  ['build_01', 'build_02', 'build_03', 'build_04', 'build_05']);
eq('build_07 이 그대로', BUILDINGS[5].id, 'build_07');

console.log('\n2) 명단(빌드 입력) ↔ 목록(게임 데이터)');
eq('시즌2 30종', season2.length, 30);
for (const s of season2) {
  const found = BUILDINGS.find((b) => b.id === s.id);
  eq(`${s.id} 이름 일치 (${s.name})`, found?.name, s.name);
}

console.log('\n3) 그림 파일이 실제로 있다');
let 없음 = 0;
for (const b of BUILDINGS) {
  for (const p of Object.values(buildingAssets(b.id))) {
    if (!fs.existsSync(`public${p}`)) { 없음++; console.log(`  FAIL 없음: public${p}`); }
  }
}
eq(`44종 × 3장 = ${BUILDINGS.length * 3}장 전부 존재`, 없음, 0);
// 규격까지 본다 — 크기가 틀리면 게임에서 늘어나거나 잘린다
{
  const png = (p) => {
    const b = fs.readFileSync(`public${p}`);
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  const 표본 = ['build_17', 'build_30', 'build_38', 'build_46'];
  for (const id of 표본) {
    const a = buildingAssets(id);
    eq(`${id} 도로 180×120`, png(a.road), [180, 120]);
    eq(`${id} 1층 180×180`, png(a.floor1), [180, 180]);
    eq(`${id} 2·3층 180×360`, png(a.tile), [180, 360]);
  }
}

console.log('\n4) 배경 설정 화면');
eq('안내가 두 줄', S.singleBgHint, '싱글게임에서 사용할 배경을 선택하세요\n멀티게임은 배경이 랜덤입니다');
{
  const css = fs.readFileSync('src/styles/screens.css', 'utf8');
  const hint = /\.hint \{[\s\S]*?\}/.exec(css)?.[0] ?? '';
  has('.hint 가 줄바꿈을 살린다', hint, 'white-space: pre-line');
  has('큰 그림 팝업 스타일', css, '.bg-cut-stack');
  has('세 장이 틈 없이 붙는다', css, '.bg-cut-stack img');
}
{
  const bs = fs.readFileSync('src/screens/BgSettings.js', 'utf8');
  has('이미 고른 카드를 다시 누르면 큰 그림', bs, 'if (cur === id) return previewUrl ? openCut(id, label) : undefined;');
  has('도로+1층+2·3층을 이어 붙인다', bs, 'img(a.tile), img(a.floor1), img(a.road),');
  has('배율 계산을 밖으로 뺐다', bs, 'export function cutScale(vw, vh)');
  has('확대는 정수배', bs, 'Math.floor((vw - 16) / CUT_W)');
  // 미리보기가 배율을 따로 계산하면 그 미리보기는 언젠가 거짓말을 한다 (§9-0-33)
  has('미리보기가 같은 식을 쓴다',
    fs.readFileSync('tools/_bgsettings-preview.html', 'utf8'),
    "import { cutScale } from '/src/screens/BgSettings.js';");
  const css2 = fs.readFileSync('src/styles/screens.css', 'utf8');
  has('테두리가 폭을 안 먹는다', css2, 'box-sizing: content-box');
  // 한 컷 높이는 세 장의 합이어야 한다 — 하나라도 빠지면 잘린 탑이 된다
  has('한 컷 = 세 장의 합', bs, 'BG.tileH + BG.floor1H + BG.roadH');
}

console.log('\n5) 빌드 파이프라인');
{
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  has('assets:bg 가 시즌2를 이어 굽는다', pkg.scripts['assets:bg'], 'build-season2-bg.mjs');
  has('간판 스크립트도 그대로', pkg.scripts['assets:bg'], 'build-museum-sign.mjs');
  /**
   * ★ §9-0-32 의 교훈. `etc/` 는 gitignore 라 Vercel 에 없다 —
   * 가드가 없으면 **배포가 통째로 실패하고 아무도 모른다.**
   */
  const s2 = fs.readFileSync('tools/build-season2-bg.mjs', 'utf8');
  has('원본이 없어도 죽지 않는다', s2, 'if (!existsSync(SRC))');
  has('커밋된 결과물로 넘어간다', s2, '커밋된');
  // 검출기는 시즌1과 공유한다 — 복사해 두면 한쪽만 고치게 된다
  has('공용 부품을 쓴다', s2, "from './_bg-lib.mjs'");
  has('시즌1도 같은 부품', fs.readFileSync('tools/downscale-bg.mjs', 'utf8'), "from './_bg-lib.mjs'");
}
eq('손으로 적은 배경 개수가 남아 있지 않다',
  fs.readFileSync('src/config/layout.js', 'utf8').includes('variantCount: '), false);

console.log(fails ? `\n실패 ${fails}건` : '\n배경 이상 없음');
process.exit(fails ? 1 : 0);
