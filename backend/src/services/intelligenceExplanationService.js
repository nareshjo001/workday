// Allow optional explanations to rephrase findings without changing evidence or workflow state.
const provider = require("./aiExplanationProvider");
const logger = require("../observability/logger");
const env = require("../config/env");

async function explainFindingResult(finding, context = {}) {
  void context;
  if (!env.intelligence.aiExplanations) {
    return { explanation: finding.summary, source: "DETERMINISTIC" };
  }
  try {
    const explanation = await provider.generateExplanation(finding);
    return { explanation: explanation || finding.summary, source: explanation ? "AI" : "DETERMINISTIC" };
  } catch {
    // Fall back to the deterministic summary if the optional provider throws.
    logger.warn("ai_explanation_service_fallback", { reason: "provider_exception" });
    return { explanation: finding.summary, source: "DETERMINISTIC" };
  }
}

function explainFinding(finding) { return finding.summary; }
module.exports = { explainFinding, explainFindingResult };
