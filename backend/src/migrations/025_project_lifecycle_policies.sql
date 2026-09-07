-- M10: project commercial/time policies and mutable requirement lifecycle.
-- New columns remain nullable where legacy rows cannot be safely inferred.
ALTER TABLE projects
  ADD COLUMN budget DECIMAL(12,2) NULL AFTER expected_hours,
  ADD COLUMN currency CHAR(3) NULL AFTER budget,
  ADD COLUMN max_hours_per_day DECIMAL(5,2) NULL AFTER currency,
  ADD COLUMN max_hours_per_week DECIMAL(6,2) NULL AFTER max_hours_per_day,
  ADD COLUMN allow_weekend BOOLEAN NOT NULL DEFAULT FALSE AFTER max_hours_per_week,
  ADD COLUMN backdate_limit_days INT NULL AFTER allow_weekend;

ALTER TABLE project_requirements
  ADD COLUMN description VARCHAR(500) NULL AFTER required_count,
  ADD COLUMN status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN' AFTER description;

ALTER TABLE projects MODIFY status ENUM('ACTIVE','COMPLETED','ON_HOLD','CANCELLED') NOT NULL DEFAULT 'ACTIVE';
