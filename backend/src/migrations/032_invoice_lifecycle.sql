CREATE TABLE invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  milestone_billing_id INT NOT NULL,
  approved_hours DECIMAL(7,2) NOT NULL,
  bill_rate DECIMAL(10,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_invoice_item_billing (milestone_billing_id),
  CONSTRAINT fk_invoice_item_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_invoice_item_billing FOREIGN KEY (milestone_billing_id) REFERENCES milestone_billings(id)
);
ALTER TABLE invoices DROP FOREIGN KEY fk_invoices_milestone_billing, DROP INDEX uq_invoices_milestone_billing, ADD INDEX idx_invoices_milestone_billing (milestone_billing_id), ADD CONSTRAINT fk_invoices_milestone_billing_v2 FOREIGN KEY (milestone_billing_id) REFERENCES milestone_billings(id), MODIFY COLUMN milestone_billing_id INT NULL, MODIFY COLUMN status ENUM('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED','PENDING_REVIEW','AUTO_APPROVED') NOT NULL DEFAULT 'DRAFT', ADD COLUMN client_company_id INT NULL AFTER vendor_id, ADD COLUMN currency CHAR(3) NULL AFTER client_company_id, ADD COLUMN submitted_at TIMESTAMP NULL, ADD COLUMN cancelled_at TIMESTAMP NULL;
