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
const vendorDashboard = require('../../src/services/vendorDashboardService');
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
  assert.ok(vendorView.financial.active_projects >= 1);
  assert.ok(vendorView.financial.completed_projects >= 1);
  assert.equal(pmView.financial.margin, null, 'PM must never receive vendor margin/cost data');
  assert.equal(Object.hasOwn(pmView.financial, 'approved_earnings_amount'), false, 'vendor earnings field is not exposed to PM');
  const filtered = await analytics.dashboard('VENDOR', vendor.id, { projectId: 999999 });
  assert.equal(filtered.financial.approved_invoice_amount, 0, 'out-of-scope project filter cannot broaden results');

  const activeView = await analytics.dashboard('VENDOR', vendor.id, { status: 'ACTIVE' });
  assert.ok(activeView.financial.active_projects >= 1, 'ACTIVE filter retains the vendor active-project aggregate');
  assert.equal(activeView.financial.completed_projects, 0, 'ACTIVE filter excludes completed projects');
  const completedView = await analytics.dashboard('VENDOR', vendor.id, { status: 'COMPLETED' });
  assert.equal(completedView.financial.active_projects, 0, 'COMPLETED filter excludes active projects');
  assert.ok(completedView.financial.completed_projects >= 1, 'COMPLETED filter retains completed vendor projects');
  assert.equal(completedView.workforce.active_contractors, 0, 'contractors are active only on active projects');

  const [[activeProject]] = await pool.query(
    `SELECT p.id, pm.company_id
       FROM projects p
       JOIN project_managers pm ON pm.user_id=p.pm_id
      WHERE p.status='ACTIVE'
        AND EXISTS (SELECT 1 FROM project_assignments pa JOIN contractors c ON c.id=pa.contractor_id WHERE pa.project_id=p.id AND c.vendor_id=?)
      ORDER BY p.id LIMIT 1`,
    [vendor.id]
  );
  const projectView = await analytics.dashboard('VENDOR', vendor.id, { projectId: activeProject.id });
  assert.equal(projectView.financial.active_projects, 1, 'projectId scopes the active-project aggregate to one project');
  const [[projectEarnings]] = await pool.query("SELECT COALESCE(SUM(total_amount),0) total FROM invoices WHERE vendor_id=? AND project_id=? AND status IN ('APPROVED','AUTO_APPROVED')", [vendor.id, activeProject.id]);
  assert.equal(projectView.financial.approved_earnings_amount, Number(projectEarnings.total), 'projectId scopes approved earnings to the selected project');
  const clientView = await analytics.dashboard('VENDOR', vendor.id, { clientId: activeProject.company_id });
  assert.ok(clientView.financial.active_projects >= 1, 'clientId retains aggregates for the connected client');
  const [[clientEarnings]] = await pool.query("SELECT COALESCE(SUM(i.total_amount),0) total FROM invoices i JOIN projects p ON p.id=i.project_id JOIN project_managers pm ON pm.user_id=p.pm_id WHERE i.vendor_id=? AND pm.company_id=? AND i.status IN ('APPROVED','AUTO_APPROVED')", [vendor.id, activeProject.company_id]);
  assert.equal(clientView.financial.approved_earnings_amount, Number(clientEarnings.total), 'clientId scopes approved earnings to the selected client');

  const [[foreignPm]] = await pool.query("SELECT pm.company_id FROM project_managers pm JOIN users u ON u.id=pm.user_id WHERE u.role='PM' AND pm.company_id<>? ORDER BY pm.user_id LIMIT 1", [activeProject.company_id]);
  const foreignClientView = await analytics.dashboard('VENDOR', vendor.id, { clientId: foreignPm.company_id });
  assert.equal(foreignClientView.financial.active_projects, 0, 'another client tenant cannot broaden vendor aggregates');
  assert.equal(foreignClientView.financial.approved_earnings_amount, 0, 'another client tenant cannot expose vendor earnings');

  const earningsBefore = vendorView.financial.approved_earnings_amount;
  assert.ok(earningsBefore > 0, 'APPROVED finalized invoice totals contribute to approved earnings');
  await pool.query(
    `INSERT INTO invoices(milestone_billing_id,project_id,contractor_id,vendor_id,client_company_id,currency,amount,status,invoice_date,due_date,payment_terms_days,tax_rate,subtotal_amount,tax_amount,adjustment_amount,total_amount)
     SELECT NULL,project_id,contractor_id,vendor_id,client_company_id,currency,17.25,'AUTO_APPROVED',CURDATE(),CURDATE(),0,0,17.25,0,0,17.25 FROM invoices WHERE vendor_id=? LIMIT 1`,
    [vendor.id]
  );
  await pool.query(
    `INSERT INTO invoices(milestone_billing_id,project_id,contractor_id,vendor_id,client_company_id,currency,amount,status,invoice_date,due_date,payment_terms_days,tax_rate,subtotal_amount,tax_amount,adjustment_amount,total_amount)
     SELECT NULL,project_id,contractor_id,vendor_id,client_company_id,currency,999.99,'REJECTED',CURDATE(),CURDATE(),0,0,999.99,0,0,999.99 FROM invoices WHERE vendor_id=? LIMIT 1`,
    [vendor.id]
  );
  const earningsAfter = (await analytics.dashboard('VENDOR', vendor.id, {})).financial.approved_earnings_amount;
  assert.equal(Number((earningsAfter - earningsBefore).toFixed(2)), 17.25, 'approved earnings includes AUTO_APPROVED and excludes REJECTED invoices');

  const [[otherVendor]] = await pool.query("SELECT id FROM users WHERE role='VENDOR' AND id<>? ORDER BY id LIMIT 1", [vendor.id]);
  const crossVendorView = await analytics.dashboard('VENDOR', otherVendor.id, { projectId: activeProject.id });
  assert.equal(crossVendorView.financial.active_projects, 0, 'a vendor cannot aggregate another vendor project');
  assert.equal(crossVendorView.financial.approved_earnings_amount, 0, 'a vendor cannot aggregate another vendor earnings');
  const crossVendorLegacy = await vendorDashboard.getVendorDashboard(otherVendor.id, { projectId: activeProject.id });
  assert.deepEqual(crossVendorLegacy.earnings_by_company, []);
  assert.deepEqual(crossVendorLegacy.earnings_by_contractor, []);
  assert.deepEqual(crossVendorLegacy.project_progress, []);
  assert.deepEqual(crossVendorLegacy.invoices.by_status, []);
  assert.deepEqual(crossVendorLegacy.recent_activity, []);
  await assert.rejects(() => analytics.dashboard('VENDOR', vendor.id, { clientId: '0' }), /clientId must be a positive integer/);
  await assert.rejects(() => analytics.dashboard('VENDOR', vendor.id, { projectId: 'not-an-id' }), /projectId must be a positive integer/);
  await assert.rejects(() => analytics.dashboard('VENDOR', vendor.id, { status: '7' }), /Unsupported project status/);

  for (const dataset of exportsService.DATASETS) { const data = await exportsService.exportRows('VENDOR', vendor.id, dataset, {}); assert.match(data.split('\r\n')[0], /^"/); }
  const paymentCsv = await exportsService.exportRows('VENDOR', vendor.id, 'payments', {}); assert.doesNotMatch(paymentCsv, /\r\n[^\r\n]*password/i);
  await assert.rejects(() => exportsService.exportRows('CONTRACTOR', contractor.user_id, 'payments', {}), /Dashboard exports/);
  const contractorView = await contractorDashboard.getContractorDashboard(contractor.user_id);
  assert.ok(contractorView.m20); assert.equal(Object.hasOwn(contractorView.summary, 'lifetime_revenue'), false); assert.equal(Object.hasOwn(contractorView, 'invoice_history'), false);
});
