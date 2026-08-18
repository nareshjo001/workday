const { pool } = require("../config/db");
const invoiceRepository = require("../repositories/invoiceRepository");
const ApiError = require("../utils/ApiError");

/**
 * PM-facing invoice review — the "approval" half of Module 6, kept
 * separate from invoiceService.js's "generation" half per the module's
 * own layering (MilestoneService -> BillingService -> InvoiceService for
 * generation; this file is PM review, a distinct responsibility that
 * happens later, out-of-band, driven by a human rather than a Module 5
 * hook). Mirrors pmTimesheetService's structure closely — same
 * lock-then-conditional-update transaction shape, same "PM identity only
 * ever comes from the JWT" rule.
 */

/**
 * Only ever returns PENDING_REVIEW invoices for projects owned by
 * `pmId` — scoped in the repository's SQL, not filtered afterward (see
 * invoiceRepository.listPendingForPm's own comment). AUTO_APPROVED
 * invoices never appear here — this is specifically the PM's manual
 * review queue.
 */
async function listPendingForPm(pmId) {
  return invoiceRepository.listPendingForPm(pmId);
}

/**
 * Approves or rejects a single invoice on behalf of the authenticated
 * PM. `pmId` is req.user.userId off the JWT — reviewed_by is always this
 * value, never anything from the request body.
 *
 * Transaction, same shape as pmTimesheetService.reviewTimesheet:
 *   1. BEGIN.
 *   2. lockOwnedByPmForReview locks the invoice row (`SELECT ... FOR
 *      UPDATE`), scoped to projects owned by this PM in the JOIN itself.
 *      A second concurrent review request for the SAME invoice blocks
 *      here until this transaction commits or rolls back.
 *   3. Not found (doesn't exist OR belongs to another PM's project) ->
 *      404, same message either way — no existence leakage (spec
 *      section 6/10).
 *   4. Not PENDING_REVIEW (already AUTO_APPROVED/APPROVED/REJECTED) ->
 *      409 — every one of those is a terminal state, no transition out
 *      of any of them is ever allowed (spec section 7's explicit
 *      transition table).
 *   5. applyReview does the conditional UPDATE ... WHERE status =
 *      'PENDING_REVIEW', the actual atomicity backstop under
 *      concurrency — if two requests both got past the lock in some
 *      interleaving, only one UPDATE can match; the loser's
 *      affectedRows = 0 becomes a 409 too, never a silent overwrite.
 *   6. COMMIT.
 */
async function reviewInvoice(pmId, invoiceId, { status, rejectionReason }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const invoice = await invoiceRepository.lockOwnedByPmForReview(conn, invoiceId, pmId);
    if (!invoice) {
      // Same 404 whether the invoice doesn't exist at all or exists but
      // belongs to another PM's project — never confirm which.
      throw ApiError.notFound("Invoice not found.");
    }
    if (invoice.status !== "PENDING_REVIEW") {
      // Covers every disallowed transition from the spec's table in one
      // check: AUTO_APPROVED, APPROVED, and REJECTED are all terminal —
      // none of them can move to APPROVED or REJECTED through this
      // endpoint.
      throw ApiError.conflict("This invoice is not pending review.");
    }

    const updated = await invoiceRepository.applyReview(conn, invoiceId, {
      status,
      reviewedBy: pmId,
      rejectionReason: status === "REJECTED" ? rejectionReason : null,
    });
    if (!updated) {
      // Lost the race to another request between the lock read above and
      // this UPDATE (should be unreachable given the row lock, but the
      // conditional UPDATE is the real guarantee — guard anyway rather
      // than assuming the lock alone is sufficient).
      throw ApiError.conflict("This invoice has already been reviewed.");
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  // Re-fetch fresh, post-commit state for the response, same convention
  // as pmTimesheetService.reviewTimesheet — the client should see the
  // true server-side row, not a locally-reconstructed one.
  return invoiceRepository.findDetailedById(invoiceId);
}

module.exports = { listPendingForPm, reviewInvoice };
