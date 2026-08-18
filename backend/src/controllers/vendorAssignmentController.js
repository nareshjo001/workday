const vendorAssignmentService = require("../services/vendorAssignmentService");
const { validateAssignContractors } = require("../validators/vendorAssignmentValidators");
const asyncHandler = require("../utils/asyncHandler");

/**
 * `req.user.userId` is the ONLY source of the assigning vendor's
 * identity — vendor_id is never read from the request body or params.
 * Ownership of the contractors, and of the project/requirement pairing,
 * is verified inside the service, not here.
 */
const assign = asyncHandler(async (req, res) => {
  const { projectId, requirementId, contractorIds } = validateAssignContractors(req.params, req.body);
  const result = await vendorAssignmentService.assignContractors(
    req.user.userId,
    projectId,
    requirementId,
    contractorIds
  );
  res.status(201).json(result);
});

module.exports = { assign };
