import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const rosters = read('../../tournament/data/rosters.json');
const teams = read('../../tournament/data/teams.json');

test('every team has exactly 3 outfield players with labels', () => {
  assert.deepEqual(Object.keys(rosters.teams).sort(), teams.map((t) => t.code).sort());
  for (const [code, players] of Object.entries(rosters.teams)) {
    assert.equal(players.length, 3, code);
    for (const p of players) {
      assert.ok(p.name && p.label, `${code} player needs name and label`);
      assert.ok(['DF', 'MF', 'FW'].includes(p.position), `${code} ${p.name} must be an outfield player`);
    }
  }
});

test('numbers are 1-99, unique per team, and always backed by a source', () => {
  for (const [code, players] of Object.entries(rosters.teams)) {
    const numbers = players.map((p) => p.number).filter((n) => n !== null);
    assert.equal(new Set(numbers).size, numbers.length, `${code} has duplicate numbers`);
    for (const p of players) {
      if (p.number === null) {
        assert.equal(p.source, null, `${code} ${p.name}: unverified number must have no source`);
      } else {
        assert.ok(Number.isInteger(p.number) && p.number >= 1 && p.number <= 99);
        assert.ok(rosters.sources[p.source], `${code} ${p.name}: unknown source ${p.source}`);
      }
    }
  }
});
