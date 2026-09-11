# M30 — Contractor Timesheet Assistant UI

M30 places a small, advisory Timesheet Intelligence panel inside the existing **Log Hours** modal, directly above the existing Save Draft controls. It has no separate route, navigation item, or workflow.

The panel is visible only when M24 capability discovery returns `contractor_timesheet_intelligence: true`. It explicitly calls M29 only after **Check before submitting**; it sends `projectId`, `workDate`, `hoursLogged`, and optional `description`, never identity, policy, or calculated context.

Responses are validated before rendering. Findings retain M29 server order and show visible severity, title, summary, safe evidence, and recommended action. A clean result says that there are no current intelligence findings and that normal submission validation still applies.

Changing any proposal field clears results immediately and shows a stale message. It never rechecks automatically. Failures are non-blocking and the existing Save Draft behavior remains untouched. The panel neither creates audit events nor notifications.

M29 does not surface every submission constraint; weekend, backdate, weekly-policy, allocation-capacity, assignment-date, and description enforcement remain the normal submission workflow's responsibility. M30 does not claim that a clean check guarantees submission success.

Accessibility: native buttons, readable loading/status text, alert error state, text severity, semantic finding headings, and wrapping evidence rows. The panel uses the modal's responsive single-column layout and the evidence grid stacks on small screens.

Tests cover service request/response validation; panel clean, findings, unknown-code, stale, incomplete, and failure states; and real Log Hours modal capability gating, explicit payload, stale clearing, and Save Draft independence. Focused M30 tests pass 7/7. The full frontend suite currently has one unrelated `VendorHomePage.test.jsx` jsdom timing timeout (42/43 pass); that file passes directly in isolation and no timeout or assertion was weakened. Manual demo: use `demo.contractor@workday.local` on Demo Platform Upgrade; check a valid same-day one-hour proposal for a clean result, then use `2026-09-12` for the HIGH future-date finding, and edit hours/date afterward to observe stale state without a request. M31+ is out of scope.
