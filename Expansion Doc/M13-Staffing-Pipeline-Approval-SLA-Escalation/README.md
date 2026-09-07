# M13 — Staffing Pipeline, Approval SLA & Escalation

M13 adds one operational staffing screen for each permitted audience. It answers where demand remains open, how candidates have moved through the submission funnel, and which oldest pending reviews have crossed the project response policy.

Each project has a `candidate_response_sla_hours` setting, defaulting to 48 hours. The setting is editable by its owning PM. Candidate due time and breach are derived when the pipeline is read from `submitted_at + candidate_response_sla_hours`; breach is not persisted or fabricated as a candidate status.

PMs see only their own client-company projects. Vendors see only projects with an active project-vendor relationship, and only their own candidate submissions. Revoking project access immediately removes that project from the vendor pipeline.
