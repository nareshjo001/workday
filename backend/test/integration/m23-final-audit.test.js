process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'vms_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'm23-final-audit-test-secret';
process.env.M09_ENFORCE_ACCESS = 'true';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { resetTestDatabase } = require('../helpers/testDatabase');
const { pool } = require('../../src/config/db');
const milestoneService = require('../../src/services/milestoneService');
const app = require('../../src/app');

let server;
let baseUrl;
let sequence = 0;
const state = {};
const day = (offset) => {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
};
const email = (label) => `m23-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${++sequence}@test.example`;

async function request(method, path, body, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/pdf')
    ? Buffer.from(await response.arrayBuffer())
    : contentType.includes('text/csv')
      ? await response.text()
      : await response.json().catch(() => null);
  return { response, status: response.status, data };
}

async function signup(role, label) {
  const address = email(label);
  const password = 'Password123!';
  const payload = { name: `M23 ${label}`, email: address, password, role };
  if (role === 'PM') payload.companyName = `M23 ${label} Company ${sequence}`;
  const signedUp = await request('POST', '/auth/signup', payload);
  assert.equal(signedUp.status, 201, JSON.stringify(signedUp.data));
  const loggedIn = await request('POST', '/auth/login', { email: address, password });
  assert.equal(loggedIn.status, 200);
  return { email: address, token: loggedIn.data.token, id: loggedIn.data.user.id };
}

