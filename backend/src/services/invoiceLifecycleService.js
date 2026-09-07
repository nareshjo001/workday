const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const audit = require('./auditService');
const notifications = require('./notificationService');
const storage = require('./documentStorageService');
const { buildPdf } = require('./invoicePdfService');
const payments = require('./paymentService');

const id = (value) => { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 1) throw ApiError.badRequest('Validation failed', ['A positive id is required.']); return parsed; };
const decimal = (value, field, { min = 0, max = 9999999999 } = {}) => { const parsed = Number(value); if (!Number.isFinite(parsed) || parsed < min || parsed > max || Math.round(parsed * 100) !== parsed * 100) throw ApiError.badRequest('Validation failed', [`${field} must be a valid amount with at most two decimal places.`]); return parsed.toFixed(2); };
const isoDate = (value, field, required = false) => { if (!value && !required) return null; if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw ApiError.badRequest('Validation failed', [`${field} must be a valid date.`]); return value; };
const invoiceYear = (date) => Number(String(date).slice(0, 4));

async function queue(vendorId) {
  const [rows] = await pool.query(`SELECT b.id milestone_billing_id,m.project_id,c.vendor_id,pm.company_id client_company_id,b.approved_hours,b.hourly_rate bill_rate,b.billing_amount amount,'USD' currency,m.name milestone_name,u.name contractor_name,s.name skill_name
    FROM milestone_billings b JOIN milestones m ON m.id=b.milestone_id JOIN contractors c ON c.id=b.contractor_id JOIN users u ON u.id=c.user_id
    LEFT JOIN contractor_skills cs ON cs.contractor_id=c.id AND cs.is_primary=1 LEFT JOIN skills s ON s.id=cs.skill_id
    JOIN projects p ON p.id=m.project_id JOIN project_managers pm ON pm.user_id=p.pm_id LEFT JOIN invoice_items ii ON ii.milestone_billing_id=b.id WHERE c.vendor_id=? AND ii.id IS NULL`, [vendorId]);
  return rows.map((row) => ({ ...row, approved_hours: Number(row.approved_hours), bill_rate: Number(row.bill_rate), amount: Number(row.amount) }));
}

async function recalculate(conn, invoiceId) {
  const [[invoice]] = await conn.query('SELECT tax_rate,adjustment_amount FROM invoices WHERE id=? FOR UPDATE', [invoiceId]);
  const [[sum]] = await conn.query('SELECT COALESCE(SUM(amount),0) subtotal FROM invoice_items WHERE invoice_id=?', [invoiceId]);
  const subtotal = sum.subtotal;
  await conn.query(`UPDATE invoices SET subtotal_amount=?, tax_amount=ROUND(? * tax_rate / 100,2), total_amount=ROUND(? + ROUND(? * tax_rate / 100,2) + adjustment_amount,2), amount=ROUND(? + ROUND(? * tax_rate / 100,2) + adjustment_amount,2) WHERE id=?`, [subtotal, subtotal, subtotal, subtotal, subtotal, subtotal, invoiceId]);
}

async function billableForUpdate(conn, billingId) {
  const [[billing]] = await conn.query(`SELECT b.id,b.contractor_id,b.approved_hours,b.hourly_rate,b.billing_amount,m.project_id,m.name milestone_name,c.vendor_id,pm.company_id,u.name contractor_name,s.name skill_name
    FROM milestone_billings b JOIN milestones m ON m.id=b.milestone_id JOIN contractors c ON c.id=b.contractor_id JOIN users u ON u.id=c.user_id
    LEFT JOIN contractor_skills cs ON cs.contractor_id=c.id AND cs.is_primary=1 LEFT JOIN skills s ON s.id=cs.skill_id
    JOIN projects p ON p.id=m.project_id JOIN project_managers pm ON pm.user_id=p.pm_id WHERE b.id=? FOR UPDATE`, [billingId]);
  return billing;
}

