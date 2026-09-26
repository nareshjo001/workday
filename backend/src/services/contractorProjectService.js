const contractorRepository = require("../repositories/contractorRepository");
const assignmentRepository = require("../repositories/assignmentRepository");

// Resolve assignments from the authenticated user; missing contractor records return an empty list.
async function listAssignedProjects(userId) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    return [];
  }
  return assignmentRepository.listProjectsForContractor(contractor.id);
}

module.exports = { listAssignedProjects };
