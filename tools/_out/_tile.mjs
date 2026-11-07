import { buildChart } from '../../src/games/jumprope/beat/chart.js';
for (const [s, d] of [[1,'normal'],[2,'normal'],[3,'normal'],[4,'normal'],[5,'normal'],[5,'hard'],[1,'easy'],['endless','normal']]) {
  const c = buildChart(s, d, { seed: 7, ctrl: 'jump', bars: s==='endless'?80:undefined });
  const cnt = {}; for (const n of c.notes) cnt[n.act] = (cnt[n.act]||0)+1;
  const labels = {}; for (const n of c.notes) if (n.label) labels[n.label.split(' / ')[1]] = (labels[n.label.split(' / ')[1]]||0)+1;
  let minGap = 9; for (let i=1;i<c.notes.length;i++){ const p=c.notes[i-1]; minGap=Math.min(minGap, c.notes[i].t-(p.endT??p.t)); }
  console.log(s, d, c.total, JSON.stringify(cnt), 'minGap', minGap.toFixed(2), 'keys', c.ropeKeys.length, JSON.stringify(labels));
}
