# M25 — Vendor Rate & Margin Intelligence Engine

## Objective and boundary

M25 provides a read-only, deterministic Vendor analysis endpoint: `POST /api/vendor/rate-intelligence/analyze`. It helps a Vendor compare a proposed bill rate with its own historical commercial records. It is **not** external market-rate, industry-rate, or predictive intelligence. M26 owns any visible rate-setting workflow integration.

## Trusted sources

- The authenticated Vendor is `req.user.userId` only.
- Contractor ownership and default cost basis come from `contractors.vendor_id` and `contractors.hourly_rate`.
- An applicable active Vendor/client/skill rate card is the same source used when creating an assignment snapshot; its `cost_rate` becomes the current authoritative cost basis when it applies.
- Requirement skill comes from `project_requirements.skill_id`; project/client from `projects -> project_managers.company_id`.
- Historical observations are immutable `project_assignments.bill_rate_snapshot`, limited to the same Vendor-owned contractor history, requirement skill, and currency. Assignment rows exist only after PM acceptance, never from rejected proposals.

## Comparables and statistics

The engine first uses `VENDOR_SKILL_CLIENT` (same Vendor, skill, client), then safely broadens to `VENDOR_SKILL_CURRENCY` (same Vendor, skill, currency across that Vendor's clients). It never crosses Vendor, skill, or currency boundaries. `MIN_COMPARABLE_SAMPLE` is 3. Current analysis authorization is checked separately through the current project's active Vendor access. A legitimately created, Vendor-owned immutable historical assignment remains comparable evidence after that historical Client relationship or project access is revoked; this does not restore access or permit new work for the revoked Client.

For adequate samples it returns minimum, P25, median, P75, and maximum. Percentiles use sorted linear interpolation at `(n - 1) * p`; P25/P50/P75 therefore work deterministically for odd and even samples. The utility rejects non-finite inputs and sorts a copy, never the caller's array. The historical comparable band is P25–P75 and the suggested rate is the median. Returned monetary values are rounded to two decimal places, matching existing commercial display semantics.

No current VMS rate-card field represents a hard min/max rate constraint. An applicable rate card is returned as transparent commercial context only; it never changes historical statistics or fabricates a constraint.

## Cost, margin, currency, and findings

For a supplied proposed bill rate, margin per hour is `proposed bill rate - authoritative cost rate`; percentage is `margin / proposed bill rate * 100`, matching dashboard commercial margin semantics. Currency is server-derived from the matching rate card or project. Conflicting or missing currency returns a normal 409; no FX conversion occurs.

M24 findings are generated deterministically with engine `vendor_rate_intelligence`, version `1`: insufficient-data (INFO), within range (INFO), outside range (MEDIUM), and below cost (HIGH). Evidence contains only explicit rate/count values.

## Security and feature flag

The endpoint is inside the existing Vendor JWT/RBAC router. It rejects disabled use with the project 404 envelope, preserves 403 for PM/Contractor routes, verifies project visibility through `project_vendors`, scopes contractor lookup by Vendor, and accepts no vendor, role, user, cost, currency, or benchmark input. It is read-only, writes no audit event, and persists no recommendation.

`INTELLIGENCE_VENDOR_RATE_ENABLED` defaults to `false`. Only when enabled can a Vendor access analysis; capability discovery uses the same M24 flag.

## API response and implementation files

The request accepts only `contractorId`, `projectId`, `requirementId`, and optional `proposedBillRate`. The response contains contract version, safe contractor/project/requirement context, currency, authoritative cost, optional proposed-rate margin, comparable statistics, transparent applicable-rate-card context, recommendation, and M24 findings. No raw rows, Vendor IDs, SQL details, or another Vendor's commercial values are returned.

Primary implementation files are `vendorRateIntelligenceRepository.js`, `vendorRateIntelligenceService.js`, `vendorRateIntelligenceController.js`, `vendorRateIntelligenceValidators.js`, `percentiles.js`, and `m25-vendor-rate-intelligence.test.js`. No database migration is required or added.

Analysis is intentionally not audited: it is a preview only. A later M26 user action that applies a suggested rate may create a normal transactional audit event.

## Manual demo readiness

The deterministic `vms_demo` seed supports the insufficient-data path but does not currently contain three same-Vendor, same-skill, same-currency assignment snapshots for any active analysis requirement. A safe manual check is: enable `INTELLIGENCE_VENDOR_RATE_ENABLED`, sign in as `demo.vendor@workday.local`, and analyze the Vendor-owned active BACKEND contractor/project requirement created by the demo seed; expect `INSUFFICIENT_DATA` unless additional legitimate history already exists in that environment. The focused M25 integration test is the deterministic available-recommendation demonstration. The demo seed was not changed for M25.

## Limitations

Recommendations use internal Vendor history only, require three observations, perform no FX conversion, predict no market change, make no Client-acceptance guarantee, and never negotiate or change a workflow. The Vendor remains responsible for the commercial decision. No AI provider, ML model, persistence, migration, M26 UI, or later intelligence module is included.
