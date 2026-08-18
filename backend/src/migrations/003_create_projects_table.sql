-- Module 3: Project & Assignment Management
-- Run this against the target MySQL database (see backend/README.md).
--
-- projects.pm_id -> the owning PM (a users row, role = PM). Same
-- convention as Module 2's contractors.vendor_id: there is no separate
-- `pms` table, a "PM" is just a users row with role = PM, resolved from
-- the authenticated JWT.

CREATE TABLE IF NOT EXISTS projects (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  name           VARCHAR(150) NOT NULL,
  description    TEXT NULL,
  pm_id          INT NOT NULL,
  start_date     DATE NOT NULL,
  end_date       DATE NULL,
  status         ENUM('ACTIVE', 'COMPLETED', 'ON_HOLD') NOT NULL DEFAULT 'ACTIVE',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_projects_pm_id (pm_id),

  CONSTRAINT fk_projects_pm FOREIGN KEY (pm_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