async function add(conn, invoiceId, billingId) {
  const [[invoice]] = await conn.query('SELECT * FROM invoices WHERE id=? FOR UPDATE', [invoiceId]);
  if (!invoice || invoice.status !== 'DRAFT') throw ApiError.conflict('Invoice is not editable.');
  const billing = await billableForUpdate(conn, billingId);
  if (!billing || billing.vendor_id !== invoice.vendor_id || billing.project_id !== invoice.project_id || billing.company_id !== invoice.client_company_id) throw ApiError.conflict('Billing is incompatible with this draft.');
  await conn.query(`INSERT INTO invoice_items(invoice_id,milestone_billing_id,approved_hours,bill_rate,amount,contractor_name_snapshot,skill_name_snapshot,milestone_name_snapshot,billing_period_label) VALUES(?,?,?,?,?,?,?,?,?)`, [invoiceId, billingId, billing.approved_hours, billing.hourly_rate, billing.billing_amount, billing.contractor_name, billing.skill_name || 'Unspecified skill', billing.milestone_name, 'Approved milestone contribution']);
  await recalculate(conn, invoiceId);
}

function normalize(invoice) {
  if (!invoice) return null;
  ['amount', 'subtotal_amount', 'tax_amount', 'adjustment_amount', 'total_amount', 'tax_rate'].forEach((field) => { if (invoice[field] != null) invoice[field] = Number(invoice[field]); });
  invoice.items = (invoice.items || []).map((item) => ({ ...item, amount: Number(item.amount), bill_rate: Number(item.bill_rate), approved_hours: Number(item.approved_hours) }));
  return invoice;
}
async function detail(invoiceId, conn = pool) {
  const [[invoice]] = await conn.query(`SELECT i.*,p.name project_name FROM invoices i JOIN projects p ON p.id=i.project_id WHERE i.id=?`, [invoiceId]);
  if (!invoice) return null;
  const [items] = await conn.query('SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id', [invoiceId]);
  const [adjustments] = await conn.query('SELECT id,description,amount FROM invoice_adjustments WHERE invoice_id=? ORDER BY id', [invoiceId]);
  return normalize({ ...invoice, items, adjustments: adjustments.map((adjustment) => ({ ...adjustment, amount: Number(adjustment.amount) })), ...(await payments.summary(invoice.id, conn)) });
}
async function listForActor(actor, query = {}) {
  const pmScope = actor.role === 'PM';
  const conditions = [pmScope ? 'p.pm_id=?' : 'i.vendor_id=?'];
  const values = [actor.userId];
  if (query.filters?.status) { conditions.push('i.status=?'); values.push(query.filters.status); }
  if (query.filters?.projectId) { conditions.push('i.project_id=?'); values.push(query.filters.projectId); }
  const join = pmScope ? 'JOIN projects p ON p.id=i.project_id' : '';
  const where = conditions.join(' AND ');
  const [[count]] = await pool.query(`SELECT COUNT(*) total FROM invoices i ${join} WHERE ${where}`, values);
  const sortColumn = ['i.generated_at', 'i.status', 'i.amount'].includes(query.sortColumn) ? query.sortColumn : 'i.generated_at';
  const order = query.order === 'asc' ? 'ASC' : 'DESC';
  const pageSize = Number.isInteger(query.pageSize) ? query.pageSize : 25;
  const offset = Number.isInteger(query.offset) ? query.offset : 0;
  const [rows] = await pool.query(`SELECT i.id FROM invoices i ${join} WHERE ${where} ORDER BY ${sortColumn} ${order}, i.id ${order} LIMIT ? OFFSET ?`, [...values, pageSize, offset]);
  const invoices = [];
  for (const row of rows) invoices.push(await detail(row.id));
  return { items: invoices, total: Number(count.total), page: Number(query.page) || 1, page_size: pageSize, total_pages: Math.ceil(Number(count.total) / pageSize) };
}

async function createDraft(vendorId, body, actor) {
  const billingId = id(body.milestone_billing_id); const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const billing = await billableForUpdate(conn, billingId); if (!billing || billing.vendor_id !== vendorId) throw ApiError.notFound('Eligible billing not found.'); const [claimed] = await conn.query('SELECT id FROM invoice_items WHERE milestone_billing_id=? FOR UPDATE', [billingId]); if (claimed.length) throw ApiError.conflict('This billing contribution is already invoiced.');
    const [created] = await conn.query(`INSERT INTO invoices(milestone_billing_id,project_id,contractor_id,vendor_id,client_company_id,currency,amount,status,generated_at,invoice_date,payment_terms_days,adjustment_amount) VALUES(NULL,?,?,?,?, 'USD',0,'DRAFT',NOW(),CURDATE(),30,0)`, [billing.project_id, billing.contractor_id, vendorId, billing.company_id]);
    await add(conn, created.insertId, billingId); await audit.write(conn, actor, 'INVOICE_DRAFT_CREATED', 'invoice', created.insertId, null, { project_id: billing.project_id }); await conn.commit(); return detail(created.insertId);
  } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); }
}

