# Testing Evidence

Host-assisted Docker verification used an isolated `vms-m22-verify` Compose project and `vms_m22_demo` database.

| Check | Result |
| --- | --- |
| Compose config and backend/frontend image builds | Passed |
| Fresh MySQL, explicit migrations | 36 migrations applied |
| Migration replay | `applied: 0`; 36 distinct files and checksums |
| Seed and rerun | Created deterministic data, then `already_seeded` |
| Demo data | Vendor, PM, two Contractors, project, assignment, APPROVED/REJECTED/SUBMITTED time, approved $960 invoice, $400 payment, frozen 1,058-byte PDF |
| Backend/frontend health and SPA fallback | Passed |
| Playwright lifecycle | 1 passed: candidate acceptance, time approval, invoice approval, payment recording |
| Backup/restore | Non-empty 124,182-byte SQL backup restored to `vms_m22_restore`; 36-ledger, users, project, assignments, approved timesheets, invoice/PDF, and payment verified; restored app became ready and PM login returned one project |
| Storage restart | 5 files before/after backend restart; PDF 1,058 bytes before/after; authorized document list retained; PM received 403 on Vendor PDF route |
| Secret scan | Clean tracked-file scan |
| Dependency audit | No high/critical findings. Backend safe update remediated qs/body-parser moderate findings. Frontend retains two moderate React Router advisories requiring a breaking v7 upgrade. |
| Performance smoke | 5 requests at concurrency 3: all four checks 100% success. P95: contractor list 101 ms, dashboard 152 ms, candidate queue 117 ms, pending-time queue 109 ms. |
| Backend `npm run test:coverage` | Passed, coverage gates passed |
| Frontend test/lint/build | Passed |
| `git diff --check` | Passed; line-ending notices only |

Concurrency-sensitive assignment, candidate decision, invoice-number allocation, and approval paths remain covered by the existing M12/M17/M18 integration suite run through backend coverage.