before(async () => {
  await resetTestDatabase();
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('M23 reconciles approved work through immutable billing, invoice, PDF, and settlement snapshots', { timeout: 120000 }, async () => {
  state.pmA = await signup('PM', 'PM A');
  state.pmB = await signup('PM', 'PM B');
  state.vendorA = await signup('VENDOR', 'Vendor A');
  state.vendorB = await signup('VENDOR', 'Vendor B');

  const [[company]] = await pool.query('SELECT company_id FROM project_managers WHERE user_id=?', [state.pmA.id]);
  const [[skill]] = await pool.query("SELECT id FROM skills WHERE code='FRONTEND'");
  state.companyId = company.company_id;

  const projectResult = await request('POST', '/pm/projects', {
    name: 'M23 Financial Reconciliation',
    start_date: day(0),
    end_date: day(10),
    expected_hours: 20,
    requirements: [{ skill: 'FRONTEND', required_count: 3 }],
  }, state.pmA.token);
  assert.equal(projectResult.status, 201, JSON.stringify(projectResult.data));
  state.project = projectResult.data;
  state.requirementId = state.project.requirements[0].id;

  assert.equal((await request('POST', '/pm/vendor-access', { vendorId: state.vendorA.id, projectId: state.project.id }, state.pmA.token)).status, 201);
  const rateCard = await request('POST', '/vendor/rate-cards', {
    client_company_id: state.companyId,
    skill_id: skill.id,
    effective_from: day(0),
    effective_to: day(10),
    bill_rate: 125,
    cost_rate: 75,
    currency: 'INR',
  }, state.vendorA.token);
  assert.equal(rateCard.status, 201);
  state.rateCardId = rateCard.data.id;

  async function createAcceptedContractor(label, allocatedHours) {
    const contractorAddress = email(`contractor-${label}`);
    const contractor = await request('POST', '/vendor/contractors', {
      name: `M23 Contractor ${label}`, email: contractorAddress, password: 'Password123!', hourly_rate: 50,
    }, state.vendorA.token);
    assert.equal(contractor.status, 201, JSON.stringify(contractor.data));
    const contractorLogin = await request('POST', '/auth/login', { email: contractorAddress, password: 'Password123!' });
    assert.equal(contractorLogin.status, 200);
    const auth = { id: contractorLogin.data.user.id, token: contractorLogin.data.token };
    assert.equal((await request('PATCH', '/contractor/profile/skill', { skill: 'FRONTEND' }, auth.token)).status, 200);
    const submittedCandidate = await request('POST', `/vendor/projects/${state.project.id}/requirements/${state.requirementId}/candidates`, {
      contractor_id: contractor.data.id, start_date: day(0), end_date: day(10),
    }, state.vendorA.token);
    assert.equal(submittedCandidate.status, 201, JSON.stringify(submittedCandidate.data));
    const accepted = await request('PATCH', `/pm/candidate-submissions/${submittedCandidate.data.id}`, { status: 'ACCEPTED' }, state.pmA.token);
    assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
    assert.equal((await request('PATCH', `/pm/projects/${state.project.id}/contractors/${contractor.data.id}/allocation`, { allocated_hours: allocatedHours }, state.pmA.token)).status, 200);
    return { ...auth, contractorId: contractor.data.id, candidateId: submittedCandidate.data.id, assignmentId: accepted.data.assignment_id };
  }

  state.contractorA = await createAcceptedContractor('A', 8);
  state.contractorB = await createAcceptedContractor('B', 6);
  state.contractorC = await createAcceptedContractor('C', 6);
  state.contractorId = state.contractorA.contractorId;
  state.candidateId = state.contractorA.candidateId;
  state.assignmentId = state.contractorA.assignmentId;

  const milestone = await request('POST', '/pm/milestones', {
    project_id: state.project.id, name: 'M23 Approved Work', threshold_hours: 8,
    description: 'Reconciliation checkpoint', sequence_order: 1, due_date: day(5),
  }, state.pmA.token);
  assert.equal(milestone.status, 201);
  state.milestoneId = milestone.data.id;

  async function createTimesheet(contractorAuth, hours, label) {
    const created = await request('POST', '/contractor/timesheets', {
      projectId: state.project.id, workDate: day(0), hoursLogged: hours, description: `M23 work ${label}`,
    }, contractorAuth.token);
    assert.equal(created.status, 201, JSON.stringify(created.data));
    return created.data.id;
  }

  const approvedId = await createTimesheet(state.contractorA, 8, 'approved');
  const rejectedId = await createTimesheet(state.contractorB, 2, 'rejected');
  const submittedId = await createTimesheet(state.contractorC, 1, 'submitted');
  assert.equal((await request('POST', '/contractor/timesheets/submit', { timesheetIds: [approvedId] }, state.contractorA.token)).status, 200);
  assert.equal((await request('POST', '/contractor/timesheets/submit', { timesheetIds: [rejectedId] }, state.contractorB.token)).status, 200);
  assert.equal((await request('POST', '/contractor/timesheets/submit', { timesheetIds: [submittedId] }, state.contractorC.token)).status, 200);
  assert.equal((await request('PATCH', `/pm/timesheets/${approvedId}`, { status: 'APPROVED' }, state.pmA.token)).status, 200);
  assert.equal((await request('PATCH', `/pm/timesheets/${rejectedId}`, { status: 'REJECTED', rejectionReason: 'Correct the work description.' }, state.pmA.token)).status, 200);
  state.draftTimesheetId = rejectedId;
  state.submittedTimesheetId = submittedId;

  await milestoneService.checkAndTriggerMilestones(state.project.id, { userId: state.pmA.id, role: 'PM', requestId: 'm23_repeat_evaluation' });
  const [[assignment]] = await pool.query('SELECT bill_rate_snapshot,cost_rate_snapshot,currency,rate_card_id FROM project_assignments WHERE id=?', [state.assignmentId]);
  assert.deepEqual({ bill: Number(assignment.bill_rate_snapshot), cost: Number(assignment.cost_rate_snapshot), currency: assignment.currency, card: assignment.rate_card_id }, { bill: 125, cost: 75, currency: 'INR', card: state.rateCardId });

  const [[hours]] = await pool.query("SELECT SUM(CASE WHEN status='APPROVED' THEN hours_logged ELSE 0 END) approved, SUM(CASE WHEN status<>'APPROVED' THEN hours_logged ELSE 0 END) excluded FROM timesheets WHERE project_id=?", [state.project.id]);
  assert.equal(Number(hours.approved), 8);
  assert.equal(Number(hours.excluded), 3);
  const [billings] = await pool.query('SELECT * FROM milestone_billings WHERE milestone_id=?', [state.milestoneId]);
  assert.equal(billings.length, 1, 'repeated evaluation must not duplicate milestone billing');
  assert.deepEqual({ hours: Number(billings[0].approved_hours), rate: Number(billings[0].hourly_rate), currency: billings[0].currency, amount: Number(billings[0].billing_amount) }, { hours: 8, rate: 125, currency: 'INR', amount: 1000 });
  state.billingId = billings[0].id;

  const queue = await request('GET', '/vendor/billing-queue', undefined, state.vendorA.token);
  assert.equal(queue.status, 200);
  assert.equal(queue.data.items.find((item) => item.milestone_billing_id === state.billingId).currency, 'INR');
  const draft = await request('POST', '/vendor/invoices/drafts', { milestone_billing_id: state.billingId }, state.vendorA.token);
  assert.equal(draft.status, 201);
  state.invoiceId = draft.data.id;
  const priced = await request('PATCH', `/vendor/invoices/${state.invoiceId}`, {
    tax_rate: 10, adjustments: [{ description: 'Approved adjustment', amount: 5.25 }], payment_terms_days: 30,
  }, state.vendorA.token);
  assert.deepEqual({ subtotal: priced.data.subtotal_amount, tax: priced.data.tax_amount, adjustment: priced.data.adjustment_amount, total: priced.data.total_amount, currency: priced.data.currency }, { subtotal: 1000, tax: 100, adjustment: 5.25, total: 1105.25, currency: 'INR' });
  assert.deepEqual({ hours: priced.data.items[0].approved_hours, rate: priced.data.items[0].bill_rate, amount: priced.data.items[0].amount }, { hours: 8, rate: 125, amount: 1000 });

  const submittedInvoice = await request('POST', `/vendor/invoices/${state.invoiceId}/submit`, undefined, state.vendorA.token);
  assert.equal(submittedInvoice.status, 200);
  state.invoiceNumber = submittedInvoice.data.invoice_number;
  const pdf = await request('GET', `/vendor/invoices/${state.invoiceId}/pdf`, undefined, state.vendorA.token);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.data.subarray(0, 5).toString(), '%PDF-');
  assert.match(pdf.data.toString('utf8'), /Total: INR 1105\.25/);
  state.pdfBytes = pdf.data;
  assert.equal((await request('PATCH', `/pm/invoices/${state.invoiceId}/review`, { status: 'APPROVED' }, state.pmA.token)).status, 200);

  const unpaid = await request('GET', `/vendor/invoices/${state.invoiceId}/detail`, undefined, state.vendorA.token);
  assert.deepEqual({ paid: unpaid.data.paid_amount, outstanding: unpaid.data.outstanding_amount, paymentState: unpaid.data.payment_state }, { paid: 0, outstanding: 1105.25, paymentState: 'UNPAID' });
  const partial = await request('POST', `/vendor/invoices/${state.invoiceId}/payments`, { amount: '305.25', currency: 'INR', reference: '*M23-PARTIAL' }, state.vendorA.token);
  assert.equal(partial.status, 201);
  assert.deepEqual({ paid: partial.data.paid_amount, outstanding: partial.data.outstanding_amount, paymentState: partial.data.payment_state }, { paid: 305.25, outstanding: 800, paymentState: 'PARTIALLY_PAID' });
  const paid = await request('POST', `/vendor/invoices/${state.invoiceId}/payments`, { amount: '800.00', currency: 'INR', reference: 'M23-FINAL' }, state.vendorA.token);
  assert.equal(paid.status, 201);
  assert.deepEqual({ paid: paid.data.paid_amount, outstanding: paid.data.outstanding_amount, paymentState: paid.data.payment_state }, { paid: 1105.25, outstanding: 0, paymentState: 'PAID' });
  assert.equal((await request('POST', `/vendor/invoices/${state.invoiceId}/payments`, { amount: '0.01', currency: 'INR' }, state.vendorA.token)).status, 409);

  const corrected = await request('PATCH', `/contractor/timesheets/${rejectedId}`, {
    workDate: day(0), hoursLogged: 2, description: 'Corrected M23 work',
  }, state.contractorB.token);
  assert.equal(corrected.status, 200, JSON.stringify(corrected.data));
  assert.equal((await request('POST', '/contractor/timesheets/submit', { timesheetIds: [rejectedId] }, state.contractorB.token)).status, 200);
  assert.equal((await request('PATCH', `/pm/timesheets/${rejectedId}`, { status: 'APPROVED' }, state.pmA.token)).status, 200);
  const lateMilestone = await request('POST', '/pm/milestones', {
    project_id: state.project.id, name: 'M23 Late Billing', threshold_hours: 10,
    description: 'Uninvoiced contribution used for revocation scope verification', sequence_order: 2,
  }, state.pmA.token);
  assert.equal(lateMilestone.status, 201);
  const [[unbilled]] = await pool.query('SELECT id FROM milestone_billings WHERE milestone_id=?', [lateMilestone.data.id]);
  assert.ok(unbilled, 'late-created satisfied milestone must create an uninvoiced contribution');
  state.unbilledBillingId = unbilled.id;

  const before = await pool.query(`SELECT pa.bill_rate_snapshot,pa.cost_rate_snapshot,pa.currency assignment_currency,mb.approved_hours,mb.hourly_rate,mb.currency billing_currency,mb.billing_amount,ii.bill_rate,ii.amount,i.subtotal_amount,i.tax_amount,i.adjustment_amount,i.total_amount,i.pdf_storage_key,(SELECT SUM(amount) FROM payments WHERE invoice_id=i.id) paid_amount FROM project_assignments pa JOIN milestone_billings mb ON mb.contractor_id=pa.contractor_id JOIN invoice_items ii ON ii.milestone_billing_id=mb.id JOIN invoices i ON i.id=ii.invoice_id WHERE pa.id=? AND i.id=?`, [state.assignmentId, state.invoiceId]);
  state.financialSnapshot = before[0][0];

  const futureRate = await request('POST', '/vendor/rate-cards', {
    client_company_id: state.companyId, skill_id: skill.id, effective_from: day(11), effective_to: null,
    bill_rate: 200, cost_rate: 120, currency: 'INR',
  }, state.vendorA.token);
  assert.equal(futureRate.status, 201);
  assert.equal((await request('PATCH', `/pm/timesheets/${state.submittedTimesheetId}`, { status: 'REJECTED', rejectionReason: 'Not approved work.' }, state.pmA.token)).status, 200);
  assert.equal((await request('PATCH', `/pm/projects/${state.project.id}/complete`, undefined, state.pmA.token)).status, 200);
  assert.equal((await request('PATCH', `/vendor/contractors/${state.contractorId}`, { status: 'INACTIVE', hourly_rate: 999 }, state.vendorA.token)).status, 200);

  const afterRows = await pool.query(`SELECT pa.bill_rate_snapshot,pa.cost_rate_snapshot,pa.currency assignment_currency,mb.approved_hours,mb.hourly_rate,mb.currency billing_currency,mb.billing_amount,ii.bill_rate,ii.amount,i.subtotal_amount,i.tax_amount,i.adjustment_amount,i.total_amount,i.pdf_storage_key,(SELECT SUM(amount) FROM payments WHERE invoice_id=i.id) paid_amount FROM project_assignments pa JOIN milestone_billings mb ON mb.contractor_id=pa.contractor_id JOIN invoice_items ii ON ii.milestone_billing_id=mb.id JOIN invoices i ON i.id=ii.invoice_id WHERE pa.id=? AND i.id=?`, [state.assignmentId, state.invoiceId]);
  assert.deepEqual(afterRows[0][0], state.financialSnapshot, 'later rate/profile/status/project mutations must not rewrite financial history');
  const frozenPdf = await request('GET', `/vendor/invoices/${state.invoiceId}/pdf`, undefined, state.vendorA.token);
  assert.equal(Buffer.compare(frozenPdf.data, state.pdfBytes), 0, 'submitted PDF must remain byte-identical');
});

test('M23 authorization matrix enforces role gates, tenant hiding, financial privacy, and revoked sourcing access', { timeout: 60000 }, async () => {
  assert.equal((await request('GET', '/pm/projects', undefined, state.vendorA.token)).status, 403);
  assert.equal((await request('GET', '/vendor/contractors', undefined, state.pmA.token)).status, 403);
  assert.equal((await request('GET', '/vendor/dashboard', undefined, state.contractorA.token)).status, 403);

  assert.equal((await request('GET', `/vendor/projects/${state.project.id}/requirements`, undefined, state.vendorB.token)).status, 404);
  assert.equal((await request('GET', `/vendor/clients/${state.companyId}`, undefined, state.vendorB.token)).status, 404);
  assert.equal((await request('GET', `/vendor/contractors/${state.contractorId}/documents`, undefined, state.vendorB.token)).status, 404);
  assert.equal((await request('GET', `/vendor/contractors/${state.contractorId}/history`, undefined, state.vendorB.token)).status, 404);
  assert.equal((await request('GET', `/pm/projects/${state.project.id}/contractors`, undefined, state.pmB.token)).status, 404);
  assert.equal((await request('GET', `/pm/milestones/${state.project.id}`, undefined, state.pmB.token)).status, 404);
  assert.equal((await request('PATCH', `/pm/candidate-submissions/${state.candidateId}`, { status: 'REJECTED', reason: 'probe' }, state.pmB.token)).status, 404);
  assert.equal((await request('PATCH', `/pm/timesheets/${state.draftTimesheetId}`, { status: 'APPROVED' }, state.pmB.token)).status, 404);
  assert.equal((await request('PATCH', `/contractor/timesheets/${state.draftTimesheetId}`, { hoursLogged: 2 }, state.pmA.token)).status, 403);
  assert.equal((await request('GET', `/vendor/clients/${state.companyId}/rate-cards`, undefined, state.vendorB.token)).status, 404);
  assert.equal((await request('GET', `/vendor/invoices/${state.invoiceId}/detail`, undefined, state.vendorB.token)).status, 404);
  assert.equal((await request('GET', `/pm/invoices/${state.invoiceId}/detail`, undefined, state.pmB.token)).status, 404);
  assert.equal((await request('GET', `/vendor/invoices/${state.invoiceId}/pdf`, undefined, state.vendorB.token)).status, 404);
  assert.equal((await request('POST', `/vendor/invoices/${state.invoiceId}/payments`, { amount: '1.00' }, state.vendorB.token)).status, 404);
  assert.equal((await request('GET', `/pm/projects/${state.project.id}/close-readiness`, undefined, state.pmB.token)).status, 404);

  const team = await request('GET', `/pm/projects/${state.project.id}/contractors`, undefined, state.pmA.token);
  assert.equal(team.status, 200);
  assert.equal(Object.hasOwn(team.data[0], 'cost_rate'), false, 'PM must not receive Vendor cost rate');
  const pmInvoice = await request('GET', `/pm/invoices/${state.invoiceId}/detail`, undefined, state.pmA.token);
  assert.equal(Object.hasOwn(pmInvoice.data.items[0], 'cost_rate'), false, 'PM invoice detail must not expose cost rate');
  const contractorDashboard = await request('GET', '/contractor/dashboard', undefined, state.contractorA.token);
  assert.equal(contractorDashboard.status, 200);
  assert.equal(JSON.stringify(contractorDashboard.data).includes('margin'), false);
  assert.equal(JSON.stringify(contractorDashboard.data).includes('cost_rate'), false);

  const foreignDashboard = await request('GET', `/vendor/dashboard?projectId=${state.project.id}`, undefined, state.vendorB.token);
  assert.equal(foreignDashboard.status, 200);
  assert.equal(foreignDashboard.data.m20.financial.approved_invoice_amount, 0);
  const foreignExport = await request('GET', `/vendor/dashboard/exports/invoices?projectId=${state.project.id}`, undefined, state.vendorB.token);
  assert.equal(foreignExport.status, 200);
  assert.match(foreignExport.data, /^"invoice_number"/);
  assert.equal(foreignExport.data.includes(state.invoiceNumber), false);
  const paymentExport = await request('GET', `/vendor/dashboard/exports/payments?projectId=${state.project.id}`, undefined, state.vendorA.token);
  assert.equal(paymentExport.status, 200);
  assert.match(paymentExport.data, /"'\*M23-PARTIAL"/, 'spreadsheet formulas in CSV values must be neutralized');

  const queueBeforeRevocation = await request('GET', '/vendor/billing-queue', undefined, state.vendorA.token);
  assert.ok(queueBeforeRevocation.data.items.some((item) => item.milestone_billing_id === state.unbilledBillingId));
  assert.equal((await request('DELETE', `/pm/vendor-access/${state.vendorA.id}`, undefined, state.pmA.token)).status, 204);
  assert.equal((await request('GET', '/vendor/billing-queue', undefined, state.vendorA.token)).data.items.length, 0, 'revocation blocks future billing queue access');
  assert.equal((await request('GET', `/vendor/projects/${state.project.id}/requirements`, undefined, state.vendorA.token)).status, 404, 'revocation blocks future sourcing');
  const historicInvoice = await request('GET', `/vendor/invoices/${state.invoiceId}/detail`, undefined, state.vendorA.token);
  assert.equal(historicInvoice.status, 200, 'revocation preserves Vendor-owned invoice history');

  assert.equal((await request('GET', '/_sample/vendor-only', undefined, state.vendorA.token)).status, 404, 'verification-only routes are retired');
  const [audits] = await pool.query("SELECT action,actor_user_id,request_id FROM audit_log WHERE entity_id IN (?,?) AND action IN ('ASSIGNMENT_CREATED','INVOICE_APPROVED','PAYMENT_RECORDED','PROJECT_COMPLETED')", [String(state.assignmentId), String(state.invoiceId)]);
  assert.ok(audits.some((row) => row.action === 'ASSIGNMENT_CREATED' && row.actor_user_id === state.pmA.id));
  assert.ok(audits.some((row) => row.action === 'INVOICE_APPROVED' && row.actor_user_id === state.pmA.id));
});
