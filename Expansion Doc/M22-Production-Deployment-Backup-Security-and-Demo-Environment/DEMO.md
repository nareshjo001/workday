# Demo Environment

The opt-in seed creates these local-only accounts with password `DemoPassword!2026`:

| Role | Email |
| --- | --- |
| Vendor | `demo.vendor@workday.local` |
| PM | `demo.pm@workday.local` |
| Contractor | `demo.contractor@workday.local` |
| Candidate Contractor | `demo.candidate@workday.local` |

The seed is restricted to an explicitly named `_demo` or `_restore` database and `DEMO_SEED_ENABLED=true`. It is not a production default.

The browser smoke demonstrates Vendor candidate submission, PM acceptance, Contractor time submission, PM approval, Vendor draft/submission, PM invoice approval, and Vendor payment recording. The seeded project additionally shows accepted/rejected candidates, approved/rejected/submitted time, milestone billing, a frozen approved invoice, partial payment, and an overdue balance.
