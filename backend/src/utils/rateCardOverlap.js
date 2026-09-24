const MAX_DATE = "9999-12-31";

/**
 * The authoritative active-rate-card period rule. Currency deliberately is
 * not part of the identity: cards are scoped by client, vendor, and skill.
 * Date boundaries are inclusive and a null end date is ongoing.
 */
function activeRateCardPeriodsOverlap(left, right) {
  if (left.status !== "ACTIVE" || right.status !== "ACTIVE") return false;
  if (left.clientCompanyId !== right.clientCompanyId || left.vendorId !== right.vendorId || left.skillId !== right.skillId) return false;
  return left.effectiveFrom <= (right.effectiveTo || MAX_DATE) && (left.effectiveTo || MAX_DATE) >= right.effectiveFrom;
}

async function findOverlappingActiveRateCard(conn, candidate, { excludeId = null, lock = false } = {}) {
  const values = [candidate.clientCompanyId, candidate.vendorId, candidate.skillId, candidate.effectiveTo || null, candidate.effectiveFrom];
  const exclusion = excludeId === null ? "" : " AND id != ?";
  if (excludeId !== null) values.push(excludeId);
  const [rows] = await conn.query(
    `SELECT id FROM rate_cards WHERE client_company_id=? AND vendor_id=? AND skill_id=? AND status='ACTIVE' AND effective_from<=COALESCE(?, '${MAX_DATE}') AND COALESCE(effective_to,'${MAX_DATE}')>=?${exclusion} LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    values,
  );
  return rows[0] || null;
}

module.exports = { activeRateCardPeriodsOverlap, findOverlappingActiveRateCard };
