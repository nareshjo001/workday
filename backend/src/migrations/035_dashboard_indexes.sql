-- M20 aggregation paths: invoices/payment reporting is scoped by project or
-- vendor and then bounded by lifecycle/date; these indexes support that shape.
ALTER TABLE invoices ADD INDEX idx_invoices_project_status_date (project_id, status, submitted_at);
ALTER TABLE timesheets ADD INDEX idx_timesheets_project_status_work_date (project_id, status, work_date);
ALTER TABLE candidate_submissions ADD INDEX idx_candidate_project_status_submitted (project_id, status, submitted_at);
