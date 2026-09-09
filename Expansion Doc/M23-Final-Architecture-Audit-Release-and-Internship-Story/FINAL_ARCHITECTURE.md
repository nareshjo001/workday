# Final Architecture

## Runtime architecture

```mermaid
flowchart TB
  B[Browser] --> R[React + Vite SPA]
  R -->|JSON / PDF / CSV| E[Express API]
  E --> A[Authentication, sessions, RBAC]
  E --> D[Domain services]
  D --> Q[Repositories / parameterized SQL]
  D --> U[Transactional audit]
  D -. post-commit .-> N[In-app notifications]
  D --> S[Storage abstraction]
  S --> F[(Persistent documents / invoice PDFs)]
  Q --> M[(MySQL 8)]
  C[CI + Playwright] --> R
  C --> E
  X[Docker Compose] -. runs .-> R
  X -. runs .-> E
  X -. runs .-> M
```

Routes authenticate and select role surfaces; controllers validate transport input; services own domain rules and transactions; repositories own SQL. React is never an authorization boundary. Audit writes for critical mutations occur inside the business transaction; notification delivery occurs after commit and is failure-isolated.

## Final ERD (principal entities)

```mermaid
erDiagram
  users ||--o{ auth_sessions : has
  users ||--o{ auth_action_tokens : receives
  client_companies ||--o{ project_managers : contains
  users ||--o| project_managers : represents
  users ||--o| contractors : represents
  users ||--o{ client_vendor_relationships : vendor
  client_companies ||--o{ client_vendor_relationships : client
  project_managers ||--o{ projects : owns
  projects ||--o{ project_requirements : defines
  skills ||--o{ project_requirements : requires
  contractors ||--o{ contractor_skills : has
  skills ||--o{ contractor_skills : classifies
  contractors ||--o{ contractor_documents : supplies
  projects ||--o{ project_vendors : grants
  users ||--o{ project_vendors : vendor
  project_requirements ||--o{ candidate_submissions : receives
  contractors ||--o{ candidate_submissions : candidate
  projects ||--o{ project_assignments : staffs
  contractors ||--o{ project_assignments : assigned
  project_assignments ||--o{ timesheets : supports
  projects ||--o{ milestones : tracks
  milestones ||--o{ milestone_billings : produces
  contractors ||--o{ milestone_billings : contributes
  client_companies ||--o{ rate_cards : prices
  users ||--o{ rate_cards : vendor
  skills ||--o{ rate_cards : skill
  rate_cards ||--o{ project_assignments : snapshots
  projects ||--o{ invoices : billed
  invoices ||--o{ invoice_items : contains
  milestone_billings ||--o| invoice_items : claimed_once
  invoices ||--o{ invoice_adjustments : adjusts
  invoices ||--o{ payments : settles
  users ||--o{ notifications : receives
  users ||--o{ notification_preferences : configures
  users ||--o{ audit_log : acts
```

`schema_migrations` is a standalone operational ledger keyed by migration filename and checksum; it has no fictional self-relationship. The diagram intentionally omits some support columns while naming only tables present in migrations `001`–`037`.

## Business workflow

```mermaid
flowchart LR
  P[PM project + requirement] --> V[Vendor sourcing]
  V --> C[Candidate submitted]
  C --> A[PM accepts]
  A --> AS[Assignment + rate snapshot]
  AS --> T[Contractor timesheet]
  T --> AW[PM-approved work]
  AW --> MB[Milestone met: billable eligibility]
  MB --> ID[Vendor invoice draft]
  ID --> IS[Submitted invoice]
  IS --> IA[PM-approved invoice]
  IA --> PAY[Payment recorded]
  PAY --> REP[Paid / outstanding reporting]
  REP --> OFF[Release + project-close safeguards]
```

Approved work, billable eligibility, invoiced value, approved invoice value, paid value, and outstanding value are separate states.

## Concurrency and lock order

| Path | Primary lock/order | Database backstop | Race outcome |
| --- | --- | --- | --- |
| Candidate acceptance | submission → requirement/project/contractor scope | unique active assignment + capacity checks | one acceptance/assignment wins |
| Assignment dates/capacity | relevant project/requirement then assignments | overlap/capacity constraints and conditional mutation | conflicting assignment rejected |
| Timesheet review | timesheet row | conditional `SUBMITTED` transition | one review wins |
| Milestone evaluation | project/milestone contribution scope | unique milestone/contractor contribution | no double billing |
| Invoice item claim | invoice then milestone billing | unique `milestone_billing_id` | one draft claims contribution |
| Invoice number/review | invoice/sequence rows | unique number + conditional status | unique number; one review wins |
| Payment | invoice then payment sum | transaction and exact decimal validation | concurrent overpayment rejected |
| Release/project close | project/assignment then readiness dependencies | conditional statuses + transactional audit | stale readiness cannot authorize close |

Services consistently start from parent/business ownership rows before child mutations, reducing inconsistent lock-order risk.
