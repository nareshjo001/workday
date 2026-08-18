# Vendor Management System (VMS) — Module 1: Authentication & User Management

Vendor-centric contingent workforce & timesheet tracking platform. This module implements the
authentication foundation (signup, login, JWT, RBAC, protected routes) for the three MVP roles:
`VENDOR`, `CONTRACTOR`, `PM`.

## Project layout

```
vms/
├── backend/     Node.js + Express + MySQL API
└── frontend/    React (Vite) + Tailwind CSS SPA
```

## Prerequisites

- Node.js 18+
- A MySQL (or MySQL-compatible, e.g. MariaDB) server

## Backend setup

```bash
cd backend
npm install
cp .env.example .env   # then edit DB_* and JWT_SECRET
npm run migrate        # creates the users table
npm run dev             # http://localhost:5000
```

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_BASE_URL if the backend isn't on localhost:5000
npm run dev              # http://localhost:5173
```

## Environment variables

Backend (`backend/.env`):

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 5000) |
| `CLIENT_ORIGIN` | Allowed CORS origin for the frontend |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `JWT_SECRET` | Secret used to sign/verify JWTs — required, never commit a real value |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `1d`) |

Frontend (`frontend/.env`):

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API |

See each package's `README`/inline docs for further detail. Full delivery notes for Module 1 are
in the summary provided alongside this repository.
