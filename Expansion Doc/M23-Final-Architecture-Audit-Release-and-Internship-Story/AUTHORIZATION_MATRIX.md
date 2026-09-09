# Final Authorization Matrix

Legend: **Own** = own organization/company/self scope; **Read** = scoped read; **Manage** = scoped mutation; **—** = denied. Sensitive foreign identifiers normally return privacy-safe `404`; a wrong role at a role router returns `403`.

| Resource / action | Vendor | PM / client | Contractor | Cross-tenant actor |
| --- | --- | --- | --- | --- |
| Account/session | Own | Own | Own | — |
| Client membership | Relationship/invitation only | Verified invitation or controlled bootstrap | — | Hidden |
| Projects/requirements | Read granted projects; submit candidates | Manage own-company projects | Read assigned projects | Hidden |
| Vendor relationships | Read own connections | Connect/revoke Vendors and project grants | — | Hidden |
| Contractors | Manage own roster/history | Read assigned/project-safe fields | Self profile | Hidden |
| Skills/availability | Manage own roster relationship; read permitted | Read staffing context | Manage self | Hidden |
| Documents/compliance | Manage own contractor documents | Read compliance summary only | Self where exposed | Hidden |
| Candidates | Submit/withdraw own | Decide own-project submissions | No decision authority | Hidden |
| Assignments | Read/release own contractor assignment | Read/release own project; created by acceptance | Read self | Hidden |
| Timesheets | Operational visibility only | Review own-project submissions | Create/edit/submit self | Hidden |
| Milestones/billings | Read invoice-eligible own contributions | Manage own-project milestones | — | Hidden |
| Rate cards | Manage for active Vendor–Client scope | Read agreed bill rate only | — | Hidden; PM never receives cost/margin |
| Invoice drafts/items | Manage own eligible billing | No draft access | — | Hidden |
| Submitted invoice review | Cannot self-approve | Approve/reject own-client project | — | Hidden |
| Invoice PDF | Download own | Download own-client project | — | Authorization precedes bytes; hidden |
| Payments | Record against own approved invoice | Read own-client settlement | — | Hidden |
| Dashboards/CSV | Own Vendor scope, including cost/margin | Own client scope, excluding Vendor cost/margin | Self operational scope; no commercial data | Empty scoped aggregate or hidden resource as endpoint convention requires |
| Notifications/preferences | Own user only | Own user only | Own user only | Not found |
| Offboarding/history | Own contractors and authorized history | Own projects without Vendor cost | Self history where exposed | Hidden |
| Project close | — | Read readiness and complete own project | — | Hidden |
| Audit-sensitive mutation | Actor from JWT; transactional audit | Actor from JWT; transactional audit | Actor from JWT; transactional audit | Denied before mutation |

## Tested privacy properties

The M23 integration test exercises wrong-role `403`, cross-client/cross-Vendor `404`, PM cost-rate non-disclosure, Contractor commercial-data non-disclosure, scoped dashboards/CSV, authorized PDF access, revoked relationship behavior, and audit actor/entity correlation. Existing module suites retain the deeper per-resource matrix.
