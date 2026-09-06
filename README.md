# Vendor Management System

VMS is a modular-monolith web application for managing a contingent workforce. It supports the working lifecycle:

PM creates project and staffing requirements -> Vendor provisions eligible contractors -> Vendor assigns contractors -> PM allocates hours -> Contractor logs daily time -> PM reviews time -> approved hours reach milestones -> immutable billing contributions and invoices are created -> Vendor reviews invoices -> PM completes the project and releases active assignments.

The project began as a two-day Workday hackathon MVP. The current codebase is more complete than the original hackathon brief and is the source of truth for present behaviour.

## Roles

- **Vendor**: provisions and manages its contractors, browses open projects, assigns eligible contractors, views and reviews its invoices.
- **Contractor**: manages a primary skill, sees assignment history, submits daily timesheets, and corrects rejected entries.
- **PM**: belongs to a client company, owns projects, defines requirements, allocates work hours, reviews time, manages milestones, sees invoice history, and completes projects.

## Architecture

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Frontend | React, Vite, React Router, Axios, Tailwind | Role-specific SPA screens and authenticated API calls. |
| Backend | Node.js, Express | Routes, JWT/RBAC, validation, services, repositories and error handling. |
| Database | MySQL/MariaDB via mysql2 | Transactional business data, locks, foreign keys and uniqueness constraints. |

The backend follows `route -> controller -> validator -> service -> repository`. SQL lives in repositories; services own business rules and transactions. See [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), and [API.md](API.md).

## Implemented workflow

1. Vendors and PMs self-register. Vendor-created contractors receive linked user and contractor records.
2. PMs create active projects with one or more skill/headcount requirements and a total expected-hours capacity.
3. Contractors set a primary skill. Vendors may choose only their own active, matching-skill contractors with no active assignment.
4. Vendor batch assignment is atomic. It does not allocate hours.
5. PM sets allocation per active assignment, subject to project capacity and approved-hours floors.
6. Contractor submits one daily time entry per project/date; only pending or approved time consumes allocation.
7. PM approves or rejects one pending daily entry. Only approved entries affect billing.
8. Project-level milestone thresholds trigger per-contractor immutable billing contributions. Each approved hour is billed once across milestones.
9. Each billing contribution can produce one immutable invoice. Vendor approves or rejects pending invoices; PM has read-only invoice history.
10. A PM explicitly completes a project; completion atomically releases active assignments while retaining all history.

## Setup

Prerequisites: Node.js 18+ and MySQL or MariaDB.

### Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run migrate
npm run dev
```

The API starts at `http://localhost:5000`; health is available at `GET /api/health`.

### Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

The development SPA normally runs at `http://localhost:5173`. Set `VITE_API_BASE_URL` if the API lives elsewhere.

### Configuration

Use the checked-in `.env.example` files as the configuration reference. Do not commit `.env` files or real database/JWT credentials. Backend configuration includes database connection values, JWT secret/lifetime, CORS origin, and a legacy invoice auto-approval threshold. New invoices currently start in `PENDING_REVIEW`; that threshold remains for compatibility and is not used by current invoice generation.

## Demo and regression data

`backend/seed_test_data.sql` is a legacy/sample SQL seed. The current executable regression scripts create their own test identities against a running local API/database:

- `backend/mvp_fix_test.js`: current broad regression suite for allocation ownership, billing, invoice workflow, concurrency and project completion.
- `backend/eligible_contractor_release_test.js`: focused reassignment eligibility regression.
- `backend/e2e_test.js`: retained historical test only; it is explicitly superseded and should not be run as the current regression suite.

These live-server scripts are not yet an `npm test` suite; that is roadmap module M01.

## Key safety properties

- The server derives actor identity from a verified JWT; request bodies do not decide vendor, PM, or contractor authority.
- Sensitive cross-tenant resource probes use the established identical-404 pattern.
- State-changing flows use transactions, `SELECT ... FOR UPDATE`, conditional updates, and database uniqueness constraints where races matter.
- Assignment, timesheet, milestone, billing, and invoice history is retained rather than deleted.
- Billing and invoice values are immutable snapshots and are not recomputed from later contractor rate changes.

## Documentation and roadmap

- [Architecture](ARCHITECTURE.md)
- [Database model](DATABASE.md)
- [API reference](API.md)
- [Changelog](CHANGELOG.md)
- [Expansion roadmap](ROADMAP.md)
- [Architecture decisions](adr/README.md)
- [Expansion module records](Expansion%20Doc/)

## Repository status

M00 documents the existing hackathon baseline. The repository owner manually created annotated tag `v1.0-hackathon` at verified commit `4bd5cd1`; the M00 documentation and tracker changes are ready for the owner-controlled final M00 commit. See [CHANGELOG.md](CHANGELOG.md).
