function submissionLifecycleKey({ auditId, submittedAt }) {
  if (auditId !== null && auditId !== undefined) {
    const normalizedId = String(auditId).trim();
    if (/^[1-9]\d*$/.test(normalizedId)) return `submission:${normalizedId}`;
    throw new Error("Submission audit ID must be a positive integer.");
  }

  if (submittedAt !== null && submittedAt !== undefined) {
    const normalizedTimestamp = submittedAt instanceof Date
      ? submittedAt.toISOString()
      : String(submittedAt).trim();
    if (normalizedTimestamp) return `submitted_at:${normalizedTimestamp}`;
  }

  throw new Error("A submission audit ID or persisted submitted_at value is required.");
}

module.exports = { submissionLifecycleKey };
