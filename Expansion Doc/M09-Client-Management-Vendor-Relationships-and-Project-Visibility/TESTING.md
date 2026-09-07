# Testing

Automated integration coverage in `m09-vendor-access.test.js` verifies:

- first-PM company bootstrap succeeds;
- a second PM cannot self-claim that company;
- invitation-based membership succeeds;
- Vendor A receives only an explicitly granted project and Vendor B receives 404;
- Vendor A's directory and detail are limited to its active relationship;
- client relationship revocation blocks later sourcing and directory reads;
- historical assignment rows remain after revocation; and
- PM connect and remove actions succeed.

Verification run: M09 integration test passed, backend full regression passed, frontend production build passed, and `git diff --check` passed. The M09 test enables its access predicate explicitly; existing historical workflow tests retain their focused compatibility fixtures in test mode.

Manual E2E exercised: bootstrap PM → invite PM → accepted signup → select Vendor and project → Vendor sees project/client detail → PM removes access → Vendor loses sourcing while the prior assignment remains.
