const { pool } = require("../config/db");

async function listActive() {
  const [rows] = await pool.query("SELECT id, code, name FROM skills WHERE is_active = 1 ORDER BY name ASC");
  return rows;
}

async function findActiveByCode(code, conn) {
  const [rows] = await (conn || pool).query("SELECT id, code, name FROM skills WHERE code = ? AND is_active = 1 LIMIT 1", [code]);
  return rows[0] || null;
}

async function listForContractor(contractorId, conn) {
  const [rows] = await (conn || pool).query(`SELECT s.id, s.code, s.name, cs.proficiency, cs.years_experience, cs.is_primary
    FROM contractor_skills cs INNER JOIN skills s ON s.id = cs.skill_id
    WHERE cs.contractor_id = ? ORDER BY cs.is_primary DESC, s.name ASC`, [contractorId]);
  return rows.map((row) => ({ ...row, years_experience: Number(row.years_experience), is_primary: Boolean(row.is_primary) }));
}

async function replaceForContractor(conn, contractorId, skills) {
  await conn.query("DELETE FROM contractor_skills WHERE contractor_id = ?", [contractorId]);
  if (!skills.length) return;
  await conn.query("INSERT INTO contractor_skills (contractor_id, skill_id, proficiency, years_experience, is_primary) VALUES ?", [skills.map((skill) => [contractorId, skill.skillId, skill.proficiency, skill.yearsExperience, skill.isPrimary ? 1 : 0])]);
}

module.exports = { listActive, findActiveByCode, listForContractor, replaceForContractor };
