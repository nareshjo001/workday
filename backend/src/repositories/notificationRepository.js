const { pool } = require("../config/db");
async function enabled(userId,eventType){const [r]=await pool.query("SELECT in_app_enabled FROM notification_preferences WHERE user_id=? AND event_type=?",[userId,eventType]);return !r[0]||!!r[0].in_app_enabled;}
async function create(item){const [r]=await pool.query("INSERT IGNORE INTO notifications (recipient_id,event_type,entity_type,entity_id,lifecycle_key,message,deep_link) VALUES (?,?,?,?,?,?,?)",[item.recipientId,item.eventType,item.entityType,item.entityId,item.lifecycleKey||"",item.message,item.deepLink]);return r.affectedRows>0;}
async function enrichNotifications(rows) {
  if (!rows || rows.length === 0) return rows;

  const docIds = [];
  const invoiceIds = [];
  const submissionIds = [];
  const timesheetIds = [];
  const paymentIds = [];
  const assignmentIds = [];
  const milestoneIds = [];

  for (const r of rows) {
    if (!r.entity_id) continue;
    const eid = Number(r.entity_id);
    if (r.entity_type === "contractor_document") docIds.push(eid);
    else if (r.entity_type === "invoice") invoiceIds.push(eid);
    else if (r.entity_type === "candidate_submission") submissionIds.push(eid);
    else if (r.entity_type === "timesheet") timesheetIds.push(eid);
    else if (r.entity_type === "payment") paymentIds.push(eid);
    else if (r.entity_type === "project_assignment") assignmentIds.push(eid);
    else if (r.entity_type === "milestone") milestoneIds.push(eid);
  }

  const docMap = new Map();
  const invoiceMap = new Map();
  const submissionMap = new Map();
  const timesheetMap = new Map();
  const paymentMap = new Map();
  const assignmentMap = new Map();
  const milestoneMap = new Map();

  if (docIds.length > 0) {
    const [docs] = await pool.query(
      `SELECT cd.id, cd.document_type, cd.expiry_date, cd.status, cd.contractor_id, u.name AS contractor_name
       FROM contractor_documents cd
       JOIN contractors c ON c.id = cd.contractor_id
       JOIN users u ON u.id = c.user_id
       WHERE cd.id IN (?)`,
      [[...new Set(docIds)]]
    );
    for (const d of docs) {
      docMap.set(Number(d.id), {
        document_id: d.id,
        contractor_id: d.contractor_id,
        contractor_name: d.contractor_name,
        document_type: d.document_type,
        expiry_date: d.expiry_date ? String(d.expiry_date).slice(0, 10) : null,
        status: d.status,
      });
    }
  }

  if (invoiceIds.length > 0) {
    const [invoices] = await pool.query(
      `SELECT i.id, i.invoice_number, i.total_amount, i.currency, i.project_id, i.rejection_reason, p.name AS project_name
       FROM invoices i
       LEFT JOIN projects p ON p.id = i.project_id
       WHERE i.id IN (?)`,
      [[...new Set(invoiceIds)]]
    );
    for (const inv of invoices) {
      invoiceMap.set(Number(inv.id), {
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        total_amount: inv.total_amount,
        currency: inv.currency,
        project_id: inv.project_id,
        rejection_reason: inv.rejection_reason,
        project_name: inv.project_name,
      });
    }
  }

  if (submissionIds.length > 0) {
    const [subs] = await pool.query(
      `SELECT cs.id, cs.project_id, cs.contractor_id, p.name AS project_name, u.name AS contractor_name, pr.skill
       FROM candidate_submissions cs
       LEFT JOIN projects p ON p.id = cs.project_id
       LEFT JOIN contractors c ON c.id = cs.contractor_id
       LEFT JOIN users u ON u.id = c.user_id
       LEFT JOIN project_requirements pr ON pr.id = cs.requirement_id
       WHERE cs.id IN (?)`,
      [[...new Set(submissionIds)]]
    );
    for (const sub of subs) {
      submissionMap.set(Number(sub.id), {
        submission_id: sub.id,
        project_id: sub.project_id,
        contractor_id: sub.contractor_id,
        project_name: sub.project_name,
        contractor_name: sub.contractor_name,
        skill: sub.skill,
      });
    }
  }

  if (timesheetIds.length > 0) {
    const [ts] = await pool.query(
      `SELECT t.id, t.project_id, t.contractor_id, t.work_date, t.hours_logged, t.status, p.name AS project_name, u.name AS contractor_name
       FROM timesheets t
       LEFT JOIN projects p ON p.id = t.project_id
       LEFT JOIN contractors c ON c.id = t.contractor_id
       LEFT JOIN users u ON u.id = c.user_id
       WHERE t.id IN (?)`,
      [[...new Set(timesheetIds)]]
    );
    for (const t of ts) {
      timesheetMap.set(Number(t.id), {
        timesheet_id: t.id,
        project_id: t.project_id,
        contractor_id: t.contractor_id,
        project_name: t.project_name,
        contractor_name: t.contractor_name,
        work_date: t.work_date ? String(t.work_date).slice(0, 10) : null,
        hours_logged: t.hours_logged,
        status: t.status,
      });
    }
  }

  if (paymentIds.length > 0) {
    const [pays] = await pool.query(
      `SELECT pay.id, pay.amount, pay.method, pay.currency, i.invoice_number, p.name AS project_name
       FROM payments pay
       LEFT JOIN invoices i ON i.id = pay.invoice_id
       LEFT JOIN projects p ON p.id = i.project_id
       WHERE pay.id IN (?)`,
      [[...new Set(paymentIds)]]
    );
    for (const pay of pays) {
      paymentMap.set(Number(pay.id), {
        payment_id: pay.id,
        amount: pay.amount,
        currency: pay.currency,
        method: pay.method,
        invoice_number: pay.invoice_number,
        project_name: pay.project_name,
      });
    }
  }

  if (assignmentIds.length > 0) {
    const [assignments] = await pool.query(
      `SELECT pa.id, pa.project_id, pa.contractor_id, pa.status, p.name AS project_name, u.name AS contractor_name
       FROM project_assignments pa
       LEFT JOIN projects p ON p.id = pa.project_id
       LEFT JOIN contractors c ON c.id = pa.contractor_id
       LEFT JOIN users u ON u.id = c.user_id
       WHERE pa.id IN (?) OR pa.contractor_id IN (?)`,
      [[...new Set(assignmentIds)], [...new Set(assignmentIds)]]
    );
    for (const pa of assignments) {
      const ctx = {
        assignment_id: pa.id,
        project_id: pa.project_id,
        contractor_id: pa.contractor_id,
        status: pa.status,
        project_name: pa.project_name,
        contractor_name: pa.contractor_name,
      };
      assignmentMap.set(Number(pa.id), ctx);
      if (!assignmentMap.has(Number(pa.contractor_id))) {
        assignmentMap.set(Number(pa.contractor_id), ctx);
      }
    }
  }

  if (milestoneIds.length > 0) {
    const [milestones] = await pool.query(
      `SELECT m.id, m.name AS milestone_name, m.threshold_hours, m.status, p.name AS project_name
       FROM milestones m
       LEFT JOIN projects p ON p.id = m.project_id
       WHERE m.id IN (?)`,
      [[...new Set(milestoneIds)]]
    );
    for (const m of milestones) {
      milestoneMap.set(Number(m.id), {
        milestone_id: m.id,
        milestone_name: m.milestone_name,
        threshold_hours: m.threshold_hours,
        status: m.status,
        project_name: m.project_name,
      });
    }
  }

  return rows.map((r) => {
    const eid = Number(r.entity_id);
    let context = null;
    let deepLink = r.deep_link;

    if (r.entity_type === "contractor_document") {
      context = docMap.get(eid) || null;
      if (context && (!deepLink || deepLink === "/vendor/compliance" || deepLink.startsWith("/vendor/compliance?"))) {
        deepLink = `/vendor/compliance?contractor=${context.contractor_id}&document=${context.document_id}`;
      }
    } else if (r.entity_type === "invoice") {
      context = invoiceMap.get(eid) || null;
    } else if (r.entity_type === "candidate_submission") {
      context = submissionMap.get(eid) || null;
    } else if (r.entity_type === "timesheet") {
      context = timesheetMap.get(eid) || null;
    } else if (r.entity_type === "payment") {
      context = paymentMap.get(eid) || null;
    } else if (r.entity_type === "project_assignment") {
      context = assignmentMap.get(eid) || null;
    } else if (r.entity_type === "milestone") {
      context = milestoneMap.get(eid) || null;
    }

    return {
      ...r,
      deep_link: deepLink,
      context,
    };
  });
}

