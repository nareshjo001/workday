# VMS Database Model

MySQL 8 stores the VMS in forward-only migrations `001` through `037`. `schema_migrations` records every applied filename and SHA-256 checksum; existing databases without that ledger require verified backup and explicit baseline rather than historical replay.

| Area | Core tables | Integrity model |
| --- | --- | --- |
| Identity and tenancy | `users`, sessions/tokens, `client_companies`, `project_managers`, vendor relationships | Role identity and company/project scope |
| Workforce | `contractors`, skills, availability, documents, candidate submissions, assignments | Active/date overlap and tenant constraints |
| Work | `timesheets`, `milestones`, `milestone_billings` | Approved-hours-only, immutable billing contributions |
| Commercial | `rate_cards`, invoices, invoice items/adjustments/sequences, payments | Rate/item snapshots, invoice uniqueness, exact decimal amounts |
| Operations | `notifications`, preferences, `audit_log`, migration ledger | User-owned notifications, transactional audit, replay protection |

`project_assignments` retain release metadata and historical bill/cost snapshots. `invoices` retain lifecycle, calculated totals, PDF storage metadata, and payment status derives from append-only `payments`; invoice approval is separate from settlement. Documents and PDFs are persisted outside MySQL under configured storage keys, so production backup requires both database dump and storage volume backup.

See [M22 backup and restore](Expansion%20Doc/M22-Production-Deployment-Backup-Security-and-Demo-Environment/BACKUP_RESTORE.md) for operational recovery.

See the [final M23 ERD](Expansion%20Doc/M23-Final-Architecture-Audit-Release-and-Internship-Story/FINAL_ARCHITECTURE.md) for the implemented principal relationships and uniqueness invariants.
