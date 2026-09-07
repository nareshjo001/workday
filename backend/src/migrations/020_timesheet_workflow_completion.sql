-- M06: preserve daily rows while adding draft/submission/rejection workflow.
-- Dynamic checks keep this forward migration safe if the development runner
-- applies the migration set more than once. Existing PENDING rows represented
-- submitted work under the former workflow, so they are deliberately carried
-- forward as SUBMITTED rather than converted to drafts.
SET @sql = IF((SELECT column_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'timesheets' AND column_name = 'status') LIKE '%PENDING%', 'UPDATE timesheets SET status = \'SUBMITTED\' WHERE status = \'PENDING\'', 'SELECT 1');
PREPARE m06_status_data FROM @sql; EXECUTE m06_status_data; DEALLOCATE PREPARE m06_status_data;
SET @sql = IF((SELECT column_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'timesheets' AND column_name = 'status') <> 'enum(\'DRAFT\',\'SUBMITTED\',\'APPROVED\',\'REJECTED\')', 'ALTER TABLE timesheets MODIFY COLUMN status ENUM(\'DRAFT\', \'SUBMITTED\', \'APPROVED\', \'REJECTED\') NOT NULL DEFAULT \'DRAFT\'', 'SELECT 1');
PREPARE m06_status_schema FROM @sql; EXECUTE m06_status_schema; DEALLOCATE PREPARE m06_status_schema;
SET @sql = IF((SELECT column_default FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'timesheets' AND column_name = 'submitted_at') IS NOT NULL, 'ALTER TABLE timesheets MODIFY COLUMN submitted_at TIMESTAMP NULL DEFAULT NULL', 'SELECT 1');
PREPARE m06_submitted_at FROM @sql; EXECUTE m06_submitted_at; DEALLOCATE PREPARE m06_submitted_at;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'timesheets' AND column_name = 'description'), 'SELECT 1', 'ALTER TABLE timesheets ADD COLUMN description VARCHAR(1000) NULL AFTER hours_logged');
PREPARE m06_description FROM @sql; EXECUTE m06_description; DEALLOCATE PREPARE m06_description;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'timesheets' AND column_name = 'rejection_reason'), 'SELECT 1', 'ALTER TABLE timesheets ADD COLUMN rejection_reason VARCHAR(1000) NULL AFTER reviewed_at');
PREPARE m06_rejection_reason FROM @sql; EXECUTE m06_rejection_reason; DEALLOCATE PREPARE m06_rejection_reason;
