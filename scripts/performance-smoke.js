const baseUrl = (process.env.API_BASE_URL || '').replace(/\/$/, '');
const password = process.env.DEMO_PASSWORD || '';
const vendorEmail = process.env.DEMO_VENDOR_EMAIL || '';
const pmEmail = process.env.DEMO_PM_EMAIL || '';
const iterations = Number(process.env.PERFORMANCE_ITERATIONS || 5);
const concurrency = Number(process.env.PERFORMANCE_CONCURRENCY || 3);

if (!baseUrl || !password || !vendorEmail || !pmEmail) {
  throw new Error('Set API_BASE_URL, DEMO_PASSWORD, DEMO_VENDOR_EMAIL, and DEMO_PM_EMAIL.');
}
if (!Number.isInteger(iterations) || iterations < 1 || !Number.isInteger(concurrency) || concurrency < 1) {
  throw new Error('PERFORMANCE_ITERATIONS and PERFORMANCE_CONCURRENCY must be positive integers.');
}

async function login(email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login failed with HTTP ${response.status}.`);
  return (await response.json()).token;
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1)];
}

async function probe(name, path, token) {
  const timings = [];
  let failures = 0;
  for (let offset = 0; offset < iterations; offset += concurrency) {
    const batch = Array.from({ length: Math.min(concurrency, iterations - offset) }, async () => {
      const started = performance.now();
      try {
        const response = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch (_) { failures += 1; } finally { timings.push(Math.round(performance.now() - started)); }
    });
    await Promise.all(batch);
  }
  return { name, requests: timings.length, failures, success_rate: Number((((timings.length - failures) / timings.length) * 100).toFixed(2)), p50_ms: percentile(timings, 0.5), p95_ms: percentile(timings, 0.95) };
}

async function run() {
  const [vendorToken, pmToken] = await Promise.all([login(vendorEmail), login(pmEmail)]);
  const results = await Promise.all([
    probe('vendor_paginated_contractors', '/api/vendor/contractors?page=1&pageSize=10', vendorToken),
    probe('vendor_dashboard_aggregation', '/api/vendor/dashboard', vendorToken),
    probe('pm_candidate_review_queue', '/api/pm/candidate-submissions', pmToken),
    probe('pm_pending_timesheet_review', '/api/pm/timesheets/pending', pmToken),
  ]);
  console.log(JSON.stringify({ event: 'performance_smoke', base_url: baseUrl, iterations, concurrency, results }));
  if (results.some((result) => result.failures)) process.exitCode = 1;
}

run().catch((error) => { console.error(JSON.stringify({ event: 'performance_smoke_failed', error_message: error.message })); process.exit(1); });