async function addItem(vendorId, invoiceId, billingId, actor) { const conn = await pool.getConnection(); try { await conn.beginTransaction(); const [[invoice]] = await conn.query('SELECT * FROM invoices WHERE id=? AND vendor_id=? FOR UPDATE', [invoiceId, vendorId]); if (!invoice) throw ApiError.notFound('Invoice not found.'); await add(conn, invoiceId, id(billingId)); await audit.write(conn, actor, 'INVOICE_ITEM_ADDED', 'invoice', invoiceId, null, { milestone_billing_id: Number(billingId) }); await conn.commit(); return detail(invoiceId); } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); } }
async function removeItem(vendorId, invoiceId, billingId, actor) { const conn = await pool.getConnection(); try { await conn.beginTransaction(); const [[invoice]] = await conn.query('SELECT * FROM invoices WHERE id=? AND vendor_id=? FOR UPDATE', [invoiceId, vendorId]); if (!invoice) throw ApiError.notFound('Invoice not found.'); if (invoice.status !== 'DRAFT') throw ApiError.conflict('Invoice is not editable.'); const [deleted] = await conn.query('DELETE FROM invoice_items WHERE invoice_id=? AND milestone_billing_id=?', [invoiceId, id(billingId)]); if (!deleted.affectedRows) throw ApiError.notFound('Invoice item not found.'); await recalculate(conn, invoiceId); await audit.write(conn, actor, 'INVOICE_ITEM_REMOVED', 'invoice', invoiceId, null, { milestone_billing_id: Number(billingId) }); await conn.commit(); return detail(invoiceId); } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); } }

async function updateDraft(vendorId, invoiceId, body, actor) {
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const [[invoice]] = await conn.query('SELECT * FROM invoices WHERE id=? AND vendor_id=? FOR UPDATE', [invoiceId, vendorId]); if (!invoice) throw ApiError.notFound('Invoice not found.'); if (invoice.status !== 'DRAFT') throw ApiError.conflict('Invoice is not editable.');
    const invoiceDate = isoDate(body.invoice_date ?? invoice.invoice_date, 'invoice_date', true); const terms = body.payment_terms_days == null ? invoice.payment_terms_days : Number(body.payment_terms_days); if (!Number.isInteger(terms) || terms < 0 || terms > 365) throw ApiError.badRequest('Validation failed', ['payment_terms_days must be between 0 and 365.']);
    const taxRate = body.tax_rate == null ? String(invoice.tax_rate) : decimal(body.tax_rate, 'tax_rate', { max: 100 }); const dueDate = body.due_date == null ? null : isoDate(body.due_date, 'due_date'); if (dueDate && dueDate < invoiceDate) throw ApiError.badRequest('Validation failed', ['due_date cannot be before invoice_date.']);
    let adjustment = String(invoice.adjustment_amount); if (body.adjustments !== undefined) { if (!Array.isArray(body.adjustments) || body.adjustments.length > 50) throw ApiError.badRequest('Validation failed', ['adjustments must contain at most 50 lines.']); await conn.query('DELETE FROM invoice_adjustments WHERE invoice_id=?', [invoiceId]); let total = 0; for (const line of body.adjustments) { const description = String(line?.description || '').trim(); if (!description || description.length > 200) throw ApiError.badRequest('Validation failed', ['Each adjustment needs a description up to 200 characters.']); const amount = decimal(line.amount, 'adjustment amount', { min: -9999999999 }); total += Number(amount); await conn.query('INSERT INTO invoice_adjustments(invoice_id,description,amount) VALUES(?,?,?)', [invoiceId, description, amount]); } adjustment = total.toFixed(2); }
    await conn.query('UPDATE invoices SET invoice_date=?,due_date=?,payment_terms_days=?,tax_rate=?,adjustment_amount=?,pdf_storage_key=NULL,pdf_size_bytes=NULL,pdf_generated_at=NULL,document_version=document_version+1 WHERE id=?', [invoiceDate, dueDate, terms, taxRate, adjustment, invoiceId]); await recalculate(conn, invoiceId); await audit.write(conn, actor, 'INVOICE_DRAFT_UPDATED', 'invoice', invoiceId, { invoice_date: invoice.invoice_date, tax_rate: invoice.tax_rate, adjustment_amount: invoice.adjustment_amount }, { invoice_date: invoiceDate, tax_rate: Number(taxRate), adjustment_amount: Number(adjustment) }); await conn.commit(); return detail(invoiceId);
  } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); }
}

