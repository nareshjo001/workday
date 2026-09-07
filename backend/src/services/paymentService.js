const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const audit = require('./auditService');
const notifications = require('./notificationService');

const invoiceId = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw ApiError.badRequest('Validation failed', ['A positive invoice id is required.']);
  return parsed;
};
const money = (value) => {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text) || Number(text) <= 0) throw ApiError.badRequest('Validation failed', ['amount must be a positive amount with at most two decimal places.']);
  return text.includes('.') ? `${text.split('.')[0]}.${text.split('.')[1].padEnd(2, '0')}` : `${text}.00`;
};
const dateTime = (value) => {
  if (!value) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw ApiError.badRequest('Validation failed', ['paid_at must be a valid date/time.']);
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
};
const optionalText = (value, name, max) => {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!text || text.length > max) throw ApiError.badRequest('Validation failed', [`${name} must be at most ${max} characters.`]);
  return text;
};

function settlement(invoice, totals) {
  const paid = String(totals.paid_amount ?? '0.00');
  const outstanding = String(totals.outstanding_amount ?? '0.00');
  const today = new Date().toISOString().slice(0, 10);
  const isZero = (value) => /^-?0(?:\.0+)?$/.test(value);
  let paymentState = isZero(paid) ? 'UNPAID' : isZero(outstanding) ? 'PAID' : 'PARTIALLY_PAID';
  if (paymentState !== 'PAID' && invoice.due_date && invoice.due_date < today) paymentState = 'OVERDUE';
  return { paid_amount: Number(paid), outstanding_amount: Number(outstanding), payment_state: paymentState, overdue: paymentState === 'OVERDUE' };
}

async function summary(invoiceIdValue, conn = pool) {
  const [[invoice]] = await conn.query('SELECT id,vendor_id,project_id,status,currency,due_date,total_amount,amount FROM invoices WHERE id=?', [invoiceId(invoiceIdValue)]);
  if (!invoice) return null;
  const [[totals]] = await conn.query('SELECT COALESCE(SUM(amount),0.00) paid_amount, ? - COALESCE(SUM(amount),0.00) outstanding_amount FROM payments WHERE invoice_id=?', [invoice.total_amount ?? invoice.amount, invoice.id]);
  const [payments] = await conn.query('SELECT id,amount,currency,paid_at,reference,method,notes,recorded_by,created_at FROM payments WHERE invoice_id=? ORDER BY paid_at ASC,id ASC', [invoice.id]);
  return { ...settlement(invoice, totals), payments: payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })) };
}

async function record(vendorId, rawInvoiceId, body, actor) {
  const id = invoiceId(rawInvoiceId); const amount = money(body.amount); const paidAt = dateTime(body.paid_at);
  const reference = optionalText(body.reference, 'reference', 120); const method = optionalText(body.method, 'method', 60); const notes = optionalText(body.notes, 'notes', 500);
  const currency = String(body.currency || '').trim().toUpperCase();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[invoice]] = await conn.query('SELECT * FROM invoices WHERE id=? AND vendor_id=? FOR UPDATE', [id, vendorId]);
    if (!invoice) throw ApiError.notFound('Invoice not found.');
    if (invoice.status !== 'APPROVED') throw ApiError.conflict('Payments can only be recorded for approved invoices.');
    if (currency && currency !== invoice.currency) throw ApiError.conflict('Payment currency must match the invoice currency.');
    const [[totals]] = await conn.query('SELECT COALESCE(SUM(amount),0.00) paid_amount FROM payments WHERE invoice_id=? FOR UPDATE', [id]);
    // Decimal comparison is intentionally performed by MySQL, not JS floats.
    const [[check]] = await conn.query('SELECT (? + ?) <= ? allowed', [totals.paid_amount, amount, invoice.total_amount]);
    if (!check.allowed) throw ApiError.conflict('Payment exceeds the outstanding invoice amount.');
    const [created] = await conn.query('INSERT INTO payments(invoice_id,amount,currency,paid_at,reference,method,notes,recorded_by) VALUES(?,?,?,?,?,?,?,?)', [id, amount, invoice.currency, paidAt, reference, method, notes, actor.userId]);
    const [[afterTotals]] = await conn.query('SELECT COALESCE(SUM(amount),0.00) paid_amount FROM payments WHERE invoice_id=?', [id]);
    await audit.write(conn, actor, 'PAYMENT_RECORDED', 'payment', created.insertId, null, { invoice_id: id, amount, currency: invoice.currency, paid_at: paidAt, reference, method, paid_amount: afterTotals.paid_amount });
    await conn.commit();
    const paymentSummary = await summary(id);
    const [[pm]] = await pool.query('SELECT pm_id FROM projects WHERE id=?', [invoice.project_id]);
    if (pm) {
      notifications.notify({ recipientId: pm.pm_id, eventType: 'PAYMENT_RECORDED', entityType: 'payment', entityId: created.insertId, message: 'A payment was recorded against an approved invoice.', deepLink: '/pm/invoices' }).catch(() => {});
      if (paymentSummary.payment_state === 'PAID') notifications.notify({ recipientId: pm.pm_id, eventType: 'INVOICE_PAID', entityType: 'invoice', entityId: id, message: 'An approved invoice is fully paid.', deepLink: '/pm/invoices' }).catch(() => {});
    }
    return { id: created.insertId, invoice_id: id, amount: Number(amount), currency: invoice.currency, paid_at: paidAt, reference, method, notes, ...paymentSummary };
  } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); }
}

module.exports = { summary, record };
