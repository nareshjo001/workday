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

test('M19 payment eligibility: APPROVED, AUTO_APPROVED, non-payable rejection, and overpayment protection', async () => {
  const [[sample]] = await pool.query('SELECT project_id, contractor_id, vendor_id, client_company_id, currency FROM invoices LIMIT 1');
  const actor = { userId: sample.vendor_id, role: 'VENDOR', requestId: 'm19_eligibility' };

  async function insertInvoice(status, amount) {
    const [res] = await pool.query(
      `INSERT INTO invoices (project_id, contractor_id, vendor_id, client_company_id, currency, amount, total_amount, subtotal_amount, status, generated_at, invoice_date, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY))`,
      [sample.project_id, sample.contractor_id, sample.vendor_id, sample.client_company_id, sample.currency, amount, amount, amount, status]
    );
    return res.insertId;
  }

  // 1. Unpaid APPROVED can record payment
  const approvedId = await insertInvoice('APPROVED', 100.00);
  const pay1 = await paymentService.record(sample.vendor_id, approvedId, { amount: '40.00', reference: 'PARTIAL-APP' }, actor);
  assert.equal(pay1.payment_state, 'PARTIALLY_PAID');
  assert.equal(pay1.paid_amount, 40.00);
  assert.equal(pay1.outstanding_amount, 60.00);

  // 2. Partially paid APPROVED can record payment and transitions to PAID
  const pay2 = await paymentService.record(sample.vendor_id, approvedId, { amount: '60.00', reference: 'FINAL-APP' }, actor);
  assert.equal(pay2.payment_state, 'PAID');
  assert.equal(pay2.paid_amount, 100.00);
  assert.equal(pay2.outstanding_amount, 0.00);

  // 3. Fully paid invoice cannot record again (exceeds outstanding)
  await assert.rejects(
    () => paymentService.record(sample.vendor_id, approvedId, { amount: '0.01' }, actor),
    (err) => err.statusCode === 409 && /Payment exceeds the outstanding invoice amount/i.test(err.message)
  );

  // 4. AUTO_APPROVED behavior matches authoritative status model (unpaid, partially paid, fully paid)
  const autoApprovedId = await insertInvoice('AUTO_APPROVED', 200.00);
  const autoPay1 = await paymentService.record(sample.vendor_id, autoApprovedId, { amount: '50.00', reference: 'AUTO-PARTIAL' }, actor);
  assert.equal(autoPay1.payment_state, 'PARTIALLY_PAID');
  assert.equal(autoPay1.paid_amount, 50.00);
  assert.equal(autoPay1.outstanding_amount, 150.00);

  const autoPay2 = await paymentService.record(sample.vendor_id, autoApprovedId, { amount: '150.00', reference: 'AUTO-FINAL' }, actor);
  assert.equal(autoPay2.payment_state, 'PAID');
  assert.equal(autoPay2.paid_amount, 200.00);
  assert.equal(autoPay2.outstanding_amount, 0.00);

  await assert.rejects(
    () => paymentService.record(sample.vendor_id, autoApprovedId, { amount: '1.00' }, actor),
    (err) => err.statusCode === 409 && /Payment exceeds the outstanding invoice amount/i.test(err.message)
  );

  // 5. Non-payable statuses rejected
  for (const nonPayableStatus of ['DRAFT', 'SUBMITTED', 'REJECTED', 'CANCELLED']) {
    const invId = await insertInvoice(nonPayableStatus, 50.00);
    await assert.rejects(
      () => paymentService.record(sample.vendor_id, invId, { amount: '10.00' }, actor),
      (err) => err.statusCode === 409 && /Payments can only be recorded for approved invoices/i.test(err.message),
      `Status ${nonPayableStatus} must be rejected for payment recording`
    );
  }

  // 6. Overpayment remains rejected
  const overpayInvoiceId = await insertInvoice('APPROVED', 50.00);
  await assert.rejects(
    () => paymentService.record(sample.vendor_id, overpayInvoiceId, { amount: '50.01' }, actor),
    (err) => err.statusCode === 409 && /Payment exceeds the outstanding invoice amount/i.test(err.message)
  );
});
