process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "m31-test-only-secret";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");

let server; let base; let sequence = 0; let pool; let app; let notifications; let reminders; const state = {};
const email = (label) => `m31-${String(label).replace(/[^a-z0-9]/gi, "-")}-${Date.now()}-${++sequence}@test.local`;
const today = () => new Date().toISOString().slice(0, 10);

async function request(method, path, body, token) {
  const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json().catch(() => null) };
}
async function signup(role, label) {
  const result = await request("POST", "/auth/signup", { name: label, email: email(label), password: "Password123!", role, ...(role === "PM" ? { companyName: `${label} Company` } : {}) });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  const login = await request("POST", "/auth/login", { email: result.data.user.email, password: "Password123!" });
  assert.equal(login.status, 200, JSON.stringify(login.data));
  return { id: login.data.user.id, token: login.data.token };
}
async function project(pm, label) {
  const result = await request("POST", "/pm/projects", { name: `M31 ${label}`, start_date: new Date().toISOString().slice(0, 10), expected_hours: 40, requirements: [{ skill: "BACKEND", required_count: 1 }] }, pm.token);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return result.data;
}
async function contractor(label) {
  const contractorEmail = email(label);
  const result = await request("POST", "/vendor/contractors", { name: label, email: contractorEmail, password: "Password123!", hourly_rate: 80 }, state.vendor.token);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  const login = await request("POST", "/auth/login", { email: contractorEmail, password: "Password123!" });
  assert.equal(login.status, 200, JSON.stringify(login.data));
  return { id: result.data.id, token: login.data.token };
}
async function notificationFor(eventType, entityId) {
  const [rows] = await pool.query("SELECT * FROM notifications WHERE event_type=? AND entity_id=?", [eventType, entityId]);
  return rows;
}
async function insertInvoice(projectRow, status, total = 100) {
  const [company] = await pool.query("SELECT company_id FROM project_managers WHERE user_id=?", [projectRow.pm_id]);
  const result = await pool.query("INSERT INTO invoices (project_id,contractor_id,vendor_id,client_company_id,currency,invoice_date,payment_terms_days,tax_rate,amount,subtotal_amount,tax_amount,adjustment_amount,total_amount,status,generated_at,submitted_at,document_version) VALUES (?,?,?,?, 'USD',CURDATE(),30,0,?,?,0,0,?,?,NOW(),NOW(),1)", [projectRow.id, state.contractorId, state.vendor.id, company[0].company_id, total, total, total, status]);
  return result[0].insertId;
}
async function assignedContractor(label, projectRow) {
  const account = await contractor(label);
  await pool.query("UPDATE projects SET allow_weekend=1 WHERE id=?", [projectRow.id]);
  await pool.query("INSERT INTO project_assignments (contractor_id,project_id,requirement_id,allocated_hours,assigned_date,start_date,status) VALUES (?,?,?,?,CURDATE(),CURDATE(),'ACTIVE')", [account.id, projectRow.id, projectRow.requirements[0].id, 40]);
  return account;
}
async function draftInvoiceForLifecycle(projectRow) {
  const [milestone] = await pool.query("INSERT INTO milestones (project_id,name,threshold_hours,status,met_at) VALUES (?,'M31 lifecycle billing',1,'MET',NOW())", [projectRow.id]);
  const [billing] = await pool.query("INSERT INTO milestone_billings (milestone_id,contractor_id,approved_hours,hourly_rate,currency,billing_amount) VALUES (?,?,1,100,'USD',100)", [milestone.insertId, state.contractorId]);
  const [company] = await pool.query("SELECT company_id FROM project_managers WHERE user_id=?", [projectRow.pm_id]);
  const [invoice] = await pool.query("INSERT INTO invoices (milestone_billing_id,project_id,contractor_id,vendor_id,client_company_id,currency,invoice_date,payment_terms_days,tax_rate,amount,subtotal_amount,tax_amount,adjustment_amount,total_amount,status,generated_at,submitted_at,document_version) VALUES (?,?,?,?,?,'USD',CURDATE(),30,0,100,100,0,0,100,'DRAFT',NOW(),NULL,1)", [billing.insertId, projectRow.id, state.contractorId, state.vendor.id, company[0].company_id]);
  await pool.query("INSERT INTO invoice_items (invoice_id,milestone_billing_id,approved_hours,bill_rate,amount) VALUES (?,?,1,100,100)", [invoice.insertId, billing.insertId]);
  return invoice.insertId;
}

