-- M11: dated assignments and contractor availability. Existing assignments
-- retain their historical assigned_date as their effective start date.
ALTER TABLE project_assignments
  ADD COLUMN start_date DATE NULL AFTER assigned_date,
  ADD COLUMN end_date DATE NULL AFTER start_date,
  ADD COLUMN actual_end_date DATE NULL AFTER end_date,
  ADD COLUMN release_reason VARCHAR(500) NULL AFTER actual_end_date;

UPDATE project_assignments SET start_date = assigned_date WHERE start_date IS NULL;

CREATE TABLE contractor_unavailability (
  id INT PRIMARY KEY AUTO_INCREMENT,
  contractor_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(500) NULL,
  status ENUM('ACTIVE','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP NULL,
  CONSTRAINT fk_contractor_unavailability_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id),
  INDEX idx_unavailability_contractor_dates (contractor_id, status, start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- M10's active-only uniqueness forbids a contractor's valid non-overlapping
-- future assignments. M11 replaces it with transactional overlap locking.
ALTER TABLE project_assignments DROP INDEX uq_assignment_active_contractor;
ALTER TABLE project_assignments DROP COLUMN active_contractor_key;
