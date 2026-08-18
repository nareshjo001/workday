const { pool } = require("../config/db");
const milestoneRepository = require("../repositories/milestoneRepository");
const timesheetRepository = require("../repositories/timesheetRepository");
const contractorRepository = require("../repositories/contractorRepository");
const billingService = require("./billingService");
const invoiceService = require("./invoiceService");

/**
 * Module 5 integration boundary — PROJECT-LEVEL MILESTONES, INDEPENDENT
 * PER-CONTRACTOR BILLING (MVP fix 2).
 *
 * This is the ONLY place Module 4 talks to milestone/billing concerns —
 * timesheetService (Module 4) knows the single fact "a timesheet was
 * just approved, go ask the milestone module to evaluate this project",
 * and nothing more. No milestone/billing business logic lives in Module
 * 4 — that is entirely Module 5's responsibility, implemented behind
 * `checkAndTriggerMilestones(projectId)`, the ONE reusable function
 * called after every timesheet approval AND after a PM creates a new
 * milestone. There is no duplicate/parallel milestone-detection logic
 * anywhere else in this codebase.
 *
 * THE MODEL:
 *   - A milestone is a project-wide cumulative-APPROVED-hours checkpoint
 *     (SUM of every contractor's approved hours on the project). Its
 *     threshold_hours determines ONLY *when* a billing cycle fires — the
 *     moment the project's total approved hours reach it.
 *   - Thresholds play NO part in *how much* any one contractor is billed.
 *     Every contractor is billed for their OWN actual approved hours,
 *     computed entirely independently of every other contractor. One
 *     contractor's hours are never subtracted from, added to, or used to
 *     "fill" another contractor's share of a threshold (MVP fix 2's
 *     entire reason for existing — the previous implementation treated a
 *     milestone's threshold as a shared pool of billable hours consumed
 *     in approval order across contractors, which is exactly the bug this
 *     rewrite removes).
 *   - Each contractor's billable amount for a newly-met milestone is
 *     their own cumulative APPROVED hours on the project, MINUS whatever
 *     has already been billed to them (across any earlier milestone on
 *     this same project) — see computeContractorDeltas below. This is
 *     what guarantees "each approved hour is associated with exactly one
 *     billing cycle": once a delta is billed, it becomes part of
 *     "already billed" for every subsequent milestone evaluation, so it
 *     can never be billed again.
 */

/**
 * Computes each contractor's marginal (never-before-billed) approved
 * hours as of right now — the actual amount MVP fix 2 requires each
 * contractor to be billed for at a newly-met milestone.
 *
 * `orderedApprovedRows` is every APPROVED timesheet row for the project
 * (contractor_id + hours_logged); this function sums each contractor's
 * own rows to get their live total, then subtracts
 * `alreadyBilledByContractor.get(contractorId)` (0 if absent — nothing
 * billed to them yet). A contractor whose delta is <= 0 (nothing new
 * since their last billing, or 0 hours contributed at all) gets no entry
 * — no zero/negative-hour contribution or billing row is ever created.
 *
 * Deliberately contractor-scoped and nothing else: there is no
 * "milestone threshold" parameter here at all, because the threshold
 * plays no role in this computation (see this file's own top comment).
 *
 * Worked example straight from the spec: project expected_hours = 20,
 * M1 = 10h, M2 = 20h. A is allocated 10h and gets approved for 6h; B is
 * allocated 10h and gets approved for 8h. Project total = 14h, so M1
 * (10h) is reached. Called with alreadyBilledByContractor empty (nothing
 * billed yet), this returns { A: 6, B: 8 } — A is billed 6h x A's rate,
 * B is billed 8h x B's rate, independently. Contrast with the bug this
 * replaces, which would have billed B only 10 - 6 = 4h by treating the
 * 10h threshold as A and B's shared pool.
 */
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

