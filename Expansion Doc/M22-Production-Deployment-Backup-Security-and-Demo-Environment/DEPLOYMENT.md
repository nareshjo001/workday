# Local Deployment Runbook

## Prerequisites

Docker Desktop with Compose, and a copied `.env` based on `.env.demo.example`. Set a private `MYSQL_ROOT_PASSWORD` and a strong `JWT_SECRET`; never commit that file.

## Start a clean demo

```powershell
docker compose build
docker compose up -d mysql
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm -e DEMO_SEED_ENABLED=true seed
docker compose up -d backend frontend
```

Open `http://localhost:8080`; readiness is `http://localhost:8080/api/health/ready`. Migrations are intentionally not run at backend startup.

## Operational checks

```powershell
docker compose ps
docker compose logs backend
docker compose --profile tools run --rm migrate
```

The final migration command must report zero new migrations on a replay. Container logs are JSON on stdout/stderr and include request IDs without secrets.

## Production notes

Terminate HTTPS before the frontend/API so production Secure refresh cookies work. Supply a strict public `CLIENT_ORIGIN`, a unique strong JWT secret, persistent MySQL and document storage, and a backup before schema changes. Provider selection stays outside domain code.