async function nextNumber(conn, vendorId, date) { const year = invoiceYear(date); await conn.query('INSERT IGNORE INTO invoice_number_sequences(vendor_id,invoice_year,next_sequence) VALUES(?,?,1)', [vendorId, year]); const [[sequence]] = await conn.query('SELECT next_sequence FROM invoice_number_sequences WHERE vendor_id=? AND invoice_year=? FOR UPDATE', [vendorId, year]); const number = sequence.next_sequence; await conn.query('UPDATE invoice_number_sequences SET next_sequence=? WHERE vendor_id=? AND invoice_year=?', [number + 1, vendorId, year]); return `INV-${year}-${String(number).padStart(6, '0')}`; }
async function persistPdf(conn, invoiceId) { const invoice = await detail(invoiceId, conn); const data = buildPdf(invoice); const stored = await storage.store({ contentBase64: data.toString('base64'), mimeType: 'application/pdf' }); await conn.query('UPDATE invoices SET pdf_storage_key=?,pdf_size_bytes=?,pdf_generated_at=NOW() WHERE id=?', [stored.key, stored.sizeBytes, invoiceId]); return stored; }
async function submit(vendorId, invoiceId, actor) { const conn = await pool.getConnection(); try { await conn.beginTransaction(); const [[invoice]] = await conn.query('SELECT * FROM invoices WHERE id=? AND vendor_id=? FOR UPDATE', [invoiceId, vendorId]); if (!invoice) throw ApiError.notFound('Invoice not found.'); const [[count]] = await conn.query('SELECT COUNT(*) count FROM invoice_items WHERE invoice_id=?', [invoiceId]); if (invoice.status !== 'DRAFT' || !count.count) throw ApiError.conflict('Only a non-empty draft can be submitted.'); const invoiceDate = invoice.invoice_date || new Date().toISOString().slice(0, 10); const dueDate = invoice.due_date || new Date(new Date(`${invoiceDate}T00:00:00Z`).getTime() + invoice.payment_terms_days * 86400000).toISOString().slice(0, 10); const number = invoice.invoice_number || await nextNumber(conn, vendorId, invoiceDate); await conn.query("UPDATE invoices SET status='SUBMITTED',submitted_at=NOW(),invoice_number=?,invoice_date=?,due_date=? WHERE id=? AND status='DRAFT'", [number, invoiceDate, dueDate, invoiceId]); await persistPdf(conn, invoiceId); await conn.query('UPDATE invoices SET document_frozen_at=NOW() WHERE id=?', [invoiceId]); await audit.write(conn, actor, 'INVOICE_SUBMITTED', 'invoice', invoiceId, { status: 'DRAFT' }, { status: 'SUBMITTED', invoice_number: number, due_date: dueDate }); await conn.commit(); const [[pm]] = await pool.query('SELECT pm.user_id FROM projects p JOIN project_managers pm ON pm.user_id=p.pm_id WHERE p.id=?', [invoice.project_id]); if (pm) await notifications.notify({ recipientId: pm.user_id, eventType: 'INVOICE_SUBMITTED', entityType: 'invoice', entityId: invoiceId, message: 'An invoice is awaiting review.', deepLink: '/pm/invoices' }).catch((error) => console.error('[invoiceLifecycle] notification failed after submit:', error.message)); return detail(invoiceId); } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); } }

