const { normalizeSeverity } = require("../constants/intelligence");

function isSafeEvidenceValue(value) {
  return value === null
    || typeof value === "string"
    || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value));
}

function validateEvidence(evidence) {
  if (!Array.isArray(evidence)) throw new TypeError("Finding evidence must be an array.");
  return evidence.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)
      || typeof item.key !== "string" || !item.key.trim()
      || typeof item.label !== "string" || !item.label.trim()
      || !isSafeEvidenceValue(item.value)
      || (item.unit !== undefined && (typeof item.unit !== "string" || !item.unit.trim()))) {
      throw new TypeError("Each evidence item requires key, label, and a safe primitive value.");
    }
    return { key: item.key.trim(), label: item.label.trim(), value: item.value, ...(item.unit ? { unit: item.unit.trim() } : {}) };
  });
}

/**
 * Validates and normalizes the authoritative, deterministic finding format.
 * Evidence is intentionally limited to explicit safe primitives: engines must
 * select what may be shown rather than pass through records or model output.
 */
function createFinding(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Finding must be an object.");
  const severity = normalizeSeverity(input.severity);
  const strings = ["code", "title", "summary", "recommended_action"];
  if (!severity || !/^[A-Z][A-Z0-9_]*$/.test(input.code || "") || strings.some((field) => typeof input[field] !== "string" || !input[field].trim())
    || !input.source || typeof input.source !== "object" || Array.isArray(input.source)
    || typeof input.source.engine !== "string" || !input.source.engine.trim()
    || (typeof input.source.version !== "string" && typeof input.source.version !== "number") || String(input.source.version).trim() === "") {
    throw new TypeError("Finding has missing or invalid required fields.");
  }
  return {
    code: input.code.trim(), severity, title: input.title.trim(), summary: input.summary.trim(),
    evidence: validateEvidence(input.evidence), recommended_action: input.recommended_action.trim(),
    source: { engine: input.source.engine.trim(), version: String(input.source.version).trim() },
  };
}

module.exports = { createFinding, validateEvidence, isSafeEvidenceValue };
