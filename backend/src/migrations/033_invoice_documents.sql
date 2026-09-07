-- M18: finance-facing invoice document metadata.  Invoice items remain the
-- immutable source for subtotal; the header stores only derived totals and
-- the frozen PDF reference.
CREATE TABLE invoice_number_sequences (
  vendor_id INT NOT NULL,
  invoice_year SMALLINT NOT NULL,
  next_sequence INT NOT NULL DEFAULT 1,
  PRIMARY KEY (vendor_id, invoice_year),
  CONSTRAINT fk_invoice_number_sequence_vendor FOREIGN KEY (vendor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE invoice_adjustments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  description VARCHAR(200) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_invoice_adjustments_invoice (invoice_id),
  CONSTRAINT fk_invoice_adjustments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE invoices
  ADD COLUMN invoice_number VARCHAR(32) NULL AFTER id,
  ADD COLUMN invoice_date DATE NULL AFTER currency,
  ADD COLUMN due_date DATE NULL AFTER invoice_date,
  ADD COLUMN payment_terms_days SMALLINT UNSIGNED NOT NULL DEFAULT 30 AFTER due_date,
  ADD COLUMN tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER payment_terms_days,
  ADD COLUMN subtotal_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER amount,
  ADD COLUMN tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER subtotal_amount,
  ADD COLUMN adjustment_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER tax_amount,
  ADD COLUMN total_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER adjustment_amount,
  ADD COLUMN pdf_storage_key VARCHAR(128) NULL AFTER total_amount,
  ADD COLUMN pdf_size_bytes INT UNSIGNED NULL AFTER pdf_storage_key,
  ADD COLUMN pdf_generated_at TIMESTAMP NULL AFTER pdf_size_bytes,
  ADD COLUMN document_frozen_at TIMESTAMP NULL AFTER pdf_generated_at,
  ADD COLUMN document_version SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER document_frozen_at,
  ADD UNIQUE KEY uq_invoices_invoice_number (invoice_number),
  ADD INDEX idx_invoices_vendor_number (vendor_id, invoice_number);

ALTER TABLE invoice_items
  ADD COLUMN contractor_name_snapshot VARCHAR(200) NULL AFTER amount,
  ADD COLUMN skill_name_snapshot VARCHAR(100) NULL AFTER contractor_name_snapshot,
  ADD COLUMN milestone_name_snapshot VARCHAR(150) NULL AFTER skill_name_snapshot,
  ADD COLUMN billing_period_label VARCHAR(100) NULL AFTER milestone_name_snapshot;
