const milestoneRepository = require("../repositories/milestoneRepository");

/**
 * Billing calculation — deliberately its own module, separate from
 * milestoneService (detection) and invoiceService (Module 6 hook), per
 * the Module 5 architecture requirement:
 *   MilestoneService -> BillingService -> InvoiceService
 * Each stage has exactly one responsibility: milestoneService decides
 * WHETHER a milestone is met, billingService decides HOW MUCH it's worth
 * and records that immutably, invoiceService decides what (if anything)
 * happens next. Nothing here ever re-derives billing_amount from live
 * contractor data after the fact — see createBillingRecord below.
 */

/**
 * Pure calculation, no I/O: rounds to 2 decimal places (currency
 * precision, matches milestone_billings.billing_amount DECIMAL(12,2)) so
 * floating-point multiplication never produces a value the column would
 * silently truncate differently than what's shown/logged here.
 */
function calculateBillingAmount(approvedHours, hourlyRate) {
  const amount = Number(approvedHours) * Number(hourlyRate);
  return Math.round(amount * 100) / 100;
}

/**
 * Creates the immutable billing snapshot for a milestone that was just
 * marked MET. Must be called on the SAME transaction-scoped `conn`, and
 * within the SAME transaction, as the markMet() call that transitioned
 * the milestone (see milestoneService.evaluateMilestonesForContractorProject)
 * — the milestone row lock held for that transaction is what guarantees
 * this insert can never run twice for the same milestone.
 *
 * `approvedHours` and `hourlyRate` are the caller's already-read,
 * transaction-consistent snapshot values (approvedHours from
 * milestoneRepository.sumApprovedHours, hourlyRate from
 * contractorRepository.findByIdForUpdate, both read inside the same
 * transaction) — this function does not re-read either, it only computes
 * billing_amount from what it's given and persists all three together.
 *
 * Returns the created billing record (including `billingId`, the
 * milestone_billings row's own id — Module 6's invoiceService anchors
 * invoices to this exact id via invoices.milestone_billing_id, so it
 * has to travel back out of this function rather than being discarded),
 * or null if a billing row for this milestone already exists
 * (ER_DUP_ENTRY against uq_milestone_billings_milestone_contractor) —
 * treated as "already billed, nothing to do" rather than an error, since
 * under the milestone row lock this should be unreachable but is not
 * assumed to be.
 */
async function createBillingRecord(conn, { milestoneId, contractorId, approvedHours, hourlyRate }) {
  const billingAmount = calculateBillingAmount(approvedHours, hourlyRate);
  let billingId;
  try {
    billingId = await milestoneRepository.createBilling(conn, {
      milestoneId,
      contractorId,
      approvedHours,
      hourlyRate,
      billingAmount,
    });
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY") {
      return null;
    }
    throw err;
  }
  return { billingId, milestoneId, contractorId, approvedHours, hourlyRate, billingAmount };
}

module.exports = { calculateBillingAmount, createBillingRecord };
