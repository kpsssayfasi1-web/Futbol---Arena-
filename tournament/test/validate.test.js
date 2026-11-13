import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTeams, validateSettings } from '../src/validate.js';
import { loadTeams, loadSettings } from './helpers.js';

const settings = loadSettings();
const teams = loadTeams();

test('shipped data files are valid', () => {
  assert.equal(validateTeams(teams, settings.format).length, 48);
  assert.equal(validateSettings(settings), settings);
});

test('shipped data has the agreed ad-value balance', () => {
  const count = (tier) => teams.filter((t) => t.adTier === tier).length;
  assert.deepEqual([count(3), count(2), count(1)], [23, 12, 13]);
});

test('rejects wrong team count', () => {
  assert.throws(() => validateTeams(teams.slice(1), settings.format), /expected 48 teams/);
});

test('rejects duplicate codes', () => {
  const dup = teams.map((t, i) => (i === 1 ? { ...t, code: teams[0].code } : t));
  assert.throws(() => validateTeams(dup, settings.format), /unique/);
});

test('rejects out-of-range rating with the team code in the message', () => {
  const bad = teams.map((t, i) => (i === 0 ? { ...t, rating: 150 } : t));
  assert.throws(() => validateTeams(bad, settings.format), /ESP rating/);
});

test('rejects missing fields, bad colors and unbalanced pots', () => {
  const { flag, ...noFlag } = teams[0];
  assert.throws(() => validateTeams([noFlag, ...teams.slice(1)], settings.format), /missing "flag"/);
  const badColor = teams.map((t, i) => (i === 0 ? { ...t, colors: ['red', '#FFFFFF'] } : t));
  assert.throws(() => validateTeams(badColor, settings.format), /colors/);
  const unbalanced = teams.map((t, i) => (i === 0 ? { ...t, pot: 2 } : t));
  assert.throws(() => validateTeams(unbalanced, settings.format), /pot 1 must have 12/);
});

test('rejects invalid settings', () => {
  assert.throws(() => validateSettings({}), /settings need/);
  assert.throws(() => validateSettings({ ...settings, model: { ...settings.model, baseGoals: -1 } }), /baseGoals/);
  assert.throws(() => validateSettings({ ...settings, schedule: { ...settings.schedule, groupSlotsUtc: ['25:00'] } }), /groupSlotsUtc/);
  assert.throws(() => validateSettings({ ...settings, format: { ...settings.format, groupCount: 8 } }), /12 groups/);
});
