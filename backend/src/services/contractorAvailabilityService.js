const { pool } = require("../config/db");
const contractorRepository = require("../repositories/contractorRepository");
const availabilityRepository = require("../repositories/availabilityRepository");
const ApiError = require("../utils/ApiError");
const auditService = require("./auditService");

function validateRange(body = {}, { requireReason = false } = {}) {
  const startDate = String(body.start_date || ""); const endDate = String(body.end_date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) throw ApiError.badRequest("Validation failed", ["Provide a valid availability date range."]);
  const reason = body.reason === undefined || body.reason === null ? null : String(body.reason).trim().slice(0, 500) || null;
  if (requireReason && !reason) throw ApiError.badRequest("Validation failed", ["Reason is required."]);
  return { startDate, endDate, reason };
}

function validateListRange(query = {}) {
  const fromDate = String(query.from_date || "");
  const toDate = String(query.to_date || "");
  if (!fromDate && !toDate) return null;
  if (!isIsoDate(fromDate) || !isIsoDate(toDate) || toDate < fromDate) {
    throw ApiError.badRequest("Validation failed", ["Provide both from_date and to_date as a valid date range."]);
  }
  return { fromDate, toDate };
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function resolve(userId) { const contractor = await contractorRepository.findByUserId(userId); if (!contractor) throw ApiError.notFound("Contractor record not found."); return contractor; }
async function list(userId, query) { const contractor = await resolve(userId); return availabilityRepository.listForContractor(contractor.id, validateListRange(query)); }
async function create(userId, body, actor) {
  const contractor = await resolve(userId); const range = validateRange(body, { requireReason: true }); const conn = await pool.getConnection();
  try { await conn.beginTransaction(); if ((await availabilityRepository.lockOverlaps(conn, contractor.id, range.startDate, range.endDate)).length) throw ApiError.conflict("This availability range overlaps an existing unavailable period."); const id = await availabilityRepository.create(conn, contractor.id, range); if (actor) await auditService.write(conn, actor, "CONTRACTOR_UNAVAILABILITY_CREATED", "contractor_unavailability", id, null, range); await conn.commit(); return { id, start_date: range.startDate, end_date: range.endDate, reason: range.reason, status: "ACTIVE" }; } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); }
}
async function createForVendor(vendorId, contractorId, body, actor) {
  const contractor = await contractorRepository.findByVendorAndId(vendorId, contractorId);
  if (!contractor) throw ApiError.notFound("Contractor not found.");
  const range = validateRange(body); const conn = await pool.getConnection();
  try { await conn.beginTransaction(); if ((await availabilityRepository.lockOverlaps(conn, contractor.id, range.startDate, range.endDate)).length) throw ApiError.conflict("This availability range overlaps an existing unavailable period."); const id = await availabilityRepository.create(conn, contractor.id, range); if (actor) await auditService.write(conn, actor, "CONTRACTOR_UNAVAILABILITY_CREATED", "contractor_unavailability", id, null, { ...range, contractor_id: contractor.id }); await conn.commit(); return { id, contractor_id: contractor.id, start_date: range.startDate, end_date: range.endDate, reason: range.reason, status: "ACTIVE" }; } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); }
}
async function cancel(userId, availabilityId, actor) { const contractor = await resolve(userId); const conn = await pool.getConnection(); try { await conn.beginTransaction(); if (!(await availabilityRepository.cancelOwned(conn, contractor.id, availabilityId))) throw ApiError.notFound("Availability entry not found."); if (actor) await auditService.write(conn, actor, "CONTRACTOR_UNAVAILABILITY_CANCELLED", "contractor_unavailability", availabilityId, { status: "ACTIVE" }, { status: "CANCELLED" }); await conn.commit(); } catch (error) { await conn.rollback().catch(() => {}); throw error; } finally { conn.release(); } }
module.exports = { list, create, createForVendor, cancel };
