#!/usr/bin/env node
// Measures the natural goal distribution of the physics so the tournament
// model's goal averages can be matched. Usage: node calibrate.js [runs]
import { runToEnd } from './src/sim.js';

const runs = Number(process.argv[2] ?? 2000);
let total = 0;
const perTeam = {};
const start = Date.now();
for (let i = 0; i < runs; i += 1) {
  const { score } = runToEnd(`calibrate-${i}`);
  for (const g of score) { total += g; perTeam[g] = (perTeam[g] ?? 0) + 1; }
}
const ms = (Date.now() - start) / runs;
process.stdout.write(`runs ${runs}, ${ms.toFixed(2)} ms/match, mean goals per team ${(total / runs / 2).toFixed(2)}\n`);
for (const g of Object.keys(perTeam).map(Number).sort((a, b) => a - b)) {
  process.stdout.write(`  ${g} goals: ${((perTeam[g] / runs / 2) * 100).toFixed(1)}%\n`);
}
