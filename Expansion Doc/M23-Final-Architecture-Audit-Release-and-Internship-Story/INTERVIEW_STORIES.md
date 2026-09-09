# Interview Narrative and Engineering Stories

## 20-second summary

The initial Vendor Management System MVP was built during a two-day Workday hackathon. After the event, I independently audited and expanded it into a fuller React, Express, and MySQL system with tenant-safe workflows, transaction and concurrency protection, immutable financial snapshots, invoicing/payments, reporting, testing, and Docker-based reproducibility.

## 60-second explanation

The product coordinates three roles: Vendors source contractors, client PMs own staffing and financial approvals, and Contractors submit work. The hackathon version proved the basic idea. My post-event work focused on the engineering gaps that appear when the workflow becomes real: verified client membership, candidate submission instead of direct assignment, date/capacity and compliance rechecks, approved-only milestone billing, Vendor-created invoices with PM approval, payment settlement separated from approval, and safe offboarding. I backed those flows with server-side RBAC and tenant predicates, transactional audit events, immutable rate and billing snapshots, row locking and uniqueness constraints, role-specific dashboards, a deterministic Docker demo, Playwright, and backup/restore checks.

## 2–3 minute technical explanation

I retained a modular monolith because the problem benefits from one transactional boundary more than it benefits from distributed services. Each request flows through a role-gated route and validator into a domain service; services own transactions and repositories own parameterized SQL. Identity always comes from the authenticated session/JWT.

The most important design choice is the financial snapshot chain. A rate card is commercial configuration, so assignment acceptance copies bill rate, cost rate, and currency. Approved hours create an immutable milestone contribution, invoice items copy that contribution, and the submitted PDF is frozen. Later rate/profile/offboarding changes cannot rewrite the past. Payments are append-only and derive paid/outstanding state separately from approval.

For races, I combine row locks, conditional status transitions, deterministic lock order, and database uniqueness. Examples include candidate acceptance against capacity, one invoice number under concurrent submission, one claim per milestone billing, and payment locking so two simultaneous payments cannot overpay. The final automated reconciliation proves the full quantities-and-money chain and the authorization test probes wrong-role and cross-tenant access.

## Story 1 — Concurrency and locking

**Risk:** two PM actions could accept candidates past capacity, two submissions could allocate one invoice number, or two payments could each see the same outstanding amount.

**Design:** lock the owning business row first, re-read state inside the transaction, use a conditional transition, and retain a unique constraint where an invariant has a natural key. Only the winning mutation commits; the loser receives a stable conflict.

**Lesson:** application prechecks improve messages, but database-enforced serialization/backstops establish correctness.

## Story 2 — Immutable financial snapshots

**Risk:** editing a live rate card would silently change historical revenue or a submitted invoice.

**Design:** rate card → assignment snapshot → milestone billing snapshot → invoice item → frozen PDF. Every downstream stage copies authoritative exact-decimal values and currency. Tests mutate future rates and contractor/project status and compare the historical chain byte-for-byte/value-for-value.

**Lesson:** configuration answers “what applies now”; a financial record must answer “what was agreed then.”

## Story 3 — Workflow redesign

**Risk:** direct assignment and automatic invoices collapsed decisions owned by different companies.

**Design:** Vendor submit → PM accept → assignment, and milestone eligibility → Vendor draft/submit → PM approve/reject → Vendor records settlement.

**Lesson:** lifecycle states are not ceremony; they encode ownership, authorization, auditability, and race-safe transition points.

## Resume bullets

- Built and independently expanded a role-based Vendor Management System spanning client projects, contractor sourcing, candidate approval, assignments, timesheets, milestones, invoicing, payments, analytics, and offboarding using React, Express, and MySQL.
- Designed transaction-safe workflows with row locks, conditional updates, uniqueness constraints, and transactional audit records for staffing capacity, invoice numbering/review, exactly-once billing, and overpayment prevention.
- Implemented immutable commercial snapshots from rate card through assignment, milestone billing, invoice line item, and frozen PDF so later operational/rate changes cannot rewrite financial history.
- Hardened delivery with tenant-isolation regressions, full-stack Playwright smoke coverage, checksum-ledgered migrations, deterministic Docker demo data, CSV safety, dependency/secret checks, and tested backup/restore procedures.
