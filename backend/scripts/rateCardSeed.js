const { findOverlappingActiveRateCard } = require("../src/utils/rateCardOverlap");

async function ensureActiveRateCard(conn, { clientCompanyId, vendorId, skillId, billRate, costRate, currency = "USD", effectiveFrom = "2026-01-01", effectiveTo = null }) {
  const existing = await findOverlappingActiveRateCard(conn, { clientCompanyId, vendorId, skillId, effectiveFrom, effectiveTo });
  if (existing) return existing.id;
  const [result] = await conn.query(
    "INSERT INTO rate_cards(client_company_id,vendor_id,skill_id,effective_from,effective_to,bill_rate,cost_rate,currency,status) VALUES(?,?,?,?,?,?,?,?, 'ACTIVE')",
    [clientCompanyId, vendorId, skillId, effectiveFrom, effectiveTo, billRate, costRate, currency],
  );
  return result.insertId;
}

module.exports = { ensureActiveRateCard };
