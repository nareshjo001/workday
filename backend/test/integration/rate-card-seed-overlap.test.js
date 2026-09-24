const assert = require("node:assert/strict");
const test = require("node:test");
const { activeRateCardPeriodsOverlap } = require("../../src/utils/rateCardOverlap");
const { ensureActiveRateCard } = require("../../scripts/rateCardSeed");

const card = (overrides = {}) => ({ clientCompanyId: 1, vendorId: 2, skillId: 3, effectiveFrom: "2026-01-01", effectiveTo: null, status: "ACTIVE", ...overrides });

test("demo rate seeding uses the rate-card inclusive active-period rule", () => {
  assert.equal(activeRateCardPeriodsOverlap(card(), card({ effectiveFrom: "2026-08-10" })), true, "null effective_to is ongoing");
  assert.equal(activeRateCardPeriodsOverlap(card({ effectiveTo: "2026-09-15" }), card({ effectiveFrom: "2026-09-15", effectiveTo: "2026-12-31" })), true, "boundary dates are inclusive");
  assert.equal(activeRateCardPeriodsOverlap(card(), card({ skillId: 4 })), false, "different skills remain independent");
  assert.equal(activeRateCardPeriodsOverlap(card(), card({ status: "INACTIVE" })), false, "inactive cards do not block active seeding");
});

test("rerunning demo rate seeding reuses an overlapping active card without inserting", async () => {
  const calls = [];
  const conn = { query: async (sql, params) => { calls.push({ sql, params }); return [[{ id: 41 }]]; } };
  const id = await ensureActiveRateCard(conn, { clientCompanyId: 1, vendorId: 2, skillId: 3, billRate: 250, costRate: 155 });
  assert.equal(id, 41);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /status='ACTIVE'/);
  assert.match(calls[0].sql, /COALESCE\(effective_to,'9999-12-31'\)>=\?/);
});

test("demo seeding inserts only when no active overlap exists", async () => {
  const calls = [];
  const conn = { query: async (sql, params) => { calls.push({ sql, params }); return calls.length === 1 ? [[]] : [{ insertId: 42 }]; } };
  const id = await ensureActiveRateCard(conn, { clientCompanyId: 1, vendorId: 2, skillId: 3, billRate: 250, costRate: 155 });
  assert.equal(id, 42);
  assert.equal(calls.length, 2);
  assert.match(calls[1].sql, /^INSERT INTO rate_cards/);
});