async function review(pmId, invoiceId, status, reason, actor) { if (!['APPROVED', 'REJECTED'].includes(status) || (status === 'REJECTED' && !reason)) throw ApiError.badRequest('Validation failed', ['A rejection reason is required.']); const conn = await pool.getConnection(); try { await conn.beginTransaction(); const [[invoice]] = await conn.query('SELECT i.* FROM invoices i JOIN projects p ON p.id=i.project_id WHERE i.id=? AND p.pm_id=? FOR UPDATE', [invoiceId, pmId]); if (!invoice) throw ApiError.notFound('Invoice not found.'); if (invoice.status !== 'SUBMITTED') throw ApiError.conflict('Invoice is not submitted.'); await conn.query("UPDATE invoices SET status=?,reviewed_by=?,reviewed_at=NOW(),rejection_reason=? WHERE id=? AND status='SUBMITTED'", [status, pmId, status === 'REJECTED' ? reason : null, invoiceId]); await audit.write(conn, actor, `INVOICE_${status}`, 'invoice', invoiceId, { status: 'SUBMITTED' }, { status }); await conn.commit(); await notifications.notify({ recipientId: invoice.vendor_id, eventType: status === 'APPROVED' ? 'INVOICE_APPROVED' : 'INVOICE_REJECTED', entityType: 'invoice', entityId: invoiceId, message: `Your invoice was ${status.toLowerCase()}.`, deepLink: '/vendor/invoices' }).catch((error) => console.error('[invoiceLifecycle] notification failed after review:', error.message)); return detail(invoiceId); } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); } }
async function revise(vendorId, invoiceId, actor) { const conn = await pool.getConnection(); try { await conn.beginTransaction(); const [[invoice]] = await conn.query('SELECT * FROM invoices WHERE id=? AND vendor_id=? FOR UPDATE', [invoiceId, vendorId]); if (!invoice) throw ApiError.notFound('Invoice not found.'); if (invoice.status !== 'REJECTED') throw ApiError.conflict('Only rejected invoices can be revised.'); await conn.query("UPDATE invoices SET status='DRAFT',reviewed_by=NULL,reviewed_at=NULL,rejection_reason=NULL,document_frozen_at=NULL,pdf_storage_key=NULL,pdf_size_bytes=NULL,pdf_generated_at=NULL WHERE id=?", [invoiceId]); await audit.write(conn, actor, 'INVOICE_REVISED', 'invoice', invoiceId, { status: 'REJECTED' }, { status: 'DRAFT', invoice_number: invoice.invoice_number }); await conn.commit(); return detail(invoiceId); } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); } }
async function cancel(vendorId, invoiceId, actor) { const conn = await pool.getConnection(); try { await conn.beginTransaction(); const [[invoice]] = await conn.query('SELECT * FROM invoices WHERE id=? AND vendor_id=? FOR UPDATE', [invoiceId, vendorId]); if (!invoice) throw ApiError.notFound('Invoice not found.'); if (!['DRAFT', 'REJECTED'].includes(invoice.status)) throw ApiError.conflict('Only draft or rejected invoices can be cancelled.'); await conn.query("UPDATE invoices SET status='CANCELLED',cancelled_at=NOW() WHERE id=?", [invoiceId]); await audit.write(conn, actor, 'INVOICE_CANCELLED', 'invoice', invoiceId, { status: invoice.status }, { status: 'CANCELLED' }); await conn.commit(); return detail(invoiceId); } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); } }
async function ownedDetail(actor, invoiceId) { const invoice = await detail(invoiceId); if (!invoice) throw ApiError.notFound('Invoice not found.'); const owned = actor.role === 'VENDOR' ? invoice.vendor_id === actor.userId : actor.role === 'PM' && (await pool.query('SELECT 1 FROM projects WHERE id=? AND pm_id=?', [invoice.project_id, actor.userId]))[0].length; if (!owned) throw ApiError.notFound('Invoice not found.'); return invoice; }
async function pdf(actor, invoiceId) { const invoice = await ownedDetail(actor, invoiceId); if (!invoice.pdf_storage_key) throw ApiError.notFound('Invoice document not found.'); return { invoice, data: await storage.read(invoice.pdf_storage_key) }; }
async function regenerateDraftPdf(vendorId, invoiceId) { const conn = await pool.getConnection(); try { await conn.beginTransaction(); const [[invoice]] = await conn.query('SELECT * FROM invoices WHERE id=? AND vendor_id=? FOR UPDATE', [invoiceId, vendorId]); if (!invoice) throw ApiError.notFound('Invoice not found.'); if (invoice.status !== 'DRAFT') throw ApiError.conflict('Only draft documents can be regenerated.'); await persistPdf(conn, invoiceId); await conn.commit(); return detail(invoiceId); } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); } }
module.exports = { queue, createDraft, addItem, removeItem, updateDraft, detail, listForActor, ownedDetail, pdf, regenerateDraftPdf, submit, review, revise, cancel };