before(async () => {
  await resetTestDatabase();
  ({ pool } = require("../../src/config/db"));
  app = require("../../src/app");
  notifications = require("../../src/services/notificationService");
  reminders = require("../../src/services/reminderService");
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
  state.pm = await signup("PM", "Target PM"); state.otherPm = await signup("PM", "Other PM"); state.vendor = await signup("VENDOR", "Vendor"); state.otherVendor = await signup("VENDOR", "Other Vendor");
  const contractorAccount = await contractor("M31 Contractor");
  state.contractorId = contractorAccount.id; state.contractorToken = contractorAccount.token;
  state.project = await project(state.pm, "Target"); state.project.pm_id = state.pm.id;
  state.otherProject = await project(state.otherPm, "Other"); state.otherProject.pm_id = state.otherPm.id;
});
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); if (pool) await pool.end(); });

test("M31 migration adds non-null lifecycle dedupe while preserving empty-key dedupe", async () => {
  await pool.query("ALTER TABLE notifications DROP INDEX uq_notification_event_lifecycle, DROP COLUMN lifecycle_key, ADD UNIQUE KEY uq_notification_event (recipient_id,event_type,entity_type,entity_id)");
  const [audit] = await pool.query("INSERT INTO audit_log (actor_user_id,actor_role,action,entity_type,entity_id,request_id) VALUES (?,'PM','TIMESHEET_SUBMITTED','timesheet','987653','m31_migration_history')", [state.pm.id]);
  const [history] = await pool.query("INSERT INTO notifications (recipient_id,event_type,entity_type,entity_id,message,deep_link) VALUES (?,'TIMESHEET_SUBMITTED','timesheet',987653,'Historical reminder.','/pm/timesheets')", [state.pm.id]);
  const migrationSql = fs.readFileSync(path.join(__dirname, "../../src/migrations/038_notification_lifecycle_dedupe.sql"), "utf8");
  for (const statement of migrationSql.split(";").map((value) => value.trim()).filter(Boolean)) await pool.query(statement);
  const [[preserved]] = await pool.query("SELECT id,message,lifecycle_key FROM notifications WHERE id=?", [history.insertId]);
  assert.deepEqual(preserved, { id: history.insertId, message: "Historical reminder.", lifecycle_key: `submission:${audit.insertId}` });

  const [columns] = await pool.query("SELECT IS_NULLABLE,COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='notifications' AND COLUMN_NAME='lifecycle_key'");
  assert.equal(columns.length, 1); assert.equal(columns[0].IS_NULLABLE, "NO"); assert.equal(columns[0].COLUMN_DEFAULT, "");
  const [indexRows] = await pool.query("SELECT COLUMN_NAME,SEQ_IN_INDEX FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='notifications' AND INDEX_NAME='uq_notification_event_lifecycle' ORDER BY SEQ_IN_INDEX");
  assert.deepEqual(indexRows.map((row) => row.COLUMN_NAME), ["recipient_id", "event_type", "entity_type", "entity_id", "lifecycle_key"]);
  const item = { recipientId: state.pm.id, eventType: "CANDIDATE_SUBMITTED", entityType: "candidate_submission", entityId: 987654, message: "Migration dedupe check.", deepLink: "/pm/staffing-pipeline" };
  assert.equal(await notifications.notifyDetailed(item), "created");
  assert.equal(await notifications.notifyDetailed(item), "deduplicated");
  const [rows] = await pool.query("SELECT lifecycle_key FROM notifications WHERE recipient_id=? AND event_type=? AND entity_id=?", [state.pm.id, item.eventType, item.entityId]);
  assert.deepEqual(rows.map((row) => row.lifecycle_key), [""]);
});

