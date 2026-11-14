import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const Q = 'cl=94&seen=1&gifts=done&coins=99999&gems=999';
const scan = () => { const out = []; const sel = 'button,[role=tab],.idg-k-tab,.idg-shop-card,.idg-k-btn,.pbtn,.idg-k-row,.idg-world-tab,.dialog'; for (const e of document.querySelectorAll('body *')) { if (!e.offsetParent) continue; const tn = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()); if (!tn.length) continue; const r = document.createRange(); r.selectNodeContents(e); const tr = r.getBoundingClientRect(); const box = e.closest(sel); if (!box) continue; const br = box.getBoundingClientRect(); const m = 2; if (tr.right > br.right + m || tr.left < br.left - m || tr.bottom > br.bottom + m || tr.top < br.top - m) out.push(`${e.textContent.trim().slice(0, 16)} [${(box.className + '').slice(0, 24)}] R${Math.round(tr.right - br.right)} L${Math.round(br.left - tr.left)} B${Math.round(tr.bottom - br.bottom)}`); } return [...new Set(out)].slice(0, 12); };
const names = ['스테이지', '연구소', '꾸미기', '더보기', '부화장', '멀티게임', '좀비습격', '도전과제', '파워업', '모험시작', '아이템샵'];
for (const [w, h, tag] of [[844, 390, 'L'], [390, 844, 'P'], [1280, 720, 'D']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  const go = async () => { await p.goto(`http://127.0.0.1:5397/tools/_pwmock/index.html?${Q}`); await sleep(2800); };
  await go(); console.log(tag, 'lobby', JSON.stringify(await p.evaluate(scan)));
  for (const name of names) {
    await go();
    const ok = await p.evaluate((n) => { const x = [...document.querySelectorAll('button,[role=button]')].find((y) => y.offsetParent && y.textContent.replace(/\s/g, '').includes(n)); x?.click(); return !!x; }, name);
    if (!ok) continue; await sleep(1500);
    console.log(tag, name, JSON.stringify(await p.evaluate(scan)));
    if (name === '아이템샵') for (const bt of ['드래곤캐슬', '특가', '편의품', '드래곤']) { await p.evaluate((t) => [...document.querySelectorAll('.idg-shop-big .idg-k-tab')].find((x) => x.textContent.trim() === t)?.click(), bt); await sleep(500);
      const subs = await p.evaluate(() => [...document.querySelectorAll('.idg-shop-sub .idg-k-tab')].map((x) => x.textContent.trim())); console.log(tag, 'shop', bt, 'big', JSON.stringify(await p.evaluate(scan)));
      for (const s of subs) { await p.evaluate((t) => [...document.querySelectorAll('.idg-shop-sub .idg-k-tab')].find((x) => x.textContent.trim() === t)?.click(), s); await sleep(400); const r = await p.evaluate(scan); if (r.length) console.log(tag, 'shop', bt, s, JSON.stringify(r)); } }
  }
  await p.context().close();
}
await b.close();
