const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const { createFinding } = require("../utils/intelligenceFinding");
const repository = require("../repositories/pmProjectControlRepository");
const pmProjects = require("./pmProjectService");

const SOURCE = { engine: "pm_project_control", version: "1" };
const order = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3, CRITICAL: -1 };
const finding = (code, severity, title, summary, evidence, recommended_action) => createFinding({ code, severity, title, summary, evidence, recommended_action, source: SOURCE });

async function analyze(pmId, projectId) {
  if (!env.intelligence.pmProjectControl) throw ApiError.notFound("PM Project Control Intelligence is not available.");
  const project = await repository.projectForPm(projectId, pmId);
  if (!project) throw ApiError.notFound("Project not found.");
  const [data, readiness] = await Promise.all([repository.metrics(projectId), pmProjects.getCloseReadiness(pmId, projectId)]);
  const findings = [];
  const byStatus = Object.fromEntries(data.timesheets.map((row) => [row.status, row]));
  const submitted = byStatus.SUBMITTED;
  if (submitted?.count) findings.push(finding("TIMESHEETS_AWAITING_REVIEW", "INFO", "Timesheets are waiting for review", `${submitted.count} submitted timesheet${submitted.count === 1 ? " is" : "s are"} awaiting PM review.`, [{ key: "submitted_count", label: "Submitted timesheets", value: Number(submitted.count) }, { key: "submitted_hours", label: "Submitted hours", value: Number(submitted.hours), unit: "hours" }], "Review the submitted timesheets."));
  const rejected = byStatus.REJECTED;
  if (rejected?.count) findings.push(finding("REJECTED_TIMESHEETS_EXIST", "INFO", "Rejected timesheets exist", `${rejected.count} rejected timesheet${rejected.count === 1 ? " exists" : "s exist"} for this project.`, [{ key: "rejected_count", label: "Rejected timesheets", value: Number(rejected.count) }, { key: "rejected_hours", label: "Rejected hours", value: Number(rejected.hours), unit: "hours" }], "Review rejected timesheets and contractor correction status."));
  if (Number(data.requirements.open_requirements)) findings.push(finding("OPEN_REQUIREMENTS_REMAIN", "INFO", "Project requirements remain open", `${data.requirements.open_requirements} requirement${Number(data.requirements.open_requirements) === 1 ? " has" : "s have"} unfilled slots.`, [{ key: "open_requirement_count", label: "Open requirements", value: Number(data.requirements.open_requirements) }, { key: "remaining_slots", label: "Remaining slots", value: Number(data.requirements.remaining_slots) }], "Review staffing requirements and candidate submissions."));
  if (Number(data.candidates.count)) findings.push(finding("CANDIDATE_REVIEWS_PENDING", "INFO", "Candidate reviews are pending", `${data.candidates.count} candidate submission${Number(data.candidates.count) === 1 ? " is" : "s are"} awaiting a PM decision.`, [{ key: "pending_candidate_count", label: "Pending candidates", value: Number(data.candidates.count) }], "Review pending candidate submissions."));
  for (const assignment of data.assignments) findings.push(finding(assignment.days_remaining < 0 ? "ACTIVE_ASSIGNMENT_PAST_END_DATE" : "ASSIGNMENT_ENDING_SOON", assignment.days_remaining < 0 ? "HIGH" : "MEDIUM", assignment.days_remaining < 0 ? "Active assignment is past its end date" : "Assignment is ending soon", `${assignment.contractor_name}'s active assignment ${assignment.days_remaining < 0 ? "is past" : "ends within"} the project-control review window.`, [{ key: "end_date", label: "Assignment end date", value: String(assignment.end_date).slice(0, 10) }, { key: "days_remaining", label: "Days remaining", value: Number(assignment.days_remaining), unit: "days" }], "Review the assignment end date."));
  if (Number(data.documents.count)) findings.push(finding("CONTRACTOR_DOCUMENT_EXPIRING", "MEDIUM", "Assigned contractor documents are expiring", `${data.documents.count} verified document${Number(data.documents.count) === 1 ? " expires" : "s expire"} within 30 days.`, [{ key: "expiring_document_count", label: "Expiring documents", value: Number(data.documents.count) }, { key: "nearest_expiry", label: "Nearest expiry", value: String(data.documents.nearest_expiry).slice(0, 10) }], "Review expiring contractor documentation."));
  for (const invoice of data.invoices) findings.push(finding("INVOICES_AWAITING_REVIEW", "INFO", "Invoices are waiting for review", `${invoice.count} submitted invoice${Number(invoice.count) === 1 ? " is" : "s are"} awaiting PM review.`, [{ key: "submitted_invoice_count", label: "Submitted invoices", value: Number(invoice.count) }, { key: "submitted_invoice_total", label: "Submitted invoice total", value: Number(invoice.total), unit: invoice.currency || "" }], "Review submitted invoices."));
  if (!readiness.can_complete && readiness.blockers?.length) findings.push(finding("PROJECT_NOT_READY_TO_CLOSE", "HIGH", "Project is not ready to close", "Existing project-close rules report blockers that must be resolved before completion.", [{ key: "blocker_count", label: "Close blockers", value: readiness.blockers.length }, { key: "blocker_codes", label: "Close blocker codes", value: readiness.blockers.map((item) => item.code).join(", ") }], "Resolve the listed project-close blockers before completing the project."));
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.code.localeCompare(b.code));
  const by_severity = Object.fromEntries(["HIGH", "MEDIUM", "LOW", "INFO"].map((severity) => [severity, findings.filter((item) => item.severity === severity).length]));
  return { contract_version: "1", project: { id: project.id, name: project.name, status: project.status }, summary: { attention_count: findings.length, by_severity }, findings };
}
module.exports = { analyze };
