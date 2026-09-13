# Vendor Management System

VMS is a React, Node/Express, and MySQL modular monolith for contingent-workforce management: project staffing, contractor compliance, timesheets, milestones, invoicing, payments, analytics, and offboarding.

The initial MVP was developed during a two-day Workday hackathon. After the event, it was independently audited, hardened, redesigned, and expanded through M23. The complete final platform is not presented as two days of work and is not presented as a production customer deployment.

## Current workflow

1. A PM creates a client-scoped project and staffing requirements.
2. An authorized Vendor submits an eligible contractor candidate.
3. The PM accepts or rejects the candidate. Acceptance creates a date-valid assignment with immutable bill/cost rate snapshots.
4. Contractors submit daily timesheets; PMs approve or reject them.
5. Approved project hours meet milestones and create immutable billing contributions.
6. Vendors build invoice drafts from eligible contributions and submit them. PMs approve or reject submitted invoices.
7. Vendors record received payments. Approval status and settlement status remain distinct.
8. Vendors release contractors with traceable metadata; PM project completion runs a structured close-readiness check and preserves all historical financial records.

## Run a local demo with Docker

Prerequisite: Docker Desktop with Compose.

```powershell
Copy-Item .env.demo.example .env
# Replace the two placeholder secret values in .env.
docker compose build
docker compose up -d mysql
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm -e DEMO_SEED_ENABLED=true seed
docker compose up -d backend frontend
```

Open `http://localhost:8080`. Confirm readiness at `http://localhost:8080/api/health/ready`.

The demo seed is opt-in, constrained to `_demo`/`_restore` databases, and idempotent. Accounts and the workflow are documented in [M22 demo instructions](Expansion%20Doc/M22-Production-Deployment-Backup-Security-and-Demo-Environment/DEMO.md).

## Development and tests

Backend requires a MySQL database ending in `_test` when `NODE_ENV=test`.

```powershell
cd backend
npm ci
npm run test:coverage

cd ../frontend
npm ci
npm test
npm run lint
npm run build
```

Browser smoke against a running demo is `cd frontend; npm run test:e2e`.

## Safety properties

- Authenticated session/JWT identity is the only authority source.
- Vendor, PM, and Contractor data is role- and tenant-scoped; sensitive probes use established hidden-resource behavior.
- Critical mutations use transactions, row locks, conditional updates, database uniqueness, and transactional M04 audit records.
- Assignment rate snapshots, milestone billings, invoice items/documents, and payments remain historically immutable.
- Documents/PDFs use opaque UUID storage keys, MIME signature/size validation, and authorization before binary download.
- Migrations are ledgered with checksums and run explicitly, never on ordinary backend startup.

## Decision Intelligence

The expansion adds deterministic, role-safe decision support: Vendor historical Rate & Margin Intelligence, PM Project Control, Contractor Timesheet Intelligence, Automated Reminders, and role-safe Activity. These features expose verified findings and evidence while authorized people retain every business decision.

An optional, bounded generative-AI adapter can explain a PM Project Control finding only after the PM explicitly requests it. It has a deterministic fallback and is never decision authority: it cannot change calculations, severity, approvals, compliance outcomes, or financial recommendations.

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Database](DATABASE.md)
- [API](API.md)
- [Expansion roadmap](ROADMAP.md)
- [M22 deployment and operations](Expansion%20Doc/M22-Production-Deployment-Backup-Security-and-Demo-Environment/README.md)
- [M23 final audit, release, and interview artifacts](Expansion%20Doc/M23-Final-Architecture-Audit-Release-and-Internship-Story/README.md)
- [Expansion module records](Expansion%20Doc/)
