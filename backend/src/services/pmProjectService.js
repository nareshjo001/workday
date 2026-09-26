const { pool } = require("../config/db");
const projectRepository = require("../repositories/projectRepository");
const assignmentRepository = require("../repositories/assignmentRepository");
const timesheetRepository = require("../repositories/timesheetRepository");
const invoiceRepository = require("../repositories/invoiceRepository");
const ApiError = require("../utils/ApiError");
const auditService = require("./auditService");
const notifications = require("./notificationService");
const { pageResult } = require("../utils/listQuery");

// Derive skill headcount coverage independently of allocated-hour staffing status.
function deriveStaffingStatus(requirements) {
  if (requirements.length === 0) return "PENDING";
  const fullyStaffed = requirements.every((r) => r.assigned_count >= r.required_count);
  return fullyStaffed ? "FULLY_STAFFED" : "PENDING";
}

// Return no hours-staffing status for legacy projects without an expected-hours target.
function deriveHoursStaffingStatus(expectedHours, allocatedHours) {
  if (expectedHours === null) return null;
  return allocatedHours >= expectedHours ? "FULLY_STAFFED" : "PENDING_STAFFING";
}

function toRequirementView(row) {
  return {
    id: row.id,
    skill: row.skill,
    required_count: row.required_count,
    assigned_count: row.assigned_count,
    description: row.description || null,
    status: row.status || "OPEN",
  };
}

// Attach server-computed allocation and approved-hour metrics to the project view.
function toProjectView(row, requirements, hoursMetrics) {
  const totalRequired = requirements.reduce((sum, r) => sum + r.required_count, 0);
  const totalAssigned = requirements.reduce((sum, r) => sum + r.assigned_count, 0);

  const expectedHours = row.expected_hours === null || row.expected_hours === undefined ? null : Number(row.expected_hours);
  const allocatedHours = Number(hoursMetrics?.allocatedHours ?? 0);
  const approvedHours = Number(hoursMetrics?.approvedHours ?? 0);
  const remainingAllocationHours = expectedHours === null ? null : Math.max(0, expectedHours - allocatedHours);
  // Cap displayed progress at 100% without changing the raw approved-hour total.
  const workProgressPercent =
    expectedHours === null || expectedHours === 0 ? null : Math.min(100, Math.round((approvedHours / expectedHours) * 1000) / 10);

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
    expected_hours: expectedHours,
    budget: row.budget === null || row.budget === undefined ? null : Number(row.budget),
    currency: row.currency || null,
    max_hours_per_day: row.max_hours_per_day === null || row.max_hours_per_day === undefined ? null : Number(row.max_hours_per_day),
    max_hours_per_week: row.max_hours_per_week === null || row.max_hours_per_week === undefined ? null : Number(row.max_hours_per_week),
    allow_weekend: Boolean(row.allow_weekend),
    backdate_limit_days: row.backdate_limit_days === null || row.backdate_limit_days === undefined ? null : Number(row.backdate_limit_days),
    allocated_hours: allocatedHours,
    remaining_allocation_hours: remainingAllocationHours,
    hours_staffing_status: deriveHoursStaffingStatus(expectedHours, allocatedHours),
    approved_hours: approvedHours,
    work_progress_percent: workProgressPercent,
  };
}

// Create the authenticated PM's project and staffing requirements in one transaction.
async function createProject(pmId, { name, description, startDate, endDate, expectedHours, requirements }, auditActor) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const projectId = await projectRepository.create(conn, {
      name,
      description,
      pmId,
      startDate,
      endDate,
      expectedHours,
    });

    await projectRepository.createRequirements(conn, projectId, requirements);
    if (auditActor) {
      await auditService.write(conn, auditActor, "PROJECT_CREATED", "project", projectId, null, {
        name, expected_hours: expectedHours, requirement_count: requirements.length, status: "ACTIVE",
      });
    }

    await conn.commit();

    // Re-fetch authoritative company names and generated requirement IDs for the response.
    const [row, requirementRows] = await Promise.all([
      projectRepository.findById(projectId),
      projectRepository.listRequirementsWithCounts([projectId]),
    ]);
    // New projects have no allocations or approved hours to query.
    return toProjectView(row, requirementRows, { allocatedHours: 0, approvedHours: 0 });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Return ownership-scoped projects with server-computed staffing and progress metrics.
