ALTER TABLE project_assignments
  ADD COLUMN planned_last_working_date DATE NULL AFTER end_date,
  ADD COLUMN released_by INT NULL AFTER release_reason,
  ADD CONSTRAINT fk_assignment_released_by FOREIGN KEY (released_by) REFERENCES users(id),
  ADD INDEX idx_assignment_project_status_release (project_id, status, released_at);

UPDATE project_assignments SET planned_last_working_date = end_date WHERE planned_last_working_date IS NULL;
