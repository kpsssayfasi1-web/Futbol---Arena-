import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLI_PATH } from './helpers.js';

const run = (args) => spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8' });

test('CLI generates tournament files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pwc-'));
  try {
    const res = run(['--seed', 'cli-test', '--start', '2027-01-05', '--out', dir]);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /104 matches over 29 days/);
    const data = JSON.parse(readFileSync(join(dir, 'tournament.json'), 'utf8'));
    assert.equal(data.matches[0].publishAtUtc, '2027-01-05T06:00:00.000Z');
    assert.match(readFileSync(join(dir, 'summary.md'), 'utf8'), /cli-test/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI prints odds and rejects bad input', () => {
  const odds = run(['--odds', '20']);
  assert.equal(odds.status, 0, odds.stderr);
  assert.match(odds.stdout, /Champion odds over 20/);
  assert.equal(run(['--odds', 'abc']).status, 1);
  const badDate = run(['--start', 'tomorrow', '--out', join(tmpdir(), 'pwc-never')]);
  assert.equal(badDate.status, 1);
  assert.match(badDate.stderr, /YYYY-MM-DD/);
});
