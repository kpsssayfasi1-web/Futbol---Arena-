// Publishing schedule: group stage at N videos/day, knockouts at M/day,
// third-place match and final together on the last day.

const MS_PER_DAY = 86400000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function slotTimestamp(startDate, dayIndex, time) {
  const base = Date.parse(`${startDate}T${time}:00Z`);
  return new Date(base + dayIndex * MS_PER_DAY).toISOString();
}

function assignSlots(matches, slots, firstDayIndex, startDate) {
  return matches.map((match, i) => {
    const dayIndex = firstDayIndex + Math.floor(i / slots.length);
    return {
      ...match,
      publishDay: dayIndex + 1,
      publishAtUtc: slotTimestamp(startDate, dayIndex, slots[i % slots.length]),
    };
  });
}

export function scheduleMatches(matches, startDate, schedule) {
  if (!DATE_PATTERN.test(startDate) || Number.isNaN(Date.parse(startDate))) {
    throw new Error(`Start date must be YYYY-MM-DD, got "${startDate}"`);
  }
  const group = matches.filter((m) => m.stage === 'GROUP');
  const lastDay = matches.filter((m) => m.stage === 'THIRD' || m.stage === 'FINAL');
  const knockout = matches.filter((m) => m.stage !== 'GROUP' && !lastDay.includes(m));

  const groupDays = Math.ceil(group.length / schedule.groupSlotsUtc.length);
  const knockoutDays = Math.ceil(knockout.length / schedule.knockoutSlotsUtc.length);

  return [
    ...assignSlots(group, schedule.groupSlotsUtc, 0, startDate),
    ...assignSlots(knockout, schedule.knockoutSlotsUtc, groupDays, startDate),
    ...assignSlots(lastDay, schedule.finalDaySlotsUtc, groupDays + knockoutDays, startDate),
  ];
}
