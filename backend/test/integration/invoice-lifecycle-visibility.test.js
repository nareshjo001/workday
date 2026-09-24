process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'vms_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'invoice-lifecycle-visibility-test-secret';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { resetTestDatabase } = require('../helpers/testDatabase');
const { pool } = require('../../src/config/db');
const storage = require('../../src/services/documentStorageService');
const app = require('../../src/app');

let server;
let baseUrl;
let sequence = 0;
const state = { invoices: {} };

const email = (label) => `invoice-visibility-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${++sequence}@test.example`;

async function request(method, path, body, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/pdf')
    ? Buffer.from(await response.arrayBuffer())
    : await response.json().catch(() => null);
  return { status: response.status, data };
}

async function signup(role, label) {
  const address = email(label);
  const password = 'Password123!';
  const payload = { name: `Invoice Visibility ${label}`, email: address, password, role };
  if (role === 'PM') payload.companyName = `Invoice Visibility ${label} Company`;
  assert.equal((await request('POST', '/auth/signup', payload)).status, 201);
  const login = await request('POST', '/auth/login', { email: address, password });
  assert.equal(login.status, 200);
  return { id: login.data.user.id, token: login.data.token };
}

before(async () => {
  await resetTestDatabase();
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  state.pm = await signup('PM', 'PM');
  state.otherPm = await signup('PM', 'Other PM');
  state.vendor = await signup('VENDOR', 'Vendor');

  const project = await request('POST', '/pm/projects', {
    name: 'Invoice Visibility Project',
    start_date: '2030-01-01',
    end_date: '2030-12-31',
    expected_hours: 80,
    requirements: [{ skill: 'BACKEND', required_count: 1 }],
  }, state.pm.token);
  assert.equal(project.status, 201, JSON.stringify(project.data));
  state.project = project.data;

  const contractor = await request('POST', '/vendor/contractors', {
    name: 'Invoice Visibility Contractor',
    email: email('contractor'),
    password: 'Password123!',
    hourly_rate: 75,
  }, state.vendor.token);
  assert.equal(contractor.status, 201, JSON.stringify(contractor.data));
  state.contractorId = contractor.data.id;

  const pdf = await storage.store({
    contentBase64: Buffer.from('%PDF-invoice-visibility').toString('base64'),
    mimeType: 'application/pdf',
  });

  const statuses = ['DRAFT', 'CANCELLED', 'SUBMITTED', 'APPROVED', 'REJECTED'];
  for (const [index, status] of statuses.entries()) {
    const [created] = await pool.query(
      `INSERT INTO invoices
        (invoice_number,project_id,contractor_id,vendor_id,currency,amount,subtotal_amount,total_amount,status,generated_at,pdf_storage_key,pdf_size_bytes,pdf_generated_at)
       VALUES (?,?,?,?,?,100,100,100,?,DATE_ADD('2030-01-01 00:00:00', INTERVAL ? SECOND),?,?,NOW())`,
      [status === 'DRAFT' ? null : `VIS-${status}`, state.project.id, state.contractorId, state.vendor.id, 'USD', status, index, pdf.key, pdf.sizeBytes],
    );
    state.invoices[status] = created.insertId;
  }
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('PM invoice list applies lifecycle visibility to rows, filters, and pagination totals', async () => {
  const page = await request('GET', '/pm/invoices?page=1&pageSize=2', undefined, state.pm.token);
  assert.equal(page.status, 200, JSON.stringify(page.data));
  assert.equal(page.data.total, 3);
  assert.equal(page.data.total_pages, 2);
  assert.equal(page.data.items.length, 2);
  assert.ok(page.data.items.every((invoice) => ['SUBMITTED', 'APPROVED', 'REJECTED'].includes(invoice.status)));

  const secondPage = await request('GET', '/pm/invoices?page=2&pageSize=2', undefined, state.pm.token);
  assert.equal(secondPage.status, 200, JSON.stringify(secondPage.data));
  assert.equal(secondPage.data.total, 3);
  assert.equal(secondPage.data.items.length, 1);

  for (const hiddenStatus of ['DRAFT', 'CANCELLED']) {
    const hidden = await request('GET', `/pm/invoices?status=${hiddenStatus}`, undefined, state.pm.token);
    assert.equal(hidden.status, 200, JSON.stringify(hidden.data));
    assert.equal(hidden.data.total, 0);
    assert.deepEqual(hidden.data.items, []);
  }

  for (const visibleStatus of ['SUBMITTED', 'APPROVED', 'REJECTED']) {
    const visible = await request('GET', `/pm/invoices?status=${visibleStatus}`, undefined, state.pm.token);
    assert.equal(visible.status, 200, JSON.stringify(visible.data));
    assert.equal(visible.data.total, 1);
    assert.equal(visible.data.items[0].status, visibleStatus);
  }
});

test('PM direct detail and PDF access use the same lifecycle visibility bound', async () => {
  for (const hiddenStatus of ['DRAFT', 'CANCELLED']) {
    const invoiceId = state.invoices[hiddenStatus];
    assert.equal((await request('GET', `/pm/invoices/${invoiceId}/detail`, undefined, state.pm.token)).status, 404);
    assert.equal((await request('GET', `/pm/invoices/${invoiceId}/pdf`, undefined, state.pm.token)).status, 404);
  }

  for (const visibleStatus of ['SUBMITTED', 'APPROVED', 'REJECTED']) {
    const invoiceId = state.invoices[visibleStatus];
    assert.equal((await request('GET', `/pm/invoices/${invoiceId}/detail`, undefined, state.pm.token)).status, 200);
  }

  const submittedPdf = await request('GET', `/pm/invoices/${state.invoices.SUBMITTED}/pdf`, undefined, state.pm.token);
  assert.equal(submittedPdf.status, 200);
  assert.equal(submittedPdf.data.subarray(0, 5).toString(), '%PDF-');
  assert.equal((await request('GET', `/pm/invoices/${state.invoices.SUBMITTED}/detail`, undefined, state.otherPm.token)).status, 404);
});

test('Vendor draft visibility and edit access remain unchanged', async () => {
  const vendorList = await request('GET', '/vendor/invoices?pageSize=25', undefined, state.vendor.token);
  assert.equal(vendorList.status, 200, JSON.stringify(vendorList.data));
  assert.equal(vendorList.data.total, 5);
  assert.ok(vendorList.data.items.some((invoice) => invoice.id === state.invoices.DRAFT && invoice.status === 'DRAFT'));
  assert.equal((await request('GET', `/vendor/invoices/${state.invoices.DRAFT}/detail`, undefined, state.vendor.token)).status, 200);
  assert.equal((await request('GET', `/vendor/invoices/${state.invoices.DRAFT}/pdf`, undefined, state.vendor.token)).status, 200);

  const updated = await request('PATCH', `/vendor/invoices/${state.invoices.DRAFT}`, {
    invoice_date: '2030-01-02',
    payment_terms_days: 45,
  }, state.vendor.token);
  assert.equal(updated.status, 200, JSON.stringify(updated.data));
  assert.equal(updated.data.status, 'DRAFT');
  assert.equal(updated.data.payment_terms_days, 45);
});
