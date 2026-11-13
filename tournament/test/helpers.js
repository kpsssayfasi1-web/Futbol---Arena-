import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadTeams() {
  return JSON.parse(readFileSync(join(ROOT, 'data/teams.json'), 'utf8'));
}

export function loadSettings() {
  return JSON.parse(readFileSync(join(ROOT, 'data/settings.json'), 'utf8'));
}

export const CLI_PATH = join(ROOT, 'cli.js');
