# API

- `POST /api/vendor/rate-cards` creates a relationship-scoped rate card.
- `PATCH /api/vendor/rate-cards/:id` updates an unused card; used cards return a conflict so financial history stays immutable.
- `GET /api/vendor/clients/:companyId/rate-cards` lists the authenticated Vendor’s cards for an active client relationship.
- `GET /api/vendor/rate-card-skills` returns the active skill choices for the Vendor rate-card form.

Cost rates are Vendor-only; PM/contractor views do not expose them.
