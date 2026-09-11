import apiClient from "./apiClient";

const CAPABILITY_KEYS = [
  "vendor_rate_intelligence",
  "pm_project_control",
  "contractor_timesheet_intelligence",
  "ai_explanations",
];

function parseCapabilities(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || typeof payload.intelligence_contract_version !== "string"
    || !payload.capabilities || typeof payload.capabilities !== "object" || Array.isArray(payload.capabilities)
    || CAPABILITY_KEYS.some((key) => typeof payload.capabilities[key] !== "boolean")) {
    throw new Error("Invalid intelligence capability response.");
  }
  return {
    intelligence_contract_version: payload.intelligence_contract_version,
    capabilities: Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, payload.capabilities[key]])),
  };
}

// Foundation-only discovery. The server derives role and identity from JWT.
async function getCapabilities() {
  const { data } = await apiClient.get("/intelligence/capabilities");
  return parseCapabilities(data);
}

export { parseCapabilities };
export default { getCapabilities };
