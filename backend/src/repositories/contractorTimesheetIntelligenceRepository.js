const { pool } = require("../config/db");

async function context(contractorId, projectId, workDate) {
  const [[assignment]] = await pool.query("SELECT id,status,allocated_hours,start_date,end_date FROM project_assignments WHERE contractor_id=? AND project_id=? LIMIT 1", [contractorId, projectId]);
  const [[project]] = await pool.query("SELECT id,name,status,start_date,end_date,max_hours_per_day,backdate_limit_days,allow_weekend,expected_hours FROM projects WHERE id=? LIMIT 1", [projectId]);
  // The live submission path is protected by a contractor/project/date unique key.
  // A rejected row still occupies that slot and must be edited through its existing
  // workflow, rather than treated as a new permissible entry.
  const [[sameDay]] = await pool.query("SELECT COUNT(*) count, COALESCE(SUM(CASE WHEN status IN ('DRAFT','SUBMITTED','APPROVED') THEN hours_logged ELSE 0 END),0) hours FROM timesheets WHERE contractor_id=? AND project_id=? AND work_date=? AND status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')", [contractorId, projectId, workDate]);
  const [[reserved]] = await pool.query("SELECT COALESCE(SUM(hours_logged),0) hours FROM timesheets WHERE contractor_id=? AND project_id=? AND status IN ('DRAFT','SUBMITTED','APPROVED')", [contractorId, projectId]);
  return { assignment, project, sameDay: { count: Number(sameDay.count), hours: Number(sameDay.hours) }, reserved: Number(reserved.hours) };
}
module.exports = { context };
