/**
 * End-to-end smoke test for the Module 4/5/6 project-hours + project-level
 * milestone redesign. Runs against the live server on localhost:5000 with
 * real MariaDB transactions (no mocks). Exercises:
 *   - PM creates project w/ expected_hours
 *   - Vendor allocates contractors w/ allocated_hours, capacity enforced
 *   - PM creates project-level milestones
 *   - Contractors log daily hours, allocation-remaining enforced
 *   - PM approves -> project progress updates -> milestones trigger
 *   - Multi-contractor contribution apportionment (CASE 1/2/3 from spec)
 *   - Vendor approves/rejects invoices, race-safety on concurrent review
 *   - Project completion auto-releases assignments; released contractor
 *     becomes eligible for reassignment
 *
 * Not a permanent artifact of the codebase — a one-off verification
 * script for this session, run against a disposable local DB.
 *
 * SUPERSEDED — DO NOT RUN AS-IS (MVP fix session, see mvp_fix_test.js):
 * this script's CASE 2/CASE 3 assertions encode the OLD chronological
 * interval-apportionment billing algorithm, which the MVP fix
 * deliberately replaced because it was the reported bug — it billed a
 * second contractor's hours as `threshold - first_contractor_hours`
 * instead of that contractor's own actual approved hours. Those specific
 * assertions will now correctly FAIL if this file is executed unmodified.
 * `mvp_fix_test.js` is the authoritative regression suite going forward
 * (it re-covers Module 1-6 plus both MVP fixes against the CURRENT
 * per-contractor-independent billing model). This file is kept only as a
 * historical record of the pre-fix behavior it used to verify.
 */
const BASE = "http://localhost:5000/api";
let failures = 0;
let passes = 0;

function assert(cond, msg) {
  if (cond) {
    passes++;
    console.log(`  OK: ${msg}`);
  } else {
    failures++;
    console.error(`  FAIL: ${msg}`);
  }
}
function assertEqual(actual, expected, msg) {
  assert(actual === expected, `${msg} (expected ${expected}, got ${actual})`);
}
function assertClose(actual, expected, msg) {
  assert(Math.abs(Number(actual) - Number(expected)) < 0.001, `${msg} (expected ${expected}, got ${actual})`);
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch (_) {}
  return { status: res.status, body: json };
}

let counter = 0;
function uniqueEmail(prefix) {
  counter += 1;
  return `${prefix}${Date.now()}${counter}@test.local`;
}

async function signupAndLogin(role, extra = {}) {
  const email = uniqueEmail(role.toLowerCase());
  const password = "TestPass123!";
  const signupBody = { name: `${role} Test`, email, password, role, ...extra };
  const su = await req("POST", "/auth/signup", { body: signupBody });
  if (su.status !== 201) throw new Error(`signup failed for ${role}: ${JSON.stringify(su.body)}`);
  const li = await req("POST", "/auth/login", { body: { email, password } });
  if (li.status !== 200) throw new Error(`login failed for ${role}: ${JSON.stringify(li.body)}`);
  return { token: li.body.token, userId: li.body.user.id, email };
}

async function createContractor(vendorToken, hourlyRate) {
  const email = uniqueEmail("contractor");
  const password = "TestPass123!";
  const res = await req("POST", "/vendor/contractors", {
    token: vendorToken,
    body: { name: `Contractor ${email}`, email, password, hourly_rate: hourlyRate },
  });
  if (res.status !== 201) throw new Error(`create contractor failed: ${JSON.stringify(res.body)}`);
  const li = await req("POST", "/auth/login", { body: { email, password } });
  const setSkill = await req("PATCH", "/contractor/profile/skill", {
    token: li.body.token,
    body: { skill: "BACKEND" },
  });
  if (setSkill.status !== 200) throw new Error(`set skill failed: ${JSON.stringify(setSkill.body)}`);
  return { contractorId: res.body.id, token: li.body.token, userId: li.body.user.id, email };
}