async function listProjects(pmId) {
  const projects = await projectRepository.listByPm(pmId);
  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);
  const [requirementRows, allocatedRows, approvedRows] = await Promise.all([
    projectRepository.listRequirementsWithCounts(projectIds),
    assignmentRepository.sumAllocatedHoursForProjects(projectIds),
    timesheetRepository.sumApprovedHoursForProjects(projectIds),
  ]);

  const requirementsByProject = new Map();
  for (const row of requirementRows) {
    if (!requirementsByProject.has(row.project_id)) requirementsByProject.set(row.project_id, []);
    requirementsByProject.get(row.project_id).push(row);
  }
  const allocatedByProject = new Map(allocatedRows.map((r) => [r.project_id, r.allocated_hours]));
  const approvedByProject = new Map(approvedRows.map((r) => [r.project_id, r.approved_hours]));

  return projects.map((p) =>
    toProjectView(p, requirementsByProject.get(p.id) || [], {
      allocatedHours: allocatedByProject.get(p.id) || 0,
      approvedHours: approvedByProject.get(p.id) || 0,
    })
  );
}

async function listProjectsPage(pmId, query) {
  const { rows, total } = await projectRepository.listPageByPm(pmId, query);
  if (!rows.length) return pageResult([], total, query);
  const ids = rows.map((row) => row.id);
  const [requirements, allocated, approved] = await Promise.all([projectRepository.listRequirementsWithCounts(ids), assignmentRepository.sumAllocatedHoursForProjects(ids), timesheetRepository.sumApprovedHoursForProjects(ids)]);
  const byProject = new Map(); for (const row of requirements) { if (!byProject.has(row.project_id)) byProject.set(row.project_id, []); byProject.get(row.project_id).push(row); }
  const allocation = new Map(allocated.map((row) => [row.project_id, row.allocated_hours])); const approvals = new Map(approved.map((row) => [row.project_id, row.approved_hours]));
  return pageResult(rows.map((row) => toProjectView(row, byProject.get(row.id) || [], { allocatedHours: allocation.get(row.id) || 0, approvedHours: approvals.get(row.id) || 0 })), total, query);
}

// Verify PM ownership before returning the project roster and contractor hours.
async function listAssignedContractors(pmId, projectId) {
  const project = await projectRepository.findById(projectId);
  if (!project || project.pm_id !== pmId) {
    // Use the same 404 for missing and foreign projects.
    throw ApiError.notFound("Project not found.");
  }

  const rows = await assignmentRepository.listAssignedContractorsWithHours(projectId);
  return rows.map((r) => ({
    contractor_id: r.contractor_id,
    name: r.contractor_name,
    skill: r.contractor_skill,
    status: r.contractor_status,
    allocated_hours: r.allocated_hours,
    assignment_status: r.assignment_status,
    start_date: r.start_date,
    end_date: r.end_date,
    actual_end_date: r.actual_end_date,
    release_reason: r.release_reason,
    released_at: r.released_at,
    approved_hours: r.approved_hours,
    pending_hours: r.pending_hours,
    remaining_hours: r.remaining_hours,
    bill_rate: r.bill_rate_snapshot,
    currency: r.currency,
  }));
}

