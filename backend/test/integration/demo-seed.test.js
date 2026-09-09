const database = 'vms_seed_test_demo';
process.env.NODE_ENV = 'development';
process.env.DB_NAME = database;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'demo-seed-test-secret';

const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vms-demo-seed-'));
const config = { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT) || 3306, user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD };
const vendorDashboard = require('../../src/services/vendorDashboardService');
const { pool } = require('../../src/config/db');

function run(script, extra = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '../../', script)], {
      env: { ...process.env, NODE_ENV: 'development', DB_NAME: database, JWT_SECRET: 'demo-seed-test-secret', DOCUMENT_STORAGE_PATH: storageRoot, ...extra }, stdio: 'pipe',
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('exit', (code) => code === 0 ? resolve(output) : reject(new Error(output)));
  });
}

after(async () => {
  await pool.end();
  const admin = await mysql.createConnection(config);
  try { await admin.query(`DROP DATABASE IF EXISTS ${database}`); } finally { await admin.end(); }
  fs.rmSync(storageRoot, { recursive: true, force: true });
});

test('expanded demo seed is lifecycle-rich and idempotent on a fresh demo database', { timeout: 120000 }, async () => {
  const admin = await mysql.createConnection(config);
  await admin.query(`DROP DATABASE IF EXISTS ${database}`);
  await admin.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();
  await run('src/migrations/run.js');

  const first = await run('scripts/seedDemo.js', { DEMO_SEED_ENABLED: 'true' });
  assert.match(first, /"created":true/);
  assert.match(first, /DEMO_SEED_SUMMARY/);
  const connection = await mysql.createConnection({ ...config, database });
  const [[before]] = await connection.query(`SELECT
    (SELECT COUNT(*) FROM users WHERE email LIKE 'demo.%@workday.local') users,
    (SELECT COUNT(*) FROM projects) projects,
    (SELECT COUNT(*) FROM project_assignments) assignments,
    (SELECT COUNT(*) FROM timesheets) timesheets,
    (SELECT COUNT(*) FROM invoices) invoices,
    (SELECT COUNT(*) FROM payments) payments`);

  const [projects] = await connection.query(`SELECT cc.name client,p.name,p.status FROM projects p JOIN project_managers pm ON pm.user_id=p.pm_id JOIN client_companies cc ON cc.id=pm.company_id WHERE p.name IN ('Atlas Commerce Modernization','Atlas Mobile Expansion','Atlas Legacy Migration','Nova Analytics Platform','Nova Customer Portal','Nova Internal Prototype') ORDER BY p.name`);
  assert.deepEqual(projects.map((row) => row.status).sort(), ['ACTIVE','CANCELLED','COMPLETED','COMPLETED','ON_HOLD','ACTIVE'].sort());
  assert.equal(new Set(projects.map((row) => row.client)).size, 2);
  const [[relationships]] = await connection.query(`SELECT COUNT(*) count FROM client_vendor_relationships r JOIN users u ON u.id=r.vendor_id WHERE u.email='demo.vendor@workday.local' AND r.status='ACTIVE'`);
  assert.equal(Number(relationships.count), 2);
  const [candidateStates] = await connection.query(`SELECT status,COUNT(*) count FROM candidate_submissions GROUP BY status`);
  assert.deepEqual(new Set(candidateStates.map((row) => row.status)), new Set(['SUBMITTED','ACCEPTED','REJECTED','WITHDRAWN']));
  const [timesheetStates] = await connection.query(`SELECT status,COUNT(*) count FROM timesheets GROUP BY status`);
  assert.deepEqual(new Set(timesheetStates.map((row) => row.status)), new Set(['DRAFT','SUBMITTED','APPROVED','REJECTED']));
  const [invoiceStates] = await connection.query(`SELECT status,COUNT(*) count FROM invoices GROUP BY status`);
  assert.deepEqual(new Set(invoiceStates.map((row) => row.status)), new Set(['DRAFT','SUBMITTED','APPROVED','REJECTED']));
  const [[settlementStates]] = await connection.query(`SELECT SUM(paid=0) unpaid,SUM(paid>0 AND paid<total_amount) partial,SUM(paid=total_amount) paid FROM (SELECT i.id,i.total_amount,COALESCE(SUM(p.amount),0) paid FROM invoices i LEFT JOIN payments p ON p.invoice_id=i.id WHERE i.status='APPROVED' GROUP BY i.id,i.total_amount) x`);
  assert.deepEqual([Number(settlementStates.unpaid), Number(settlementStates.partial), Number(settlementStates.paid)], [1,1,1]);
  const [[history]] = await connection.query(`SELECT COUNT(*) released,COUNT(DISTINCT CASE WHEN c.status='INACTIVE' THEN c.id END) inactive FROM project_assignments pa JOIN contractors c ON c.id=pa.contractor_id WHERE pa.status='RELEASED'`);
  assert.ok(Number(history.released) >= 3); assert.ok(Number(history.inactive) >= 1);
  const [[billing]] = await connection.query(`SELECT COUNT(*) billings,SUM(ii.id IS NULL) uninvoiced FROM milestone_billings mb LEFT JOIN invoice_items ii ON ii.milestone_billing_id=mb.id`);
  assert.ok(Number(billing.billings) >= 7); assert.ok(Number(billing.uninvoiced) >= 1);

  const [[vendor]] = await connection.query("SELECT id FROM users WHERE email='demo.vendor@workday.local'");
  const [[atlas]] = await connection.query("SELECT id FROM client_companies WHERE name='Atlas Commerce'");
  const [[nova]] = await connection.query("SELECT id FROM client_companies WHERE name='Nova Digital'");
  const [[atlasProject]] = await connection.query("SELECT id FROM projects WHERE name='Atlas Commerce Modernization'");
  const unfiltered = await vendorDashboard.getVendorDashboard(vendor.id);
  const atlasView = await vendorDashboard.getVendorDashboard(vendor.id, { clientId: atlas.id });
  const novaView = await vendorDashboard.getVendorDashboard(vendor.id, { clientId: nova.id });
  const activeView = await vendorDashboard.getVendorDashboard(vendor.id, { status: 'ACTIVE' });
  const completedView = await vendorDashboard.getVendorDashboard(vendor.id, { status: 'COMPLETED' });
  const projectView = await vendorDashboard.getVendorDashboard(vendor.id, { projectId: atlasProject.id });

  assert.ok(unfiltered.earnings_by_company.some((row) => row.company_name === 'Atlas Commerce'));
  assert.ok(unfiltered.earnings_by_company.some((row) => row.company_name === 'Nova Digital'));
  assert.deepEqual(atlasView.earnings_by_company.map((row) => row.company_name), ['Atlas Commerce']);
  assert.deepEqual(novaView.earnings_by_company.map((row) => row.company_name), ['Nova Digital']);
  assert.ok(atlasView.project_progress.every((row) => row.company_name === 'Atlas Commerce'));
  assert.ok(novaView.project_progress.every((row) => row.company_name === 'Nova Digital'));
  assert.ok(atlasView.recent_activity.every((row) => !row.message.includes('Nova')));
  assert.ok(novaView.recent_activity.every((row) => !row.message.includes('Atlas')));
  assert.ok(activeView.project_progress.length > 0 && activeView.project_progress.every((row) => row.status === 'ACTIVE'));
  assert.ok(completedView.project_progress.length > 0 && completedView.project_progress.every((row) => row.status === 'COMPLETED'));
  assert.ok(activeView.recent_activity.every((row) => !/Legacy Migration|Customer Portal|Internal Prototype|Mobile Expansion/.test(row.message)));
  assert.ok(completedView.recent_activity.every((row) => !/Commerce Modernization|Analytics Platform|Platform Upgrade|Mobile Expansion/.test(row.message)));
  assert.deepEqual(projectView.project_progress.map((row) => row.name), ['Atlas Commerce Modernization']);
  assert.ok(projectView.recent_activity.every((row) => row.message.includes('Atlas Commerce Modernization')));

  const [[atlasInvoiceTotals]] = await connection.query(`SELECT COUNT(*) count,COALESCE(SUM(i.total_amount),0) total FROM invoices i JOIN projects p ON p.id=i.project_id JOIN project_managers pm ON pm.user_id=p.pm_id WHERE i.vendor_id=? AND pm.company_id=?`, [vendor.id, atlas.id]);
  assert.equal(atlasView.invoices.by_status.reduce((sum, row) => sum + row.count, 0), Number(atlasInvoiceTotals.count));
  assert.equal(atlasView.invoices.total_invoiced_amount, Number(atlasInvoiceTotals.total));
  const [[atlasApproved]] = await connection.query(`SELECT COALESCE(SUM(i.total_amount),0) total FROM invoices i JOIN projects p ON p.id=i.project_id JOIN project_managers pm ON pm.user_id=p.pm_id WHERE i.vendor_id=? AND pm.company_id=? AND i.status IN ('APPROVED','AUTO_APPROVED')`, [vendor.id, atlas.id]);
  assert.equal(atlasView.earnings_by_contractor.reduce((sum, row) => sum + row.total, 0), Number(atlasApproved.total));
  const [[novaInvoiceTotals]] = await connection.query(`SELECT COUNT(*) count,COALESCE(SUM(i.total_amount),0) total FROM invoices i JOIN projects p ON p.id=i.project_id JOIN project_managers pm ON pm.user_id=p.pm_id WHERE i.vendor_id=? AND pm.company_id=?`, [vendor.id, nova.id]);
  assert.equal(novaView.invoices.by_status.reduce((sum, row) => sum + row.count, 0), Number(novaInvoiceTotals.count));
  assert.equal(novaView.invoices.total_invoiced_amount, Number(novaInvoiceTotals.total));
  const [[activeInvoiceTotals]] = await connection.query(`SELECT COUNT(*) count,COALESCE(SUM(i.total_amount),0) total FROM invoices i JOIN projects p ON p.id=i.project_id WHERE i.vendor_id=? AND p.status='ACTIVE'`, [vendor.id]);
  assert.equal(activeView.invoices.by_status.reduce((sum, row) => sum + row.count, 0), Number(activeInvoiceTotals.count));
  assert.equal(activeView.invoices.total_invoiced_amount, Number(activeInvoiceTotals.total));
  const [[completedApproved]] = await connection.query(`SELECT COALESCE(SUM(i.total_amount),0) total FROM invoices i JOIN projects p ON p.id=i.project_id WHERE i.vendor_id=? AND p.status='COMPLETED' AND i.status IN ('APPROVED','AUTO_APPROVED')`, [vendor.id]);
  assert.equal(completedView.earnings_by_contractor.reduce((sum, row) => sum + row.total, 0), Number(completedApproved.total));
  const [[projectInvoiceTotals]] = await connection.query(`SELECT COUNT(*) count,COALESCE(SUM(total_amount),0) total FROM invoices WHERE vendor_id=? AND project_id=?`, [vendor.id, atlasProject.id]);
  assert.equal(projectView.invoices.by_status.reduce((sum, row) => sum + row.count, 0), Number(projectInvoiceTotals.count));
  assert.equal(projectView.invoices.total_invoiced_amount, Number(projectInvoiceTotals.total));
  assert.deepEqual(projectView.earnings_by_contractor.map((row) => row.contractor_name), ['Avery Frontend']);
  assert.equal((await vendorDashboard.getVendorDashboard(vendor.id)).invoices.total_invoiced_amount, unfiltered.invoices.total_invoiced_amount, 'clearing filters restores the complete overview');
  await connection.end();

  const second = await run('scripts/seedDemo.js', { DEMO_SEED_ENABLED: 'true' });
  assert.match(second, /"created":false/);
  const verify = await mysql.createConnection({ ...config, database });
  const [[afterCounts]] = await verify.query(`SELECT
    (SELECT COUNT(*) FROM users WHERE email LIKE 'demo.%@workday.local') users,
    (SELECT COUNT(*) FROM projects) projects,
    (SELECT COUNT(*) FROM project_assignments) assignments,
    (SELECT COUNT(*) FROM timesheets) timesheets,
    (SELECT COUNT(*) FROM invoices) invoices,
    (SELECT COUNT(*) FROM payments) payments`);
  await verify.end();
  assert.deepEqual(afterCounts, before);
});
