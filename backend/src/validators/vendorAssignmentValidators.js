const ApiError = require("../utils/ApiError");

function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Validates the URL params + body for
 * POST /api/vendor/projects/:projectId/requirements/:requirementId/assign.
 * Returns { projectId, requirementId, contractorIds } on success, throws
 * ApiError(400) otherwise. Deliberately does NOT accept vendor_id or
 * pm ownership from the body — the assigning vendor is always derived
 * server-side from the authenticated JWT (see
 * vendorAssignmentService.assignContractors), and project/requirement
 * ownership is re-verified in the service, not trusted from params alone.
 */
function validateAssignContractors(params = {}, body = {}) {
  const errors = [];

  const projectId = parsePositiveInt(params.id);
  const requirementId = parsePositiveInt(params.requirementId);

  if (!projectId) errors.push("projectId must be a positive integer.");
  if (!requirementId) errors.push("requirementId must be a positive integer.");

  const contractorIdsInput = Array.isArray(body.contractorIds) ? body.contractorIds : null;
  const contractorIds = [];
  if (!contractorIdsInput || contractorIdsInput.length === 0) {
    errors.push("contractorIds is required and must be a non-empty array.");
  } else {
    contractorIdsInput.forEach((raw, index) => {
      const id = parsePositiveInt(raw);
      if (!id) {
        errors.push(`contractorIds[${index}] must be a positive integer.`);
      } else {
        contractorIds.push(id);
      }
    });
  }

  if (errors.length > 0) {
    throw ApiError.badRequest("Validation failed", errors);
  }

  return { projectId, requirementId, contractorIds };
}

module.exports = { validateAssignContractors };