test("M31 creates current PM reminders only for submitted entities and preserves business state", async () => {
  const p = state.project; const other = state.otherProject;
  const [time] = await pool.query("INSERT INTO timesheets (contractor_id,project_id,work_date,hours_logged,status,submitted_at) VALUES (?, ?, CURDATE(),4,'SUBMITTED',NOW())", [state.contractorId, p.id]);
  await pool.query("INSERT INTO timesheets (contractor_id,project_id,work_date,hours_logged,status,submitted_at) VALUES (?, ?,DATE_ADD(CURDATE(),INTERVAL 1 DAY),4,'APPROVED',NOW()), (?, ?,DATE_ADD(CURDATE(),INTERVAL 2 DAY),4,'REJECTED',NOW())", [state.contractorId, p.id, state.contractorId, p.id]);
  const [candidate] = await pool.query("INSERT INTO candidate_submissions (project_id,requirement_id,contractor_id,vendor_id,status,proposed_start_date,submitted_at) VALUES (?,?,?,?, 'SUBMITTED',CURDATE(),NOW())", [p.id, p.requirements[0].id, state.contractorId, state.vendor.id]);
  await pool.query("INSERT INTO candidate_submissions (project_id,requirement_id,contractor_id,vendor_id,status,proposed_start_date,submitted_at) VALUES (?,?,?,?, 'ACCEPTED',CURDATE(),NOW()), (?,?,?,?, 'REJECTED',CURDATE(),NOW())", [p.id, p.requirements[0].id, state.contractorId, state.vendor.id, p.id, p.requirements[0].id, state.contractorId, state.vendor.id]);
  const invoiceId = await insertInvoice(p, "SUBMITTED"); const approvedInvoice = await insertInvoice(p, "APPROVED"); const rejectedInvoice = await insertInvoice(p, "REJECTED");
  const [otherTime] = await pool.query("INSERT INTO timesheets (contractor_id,project_id,work_date,hours_logged,status,submitted_at) VALUES (?, ?,DATE_ADD(CURDATE(),INTERVAL 3 DAY),4,'SUBMITTED',NOW())", [state.contractorId, other.id]);
  const before = await Promise.all(["timesheets", "candidate_submissions", "invoices", "projects", "audit_log"].map(async (table) => [table, (await pool.query(`SELECT * FROM ${table} ORDER BY id`))[0]]));
  const result = await reminders.runDueReminders();
  assert.ok(result.created >= 4);
  const checks = [["TIMESHEET_SUBMITTED", time.insertId, state.pm.id, "/pm/timesheets"], ["CANDIDATE_SUBMITTED", candidate.insertId, state.pm.id, "/pm/staffing-pipeline"], ["INVOICE_SUBMITTED", invoiceId, state.pm.id, "/pm/invoices"]];
  for (const [eventType, entityId, recipientId, deepLink] of checks) { const rows = await notificationFor(eventType, entityId); assert.equal(rows.length, 1); assert.equal(rows[0].recipient_id, recipientId); assert.equal(rows[0].deep_link, deepLink); assert.equal(/cost|margin/i.test(rows[0].message), false); assert.equal(rows[0].lifecycle_key === "", eventType === "CANDIDATE_SUBMITTED"); }
  assert.equal((await notificationFor("INVOICE_SUBMITTED", approvedInvoice)).length, 0); assert.equal((await notificationFor("INVOICE_SUBMITTED", rejectedInvoice)).length, 0);
  const otherRows = await notificationFor("TIMESHEET_SUBMITTED", otherTime.insertId); assert.equal(otherRows.length, 1); assert.equal(otherRows[0].recipient_id, state.otherPm.id);
  const after = await Promise.all(["timesheets", "candidate_submissions", "invoices", "projects", "audit_log"].map(async (table) => [table, (await pool.query(`SELECT * FROM ${table} ORDER BY id`))[0]]));
  assert.deepEqual(after, before);
});