async function list(userId, { page = 1, limit = 10 } = {}){
  const pageNum = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const limitNum = Number.isInteger(Number(limit)) && Number(limit) > 0 ? Math.min(50, Number(limit)) : 10;
  const offset = (pageNum - 1) * limitNum;
  const [[totalRow]] = await pool.query("SELECT COUNT(*) AS total FROM notifications WHERE recipient_id=?", [userId]);
  const [[unreadRow]] = await pool.query("SELECT COUNT(*) AS count FROM notifications WHERE recipient_id=? AND read_at IS NULL", [userId]);
  const [rows] = await pool.query(
    "SELECT id,event_type,entity_type,entity_id,message,deep_link,read_at,created_at FROM notifications WHERE recipient_id=? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
    [userId, limitNum, offset]
  );
  const items = await enrichNotifications(rows);
  const total = Number(totalRow?.total || 0);
  const unread_count = Number(unreadRow?.count || 0);
  const total_pages = Math.max(1, Math.ceil(total / limitNum));
  return { items, unread_count, pagination: { page: pageNum, limit: limitNum, total, total_pages } };
}
async function markRead(userId,id){const [r]=await pool.query("UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=? AND recipient_id=?",[id,userId]);return r.affectedRows>0;}
async function markAllRead(userId){await pool.query("UPDATE notifications SET read_at=NOW() WHERE recipient_id=? AND read_at IS NULL",[userId]);}
async function preferences(userId){const [r]=await pool.query("SELECT event_type,in_app_enabled FROM notification_preferences WHERE user_id=?",[userId]);return r;}
async function setPreference(userId,eventType,enabled){await pool.query("INSERT INTO notification_preferences(user_id,event_type,in_app_enabled) VALUES (?,?,?) ON DUPLICATE KEY UPDATE in_app_enabled=VALUES(in_app_enabled)",[userId,eventType,enabled?1:0]);}
async function contractorUserId(contractorId){const [r]=await pool.query("SELECT user_id FROM contractors WHERE id=?",[contractorId]);return r[0]?.user_id||null;}
async function pmForProject(projectId){const [r]=await pool.query("SELECT pm_id FROM projects WHERE id=?",[projectId]);return r[0]?.pm_id||null;}
module.exports={enabled,create,list,markRead,markAllRead,preferences,setPreference,contractorUserId,pmForProject};
