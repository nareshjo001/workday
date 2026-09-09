# Release Notes — v2.0-portfolio

`v2.0-portfolio` is the proposed tag after merge. This document does not create it.

## Release lineage

- **v1.0-hackathon:** the original two-day Workday hackathon MVP, preserved by its historical tag.
- **v2.0-portfolio:** independent post-hackathon audit, hardening, redesign, and expansion across M00–M23.

## Major themes

- Platform/security foundations: session rotation/revocation, invitations, tenant-safe errors, structured logs, health endpoints, transactional audit.
- Workforce lifecycle: multi-skill profiles, compliance, candidate workflow, dated assignment/capacity rules, timesheet review, offboarding/history.
- Commercial correctness: scoped rate cards, immutable snapshots, project-wide milestones and exactly-once contractor contributions.
- Invoice/payment lifecycle: Vendor drafts and submission, PM review, numbering, tax/adjustments/PDF freeze, append-only settlement and overdue derivation.
- Analytics: role-scoped dashboards, exact terminology, historical margin, and injection-safe filtered CSV exports.
- Production readiness: checksum-ledgered migrations, Docker demo, deterministic seed, Playwright, backup/restore, security and performance smoke checks.

## Known limitations

- This is a portfolio/demo system, not a claim of production customer adoption or external payment-gateway integration.
- Email/SMS/push delivery, payroll, refunds/credits, foreign-exchange conversion, and background-worker infrastructure are intentionally out of scope.
- Moderate React Router advisories remain documented; the available remediation requires a breaking v7 migration and was not taken as a release-prep side effect.
- MySQL DDL is forward-only in practice; risky rollout recovery is backup/restore or a deliberate forward fix, not fictional universal down migrations.
