const { pool } = require("../config/db");
const milestoneRepository = require("../repositories/milestoneRepository");
const timesheetRepository = require("../repositories/timesheetRepository");
const contractorRepository = require("../repositories/contractorRepository");
const assignmentRepository = require("../repositories/assignmentRepository");
const billingService = require("./billingService");
const notifications = require("./notificationService");
const auditService = require("./auditService");

// Milestone thresholds trigger billing; each contractor is billed only for their own unbilled approved hours.

// Subtract each contractor's billed hours from their approved total, omitting non-positive deltas.
function computeContractorDeltas(orderedApprovedRows, alreadyBilledByContractor) {
  const totalsByContractor = new Map();
  for (const row of orderedApprovedRows) {
    totalsByContractor.set(row.contractor_id, (totalsByContractor.get(row.contractor_id) || 0) + row.hours_logged);
  }

  const deltas = new Map();
  for (const [contractorId, total] of totalsByContractor) {
    const alreadyBilled = alreadyBilledByContractor.get(contractorId) || 0;
    const delta = total - alreadyBilled;
    if (delta > 0) {
      deltas.set(contractorId, delta);
    }
  }
  return deltas;
}

// Lock projects and milestones, then bill contributions atomically without undoing the triggering approval.
async function checkAndTriggerMilestones(projectId, auditActor) {
  const conn = await pool.getConnection();
  let newlyCreatedContributions = [];
  try {
    await conn.beginTransaction();

    const pending = await milestoneRepository.lockPendingForProject(conn, projectId);
    if (pending.length === 0) {
      await conn.commit();
      return;
    }

    const orderedApprovedRows = await timesheetRepository.listApprovedOrderedForProject(conn, projectId);
    const totalApprovedHours = orderedApprovedRows.reduce((sum, r) => sum + r.hours_logged, 0);

    // Track already-billed hours per contractor across all milestones in this evaluation.
    const alreadyBilledByContractor = await milestoneRepository.sumBilledHoursByContractorForProject(
      conn,
      projectId
    );

    // Cache locked contractor rows only within this evaluation to keep rate reads consistent.
    const lockedContractors = new Map();

    for (const milestone of pending) {
      const threshold = Number(milestone.threshold_hours);
      if (totalApprovedHours < threshold) continue;

      const deltas = computeContractorDeltas(orderedApprovedRows, alreadyBilledByContractor);

      const marked = await milestoneRepository.markMet(conn, milestone.id);
      if (!marked) {
        // Skip milestones already transitioned by another request.
        continue;
      }
      if (auditActor) {
        await auditService.write(conn, auditActor, "MILESTONE_MET", "milestone", milestone.id, {
          status: "PENDING",
        }, {
          status: "MET", project_id: projectId, threshold_hours: threshold,
        });
      }

      for (const [contractorId, hours] of deltas) {
        let contractor = lockedContractors.get(contractorId);
        if (!contractor) {
          contractor = await contractorRepository.findByIdForUpdate(conn, contractorId);
          if (!contractor) continue;
          lockedContractors.set(contractorId, contractor);
        }

        const assignmentRate = await assignmentRepository.rateSnapshotForContractorProject(conn, contractorId, projectId);
        const billing = await billingService.createBillingRecord(conn, {
          milestoneId: milestone.id,
          contractorId,
          approvedHours: hours,
          // Use the assignment rate snapshot, falling back to the contractor rate for legacy assignments.
          hourlyRate: assignmentRate?.billRate ?? contractor.hourly_rate,
          currency: assignmentRate?.currency ?? "USD",
        });
        // Ignore duplicate contribution inserts already represented in the billing ledger.
        if (billing) {
          newlyCreatedContributions.push({ milestoneId: milestone.id, ...billing });
          // Advance billed totals immediately so later milestones cannot bill the same hours again.
          alreadyBilledByContractor.set(contractorId, (alreadyBilledByContractor.get(contractorId) || 0) + hours);
        }
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    // Log evaluation failures without undoing the already-committed approval or milestone creation.
    console.error(`[milestoneService] checkAndTriggerMilestones failed for project ${projectId}:`, err);
    return;
  } finally {
    conn.release();
  }

  // Committed billings enter the vendor queue; invoice creation requires an explicit lifecycle action.
  const recipientId = await notifications.pmForProject(projectId);
  for (const milestoneId of [...new Set(newlyCreatedContributions.map((item) => item.milestoneId))]) {
    if (recipientId) await notifications.notify({ recipientId, eventType: "MILESTONE_MET", entityType: "milestone", entityId: milestoneId, message: "A project milestone is ready for billing.", deepLink: "/pm/milestones" });
  }
}

module.exports = {
  checkAndTriggerMilestones,
  computeContractorDeltas,
};
