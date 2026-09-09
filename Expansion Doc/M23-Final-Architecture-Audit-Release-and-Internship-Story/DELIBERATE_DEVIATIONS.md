# Deliberate Evolution from the Hackathon MVP

| Original / hackathon behavior | Final behavior | Why it changed |
| --- | --- | --- |
| Direct Vendor assignment | Vendor submits; PM accepts; acceptance creates assignment | Restores client decision authority and rechecks eligibility/capacity atomically |
| Company name could imply membership | Invitation/verified membership with controlled first-company bootstrap | Prevents self-claiming another client tenant |
| Single/simple skill field | Normalized contractor multi-skill profile | Supports matching and requirements without overwriting history |
| Live/default contractor rate | Vendor–Client–Skill rate card copied to assignment snapshot | Separates bill/cost and protects historical finance |
| Milestone could lead directly to invoice | Milestone creates eligible contribution; Vendor builds and submits draft | Models commercial ownership and prevents arbitrary totals |
| Vendor/generic invoice review | PM/client approves or rejects submitted invoice | Separates invoice preparation from client acceptance |
| Invoice approval implied settlement | Append-only payments derive unpaid/partial/paid/overdue | Approval and cash settlement are different business facts |
| Simple project completion | Close-readiness blockers/warnings and metadata-rich release | Prevents unresolved operational work from disappearing |
| Local developer execution | Docker demo, migration ledger, deterministic seed, Playwright, backup/restore | Makes the portfolio reproducible and reviewable |

These are post-hackathon engineering improvements, not a claim that the time-boxed MVP should have contained production-grade breadth.
