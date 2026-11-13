import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runTournament } from '../src/tournament.js';
import { scheduleMatches } from '../src/schedule.js';
import { withPublishingText, buildTitle } from '../src/titles.js';
import { buildSummary, buildScheduleCsv } from '../src/report.js';
import { championOdds } from '../src/odds.js';
import { dramaScore } from '../src/drama.js';
import { loadTeams, loadSettings } from './helpers.js';

const teams = loadTeams();
const settings = loadSettings();
const result = runTournament({ teams, settings, seed: 'test-season' });
const count = (stage) => result.matches.filter((m) => m.stage === stage).length;

test('tournament has 104 matches in the 2026 format', () => {
  assert.equal(result.matches.length, 104);
  assert.deepEqual(['GROUP', 'R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL'].map(count), [72, 16, 8, 4, 2, 1, 1]);
  assert.equal(new Set(result.matches.map((m) => m.id)).size, 104);
});

test('every knockout match has a winner; draws go to penalties', () => {
  for (const m of result.matches.filter((x) => x.stage !== 'GROUP')) {
    assert.ok(m.winner === m.home || m.winner === m.away);
    assert.equal(m.penalties !== null, m.score.home === m.score.away);
  }
});

test('knockout winners advance into the next round', () => {
  const winners = new Set(result.matches.filter((m) => m.stage === 'QF').map((m) => m.winner));
  const semiTeams = result.matches.filter((m) => m.stage === 'SF').flatMap((m) => [m.home, m.away]);
  assert.deepEqual(new Set(semiTeams), winners);
  const final = result.matches.find((m) => m.stage === 'FINAL');
  assert.equal(result.podium.champion, final.winner);
});

test('same seed reproduces the tournament, different seed changes it', () => {
  assert.deepEqual(runTournament({ teams, settings, seed: 'test-season' }), result);
  const other = runTournament({ teams, settings, seed: 'another' });
  assert.notDeepEqual(other.matches.map((m) => m.score), result.matches.map((m) => m.score));
});

test('schedule: 4 per day in groups, 3 per day in knockouts, final last, 29 days', () => {
  const scheduled = scheduleMatches(result.matches, '2026-12-01', settings.schedule);
  const perDay = (day) => scheduled.filter((m) => m.publishDay === day).length;
  assert.equal(perDay(1), 4);
  assert.equal(perDay(18), 4);
  assert.equal(perDay(19), 3);
  assert.equal(perDay(29), 2);
  const final = scheduled.find((m) => m.stage === 'FINAL');
  assert.equal(final.publishAtUtc, '2026-12-29T18:00:00.000Z');
  const times = scheduled.map((m) => Date.parse(m.publishAtUtc));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  assert.throws(() => scheduleMatches(result.matches, '01-12-2026', settings.schedule), /YYYY-MM-DD/);
});

test('titles never reveal the score and fit YouTube length', () => {
  const withText = withPublishingText(result.matches, teams, settings.tournamentName);
  for (const m of withText) {
    assert.ok([...m.title].length <= 100, m.title);
    assert.ok(!m.title.includes(`${m.score.home}-${m.score.away}`));
    assert.ok(m.description.includes('physics simulation'));
  }
  const final = withText.find((m) => m.stage === 'FINAL');
  assert.match(final.title, /THE FINAL/);
});

test('underdog titles name the underdog first', () => {
  const byCode = Object.fromEntries(teams.map((t) => [t.code, t]));
  const title = buildTitle({ stage: 'GROUP', group: 'A', home: 'ESP', away: 'NZL' }, byCode, 'Physics World Cup');
  assert.match(title, /^Can New Zealand shock Spain\?/);
  const long = buildTitle({ stage: 'GROUP', group: 'A', home: 'ESP', away: 'NZL' }, byCode, 'X'.repeat(90));
  assert.ok([...long].length <= 100);
});

test('drama score rewards upsets, shootouts and big stages', () => {
  const ratings = { AAA: 90, BBB: 60 };
  const base = { home: 'AAA', away: 'BBB', penalties: null };
  const favWin = dramaScore({ ...base, stage: 'GROUP', score: { home: 3, away: 0 }, winner: 'AAA' }, ratings);
  const upset = dramaScore({ ...base, stage: 'GROUP', score: { home: 0, away: 1 }, winner: 'BBB' }, ratings);
  const finalPens = dramaScore({ ...base, stage: 'FINAL', score: { home: 1, away: 1 }, penalties: { home: 4, away: 3 }, winner: 'AAA' }, ratings);
  assert.ok(upset > favWin);
  assert.ok(finalPens > favWin);
  assert.ok(upset <= 100 && finalPens <= 100);
});

test('summary and CSV include every match', () => {
  const scheduled = withPublishingText(scheduleMatches(result.matches, '2026-12-01', settings.schedule), teams, settings.tournamentName);
  const full = { ...result, matches: scheduled };
  const summary = buildSummary(full, teams, settings.tournamentName);
  assert.match(summary, /Grup L/);
  assert.match(summary, /## Final/);
  const csv = buildScheduleCsv(scheduled).trim().split('\n');
  assert.equal(csv.length, 105);
  assert.match(csv[0], /^id,publish_day/);
});

test('championOdds favours stronger teams and validates runs', () => {
  const odds = championOdds({ teams, settings, runs: 150 });
  const share = (code) => odds.find((o) => o.code === code).champion;
  assert.ok(Math.abs(odds.reduce((s, o) => s + o.champion, 0) - 1) < 1e-9);
  assert.ok(share('ESP') + share('ARG') + share('FRA') > share('IDN') + share('NZL') + share('MAS'));
  assert.throws(() => championOdds({ teams, settings, runs: 0 }), RangeError);
});