// Complete the owned project and release assignments atomically while preserving historical records.
async function completeProject(pmId, projectId, auditActor) {
  const conn = await pool.getConnection();
  let releasedCount;
  try {
    await conn.beginTransaction();

    const project = await projectRepository.lockByIdForUpdate(conn, projectId);
    if (!project || project.pm_id !== pmId) {
      throw ApiError.notFound("Project not found.");
    }
    if (!["ACTIVE", "ON_HOLD"].includes(project.status)) {
      throw ApiError.conflict("Only active or on-hold projects can be completed.");
    }
    const readiness = await closeReadiness(conn, projectId);
    if (!readiness.can_complete) throw new ApiError(409, "Resolve project close blockers before completing this project.", readiness, 'PROJECT_CLOSE_BLOCKED');

    const updated = await projectRepository.markCompleted(conn, projectId);
    if (!updated) {
      // Reject a completion that loses the conditional status transition.
      throw ApiError.conflict("This project is already completed.");
    }

    const [activeAssignments] = await conn.query(
      "SELECT id, contractor_id FROM project_assignments WHERE project_id=? AND status='ACTIVE' FOR UPDATE",
      [projectId]
    );
    releasedCount = await assignmentRepository.releaseAllActiveForProject(conn, projectId, pmId);
    if (auditActor) {
      for (const assignment of activeAssignments) {
        await auditService.write(conn, auditActor, "ASSIGNMENT_RELEASED", "project_assignment", assignment.id,
          { status: "ACTIVE" },
          { status: "RELEASED", project_id: projectId, contractor_id: assignment.contractor_id, release_source: "PROJECT_COMPLETION" });
      }
    }
    if (auditActor) await auditService.write(conn,auditActor,"PROJECT_COMPLETED","project",projectId,{status:project.status},{status:"COMPLETED",released_assignment_count:releasedCount});

    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  const [row, requirementRows, allocatedHours, approvedHours] = await Promise.all([
    projectRepository.findById(projectId),
    projectRepository.listRequirementsWithCounts([projectId]),
    assignmentRepository.sumAllocatedHoursForProject(pool, projectId),
    timesheetRepository.sumApprovedHoursForProject(projectId),
  ]);

  return {
    project: toProjectView(row, requirementRows, { allocatedHours, approvedHours }),
    released_assignment_count: releasedCount,
  };
}

async function updateProject(pmId, projectId, fields, auditActor) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const project = await projectRepository.lockByIdForUpdate(conn, projectId);
    if (!project || project.pm_id !== pmId) throw ApiError.notFound("Project not found.");
    const [allocated, approved, assignmentBounds, workBounds] = await Promise.all([
      assignmentRepository.sumAllocatedHoursForProject(conn, projectId),
      timesheetRepository.sumApprovedHoursForProjectForUpdate(conn, projectId),
      assignmentRepository.assignmentDateBoundsForProject(conn, projectId),
      timesheetRepository.workDateBoundsForProject(conn, projectId),
    ]);
    if (fields.expectedHours !== undefined && fields.expectedHours < Math.max(allocated, approved)) {
      throw ApiError.conflict("Expected hours cannot be below allocated or approved hours.");
    }
    const startDate = fields.startDate ?? project.start_date;
    const endDate = fields.endDate === undefined ? project.end_date : fields.endDate;
    if (endDate && endDate < startDate) throw ApiError.badRequest("Validation failed", ["end_date cannot be before start_date."]);
    const existingDates = [assignmentBounds.first_assigned_date, assignmentBounds.last_assigned_date, workBounds.first_work_date, workBounds.last_work_date].filter(Boolean).sort();
    if (existingDates[0] && startDate > existingDates[0]) throw ApiError.conflict("Start date cannot exclude existing assignments or timesheets.");
    if (endDate && existingDates.at(-1) && endDate < existingDates.at(-1)) throw ApiError.conflict("End date cannot exclude existing assignments or timesheets.");
    if (fields.status === "COMPLETED") throw ApiError.conflict("Use the completion action to complete this project and release active contractors.");
    if (fields.status && fields.status !== project.status && !(
      (project.status === "ACTIVE" && ["ON_HOLD", "CANCELLED"].includes(fields.status)) ||
      (project.status === "ON_HOLD" && ["ACTIVE", "CANCELLED"].includes(fields.status))
    )) throw ApiError.conflict("Invalid project status transition.");
    await projectRepository.updateLifecycle(conn, projectId, fields);
    if (auditActor) await auditService.write(conn, auditActor, "PROJECT_UPDATED", "project", projectId, project, { ...fields });
    await conn.commit();
  } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); }
  const [row, requirements, allocatedHours, approvedHours] = await Promise.all([
    projectRepository.findById(projectId), projectRepository.listRequirementsWithCounts([projectId]),
    assignmentRepository.sumAllocatedHoursForProject(pool, projectId), timesheetRepository.sumApprovedHoursForProject(projectId),
  ]);
  return toProjectView(row, requirements, { allocatedHours, approvedHours });
}

async function updateRequirement(pmId,projectId,requirementId,fields,auditActor){const conn=await pool.getConnection();try{await conn.beginTransaction();const project=await projectRepository.lockByIdForUpdate(conn,projectId);if(!project||project.pm_id!==pmId)throw ApiError.notFound("Project not found.");const requirement=await projectRepository.lockRequirement(conn,projectId,requirementId);if(!requirement)throw ApiError.notFound("Requirement not found.");const assigned=await projectRepository.assignmentCountForRequirement(conn,requirementId);if(fields.requiredCount!==undefined&&fields.requiredCount<assigned)throw ApiError.conflict("Required count cannot be below active assignments.");await projectRepository.updateRequirement(conn,requirementId,fields);if(auditActor)await auditService.write(conn,auditActor,"PROJECT_REQUIREMENT_UPDATED","project_requirement",requirementId,{required_count:requirement.required_count,status:requirement.status},{...fields,project_id:projectId});await conn.commit();}catch(e){await conn.rollback().catch(()=>{});throw e;}finally{conn.release();}return projectRepository.findRequirementById(projectId,requirementId);}

