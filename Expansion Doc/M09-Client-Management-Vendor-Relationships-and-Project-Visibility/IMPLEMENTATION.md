# Implementation

## Membership hardening

Migration 024 adds hashed, expiring `pm_company_invitations`. PM signup creates a company only with a plain INSERT bootstrap path; a duplicate normalized company name is rejected. For an existing company, signup consumes an invitation locked in the same transaction before creating the user and PM-company membership. The invitation token is sent in an email link and is returned only in test mode.

## Relationships and sourcing

Migration 023 adds `client_vendor_relationships` and `project_vendors`. PM relationship creation validates the Vendor role and ownership of any selected project. Vendor browse, project detail, eligible-contractor, and assignment operations require an active `project_vendors` row. Revoking a client relationship atomically revokes its active project access, but never deletes assignments.

## APIs and UI

PM APIs expose registered Vendors, current relationships, connect/grant, and relationship/project revocation. Vendor APIs expose a relationship-scoped client directory and client detail. The PM screen uses selected Vendor and project values; the Vendor screen provides directory cards and an in-place detail view.

## Audit and boundaries

Bootstrap/join, invitation, connect, grant, and revoke writes use the audit log. Mutation plus audit uses a single transaction. Client-directory and project reads are Vendor-scoped and use 404 for inaccessible resources.
