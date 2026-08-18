-- Module 3: Project & Assignment Management
-- Run this against the target MySQL database (see backend/README.md).
--
-- Links a Vendor-owned contractor to a PM-owned project. For MVP there is
-- no vendor_projects relationship — any Vendor may assign their own
-- contractor to any existing project (see Module 3 spec). The UNIQUE
-- constraint below is the actual "no duplicate assignment" guarantee;
-- the application layer also checks first for a clean 409, same pattern
-- as the duplicate-email handling in Module 2.

CREATE TABLE IF NOT EXISTS project_assignments (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  contractor_id  INT NOT NULL,
  project_id     INT NOT NULL,
  assigned_date  DATE NOT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_assignment_contractor_project (contractor_id, project_id),

  CONSTRAINT fk_assignments_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id),
  CONSTRAINT fk_assignments_project FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
