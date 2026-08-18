const contractorRepository = require("../repositories/contractorRepository");
const assignmentRepository = require("../repositories/assignmentRepository");

/**
 * Lists the projects assigned to the authenticated contractor. `userId`
 * is req.user.userId off the JWT — this resolves it to the contractor's
 * own contractors.id (project_assignments is keyed on that, not on
 * users.id) before looking up assignments. There is no parameter here
 * that lets a caller ask for a different contractor's assignments — the
 * only identity in play is the one the token proves.
 *
 * Every CONTRACTOR account is created via Module 2's vendor-creates
 * transaction, which always inserts both the users row and the
 * contractors row together, so this lookup should never miss. If it
 * somehow does (e.g. a pre-fix legacy account), this returns an empty
 * list rather than erroring — "no contractor record" and "no assigned
 * projects" look the same from the contractor's side either way.
 */
async function listAssignedProjects(userId) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    return [];
  }
  return assignmentRepository.listProjectsForContractor(contractor.id);
}

module.exports = { listAssignedProjects };
