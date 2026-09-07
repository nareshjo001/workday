# M18 — Invoice Numbers, Line Items, Tax & PDF Document

M18 turns an M17 invoice draft into a finance-facing document. Vendor-created
drafts receive a human-readable number on first submission, expose immutable
line-item snapshots, calculate tax and adjustments server-side, and provide a
role-authorized PDF download.

M18 deliberately does not introduce payments, accounting-suite sync, tax
filing, or invoice PDF email delivery. Payment status remains M19 scope.

An invoice number is allocated only when a non-empty draft is submitted. The
number is permanent, including across a rejected-draft revision. Amounts are
commercial snapshots from M16 billing contributions; later rate-card or
assignment changes cannot alter the invoice or its PDF.
