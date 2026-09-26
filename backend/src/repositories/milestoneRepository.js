const { pool } = require("../config/db");

// Keep one immutable billing contribution per milestone and contractor.

// Create a project-level milestone after the service verifies project ownership.
async function create(conn, { projectId, name, thresholdHours, description = null, sequenceOrder = null, dueDate = null }) {
  const [result] = await conn.query(
    `INSERT INTO milestones (project_id, name, description, sequence_order, due_date, threshold_hours, status)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
    [projectId, name, description, sequenceOrder, dueDate, thresholdHours]
  );
  return result.insertId;
}

// Unscoped milestone lookup requires prior ownership checks by the caller.
async function findById(id) {
  const [rows] = await pool.query(
    `SELECT id, project_id, name, description, sequence_order, due_date, threshold_hours, status, met_at, created_at
     FROM milestones WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

// Return each milestone once with its nested per-contractor billing contributions.
async function listByProject(projectId) {
  const [milestoneRows] = await pool.query(
    `SELECT id, project_id, name, description, sequence_order, due_date, threshold_hours, status, met_at, created_at
     FROM milestones WHERE project_id = ? ORDER BY COALESCE(sequence_order, 2147483647), threshold_hours ASC, id ASC`,
    [projectId]
  );
  if (milestoneRows.length === 0) return [];

  const milestoneIds = milestoneRows.map((m) => m.id);
  const [contributionRows] = await pool.query(
    `SELECT b.milestone_id, b.contractor_id, u.name AS contractor_name,
            b.approved_hours, b.hourly_rate, b.billing_amount, b.created_at
     FROM milestone_billings b
     INNER JOIN contractors c ON c.id = b.contractor_id
     INNER JOIN users u ON u.id = c.user_id
     WHERE b.milestone_id IN (?)
     ORDER BY u.name ASC`,
    [milestoneIds]
  );

  const contributionsByMilestone = new Map();
  for (const row of contributionRows) {
    if (!contributionsByMilestone.has(row.milestone_id)) {
      contributionsByMilestone.set(row.milestone_id, []);
    }
    contributionsByMilestone.get(row.milestone_id).push({
      contractor_id: row.contractor_id,
      contractor_name: row.contractor_name,
      approved_hours: Number(row.approved_hours),
      hourly_rate: Number(row.hourly_rate),
      billing_amount: Number(row.billing_amount),
      created_at: row.created_at,
    });
  }

  return milestoneRows.map((m) => ({
    id: m.id,
    project_id: m.project_id,
    name: m.name,
    description: m.description,
    sequence_order: m.sequence_order,
    due_date: m.due_date,
    threshold_hours: Number(m.threshold_hours),
    status: m.status,
    met_at: m.met_at,
    created_at: m.created_at,
    contributions: contributionsByMilestone.get(m.id) || [],
  }));
}

// Lock pending milestones in threshold order so concurrent evaluations cannot bill them twice.
async function lockPendingForProject(conn, projectId) {
  const [rows] = await conn.query(
    `SELECT id, project_id, name, threshold_hours, status
     FROM milestones
     WHERE project_id = ? AND status = 'PENDING'
     ORDER BY threshold_hours ASC
     FOR UPDATE`,
    [projectId]
  );
  return rows;
}

// Read each contractor's already-billed hours on the same transaction as the milestone locks.
async function sumBilledHoursByContractorForProject(conn, projectId) {
  const [rows] = await conn.query(
    `SELECT b.contractor_id, SUM(b.approved_hours) AS total
     FROM milestone_billings b
     INNER JOIN milestones m ON m.id = b.milestone_id
     WHERE m.project_id = ?
     GROUP BY b.contractor_id`,
    [projectId]
  );
  return new Map(rows.map((r) => [r.contractor_id, Number(r.total)]));
}

// Transition only PENDING milestones to MET and check affectedRows for concurrent changes.
async function markMet(conn, milestoneId) {
  const [result] = await conn.query(
    `UPDATE milestones SET status = 'MET', met_at = NOW() WHERE id = ? AND status = 'PENDING'`,
    [milestoneId]
  );
  return result.affectedRows > 0;
}

async function lockByIdForUpdate(conn, id) { const [r]=await conn.query("SELECT * FROM milestones WHERE id=? LIMIT 1 FOR UPDATE",[id]); return r[0]||null; }
async function updatePending(conn,id,{name,description,sequenceOrder,dueDate,thresholdHours}) { await conn.query("UPDATE milestones SET name=?,description=?,sequence_order=?,due_date=?,threshold_hours=? WHERE id=? AND status='PENDING'",[name,description,sequenceOrder,dueDate,thresholdHours,id]); }

// Persist immutable contributions in the milestone transaction; the unique key prevents duplicate billing.
async function createBilling(conn, { milestoneId, contractorId, approvedHours, hourlyRate, currency, billingAmount }) {
  const [result] = await conn.query(
    `INSERT INTO milestone_billings (milestone_id, contractor_id, approved_hours, hourly_rate, currency, billing_amount)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [milestoneId, contractorId, approvedHours, hourlyRate, currency, billingAmount]
  );
  return result.insertId;
}

// Resolve billing identity from the authoritative ledger row for trusted internal callers.
async function findBillingById(id) {
  const [rows] = await pool.query(
    `SELECT b.id, b.milestone_id, b.contractor_id, b.approved_hours, b.hourly_rate, b.billing_amount,
            m.project_id
     FROM milestone_billings b
     INNER JOIN milestones m ON m.id = b.milestone_id
     WHERE b.id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id,
    milestone_id: r.milestone_id,
    project_id: r.project_id,
    contractor_id: r.contractor_id,
    approved_hours: Number(r.approved_hours),
    hourly_rate: Number(r.hourly_rate),
    billing_amount: Number(r.billing_amount),
  };
}

module.exports = {
  create,
  findById,
  listByProject,
  lockPendingForProject,
  sumBilledHoursByContractorForProject,
  markMet,
  lockByIdForUpdate,
  updatePending,
  createBilling,
  findBillingById,
};
