# M09 — Client Management, Vendor Relationships & Project Visibility

M09 replaces globally visible vendor staffing demand with explicit client-vendor relationships and project-level sourcing access. It also prevents a PM from self-claiming an existing client company: only the first PM can bootstrap a new company, while additional PMs require a one-time invitation.

PMs select registered Vendors and their own active projects from the application instead of entering internal IDs. They can connect or revoke a Vendor; revocation removes future sourcing access while retaining assignment history. Vendors have a scoped Clients directory with contacts, active projects, open requirements, deployed-contractor totals, and a detail view. Invoice and payment summaries are intentionally absent because they are not yet available in the product.

Unauthorized Vendor project and client probes return 404 to avoid confirming another tenant's data.
