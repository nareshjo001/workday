const { pool } = require("../config/db");
const contractorRepository = require("../repositories/contractorRepository");
const projectRepository = require("../repositories/projectRepository");
const assignmentRepository = require("../repositories/assignmentRepository");
const timesheetRepository = require("../repositories/timesheetRepository");
const ApiError = require("../utils/ApiError");
const auditService = require("./auditService");
const notifications = require("./notificationService");
const { submissionLifecycleKey } = require("../utils/notificationLifecycle");

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

// Enforce the project's date window and reject future work dates on the server.
function assertWorkDateWithinProject(workDate, project) {
  const today = todayDateString();
  if (workDate > today) {
    throw ApiError.badRequest("workDate cannot be in the future.");
  }
  if (workDate < project.start_date) {
    throw ApiError.badRequest("workDate cannot be before the project's start date.");
  }
  if (project.end_date && workDate > project.end_date) {
    throw ApiError.badRequest("workDate cannot be after the project's end date.");
  }
  if (!project.allow_weekend && [0, 6].includes(new Date(`${workDate}T00:00:00Z`).getUTCDay())) {
    throw ApiError.badRequest("Weekend timesheets are not allowed for this project.");
  }
  if (project.backdate_limit_days !== null && project.backdate_limit_days !== undefined) {
    const oldest = new Date(); oldest.setUTCDate(oldest.getUTCDate() - Number(project.backdate_limit_days));
    if (workDate < oldest.toISOString().slice(0,10)) throw ApiError.badRequest("workDate exceeds this project's backdate limit.");
  }
}

// Reserve draft, submitted, and approved hours against allocation; legacy projects without targets bypass the check.
function assertWithinRemainingAllocation(project, assignment, reservedHours, hoursLogged) {
  if (project.expected_hours === null) return;
  if (assignment.allocated_hours === null) {
    throw ApiError.conflict(
      "Your work-hour allocation for this project has not been set yet. Contact your Project Manager."
    );
  }
  const remaining = Number(assignment.allocated_hours) - reservedHours;
  if (hoursLogged > remaining) {
    throw ApiError.conflict(
      `You have only ${Math.max(0, remaining)} hour(s) remaining for this project.`
    );
  }
}
async function assertTimePolicy(conn, project, contractorId, workDate, hoursLogged, excludeId) {
  if (project.max_hours_per_day !== null && project.max_hours_per_day !== undefined) { const reserved=await timesheetRepository.sumReservedHoursForContractorProjectDate(conn,contractorId,project.id,workDate,excludeId); if(reserved+hoursLogged>Number(project.max_hours_per_day))throw ApiError.conflict("This entry exceeds the project's daily hour limit."); }
  if (project.max_hours_per_week !== null && project.max_hours_per_week !== undefined) { const reserved=await timesheetRepository.sumReservedHoursForContractorProjectWeek(conn,contractorId,project.id,workDate,excludeId); if(reserved+hoursLogged>Number(project.max_hours_per_week))throw ApiError.conflict("This entry exceeds the project's weekly hour limit."); }
}

// Create the authenticated contractor's daily log under the active-assignment lock and capacity checks.
async function submitTimesheet(userId, { projectId, workDate, hoursLogged, description }, auditActor) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    throw ApiError.notFound("Contractor record not found for this account.");
  }
  if (contractor.status !== "ACTIVE") {
    throw ApiError.forbidden("Inactive contractors cannot submit timesheets.");
  }

  const conn = await pool.getConnection();
  let timesheetId;
  try {
    await conn.beginTransaction();

    const assignment = await assignmentRepository.lockActiveForContractorProject(
      conn,
      contractor.id,
      projectId
    );
    if (!assignment) {
      throw ApiError.notFound("You are not assigned to this project.");
    }

    const project = await projectRepository.findById(projectId);
    if (!project || project.status !== "ACTIVE") {
      throw ApiError.conflict("Timesheets can only be logged against active projects.");
    }

    assertWorkDateWithinProject(workDate, project);
    await assertTimePolicy(conn, project, contractor.id, workDate, hoursLogged);

    const reservedHours = await timesheetRepository.sumReservedHoursForContractorProject(
      conn,
      contractor.id,
      projectId
    );
    assertWithinRemainingAllocation(project, assignment, reservedHours, hoursLogged);

    try {
      timesheetId = await timesheetRepository.create(conn, {
        contractorId: contractor.id,
        projectId,
        workDate,
        hoursLogged, description,
      });
    } catch (err) {
      // The unique contractor/project/date constraint rejects concurrent duplicate submissions.
      if (err?.code === "ER_DUP_ENTRY") {
        throw ApiError.conflict("A timesheet for this project and date has already been submitted.");
      }
      throw err;
    }

    if (auditActor) {
      await auditService.write(conn, auditActor, "TIMESHEET_DRAFT_SAVED", "timesheet", timesheetId, null, {
        project_id: projectId, work_date: workDate, hours_logged: hoursLogged, description, status: "DRAFT",
      });
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  return timesheetRepository.findById(timesheetId);
}

// Return daily history scoped to the authenticated contractor.
async function listMyTimesheets(userId) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    return [];
  }
  return timesheetRepository.listByContractor(contractor.id);
}
async function listMyTimesheetsPage(userId, query) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    return {
      items: [],
      page: query.page,
      page_size: query.pageSize,
      total_weeks: 0,
      total_pages: 0,
    };
  }
  const { rows, total } = await timesheetRepository.listPageByContractor(contractor.id, query);
  return {
    items: rows,
    page: query.page,
    page_size: query.pageSize,
    total_weeks: total,
    total_pages: Math.ceil(total / query.pageSize),
  };
}

