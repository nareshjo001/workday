function percentile(values, fraction) {
  if (!Array.isArray(values) || values.length === 0 || !values.every(Number.isFinite)) {
    throw new TypeError("Percentile values must be a non-empty array of finite numbers.");
  }
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new TypeError("Percentile fraction must be between 0 and 1.");
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + ((sorted[upper] - sorted[lower]) * (position - lower));
}

function comparableStatistics(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { sample_size: sorted.length, minimum: sorted[0], p25: percentile(sorted, 0.25), median: percentile(sorted, 0.5), p75: percentile(sorted, 0.75), maximum: sorted.at(-1) };
}

module.exports = { percentile, comparableStatistics };
