#!/usr/bin/env node
// Natural goal distribution of the 3v3 street engine. Usage: node calibrate-street.js [runs]
import { runToEnd, ENGINE } from './src/street/engine.js';

const runs = Number(process.argv[2] ?? 500);
const dist = {};
const perSlot = [0, 0, 0];
let goals = 0; let own = 0; let assisted = 0; const kicks = {};
const start = Date.now();
for (let i = 0; i < runs; i += 1) {
  const r = runToEnd(`cal-${i}`);
  for (const g of r.score) { goals += g; dist[g] = (dist[g] ?? 0) + 1; }
  for (const s of r.scorers) {
    if (s.ownGoal) own += 1;
    else if (s.scorer !== null) perSlot[s.scorer % 3] += 1;
    if (s.assist !== null) assisted += 1;
  }
  for (const e of r.events) if (e.type === 'kick') kicks[e.kind] = (kicks[e.kind] ?? 0) + 1;
}
const ms = (Date.now() - start) / runs;
const pct = (v) => `${(v * 100).toFixed(1)}%`;
console.log(`runs ${runs}, ${ENGINE.playSeconds} s play, ${ms.toFixed(1)} ms/match, mean goals/team ${(goals / runs / 2).toFixed(2)}, own goals ${pct(own / goals)}, assisted ${pct(assisted / goals)}`);
const scored = perSlot.reduce((a, b) => a + b, 0);
console.log(`goal share by player slot: ${perSlot.map((n) => pct(n / scored)).join(' / ')}`);
console.log('kicks per match', Object.fromEntries(Object.entries(kicks).map(([k, v]) => [k, (v / runs).toFixed(1)])));
for (const g of Object.keys(dist).map(Number).sort((a, b) => a - b)) console.log(`  ${g}: ${pct(dist[g] / runs / 2)}`);
