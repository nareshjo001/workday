# Audit

| Severity | Finding | Disposition |
| --- | --- | --- |
| High | A test reset could target a non-test database. | Fixed: both configuration and reset helper require `_test`. |
| Medium | Parallel local test commands can contend for one shared `vms_test` database. | CI runs them sequentially; the integration command itself uses one test worker. |
| Medium | Initial test reset passed a non-MySQL `name` option. | Fixed before final verification. |
| Low | Frontend lint reports 14 pre-existing Fast Refresh warnings. | Deferred; unrelated to M01 test behavior. |
| Low | npm reports moderate dependency advisories. | Recorded; no automatic audit fix was applied. |

## Final status

M01 preserves architecture and security boundaries. Test DB destruction is explicitly constrained, CI uses isolated MySQL, and concurrency/financial regression behavior is covered by the automated suite.

## CI portability follow-up

**Issue:** The c8 and Node test globs were unquoted in `backend/package.json`.

**Why it mattered:** Ubuntu expands unquoted globs before starting c8, while Windows `cmd.exe` passes them literally. This made a command that passed locally fail in GitHub Actions with `spawn src/services/billingService.js EACCES`.

**Fix:** c8 include patterns are quoted in the npm script, retaining `--all` and all original thresholds. The owned integration test entry point is named explicitly, preventing both shell glob expansion and accidental default discovery of historical root scripts. This eliminates shell-dependent behavior without excluding any coverage files or weakening the gate.

## Frontend runtime compatibility follow-up

**Issue:** CI used Node `20.20.2`, while the locked Vitest/jsdom/undici dependency tree requires a newer runtime. The worker failed before any assertion with jsdom's undici `markAsUncloneable` compatibility error.

**Fix:** Root `.nvmrc` pins Node `24.18.0`; GitHub Actions now reads it through `node-version-file`; frontend declares `>=24.15.0 <25`. Node 24.18.0 satisfies Vitest 5.0.0, jsdom 30.0.1, undici 8.10.2, and the existing backend `>=18` engine. The lockfile remains deterministic and no production dependency/test semantics changed.

## Final closure

Both M01 CI findings are closed. The repository owner verified successful GitHub Actions `push` and `pull_request` runs after the c8 shell-portability and Node-runtime fixes. No remaining M01 audit finding prevents module completion.
