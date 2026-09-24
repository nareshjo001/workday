process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "vms_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "contractor-draft-edit-secret";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { resetTestDatabase } = require("../helpers/testDatabase");
const { utcToday } = require("../helpers/workDate");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");

let server;
let baseUrl;
let serial = 0;
const unique = (prefix) => `${prefix}-${Date.now()}-${++serial}@test.example`;

async function request(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, data: await response.json() };
}

async function signup(role, email) {
  const password = "Password123!";
  const body = { name: role, email, password, role };
  if (role === "PM") body.companyName = "Draft Edit Test Co";
  assert.equal((await request("POST", "/auth/signup", body)).response.status, 201);
  const login = await request("POST", "/auth/login", { email, password });
  assert.equal(login.response.status, 200);
  return { token: login.data.token, password, id: login.data.user?.id };
}

before(async () => {
  await resetTestDatabase();
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test("Contractor draft and rejected timesheet lifecycle edits", { timeout: 60000 }, async () => {
  const workDate = utcToday();
  const pm = await signup("PM", unique("pm"));
  const vendor = await signup("VENDOR", unique("vendor"));

  // Create Contractor 1
  const contractorEmail1 = unique("contractor1");
  const created1 = await request("POST", "/vendor/contractors", {
    name: "Contractor One",
    email: contractorEmail1,
    password: "Password123!",
    hourly_rate: 65,
  }, vendor.token);
  assert.equal(created1.response.status, 201);
  const contractorId1 = created1.data.id;
  const login1 = await request("POST", "/auth/login", { email: contractorEmail1, password: "Password123!" });
  const contractor1Token = login1.data.token;
  await request("PATCH", "/contractor/profile/skill", { skill: "BACKEND" }, contractor1Token);

  // Create Contractor 2 (for cross-contractor isolation check)
  const contractorEmail2 = unique("contractor2");
  const created2 = await request("POST", "/vendor/contractors", {
    name: "Contractor Two",
    email: contractorEmail2,
    password: "Password123!",
    hourly_rate: 75,
  }, vendor.token);
  assert.equal(created2.response.status, 201);
  const login2 = await request("POST", "/auth/login", { email: contractorEmail2, password: "Password123!" });
  const contractor2Token = login2.data.token;

  // Create project with allocation for Contractor 1
  const project = await request("POST", "/pm/projects", {
    name: "Draft Edit Project",
    start_date: workDate,
    expected_hours: 40,
    requirements: [{ skill: "BACKEND", required_count: 1 }],
  }, pm.token);
  assert.equal(project.response.status, 201);
  const projectId = project.data.id;
  const requirementId = project.data.requirements[0].id;

  await request("PATCH", `/pm/projects/${projectId}`, { allow_weekend: true }, pm.token);

  const submission = await request("POST", `/vendor/projects/${projectId}/requirements/${requirementId}/candidates`, {
    contractor_id: contractorId1,
  }, vendor.token);
  assert.equal(submission.response.status, 201);

  await request("PATCH", `/pm/candidate-submissions/${submission.data.id}`, { status: "ACCEPTED" }, pm.token);
  await request("PATCH", `/pm/projects/${projectId}/contractors/${contractorId1}/allocation`, { allocated_hours: 40 }, pm.token);

  // 1. Create a DRAFT
  const draft = await request("POST", "/contractor/timesheets", {
    projectId,
    workDate,
    hoursLogged: 4,
    description: "Initial draft text",
  }, contractor1Token);
  assert.equal(draft.response.status, 201);
  assert.equal(draft.data.status, "DRAFT");
  assert.equal(draft.data.submitted_at, null);
  const draftId = draft.data.id;

  // 2. Contractor can edit own DRAFT; DRAFT edit remains DRAFT and updated values persist
  const draftEdit = await request("PATCH", `/contractor/timesheets/${draftId}`, {
    workDate,
    hoursLogged: 5,
    description: "Updated draft description",
  }, contractor1Token);
  assert.equal(draftEdit.response.status, 200);
  assert.equal(draftEdit.data.status, "DRAFT");
  assert.equal(draftEdit.data.hours_logged, 5);
  assert.equal(draftEdit.data.description, "Updated draft description");
  assert.equal(draftEdit.data.submitted_at, null);
  assert.equal(draftEdit.data.reviewed_at, null);

  // 3. Contractor cannot edit another contractor's record (returns 404)
  const crossContractorEdit = await request("PATCH", `/contractor/timesheets/${draftId}`, {
    workDate,
    hoursLogged: 6,
    description: "Malicious attempt",
  }, contractor2Token);
  assert.equal(crossContractorEdit.response.status, 404);

  // 4. Submit the edited draft -> status becomes SUBMITTED
  const submitRes = await request("POST", "/contractor/timesheets/submit", { timesheetIds: [draftId] }, contractor1Token);
  assert.equal(submitRes.response.status, 200);

  // 5. SUBMITTED edit returns 409
  const submittedEdit = await request("PATCH", `/contractor/timesheets/${draftId}`, {
    workDate,
    hoursLogged: 6,
    description: "Cannot edit submitted",
  }, contractor1Token);
  assert.equal(submittedEdit.response.status, 409);
  assert.match(submittedEdit.data.message, /only draft and rejected timesheets can be edited/i);

  // 6. PM rejects the timesheet
  const rejectRes = await request("PATCH", `/pm/timesheets/${draftId}`, {
    status: "REJECTED",
    rejectionReason: "Missing ticket link.",
  }, pm.token);
  assert.equal(rejectRes.response.status, 200);
  assert.equal(rejectRes.data.status, "REJECTED");
  assert.equal(rejectRes.data.rejection_reason, "Missing ticket link.");

  // 7. Contractor can edit own REJECTED; REJECTED edit returns to DRAFT as currently designed
  const rejectedEdit = await request("PATCH", `/contractor/timesheets/${draftId}`, {
    workDate,
    hoursLogged: 5.5,
    description: "Fixed ticket link",
  }, contractor1Token);
  assert.equal(rejectedEdit.response.status, 200);
  assert.equal(rejectedEdit.data.status, "DRAFT");
  assert.equal(rejectedEdit.data.hours_logged, 5.5);
  assert.equal(rejectedEdit.data.description, "Fixed ticket link");
  assert.equal(rejectedEdit.data.rejection_reason, null);

  // 8. Resubmit the corrected draft
  const resubmitRes = await request("POST", "/contractor/timesheets/submit", { timesheetIds: [draftId] }, contractor1Token);
  assert.equal(resubmitRes.response.status, 200);

  // 9. PM approves the timesheet
  const approveRes = await request("PATCH", "/pm/timesheets/bulk-review", {
    timesheetIds: [draftId],
    status: "APPROVED",
  }, pm.token);
  assert.equal(approveRes.response.status, 200);

  // 10. APPROVED edit returns 409
  const approvedEdit = await request("PATCH", `/contractor/timesheets/${draftId}`, {
    workDate,
    hoursLogged: 7,
    description: "Cannot edit approved",
  }, contractor1Token);
  assert.equal(approvedEdit.response.status, 409);
  assert.match(approvedEdit.data.message, /only draft and rejected timesheets can be edited/i);
});
