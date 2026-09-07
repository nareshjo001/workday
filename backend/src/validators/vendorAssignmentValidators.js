const ApiError = require("../utils/ApiError");

function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function isValidDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Validates the URL params + body for
 * POST /api/vendor/projects/:projectId/requirements/:requirementId/assign.
 * Returns { projectId, requirementId, contractorIds } on success, throws
 * ApiError(400) otherwise.
 *
 * MVP FIX 1 ("work-hour allocation must belong to the PM, not the
 * Vendor"): the body shape is a plain `contractorIds: number[]` — there
 * is deliberately NO `allocatedHours`/`allocated_hours` field parsed
 * anywhere in this file. This is not a UI-only restriction: if a caller
 * sends `{ contractorIds: [...], allocatedHours: ... }` (or any other
 * hours-shaped field) anyway, this validator simply never reads it — it
 * is dropped on the floor before ever reaching vendorAssignmentService,
 * which itself has no parameter for it either (see that function's own
 * doc comment). Allocating hours to an already-assigned contractor is
 * exclusively a PM action — see pmProjectValidators.validateUpdateAllocation
 * and pmProjectService.updateContractorAllocation.
 *
 * Deliberately does NOT accept vendor_id or pm ownership from the body —
 * the assigning vendor is always derived server-side from the
 * authenticated JWT (see vendorAssignmentService.assignContractors), and
 * project/requirement ownership is re-verified in the service, not
 * trusted from params alone.
 */
function validateAssignContractors(params = {}, body = {}) {
  const errors = [];

  const projectId = parsePositiveInt(params.id);
  const requirementId = parsePositiveInt(params.requirementId);

  if (!projectId) errors.push("projectId must be a positive integer.");
  if (!requirementId) errors.push("requirementId must be a positive integer.");

  const contractorIdsInput = Array.isArray(body.contractorIds) ? body.contractorIds : null;
  const contractorIds = [];
  const seenContractorIds = new Set();
  if (!contractorIdsInput || contractorIdsInput.length === 0) {
    errors.push("contractorIds is required and must be a non-empty array.");
  } else {
    contractorIdsInput.forEach((entry, index) => {
      const contractorId = parsePositiveInt(entry);
      if (!contractorId) {
        errors.push(`contractorIds[${index}] must be a positive integer.`);
        return;
      }
      if (seenContractorIds.has(contractorId)) {
        errors.push(`contractorIds contains duplicate contractorId ${contractorId}.`);
        return;
      }
      seenContractorIds.add(contractorId);
      contractorIds.push(contractorId);
    });
  }

  const startDate = body.start_date === undefined || body.start_date === "" ? null : body.start_date;
  const endDate = body.end_date === undefined || body.end_date === "" ? null : body.end_date;
  if (startDate !== null && !isValidDateString(startDate)) errors.push("start_date must be a valid YYYY-MM-DD date.");
  if (endDate !== null && !isValidDateString(endDate)) errors.push("end_date must be a valid YYYY-MM-DD date.");
  if (startDate && endDate && endDate < startDate) errors.push("end_date cannot be before start_date.");

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return { projectId, requirementId, contractorIds, startDate, endDate };
}

module.exports = { validateAssignContractors };
