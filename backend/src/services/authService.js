const { pool } = require("../config/db");
const userRepository = require("../repositories/userRepository");
const clientCompanyRepository = require("../repositories/clientCompanyRepository");
const projectManagerRepository = require("../repositories/projectManagerRepository");
const { hashPassword, comparePassword } = require("../utils/password");
const { signToken } = require("../utils/jwt");
const { createSecureToken, hashToken } = require("../utils/secureToken");
const sessions = require("../repositories/authSessionRepository");
const actionTokens = require("../repositories/authActionTokenRepository");
const mailService = require("./mailService");
const crypto = require("crypto");
const env = require("../config/env");
const sanitizeUser = require("../utils/sanitizeUser");
const ApiError = require("../utils/ApiError");
const { ROLES } = require("../constants/roles");
const pmInvitations = require("../repositories/pmCompanyInvitationRepository");
const audit = require("./auditService");

/**
 * PM signup additionally finds-or-creates a client_companies row and
 * links the new user to it via project_managers — all in one transaction
 * with the user insert itself, so a failure partway through (e.g. the
 * company link) never leaves an orphaned user record with no company.
 * Vendor signup skips all of this (role !== PM).
 */
async function signup({ name, email, password, role, companyName, companyInvitationToken, auditActor }) {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw ApiError.conflict("An account with this email already exists.");
  }

  const passwordHash = await hashPassword(password);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (role === ROLES.PM) {
      const existingCompany = await pmInvitations.findActiveCompanyByName(conn, companyName);
      let companyId;
      let membershipAction;
      if (existingCompany) {
        if (!companyInvitationToken) throw ApiError.forbidden("An invitation is required to join an existing client company.");
        const invitation = await pmInvitations.consume(conn, hashToken(companyInvitationToken), email);
        if (!invitation || invitation.company_id !== existingCompany.id) throw ApiError.forbidden("This company invitation is invalid or expired.");
        companyId = existingCompany.id;
        membershipAction = "PM_COMPANY_MEMBERSHIP_ACCEPTED";
      } else {
        companyId = await clientCompanyRepository.createBootstrap(conn, companyName);
        membershipAction = "PM_COMPANY_BOOTSTRAPPED";
      }
      const user = await userRepository.createUser({ name, email, passwordHash, role }, conn);
      await projectManagerRepository.create(conn, { userId: user.id, companyId });
      await audit.write(conn, { userId: user.id, role, requestId: auditActor?.requestId }, membershipAction, "client_company", companyId, null, { membership_source: membershipAction === "PM_COMPANY_BOOTSTRAPPED" ? "bootstrap" : "invitation" });
      await conn.commit();
      return sanitizeUser(user);
    }
    const user = await userRepository.createUser({ name, email, passwordHash, role }, conn);
    await conn.commit();
    return sanitizeUser(user);
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);

  // Intentionally generic: do not reveal whether the email exists.
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) throw ApiError.unauthorized("Invalid email or password");
  const passwordMatches = await comparePassword(password, user.password_hash);
  if (!passwordMatches) {
    const conn = await pool.getConnection();
    try { await userRepository.recordLoginFailure(conn, user.id, env.auth.maxFailedLogins, env.auth.lockoutMinutes); } finally { conn.release(); }
    throw ApiError.unauthorized("Invalid email or password");
  }
  const conn = await pool.getConnection();
try { await conn.beginTransaction(); await userRepository.clearLoginFailures(conn, user.id); const refresh = createSecureToken(); const id = crypto.randomUUID(); const expiresAt = new Date(Date.now() + env.auth.refreshExpiresDays * 86400000); await sessions.create(conn, { id, userId: user.id, tokenHash: refresh.hash, expiresAt }); await conn.commit(); return { token: signToken({ userId: user.id, role: user.role, sessionId: id }), refreshToken: refresh.raw, user: sanitizeUser(user) }; } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
}

