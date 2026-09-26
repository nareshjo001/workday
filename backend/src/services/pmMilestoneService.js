const projectRepository = require("../repositories/projectRepository");
const milestoneRepository = require("../repositories/milestoneRepository");
const milestoneService = require("./milestoneService");
const ApiError = require("../utils/ApiError");
const { pool } = require("../config/db");
const auditService = require("./auditService");

// Return the same 404 for missing and foreign projects to prevent existence leaks.
async function assertOwnedProject(pmId, projectId) {
  const project = await projectRepository.findById(projectId);
  if (!project || project.pm_id !== pmId) {
    throw ApiError.notFound("Project not found.");
  }
  return project;
}

// Create an owned milestone within project capacity, then evaluate already-approved hours immediately.
async function createMilestone(pmId, { projectId, name, thresholdHours, description, sequenceOrder, dueDate }, auditActor) {
  const conn = await pool.getConnection();
  let milestoneId;
  try {
    await conn.beginTransaction();
    const project = await projectRepository.lockByIdForUpdate(conn, projectId);
    if (!project || project.pm_id !== pmId) throw ApiError.notFound("Project not found.");
    if (project.expected_hours !== null && thresholdHours > Number(project.expected_hours)) {
      throw ApiError.badRequest("Validation failed", [
        `threshold_hours (${thresholdHours}) cannot exceed the project's expected_hours (${Number(project.expected_hours)}).`,
      ]);
    }
    milestoneId = await milestoneRepository.create(conn, { projectId, name, thresholdHours, description, sequenceOrder, dueDate });
    if (auditActor) {
      await auditService.write(conn, auditActor, "MILESTONE_CREATED", "milestone", milestoneId, null, {
        project_id: projectId, name, threshold_hours: thresholdHours, description, sequence_order: sequenceOrder, due_date: dueDate, status: "PENDING",
      });
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  await milestoneService.checkAndTriggerMilestones(projectId, auditActor);

  return findMilestoneView(projectId, milestoneId);
}

async function updateMilestone(pmId,milestoneId,fields,auditActor){const conn=await pool.getConnection();let projectId;try{await conn.beginTransaction();const before=await milestoneRepository.lockByIdForUpdate(conn,milestoneId);if(!before)throw ApiError.notFound('Milestone not found.');const project=await projectRepository.lockByIdForUpdate(conn,before.project_id);if(!project||project.pm_id!==pmId)throw ApiError.notFound('Milestone not found.');if(before.status!=='PENDING')throw ApiError.conflict('Met milestones are financially immutable.');if(project.expected_hours!==null&&fields.thresholdHours>Number(project.expected_hours))throw ApiError.badRequest('Validation failed',['threshold_hours cannot exceed project expected hours.']);await milestoneRepository.updatePending(conn,milestoneId,fields);await auditService.write(conn,auditActor,'MILESTONE_UPDATED','milestone',milestoneId,{name:before.name,description:before.description,sequence_order:before.sequence_order,due_date:before.due_date,threshold_hours:Number(before.threshold_hours)},{name:fields.name,description:fields.description,sequence_order:fields.sequenceOrder,due_date:fields.dueDate,threshold_hours:fields.thresholdHours});projectId=before.project_id;await conn.commit();}catch(e){await conn.rollback().catch(()=>{});throw e;}finally{conn.release();}await milestoneService.checkAndTriggerMilestones(projectId,auditActor);return findMilestoneView(projectId,milestoneId);}

// List milestone contributions only after verifying the PM owns the project.
async function listMilestones(pmId, projectId) {
  await assertOwnedProject(pmId, projectId);
  return milestoneRepository.listByProject(projectId);
}

// Reuse the milestone-list shape for create responses with contribution details.
async function findMilestoneView(projectId, milestoneId) {
  const milestones = await milestoneRepository.listByProject(projectId);
  return milestones.find((m) => m.id === milestoneId) || null;
}

module.exports = { createMilestone, updateMilestone, listMilestones };
