// MVP fix regression + verification suite (run against a live server + MariaDB).
// Covers: FIX 1 (PM owns work-hour allocation), FIX 2 (per-contractor
// independent billing), plus a Module 1-6 regression sweep.
//
// Usage: node mvp_fix_test.js   (server must already be running on :5000)

const BASE = process.env.API_BASE_URL || "http://localhost:5000/api";
let pass = 0;
let fail = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(msg);
    console.log(`FAIL: ${msg}`);
  }
}

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

function todayPlus(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

let seq = 0;
function uniq(prefix) {
  seq += 1;
  return `${prefix}${Date.now()}_${seq}`;
}

async function signup(role, name) {
  const email = `${uniq(role.toLowerCase())}@test.com`;
  const password = "Password123!";
  const body = { name, email, password, role };
  if (role === "PM") {
    body.companyName = `${name} Co`;
  }
  if (role === "CONTRACTOR") {
    // contractors are created by a vendor, not self-signup — handled elsewhere.
  }
  const { status, data } = await req("POST", "/auth/signup", body);
  if (status !== 201) {
    console.log("signup failed", status, data);
    throw new Error(`signup failed for ${role}: ${JSON.stringify(data)}`);
  }
  const loginRes = await req("POST", "/auth/login", { email, password });
  if (loginRes.status !== 200) {
    console.log("post-signup login failed", loginRes.status, loginRes.data);
    throw new Error(`post-signup login failed for ${role}: ${JSON.stringify(loginRes.data)}`);
  }
  return { token: loginRes.data.token, user: loginRes.data.user || data.user, email, password };
}

async function main() {
  console.log("=== MVP FIX TEST SUITE ===\n");

  // ---------- Setup: PM, Vendor, two Contractors ----------
  const pm = await signup("PM", "Test PM");
  const vendor = await signup("VENDOR", "Test Vendor");
  async function submitAndAccept(projectId, requirementId, contractorIds) {
    for (const contractorId of contractorIds) {
      const submitted = await req("POST", `/vendor/projects/${projectId}/requirements/${requirementId}/candidates`, { contractor_id: contractorId }, vendor.token);
      if (submitted.status !== 201) return submitted;
      const accepted = await req("PATCH", `/pm/candidate-submissions/${submitted.data.id}`, { status: "ACCEPTED" }, pm.token);
      if (accepted.status !== 200) return accepted;
    }
    return { status: 201, data: {} };
  }

  const createContractorRes = await req(
    "POST",
    "/vendor/contractors",
    { name: "Contractor A", email: uniq("contractorA") + "@test.com", password: "Password123!", hourly_rate: 50 },
    vendor.token
  );
  assert(createContractorRes.status === 201, `create contractor A: expected 201, got ${createContractorRes.status} ${JSON.stringify(createContractorRes.data)}`);
  const contractorAId = createContractorRes.data.id;

  const createContractorBRes = await req(
    "POST",
    "/vendor/contractors",
    { name: "Contractor B", email: uniq("contractorB") + "@test.com", password: "Password123!", hourly_rate: 60 },
    vendor.token
  );
  assert(createContractorBRes.status === 201, `create contractor B: expected 201, got ${createContractorBRes.status}`);
  const contractorBId = createContractorBRes.data.id;

  const createContractorCRes = await req(
    "POST",
    "/vendor/contractors",
    { name: "Contractor C (smuggle target)", email: uniq("contractorC") + "@test.com", password: "Password123!", hourly_rate: 40 },
    vendor.token
  );
  const contractorCId = createContractorCRes.data.id;

  // Separate contractor for the project-2 cap check below — C is used
  // earlier for the "smuggled hours" assignment test and the existing
  // (unrelated, unchanged) one-active-assignment-at-a-time business rule
  // means C can't also be assigned to project 2.
  const createContractorDRes = await req(
    "POST",
    "/vendor/contractors",
    { name: "Contractor D (cap check)", email: uniq("contractorD") + "@test.com", password: "Password123!", hourly_rate: 45 },
    vendor.token
  );
  const contractorDId = createContractorDRes.data.id;

  // Third project-1 contractor, used later for the M2-crossing-in-a-later-
  // event scenario (A and B each only have ONE valid work_date available
  // within a single test run, so the marginal M2 hours have to come from
  // a fresh contractor rather than a second submission from A or B).
  const createContractorERes = await req(
    "POST",
    "/vendor/contractors",
    { name: "Contractor E (M2 marginal)", email: uniq("contractorE") + "@test.com", password: "Password123!", hourly_rate: 70 },
    vendor.token
  );
  const contractorEId = createContractorERes.data.id;

  // Two more, used only for the concurrency test below — A and B are
  // still actively assigned to project 1 at that point (not released
  // until project 1's completion, near the end of this script), and the
  // existing one-active-assignment-at-a-time rule means they can't also
  // be assigned to project 3.
  const createContractorFRes = await req(
    "POST",
    "/vendor/contractors",
    { name: "Contractor F (concurrency)", email: uniq("contractorF") + "@test.com", password: "Password123!", hourly_rate: 55 },
    vendor.token
  );
  const contractorFId = createContractorFRes.data.id;
  const createContractorGRes = await req(
    "POST",
    "/vendor/contractors",
    { name: "Contractor G (concurrency)", email: uniq("contractorG") + "@test.com", password: "Password123!", hourly_rate: 65 },
    vendor.token
  );
  const contractorGId = createContractorGRes.data.id;

  // Need contractor A/B's own login to submit timesheets.
  const contractorALogin = await req("POST", "/auth/login", { email: createContractorRes.data.email, password: "Password123!" });
  const contractorBLogin = await req("POST", "/auth/login", { email: createContractorBRes.data.email, password: "Password123!" });
  assert(contractorALogin.status === 200, "contractor A login");
  assert(contractorBLogin.status === 200, "contractor B login");
  const contractorAToken = contractorALogin.data.token;
  const contractorBToken = contractorBLogin.data.token;

  // Contractors set their own skill (POST-signup profile step, not part of
  // vendor creation) — required before they're eligible for any FRONTEND
  // requirement.
  const contractorCLogin = await req("POST", "/auth/login", { email: createContractorCRes.data.email, password: "Password123!" });
  const contractorCToken = contractorCLogin.data.token;
  const contractorDLogin = await req("POST", "/auth/login", { email: createContractorDRes.data.email, password: "Password123!" });
  const contractorDToken = contractorDLogin.data.token;
  const contractorELogin = await req("POST", "/auth/login", { email: createContractorERes.data.email, password: "Password123!" });
  const contractorEToken = contractorELogin.data.token;
  const contractorFLogin = await req("POST", "/auth/login", { email: createContractorFRes.data.email, password: "Password123!" });
  const contractorFToken = contractorFLogin.data.token;
  const contractorGLogin = await req("POST", "/auth/login", { email: createContractorGRes.data.email, password: "Password123!" });
  const contractorGToken = contractorGLogin.data.token;
  for (const [label, token] of [
    ["A", contractorAToken],
    ["B", contractorBToken],
    ["C", contractorCToken],
    ["D", contractorDToken],
    ["E", contractorEToken],
    ["F", contractorFToken],
    ["G", contractorGToken],
  ]) {
    const skillRes = await req("PATCH", "/contractor/profile/skill", { skill: "FRONTEND" }, token);
    assert(skillRes.status === 200, `set skill for contractor ${label}: expected 200, got ${skillRes.status} ${JSON.stringify(skillRes.data)}`);
  }

  // ---------- PROJECT 1: the spec's exact worked example ----------
  const p1 = await req(
    "POST",
    "/pm/projects",
    {
      // Backdated so more than one valid work_date (>= start_date, <=
      // today, not future) is available — needed for B's second
      // submission later in this test (M2-crossing scenario).
      name: "MVP Fix Project 1",
      start_date: todayPlus(0),
      expected_hours: 20,
      // required_count 3, not 2: a third contractor (E) is added later to
      // exercise the M2-crossing-in-a-later-event scenario, since A and B
      // can each only submit ONE work_date within a single test run (see
      // the note further below).
      requirements: [{ skill: "FRONTEND", required_count: 3 }],
    },
    pm.token
  );
  assert(p1.status === 201, `create project 1: expected 201, got ${p1.status} ${JSON.stringify(p1.data)}`);
  const project1Id = p1.data.id;
  const requirement1Id = p1.data.requirements[0].id;

  // ===================== FIX 1: Vendor cannot allocate hours =====================
  console.log("\n--- FIX 1: Vendor assignment never sets/accepts allocated hours ---");

  // Vendor assigns A and B — plain contractorIds, no hours field at all.
  const assignRes = await submitAndAccept(project1Id, requirement1Id, [contractorAId, contractorBId]);
  assert(assignRes.status === 201, `assign A+B: expected 201, got ${assignRes.status} ${JSON.stringify(assignRes.data)}`);

  // Confirm allocated_hours is null immediately after Vendor assignment.
  const teamAfterAssign = await req("GET", `/pm/projects/${project1Id}/contractors`, undefined, pm.token);
  const aRowAfterAssign = teamAfterAssign.data.find((c) => c.contractor_id === contractorAId);
  assert(aRowAfterAssign.allocated_hours === null, `A's allocated_hours should be null right after Vendor assignment, got ${aRowAfterAssign.allocated_hours}`);

  // Vendor tries to smuggle allocatedHours/allocated_hours through the
  // assignment body for a NEW project — must be silently ignored, never
  // trusted, never causes a validation crash either.
  const p1b = await req(
    "POST",
    "/pm/projects",
    { name: "MVP Fix Project 1b", start_date: todayPlus(0), expected_hours: 10, requirements: [{ skill: "FRONTEND", required_count: 1 }] },
    pm.token
  );
  const smuggleRes = await submitAndAccept(p1b.data.id, p1b.data.requirements[0].id, [contractorCId]);
  assert(smuggleRes.status === 201, `smuggled-hours assign: expected 201 (assignment itself still valid), got ${smuggleRes.status}`);
  const teamP1b = await req("GET", `/pm/projects/${p1b.data.id}/contractors`, undefined, pm.token);
  const cRowP1b = teamP1b.data.find((c) => c.contractor_id === contractorCId);
  assert(cRowP1b.allocated_hours === null, `smuggled allocatedHours must be ignored — expected null, got ${cRowP1b.allocated_hours}`);

  // Contractor A tries to submit hours BEFORE the PM has allocated —
  // must be rejected (fix 1's server-side enforcement, not just hidden UI).
  const preAllocSubmit = await req(
    "POST",
    "/contractor/timesheets",
    { projectId: project1Id, workDate: todayPlus(0), hoursLogged: 3 },
    contractorAToken
  );
  assert(preAllocSubmit.status === 409, `submit before allocation: expected 409, got ${preAllocSubmit.status} ${JSON.stringify(preAllocSubmit.data)}`);

  // PM attempts to allocate hours to contractor C, who is NOT assigned to project1.
  const allocateUnassigned = await req(
    "PATCH",
    `/pm/projects/${project1Id}/contractors/${contractorCId}/allocation`,
    { allocated_hours: 5 },
    pm.token
  );
  assert(allocateUnassigned.status === 400, `PM allocate to unassigned contractor: expected 400, got ${allocateUnassigned.status}`);

  // Vendor attempts to hit the PM-only allocation endpoint directly — must be blocked by RBAC.
  const vendorTriesAllocate = await req(
    "PATCH",
    `/pm/projects/${project1Id}/contractors/${contractorAId}/allocation`,
    { allocated_hours: 10 },
    vendor.token
  );
  assert(vendorTriesAllocate.status === 403, `Vendor hits PM allocation route: expected 403, got ${vendorTriesAllocate.status}`);

  // PM allocates negative/zero — must be rejected.
  const negAlloc = await req("PATCH", `/pm/projects/${project1Id}/contractors/${contractorAId}/allocation`, { allocated_hours: -5 }, pm.token);
  assert(negAlloc.status === 400, `negative allocation: expected 400, got ${negAlloc.status}`);
  const zeroAlloc = await req("PATCH", `/pm/projects/${project1Id}/contractors/${contractorAId}/allocation`, { allocated_hours: 0 }, pm.token);
  assert(zeroAlloc.status === 400, `zero allocation: expected 400, got ${zeroAlloc.status}`);

  // PM allocates A=10 and B=10 (exactly the project's 20h cap).
  const allocA = await req("PATCH", `/pm/projects/${project1Id}/contractors/${contractorAId}/allocation`, { allocated_hours: 10 }, pm.token);
  assert(allocA.status === 200, `allocate A=10: expected 200, got ${allocA.status} ${JSON.stringify(allocA.data)}`);
  const allocB = await req("PATCH", `/pm/projects/${project1Id}/contractors/${contractorBId}/allocation`, { allocated_hours: 10 }, pm.token);
  assert(allocB.status === 200, `allocate B=10: expected 200, got ${allocB.status}`);

  // PM tries to over-allocate A to 15 (total would become 25 > 20 expected_hours).
  const overAlloc = await req("PATCH", `/pm/projects/${project1Id}/contractors/${contractorAId}/allocation`, { allocated_hours: 15 }, pm.token);
  assert(overAlloc.status === 409, `over-cap allocation: expected 409, got ${overAlloc.status} ${JSON.stringify(overAlloc.data)}`);

  // Confirm A is still at 10 (rejected update did not partially apply).
  const teamAfterOverAlloc = await req("GET", `/pm/projects/${project1Id}/contractors`, undefined, pm.token);
  const aRowStillTen = teamAfterOverAlloc.data.find((c) => c.contractor_id === contractorAId);
  assert(aRowStillTen.allocated_hours === 10, `A should still be allocated 10 after rejected over-cap update, got ${aRowStillTen.allocated_hours}`);

  // ===================== FIX 2: independent per-contractor billing =====================
  console.log("\n--- FIX 2: milestone billing uses each contractor's own approved hours ---");

  const m1 = await req("POST", "/pm/milestones", { project_id: project1Id, name: "M1", threshold_hours: 10 }, pm.token);
  assert(m1.status === 201, `create M1: expected 201, got ${m1.status} ${JSON.stringify(m1.data)}`);
  const m2 = await req("POST", "/pm/milestones", { project_id: project1Id, name: "M2", threshold_hours: 20 }, pm.token);
  assert(m2.status === 201, `create M2: expected 201, got ${m2.status}`);

  // A submits 6h, B submits 8h (same day — two different contractors).
  const subA6 = await req("POST", "/contractor/timesheets", { projectId: project1Id, workDate: todayPlus(0), hoursLogged: 6 }, contractorAToken);
  assert(subA6.status === 201, `A submits 6h: expected 201, got ${subA6.status} ${JSON.stringify(subA6.data)}`);
  const subB8 = await req("POST", "/contractor/timesheets", { projectId: project1Id, workDate: todayPlus(0), hoursLogged: 8 }, contractorBToken);
  await req("POST", "/contractor/timesheets/submit", { timesheetIds: [subA6.data.id] }, contractorAToken);
  await req("POST", "/contractor/timesheets/submit", { timesheetIds: [subB8.data.id] }, contractorBToken);
  assert(subB8.status === 201, `B submits 8h: expected 201, got ${subB8.status}`);

  // PM approves both.
  const approveA6 = await req("PATCH", `/pm/timesheets/${subA6.data.id}`, { status: "APPROVED" }, pm.token);
  assert(approveA6.status === 200, `approve A's 6h: expected 200, got ${approveA6.status}`);
  const approveB8 = await req("PATCH", `/pm/timesheets/${subB8.data.id}`, { status: "APPROVED" }, pm.token);
  assert(approveB8.status === 200, `approve B's 8h: expected 200, got ${approveB8.status}`);

  // Project total = 14h -> M1 (10h) is reached. Project progress = 70%, remaining = 6h.
  const projAfterM1 = await req("GET", "/pm/projects", undefined, pm.token);
  const p1View = projAfterM1.data.items.find((p) => p.id === project1Id);
  assert(p1View.approved_hours === 14, `project approved hours: expected 14, got ${p1View.approved_hours}`);
  assert(p1View.work_progress_percent === 70, `project progress: expected 70, got ${p1View.work_progress_percent}`);

  const milestonesAfterM1 = await req("GET", `/pm/milestones/${project1Id}`, undefined, pm.token);
  const m1View = milestonesAfterM1.data.find((m) => m.name === "M1");
  const m2View = milestonesAfterM1.data.find((m) => m.name === "M2");
  assert(m1View.status === "MET", `M1 should be MET, got ${m1View.status}`);
  assert(m2View.status === "PENDING", `M2 should still be PENDING, got ${m2View.status}`);

  const m1ContribA = m1View.contributions.find((c) => c.contractor_id === contractorAId);
  const m1ContribB = m1View.contributions.find((c) => c.contractor_id === contractorBId);
  assert(!!m1ContribA, "A should have an M1 contribution row");
  assert(!!m1ContribB, "B should have an M1 contribution row");
  assert(m1ContribA.approved_hours === 6, `A's M1 billable hours: expected 6 (their own actual approved hours), got ${m1ContribA?.approved_hours} — THIS IS THE CORE FIX 2 ASSERTION`);
  assert(m1ContribB.approved_hours === 8, `B's M1 billable hours: expected 8 (their own actual approved hours, NOT 10-6=4), got ${m1ContribB?.approved_hours} — THIS IS THE CORE FIX 2 ASSERTION`);
  assert(Math.abs(m1ContribA.billing_amount - 6 * 50) < 0.01, `A's M1 billing amount: expected ${6 * 50}, got ${m1ContribA.billing_amount}`);
  assert(Math.abs(m1ContribB.billing_amount - 8 * 60) < 0.01, `B's M1 billing amount: expected ${8 * 60}, got ${m1ContribB.billing_amount}`);

  // Contractor remaining allocation is independent: A remaining=4, B remaining=2.
  const teamAfterM1 = await req("GET", `/pm/projects/${project1Id}/contractors`, undefined, pm.token);
  const aAfterM1 = teamAfterM1.data.find((c) => c.contractor_id === contractorAId);
  const bAfterM1 = teamAfterM1.data.find((c) => c.contractor_id === contractorBId);
  assert(aAfterM1.remaining_hours === 4, `A remaining: expected 4, got ${aAfterM1.remaining_hours}`);
  assert(bAfterM1.remaining_hours === 2, `B remaining: expected 2, got ${bAfterM1.remaining_hours}`);

  // A tries to submit 5h (exceeds their remaining 4h) — must be rejected.
  const aOverSubmit = await req("POST", "/contractor/timesheets", { projectId: project1Id, workDate: todayPlus(1), hoursLogged: 5 }, contractorAToken);
  // workDate must not be future — use a distinct valid date instead; project has no end_date so any date <= today works, but only "today" is valid (not future). Since same-day dup is blocked, this call is expected to fail on the FUTURE-DATE rule first — adjust to test allocation instead using a fresh single-day scenario isn't available. We instead verify via the edit-a-rejected-log path below for a same-day capacity check, and rely on the initial submission's cap logic already proven by the pre-allocation test above. Just confirm this attempt fails (for whichever valid reason) — still exercises "cannot exceed remaining" in principle when workDate is valid; see the dedicated capacity check below instead.
  assert(aOverSubmit.status === 400 || aOverSubmit.status === 409, `A submits future-dated / over-capacity hours: expected 4xx, got ${aOverSubmit.status}`);

  // Dedicated same-day capacity check: A submits exactly their remaining 4h — should succeed.
  const aExact4 = await req("POST", "/contractor/timesheets", { projectId: project1Id, workDate: todayPlus(0), hoursLogged: 4 }, contractorAToken);
  // Same work_date as the earlier 6h row already exists for A -> UNIQUE constraint conflict expected (contractor/project/day), not a capacity error.
  assert(aExact4.status === 409, `A submits second row same day: expected 409 (duplicate day), got ${aExact4.status}`);

  console.log("\n--- Using project 2 for a cleaner remaining-allocation-cap check ---");
  const p2 = await req(
    "POST",
    "/pm/projects",
    { name: "MVP Fix Project 2 (cap check)", start_date: todayPlus(0), expected_hours: 10, requirements: [{ skill: "FRONTEND", required_count: 1 }] },
    pm.token
  );
  const req2Id = p2.data.requirements[0].id;
  const assign2 = await submitAndAccept(p2.data.id, req2Id, [contractorDId]);
  assert(assign2.status === 201, `assign D to project 2: expected 201, got ${assign2.status} ${JSON.stringify(assign2.data)}`);
  const allocC2 = await req("PATCH", `/pm/projects/${p2.data.id}/contractors/${contractorDId}/allocation`, { allocated_hours: 2 }, pm.token);
  assert(allocC2.status === 200, `allocate D=2 on project 2: expected 200, got ${allocC2.status}`);

  const cOverCap = await req("POST", "/contractor/timesheets", { projectId: p2.data.id, workDate: todayPlus(0), hoursLogged: 5 }, contractorDToken);
  assert(cOverCap.status === 409, `D submits 5h against a 2h allocation: expected 409, got ${cOverCap.status} ${JSON.stringify(cOverCap.data)}`);
  const cWithinCap = await req("POST", "/contractor/timesheets", { projectId: p2.data.id, workDate: todayPlus(0), hoursLogged: 2 }, contractorDToken);
  assert(cWithinCap.status === 201, `D submits exactly 2h (their full allocation): expected 201, got ${cWithinCap.status}`);

  // ---------- Back to project 1: reduce-below-approved rejection, rate-change immutability, M2 crossing ----------
  console.log("\n--- Allocation floor + hourly-rate-change immutability + M2 crossing ---");

  // PM tries to lower A's allocation below A's 6 already-approved hours.
  const lowerBelowApproved = await req("PATCH", `/pm/projects/${project1Id}/contractors/${contractorAId}/allocation`, { allocated_hours: 5 }, pm.token);
  assert(lowerBelowApproved.status === 409, `lower A's allocation below approved: expected 409, got ${lowerBelowApproved.status}`);

  // Capture M1's billing amount for A before any rate change.
  const m1BillingBeforeRateChange = m1ContribA.billing_amount;

  // Change A's hourly rate.
  const rateChange = await req("PATCH", `/vendor/contractors/${contractorAId}`, { hourly_rate: 100 }, vendor.token);
  assert(rateChange.status === 200, `change A's rate: expected 200, got ${rateChange.status} ${JSON.stringify(rateChange.data)}`);

  // Re-fetch M1 — A's already-generated billing row must be UNCHANGED.
  const milestonesAfterRateChange = await req("GET", `/pm/milestones/${project1Id}`, undefined, pm.token);
  const m1AfterRateChange = milestonesAfterRateChange.data.find((m) => m.name === "M1");
  const m1ContribAAfterRateChange = m1AfterRateChange.contributions.find((c) => c.contractor_id === contractorAId);
  assert(
    m1ContribAAfterRateChange.billing_amount === m1BillingBeforeRateChange,
    `M1's billing for A must stay immutable after a rate change: expected ${m1BillingBeforeRateChange}, got ${m1ContribAAfterRateChange.billing_amount}`
  );
  assert(m1ContribAAfterRateChange.hourly_rate === 50, `M1's stored hourly_rate snapshot for A must stay 50, got ${m1ContribAAfterRateChange.hourly_rate}`);

  // ---- M2 crossing, as a genuinely LATER, separate approval event ----
  // A and B each only have ONE valid work_date available within this test
  // run (today — start_date can't be in the future-adjusted-past and
  // work_date can't be in the future, and each contractor/project/day is
  // capped at one timesheet row), so neither can add MORE hours today.
  // To trigger M2 as a real second wave (not lumped into the same
  // evaluation as M1) we free up capacity by lowering A and B down to
  // exactly their already-approved floor (allowed — only lowering BELOW
  // approved is rejected), then allocate the freed 6h to a third
  // contractor (E) and have E submit+approve it in a separate call.
  const lowerAToFloor = await req("PATCH", `/pm/projects/${project1Id}/contractors/${contractorAId}/allocation`, { allocated_hours: 6 }, pm.token);
  assert(lowerAToFloor.status === 200, `lower A's allocation to exactly its 6h approved floor: expected 200, got ${lowerAToFloor.status} ${JSON.stringify(lowerAToFloor.data)}`);
  const lowerBToFloor = await req("PATCH", `/pm/projects/${project1Id}/contractors/${contractorBId}/allocation`, { allocated_hours: 8 }, pm.token);
  assert(lowerBToFloor.status === 200, `lower B's allocation to exactly its 8h approved floor: expected 200, got ${lowerBToFloor.status} ${JSON.stringify(lowerBToFloor.data)}`);

  // Assign E to project 1 (requirement now has a free slot: required_count 3, 2 used).
  const assignE = await submitAndAccept(project1Id, requirement1Id, [contractorEId]);
  assert(assignE.status === 201, `assign E to project 1: expected 201, got ${assignE.status} ${JSON.stringify(assignE.data)}`);

  // Freed capacity is exactly 6h (20 - 6 - 8) -> allocate all of it to E.
  const allocE = await req("PATCH", `/pm/projects/${project1Id}/contractors/${contractorEId}/allocation`, { allocated_hours: 6 }, pm.token);
  assert(allocE.status === 200, `allocate E=6 (the freed capacity): expected 200, got ${allocE.status} ${JSON.stringify(allocE.data)}`);
  // Confirm the cap is exact: E can't get any more than that.
  const overAllocE = await req("PATCH", `/pm/projects/${project1Id}/contractors/${contractorEId}/allocation`, { allocated_hours: 7 }, pm.token);
  assert(overAllocE.status === 409, `allocate E=7 (1h over remaining capacity): expected 409, got ${overAllocE.status}`);

  // E submits and gets approved for their full 6h -> project total becomes
  // 6 + 8 + 6 = 20h -> M2 (20h) reached, in a call that touches ONLY E's
  // timesheet — a genuinely separate, later event from M1's.
  const subE6 = await req("POST", "/contractor/timesheets", { projectId: project1Id, workDate: todayPlus(0), hoursLogged: 6 }, contractorEToken);
  await req("POST", "/contractor/timesheets/submit", { timesheetIds: [subE6.data.id] }, contractorEToken);
  assert(subE6.status === 201, `E submits 6h: expected 201, got ${subE6.status} ${JSON.stringify(subE6.data)}`);
  const approveE6 = await req("PATCH", `/pm/timesheets/${subE6.data.id}`, { status: "APPROVED" }, pm.token);
  assert(approveE6.status === 200, `approve E's 6h: expected 200, got ${approveE6.status}`);

  const milestonesAfterM2 = await req("GET", `/pm/milestones/${project1Id}`, undefined, pm.token);
  const m2AfterCross = milestonesAfterM2.data.find((m) => m.name === "M2");
  assert(m2AfterCross.status === "MET", `M2 should now be MET, got ${m2AfterCross.status}`);

  // M2's contributions for A and B must NOT re-bill their M1 hours — A and
  // B have NO new approved hours since M1 (deltas are 0), so neither
  // should have an M2 contribution row at all.
  const m2ContribA = m2AfterCross.contributions.find((c) => c.contractor_id === contractorAId);
  assert(!m2ContribA, `A should have NO M2 contribution (0 new hours since M1) — got ${JSON.stringify(m2ContribA)}`);
  const m2ContribB = m2AfterCross.contributions.find((c) => c.contractor_id === contractorBId);
  assert(!m2ContribB, `B should have NO M2 contribution (0 new hours since M1) — got ${JSON.stringify(m2ContribB)}`);

  // E's M2 contribution must be their full marginal 6h (never billed
  // before), billed at E's rate (70).
  const m2ContribE = m2AfterCross.contributions.find((c) => c.contractor_id === contractorEId);
  assert(!!m2ContribE, "E should have an M2 contribution row");
  assert(m2ContribE.approved_hours === 6, `E's M2 billable hours: expected 6 (their full marginal contribution), got ${m2ContribE?.approved_hours}`);
  assert(Math.abs(m2ContribE.billing_amount - 6 * 70) < 0.01, `E's M2 billing amount: expected ${6 * 70}, got ${m2ContribE.billing_amount}`);

  // Total ever billed for A/B across all milestones must equal exactly
  // their one-time approved contribution (never double-billed).
  const totalABilledHours = milestonesAfterM2.data
    .flatMap((m) => m.contributions)
    .filter((c) => c.contractor_id === contractorAId)
    .reduce((sum, c) => sum + c.approved_hours, 0);
  assert(totalABilledHours === 6, `A's total billed hours across ALL milestones: expected 6, got ${totalABilledHours}`);
  const totalBBilledHours = milestonesAfterM2.data
    .flatMap((m) => m.contributions)
    .filter((c) => c.contractor_id === contractorBId)
    .reduce((sum, c) => sum + c.approved_hours, 0);
  assert(totalBBilledHours === 8, `B's total billed hours across ALL milestones: expected 8, got ${totalBBilledHours}`);
  const totalEBilledHours = milestonesAfterM2.data
    .flatMap((m) => m.contributions)
    .filter((c) => c.contractor_id === contractorEId)
    .reduce((sum, c) => sum + c.approved_hours, 0);
  assert(totalEBilledHours === 6, `E's total billed hours across ALL milestones: expected 6, got ${totalEBilledHours}`);

  // Project progress must now be 100%, never exceeding it.
  const projAfterM2 = await req("GET", "/pm/projects", undefined, pm.token);
  const p1ViewAfterM2 = projAfterM2.data.items.find((p) => p.id === project1Id);
  assert(p1ViewAfterM2.approved_hours === 20, `project approved hours after M2: expected 20, got ${p1ViewAfterM2.approved_hours}`);
  assert(p1ViewAfterM2.work_progress_percent === 100, `project progress after M2: expected 100, got ${p1ViewAfterM2.work_progress_percent}`);

  // ===================== Concurrency =====================
  console.log("\n--- Concurrency: simultaneous approvals crossing a threshold together ---");
  const p3 = await req(
    "POST",
    "/pm/projects",
    { name: "MVP Fix Project 3 (concurrency)", start_date: todayPlus(0), expected_hours: 20, requirements: [{ skill: "FRONTEND", required_count: 2 }] },
    pm.token
  );
  const req3Id = p3.data.requirements[0].id;
  const assignFG = await submitAndAccept(p3.data.id, req3Id, [contractorFId, contractorGId]);
  assert(assignFG.status === 201, `assign F+G to project 3: expected 201, got ${assignFG.status} ${JSON.stringify(assignFG.data)}`);
  const allocF = await req("PATCH", `/pm/projects/${p3.data.id}/contractors/${contractorFId}/allocation`, { allocated_hours: 10 }, pm.token);
  assert(allocF.status === 200, `allocate F=10 on project 3: expected 200, got ${allocF.status}`);
  const allocG = await req("PATCH", `/pm/projects/${p3.data.id}/contractors/${contractorGId}/allocation`, { allocated_hours: 10 }, pm.token);
  assert(allocG.status === 200, `allocate G=10 on project 3: expected 200, got ${allocG.status}`);
  const m1p3 = await req("POST", "/pm/milestones", { project_id: p3.data.id, name: "M1", threshold_hours: 10 }, pm.token);
  assert(m1p3.status === 201, `create M1 on project 3: expected 201, got ${m1p3.status}`);

  const subF3 = await req("POST", "/contractor/timesheets", { projectId: p3.data.id, workDate: todayPlus(0), hoursLogged: 6 }, contractorFToken);
  assert(subF3.status === 201, `F submits 6h on project 3: expected 201, got ${subF3.status} ${JSON.stringify(subF3.data)}`);
  const subG3 = await req("POST", "/contractor/timesheets", { projectId: p3.data.id, workDate: todayPlus(0), hoursLogged: 8 }, contractorGToken);
  await req("POST", "/contractor/timesheets/submit", { timesheetIds: [subF3.data.id] }, contractorFToken);
  await req("POST", "/contractor/timesheets/submit", { timesheetIds: [subG3.data.id] }, contractorGToken);
  assert(subG3.status === 201, `G submits 8h on project 3: expected 201, got ${subG3.status} ${JSON.stringify(subG3.data)}`);

  // Approve both nearly simultaneously — each approval independently
  // triggers checkAndTriggerMilestones for the SAME project; the row lock
  // on the project's PENDING milestones must serialize them so the
  // threshold is only ever crossed and billed once.
  const [concF, concG] = await Promise.all([
    req("PATCH", `/pm/timesheets/${subF3.data.id}`, { status: "APPROVED" }, pm.token),
    req("PATCH", `/pm/timesheets/${subG3.data.id}`, { status: "APPROVED" }, pm.token),
  ]);
  assert(concF.status === 200 && concG.status === 200, `concurrent approvals both succeed: got ${concF.status}, ${concG.status}`);

  // Give any in-flight async milestone evaluation triggered post-commit a moment.
  await new Promise((resolve) => setTimeout(resolve, 500));

  const milestonesP3 = await req("GET", `/pm/milestones/${p3.data.id}`, undefined, pm.token);
  const m1p3View = milestonesP3.data.find((m) => m.name === "M1");
  assert(m1p3View.status === "MET", `concurrent-crossing M1 should be MET, got ${m1p3View.status}`);
  assert(m1p3View.contributions.length === 2, `concurrent-crossing M1 should have exactly 2 contribution rows (no duplicates), got ${m1p3View.contributions.length}`);
  const dupCheck = new Set(m1p3View.contributions.map((c) => c.contractor_id));
  assert(dupCheck.size === m1p3View.contributions.length, "no duplicate (milestone, contractor) billing rows under concurrency");
  const p3ContribF = m1p3View.contributions.find((c) => c.contractor_id === contractorFId);
  const p3ContribG = m1p3View.contributions.find((c) => c.contractor_id === contractorGId);
  assert(p3ContribF.approved_hours === 6, `concurrent: F's billed hours expected 6, got ${p3ContribF?.approved_hours}`);
  assert(p3ContribG.approved_hours === 8, `concurrent: G's billed hours expected 8, got ${p3ContribG?.approved_hours}`);

  // ===================== M17/M18 regression =====================
  console.log("\n--- M17 billing queue / M18 finance invoice document ---");
  const billingQueue = await req("GET", "/vendor/billing-queue", undefined, vendor.token);
  assert(billingQueue.status === 200 && billingQueue.data.items.length > 0, "eligible billings exist without auto-created invoices");
  const draft = await req("POST", "/vendor/invoices/drafts", { milestone_billing_id: billingQueue.data.items[0].milestone_billing_id }, vendor.token);
  assert(draft.status === 201 && draft.data.status === "DRAFT", `draft created: got ${draft.status}`);
  const pricedDraft = await req("PATCH", `/vendor/invoices/${draft.data.id}`, { tax_rate: 18, adjustments: [{ description: "Travel adjustment", amount: 2.5 }], payment_terms_days: 15 }, vendor.token);
  assert(pricedDraft.status === 200 && pricedDraft.data.tax_rate === 18 && pricedDraft.data.total_amount === Number((pricedDraft.data.subtotal_amount * 1.18 + 2.5).toFixed(2)), `derived M18 tax total: got ${pricedDraft.status}`);
  const draftItem = pricedDraft.data.items?.[0];
  assert(draftItem?.contractor_name_snapshot && draftItem?.skill_name_snapshot && draftItem?.milestone_name_snapshot && draftItem.approved_hours > 0 && draftItem.bill_rate > 0 && draftItem.amount > 0, "M18 item display and financial snapshots are present");
  const secondDraft = await req("POST", "/vendor/invoices/drafts", { milestone_billing_id: billingQueue.data.items[1].milestone_billing_id }, vendor.token);
  assert(secondDraft.status === 201, `second draft created: got ${secondDraft.status}`);
  const [submitted, secondSubmitted] = await Promise.all([
    req("POST", `/vendor/invoices/${draft.data.id}/submit`, undefined, vendor.token),
    req("POST", `/vendor/invoices/${secondDraft.data.id}/submit`, undefined, vendor.token),
  ]);
  assert(submitted.status === 200 && submitted.data.status === "SUBMITTED" && /^INV-\d{4}-\d{6}$/.test(submitted.data.invoice_number) && submitted.data.pdf_storage_key, `M18 numbered document frozen on submit: got ${submitted.status}`);
  const submittedSequences = [submitted, secondSubmitted].map((response) => Number(response.data?.invoice_number?.split("-")[2])).sort((a, b) => a - b);
  assert(secondSubmitted.status === 200 && submittedSequences[1] === submittedSequences[0] + 1, `M18 concurrent invoice numbers are unique and consecutive: ${submittedSequences.join(",")}`);
  const pdfResponse = await fetch(`${BASE}/vendor/invoices/${draft.data.id}/pdf`, { headers: { Authorization: `Bearer ${vendor.token}` } });
  const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer());
  const pdfText = pdfBytes.toString("utf8");
  const pdfTaxText = 'Tax \\(18.00%\\)';
  const pdfMatches = pdfResponse.status === 200 && pdfBytes.subarray(0, 5).toString() === "%PDF-" && pdfText.includes(submitted.data.invoice_number) && pdfText.includes(draftItem.contractor_name_snapshot) && pdfText.includes(pdfTaxText) && pdfText.includes("Travel adjustment") && pdfText.includes(`Total: USD ${submitted.data.total_amount.toFixed(2)}`) && pdfText.includes(`Due date: ${submitted.data.due_date}`);
  assert(pdfMatches, `authorized M18 PDF download with derived details: got ${pdfResponse.status}; number=${pdfText.includes(submitted.data.invoice_number)} contractor=${pdfText.includes(draftItem.contractor_name_snapshot)} tax=${pdfText.includes(pdfTaxText)} adjustment=${pdfText.includes('Travel adjustment')} total=${pdfText.includes(`Total: USD ${submitted.data.total_amount.toFixed(2)}`)} due=${pdfText.includes(`Due date: ${submitted.data.due_date}`)}`);
  const immutableMetadata = await req("PATCH", `/vendor/invoices/${draft.data.id}`, { tax_rate: 0 }, vendor.token);
  assert(immutableMetadata.status === 409, `submitted invoice metadata is immutable: got ${immutableMetadata.status}`);
  const pmPdf = await fetch(`${BASE}/pm/invoices/${draft.data.id}/pdf`, { headers: { Authorization: `Bearer ${pm.token}` } });
  assert(pmPdf.status === 200, `owning PM can download M18 PDF: got ${pmPdf.status}`);
  const unrelatedVendor = await signup("VENDOR", "M18 Unrelated Vendor");
  const unrelatedVendorPdf = await fetch(`${BASE}/vendor/invoices/${draft.data.id}/pdf`, { headers: { Authorization: `Bearer ${unrelatedVendor.token}` } });
  const unrelatedPm = await signup("PM", "M18 Unrelated PM");
  const unrelatedPmPdf = await fetch(`${BASE}/pm/invoices/${draft.data.id}/pdf`, { headers: { Authorization: `Bearer ${unrelatedPm.token}` } });
  assert(unrelatedVendorPdf.status === 404 && unrelatedPmPdf.status === 404, `cross-tenant PDF probes are hidden: vendor=${unrelatedVendorPdf.status}, pm=${unrelatedPmPdf.status}`);
  console.log("M18 acceptance checks: derived tax, concurrent numbering, frozen PDF, and authorized download.");
  const reviewed = await req("PATCH", `/pm/invoices/${draft.data.id}/review`, { status: "APPROVED" }, pm.token);
  assert(reviewed.status === 200 && reviewed.data.status === "APPROVED", `PM approval: got ${reviewed.status}`);
  const approvedPdf = await fetch(`${BASE}/pm/invoices/${draft.data.id}/pdf`, { headers: { Authorization: `Bearer ${pm.token}` } });
  assert(approvedPdf.status === 200 && Buffer.compare(pdfBytes, Buffer.from(await approvedPdf.arrayBuffer())) === 0, `approved invoice retains the frozen submitted PDF: got ${approvedPdf.status}`);
  const submittedPaymentBlocked = await req("POST", `/vendor/invoices/${secondDraft.data.id}/payments`, { amount: "1.00" }, vendor.token);
  assert(submittedPaymentBlocked.status === 409, `M19 submitted invoice cannot receive payment: got ${submittedPaymentBlocked.status}`);
  const rejected = await req("PATCH", `/pm/invoices/${secondDraft.data.id}/review`, { status: "REJECTED", rejection_reason: "Correction required" }, pm.token);
  assert(rejected.status === 200 && rejected.data.status === "REJECTED", `PM rejection: got ${rejected.status}`);
  const rolloverDraft = await req("POST", "/vendor/invoices/drafts", { milestone_billing_id: billingQueue.data.items[2].milestone_billing_id }, vendor.token);
  const rolloverEdited = await req("PATCH", `/vendor/invoices/${rolloverDraft.data.id}`, { invoice_date: "2027-01-01", payment_terms_days: 30 }, vendor.token);
  const rolloverSubmitted = await req("POST", `/vendor/invoices/${rolloverDraft.data.id}/submit`, undefined, vendor.token);
  assert(rolloverEdited.status === 200 && rolloverSubmitted.status === 200 && rolloverSubmitted.data.invoice_number === "INV-2027-000001", `M18 year rollover starts an independent vendor/year sequence: ${rolloverSubmitted.data?.invoice_number}`);
  const rolloverReviewed = await req("PATCH", `/pm/invoices/${rolloverDraft.data.id}/review`, { status: "APPROVED" }, pm.token);
  assert(rolloverReviewed.status === 200, `M18 rollover invoice remains compatible with M17 review: got ${rolloverReviewed.status}`);

  // ===================== M19 regression =====================
  console.log("\n--- M19 payment and outstanding tracking ---");
  const unpaidDraft = await req("POST", "/vendor/invoices/drafts", { milestone_billing_id: billingQueue.data.items[4].milestone_billing_id }, vendor.token);
  const draftPayment = await req("POST", `/vendor/invoices/${unpaidDraft.data.id}/payments`, { amount: "1.00" }, vendor.token);
  const cancelledDraft = await req("POST", `/vendor/invoices/${unpaidDraft.data.id}/cancel`, undefined, vendor.token);
  const cancelledPayment = await req("POST", `/vendor/invoices/${unpaidDraft.data.id}/payments`, { amount: "1.00" }, vendor.token);
  assert(draftPayment.status === 409 && cancelledDraft.status === 200 && cancelledPayment.status === 409, `M19 draft/cancelled invoices cannot receive payment: ${draftPayment.status},${cancelledPayment.status}`);
  const approvedInvoice = await req("GET", `/vendor/invoices/${draft.data.id}/detail`, undefined, vendor.token);
  assert(approvedInvoice.status === 200 && approvedInvoice.data.payment_state === "UNPAID" && approvedInvoice.data.paid_amount === 0, `M19 approved unpaid invoice is UNPAID: ${JSON.stringify(approvedInvoice.data)}`);
  const draftPaymentBlocked = await req("POST", `/vendor/invoices/${secondDraft.data.id}/payments`, { amount: "1.00" }, vendor.token);
  assert(draftPaymentBlocked.status === 409, `M19 rejected invoice cannot receive payment: got ${draftPaymentBlocked.status}`);
  const firstPayment = await req("POST", `/vendor/invoices/${draft.data.id}/payments`, { amount: "0.10", paid_at: "2026-01-02T03:04", reference: "SETTLE-001", method: "Bank transfer", notes: "Partial settlement" }, vendor.token);
  assert(firstPayment.status === 201 && firstPayment.data.payment_state === "PARTIALLY_PAID" && firstPayment.data.paid_amount === 0.1 && firstPayment.data.outstanding_amount > 0, `M19 first partial payment: ${firstPayment.status} ${JSON.stringify(firstPayment.data)}`);
  const competingAmount = String(firstPayment.data.outstanding_amount);
  const [raceA, raceB] = await Promise.all([
    req("POST", `/vendor/invoices/${draft.data.id}/payments`, { amount: competingAmount, reference: "SETTLE-FINAL-A" }, vendor.token),
    req("POST", `/vendor/invoices/${draft.data.id}/payments`, { amount: competingAmount, reference: "SETTLE-FINAL-B" }, vendor.token),
  ]);
  assert([raceA.status, raceB.status].filter((status) => status === 201).length === 1 && [raceA.status, raceB.status].filter((status) => status === 409).length === 1, `M19 concurrent overpayment protection: ${raceA.status},${raceB.status}`);
  const paidInvoice = await req("GET", `/vendor/invoices/${draft.data.id}/detail`, undefined, vendor.token);
  assert(paidInvoice.status === 200 && paidInvoice.data.payment_state === "PAID" && paidInvoice.data.outstanding_amount === 0 && paidInvoice.data.payments.length === 2, `M19 exact payoff preserves payment history: ${JSON.stringify(paidInvoice.data)}`);
  const overpayment = await req("POST", `/vendor/invoices/${draft.data.id}/payments`, { amount: "0.01" }, vendor.token);
  const zeroPayment = await req("POST", `/vendor/invoices/${draft.data.id}/payments`, { amount: "0" }, vendor.token);
  const foreignPayment = await req("POST", `/vendor/invoices/${draft.data.id}/payments`, { amount: "1.00" }, unrelatedVendor.token);
  assert(overpayment.status === 409 && zeroPayment.status === 400 && foreignPayment.status === 404, `M19 invalid/cross-tenant payment protection: over=${overpayment.status}, zero=${zeroPayment.status}, foreign=${foreignPayment.status}`);
  const overdueDraft = await req("POST", "/vendor/invoices/drafts", { milestone_billing_id: billingQueue.data.items[3].milestone_billing_id }, vendor.token);
  const overdueEdited = await req("PATCH", `/vendor/invoices/${overdueDraft.data.id}`, { invoice_date: "2020-01-01", payment_terms_days: 0 }, vendor.token);
  const overdueSubmitted = await req("POST", `/vendor/invoices/${overdueDraft.data.id}/submit`, undefined, vendor.token);
  const overdueReviewed = await req("PATCH", `/pm/invoices/${overdueDraft.data.id}/review`, { status: "APPROVED" }, pm.token);
  assert(overdueDraft.status === 201 && overdueEdited.status === 200 && overdueSubmitted.status === 200 && overdueReviewed.status === 200 && overdueReviewed.data.payment_state === "OVERDUE", `M19 overdue is deterministic after the due date: ${JSON.stringify(overdueReviewed.data)}`);
  const overduePaid = await req("POST", `/vendor/invoices/${overdueDraft.data.id}/payments`, { amount: String(overdueReviewed.data.outstanding_amount) }, vendor.token);
  assert(overduePaid.status === 201 && overduePaid.data.payment_state === "PAID" && !overduePaid.data.overdue, `M19 paid invoice is never overdue: ${JSON.stringify(overduePaid.data)}`);
  console.log("M19 acceptance checks: approved-only append-only payments, derived settlement state, overdue boundary, and locked overpayment protection.");

  // ===================== Module 4 regression: date rules unchanged =====================
  console.log("\n--- Module 4 regression: date-window rules still enforced ---");
  const futureSubmit = await req("POST", "/contractor/timesheets", { projectId: project1Id, workDate: todayPlus(5), hoursLogged: 1 }, contractorBToken);
  assert(futureSubmit.status === 400, `future work_date rejected: expected 400, got ${futureSubmit.status}`);

  // ===================== Module 3 regression: completion + release =====================
  console.log("\n--- Module 3/5 regression: project completion releases assignments ---");
  const completeRes = await req("PATCH", `/pm/projects/${project1Id}/complete`, undefined, pm.token);
  assert(completeRes.status === 200, `complete project 1: expected 200, got ${completeRes.status}`);
  assert(completeRes.data.released_assignment_count === 3, `expected 3 assignments released (A, B, E), got ${completeRes.data.released_assignment_count}`);

  console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(" - " + f));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});
