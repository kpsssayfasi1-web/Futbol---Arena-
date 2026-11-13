import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveRng } from '../src/rng.js';
import { drawGroups } from '../src/draw.js';
import { groupFixtures, computeStandings } from '../src/groups.js';
import { loadTeams, loadSettings } from './helpers.js';

const teams = loadTeams();
const { format } = loadSettings();
const byCode = Object.fromEntries(teams.map((t) => [t.code, t]));

test('draw gives 12 groups with one team from each pot', () => {
  const groups = drawGroups(teams, deriveRng('s', 'draw'), format);
  assert.equal(groups.length, 12);
  for (const g of groups) {
    assert.deepEqual(g.teams.map((c) => byCode[c].pot), [1, 2, 3, 4]);
  }
  assert.equal(new Set(groups.flatMap((g) => g.teams)).size, 48);
});

test('draw respects confederation limits across many seeds', () => {
  for (let i = 0; i < 50; i += 1) {
    for (const g of drawGroups(teams, deriveRng(`seed-${i}`, 'draw'), format)) {
      const counts = {};
      for (const c of g.teams) counts[byCode[c].confederation] = (counts[byCode[c].confederation] ?? 0) + 1;
      for (const [conf, n] of Object.entries(counts)) {
        assert.ok(n <= (format.confederationLimits[conf] ?? format.confederationLimits.default), `${g.id}: ${conf} x${n}`);
      }
    }
  }
});

test('draw is deterministic per seed', () => {
  assert.deepEqual(drawGroups(teams, deriveRng('x', 'draw'), format), drawGroups(teams, deriveRng('x', 'draw'), format));
});

test('impossible confederation limits fail with a clear error', () => {
  const strict = { ...format, confederationLimits: { default: 1 } };
  assert.throws(() => drawGroups(teams, deriveRng('x', 'draw'), strict), /confederation limits/);
});

test('fixtures: 6 matches, every pair once, each team plays once per matchday', () => {
  const fixtures = groupFixtures({ id: 'A', teams: ['T1', 'T2', 'T3', 'T4'] });
  assert.equal(fixtures.length, 6);
  const pairs = new Set(fixtures.map((f) => [f.home, f.away].sort().join('-')));
  assert.equal(pairs.size, 6);
  for (const md of [1, 2, 3]) {
    const playing = fixtures.filter((f) => f.matchday === md).flatMap((f) => [f.home, f.away]);
    assert.equal(new Set(playing).size, 4);
  }
});

test('standings sort by points, goal difference, goals, then lots', () => {
  const group = { id: 'A', teams: ['AAA', 'BBB', 'CCC', 'DDD'] };
  const m = (home, away, h, a) => ({ group: 'A', home, away, score: { home: h, away: a } });
  const matches = [
    m('AAA', 'BBB', 2, 0), m('CCC', 'DDD', 1, 1),
    m('AAA', 'CCC', 0, 1), m('DDD', 'BBB', 0, 0),
    m('DDD', 'AAA', 0, 3), m('BBB', 'CCC', 1, 0),
  ];
  const rows = computeStandings(group, matches, ['DDD', 'CCC', 'BBB', 'AAA']);
  assert.deepEqual(rows.map((r) => r.team), ['AAA', 'CCC', 'BBB', 'DDD']);
  assert.deepEqual([rows[0].points, rows[0].goalDiff, rows[0].played], [6, 4, 3]);
  assert.equal(rows[3].position, 4);

  const allDraws = group.teams.flatMap((h, i) => group.teams.slice(i + 1).map((a) => m(h, a, 0, 0)));
  const lots = ['CCC', 'AAA', 'DDD', 'BBB'];
  assert.deepEqual(computeStandings(group, allDraws, lots).map((r) => r.team), lots);
});

test('limits that pass the capacity check but still cannot be met fail within the step budget', () => {
  const tight = { ...format, confederationLimits: { UEFA: 3, AFC: 1, default: 1 } };
  const allAfcPot4 = teams.map((t) => (t.pot === 4 ? { ...t, confederation: 'AFC' } : t));
  assert.throws(() => drawGroups(allAfcPot4, deriveRng('x', 'draw'), tight), /Group draw failed/);
});
