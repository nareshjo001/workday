function assertDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError("Expected a YYYY-MM-DD date-only value.");
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new TypeError("Expected a valid YYYY-MM-DD date-only value.");
  }
  return date;
}

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

function addCalendarDays(dateOnly, offset) {
  const date = assertDateOnly(dateOnly);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

module.exports = {
  addCalendarDays,
  utcToday,
};
