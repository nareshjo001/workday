const ApiError = require("../utils/ApiError");

const MAX_RATE = 99999999.99;
const positiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;

function validateAnalysisInput(body = {}) {
  const allowed = ["contractorId", "projectId", "requirementId", "proposedBillRate"];
  const errors = [];
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !allowed.includes(key))) errors.push("Provide only supported rate-intelligence fields.");
  const contractorId = positiveId(body.contractorId);
  const projectId = positiveId(body.projectId);
  const requirementId = positiveId(body.requirementId);
  if (!contractorId) errors.push("contractorId must be a positive integer.");
  if (!projectId) errors.push("projectId must be a positive integer.");
  if (!requirementId) errors.push("requirementId must be a positive integer.");
  let proposedBillRate = null;
  if (body.proposedBillRate !== undefined && body.proposedBillRate !== null && body.proposedBillRate !== "") {
    proposedBillRate = Number(body.proposedBillRate);
    if (!Number.isFinite(proposedBillRate) || proposedBillRate <= 0 || proposedBillRate > MAX_RATE || Math.round(proposedBillRate * 100) !== proposedBillRate * 100) errors.push("proposedBillRate must be a positive amount with at most two decimal places.");
  }
  if (errors.length) throw ApiError.badRequest("Validation failed", errors);
  return { contractorId, projectId, requirementId, proposedBillRate };
}

module.exports = { validateAnalysisInput };
