CREATE TABLE IF NOT EXISTS client_vendor_relationships (
 id INT PRIMARY KEY AUTO_INCREMENT, client_company_id INT NOT NULL, vendor_id INT NOT NULL,
 status ENUM('ACTIVE','REVOKED') NOT NULL DEFAULT 'ACTIVE', invited_by INT NOT NULL, accepted_at TIMESTAMP NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_client_vendor (client_company_id,vendor_id), KEY idx_vendor_relationship (vendor_id,status),
 FOREIGN KEY (client_company_id) REFERENCES client_companies(id), FOREIGN KEY (vendor_id) REFERENCES users(id), FOREIGN KEY (invited_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS project_vendors (
 project_id INT NOT NULL, vendor_id INT NOT NULL, status ENUM('ACTIVE','REVOKED') NOT NULL DEFAULT 'ACTIVE', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (project_id,vendor_id), KEY idx_project_vendors_vendor_status (vendor_id,status),
 FOREIGN KEY (project_id) REFERENCES projects(id), FOREIGN KEY (vendor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
