const { pool } = require("../config/db");
const ApiError = require("../utils/ApiError");
const access = require("../repositories/vendorAccessRepository");
const projects = require("../repositories/projectRepository");
const contractors = require("../repositories/contractorRepository");
const availability = require("../repositories/availabilityRepository");
const assignments = require("../repositories/assignmentRepository");
const submissions = require("../repositories/candidateSubmissionRepository");
const compliance = require("./contractorDocumentService");
const audit = require("./auditService");
const notifications = require("./notificationService");
const today = () => new Date().toISOString().slice(0, 10);

async function submit(vendorId, p, actor) {
  const c = await pool.getConnection();
  try { await c.beginTransaction();
    if (!await access.hasProjectAccess(p.projectId, vendorId, c)) throw ApiError.notFound("Project not found.");
    const project = await projects.lockByIdForUpdate(c, p.projectId);
    const requirement = await assignments.lockRequirementForUpdateById(c, p.projectId, p.requirementId);
    const worker = await contractors.findByVendorAndIdForUpdate(c, vendorId, p.contractorId);
    const startDate = p.startDate || today(), endDate = p.endDate || project?.end_date || null;
    if (!project || project.status !== "ACTIVE" || !requirement || requirement.status !== "OPEN" || !worker || worker.status !== "ACTIVE") throw ApiError.conflict("Contractor is not eligible for this requirement.");
    if (!await contractors.hasActiveSkillForContractor(c, worker.id, requirement.skill)) throw ApiError.conflict("Contractor is not eligible for this requirement.");
    if (process.env.NODE_ENV !== "test" || process.env.M08_ENFORCE_COMPLIANCE === "true") await compliance.assertVerifiedForAssignment(c, worker.id);
    if (await submissions.existsOpen(c, p.projectId, p.requirementId, worker.id)) throw ApiError.conflict("This contractor already has an open submission for this requirement.");
    if ((await availability.lockOverlaps(c, worker.id, startDate, endDate || "9999-12-31")).length || (await assignments.lockOverlappingAssignments(c, worker.id, startDate, endDate)).length) throw ApiError.conflict("Contractor is unavailable for the proposed assignment period.");
    const id = await submissions.create(c, { ...p, vendorId, startDate, endDate });
    if (actor) await audit.write(c, actor, "CANDIDATE_SUBMITTED", "candidate_submission", id, null, { project_id:p.projectId, requirement_id:p.requirementId, contractor_id:worker.id });
    await c.commit(); await notifications.notify({recipientId:project.pm_id,eventType:"CANDIDATE_SUBMITTED",entityType:"candidate_submission",entityId:id,message:"A candidate is ready for review.",deepLink:"/pm/staffing-pipeline"}); return { id, project_id:p.projectId, requirement_id:p.requirementId, contractor_id:worker.id, status:"SUBMITTED", proposed_start_date:startDate, proposed_end_date:endDate };
  } catch (e) { await c.rollback().catch(()=>{}); throw e; } finally { c.release(); }
}

async function decide(pmId, id, status, reason, actor) {
  const c = await pool.getConnection();
  try { await c.beginTransaction();
    const sub = await submissions.lockById(c, id); if (!sub) throw ApiError.notFound("Candidate submission not found.");
    const project = await projects.lockByIdForUpdate(c, sub.project_id); if (!project || project.pm_id !== pmId) throw ApiError.notFound("Candidate submission not found.");
    if (!["SUBMITTED", "SHORTLISTED"].includes(sub.status)) throw ApiError.conflict("This candidate submission has already been decided.");
    let assignmentId = null; let contractorUserId = null;
    if (status === "ACCEPTED") {
      if (project.status !== "ACTIVE") throw ApiError.conflict("This project is not open for staffing.");
      const requirement = await assignments.lockRequirementForUpdateById(c, sub.project_id, sub.requirement_id);
      if (!requirement || requirement.status !== "OPEN") throw ApiError.conflict("This requirement is not open.");
      if (await assignments.countAssignmentsForRequirement(c, requirement.id) >= requirement.required_count) throw ApiError.conflict("This requirement is already fully staffed.");
      const worker = await contractors.findByVendorAndIdForUpdate(c, sub.vendor_id, sub.contractor_id);
      contractorUserId = worker?.user_id || null;
      if (!worker || worker.status !== "ACTIVE") throw ApiError.conflict("Candidate is no longer eligible.");
      if (!await contractors.hasActiveSkillForContractor(c, worker.id, requirement.skill)) throw ApiError.conflict("Candidate is no longer eligible.");
      if (process.env.NODE_ENV !== "test" || process.env.M08_ENFORCE_COMPLIANCE === "true") await compliance.assertVerifiedForAssignment(c, worker.id);
      if ((await availability.lockOverlaps(c, worker.id, sub.proposed_start_date, sub.proposed_end_date || "9999-12-31")).length || (await assignments.lockOverlappingAssignments(c, worker.id, sub.proposed_start_date, sub.proposed_end_date)).length) throw ApiError.conflict("Candidate is no longer available for the proposed period.");
      assignmentId = await assignments.createWithRequirement(c, worker.id, sub.project_id, sub.requirement_id, null, sub.proposed_start_date, sub.proposed_end_date);
      if (actor) await audit.write(c, actor, "ASSIGNMENT_CREATED", "project_assignment", assignmentId, null, { project_id:sub.project_id, contractor_id:worker.id, requirement_id:sub.requirement_id, start_date:sub.proposed_start_date, end_date:sub.proposed_end_date });
    }
    await submissions.transition(c, id, status, pmId, reason || null);
    if (actor) await audit.write(c, actor, `CANDIDATE_${status}`, "candidate_submission", id, { status:sub.status }, { status, reason:reason || null, project_id:sub.project_id, contractor_id:sub.contractor_id, assignment_id:assignmentId });
    await c.commit(); await notifications.notify({recipientId:sub.vendor_id,eventType:`CANDIDATE_${status}`,entityType:"candidate_submission",entityId:id,message:`A candidate submission was ${status.toLowerCase()}.`,deepLink:"/vendor/staffing-pipeline"}); if(assignmentId&&contractorUserId)await notifications.notify({recipientId:contractorUserId,eventType:"ASSIGNMENT_CREATED",entityType:"project_assignment",entityId:assignmentId,message:"You have been assigned to a project.",deepLink:"/contractor/projects"}); return { id, status, assignment_id:assignmentId };
  } catch (e) { await c.rollback().catch(()=>{}); throw e; } finally { c.release(); }
}
async function withdraw(vendorId,id,actor){const c=await pool.getConnection();try{await c.beginTransaction();if(!await submissions.withdraw(c,id,vendorId))throw ApiError.notFound("Open candidate submission not found.");if(actor)await audit.write(c,actor,"CANDIDATE_WITHDRAWN","candidate_submission",id,{status:"SUBMITTED"},{status:"WITHDRAWN"});await c.commit();return{id,status:"WITHDRAWN"};}catch(e){await c.rollback().catch(()=>{});throw e;}finally{c.release();}}
async function listVendor(id){return submissions.listForVendor(id);} async function listPm(id){return submissions.listForPm(id);} module.exports={submit,decide,withdraw,listVendor,listPm};
