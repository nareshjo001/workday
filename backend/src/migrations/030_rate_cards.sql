CREATE TABLE rate_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_company_id INT NOT NULL,
  vendor_id INT NOT NULL,
  skill_id INT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  bill_rate DECIMAL(10,2) NOT NULL,
  cost_rate DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rate_cards_lookup (client_company_id,vendor_id,skill_id,status,effective_from,effective_to),
  CONSTRAINT fk_rate_card_company FOREIGN KEY (client_company_id) REFERENCES client_companies(id),
  CONSTRAINT fk_rate_card_vendor FOREIGN KEY (vendor_id) REFERENCES users(id),
  CONSTRAINT fk_rate_card_skill FOREIGN KEY (skill_id) REFERENCES skills(id)
);
ALTER TABLE project_assignments
  ADD COLUMN bill_rate_snapshot DECIMAL(10,2) NULL AFTER allocated_hours,
  ADD COLUMN cost_rate_snapshot DECIMAL(10,2) NULL AFTER bill_rate_snapshot,
  ADD COLUMN currency CHAR(3) NULL AFTER cost_rate_snapshot,
  ADD COLUMN rate_card_id INT NULL AFTER currency,
  ADD CONSTRAINT fk_assignment_rate_card FOREIGN KEY (rate_card_id) REFERENCES rate_cards(id);
