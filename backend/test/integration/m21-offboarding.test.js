process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'vms_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'm21-test-only-secret';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { resetTestDatabase } = require('../helpers/testDatabase');
const { pool } = require('../../src/config/db');
const offboarding = require('../../src/services/vendorOffboardingService');
const pmProjects = require('../../src/services/pmProjectService');
const history = require('../../src/services/contractorHistoryService');
const auditRepository = require('../../src/repositories/auditRepository');
const app = require('../../src/app');

let server; let baseUrl;
function fixture() { return new Promise((resolve, reject) => { const child = spawn(process.execPath, [path.join(__dirname, '../../mvp_fix_test.js')], { env: { ...process.env, API_BASE_URL: baseUrl }, stdio: 'pipe' }); let output = ''; child.stdout.on('data', (d) => { output += d; }); child.stderr.on('data', (d) => { output += d; }); child.on('exit', (code) => code === 0 ? resolve(output) : reject(new Error(output))); }); }
async function eligibleAssignment(offset = 0) {
  const [rows] = await pool.query(`SELECT pa.id,pa.project_id,pa.contractor_id,p.start_date,p.end_date,c.vendor_id
    FROM project_assignments pa JOIN projects p ON p.id=pa.project_id JOIN contractors c ON c.id=pa.contractor_id
    WHERE pa.status='ACTIVE' AND NOT EXISTS (SELECT 1 FROM timesheets t WHERE t.project_id=pa.project_id AND t.contractor_id=pa.contractor_id AND t.status='SUBMITTED')
    ORDER BY pa.id LIMIT ?,1`, [offset]);
  assert.ok(rows[0], 'fixture must retain an eligible active assignment'); return rows[0];
}

before(async () => { await resetTestDatabase(); await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); }); baseUrl = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await pool.end(); });

test('M21 release metadata, readiness, history, isolation, and audit rollback preserve historical records', { timeout: 120000 }, async () => {
  const output = await fixture(); assert.match(output, /RESULTS: \d+ passed, 0 failed/);
  const assignment = await eligibleAssignment();
  const readiness = await offboarding.readiness(assignment.vendor_id, assignment.project_id, assignment.contractor_id);
  assert.equal(readiness.can_release, true); assert.deepEqual(readiness.blockers, []);
  const date = String(assignment.end_date || assignment.start_date).slice(0, 10);
  const result = await offboarding.release(assignment.vendor_id, assignment.project_id, assignment.contractor_id, { actualEndDate: date, reason: 'Engagement complete' }, { userId: assignment.vendor_id, role: 'VENDOR', requestId: 'm21_release' });
  assert.equal(result.assignment_status, 'RELEASED');
  const [[released]] = await pool.query('SELECT status,actual_end_date,release_reason,released_by,released_at FROM project_assignments WHERE id=?', [assignment.id]);
  assert.equal(released.status, 'RELEASED'); assert.equal(String(released.actual_end_date).slice(0, 10), date); assert.equal(released.release_reason, 'Engagement complete'); assert.equal(released.released_by, assignment.vendor_id); assert.ok(released.released_at);
  const rows = await history.history(assignment.vendor_id, assignment.contractor_id); const item = rows.find((row) => row.assignment_id === assignment.id);
  assert.ok(item); assert.equal(item.status, 'RELEASED'); assert.equal(item.release_reason, 'Engagement complete'); assert.ok(Object.hasOwn(item, 'approved_hours'));
  const [[audit]] = await pool.query("SELECT action,actor_user_id,request_id FROM audit_log WHERE request_id='m21_release'");
  assert.deepEqual({ action: audit.action, actor: audit.actor_user_id, request: audit.request_id }, { action: 'ASSIGNMENT_RELEASED', actor: assignment.vendor_id, request: 'm21_release' });
  const [[otherVendor]] = await pool.query("SELECT id FROM users WHERE role='VENDOR' AND id<>? LIMIT 1", [assignment.vendor_id]);
  if (otherVendor) await assert.rejects(() => history.history(otherVendor.id, assignment.contractor_id), /Contractor not found/);
  const other = await eligibleAssignment(); const originalAppend = auditRepository.append; auditRepository.append = async () => { throw new Error('forced M21 audit failure'); };
  try { await assert.rejects(() => offboarding.release(other.vendor_id, other.project_id, other.contractor_id, { actualEndDate: String(other.end_date || other.start_date).slice(0, 10), reason: 'must roll back' }, { userId: other.vendor_id, role: 'VENDOR', requestId: 'm21_rollback' })); } finally { auditRepository.append = originalAppend; }
  const [[afterRollback]] = await pool.query('SELECT status FROM project_assignments WHERE id=?', [other.id]); assert.equal(afterRollback.status, 'ACTIVE');
  const [[ownedProject]] = await pool.query('SELECT pm_id,id FROM projects ORDER BY id LIMIT 1');
  const close = await pmProjects.getCloseReadiness(ownedProject.pm_id, ownedProject.id); assert.equal(typeof close.can_complete, 'boolean'); assert.ok(Array.isArray(close.blockers)); assert.ok(Array.isArray(close.warnings));
});
