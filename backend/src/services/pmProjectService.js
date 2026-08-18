const { pool } = require("../config/db");
const projectRepository = require("../repositories/projectRepository");

/**
 * Derives overall staffing status from a project's requirement rows —
 * this is intentionally NOT stored anywhere (see migration 007's
 * comment): PENDING unless every requirement's assigned_count has met
 * its required_count, in which case FULLY_STAFFED. A project with zero
 * requirements can't happen for new projects (validator requires at
 * least one), but is treated as PENDING defensively rather than crashing
 * on legacy/edge-case data.
 */
function deriveStaffingStatus(requirements) {
  if (requirements.length === 0) return "PENDING";
  const fullyStaffed = requirements.every((r) => r.assigned_count >= r.required_count);
  return fullyStaffed ? "FULLY_STAFFED" : "PENDING";
}

function toRequirementView(row) {
  return {
    id: row.id,
    skill: row.skill,
    required_count: row.required_count,
    assigned_count: row.assigned_count,
  };
}

function toProjectView(row, requirements) {
  const totalRequired = requirements.reduce((sum, r) => sum + r.required_count, 0);
  const totalAssigned = requirements.reduce((sum, r) => sum + r.assigned_count, 0);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    company_name: row.company_name,
    pm_name: row.pm_name,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status,
    requirements: requirements.map(toRequirementView),
    total_required: totalRequired,
    total_assigned: totalAssigned,
    staffing_status: deriveStaffingStatus(requirements),
  };
}

/**
 * Creates a project AND its staffing requirements in a single transaction
 * — either both succeed or neither does (Module 3 revision spec section
 * 3). `pmId` is the authenticated PM's users.id, resolved by the
 * controller from the JWT and never taken from the request body.
 */
async function createProject(pmId, { name, description, startDate, endDate, requirements }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const projectId = await projectRepository.create(conn, {
      name,
      description,
      pmId,
      startDate,
      endDate,
    });

    await projectRepository.createRequirements(conn, projectId, requirements);

    await conn.commit();

    // Re-fetch rather than manually constructing the response: company_name
    // and pm_name are no longer values we were handed in the request (see
    // pmProjectValidators — company_name is derived, not input), they only
    // exist via the PM/company JOIN in projectRepository.findById. The
    // requirement rows are also re-fetched (rather than reusing the
    // pre-insert `requirements` array) so the response includes each
    // requirement's real `id` — the frontend needs it to link straight to
    // the assignment endpoints.
    const [row, requirementRows] = await Promise.all([
      projectRepository.findById(projectId),
      projectRepository.listRequirementsWithCounts([projectId]),
    ]);
    return toProjectView(row, requirementRows);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Only ever returns projects owned by `pmId` — scoped in the
 * repository's SQL, not filtered afterward. Each project comes back with
 * its staffing requirements + derived progress/status so the PM never
 * has to calculate that themselves (Module 3 revision spec section 19).
 */
async function listProjects(pmId) {
  const projects = await projectRepository.listByPm(pmId);
  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);
  const requirementRows = await projectRepository.listRequirementsWithCounts(projectIds);

  const requirementsByProject = new Map();
  for (const row of requirementRows) {
    if (!requirementsByProject.has(row.project_id)) requirementsByProject.set(row.project_id, []);
    requirementsByProject.get(row.project_id).push(row);
  }

  return projects.map((p) => toProjectView(p, requirementsByProject.get(p.id) || []));
}

module.exports = { createProject, listProjects };
