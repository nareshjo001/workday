# Implementation

Milestone billings are now the eligible billing queue. A Vendor creates a DRAFT from an eligible immutable billing snapshot, can add or remove compatible items, then submits it. PM review is limited to SUBMITTED invoices and uses transactional row locking. Invoice totals are derived only from invoice items. Invoice items have a unique milestone-billing constraint so contributions cannot be claimed twice.

Legacy auto-generated invoice records remain preserved with their historical statuses; no old record is reinterpreted as a PM approval.
