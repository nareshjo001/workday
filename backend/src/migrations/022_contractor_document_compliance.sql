-- M08: contractor compliance documents. Files are stored outside MySQL;
-- this table deliberately keeps only metadata and the opaque storage key.
CREATE TABLE IF NOT EXISTS contractor_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  contractor_id INT NOT NULL,
  document_type ENUM('IDENTITY','TAX','QUALIFICATION') NOT NULL,
  storage_key VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  status ENUM('PENDING','VERIFIED','REJECTED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  expiry_date DATE NULL,
  verified_by INT NULL,
  verified_at TIMESTAMP NULL,
  rejection_reason VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_documents_contractor_status_expiry (contractor_id, status, expiry_date),
  KEY idx_documents_status_created (status, created_at),
  CONSTRAINT fk_documents_contractor FOREIGN KEY (contractor_id) REFERENCES contractors(id),
  CONSTRAINT fk_documents_verified_by FOREIGN KEY (verified_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
