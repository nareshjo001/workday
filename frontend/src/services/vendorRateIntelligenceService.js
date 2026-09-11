import apiClient from "./apiClient";

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const FINDING_SEVERITIES = new Set(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);

function invalidResponse() {
  throw new Error("Invalid rate intelligence response.");
}

// This verifies the server contract before any advisory values are rendered.
// It deliberately does not calculate a rate, margin, or recommendation.
function parseAnalysis(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || payload.contract_version !== "1"
    || !payload.context || typeof payload.context !== "object"
    || !payload.context.contractor || !payload.context.project || !payload.context.requirement
    || !isFiniteNumber(payload.context.contractor.id) || !isFiniteNumber(payload.context.project.id)
    || !isFiniteNumber(payload.context.requirement.id) || !/^[A-Z]{3}$/.test(payload.context.currency)
    || !payload.cost || !isFiniteNumber(payload.cost.rate)
    || !payload.comparables || typeof payload.comparables.scope !== "string" || !isFiniteNumber(payload.comparables.sample_size)
    || !payload.constraints || typeof payload.constraints !== "object"
    || !payload.recommendation || !["AVAILABLE", "INSUFFICIENT_DATA"].includes(payload.recommendation.status)
    || !Array.isArray(payload.findings)) invalidResponse();

  if (payload.proposed_rate !== null && (!payload.proposed_rate || !isFiniteNumber(payload.proposed_rate.rate)
    || !isFiniteNumber(payload.proposed_rate.margin_per_hour)
    || (payload.proposed_rate.margin_percentage !== null && !isFiniteNumber(payload.proposed_rate.margin_percentage)))) invalidResponse();

  if (payload.recommendation.status === "AVAILABLE"
    && (![payload.recommendation.lower, payload.recommendation.suggested, payload.recommendation.upper, payload.comparables.median].every(isFiniteNumber))) invalidResponse();

  if (payload.recommendation.status === "INSUFFICIENT_DATA"
    && (payload.recommendation.lower !== null || payload.recommendation.suggested !== null || payload.recommendation.upper !== null)) invalidResponse();

  const rateCard = payload.constraints.applicable_rate_card;
  if (rateCard !== null && (!rateCard || !isFiniteNumber(rateCard.bill_rate) || !isFiniteNumber(rateCard.cost_rate) || !/^[A-Z]{3}$/.test(rateCard.currency))) invalidResponse();

  if (!payload.findings.every((finding) => finding && typeof finding === "object"
    && typeof finding.code === "string" && FINDING_SEVERITIES.has(finding.severity)
    && typeof finding.title === "string" && typeof finding.summary === "string"
    && typeof finding.recommended_action === "string" && Array.isArray(finding.evidence)
    && finding.source && typeof finding.source.engine === "string" && typeof finding.source.version === "string"
    && finding.evidence.every((item) => item && typeof item === "object" && typeof item.key === "string"
      && typeof item.label === "string" && (item.value === null || ["string", "number", "boolean"].includes(typeof item.value))
      && (item.unit === undefined || typeof item.unit === "string")))) invalidResponse();

  return payload;
}

async function analyzeRate({ contractorId, projectId, requirementId, proposedBillRate }) {
  const { data } = await apiClient.post("/vendor/rate-intelligence/analyze", {
    contractorId,
    projectId,
    requirementId,
    proposedBillRate,
  });
  return parseAnalysis(data);
}

export { parseAnalysis };
export default { analyzeRate };
