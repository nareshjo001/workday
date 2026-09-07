-- M13: an explicit, project-level response policy for candidate reviews.
-- due_at and breach are intentionally derived at read time from this value
-- and candidate_submissions.submitted_at; they are not persisted state.
ALTER TABLE projects
  ADD COLUMN candidate_response_sla_hours INT NOT NULL DEFAULT 48
  AFTER backdate_limit_days;
