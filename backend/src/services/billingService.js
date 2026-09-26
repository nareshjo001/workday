const milestoneRepository = require("../repositories/milestoneRepository");

// Calculate and persist billing snapshots independently of milestone detection.

// Round billing amounts to the database's two-decimal currency precision.
function calculateBillingAmount(approvedHours, hourlyRate) {
  const amount = Number(approvedHours) * Number(hourlyRate);
  return Math.round(amount * 100) / 100;
}

// Persist supplied rate and hour snapshots in the milestone transaction; duplicate contributions return null.
async function createBillingRecord(conn, { milestoneId, contractorId, approvedHours, hourlyRate, currency = "USD" }) {
  const billingAmount = calculateBillingAmount(approvedHours, hourlyRate);
  let billingId;
  try {
    billingId = await milestoneRepository.createBilling(conn, {
      milestoneId,
      contractorId,
      approvedHours,
      hourlyRate,
      currency,
      billingAmount,
    });
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY") {
      return null;
    }
    throw err;
  }
  return { billingId, milestoneId, contractorId, approvedHours, hourlyRate, currency, billingAmount };
}

module.exports = { calculateBillingAmount, createBillingRecord };