function todayPlus(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function createProject(pmToken, { name, expectedHours, requiredCount }) {
  const res = await req("POST", "/pm/projects", {
    token: pmToken,
    body: {
      name,
      description: "E2E test project",
      // New projects must start today or later (pmProjectValidators) and
      // work_date can never be in the future — together that means a
      // freshly created project only has ONE valid work_date (today)
      // during a single test run. Every multi-row scenario below is
      // therefore built from MULTIPLE CONTRACTORS each submitting once
      // today, sequenced by approval order, rather than one contractor
      // submitting across several days — this still exercises the exact
      // same chronological-apportionment algorithm (it orders by
      // reviewed_at, not by contractor), just without needing the test to
      // span real calendar days.
      start_date: todayPlus(0),
      end_date: todayPlus(60),
      expected_hours: expectedHours,
      requirements: [{ skill: "BACKEND", required_count: requiredCount }],
    },
  });
  if (res.status !== 201) throw new Error(`create project failed: ${JSON.stringify(res.body)}`);
  return res.body;
}

async function assignContractors(vendorToken, projectId, requirementId, assignments) {
  const res = await req(
    "POST",
    `/vendor/projects/${projectId}/requirements/${requirementId}/assign`,
    { token: vendorToken, body: { assignments } }
  );
  return res;
}

async function submitAndApprove(contractorToken, pmToken, projectId, workDate, hours) {
  const submit = await req("POST", "/contractor/timesheets", {
    token: contractorToken,
    body: { projectId, workDate, hoursLogged: hours },
  });
  if (submit.status !== 201) return { submit, approve: null };
  const approve = await req("PATCH", `/pm/timesheets/${submit.body.id}`, {
    token: pmToken,
    body: { status: "APPROVED" },
  });
  return { submit, approve };
}

async function main() {
  console.log("=== Setup: PM + Vendor accounts ===");
  const pm = await signupAndLogin("PM", { companyName: "Acme Test Co" });
  const vendor = await signupAndLogin("VENDOR");
  console.log("  PM + Vendor created.");

  // ============================================================
  // PROJECT 1 — CASE 1: three contractors A=20/B=20/C=10 hitting a 50h
  // M1 must produce exactly those three contribution amounts, not equal
  // splits.
  // ============================================================
  console.log("\n=== PROJECT 1 (CASE 1: multi-contractor exact split) ===");
  const p1 = await createProject(pm.token, { name: "Case1 Project", expectedHours: 50, requiredCount: 3 });
  assertEqual(p1.expected_hours, 50, "P1 expected_hours stored");
  assertEqual(p1.hours_staffing_status, "PENDING_STAFFING", "P1 starts PENDING_STAFFING");

  const reqId1 = p1.requirements[0].id;
  const cA = await createContractor(vendor.token, 50);
  const cB = await createContractor(vendor.token, 60);
  const cC = await createContractor(vendor.token, 70);

  const assignRes1 = await assignContractors(vendor.token, p1.id, reqId1, [
    { contractorId: cA.contractorId, allocatedHours: 20 },
    { contractorId: cB.contractorId, allocatedHours: 20 },
    { contractorId: cC.contractorId, allocatedHours: 10 },
  ]);
  assertEqual(assignRes1.status, 201, "P1 assign A/B/C (20/20/10) succeeds");
  assertEqual(assignRes1.body?.project_allocated_hours, 50, "P1 allocated_hours == 50 after assign");

  // Over-allocation must be rejected (project already fully allocated at
  // 50/50 — any further allocation should exceed capacity). Create a 4th
  // contractor and try to allocate 1h against a project with 0 remaining
  // capacity and 0 remaining headcount slots (required_count=3, already 3
  // assigned) — expect the headcount check to fire first, still a 409.
  const cExtra = await createContractor(vendor.token, 40);
  const overAllocRes = await assignContractors(vendor.token, p1.id, reqId1, [
    { contractorId: cExtra.contractorId, allocatedHours: 1 },
  ]);
  assertEqual(overAllocRes.status, 409, "P1 assigning a 4th contractor beyond headcount+capacity is rejected");

  const m1 = await req("POST", "/pm/milestones", {
    token: pm.token,
    body: { project_id: p1.id, name: "M1", threshold_hours: 50 },
  });
  assertEqual(m1.status, 201, "P1 milestone M1=50 created");

  // Over-threshold milestone must be rejected.
  const badMilestone = await req("POST", "/pm/milestones", {
    token: pm.token,
    body: { project_id: p1.id, name: "TooBig", threshold_hours: 999 },
  });
  assertEqual(badMilestone.status, 400, "P1 milestone threshold > expected_hours rejected");

  // Contractor cannot log more than their own allocation.
  const overLogA = await req("POST", "/contractor/timesheets", {
    token: cA.token,
    body: { projectId: p1.id, workDate: todayPlus(0), hoursLogged: 21 },
  });
  assertEqual(overLogA.status, 409, "A submitting 21h against a 20h allocation is rejected");

  // Approve A=20, B=20, C=10 in that order.
  const rA = await submitAndApprove(cA.token, pm.token, p1.id, todayPlus(0), 20);
  assertEqual(rA.approve?.status, 200, "A's 20h approved");
  const rB = await submitAndApprove(cB.token, pm.token, p1.id, todayPlus(0), 20);
  assertEqual(rB.approve?.status, 200, "B's 20h approved");
  const rC = await submitAndApprove(cC.token, pm.token, p1.id, todayPlus(0), 10);
  assertEqual(rC.approve?.status, 200, "C's 10h approved");

  await new Promise((r) => setTimeout(r, 300)); // let the post-commit milestone hook settle

  const milestones1 = await req("GET", `/pm/milestones/${p1.id}`, { token: pm.token });
  const met1 = milestones1.body.find((m) => m.name === "M1");
  assertEqual(met1?.status, "MET", "P1 M1 is MET after cumulative 50h approved");
  const contribByContractor1 = Object.fromEntries(
    (met1?.contributions || []).map((c) => [c.contractor_id, c.approved_hours])
  );
  assertClose(contribByContractor1[cA.contractorId], 20, "CASE1: A contributed exactly 20h to M1");
  assertClose(contribByContractor1[cB.contractorId], 20, "CASE1: B contributed exactly 20h to M1");
  assertClose(contribByContractor1[cC.contractorId], 10, "CASE1: C contributed exactly 10h to M1");
  assertEqual((met1?.contributions || []).length, 3, "CASE1: exactly 3 contribution rows (no equal-split fabrication)");

  const p1AfterMilestone = await req("GET", "/pm/projects", { token: pm.token });
  const p1View = p1AfterMilestone.body.find((p) => p.id === p1.id);
  assertClose(p1View.approved_hours, 50, "P1 project-wide approved_hours == 50");
  assertEqual(p1View.work_progress_percent, 100, "P1 work_progress_percent == 100 (capped, never over)");

  // Vendor invoice review + race safety.
  const vendorInvoices1 = await req("GET", "/vendor/invoices", { token: vendor.token });
  const invForA = vendorInvoices1.body.find((i) => i.contractor_id === cA.contractorId && i.milestone_id === met1.id);
  assert(!!invForA, "Vendor sees an invoice for A's contribution to M1");
  assertEqual(invForA?.status, "PENDING_REVIEW", "Invoice defaults to PENDING_REVIEW (no auto-approval)");

  // Concurrent approve + reject on the SAME invoice — exactly one must win.
  const [race1, race2] = await Promise.all([
    req("PATCH", `/vendor/invoices/${invForA.id}`, { token: vendor.token, body: { status: "APPROVED" } }),
    req("PATCH", `/vendor/invoices/${invForA.id}`, {
      token: vendor.token,
      body: { status: "REJECTED", rejection_reason: "race test" },
    }),
  ]);
  const statuses = [race1.status, race2.status].sort();
  assert(
    (statuses[0] === 200 && statuses[1] === 409) || (statuses[0] === 409 && statuses[1] === 200),
    `Concurrent approve+reject on same invoice: exactly one wins (got ${race1.status}, ${race2.status})`
  );

  const pmInvoices1 = await req("GET", "/pm/invoices", { token: pm.token });
  assertEqual(pmInvoices1.status, 200, "PM can view read-only invoice history");
  const pmMutateAttempt = await req("PATCH", `/pm/invoices/${invForA.id}`, {
    token: pm.token,
    body: { status: "APPROVED" },
  });
  assertEqual(pmMutateAttempt.status, 404, "Old PM mutate route no longer exists (404)");

  // ============================================================
  // PROJECT 1 completion -> auto-release -> reassignment eligibility
  // ============================================================
  console.log("\n=== PROJECT 1 completion & auto-release ===");
  const completeRes = await req("PATCH", `/pm/projects/${p1.id}/complete`, { token: pm.token });
  assertEqual(completeRes.status, 200, "PM completes project 1");
  assertEqual(completeRes.body?.released_assignment_count, 3, "All 3 active assignments auto-released on completion");
  assertEqual(completeRes.body?.project?.status, "COMPLETED", "Project status is COMPLETED");

  const doubleComplete = await req("PATCH", `/pm/projects/${p1.id}/complete`, { token: pm.token });
  assertEqual(doubleComplete.status, 409, "Re-completing an already-completed project is rejected");

  const postReleaseLog = await req("POST", "/contractor/timesheets", {
    token: cA.token,
    body: { projectId: p1.id, workDate: todayPlus(1), hoursLogged: 1 },
  });
  assert(postReleaseLog.status === 404 || postReleaseLog.status === 409, "Released contractor cannot log new hours");

  // Contractor A, now released, must be eligible for a NEW project.
  const p1b = await createProject(pm.token, { name: "Reassignment Project", expectedHours: 10, requiredCount: 1 });
  const reassign = await assignContractors(vendor.token, p1b.id, p1b.requirements[0].id, [
    { contractorId: cA.contractorId, allocatedHours: 10 },
  ]);
  assertEqual(reassign.status, 201, "Released contractor A is eligible for reassignment to a new project");

  // ============================================================
  // PROJECT 2 — CASE 2: 45h then a 10h approval crossing a 50h M1; only
  // 5h counts toward M1, the other 5h carries forward and is picked up
  // by M2 later, never lost or double-counted.
  // ============================================================
  console.log("\n=== PROJECT 2 (CASE 2: partial-threshold-crossing carry-forward, multi-contractor) ===");
  const p2 = await createProject(pm.token, { name: "Case2 Project", expectedHours: 100, requiredCount: 5 });
  const [d1, d2, d3, d4, d5] = await Promise.all([80, 80, 80, 80, 80].map(() => createContractor(vendor.token, 80)));
  const assignRes2 = await assignContractors(vendor.token, p2.id, p2.requirements[0].id, [
    { contractorId: d1.contractorId, allocatedHours: 24 },
    { contractorId: d2.contractorId, allocatedHours: 21 },
    { contractorId: d3.contractorId, allocatedHours: 10 },
    { contractorId: d4.contractorId, allocatedHours: 24 },
    { contractorId: d5.contractorId, allocatedHours: 21 },
  ]);
  assertEqual(assignRes2.status, 201, "P2 assign D1..D5 (24/21/10/24/21 = 100) succeeds");

  await req("POST", "/pm/milestones", { token: pm.token, body: { project_id: p2.id, name: "M1", threshold_hours: 50 } });
  await req("POST", "/pm/milestones", { token: pm.token, body: { project_id: p2.id, name: "M2", threshold_hours: 100 } });

  // Approved in strict order D1 -> D2 -> D3, each on the same calendar
  // day but as SEPARATE approval events (reviewed_at ordering is what
  // the apportionment algorithm walks, not the work_date) —
  // cumulative: 24 -> 45 -> 55, crossing M1's 50h threshold on D3's row.
  await submitAndApprove(d1.token, pm.token, p2.id, todayPlus(0), 24); // cumulative 24
  await submitAndApprove(d2.token, pm.token, p2.id, todayPlus(0), 21); // cumulative 45
  await submitAndApprove(d3.token, pm.token, p2.id, todayPlus(0), 10); // cumulative 55 -> crosses M1(50)

  const milestones2a = await req("GET", `/pm/milestones/${p2.id}`, { token: pm.token });
  const m1p2 = milestones2a.body.find((m) => m.name === "M1");
  const m2p2a = milestones2a.body.find((m) => m.name === "M2");
  assertEqual(m1p2?.status, "MET", "P2 M1 MET at cumulative 55h (>=50)");
  assertEqual(m2p2a?.status, "PENDING", "P2 M2 still PENDING at cumulative 55h (<100)");
  const m1contrib = Object.fromEntries((m1p2?.contributions || []).map((c) => [c.contractor_id, c.approved_hours]));
  assertClose(m1contrib[d1.contractorId], 24, "CASE2: D1 contributed its full 24h to M1");
  assertClose(m1contrib[d2.contractorId], 21, "CASE2: D2 contributed its full 21h to M1");
  assertClose(m1contrib[d3.contractorId], 5, "CASE2: D3 contributed only 5 of its 10h to M1 (the rest carries forward)");
  assertEqual(d3.contractorId in m1contrib, true, "CASE2: D3 (the straddling row) has a contribution row at all");

  // Push cumulative 55 -> 100 through M2's threshold with D4, D5.
  await submitAndApprove(d4.token, pm.token, p2.id, todayPlus(0), 24); // cumulative 79
  await submitAndApprove(d5.token, pm.token, p2.id, todayPlus(0), 21); // cumulative 100 -> crosses M2

  const milestones2b = await req("GET", `/pm/milestones/${p2.id}`, { token: pm.token });
  const m2p2b = milestones2b.body.find((m) => m.name === "M2");
  assertEqual(m2p2b?.status, "MET", "P2 M2 MET at cumulative 100h");
  const m2contrib = Object.fromEntries((m2p2b?.contributions || []).map((c) => [c.contractor_id, c.approved_hours]));
  assertClose(
    m2contrib[d3.contractorId],
    5,
    "CASE2: D3's carried-forward 5h (never lost, never double-counted) now appears in M2's contribution"
  );
  assertClose(m2contrib[d4.contractorId], 24, "CASE2: D4 contributed its full 24h to M2");
  assertClose(m2contrib[d5.contractorId], 21, "CASE2: D5 contributed its full 21h to M2");
  const totalContributed2 =
    Object.values(m1contrib).reduce((a, b) => a + b, 0) + Object.values(m2contrib).reduce((a, b) => a + b, 0);
  assertClose(totalContributed2, 100, "CASE2: M1 + M2 contributions sum to the full 100h approved — nothing lost or double-counted");

  // ============================================================
  // PROJECT 3 — CASE 3 (adapted to the real 24h/day submission cap): a
  // single approval crosses THREE thresholds at once (M1=50, M2=60,
  // M3=65 on a 65h project), verifying multi-milestone-in-one-call
  // apportionment and that progress never exceeds 100%.
  // ============================================================
  console.log("\n=== PROJECT 3 (CASE 3: single approval crosses 3 thresholds, multi-contractor) ===");
  const p3 = await createProject(pm.token, { name: "Case3 Project", expectedHours: 65, requiredCount: 3 });
  const [e1, e2, e3] = await Promise.all([90, 90, 90].map(() => createContractor(vendor.token, 90)));
  await assignContractors(vendor.token, p3.id, p3.requirements[0].id, [
    { contractorId: e1.contractorId, allocatedHours: 24 },
    { contractorId: e2.contractorId, allocatedHours: 21 },
    { contractorId: e3.contractorId, allocatedHours: 20 },
  ]);
  await req("POST", "/pm/milestones", { token: pm.token, body: { project_id: p3.id, name: "M1", threshold_hours: 50 } });
  await req("POST", "/pm/milestones", { token: pm.token, body: { project_id: p3.id, name: "M2", threshold_hours: 60 } });
  await req("POST", "/pm/milestones", { token: pm.token, body: { project_id: p3.id, name: "M3", threshold_hours: 65 } });

  await submitAndApprove(e1.token, pm.token, p3.id, todayPlus(0), 24); // cumulative 24
  await submitAndApprove(e2.token, pm.token, p3.id, todayPlus(0), 21); // cumulative 45
  // E3's single 20h approval takes cumulative 45 -> 65, straddling all
  // three thresholds (50, 60, 65) in this ONE approval event/call — the
  // scenario spec CASE 3 describes (a single approval crossing multiple
  // milestones at once), adapted to fit inside the 24h/day submission cap
  // real timesheet rows are held to.
  const jump = await submitAndApprove(e3.token, pm.token, p3.id, todayPlus(0), 20); // cumulative 65 -> M1,M2,M3 all in one call
  assertEqual(jump.approve?.status, 200, "P3 single 20h approval succeeds (cumulative 45 -> 65)");

  const milestones3 = await req("GET", `/pm/milestones/${p3.id}`, { token: pm.token });
  const m1p3 = milestones3.body.find((m) => m.name === "M1");
  const m2p3 = milestones3.body.find((m) => m.name === "M2");
  const m3p3 = milestones3.body.find((m) => m.name === "M3");
  assertEqual(m1p3?.status, "MET", "P3 M1 MET");
  assertEqual(m2p3?.status, "MET", "P3 M2 MET");
  assertEqual(m3p3?.status, "MET", "P3 M3 MET");

  const m1c = Object.fromEntries((m1p3?.contributions || []).map((c) => [c.contractor_id, c.approved_hours]));
  const m2c = Object.fromEntries((m2p3?.contributions || []).map((c) => [c.contractor_id, c.approved_hours]));
  const m3c = Object.fromEntries((m3p3?.contributions || []).map((c) => [c.contractor_id, c.approved_hours]));
  assertClose(m1c[e1.contractorId], 24, "CASE3: E1 contributed 24h to M1");
  assertClose(m1c[e2.contractorId], 21, "CASE3: E2 contributed 21h to M1");
  assertClose(m1c[e3.contractorId], 5, "CASE3: E3 contributed only the [45,50) slice (5h) of its 20h row to M1");
  assertClose(m2c[e3.contractorId], 10, "CASE3: E3 contributed the [50,60) slice (10h) of the SAME row to M2");
  assertClose(m3c[e3.contractorId], 5, "CASE3: E3 contributed the [60,65) slice (5h) of the SAME row to M3");
  assertEqual(Object.keys(m2c).length, 1, "CASE3: M2 has exactly one contributor (only E3's row overlapped [50,60))");
  assertEqual(Object.keys(m3c).length, 1, "CASE3: M3 has exactly one contributor (only E3's row overlapped [60,65))");

  const p3View = (await req("GET", "/pm/projects", { token: pm.token })).body.find((p) => p.id === p3.id);
  assertEqual(p3View.work_progress_percent, 100, "P3 work_progress_percent capped at exactly 100, never exceeds");

  // Allocation still correctly prevents total work from exceeding
  // capacity — E3 has 0h remaining allocation now (20 approved == 20
  // allocated).
  const overCapAfterCase3 = await req("POST", "/contractor/timesheets", {
    token: e3.token,
    body: { projectId: p3.id, workDate: todayPlus(0), hoursLogged: 1 },
  });
  assertEqual(overCapAfterCase3.status, 409, "E3 cannot log beyond their now-exhausted 20h allocation");

  console.log(`\n=== RESULTS: ${passes} passed, ${failures} failed ===`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
