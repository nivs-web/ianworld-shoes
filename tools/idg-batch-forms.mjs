/**
 * 그림 공장 — 용 진화(2단) 묶음 (겜부장 · 2026-11-11 야간)   node tools/idg-batch-forms.mjs
 * Lv10 부터 «2단 모습»(units 의 forms[1] 이름)으로 바뀐다 — 월드 5 (5-4~) 부터 보인다.
 * 각 용의 기본 부품 시트를 참고 그림으로 주고 «같은 용이 조금 더 크고 멋지게»를 그린다 (꼬물이 2단을 만든 방식 그대로).
 * 출력 id = <용>_2 → tools/idg-make-char.mjs 로 ai/<용>_2/ 조립 → 전투 화면이 Lv10 이상이면 자동으로 쓴다.
 */
import fs from 'node:fs';

const DIR = 'C:/Users/ariancepc/Desktop/cowork/iandragon/docs/style_refs/';
const B = JSON.parse(fs.readFileSync(DIR + 'batch_w01.json', 'utf8'));
const gen = fs.readdirSync(DIR + 'gen');
const sheetOf = (id) => gen.filter((f) => new RegExp(`^${id}_\\d+\\.png$`).test(f)).sort()[0];
const strict = ' IMPORTANT: chunky low-resolution PIXEL ART exactly like the reference (visible square pixels). NO grid lines, NO frames, NO numbers, NO labels, NO text anywhere. Pure magenta background between parts. Keep the SAME part order and layout as image 1.';
const FORM = {
  doldeung: 'BAWI-DEUNGI (rock back): bigger rocky shell plates with moss, sturdier legs',
  bulttong: 'BULKKOCHI (flame): a small flame crest on the head, glowing ember belly, tail tip on fire',
  twetwe: 'TWETWETWE: bigger cheeks, three little spikes on the head, dripping goo tail',
  ssaeng: 'BEONJJEOK SSAENG: lightning-streak stripes, swept-back wing tips, speed scarf',
  bangul: 'MUL-BANGUL (water drop): a bubble crown, wave-patterned fins, splashing tail',
  dungsil: 'MUNGGE DUNGSIL: fluffier cloud fur, a tiny rain cloud floating over the head',
  giljjuk: 'JJUKJJUK: even longer neck, a scope-like eye patch, slim armored tail',
  eoreum: 'KKONGKKONG: bigger ice crystal horns, frost aura spikes on the back',
  jjirit: 'JJIRIRIT: crackling electric mane, double lightning tail, glowing yellow stripes',
};
const jobs = Object.entries(FORM).map(([id, d]) => ({ id: id + '_2', base: id, kind: 'dragonParts', ref: 'gen/' + sheetOf(id),
  desc: `Image 1 shows the parts of a baby dragon. Draw the EVOLVED (second) form of the SAME dragon, same colors and face, slightly bigger and braver: ${d}.` + strict })).filter((j) => !j.ref.endsWith('undefined'));
fs.writeFileSync(DIR + 'batch_forms.json', JSON.stringify({ style: B.style, dragonParts: B.dragonParts, jobs }, null, 1));
console.log(jobs.length + '개 → batch_forms.json · 빠진 것: ' + Object.keys(FORM).filter((id) => !sheetOf(id)).join(', '));
