/**
 * M24's deterministic adapter. A future provider may rephrase only the
 * supplied finding/context; it cannot change the authoritative finding,
 * add evidence, or perform a workflow action. No external provider exists
 * in M24, so callers always receive the deterministic engine summary.
 */
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
    // The adapter is already designed to return null on provider failure.
    // This final guard keeps a provider implementation defect from breaking a
    // read-only PM workflow.
    logger.warn("ai_explanation_service_fallback", { reason: "provider_exception" });
    return { explanation: finding.summary, source: "DETERMINISTIC" };
  }
}

function explainFinding(finding) { return finding.summary; }
module.exports = { explainFinding, explainFindingResult };