// Lock the project and active assignment before enforcing the approved-hours floor and capacity ceiling.
async function updateContractorAllocation(pmId, projectId, contractorId, allocatedHours, auditActor) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const project = await projectRepository.lockByIdForUpdate(conn, projectId);
    if (!project || project.pm_id !== pmId) {
      throw ApiError.notFound("Project not found.");
    }

    const assignment = await assignmentRepository.lockActiveForContractorProject(conn, contractorId, projectId);
    if (!assignment) {
      throw ApiError.badRequest("Validation failed", [
        "This contractor is not actively assigned to this project.",
      ]);
    }

    const approvedHours = await timesheetRepository.sumApprovedHoursForContractorProject(
      conn,
      contractorId,
      projectId
    );
    if (allocatedHours < approvedHours) {
      throw ApiError.conflict(
        `Cannot set allocated hours (${allocatedHours}) below the ${approvedHours} hour(s) already approved for this contractor on this project.`
      );
    }

    if (project.expected_hours !== null) {
      const expectedHours = Number(project.expected_hours);
      const totalAllocated = await assignmentRepository.sumAllocatedHoursForProject(conn, projectId);
      const currentForThisContractor = assignment.allocated_hours === null ? 0 : Number(assignment.allocated_hours);
      const othersTotal = totalAllocated - currentForThisContractor;
      if (othersTotal + allocatedHours > expectedHours) {
        throw ApiError.conflict(
          `Total allocation would exceed the project's expected hours (${expectedHours}). ` +
            `Remaining unallocated capacity: ${Math.max(0, expectedHours - othersTotal)} hour(s).`
        );
      }
    }

    await assignmentRepository.updateAllocatedHours(conn, assignment.id, allocatedHours);
    if (auditActor) await auditService.write(conn,auditActor,"ASSIGNMENT_ALLOCATION_CHANGED","project_assignment",assignment.id,{allocated_hours:assignment.allocated_hours},{allocated_hours:allocatedHours,project_id:projectId,contractor_id:contractorId});

    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  const rows = await assignmentRepository.listAssignedContractorsWithHours(projectId);
  const updated = rows.find((r) => r.contractor_id === contractorId);
  return {
    contractor_id: contractorId,
    name: updated?.contractor_name ?? null,
    allocated_hours: updated?.allocated_hours ?? allocatedHours,
    assignment_status: updated?.assignment_status ?? null,
    approved_hours: updated?.approved_hours ?? 0,
    pending_hours: updated?.pending_hours ?? 0,
    remaining_hours: updated?.remaining_hours ?? null,
  };
}

async function releaseContractor(pmId, projectId, contractorId, { actualEndDate, reason }, auditActor) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const project = await projectRepository.lockByIdForUpdate(conn, projectId);
    if (!project || project.pm_id !== pmId) throw ApiError.notFound("Project not found.");
    const assignment = await assignmentRepository.lockActiveForContractorProject(conn, contractorId, projectId);
    if (!assignment) throw ApiError.notFound("Active assignment not found.");
    if (actualEndDate < project.start_date || (project.end_date && actualEndDate > project.end_date)) throw ApiError.badRequest("Validation failed", ["actual_end_date must fall within the project date range."]);
    const readiness = await assignmentReadiness(conn, projectId, contractorId);
    if (readiness.blockers.length) throw new ApiError(409, "Resolve assignment release blockers before releasing this contractor.", readiness, 'ASSIGNMENT_RELEASE_BLOCKED');
    await assignmentRepository.releaseActiveAssignment(conn, assignment.id, actualEndDate, reason, pmId);
    if (auditActor) await auditService.write(conn, auditActor, "ASSIGNMENT_RELEASED", "project_assignment", assignment.id, { status: "ACTIVE" }, { status: "RELEASED", actual_end_date: actualEndDate, release_reason: reason });
    await conn.commit();
  } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); }
  const recipientId=await notifications.contractorUserId(contractorId); if(recipientId) await notifications.notify({recipientId,eventType:"ASSIGNMENT_RELEASED",entityType:"project_assignment",entityId:contractorId,message:"Your project assignment was released.",deepLink:"/contractor/projects"});
  return { contractor_id: contractorId, project_id: projectId, assignment_status: "RELEASED", actual_end_date: actualEndDate, release_reason: reason };
}

