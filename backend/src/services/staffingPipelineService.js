const ApiError = require("../utils/ApiError");
const pipeline = require("../repositories/staffingPipelineRepository");

const OPEN_STATUSES = new Set(["SUBMITTED", "SHORTLISTED"]);

function positiveInt(value, name) {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw ApiError.badRequest("Validation failed", [`${name} must be a positive integer.`]);
  return parsed;
}

function filtersFrom(query = {}) {
  const allowed = new Set(["client_id", "project_id", "skill", "status", "sla_breached"]);
  if (Object.keys(query).some((key) => !allowed.has(key))) throw ApiError.badRequest("Validation failed", ["Unsupported staffing-pipeline filter."]);
  const status = query.status === undefined || query.status === "" ? null : String(query.status).toUpperCase();
  if (status && !["SUBMITTED", "SHORTLISTED", "ACCEPTED", "REJECTED", "WITHDRAWN"].includes(status)) throw ApiError.badRequest("Validation failed", ["status is invalid."]);
  const skill = query.skill === undefined || query.skill === "" ? null : String(query.skill).trim().toUpperCase();
  const rawBreached = query.sla_breached;
  if (rawBreached !== undefined && rawBreached !== "true" && rawBreached !== "false") throw ApiError.badRequest("Validation failed", ["sla_breached must be true or false."]);
  return { clientId: positiveInt(query.client_id, "client_id"), projectId: positiveInt(query.project_id, "project_id"), skill, status, slaBreached: rawBreached === undefined ? null : rawBreached === "true" };
}

/** Exported pure policy calculation keeps exact timezone boundary tests deterministic. */
function deriveCandidateSla(submittedAt, slaHours, now = new Date()) {
  if (!submittedAt) return { due_at: null, sla_breached: false };
  const due = new Date(new Date(submittedAt).getTime() + Number(slaHours) * 60 * 60 * 1000);
  return { due_at: due.toISOString(), sla_breached: now.getTime() >= due.getTime() };
}

function shape(rows, filters, now) {
  const items = rows.map((row) => {
    const openCount = Number(row.submitted_count) + Number(row.shortlisted_count);
    const sla = deriveCandidateSla(row.oldest_open_submitted_at, row.candidate_response_sla_hours, now);
    return {
      project_id: row.project_id, project_name: row.project_name, company_id: row.company_id, company_name: row.company_name,
      requirement_id: row.requirement_id, skill: row.skill, required_count: Number(row.required_count),
      assigned_count: Number(row.assigned_count), open_positions: Math.max(0, Number(row.required_count) - Number(row.assigned_count)),
      submitted_count: Number(row.submitted_count), shortlisted_count: Number(row.shortlisted_count),
      accepted_count: Number(row.accepted_count), rejected_count: Number(row.rejected_count), withdrawn_count: Number(row.withdrawn_count),
      open_candidate_count: openCount, oldest_open_submitted_at: row.oldest_open_submitted_at || null,
      candidate_response_sla_hours: Number(row.candidate_response_sla_hours), ...sla,
    };
  }).filter((item) => !filters.status || item[`${filters.status.toLowerCase()}_count`] > 0)
    .filter((item) => filters.slaBreached === null || item.sla_breached === filters.slaBreached);
  return {
    items,
    summary: {
      open_positions: items.reduce((sum, item) => sum + item.open_positions, 0),
      open_candidates: items.reduce((sum, item) => sum + item.open_candidate_count, 0),
      sla_breached_requirements: items.filter((item) => item.sla_breached).length,
    },
  };
}

async function listForPm(pmId, query, now = new Date()) { const filters = filtersFrom(query); return shape(await pipeline.listRequirementPipeline(filters, { type: "pm", id: pmId }), filters, now); }
async function listForVendor(vendorId, query, now = new Date()) { const filters = filtersFrom(query); return shape(await pipeline.listRequirementPipeline(filters, { type: "vendor", id: vendorId }), filters, now); }

module.exports = { listForPm, listForVendor, filtersFrom, deriveCandidateSla };
