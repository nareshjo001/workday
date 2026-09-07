process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'vms_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'm19-test-only-secret';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { resetTestDatabase } = require('../helpers/testDatabase');
const { pool } = require('../../src/config/db');
const paymentService = require('../../src/services/paymentService');
const auditRepository = require('../../src/repositories/auditRepository');
const notifications = require('../../src/services/notificationService');
const app = require('../../src/app');

let server; let baseUrl;
function runFixture() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '../../mvp_fix_test.js')], { env: { ...process.env, API_BASE_URL: baseUrl }, stdio: 'pipe' });
    let output = ''; child.stdout.on('data', (chunk) => { output += chunk; }); child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject); child.on('exit', (code) => code === 0 ? resolve(output) : reject(new Error(output)));
  });
}

before(async () => { await resetTestDatabase(); await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); }); baseUrl = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await pool.end(); });

test('M19 payment ledger is audited and audit failure rolls back the payment', { timeout: 120000 }, async () => {
  const output = await runFixture();
  assert.match(output, /M19 acceptance checks/);
  assert.match(output, /RESULTS: \d+ passed, 0 failed/);
  const [[invoice]] = await pool.query("SELECT id,vendor_id FROM invoices WHERE status='APPROVED' AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id=invoices.id) LIMIT 1");
  assert.ok(invoice, 'fixture leaves an approved unpaid invoice for audit rollback verification');
  const [[before]] = await pool.query('SELECT COUNT(*) count FROM payments WHERE invoice_id=?', [invoice.id]);
  const originalAppend = auditRepository.append;
  auditRepository.append = async () => { throw new Error('forced M19 audit failure'); };
  try {
    await assert.rejects(() => paymentService.record(invoice.vendor_id, invoice.id, { amount: '0.01', reference: 'rollback-check' }, { userId: invoice.vendor_id, role: 'VENDOR', requestId: 'm19_audit_rollback' }));
  } finally { auditRepository.append = originalAppend; }
  const [[afterRollback]] = await pool.query('SELECT COUNT(*) count FROM payments WHERE invoice_id=?', [invoice.id]);
  assert.equal(Number(afterRollback.count), Number(before.count), 'audit failure must roll back the payment insert');
  const originalNotify = notifications.notify;
  notifications.notify = async () => { throw new Error('forced M19 notification failure'); };
  let recorded;
  try {
    recorded = await paymentService.record(invoice.vendor_id, invoice.id, { amount: '0.01', reference: 'M19-AUDIT', method: 'Bank transfer' }, { userId: invoice.vendor_id, role: 'VENDOR', requestId: 'm19_audit_success' });
  } finally { notifications.notify = originalNotify; }
  assert.equal(recorded.payment_state, 'PARTIALLY_PAID');
  const [[audit]] = await pool.query("SELECT actor_user_id,action,entity_type,entity_id,request_id,after_json FROM audit_log WHERE request_id='m19_audit_success'");
  assert.equal(audit.action, 'PAYMENT_RECORDED'); assert.equal(audit.actor_user_id, invoice.vendor_id); assert.equal(audit.entity_type, 'payment'); assert.ok(audit.entity_id);
  const details = typeof audit.after_json === 'string' ? JSON.parse(audit.after_json) : audit.after_json;
  assert.equal(details.invoice_id, invoice.id); assert.equal(details.reference, 'M19-AUDIT');
});
