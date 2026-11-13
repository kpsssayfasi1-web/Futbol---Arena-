// Input validation for the hand-edited data files. Fails fast with a
// message that says exactly which entry is wrong.

const REQUIRED_TEAM_FIELDS = ['code', 'name', 'flag', 'rating', 'pot', 'adTier', 'confederation', 'region', 'colors'];
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function assert(condition, message) {
  if (!condition) throw new Error(`Invalid data: ${message}`);
}

function validateTeam(team, index, potCount) {
  const label = team && team.code ? team.code : `#${index}`;
  for (const field of REQUIRED_TEAM_FIELDS) {
    assert(team[field] !== undefined, `team ${label} is missing "${field}"`);
  }
  assert(/^[A-Z]{3}$/.test(team.code), `team ${label} code must be 3 capital letters`);
  assert(Number.isFinite(team.rating) && team.rating >= 0 && team.rating <= 100, `team ${label} rating must be 0-100`);
  assert(Number.isInteger(team.pot) && team.pot >= 1 && team.pot <= potCount, `team ${label} pot must be 1-${potCount}`);
  assert([1, 2, 3].includes(team.adTier), `team ${label} adTier must be 1, 2 or 3`);
  assert(Array.isArray(team.colors) && team.colors.length === 2 && team.colors.every((c) => HEX_COLOR.test(c)),
    `team ${label} colors must be two #RRGGBB values`);
}

export function validateTeams(teams, format) {
  const { groupCount, teamsPerGroup } = format;
  assert(Array.isArray(teams), 'teams must be an array');
  assert(teams.length === groupCount * teamsPerGroup,
    `expected ${groupCount * teamsPerGroup} teams, got ${teams.length}`);
  teams.forEach((team, index) => validateTeam(team, index, teamsPerGroup));

  const codes = new Set(teams.map((t) => t.code));
  assert(codes.size === teams.length, 'team codes must be unique');
  for (let pot = 1; pot <= teamsPerGroup; pot += 1) {
    const size = teams.filter((t) => t.pot === pot).length;
    assert(size === groupCount, `pot ${pot} must have ${groupCount} teams, has ${size}`);
  }
  return teams;
}

export function validateSettings(settings) {
  const { model, format, schedule } = settings ?? {};
  assert(model && format && schedule, 'settings need "model", "format" and "schedule"');
  for (const key of ['baseGoals', 'ratingFactor', 'penaltyBase', 'penaltyEdgePerPoint']) {
    assert(Number.isFinite(model[key]) && model[key] >= 0, `model.${key} must be a non-negative number`);
  }
  assert(model.penaltyBase <= 1, 'model.penaltyBase must be at most 1');
  assert(format.groupCount === 12 && format.teamsPerGroup === 4 && format.bestThirdsCount === 8,
    'format currently supports exactly 12 groups x 4 teams with 8 best thirds (32-team knockout)');
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const key of ['groupSlotsUtc', 'knockoutSlotsUtc', 'finalDaySlotsUtc']) {
    assert(Array.isArray(schedule[key]) && schedule[key].length > 0 && schedule[key].every((s) => time.test(s)),
      `schedule.${key} must be a non-empty list of HH:MM times`);
  }
  assert(schedule.finalDaySlotsUtc.length === 2, 'schedule.finalDaySlotsUtc needs 2 slots (3rd place, final)');
  if (settings.realism !== undefined) {
    const { minGroupPointsByPot = {}, maxGroupStageAttempts } = settings.realism;
    assert(Number.isInteger(maxGroupStageAttempts) && maxGroupStageAttempts >= 1,
      'realism.maxGroupStageAttempts must be a whole number >= 1');
    for (const [pot, points] of Object.entries(minGroupPointsByPot)) {
      assert(/^[1-4]$/.test(pot) && Number.isInteger(points) && points >= 0 && points <= 9,
        `realism.minGroupPointsByPot["${pot}"] must map pot 1-4 to 0-9 points`);
    }
  }
  return settings;
}
