const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const projectRepository = require('../repositories/projectRepository');
const contractorRepository = require('../repositories/contractorRepository');
const assignmentRepository = require('../repositories/assignmentRepository');
const vendorAccessRepository = require('../repositories/vendorAccessRepository');
const auditService = require('./auditService');
const notifications = require('./notificationService');
const { assignmentReadiness } = require('./pmProjectService');

async function assertScope(conn, vendorId, projectId, contractorId) {
  if (!await vendorAccessRepository.hasProjectAccess(projectId, vendorId, conn)) throw ApiError.notFound('Project not found.');
  const contractor = await contractorRepository.findByVendorAndIdForUpdate(conn, vendorId, contractorId);
  if (!contractor) throw ApiError.notFound('Contractor not found.');
  const project = await projectRepository.lockByIdForUpdate(conn, projectId);
  if (!project) throw ApiError.notFound('Project not found.');
  return project;
}

async function readiness(vendorId, projectId, contractorId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await assertScope(conn, vendorId, projectId, contractorId);
    const assignment = await assignmentRepository.lockActiveForContractorProject(conn, contractorId, projectId);
    if (!assignment) throw ApiError.notFound('Active assignment not found.');
    const result = await assignmentReadiness(conn, projectId, contractorId);
    await conn.commit();
    return result;
  } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); }
}

async function release(vendorId, projectId, contractorId, { actualEndDate, reason }, actor) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const project = await assertScope(conn, vendorId, projectId, contractorId);
    const assignment = await assignmentRepository.lockActiveForContractorProject(conn, contractorId, projectId);
    if (!assignment) throw ApiError.notFound('Active assignment not found.');
    if (actualEndDate < project.start_date || (project.end_date && actualEndDate > project.end_date)) {
      throw ApiError.badRequest('Validation failed', ['actual_end_date must fall within the project date range.']);
    }
    const result = await assignmentReadiness(conn, projectId, contractorId);
    if (!result.can_release) throw new ApiError(409, 'Resolve assignment release blockers before releasing this contractor.', result, 'ASSIGNMENT_RELEASE_BLOCKED');
    await assignmentRepository.releaseActiveAssignment(conn, assignment.id, actualEndDate, reason, vendorId);
    await auditService.write(conn, actor, 'ASSIGNMENT_RELEASED', 'project_assignment', assignment.id,
      { status: 'ACTIVE' }, { status: 'RELEASED', project_id: projectId, contractor_id: contractorId, actual_end_date: actualEndDate, release_reason: reason });
    await conn.commit();
  } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); }
  const recipientId = await notifications.contractorUserId(contractorId);
  if (recipientId) await notifications.notify({ recipientId, eventType: 'ASSIGNMENT_RELEASED', entityType: 'project_assignment', entityId: contractorId, message: 'Your project assignment was released.', deepLink: '/contractor/projects' });
  return { contractor_id: contractorId, project_id: projectId, assignment_status: 'RELEASED', actual_end_date: actualEndDate, release_reason: reason };
}

module.exports = { readiness, release };
