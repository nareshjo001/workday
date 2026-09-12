const ApiError = require("../utils/ApiError");
const repository = require("../repositories/auditActivityRepository");

const titles = {
  PROJECT_CREATED: "Project created", PROJECT_UPDATED: "Project updated", PROJECT_COMPLETED: "Project completed",
  PROJECT_REQUIREMENT_UPDATED: "Project requirement updated", CANDIDATE_SUBMITTED: "Candidate submitted",
  CANDIDATE_ACCEPTED: "Candidate accepted", CANDIDATE_REJECTED: "Candidate rejected", CANDIDATE_WITHDRAWN: "Candidate withdrawn",
  ASSIGNMENT_CREATED: "Assignment created", ASSIGNMENT_RELEASED: "Assignment released", ASSIGNMENT_ALLOCATION_CHANGED: "Assignment allocation changed",
  TIMESHEET_DRAFT_SAVED: "Timesheet draft saved", TIMESHEET_SUBMITTED: "Timesheet submitted", TIMESHEET_RESUBMITTED: "Timesheet resubmitted", TIMESHEET_REVIEWED: "Timesheet reviewed",
  CONTRACTOR_CREATED: "Contractor created", CONTRACTOR_UPDATED: "Contractor updated", CONTRACTOR_PROFILE_UPDATED: "Contractor profile updated",
  CONTRACTOR_DOCUMENT_UPLOADED: "Contractor document uploaded", CONTRACTOR_DOCUMENT_REVIEWED: "Contractor document reviewed",
  INVOICE_DRAFT_CREATED: "Invoice draft created", INVOICE_DRAFT_UPDATED: "Invoice draft updated", INVOICE_SUBMITTED: "Invoice submitted", INVOICE_APPROVED: "Invoice approved", INVOICE_REJECTED: "Invoice rejected", INVOICE_REVISED: "Invoice revised", INVOICE_CANCELLED: "Invoice cancelled", PAYMENT_RECORDED: "Payment recorded",
  MILESTONE_CREATED: "Milestone created", MILESTONE_UPDATED: "Milestone updated", MILESTONE_MET: "Milestone met",
};
const safeFields = new Set(["status", "work_date", "hours_logged", "document_type", "expiry_date", "start_date", "end_date", "actual_end_date", "allocated_hours", "released_assignment_count", "invoice_number"]);
const labels = { status: "Status", work_date: "Work date", hours_logged: "Hours", document_type: "Document type", expiry_date: "Expiry date", start_date: "Start date", end_date: "End date", actual_end_date: "Actual end date", allocated_hours: "Allocated hours", released_assignment_count: "Released assignments", invoice_number: "Invoice number" };

function parseJson(value) { try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } }
function safeDetails(before, after) {
  const from = parseJson(before); const to = parseJson(after); const details = [];
  for (const key of safeFields) {
    if (!(key in from) && !(key in to)) continue;
    const previous = from[key]; const value = key in to ? to[key] : previous;
    if (!["string", "number", "boolean"].includes(typeof value) && value !== null) continue;
    details.push({ label: labels[key], value: previous !== undefined && key in to && previous !== value ? `${previous ?? "—"} → ${value ?? "—"}` : value });
  }
  return details;
}
function projectItem(row) {
  const title = titles[row.action] || "Business activity recorded";
  const actor = { display_name: row.actor_name || "System", role: row.actor_role || "SYSTEM" };
  return { id: Number(row.id), occurred_at: row.created_at, event: row.action, actor, entity: { type: row.entity_type.toUpperCase(), id: String(row.entity_id) }, title, summary: `${actor.display_name} recorded ${title.toLowerCase()}.`, details: safeDetails(row.before_json, row.after_json) };
}
function paging(query) {
  const page = Number(query.page || 1); const limit = Number(query.limit || 25);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) throw ApiError.badRequest("Invalid pagination parameters.");
  return { page, limit };
}
function response(result, page, limit) { return { items: result.rows.map(projectItem), pagination: { page, limit, total: result.total, total_pages: Math.max(1, Math.ceil(result.total / limit)) } }; }
async function pmProject(userId, projectId, query) { const project = await repository.ownedProject(userId, projectId); if (!project) throw ApiError.notFound("Project not found."); const p = paging(query); return { project, ...response(await repository.projectActivity(projectId, p), p.page, p.limit) }; }
async function vendor(userId, query) { const p = paging(query); return response(await repository.vendorActivity(userId, p), p.page, p.limit); }
async function contractor(userId, query) { const contractorId = await repository.contractorIdForUser(userId); if (!contractorId) throw ApiError.notFound("Contractor profile not found."); const p = paging(query); return response(await repository.contractorActivity(contractorId, p), p.page, p.limit); }
module.exports = { pmProject, vendor, contractor };
