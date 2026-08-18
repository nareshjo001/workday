const ApiError = require("../utils/ApiError");

const ALLOWED_STATUSES = ["APPROVED", "REJECTED"];
// Matches invoices.rejection_reason VARCHAR(500).
const REJECTION_REASON_MAX_LENGTH = 500;

function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Validates the :id route param for PATCH /api/pm/invoices/:id.
 * Same parsePositiveInt-based pattern as pmTimesheetValidators/
 * pmMilestoneValidators.
 */
function validateInvoiceIdParam(params = {}) {
  const invoiceId = parsePositiveInt(params.id);
  if (!invoiceId) {
    throw ApiError.badRequest("Validation failed", ["id must be a positive integer."]);
  }
  return invoiceId;
}

/**
 * Validates the payload for PATCH /api/pm/invoices/:id. Returns
 * { status, rejectionReason } on success, throws ApiError(400)
 * otherwise. Only APPROVED or REJECTED are ever accepted — a client
 * cannot set an invoice to PENDING_REVIEW or AUTO_APPROVED through this
 * endpoint (those are never PM-settable states). rejection_reason is
 * required, non-blank, and length-bounded when rejecting; ignored
 * entirely when approving (never persisted, see
 * invoiceApprovalService.reviewInvoice). Deliberately does NOT accept
 * reviewed_by/reviewed_at/amount/vendor_id/contractor_id from the body —
 * those are always derived server-side, exactly per spec section 10's
 * IDOR audit list.
 */
function validateReviewInvoice(body = {}) {
  const errors = [];

  const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  if (!status) {
    errors.push("status is required.");
  } else if (!ALLOWED_STATUSES.includes(status)) {
    errors.push(`status must be one of: ${ALLOWED_STATUSES.join(", ")}.`);
  }

  let rejectionReason;
  if (status === "REJECTED") {
    const raw = typeof body.rejection_reason === "string" ? body.rejection_reason.trim() : "";
    if (!raw) {
      errors.push("rejection_reason is required when rejecting an invoice.");
    } else if (raw.length > REJECTION_REASON_MAX_LENGTH) {
      errors.push(`rejection_reason must be at most ${REJECTION_REASON_MAX_LENGTH} characters.`);
    } else {
      rejectionReason = raw;
    }
  }

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return { status, rejectionReason };
}

module.exports = { validateInvoiceIdParam, validateReviewInvoice, REJECTION_REASON_MAX_LENGTH };