async function refresh(raw) {
  if (!raw || typeof raw !== "string") throw ApiError.unauthorized("Session expired. Please log in again.");
  const conn = await pool.getConnection();
try { await conn.beginTransaction(); const previous = await sessions.findActiveForUpdate(conn, hashToken(raw)); if (!previous) throw ApiError.unauthorized("Session expired. Please log in again."); const user = await userRepository.findById(previous.user_id, conn); if (!user) throw ApiError.unauthorized("Session expired. Please log in again."); const next = createSecureToken(); const id = crypto.randomUUID(); await sessions.create(conn, { id, userId: user.id, tokenHash: next.hash, expiresAt: new Date(Date.now()+env.auth.refreshExpiresDays*86400000) }); await sessions.revoke(conn, previous.id, id); await conn.commit(); return { token: signToken({userId:user.id,role:user.role,sessionId:id}), refreshToken: next.raw, user:sanitizeUser(user) }; } catch(err) { await conn.rollback(); throw err; } finally { conn.release(); }
}

async function logoutAll(userId) { const conn=await pool.getConnection(); try { await conn.beginTransaction(); await sessions.revokeAllForUser(conn,userId); await conn.commit(); } catch (err) { await conn.rollback().catch(()=>{}); throw err; } finally { conn.release(); } }
async function logout(raw) { if (!raw || typeof raw !== "string") return; const conn=await pool.getConnection(); try { await conn.beginTransaction(); await sessions.revokeByTokenHash(conn, hashToken(raw)); await conn.commit(); } catch (err) { await conn.rollback().catch(()=>{}); throw err; } finally { conn.release(); } }
async function issueActionForUser(user, purpose) { const raw=createSecureToken(); const conn=await pool.getConnection(); try { await conn.beginTransaction(); await actionTokens.revokeActive(conn,user.id,purpose); await actionTokens.create(conn,{id:crypto.randomUUID(),userId:user.id,purpose,tokenHash:raw.hash,expiresAt:new Date(Date.now()+env.auth.actionTokenExpiresMinutes*60000)}); await conn.commit(); } catch(err) { await conn.rollback().catch(()=>{}); throw err; } finally { conn.release(); } await mailService.sendAction({to:user.email,name:user.name,purpose,token:raw.raw}); }
async function issueAction(email, purpose) { const user=await userRepository.findByEmail(email); if (!user) return; await issueActionForUser(user, purpose); }
async function consumeAction(raw,purpose,password) { const conn=await pool.getConnection(); try { await conn.beginTransaction(); const token=await actionTokens.consumeForUpdate(conn,hashToken(raw),purpose); if(!token) throw ApiError.badRequest("This link is invalid or expired."); await userRepository.setPassword(conn,token.user_id,await hashPassword(password)); await sessions.revokeAllForUser(conn,token.user_id); await conn.commit(); } catch(err){ await conn.rollback().catch(()=>{}); throw err; } finally { conn.release(); } }

async function getCurrentUser(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw ApiError.unauthorized("User no longer exists.");
  }
  return sanitizeUser(user);
}

async function invitePmToCompany(pmId, email, actor = {}) {
  const conn = await pool.getConnection(); const raw = createSecureToken();
  try { await conn.beginTransaction(); const company = await projectManagerRepository.findByUserId(pmId); if (!company) throw ApiError.notFound("Client company not found."); await pmInvitations.create(conn,{id:crypto.randomUUID(),companyId:company.company_id,email,tokenHash:raw.hash,invitedBy:pmId,expiresAt:new Date(Date.now()+env.auth.actionTokenExpiresMinutes*60000)}); await audit.write(conn,{userId:pmId,role:ROLES.PM,requestId:actor.requestId},"PM_COMPANY_INVITED","pm_company_invitation",email,null,{company_id:company.company_id}); await conn.commit(); } catch(e){await conn.rollback().catch(()=>{});throw e;} finally{conn.release();}
  await mailService.sendAction({to:email,name:email,purpose:"PM_COMPANY_INVITATION",token:raw.raw});
  return process.env.NODE_ENV === "test" ? raw.raw : undefined;
}

module.exports = { signup, login, refresh, logout, logoutAll, issueAction, issueActionForUser, consumeAction, getCurrentUser, invitePmToCompany };
