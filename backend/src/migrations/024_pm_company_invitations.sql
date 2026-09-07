CREATE TABLE IF NOT EXISTS pm_company_invitations (
  id CHAR(36) PRIMARY KEY,
  company_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  invited_by INT NOT NULL,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pm_company_invitation_token (token_hash),
  KEY idx_pm_company_invitation_email (company_id,email,accepted_at,revoked_at,expires_at),
  FOREIGN KEY (company_id) REFERENCES client_companies(id),
  FOREIGN KEY (invited_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
