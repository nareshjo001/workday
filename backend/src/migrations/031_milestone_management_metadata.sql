ALTER TABLE milestones
  ADD COLUMN description VARCHAR(1000) NULL AFTER name,
  ADD COLUMN sequence_order INT NULL AFTER description,
  ADD COLUMN due_date DATE NULL AFTER sequence_order,
  ADD INDEX idx_milestones_project_sequence (project_id, sequence_order);
