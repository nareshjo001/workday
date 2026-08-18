const { pool } = require("../config/db");
const invoiceRepository = require("../repositories/invoiceRepository");
const ApiError = require("../utils/ApiError");

/**
 * Vendor-facing invoice list (Module 6). Only ever returns invoices whose
 * snapshotted vendor_id matches the authenticated vendor — scoped in the
 * repository's SQL, not filtered afterward (see
 * invoiceRepository.listForVendor's own comment on why the invoice's own
 * vendor_id column, not a live join to contractors.vendor_id, is the
 * ownership boundary here). There is no vendor_id parameter anywhere in
 * this file's signatures — vendorId always comes from the caller
 * resolving req.user.userId off the JWT (see vendorInvoiceController).
 */
async function listForVendor(vendorId) {
  return invoiceRepository.listForVendor(vendorId);
}

/**
 * Approves or rejects a single invoice on behalf of the authenticated
 * Vendor — PATCH /api/vendor/invoices/:id. INVOICE-WORKFLOW REDESIGN:
 * this mutation did not exist before this redesign (the Vendor invoice
 * controller was previously read-only) — approval authority moves from
 * PM to Vendor here, since a Vendor is the one financially accountable
 * for their own contractor's billed hours; a PM only gets read-only
 * visibility after the Vendor decides (see invoiceApprovalService,
 * retired to a read-only listForPm).
 *
 * `vendorId` is req.user.userId off the JWT — reviewed_by is always this
 * value, never anything from the request body.
 *
 * Transaction, same lock-then-conditional-update shape as every other
 * review flow in this codebase (pmTimesheetService.reviewTimesheet, the
 * old invoiceApprovalService.reviewInvoice this supersedes):
 *   1. BEGIN.
 *   2. lockOwnedByVendorForReview locks the invoice row (`SELECT ... FOR
 *      UPDATE`), scoped to this vendor's own snapshotted vendor_id. A
 *      second concurrent review request for the SAME invoice — e.g. one
 *      request approving, another simultaneously rejecting — blocks here
 *      until this transaction commits or rolls back; only one of the two
 *      can ever win (spec requirement: "transactionally race-safe so
 *      simultaneous approve+reject on the same invoice can't both
 *      succeed").
 *   3. Not found (doesn't exist OR belongs to another vendor's
 *      contractor) -> 404, same message either way — no existence
 *      leakage, never confirms whether an id belongs to someone else.
 *   4. Not PENDING_REVIEW (already APPROVED/REJECTED/AUTO_APPROVED) ->
 *      409 — every one of those is a terminal state, no transition out
 *      of any of them is ever allowed.
 *   5. applyReview does the conditional UPDATE ... WHERE status =
 *      'PENDING_REVIEW', the actual atomicity backstop under
 *      concurrency — if two requests both got past the lock in some
 *      interleaving, only one UPDATE can match; the loser's
 *      affectedRows = 0 becomes a 409 too, never a silent overwrite.
 *   6. COMMIT.
 */
async function reviewInvoice(vendorId, invoiceId, { status, rejectionReason }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const invoice = await invoiceRepository.lockOwnedByVendorForReview(conn, invoiceId, vendorId);
    if (!invoice) {
      // Same 404 whether the invoice doesn't exist at all or belongs to
      // another vendor's contractor — never confirm which.
      throw ApiError.notFound("Invoice not found.");
    }
    if (invoice.status !== "PENDING_REVIEW") {
      throw ApiError.conflict("This invoice is not pending review.");
    }

    const updated = await invoiceRepository.applyReview(conn, invoiceId, {
      status,
      reviewedBy: vendorId,
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
  // as every other review flow in this codebase.
  return invoiceRepository.findDetailedById(invoiceId);
}

module.exports = { listForVendor, reviewInvoice };