test("M31 respects current per-recipient preferences and does not let one PM preference affect another", async () => {
  await pool.query("UPDATE candidate_submissions SET status='WITHDRAWN' WHERE project_id=? AND status='SUBMITTED'", [state.project.id]);
  const [targetCandidate] = await pool.query("INSERT INTO candidate_submissions (project_id,requirement_id,contractor_id,vendor_id,status,proposed_start_date,submitted_at) VALUES (?,?,?,?, 'SUBMITTED',CURDATE(),NOW())", [state.project.id, state.project.requirements[0].id, state.contractorId, state.vendor.id]);
  const [otherCandidate] = await pool.query("INSERT INTO candidate_submissions (project_id,requirement_id,contractor_id,vendor_id,status,proposed_start_date,submitted_at) VALUES (?,?,?,?, 'SUBMITTED',CURDATE(),NOW())", [state.otherProject.id, state.otherProject.requirements[0].id, state.contractorId, state.vendor.id]);
  await notifications.setPreference(state.pm.id, "CANDIDATE_SUBMITTED", false);
  const skipped = await reminders.runDueReminders(); assert.ok(skipped.preference_skipped >= 1);
  assert.equal((await notificationFor("CANDIDATE_SUBMITTED", targetCandidate.insertId)).length, 0);
  const otherRows = await notificationFor("CANDIDATE_SUBMITTED", otherCandidate.insertId); assert.equal(otherRows.length, 1); assert.equal(otherRows[0].recipient_id, state.otherPm.id);
  await notifications.setPreference(state.pm.id, "CANDIDATE_SUBMITTED", true);
  await reminders.runDueReminders(); assert.equal((await notificationFor("CANDIDATE_SUBMITTED", targetCandidate.insertId)).length, 1);
});

test("M31 deduplicates repeated and concurrent runs, and does not create a separate rejected-timesheet reminder", async () => {
  const [submitted] = await pool.query("INSERT INTO timesheets (contractor_id,project_id,work_date,hours_logged,status,submitted_at) VALUES (?, ?,DATE_ADD(CURDATE(),INTERVAL 4 DAY),4,'SUBMITTED',NOW())", [state.contractorId, state.project.id]);
  const [rejected] = await pool.query("INSERT INTO timesheets (contractor_id,project_id,work_date,hours_logged,status,submitted_at) VALUES (?, ?,DATE_ADD(CURDATE(),INTERVAL 5 DAY),4,'REJECTED',NOW())", [state.contractorId, state.project.id]);
  const [first, second] = await Promise.all([reminders.runDueReminders(), reminders.runDueReminders()]);
  assert.equal((await notificationFor("TIMESHEET_SUBMITTED", submitted.insertId)).length, 1);
  assert.equal((await notificationFor("TIMESHEET_REJECTED", rejected.insertId)).length, 0);
  assert.ok(first.deduplicated + second.deduplicated >= 1);
});

test("M31 reminds only the owning Vendor about expiring verified documents", async () => {
  const [expiring] = await pool.query("INSERT INTO contractor_documents (contractor_id,document_type,storage_key,original_filename,mime_type,size_bytes,status,expiry_date) VALUES (?, 'IDENTITY','m31-expiring','expiring.pdf','application/pdf',1,'VERIFIED',DATE_ADD(CURDATE(),INTERVAL 10 DAY))", [state.contractorId]);
  const [longValid] = await pool.query("INSERT INTO contractor_documents (contractor_id,document_type,storage_key,original_filename,mime_type,size_bytes,status,expiry_date) VALUES (?, 'TAX','m31-long','long.pdf','application/pdf',1,'VERIFIED',DATE_ADD(CURDATE(),INTERVAL 31 DAY))", [state.contractorId]);
  const otherContractor = await request("POST", "/vendor/contractors", { name: "M31 Other Vendor Contractor", email: email("other-vendor-contractor"), password: "Password123!", hourly_rate: 80 }, state.otherVendor.token);
  assert.equal(otherContractor.status, 201, JSON.stringify(otherContractor.data));
  const [otherVendorDocument] = await pool.query("INSERT INTO contractor_documents (contractor_id,document_type,storage_key,original_filename,mime_type,size_bytes,status,expiry_date) VALUES (?, 'IDENTITY','m31-other-vendor','other.pdf','application/pdf',1,'VERIFIED',DATE_ADD(CURDATE(),INTERVAL 10 DAY))", [otherContractor.data.id]);
  const inbox = await request("GET", "/vendor/notifications", undefined, state.vendor.token);
  assert.equal(inbox.status, 200); assert.equal((await notificationFor("DOCUMENT_EXPIRING", expiring.insertId)).length, 0, "reading an inbox must not run global reminders");
  await reminders.runDueReminders();
  const rows = await notificationFor("DOCUMENT_EXPIRING", expiring.insertId); assert.equal(rows.length, 1); assert.equal(rows[0].recipient_id, state.vendor.id); assert.equal(rows[0].deep_link, "/vendor/compliance"); assert.equal(rows[0].lifecycle_key, "");
  const otherVendorRows = await notificationFor("DOCUMENT_EXPIRING", otherVendorDocument.insertId); assert.equal(otherVendorRows.length, 1); assert.equal(otherVendorRows[0].recipient_id, state.otherVendor.id);
  assert.equal((await notificationFor("DOCUMENT_EXPIRING", longValid.insertId)).length, 0);
  await pool.query("UPDATE contractor_documents SET status='REJECTED' WHERE id=?", [expiring.insertId]);
  await reminders.runDueReminders(); assert.equal((await notificationFor("DOCUMENT_EXPIRING", expiring.insertId)).length, 1);
});

