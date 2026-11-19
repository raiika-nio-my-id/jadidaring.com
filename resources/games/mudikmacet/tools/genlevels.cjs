// Offline helper used to author the curated pack: hill-climb candidates per target par, print JSON rows.
// node tools/genlevels.js  -> paste/curate into src/config.json "levels"
require('../src/sim.js'); const M = globalThis.MM;
const targets = (process.argv[2] || '2,3,4,5,6,7,8,10,12,14,16,18,20,23,26').split(',').map(Number);
for (const t of targets) {
  let got = null;
  for (let s = 0; s < 60 && !got; s++) { const l = M.generate('pack|' + t + '|' + s, { minMoves: t, maxMoves: t, steps: t > 18 ? 600 : 250, cap: 60000 }); if (l.par === t) got = l; }
  console.log(JSON.stringify(got ? { g: got.g, v: got.v, par: got.par } : { miss: t }));
}
