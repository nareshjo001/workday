-- M19: append-only settlement ledger. Approval remains on invoices.status;
-- payment state is derived from these rows and the immutable invoice total.
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  paid_at DATETIME NOT NULL,
  reference VARCHAR(120) NULL,
  method VARCHAR(60) NULL,
  notes VARCHAR(500) NULL,
  recorded_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payments_invoice_paid_at (invoice_id, paid_at),
  CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_payments_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
