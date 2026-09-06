-- MySQL versions supported by this project do not consistently implement
-- CREATE INDEX IF NOT EXISTS.  The dynamic checks keep the forward migration
-- safe when the development migration runner is invoked more than once.
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'contractors' AND index_name = 'idx_contractors_vendor_status_skill_created'), 'SELECT 1', 'ALTER TABLE contractors ADD INDEX idx_contractors_vendor_status_skill_created (vendor_id, status, skill, created_at)');
PREPARE m05_index FROM @sql; EXECUTE m05_index; DEALLOCATE PREPARE m05_index;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'projects' AND index_name = 'idx_projects_pm_status_dates_created'), 'SELECT 1', 'ALTER TABLE projects ADD INDEX idx_projects_pm_status_dates_created (pm_id, status, start_date, end_date, created_at)');
PREPARE m05_index FROM @sql; EXECUTE m05_index; DEALLOCATE PREPARE m05_index;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'timesheets' AND index_name = 'idx_timesheets_project_status_date'), 'SELECT 1', 'ALTER TABLE timesheets ADD INDEX idx_timesheets_project_status_date (project_id, status, work_date)');
PREPARE m05_index FROM @sql; EXECUTE m05_index; DEALLOCATE PREPARE m05_index;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'invoices' AND index_name = 'idx_invoices_vendor_status_generated'), 'SELECT 1', 'ALTER TABLE invoices ADD INDEX idx_invoices_vendor_status_generated (vendor_id, status, generated_at)');
PREPARE m05_index FROM @sql; EXECUTE m05_index; DEALLOCATE PREPARE m05_index;