async function assignmentReadiness(conn, projectId, contractorId) {
  const [[row]] = await conn.query(`SELECT SUM(status='SUBMITTED') submitted_timesheets,SUM(status='REJECTED') rejected_timesheets FROM timesheets WHERE project_id=? AND contractor_id=?`, [projectId, contractorId]);
  const blockers = Number(row.submitted_timesheets) ? [{ code: 'SUBMITTED_TIMESHEETS', count: Number(row.submitted_timesheets), message: 'Submitted timesheets require PM review.' }] : [];
  const warnings = Number(row.rejected_timesheets) ? [{ code: 'REJECTED_TIMESHEETS', count: Number(row.rejected_timesheets), message: 'Rejected timesheets remain in history and may require correction.' }] : [];
  return { can_release: !blockers.length, blockers, warnings };
}

async function closeReadiness(conn, projectId) {
  const [[row]] = await conn.query(`SELECT
    (SELECT COUNT(*) FROM project_assignments WHERE project_id=? AND status='ACTIVE') active_assignments,
    (SELECT COUNT(*) FROM timesheets WHERE project_id=? AND status='SUBMITTED') submitted_timesheets,
    (SELECT COUNT(*) FROM timesheets WHERE project_id=? AND status='REJECTED') rejected_timesheets,
    (SELECT COUNT(*) FROM candidate_submissions WHERE project_id=? AND status='SUBMITTED') candidate_reviews,
    (SELECT COUNT(*) FROM milestone_billings b LEFT JOIN invoice_items ii ON ii.milestone_billing_id=b.id JOIN milestones m ON m.id=b.milestone_id WHERE m.project_id=? AND ii.id IS NULL) unbilled_contributions,
    (SELECT COUNT(*) FROM invoices WHERE project_id=? AND status='DRAFT') draft_invoices,
    (SELECT COUNT(*) FROM invoices WHERE project_id=? AND status='SUBMITTED') submitted_invoices,
    (SELECT COUNT(*) FROM invoices i LEFT JOIN (SELECT invoice_id,SUM(amount) paid FROM payments GROUP BY invoice_id) p ON p.invoice_id=i.id WHERE i.project_id=? AND i.status='APPROVED' AND i.total_amount>COALESCE(p.paid,0)) outstanding_invoices,
    (SELECT COUNT(*) FROM invoices i LEFT JOIN (SELECT invoice_id,SUM(amount) paid FROM payments GROUP BY invoice_id) p ON p.invoice_id=i.id WHERE i.project_id=? AND i.status='APPROVED' AND i.due_date<CURDATE() AND i.total_amount>COALESCE(p.paid,0)) overdue_invoices`, [projectId,projectId,projectId,projectId,projectId,projectId,projectId,projectId,projectId]);
  const blockers=[]; const warnings=[]; const add=(target,code,key,message)=>{if(Number(row[key]))target.push({code,count:Number(row[key]),message});};
  add(blockers,'SUBMITTED_TIMESHEETS','submitted_timesheets','Submitted timesheets require PM review.'); add(blockers,'SUBMITTED_INVOICES','submitted_invoices','Submitted invoices require PM review.'); add(blockers,'OPEN_CANDIDATE_REVIEWS','candidate_reviews','Candidate decisions are still pending.');
  add(warnings,'ACTIVE_ASSIGNMENTS','active_assignments','Active assignments will be released as part of completion.'); add(warnings,'REJECTED_TIMESHEETS','rejected_timesheets','Rejected timesheets are preserved for correction history.'); add(warnings,'UNBILLED_CONTRIBUTIONS','unbilled_contributions','Eligible milestone contributions remain uninvoiced.'); add(warnings,'DRAFT_INVOICES','draft_invoices','Draft invoices remain editable after operational close.'); add(warnings,'OUTSTANDING_INVOICES','outstanding_invoices','Approved invoices remain outstanding.'); add(warnings,'OVERDUE_INVOICES','overdue_invoices','Approved invoices are overdue.');
  return { can_complete: !blockers.length, blockers, warnings };
}

async function getCloseReadiness(pmId, projectId) { const conn=await pool.getConnection(); try { const project=await projectRepository.lockByIdForUpdate(conn,projectId); if(!project||project.pm_id!==pmId) throw ApiError.notFound('Project not found.'); return closeReadiness(conn,projectId); } finally { conn.release(); } }

module.exports = {
  createProject,
  listProjects,
  listProjectsPage,
  listAssignedContractors,
  completeProject,
  updateProject,
  updateRequirement,
  updateContractorAllocation,
  releaseContractor,
  getCloseReadiness,
  assignmentReadiness,
};
