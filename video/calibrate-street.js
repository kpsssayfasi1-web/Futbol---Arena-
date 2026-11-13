#!/usr/bin/env node
// Natural goal distribution of the 3v3 street engine. Usage: node calibrate-street.js [runs]
import { runToEnd } from './src/street/engine.js';

const runs = Number(process.argv[2] ?? 500);
const dist = {};
let goals = 0; let own = 0; let kicks = {};
const start = Date.now();
for (let i = 0; i < runs; i += 1) {
  const r = runToEnd(`cal-${i}`);
  for (const g of r.score) { goals += g; dist[g] = (dist[g] ?? 0) + 1; }
  own += r.scorers.filter((s) => s.ownGoal).length;
  for (const e of r.events) if (e.type === 'kick') kicks[e.kind] = (kicks[e.kind] ?? 0) + 1;
}
const ms = (Date.now() - start) / runs;
console.log(`runs ${runs}, ${ms.toFixed(1)} ms/match, mean goals/team ${(goals / runs / 2).toFixed(2)}, own goals ${(own / goals * 100).toFixed(1)}%`);
console.log('kicks per match', Object.fromEntries(Object.entries(kicks).map(([k, v]) => [k, (v / runs).toFixed(1)])));
for (const g of Object.keys(dist).map(Number).sort((a, b) => a - b)) console.log(`  ${g}: ${(dist[g] / runs / 2 * 100).toFixed(1)}%`);
