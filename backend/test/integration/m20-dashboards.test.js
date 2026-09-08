process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'vms_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'm20-test-only-secret';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { resetTestDatabase } = require('../helpers/testDatabase');
const { pool } = require('../../src/config/db');
const analytics = require('../../src/services/dashboardAnalyticsService');
const exportsService = require('../../src/services/dashboardExportService');
const contractorDashboard = require('../../src/services/contractorDashboardService');
const app = require('../../src/app');

let server; let baseUrl;
function fixture() { return new Promise((resolve, reject) => { const child = spawn(process.execPath, [path.join(__dirname, '../../mvp_fix_test.js')], { env: { ...process.env, API_BASE_URL: baseUrl }, stdio: 'pipe' }); let output = ''; child.stdout.on('data', (data) => { output += data; }); child.stderr.on('data', (data) => { output += data; }); child.on('exit', (code) => code === 0 ? resolve(output) : reject(new Error(output))); }); }
before(async () => { await resetTestDatabase(); await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); }); baseUrl = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await pool.end(); });

test('M20 dashboards and CSV exports preserve lifecycle distinctions and tenant scope', { timeout: 120000 }, async () => {
  const output = await fixture(); assert.match(output, /RESULTS: \d+ passed, 0 failed/);
  const [[vendor]] = await pool.query("SELECT id FROM users WHERE role='VENDOR' ORDER BY id LIMIT 1");
  const [[pm]] = await pool.query("SELECT id FROM users WHERE role='PM' ORDER BY id LIMIT 1");
  const [[contractor]] = await pool.query("SELECT user_id FROM contractors ORDER BY id LIMIT 1");
  const vendorView = await analytics.dashboard('VENDOR', vendor.id, {});
  const pmView = await analytics.dashboard('PM', pm.id, {});
  assert.ok(vendorView.workforce.connected_clients >= 1); assert.ok(vendorView.time.approved_hours > 0);
  assert.ok(vendorView.financial.approved_invoice_amount >= vendorView.financial.paid_amount);
  assert.equal(pmView.financial.margin, null, 'PM must never receive vendor margin/cost data');
  const filtered = await analytics.dashboard('VENDOR', vendor.id, { projectId: 999999 });
  assert.equal(filtered.financial.approved_invoice_amount, 0, 'out-of-scope project filter cannot broaden results');
  for (const dataset of exportsService.DATASETS) { const data = await exportsService.exportRows('VENDOR', vendor.id, dataset, {}); assert.match(data.split('\r\n')[0], /^"/); }
  const paymentCsv = await exportsService.exportRows('VENDOR', vendor.id, 'payments', {}); assert.doesNotMatch(paymentCsv, /\r\n[^\r\n]*password/i);
  await assert.rejects(() => exportsService.exportRows('CONTRACTOR', contractor.user_id, 'payments', {}), /Dashboard exports/);
  const contractorView = await contractorDashboard.getContractorDashboard(contractor.user_id);
  assert.ok(contractorView.m20); assert.equal(Object.hasOwn(contractorView.summary, 'lifetime_revenue'), false); assert.equal(Object.hasOwn(contractorView, 'invoice_history'), false);
});
