# Audit

Final status: no unresolved M04 finding.

Architecture: audit SQL is isolated in a repository and business services retain their transaction ownership. Controllers only forward authenticated context.

Security/RBAC: actor identity comes from JWT context; audit data has no public query endpoint, so no new cross-tenant disclosure surface exists. Snapshots are allow-listed by each service and tests check that credentials/tokens/headers are absent.

Database/concurrency: audit rows use the same transaction connection as the mutation. Existing project → requirement → contractor locking and conditional-update race protections are retained. A valid audit-insert failure finding was fixed by making timesheet insertion use its existing transaction connection rather than the pool, ensuring the timesheet and audit row are genuinely atomic.

Deferred: document verification, candidate decisions, payment records, and other domains not yet implemented must be instrumented by their shipping roadmap modules, as required by the roadmap's incremental coverage rule.