test("M31 gives a resubmitted timesheet one notification per audit lifecycle", async () => {
  const account = await assignedContractor("M31 Timesheet Lifecycle", state.project);
  const draft = await request("POST", "/contractor/timesheets", { projectId: state.project.id, workDate: today(), hoursLogged: 4, description: "Lifecycle A" }, account.token);
  assert.equal(draft.status, 201, JSON.stringify(draft.data));
  const firstSubmit = await request("POST", "/contractor/timesheets/submit", { timesheetIds: [draft.data.id] }, account.token);
  assert.equal(firstSubmit.status, 200, JSON.stringify(firstSubmit.data));
  let rows = await notificationFor("TIMESHEET_SUBMITTED", draft.data.id);
  assert.equal(rows.length, 1); assert.match(rows[0].lifecycle_key, /^submission:\d+$/);
  await Promise.all([reminders.runDueReminders(), reminders.runDueReminders()]);
  assert.equal((await notificationFor("TIMESHEET_SUBMITTED", draft.data.id)).length, 1, "scheduled and synchronous producers must dedupe");

  const rejected = await request("PATCH", `/pm/timesheets/${draft.data.id}`, { status: "REJECTED", rejectionReason: "Correct and resubmit." }, state.pm.token);
  assert.equal(rejected.status, 200, JSON.stringify(rejected.data));
  const corrected = await request("PATCH", `/contractor/timesheets/${draft.data.id}`, { workDate: today(), hoursLogged: 4, description: "Lifecycle B" }, account.token);
  assert.equal(corrected.status, 200, JSON.stringify(corrected.data));
  const secondSubmit = await request("POST", "/contractor/timesheets/submit", { timesheetIds: [draft.data.id] }, account.token);
  assert.equal(secondSubmit.status, 200, JSON.stringify(secondSubmit.data));
  rows = await notificationFor("TIMESHEET_SUBMITTED", draft.data.id);
  assert.equal(rows.length, 2); assert.equal(new Set(rows.map((row) => row.lifecycle_key)).size, 2);
  await reminders.runDueReminders();
  assert.equal((await notificationFor("TIMESHEET_SUBMITTED", draft.data.id)).length, 2);
  const [audits] = await pool.query("SELECT id FROM audit_log WHERE action='TIMESHEET_SUBMITTED' AND entity_type='timesheet' AND entity_id=? ORDER BY id", [String(draft.data.id)]);
  assert.equal(audits.length, 2);
});

