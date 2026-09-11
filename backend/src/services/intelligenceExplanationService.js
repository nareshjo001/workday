/**
 * M24's deterministic adapter. A future provider may rephrase only the
 * supplied finding/context; it cannot change the authoritative finding,
 * add evidence, or perform a workflow action. No external provider exists
 * in M24, so callers always receive the deterministic engine summary.
 */
function explainFinding(finding, context = {}) { // context reserves an explicit, tenant-scoped future seam.
  void context;
  return finding.summary;
}

module.exports = { explainFinding };
