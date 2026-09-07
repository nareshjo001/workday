-- M07: normalized contractor profiles and multi-skill staffing.
-- Legacy enum values are retained as compatibility columns until every
-- read path has moved to skill_id; the relational rows are authoritative.

CREATE TABLE IF NOT EXISTS skills (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_skills_code (code),
  UNIQUE KEY uq_skills_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO skills (code, name) VALUES
  ('FRONTEND', 'Frontend'), ('BACKEND', 'Backend'), ('QA', 'Quality Assurance'),
  ('DEVOPS', 'DevOps'), ('DATA', 'Data')
ON DUPLICATE KEY UPDATE name = VALUES(name);

CREATE TABLE IF NOT EXISTS contractor_skills (
  contractor_id INT NOT NULL,
  skill_id INT NOT NULL,
  proficiency ENUM('BEGINNER','INTERMEDIATE','ADVANCED','EXPERT') NOT NULL DEFAULT 'INTERMEDIATE',
  years_experience DECIMAL(4,1) NOT NULL DEFAULT 0,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (contractor_id, skill_id),
  KEY idx_contractor_skills_skill_contractor (skill_id, contractor_id),
  CONSTRAINT fk_contractor_skills_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id),
  CONSTRAINT fk_contractor_skills_skill FOREIGN KEY (skill_id) REFERENCES skills(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO contractor_skills (contractor_id, skill_id, proficiency, years_experience, is_primary)
SELECT c.id, s.id, 'INTERMEDIATE', 0, 1
FROM contractors c INNER JOIN skills s ON s.code = c.skill
WHERE c.skill IS NOT NULL
ON DUPLICATE KEY UPDATE is_primary = GREATEST(contractor_skills.is_primary, VALUES(is_primary));

SET @sql := IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'contractors' AND column_name = 'phone'), 'SELECT 1', 'ALTER TABLE contractors ADD COLUMN phone VARCHAR(30) NULL AFTER hourly_rate');
PREPARE m07_phone FROM @sql; EXECUTE m07_phone; DEALLOCATE PREPARE m07_phone;
SET @sql := IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'contractors' AND column_name = 'headline'), 'SELECT 1', 'ALTER TABLE contractors ADD COLUMN headline VARCHAR(160) NULL AFTER phone');
PREPARE m07_headline FROM @sql; EXECUTE m07_headline; DEALLOCATE PREPARE m07_headline;
SET @sql := IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'contractors' AND column_name = 'total_experience_years'), 'SELECT 1', 'ALTER TABLE contractors ADD COLUMN total_experience_years DECIMAL(4,1) NULL AFTER headline');
PREPARE m07_experience FROM @sql; EXECUTE m07_experience; DEALLOCATE PREPARE m07_experience;
SET @sql := IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'contractors' AND column_name = 'notes'), 'SELECT 1', 'ALTER TABLE contractors ADD COLUMN notes VARCHAR(1000) NULL AFTER total_experience_years');
PREPARE m07_notes FROM @sql; EXECUTE m07_notes; DEALLOCATE PREPARE m07_notes;

SET @sql := IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'project_requirements' AND column_name = 'skill_id'), 'SELECT 1', 'ALTER TABLE project_requirements ADD COLUMN skill_id INT NULL AFTER skill');
PREPARE m07_requirement_skill FROM @sql; EXECUTE m07_requirement_skill; DEALLOCATE PREPARE m07_requirement_skill;
UPDATE project_requirements pr INNER JOIN skills s ON s.code = pr.skill SET pr.skill_id = s.id WHERE pr.skill_id IS NULL;
SET @sql := IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'project_requirements' AND index_name = 'idx_requirements_skill_id'), 'SELECT 1', 'ALTER TABLE project_requirements ADD INDEX idx_requirements_skill_id (skill_id)');
PREPARE m07_requirement_skill_index FROM @sql; EXECUTE m07_requirement_skill_index; DEALLOCATE PREPARE m07_requirement_skill_index;
SET @sql := IF(EXISTS(SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'project_requirements' AND constraint_name = 'fk_requirements_skill'), 'SELECT 1', 'ALTER TABLE project_requirements ADD CONSTRAINT fk_requirements_skill FOREIGN KEY (skill_id) REFERENCES skills(id)');
PREPARE m07_requirement_skill_fk FROM @sql; EXECUTE m07_requirement_skill_fk; DEALLOCATE PREPARE m07_requirement_skill_fk;
