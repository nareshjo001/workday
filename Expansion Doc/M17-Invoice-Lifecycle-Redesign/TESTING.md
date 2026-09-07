# Testing

Regression coverage verifies that billings no longer auto-create invoices and exercises Vendor billing queue, DRAFT, submission, PM approval, and PM rejection. Audit coverage verifies the explicit approved/rejected lifecycle events. Existing milestone tests retain exactly-once immutable billing coverage.
