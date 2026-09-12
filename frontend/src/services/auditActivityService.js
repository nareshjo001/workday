import apiClient from "./apiClient";

const primitive = (value) => value === null || ["string", "number", "boolean"].includes(typeof value);
function invalid() { throw new Error("Invalid activity response."); }
function parseItem(item) {
  if (!item || typeof item !== "object" || !Number.isFinite(item.id) || typeof item.occurred_at !== "string" || typeof item.event !== "string"
    || !item.actor || typeof item.actor.display_name !== "string" || typeof item.actor.role !== "string"
    || !item.entity || typeof item.entity.type !== "string" || typeof item.entity.id !== "string"
    || typeof item.title !== "string" || typeof item.summary !== "string" || !Array.isArray(item.details)
    || !item.details.every((detail) => detail && typeof detail.label === "string" && primitive(detail.value))) invalid();
  return item;
}
export function parseActivity(payload, { project = false } = {}) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.items) || !payload.pagination || !Number.isInteger(payload.pagination.page)
    || !Number.isInteger(payload.pagination.limit) || !Number.isInteger(payload.pagination.total) || !Number.isInteger(payload.pagination.total_pages)) invalid();
  if (project && (!payload.project || !Number.isFinite(payload.project.id) || typeof payload.project.name !== "string" || typeof payload.project.status !== "string")) invalid();
  payload.items.forEach(parseItem); return payload;
}
async function get(path, params, project = false) { const { data } = await apiClient.get(path, { params }); return parseActivity(data, project ? { project: true } : undefined); }
export default {
  project: (projectId, page = 1) => get(`/pm/projects/${projectId}/activity`, { page, limit: 25 }, true),
  vendor: (page = 1) => get("/vendor/activity", { page, limit: 25 }),
  contractor: (page = 1) => get("/contractor/activity", { page, limit: 25 }),
};
