# File changes

## Added

- `backend/src/migrations/023_vendor_client_project_access.sql` — relationship and project-access tables.
- `backend/src/migrations/024_pm_company_invitations.sql` — hashed, expiring PM invitations.
- `backend/src/repositories/pmCompanyInvitationRepository.js`, `vendorAccessRepository.js`, and `vendorClientRepository.js` — scoped data access.
- `backend/src/controllers/pmVendorAccessController.js` and `vendorClientController.js` — relationship and directory APIs.
- `backend/test/integration/m09-vendor-access.test.js` — M09 authorization matrix.
- `frontend/src/pages/PmVendorAccessPage.jsx`, `VendorClientsPage.jsx`, and their API services — relationship and directory experiences.

## Modified

- Authentication, company/user repositories, mail, PM/Vendor routes, Vendor project/assignment access paths, signup, dashboard links, and app routes — invitation membership, audit, access enforcement, and navigation.

## Deleted

Deleted files: None.
