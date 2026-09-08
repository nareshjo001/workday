# M22 — Production Deployment, Backup, Security & Demo Environment

M22 makes the VMS reproducible outside a developer workstation. Docker Compose runs MySQL, the Express API, and the React SPA; migrations and demo seeding remain deliberate one-shot operations.

## Quick demo

1. Copy `.env.demo.example` to `.env` and replace both placeholder secrets.
2. Run `docker compose build` and `docker compose up -d mysql`.
3. Run `docker compose --profile tools run --rm migrate`.
4. Run `docker compose --profile tools run --rm -e DEMO_SEED_ENABLED=true seed`.
5. Run `docker compose up -d backend frontend`, then open `http://localhost:8080`.

See [DEPLOYMENT.md](DEPLOYMENT.md), [DEMO.md](DEMO.md), and [BACKUP_RESTORE.md](BACKUP_RESTORE.md).

## Scope boundary

This module adds operational hardening only. It does not introduce cloud-provider coupling, Kubernetes, microservices, a payment gateway, or M23 release work.