/**
 * The real milestone-detection + billing entry point, called both:
 *   1. After every timesheet approval (via checkAndTriggerMilestones —
 *      same function, this IS the reusable hook, not a wrapper around a
 *      differently-named one).
 *   2. Immediately after a PM creates a new milestone (via
 *      pmMilestoneService), so a milestone created retroactively below
 *      the project's already-approved hours is caught and billed right
 *      away instead of silently waiting for the next approved timesheet.
 *
 * One transaction, covering the detection + billing steps below; the
 * Module 6 invoice-generation hook runs AFTER commit, once per
 * newly-created contribution, each wrapped in its own try/catch so a
 * failure there can never affect anything already committed:
 *
 *   1. Lock the project row and every PENDING milestone for it
 *      (`SELECT ... FOR UPDATE`) — the actual concurrency guarantee: a
 *      second, concurrent evaluation for the SAME project blocks here
 *      until this transaction commits or rolls back, so it can never
 *      double-process the same milestone or double-bill the same hours.
 *   2. Read every APPROVED timesheet for the project, in chronological
 *      order, freshly inside this transaction (never trusted from any
 *      caller) — see timesheetRepository.listApprovedOrderedForProject.
 *      (Chronological order is not actually needed for the billing math
 *      anymore — MVP fix 2 bills each contractor's live total, not a
 *      row-by-row walk — but this stays the source of "every approved
 *      row" either way, and the ordering is harmless.)
 *   3. Read every contractor's already-billed total for this project
 *      (milestoneRepository.sumBilledHoursByContractorForProject) — the
 *      ledger computeContractorDeltas subtracts from each contractor's
 *      live approved total. Advanced IN-MEMORY (never re-queried) as this
 *      loop bills new contributions, so a single call that crosses
 *      several thresholds at once still only ever bills each contractor's
 *      hours to exactly one milestone.
 *   4. For every locked PENDING milestone, ascending by threshold: if the
 *      project's total approved hours haven't reached this threshold yet,
 *      skip it (and keep checking the rest — thresholds are not
 *      guaranteed to have been created in ascending order, even though
 *      that's the expected usage). Otherwise, compute every contractor's
 *      marginal delta (computeContractorDeltas), mark the milestone MET,
 *      and write one immutable contribution/billing row per contributing
 *      contractor — each contractor's hourly_rate is read from
 *      contractors.hourly_rate INSIDE this transaction (row-locked via
 *      findByIdForUpdate), never from any request payload, and never
 *      re-read for a contractor already locked earlier in this same call
 *      (a rate change mid-call cannot apply to only some of a
 *      contractor's own hours).
 *   5. COMMIT. Then, outside the transaction, invoke the Module 6 hook
 *      once per newly-created contribution row.
 *
 * This function deliberately never throws — a failure here must never
 * surface as a failure of whatever triggered it (a successful timesheet
 * approval, or a successful milestone creation). Errors are logged and
 * swallowed; see the try/catch below.
 */
async function checkAndTriggerMilestones(projectId) {
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

    // Running per-contractor "already billed" ledger — seeded from every
    // milestone_billings row that already exists for this project (any
    // milestone met before this call), then advanced in-memory as this
    // loop bills new contributions within this same call (see this
    // function's own doc comment, step 3).
    const alreadyBilledByContractor = await milestoneRepository.sumBilledHoursByContractorForProject(
      conn,
      projectId
    );

    // Row-lock cache: a contractor's hourly_rate must be read (and locked)
    // at most once per call even if they contribute to several milestones
    // crossed in the same evaluation, and must be locked fresh every call
    // (never cached across separate checkAndTriggerMilestones invocations).
    const lockedContractors = new Map();

    for (const milestone of pending) {
      const threshold = Number(milestone.threshold_hours);
      if (totalApprovedHours < threshold) continue; // Not reached yet — keep checking the rest.

      const deltas = computeContractorDeltas(orderedApprovedRows, alreadyBilledByContractor);

      const marked = await milestoneRepository.markMet(conn, milestone.id);
      if (!marked) {
        // Lost an (unreachable, under this row lock) race — skip, not an
        // error.
        continue;
      }

      for (const [contractorId, hours] of deltas) {
        let contractor = lockedContractors.get(contractorId);
        if (!contractor) {
          contractor = await contractorRepository.findByIdForUpdate(conn, contractorId);
          if (!contractor) continue; // Defensive — should be unreachable.
          lockedContractors.set(contractorId, contractor);
        }

        const billing = await billingService.createBillingRecord(conn, {
          milestoneId: milestone.id,
          contractorId,
          approvedHours: hours,
          hourlyRate: contractor.hourly_rate,
        });
        // billing is null only if a contribution row already existed
        // (ER_DUP_ENTRY) — unreachable under the row lock held for this
        // transaction, but createBillingRecord treats it as "already
        // billed" rather than an error either way.
        if (billing) {
          newlyCreatedContributions.push({ milestoneId: milestone.id, ...billing });
          // Advance the in-memory ledger immediately — the NEXT milestone
          // processed in this same loop (if any) must see this hours
          // as already billed, so it is never billed again at a higher
          // threshold reached in the same call.
          alreadyBilledByContractor.set(contractorId, (alreadyBilledByContractor.get(contractorId) || 0) + hours);
        }
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    // Never propagate — see this function's own doc comment above for
    // why. The timesheet approval (or milestone creation) that triggered
    // this already succeeded and must not appear to have failed.
    console.error(`[milestoneService] checkAndTriggerMilestones failed for project ${projectId}:`, err);
    return;
  } finally {
    conn.release();
  }

  // Module 6 boundary — called only after every newly-MET milestone's
  // contribution rows are safely committed. A failure here must never
  // undo either. `billingId` (the milestone_billings row's own id) is
  // what invoiceService actually anchors the invoice to.
  for (const contribution of newlyCreatedContributions) {
    try {
      await invoiceService.generateInvoiceForMilestone({
        milestoneBillingId: contribution.billingId,
        milestoneId: contribution.milestoneId,
        projectId,
        contractorId: contribution.contractorId,
        billingAmount: contribution.billingAmount,
      });
    } catch (err) {
      console.error(
        `[milestoneService] invoiceService.generateInvoiceForMilestone failed for milestone ${contribution.milestoneId}, contractor ${contribution.contractorId}:`,
        err
      );
    }
  }
}

module.exports = {
  checkAndTriggerMilestones,
  // Exported for unit-level testing of the per-contractor billing math in
  // isolation, same rationale the old apportionContributions export had.
  computeContractorDeltas,
};
