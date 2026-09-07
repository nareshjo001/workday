const { pool } = require('../config/db');
async function findActiveCompanyByName(conn,name){const [r]=await conn.query('SELECT id,name FROM client_companies WHERE normalized_name=? LIMIT 1',[name.trim().toLowerCase()]);return r[0]||null;}
async function create(conn,v){await conn.query('INSERT INTO pm_company_invitations (id,company_id,email,token_hash,invited_by,expires_at) VALUES (?,?,?,?,?,?)',[v.id,v.companyId,v.email,v.tokenHash,v.invitedBy,v.expiresAt]);}
async function consume(conn,hash,email){const [r]=await conn.query("SELECT * FROM pm_company_invitations WHERE token_hash=? AND email=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>NOW() LIMIT 1 FOR UPDATE",[hash,email]);if(!r[0])return null;await conn.query('UPDATE pm_company_invitations SET accepted_at=NOW() WHERE id=?',[r[0].id]);return r[0];}
module.exports={findActiveCompanyByName,create,consume};