test("M31 gives a resubmitted invoice one notification per audit lifecycle", async () => {
  const invoiceId = await draftInvoiceForLifecycle(state.project);
  const firstSubmit = await request("POST", `/vendor/invoices/${invoiceId}/submit`, undefined, state.vendor.token);
  assert.equal(firstSubmit.status, 200, JSON.stringify(firstSubmit.data));
  let rows = await notificationFor("INVOICE_SUBMITTED", invoiceId);
  assert.equal(rows.length, 1); assert.match(rows[0].lifecycle_key, /^submission:\d+$/);
  await reminders.runDueReminders();
  assert.equal((await notificationFor("INVOICE_SUBMITTED", invoiceId)).length, 1, "scheduler must dedupe against synchronous invoice notification");

  const rejected = await request("PATCH", `/pm/invoices/${invoiceId}/review`, { status: "REJECTED", rejection_reason: "Revise invoice." }, state.pm.token);
  assert.equal(rejected.status, 200, JSON.stringify(rejected.data));
  const revised = await request("POST", `/vendor/invoices/${invoiceId}/revise`, undefined, state.vendor.token);
  assert.equal(revised.status, 200, JSON.stringify(revised.data));
  const secondSubmit = await request("POST", `/vendor/invoices/${invoiceId}/submit`, undefined, state.vendor.token);
  assert.equal(secondSubmit.status, 200, JSON.stringify(secondSubmit.data));
  rows = await notificationFor("INVOICE_SUBMITTED", invoiceId);
  assert.equal(rows.length, 2); assert.equal(new Set(rows.map((row) => row.lifecycle_key)).size, 2);
  await reminders.runDueReminders();
  assert.equal((await notificationFor("INVOICE_SUBMITTED", invoiceId)).length, 2);
  const [audits] = await pool.query("SELECT id FROM audit_log WHERE action='INVOICE_SUBMITTED' AND entity_type='invoice' AND entity_id=? ORDER BY id", [String(invoiceId)]);
  assert.equal(audits.length, 2);
});

test("M31 uses stable legacy fallback keys and keeps lifecycle preferences authoritative", async () => {
  const [legacy] = await pool.query("INSERT INTO timesheets (contractor_id,project_id,work_date,hours_logged,status,submitted_at) VALUES (?, ?,DATE_SUB(CURDATE(),INTERVAL 10 DAY),2,'SUBMITTED','2026-01-02 03:04:05')", [state.contractorId, state.project.id]);
  const legacyInvoiceId = await insertInvoice(state.project, "SUBMITTED");
  await pool.query("UPDATE invoices SET submitted_at='2026-01-03 04:05:06' WHERE id=?", [legacyInvoiceId]);
  await Promise.all([reminders.runDueReminders(), reminders.runDueReminders()]);
  let rows = await notificationFor("TIMESHEET_SUBMITTED", legacy.insertId);
  assert.equal(rows.length, 1); assert.equal(rows[0].lifecycle_key, "submitted_at:2026-01-02 03:04:05");
  const legacyInvoiceRows = await notificationFor("INVOICE_SUBMITTED", legacyInvoiceId);
  assert.equal(legacyInvoiceRows.length, 1); assert.equal(legacyInvoiceRows[0].lifecycle_key, "submitted_at:2026-01-03 04:05:06");

  const account = await assignedContractor("M31 Preference Lifecycle", state.otherProject);
  const draft = await request("POST", "/contractor/timesheets", { projectId: state.otherProject.id, workDate: today(), hoursLogged: 2, description: "Preference A" }, account.token);
  assert.equal(draft.status, 201, JSON.stringify(draft.data));
  assert.equal((await request("POST", "/contractor/timesheets/submit", { timesheetIds: [draft.data.id] }, account.token)).status, 200);
  assert.equal((await notificationFor("TIMESHEET_SUBMITTED", draft.data.id)).length, 1);
  assert.equal((await request("PATCH", `/pm/timesheets/${draft.data.id}`, { status: "REJECTED", rejectionReason: "Preference lifecycle." }, state.otherPm.token)).status, 200);
  assert.equal((await request("PATCH", `/contractor/timesheets/${draft.data.id}`, { workDate: today(), hoursLogged: 2, description: "Preference B" }, account.token)).status, 200);
  await notifications.setPreference(state.otherPm.id, "TIMESHEET_SUBMITTED", false);
  assert.equal((await request("POST", "/contractor/timesheets/submit", { timesheetIds: [draft.data.id] }, account.token)).status, 200);
  await reminders.runDueReminders();
  rows = await notificationFor("TIMESHEET_SUBMITTED", draft.data.id);
  assert.equal(rows.length, 1, "disabled preference must suppress the second lifecycle notification");
});
