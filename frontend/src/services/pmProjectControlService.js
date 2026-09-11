import apiClient from "./apiClient";

const severities = new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]);
const primitive = (value) => value === null || ["string", "number", "boolean"].includes(typeof value);

function invalidResponse() { throw new Error("Invalid project control response."); }

export function parseProjectControl(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || payload.contract_version !== "1"
    || !payload.project || !Number.isFinite(payload.project.id) || typeof payload.project.name !== "string" || typeof payload.project.status !== "string"
    || !payload.summary || !Number.isInteger(payload.summary.attention_count) || payload.summary.attention_count < 0
    || !payload.summary.by_severity || typeof payload.summary.by_severity !== "object" || Array.isArray(payload.summary.by_severity)
    || !["HIGH", "MEDIUM", "LOW", "INFO"].every((severity) => Number.isInteger(payload.summary.by_severity[severity]) && payload.summary.by_severity[severity] >= 0)
    || !Array.isArray(payload.findings) || payload.summary.attention_count !== payload.findings.length) invalidResponse();

  if (!payload.findings.every((finding) => finding && typeof finding === "object"
    && typeof finding.code === "string" && severities.has(finding.severity)
    && typeof finding.title === "string" && typeof finding.summary === "string" && typeof finding.recommended_action === "string"
    && finding.source?.engine === "pm_project_control" && finding.source?.version === "1"
    && Array.isArray(finding.evidence) && finding.evidence.every((item) => item && typeof item === "object"
      && typeof item.key === "string" && typeof item.label === "string" && primitive(item.value)
      && (item.unit === undefined || typeof item.unit === "string")))) invalidResponse();

  for (const severity of ["HIGH", "MEDIUM", "LOW", "INFO"]) {
    if (payload.summary.by_severity[severity] !== payload.findings.filter((finding) => finding.severity === severity).length) invalidResponse();
  }
  return payload;
}

async function getProjectControl(projectId) {
  const { data } = await apiClient.get(`/pm/projects/${projectId}/control-intelligence`);
  return parseProjectControl(data);
}

export default { getProjectControl };
