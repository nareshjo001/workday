const env = require("../config/env");
const invoiceRepository = require("../repositories/invoiceRepository");
const milestoneRepository = require("../repositories/milestoneRepository");
const contractorRepository = require("../repositories/contractorRepository");

/**
 * Module 6 integration boundary — the same file, same exported function
 * name/signature-compatible call site Module 5 already wired up
 * (milestoneService.evaluateMilestonesForContractorProject, right after
 * a milestone's MET transition + billing snapshot both commit). Module 5
 * never had to change to make Module 6 real; only this file's body did.
 *
 * generateInvoiceForMilestone is now called with an added
 * `milestoneBillingId` field (see milestoneService's call site) —
 * `milestoneId`/`projectId`/`contractorId`/`billingAmount` are still
 * accepted for the original Module 5 signature, but this function does
 * NOT trust any of them for the actual invoice: project_id, contractor_id,
 * and amount are always re-derived from the milestone_billings row
 * itself (via milestoneBillingId), and vendor_id is always re-derived
 * from that contractor's own row — never from a caller-supplied value.
 * Module 6 spec section 5: "Never accept: amount / vendor_id /
 * contractor_id / status from an external HTTP request" — this function
 * isn't HTTP-reachable at all, but holds itself to the same rule against
 * its own (internal) caller, for the same reason.
 */

/**
 * Cents-integer comparison so a floating-point rounding artifact (e.g.
 * 9999.995 vs. 9999.9949999999) can never flip which side of the
 * threshold an amount lands on — the same "round to integer cents,
 * compare integers" approach billingService.calculateBillingAmount
 * already uses for the billing_amount value itself, applied here to the
 * threshold comparison too. amount === threshold lands on the
 * PENDING_REVIEW side (spec: "amount < threshold -> AUTO_APPROVED;
 * amount >= threshold -> PENDING_REVIEW" — a strict less-than for auto-
 * approval, deliberately not <=).
 */
function toCents(value) {
  return Math.round(Number(value) * 100);
}

function determineInitialStatus(amount) {
  return toCents(amount) < toCents(env.invoice.autoApprovalThreshold) ? "AUTO_APPROVED" : "PENDING_REVIEW";
}

/**
 * Called exactly once per newly-MET milestone, after that milestone's
 * transaction (MET transition + billing snapshot) has already committed
 * — see milestoneService's own doc comment for the full ordering
 * guarantee. Retry-safe/idempotent by design (Module 6 spec section 4):
 *
 *   1. Fast-path idempotency check: if an invoice already exists for
 *      this milestone_billing_id, return it — no second insert attempted.
 *   2. Load the milestone_billings row itself (authoritative project_id/
 *      contractor_id/billing_amount — see this file's own top comment
 *      for why these are re-derived here rather than trusted from the
 *      caller). Missing row (edge case: "milestone has no billing
 *      record") logs and returns null rather than throwing — there is
 *      nothing to invoice.
 *   3. Load the contractor to resolve vendor_id server-side.
 *   4. amount = billing.billing_amount, taken verbatim — NEVER
 *      recalculated as approved_hours * hourly_rate (Module 5 already
 *      did that once, immutably; recomputing it here would let a later
 *      hourly_rate change silently alter a historical invoice).
 *   5. status = AUTO_APPROVED or PENDING_REVIEW, from
 *      determineInitialStatus (env.invoice.autoApprovalThreshold, not a
 *      hard-coded constant).
 *   6. INSERT. If a concurrent call already won the race (ER_DUP_ENTRY
 *      against UNIQUE(milestone_billing_id) — see migration 015), that
 *      is NOT an error: re-fetch and return the winner's row instead.
 *   7. Return the created (or already-existing) invoice.
 *
 * Never throws for any of the documented edge cases (missing billing
 * row, missing contractor, duplicate generation) — only an unexpected DB
 * error propagates, which the caller (milestoneService) already wraps in
 * its own try/catch per milestone, exactly like the Module 5 stub this
 * replaces.
 *
 * @param {object} params
 * @param {number} params.milestoneBillingId - The milestone_billings row this invoice is generated from.
 * @param {number} [params.milestoneId] - Accepted for the original Module 5 call signature; not used for the insert (re-derived via milestoneBillingId).
 * @param {number} [params.projectId] - Accepted for the original Module 5 call signature; not used for the insert (re-derived via milestoneBillingId).
 * @param {number} [params.contractorId] - Accepted for the original Module 5 call signature; not used for the insert (re-derived via milestoneBillingId).
 * @param {number} [params.billingAmount] - Accepted for the original Module 5 call signature; not used for the insert (re-derived via milestoneBillingId).
 * @returns {Promise<object|null>} The invoice row (existing or newly created), or null if there was nothing to invoice.
 */
async function generateInvoiceForMilestone({ milestoneBillingId }) {
  if (!milestoneBillingId) {
    // Should be unreachable — milestoneService always threads billingId
    // through from billingService.createBillingRecord — but guard rather
    // than attempt an insert with no billing to anchor to.
    console.error("[invoiceService] generateInvoiceForMilestone called without milestoneBillingId — nothing to invoice.");
    return null;
  }

  // 1. Idempotency fast path — a friendly pre-check before ever
  // attempting an insert. This is NOT the actual concurrency guarantee
  // (two calls could both pass this check before either has inserted);
  // it just makes the common case (a genuine duplicate call, not a
  // race) cheap and error-free. See step 6 for the real guarantee.
  const existing = await invoiceRepository.findByMilestoneBillingId(milestoneBillingId);
  if (existing) return existing;

  // 2. Load the billing snapshot itself — authoritative project_id/
  // contractor_id/billing_amount.
  const billing = await milestoneRepository.findBillingById(milestoneBillingId);
  if (!billing) {
    console.error(
      `[invoiceService] no milestone_billings row found for id ${milestoneBillingId} — cannot generate invoice.`
    );
    return null;
  }

  // 3. Resolve vendor_id server-side from the contractor's own row —
  // never from a request, never from the caller's params.
  const contractor = await contractorRepository.findById(billing.contractor_id);
  if (!contractor) {
    console.error(
      `[invoiceService] no contractor found for id ${billing.contractor_id} (billing ${milestoneBillingId}) — cannot generate invoice.`
    );
    return null;
  }

  // 4-5. Amount is the immutable Module 5 snapshot, verbatim. Status is
  // derived from the configured threshold, never hard-coded.
  const amount = billing.billing_amount;
  const status = determineInitialStatus(amount);

  let invoiceId;
  try {
    invoiceId = await invoiceRepository.create({
      milestoneBillingId,
      projectId: billing.project_id,
      contractorId: billing.contractor_id,
      vendorId: contractor.vendor_id,
      amount,
      status,
    });
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY") {
      // 6. Lost a genuine race to another concurrent call for the SAME
      // milestone_billing_id — UNIQUE(milestone_billing_id) is the real
      // guarantee here, not the step-1 pre-check. Return whatever the
      // winner created rather than treating this as a failure.
      return invoiceRepository.findByMilestoneBillingId(milestoneBillingId);
    }
    throw err;
  }

  // 7. Return the freshly created invoice.
  return invoiceRepository.findById(invoiceId);
}

module.exports = { generateInvoiceForMilestone, determineInitialStatus };
