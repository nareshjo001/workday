-- Module 2: Vendor Contractor Management
-- Run this against the target MySQL database (see backend/README.md).
--
-- contractors.user_id  -> the contractor's own login (users row, role = CONTRACTOR)
-- contractors.vendor_id -> the owning vendor (users row, role = VENDOR)
--
-- There is no separate `vendors` table: Module 1 already models every
-- account — vendor, contractor, or PM — as a single row in `users`
-- distinguished by `role`. A vendor's identity is simply their users.id,
-- resolved from the authenticated JWT. This migration reuses that
-- convention rather than introducing a parallel vendors table.

CREATE TABLE IF NOT EXISTS contractors (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  user_id        INT NOT NULL,
  vendor_id      INT NOT NULL,
  hourly_rate    DECIMAL(10,2) NOT NULL,
  status         ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_contractors_user_id (user_id),
  INDEX idx_contractors_vendor_id (vendor_id),

  CONSTRAINT fk_contractors_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_contractors_vendor FOREIGN KEY (vendor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
