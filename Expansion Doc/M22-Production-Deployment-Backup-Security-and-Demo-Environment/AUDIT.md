# M22 Audit

## Findings fixed

1. **One-shot startup race:** Compose could report MySQL healthy immediately before it accepted TCP connections, causing migration/seed failure. The explicit migration and seed tools now use the existing bounded DB retry configuration.
2. **Incomplete demo invoice document:** the seeded approved invoice bypassed lifecycle submission and therefore had no PDF snapshot. The deterministic seed now stores the same server-generated frozen PDF metadata and content.
3. **Local artifacts tracked as untracked files:** backups and Playwright output are ignored.
4. **Backend dependency advisory:** `npm audit fix` safely updated body-parser's nested qs dependency. Backend audit has no high/critical result.

## Security and operational review

| Area | Result |
| --- | --- |
| Container boundary | Backend runs as non-root; images exclude development environment files through Docker ignore rules. |
| Secrets | `.env*` is ignored except examples; tracked-file scanner found no high-confidence keys or private keys. |
| HTTP | Helmet, CORS allowlist, JSON size limit, auth rate limit, and safe error responses are active. |
| Auth | Short-lived JWT plus session validation/rotation/revocation remains the authority model; no demo bypass exists. |
| Storage | UUID-only keys, MIME signature checks, byte limit, path traversal validation, volume persistence, and invoice ownership checks are present. |
| Tenancy | Role routers plus SQL-scoped services retain 403 for wrong-role routes and tenant-hidden 404s for scoped resources. |
| Logging | JSON request logs preserve request IDs and redact sensitive fields. |
| Migration recovery | Ledger/checksum protection prevents accidental replay. Operators back up before baseline/risky migration and restore or forward-fix after failure. |

## Accepted limitation

Frontend `react-router-dom` retains two moderate advisories. The available remediation is a breaking v7 migration, outside M22 deployment hardening. It requires a separately scoped compatibility upgrade and must not be applied blindly. No high/critical dependency finding remains.
