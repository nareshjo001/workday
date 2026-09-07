# Implementation

`033_invoice_documents.sql` adds per-vendor/year number sequences and finance
document fields to invoice headers. `invoice_items` keeps the authoritative
immutable billing amount and now snapshots display-safe contractor, skill, and
milestone labels.

On submission, the service locks the vendor/year sequence, assigns
`INV-YYYY-NNNNNN`, derives due date from terms when necessary, calculates
subtotal, tax, adjustment, and total in the database, stores a generated PDF,
and freezes the document reference in the same transaction. A rejected
invoice retains its assigned number during controlled revision/resubmission.

The sequence table has the composite primary key `(vendor_id, invoice_year)`.
Submission first creates that row if absent, then locks it with `FOR UPDATE`
before incrementing it. This makes allocation database-serialized rather than
an application-level check-then-write. The current format is
`INV-YYYY-NNNNNN`; each Vendor has its own annual sequence.

Financial math is calculated from persisted `invoice_items`: subtotal is the
sum of immutable billing amounts, tax is `ROUND(subtotal * tax_rate / 100, 2)`,
and total is `ROUND(subtotal + tax + adjustments, 2)`. Named adjustments are
validated DRAFT-only lines. Request totals, hours, rates, and amounts are
ignored as financial authority. Currency remains fixed by the invoice/billing
compatibility rules.

PDF download is scoped to the owning Vendor or the owning PM's project. Draft
documents can be regenerated; submitted and approved documents cannot be
changed through the API.

The storage service is deliberately abstracted behind `store` and `read`.
This implementation uses the existing local document store; deployment must
provide durable backed-up storage and an operational sweep for a file left
behind if external storage succeeds but the surrounding database transaction
later fails. M18 does not add tax-jurisdiction calculation, payment handling,
or accounting-system export.
