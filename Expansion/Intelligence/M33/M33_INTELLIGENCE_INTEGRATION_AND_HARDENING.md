# M33 — Intelligence Integration & Hardening

## Objective and scope

M33 hardens the completed Decision Intelligence modules and adds one bounded, optional generative-AI capability: a PM may explicitly request a plain-language explanation of a current PM Project Control finding. Vendor Rate & Margin Intelligence, Contractor Timesheet Intelligence, reminders, and Activity remain deterministic-only.

The VMS uses deterministic, auditable business rules for operational and financial decisions. A bounded generative-AI layer can optionally explain verified findings in natural language, but cannot modify calculations, severity, approvals, compliance outcomes, or financial recommendations.

## Architecture

Trusted VMS data is evaluated by M27 first. `POST /api/pm/projects/:projectId/control-intelligence/:findingCode/explanation` then recomputes that PM's current Project Control result under the authenticated identity and resolves the requested code from it. The browser sends no prompt, finding, role, PM id, cost, margin, or provider configuration.

The deterministic M24 finding remains visible and authoritative: code, severity, title, summary, evidence, recommended action, source, and server order never change. The endpoint returns an ephemeral `{ explanation, source }` response where `source` is `AI` or `DETERMINISTIC`.

## Provider and safety boundary

`aiExplanationProvider` is an adapter, not a decision engine. It sends only a deliberately selected finding view: title, severity, deterministic summary, safe evidence labels/primitive values/units, and recommended action. It excludes authentication material, raw database rows, audit metadata, tenant identifiers, Vendor cost/margin, and all client-authored text.

The instruction treats finding data as untrusted content rather than instructions. It permits a concise explanation only and prohibits new facts, calculations, decisions, predictions, market claims, changed severity/action, or hidden reasoning. Provider output must be non-empty plain text no longer than 600 characters. No raw provider response is logged or persisted.

Environment configuration is server-only:

- `INTELLIGENCE_AI_EXPLANATIONS_ENABLED=false` by default
- `AI_PROVIDER=openai`
- `AI_MODEL=gpt-4o-mini`
- `AI_API_KEY=` (never committed or sent to the frontend)
- `AI_TIMEOUT_MS=5000`

When the feature is disabled, no provider call is made. When the key is absent, the provider fails, returns malformed text, or times out, M33 returns the deterministic M27 summary with `source: "DETERMINISTIC"`. There is no retry loop. The endpoint is PM-only, keeps M27's project-ownership/404 behavior, and is limited to 10 authenticated explanation requests per PM per minute. Structured operational events record request/success/fallback reasons only; they never include keys, prompts, raw provider responses, or business audit records.

## PM experience

`PMProjectControlPanel` shows **Explain with AI** beside each current M27 finding only when the M24 `ai_explanations` capability is true. It is never called on render, refresh, project selection, finding load, or navigation. While the explicit request runs, only that button is disabled and the deterministic card remains available.

An AI response is labelled **AI explanation**. A fallback is labelled **System fallback explanation**. Both include: “Generated from the verified system finding. The underlying finding and action remain system-determined.” Unexpected browser/network failures are non-blocking and leave the original finding/action visible for retry.

Refreshing Project Control or changing projects clears all displayed explanation state immediately; M33 never re-generates it. Native buttons, status/alert roles, visible text labels, wrapped evidence/explanation text, and responsive flex/grid layout keep the addition usable from 360px through desktop widths.

## Authorization, auditing, and persistence

The PM route is protected by the existing JWT authentication and PM-role middleware. It obtains PM identity only from `req.user`, reuses M27 authorization and target-project scoping, and accepts no actor override through query/body/path data. Vendor and Contractor requests receive the existing role denial, and another PM's project remains a 404.

Explanation requests are read-only. They create no audit event, notification, recommendation, prompt history, token record, vector data, database table, or migration. Existing workflow actions remain the only owners of audit records and state changes.

## Verification

Focused M33 tests cover disabled capability/no provider call; authenticated owner success; anonymous, wrong-role, cross-PM, and stale-code handling; provider success; deterministic fallback; timeout; malformed/empty and 429 provider results; safe server-derived finding input; and audit/notification non-mutation. Frontend tests cover capability gating, no automatic request, explicit click, loading, AI and deterministic-fallback labels, browser error handling, and refresh stale-state clearing.

The focused M33 backend suite passes 3/3 and focused frontend M33 coverage passes 15/15, including deferred-response tests that prove explanations from a stale refresh or prior project cannot overwrite the current Project Control context. Existing M24, M25, M27, M29, M31, and M32 focused regression suites also pass when run in their normal isolated lifecycle. The full backend/coverage runner may still encounter the pre-existing shared `vms_test` reset collision before business assertions; M33 neither changes nor masks that infrastructure issue. The full frontend run currently has the pre-existing unrelated `VendorHomePage` timeout; M33-focused tests, lint, and production build pass.

Manual checks:

1. With `INTELLIGENCE_AI_EXPLANATIONS_ENABLED=false`, sign in as `demo.pm@workday.local`, open a project’s Project Control view, and confirm no explanation control or provider request appears.
2. Enable that flag while leaving `AI_API_KEY` empty, reload capabilities, click **Explain with AI**, and confirm **System fallback explanation** appears while the deterministic card is unchanged.
3. A real provider request is optional and requires an already-configured local key. Never place a key in source or this document.

## Limitations and non-goals

M33 supports PM Project Control explanations only. It does not add chat, autonomous actions, approval automation, predictions, external market intelligence, embeddings, RAG/vector search, provider persistence, reminders, new attention rules, or frontend decision calculations. M34 and later modules are outside this scope.
