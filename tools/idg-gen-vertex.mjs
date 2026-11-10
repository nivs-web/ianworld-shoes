/**
 * 이안 드래곤 게임 — 그림 공장 : 제미나이(Vertex AI) 이미지 생성 (겜부장 · 2026-11-11)
 *
 *   node tools/idg-gen-vertex.mjs <작업이름> "<프롬프트>" <참고그림1> [참고그림2 ...]
 *
 * - 인증 : gcloud 로그인 토큰 (키를 파일에 두지 않는다). 프로젝트 · 위치는 gcloud 설정.
 * - **예산 장부** : iandragon/docs/style_refs/ledger.json — 대표님이 승인한 한도(cap)를 넘을 호출은 하지 않고 멈춘다.
 *   한 장 값 = 출력 1K/2K 그림 $0.134 + 참고 그림 입력 장당 약 $0.0011 (Vertex 가격표, 2026-11).
 * - 결과 : iandragon/docs/style_refs/gen/<작업이름>_<번호>.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const REFS = 'C:/Users/ariancepc/Desktop/cowork/iandragon/docs/style_refs';
const LEDGER = path.join(REFS, 'ledger.json');
const MODEL = process.env.IDG_MODEL || 'gemini-3.1-flash-image';   // 대표님 «무조건 싼 걸로» (2026-11-11)
const SIZE = process.env.IDG_SIZE || '512';
const PRICE_BY = { 'gemini-3-pro-image': { '1K': 0.134, '2K': 0.134, '4K': 0.24 }, 'gemini-3.1-flash-image': { '512': 0.045, '1K': 0.067, '2K': 0.101, '4K': 0.15 } };
const PRICE = { [MODEL]: PRICE_BY[MODEL]?.[SIZE] ?? 0.134 };
const IN_PRICE = 0.0011;

const [job, prompt, ...refs] = process.argv.slice(2);
if (!job || !prompt) { console.error('사용법: node tools/idg-gen-vertex.mjs <작업이름> "<프롬프트>" <참고그림...>'); process.exit(1); }

const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : { cap: 0, spent: 0, items: [] };
const est = (PRICE[MODEL] ?? 0.134) + refs.length * IN_PRICE;
if (ledger.spent + est > ledger.cap) { console.error(`✘ 예산 초과 : 쓴 돈 $${ledger.spent.toFixed(3)} + 이번 $${est.toFixed(3)} > 승인 한도 $${ledger.cap}`); process.exit(2); }

const project = execSync('gcloud config get-value project', { encoding: 'utf8' }).trim();
const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
const mime = (f) => (f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
const parts = refs.map((f) => ({ inlineData: { mimeType: mime(f), data: fs.readFileSync(f).toString('base64') } }));
parts.push({ text: prompt });

const url = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${MODEL}:generateContent`;
let res, body;
for (let attempt = 0; attempt < 6; attempt++) {   // 429(너무 자주 부름) 이면 기다렸다 다시 — 거절된 호출은 요금 없음
res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: process.env.IDG_ASPECT || '1:1', imageSize: SIZE } } }),
});
body = await res.json();
if (res.status !== 429) break;
const wait = 15000 * (attempt + 1); console.log('  … 429 — ' + wait / 1000 + '초 기다렸다 다시'); await new Promise((r) => setTimeout(r, wait));
}
if (!res.ok) { console.error('✘ 호출 실패', res.status, JSON.stringify(body).slice(0, 600)); process.exit(3); }

const outs = (body.candidates?.[0]?.content?.parts || []).filter((p) => p.inlineData);
const usage = body.usageMetadata || {};
const cost = outs.length * (PRICE[MODEL] ?? 0.134) + refs.length * IN_PRICE;
fs.mkdirSync(path.join(REFS, 'gen'), { recursive: true });
const files = outs.map((o, i) => {
  const f = path.join(REFS, 'gen', `${job}_${String(ledger.items.length + 1).padStart(3, '0')}${outs.length > 1 ? '_' + i : ''}.png`);
  fs.writeFileSync(f, Buffer.from(o.inlineData.data, 'base64'));
  return f;
});
ledger.spent = Math.round((ledger.spent + cost) * 10000) / 10000;
ledger.items.push({ at: new Date().toISOString(), job, model: MODEL, refs: refs.length, images: outs.length, cost: Math.round(cost * 10000) / 10000, files: files.map((f) => path.basename(f)), tokens: usage.totalTokenCount });
fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
const text = (body.candidates?.[0]?.content?.parts || []).filter((p) => p.text).map((p) => p.text).join(' ').slice(0, 200);
console.log(`✔ ${job} : 그림 ${outs.length}장 · 이번 $${cost.toFixed(3)} · 누적 $${ledger.spent.toFixed(3)} / 한도 $${ledger.cap}${text ? ' · 모델 말: ' + text : ''}`);
for (const f of files) console.log('  ' + f);
