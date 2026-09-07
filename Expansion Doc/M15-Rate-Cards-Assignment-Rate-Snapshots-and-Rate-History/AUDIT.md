# Audit

Rate cards use tenant-hiding active-relationship checks and transaction-scoped locked overlap/resolution reads. Assignment snapshots are write-once at acceptance; used cards are immutable, and milestone billing reads snapshots for new work without rewriting existing billing rows. Cost rate remains restricted to Vendor rate-card management; PM receives only the agreed bill rate. The unique rate-card lookup index and requirement/assignment locks preserve acceptance concurrency guarantees. No M15 audit finding remains open.
