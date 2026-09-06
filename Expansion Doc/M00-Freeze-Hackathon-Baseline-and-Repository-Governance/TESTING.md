# Testing

## Documentation checks

M00 verifies Markdown links and current path/command references. It does not run a business E2E flow because it introduces no runtime behaviour or data mutation.

TEST: Required M00 documentation records and headings are present.
EXPECTED: The root documentation, three ADRs, and five module records are readable from the repository.
ACTUAL: A read-only integrity check passed for all 15 required files.
RESULT: PASS

TEST: Existing frontend static checks still pass after the documentation-only change.
EXPECTED: `npm run lint` exits successfully without an M00-introduced warning or error.
ACTUAL: The command exited 0. It reported 14 existing `react(only-export-components)` Fast Refresh warnings in application source; M00 did not modify those files.
RESULT: PASS

TEST: Documentation change has no whitespace errors in Git's patch validation.
EXPECTED: No trailing-whitespace or malformed-patch error.
ACTUAL: `git diff --check` completed successfully; Git noted only its existing line-ending conversion warning for `README.md`.
RESULT: PASS

TEST: Root README local documentation references resolve.
EXPECTED: Each linked current-system document, ADR index, and M00 module record exists.
ACTUAL: A read-only reference check passed for all 7 local links.
RESULT: PASS

TEST: The annotated hackathon baseline tag resolves to the intended commit.
EXPECTED: `v1.0-hackathon` dereferences to `4bd5cd1`.
ACTUAL: The locally verified dereferenced tag target is `4bd5cd177694534e828d3f263849dce43fd297be`.
RESULT: PASS

## Existing regression artifacts

- `backend/mvp_fix_test.js` is the current broad live-server regression suite.
- `backend/eligible_contractor_release_test.js` is current focused regression coverage.
- `backend/e2e_test.js` is deliberately retained but superseded historical coverage and must not be treated as the current suite.

Automated isolated test execution and CI are M01 scope.
