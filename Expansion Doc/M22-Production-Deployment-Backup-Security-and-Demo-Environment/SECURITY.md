# Security Review

## Authorization matrix

| Resource | Vendor | PM | Contractor | Cross-tenant |
| --- | --- | --- | --- | --- |
| Contractors/documents | Own organization only | Assigned-project compliance summary only | Own profile only | Hidden or denied |
| Projects/candidates/assignments | Authorized vendor-project relationships | Own client projects | Own assignments | Hidden or denied |
| Timesheets | Related project visibility only | Own-project review | Own entries | Hidden or denied |
| Milestones/billings | Authorized commercial visibility | Own projects | No commercial access | Hidden or denied |
| Invoices/PDFs/payments | Own vendor invoices | Own client-project invoices | No access | Hidden or denied |
| Dashboards/exports/history | Own organization | Own client scope; no Vendor cost/margin | Self scope; no commercial revenue/margin | Hidden or denied |

All actor identity comes from the validated session/JWT. Frontend identifiers are never authorization authority. The post-restart test verified Vendor invoice PDF access and a PM token received `403` on the Vendor route.

## Controls

- Helmet security headers, explicit CORS origins, 8 MB JSON limit, and login rate limits.
- Production requires a 32-character non-placeholder JWT secret and a non-wildcard client origin.
- Refresh cookies are HTTP-only, SameSite Lax, and Secure in production.
- Uploads accept only PDF/PNG/JPEG signatures, enforce `UPLOAD_MAX_BYTES`, and store opaque UUID keys outside public static serving.
- Invoice PDF reads verify ownership before content is sent.
- Structured logs redact passwords, tokens, cookies, secrets, documents, and attachments.

Run `./scripts/secret-scan.ps1` for the repeatable tracked-file scan. Run `npm audit --audit-level=high` in both application workspaces for dependency review.
