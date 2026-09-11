# M26 — Vendor Rate Intelligence Workflow & UI

## Objective and integration point

M26 makes the deterministic M25 Vendor Rate Intelligence analysis available in the existing Vendor **Source Candidates for Projects** flow. The integration point is the existing `AssignContractorModal`, after a Vendor has chosen a project requirement and selected an eligible contractor.

Before M26, this modal collected candidate selection and proposed assignment dates, then used the normal candidate-submission endpoint. There was no persisted Vendor bill-rate field at this point. Rate-card values are selected only later when the PM accepts a candidate and an immutable assignment snapshot is created.

M26 adds a single advisory **Proposed bill rate** field in that modal. It is deliberately not added to the candidate-submission request: M26 must not rewrite the rate-card, candidate, or assignment lifecycle. The field exists solely as the proposed-rate input to M25. A Vendor may use the normal submission action regardless of whether they analyze a rate.

## Workflow

1. The frontend discovers capabilities through `GET /api/intelligence/capabilities`.
2. It shows the panel only when the authenticated Vendor's `vendor_rate_intelligence` capability is true.
3. A Vendor selects exactly one contractor, enters a proposed bill rate, and explicitly selects **Analyze rate**.
4. The client sends only `contractorId`, `projectId`, `requirementId`, and `proposedBillRate` to `POST /api/vendor/rate-intelligence/analyze`.
5. M25 remains authoritative for cost, currency, rate-card context, comparable history, statistics, margin, recommendation, and M24 findings. The frontend formats and displays those server values; it does not calculate them.

The existing modal supports batch candidate submission. Rate analysis is intentionally available only with one selected contractor, because a rate recommendation is contractor-specific. Batch submission itself remains unchanged.

## States and stale handling

The panel supports unavailable (not rendered), incomplete context, idle, loading, available, insufficient-data, error, and stale result states. It makes no request on each keystroke. Any project, requirement, selected-contractor, or proposed-rate change immediately discards the prior response and shows a stale message; no previous margin, finding, comparable, or recommendation remains visible for different commercial context. Selecting **Use suggested rate** copies the server-provided value into the existing proposed-rate input and invalidates the analysis. It never submits a candidate or persists a rate.

`INSUFFICIENT_DATA` is a normal result. The panel shows the comparable count, minimum sample of three, contractor cost, applicable rate-card context when present, and proposed-rate margin. It does not show a suggested rate. `AVAILABLE` displays P25, median, P75, suggested rate, margin, and structured M24 findings. The UI uses only “Internal comparable history” and related internal-commercial terminology; it makes no market-rate claim.

## Findings and failures

M24 findings display severity text, title, summary, selected safe evidence, and recommended action. `PROPOSED_RATE_BELOW_COST` receives a prominent textual warning as well as its HIGH severity label. Color is not the sole severity signal.

Malformed M25 responses are rejected by the frontend service before rendering. Network, disabled-feature, validation, or temporary server failures show a non-blocking message: the Vendor can continue the normal candidate-sourcing workflow. No analysis result, prompt, or response is persisted.

## Rate-card and audit boundaries

Rate-card information is labelled as existing commercial configuration. It is not represented as a recommendation and using a suggested rate does not alter it. M26 does not create audit events for capability checks, opening the panel, analyses, fallback text, or temporary input changes. If a later commercial persistence action can reliably associate a saved rate with an accepted suggestion, that action should use the existing audit service; M26 intentionally defers that event.

## Accessibility and responsive behavior

The input has a visible label; both actions are native keyboard-accessible buttons. Loading uses status semantics, failures use the existing alert semantics, and severity includes explicit text. The panel uses responsive grid-to-stack layouts, `min-w-0`, wrapping containers, and full-width inputs so it remains usable at mobile through widescreen sizes without introducing a new UI library.

## Files changed

- `frontend/src/components/projects/AssignContractorModal.jsx`
- `frontend/src/components/projects/VendorRateIntelligencePanel.jsx`
- `frontend/src/services/vendorRateIntelligenceService.js`
- focused tests for the modal, panel, and service

## Tests

Focused tests cover capability-off invisibility/no analysis call, capability-on request payload, incomplete input, insufficient-data presentation, available recommendation presentation, suggested-rate copying, below-cost severity, failure messaging, and malformed response rejection. Full frontend tests, lint, build, backend regression, and `git diff --check` are run as completion verification.

## Limitations and explicit non-goals

The proposed rate is advisory until a future, explicitly approved commercial persistence point exists; M26 does not add a database field or change the PM acceptance snapshot mechanism. There is no external AI, chat, automatic rate save, automatic candidate submission, rate-card rewriting, market data, PM/Contractor intelligence, reminders, or M27 work.
