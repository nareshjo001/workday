// Live-server regression: released assignment history must not prevent future staffing eligibility.

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
  if (role === "PM") body.companyName = `${name} Co`;
  const { status, data } = await req("POST", "/auth/signup", body);
  if (status !== 201) throw new Error(`signup failed for ${role}: ${JSON.stringify(data)}`);
  const loginRes = await req("POST", "/auth/login", { email, password });
  if (loginRes.status !== 200) throw new Error(`post-signup login failed for ${role}: ${JSON.stringify(loginRes.data)}`);
  return { token: loginRes.data.token, email, password };
}

async function main() {
  console.log("=== Eligible-contractor-after-release regression test ===\n");

  const pm = await signup("PM", "Release Test PM");
  const vendor = await signup("VENDOR", "Release Test Vendor");
  async function submitAndAccept(projectId, requirementId, contractorId) {
    const submitted = await req("POST", `/vendor/projects/${projectId}/requirements/${requirementId}/candidates`, { contractor_id: contractorId }, vendor.token);
    if (submitted.status !== 201) return submitted;
    const accepted = await req("PATCH", `/pm/candidate-submissions/${submitted.data.id}`, { status: "ACCEPTED" }, pm.token);
    return { status: accepted.status === 200 ? 201 : accepted.status, data: accepted.data };
  }

  const createRes = await req(
    "POST",
    "/vendor/contractors",
    { name: "Release Test Contractor", email: uniq("releasetest") + "@test.com", password: "Password123!", hourly_rate: 50 },
    vendor.token
  );
  assert(createRes.status === 201, `create contractor: expected 201, got ${createRes.status} ${JSON.stringify(createRes.data)}`);
  const contractorId = createRes.data.id;
  assert(createRes.data.status === "ACTIVE", `new contractor should be ACTIVE, got ${createRes.data.status}`);

  const contractorLogin = await req("POST", "/auth/login", { email: createRes.data.email, password: "Password123!" });
  assert(contractorLogin.status === 200, "contractor login");
  const contractorToken = contractorLogin.data.token;
  const skillRes = await req("PATCH", "/contractor/profile/skill", { skill: "BACKEND" }, contractorToken);
  assert(skillRes.status === 200, `set contractor skill: expected 200, got ${skillRes.status}`);

  const projA = await req(
    "POST",
    "/pm/projects",
    { name: "Release Test Project A", start_date: todayPlus(0), expected_hours: 10, requirements: [{ skill: "BACKEND", required_count: 1 }] },
    pm.token
  );
  assert(projA.status === 201, `create project A: expected 201, got ${projA.status} ${JSON.stringify(projA.data)}`);
  const reqAId = projA.data.requirements[0].id;

  const assignA = await submitAndAccept(projA.data.id, reqAId, contractorId);
  assert(assignA.status === 201, `assign contractor to project A: expected 201, got ${assignA.status} ${JSON.stringify(assignA.data)}`);

  // Probe a second requirement with the same skill to test active-assignment exclusion.
  const projProbe1 = await req(
    "POST",
    "/pm/projects",
    { name: "Release Test Probe 1", start_date: todayPlus(0), expected_hours: 10, requirements: [{ skill: "BACKEND", required_count: 1 }] },
    pm.token
  );
  const probe1ReqId = projProbe1.data.requirements[0].id;
  const eligibleWhileActive = await req(
    "GET",
    `/vendor/projects/${projProbe1.data.id}/requirements/${probe1ReqId}/eligible-contractors`,
    undefined,
    vendor.token
  );
  assert(eligibleWhileActive.status === 200, `list eligible (while ACTIVE on A): expected 200, got ${eligibleWhileActive.status}`);
  const foundWhileActive = eligibleWhileActive.data.eligible_contractors.some((c) => c.id === contractorId);
  assert(!foundWhileActive, "contractor with an ACTIVE assignment must NOT appear in the eligible list");

  const completeA = await req("PATCH", `/pm/projects/${projA.data.id}/complete`, undefined, pm.token);
  assert(completeA.status === 200, `complete project A: expected 200, got ${completeA.status} ${JSON.stringify(completeA.data)}`);
  assert(completeA.data.released_assignment_count === 1, `expected 1 assignment released, got ${completeA.data.released_assignment_count}`);

  const teamA = await req("GET", `/pm/projects/${projA.data.id}/contractors`, undefined, pm.token);
  assert(teamA.status === 200, `list project A contractors: expected 200, got ${teamA.status}`);
  const contractorRowA = teamA.data.find((c) => c.contractor_id === contractorId);
  assert(!!contractorRowA, "contractor row should still exist (historical) on project A");
  assert(
    contractorRowA?.assignment_status === "RELEASED",
    `contractor's project A assignment should now be RELEASED, got ${contractorRowA?.assignment_status}`
  );

  const eligibleAfterRelease = await req(
    "GET",
    `/vendor/projects/${projProbe1.data.id}/requirements/${probe1ReqId}/eligible-contractors`,
    undefined,
    vendor.token
  );
  assert(eligibleAfterRelease.status === 200, `list eligible (after release): expected 200, got ${eligibleAfterRelease.status}`);
  const foundAfterRelease = eligibleAfterRelease.data.eligible_contractors.some((c) => c.id === contractorId);
  assert(foundAfterRelease, "contractor with only a RELEASED assignment MUST appear in the eligible list — this is the core bug-fix assertion");

  const projB = await req(
    "POST",
    "/pm/projects",
    { name: "Release Test Project B", start_date: todayPlus(0), expected_hours: 10, requirements: [{ skill: "BACKEND", required_count: 1 }] },
    pm.token
  );
  const reqBId = projB.data.requirements[0].id;
  const assignB = await submitAndAccept(projB.data.id, reqBId, contractorId);
  assert(assignB.status === 201, `assign contractor to project B: expected 201, got ${assignB.status} ${JSON.stringify(assignB.data)}`);

  const teamB = await req("GET", `/pm/projects/${projB.data.id}/contractors`, undefined, pm.token);
  const contractorRowB = teamB.data.find((c) => c.contractor_id === contractorId);
  assert(contractorRowB?.assignment_status === "ACTIVE", `contractor's project B assignment should be ACTIVE, got ${contractorRowB?.assignment_status}`);

  // Use a fresh requirement to verify that the new active assignment blocks overlapping eligibility.
  const projProbe2 = await req(
    "POST",
    "/pm/projects",
    { name: "Release Test Probe 2", start_date: todayPlus(0), expected_hours: 10, requirements: [{ skill: "BACKEND", required_count: 1 }] },
    pm.token
  );
  const probe2ReqId = projProbe2.data.requirements[0].id;
  const eligibleWhileActiveB = await req(
    "GET",
    `/vendor/projects/${projProbe2.data.id}/requirements/${probe2ReqId}/eligible-contractors`,
    undefined,
    vendor.token
  );
  const foundWhileActiveB = eligibleWhileActiveB.data.eligible_contractors.some((c) => c.id === contractorId);
  assert(!foundWhileActiveB, "contractor with an ACTIVE assignment on project B must NOT appear in the eligible list");

  // Retain eligibility with two released assignments and no active assignment.
  const completeB = await req("PATCH", `/pm/projects/${projB.data.id}/complete`, undefined, pm.token);
  assert(completeB.status === 200, `complete project B: expected 200, got ${completeB.status}`);
  const eligibleAfterTwoReleases = await req(
    "GET",
    `/vendor/projects/${projProbe2.data.id}/requirements/${probe2ReqId}/eligible-contractors`,
    undefined,
    vendor.token
  );
  const foundAfterTwoReleases = eligibleAfterTwoReleases.data.eligible_contractors.some((c) => c.id === contractorId);
  assert(
    foundAfterTwoReleases,
    "edge case: contractor with MULTIPLE historical RELEASED rows and no ACTIVE row must still be eligible"
  );

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