async function submitTimesheets(userId, timesheetIds, auditActor) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) throw ApiError.notFound("Contractor record not found for this account.");
  if (contractor.status !== "ACTIVE") throw ApiError.forbidden("Inactive contractors cannot submit timesheets.");
  const ids = [...new Set(timesheetIds)].sort((a, b) => a - b);
  const submissionAuditIds = new Map();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const rows = await timesheetRepository.lockOwnedByIds(conn, contractor.id, ids);
    if (rows.length !== ids.length || rows.some((row) => !["DRAFT", "REJECTED"].includes(row.status))) {
      throw ApiError.conflict("Only your draft or rejected timesheets can be submitted.");
    }
    // Lock assignments in project-ID order and reject draft submission after release or project closure.
    for (const projectId of [...new Set(rows.map((row) => row.project_id))].sort((a, b) => a - b)) {
      const assignment = await assignmentRepository.lockActiveForContractorProject(conn, contractor.id, projectId);
      if (!assignment) throw ApiError.conflict("You are no longer assigned to this project and cannot submit this timesheet.");
      const project = await projectRepository.findById(projectId);
      if (!project || project.status !== "ACTIVE") throw ApiError.conflict("Timesheets can only be submitted for active projects.");
    }
    const updated = await timesheetRepository.markSubmitted(conn, ids);
    if (updated !== ids.length) throw ApiError.conflict("One or more timesheets changed before submission.");
    if (auditActor) for (const row of rows) {
      const auditResult = await auditService.write(conn, auditActor, "TIMESHEET_SUBMITTED", "timesheet", row.id, { status: row.status }, { status: "SUBMITTED" });
      submissionAuditIds.set(row.id, auditResult.id);
    }
    await conn.commit();
  } catch (err) { await conn.rollback().catch(() => {}); throw err; } finally { conn.release(); }
  const result = await Promise.all(ids.map((id) => timesheetRepository.findById(id)));
  for (const row of result) { const recipientId = await notifications.pmForProject(row.project_id); if (recipientId) await notifications.notify({ recipientId, eventType: "TIMESHEET_SUBMITTED", entityType: "timesheet", entityId: row.id, lifecycleKey: submissionLifecycleKey({ auditId: submissionAuditIds.get(row.id), submittedAt: row.submitted_at }), message: "A timesheet is ready for review.", deepLink: "/pm/timesheets" }); }
  return result;
}

// Lock and revalidate owner edits to DRAFT or REJECTED logs; rejected corrections return to DRAFT.
async function updateTimesheet(userId, timesheetId, { workDate, hoursLogged, description }, auditActor) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    throw ApiError.notFound("Contractor record not found for this account.");
  }
  if (contractor.status !== "ACTIVE") {
    throw ApiError.forbidden("Inactive contractors cannot edit timesheets.");
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const existing = await timesheetRepository.lockForOwnerEdit(conn, timesheetId);
    if (!existing || existing.contractor_id !== contractor.id) {
      // Use the same 404 for missing and foreign timesheets to prevent existence leaks.
      throw ApiError.notFound("Timesheet not found.");
    }
    if (existing.status !== "DRAFT" && existing.status !== "REJECTED") {
      throw ApiError.conflict("Only draft and rejected timesheets can be edited.");
    }

    const assignment = await assignmentRepository.lockActiveForContractorProject(
      conn,
      contractor.id,
      existing.project_id
    );
    if (!assignment) {
      // Released contractors cannot edit historical logs.
      throw ApiError.conflict("You are no longer assigned to this project and cannot edit this timesheet.");
    }

    const project = await projectRepository.findById(existing.project_id);
    if (!project || project.status !== "ACTIVE") {
      throw ApiError.conflict("Timesheets can only be edited for active projects.");
    }
    assertWorkDateWithinProject(workDate, project);
    await assertTimePolicy(conn, project, contractor.id, workDate, hoursLogged, timesheetId);

    const reservedHours = await timesheetRepository.sumReservedHoursForContractorProject(
      conn,
      contractor.id,
      existing.project_id,
      timesheetId
    );
    assertWithinRemainingAllocation(project, assignment, reservedHours, hoursLogged);

    let updated;
    try {
      if (existing.status === "DRAFT") {
        updated = await timesheetRepository.updateDraftLog(conn, timesheetId, { workDate, hoursLogged, description });
      } else {
        updated = await timesheetRepository.updateRejectedLog(conn, timesheetId, { workDate, hoursLogged, description });
      }
    } catch (err) {
      if (err?.code === "ER_DUP_ENTRY") {
        throw ApiError.conflict("A timesheet for this project and date already exists.");
      }
      throw err;
    }
    if (!updated) {
      throw ApiError.conflict("Only draft and rejected timesheets can be edited.");
    }

    if (auditActor) {
      if (existing.status === "REJECTED") {
        await auditService.write(conn, auditActor, "TIMESHEET_RESUBMITTED", "timesheet", timesheetId, {
          work_date: existing.work_date, hours_logged: Number(existing.hours_logged), description: existing.description || null,
          rejection_reason: existing.rejection_reason || null, status: existing.status,
        }, {
          work_date: workDate, hours_logged: hoursLogged, description, status: "DRAFT",
        });
      } else {
        await auditService.write(conn, auditActor, "TIMESHEET_DRAFT_SAVED", "timesheet", timesheetId, {
          work_date: existing.work_date, hours_logged: Number(existing.hours_logged), description: existing.description || null,
          status: "DRAFT",
        }, {
          work_date: workDate, hours_logged: hoursLogged, description, status: "DRAFT",
        });
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  return timesheetRepository.findById(timesheetId);
}

module.exports = { submitTimesheet, submitTimesheets, listMyTimesheets, listMyTimesheetsPage, updateTimesheet };
