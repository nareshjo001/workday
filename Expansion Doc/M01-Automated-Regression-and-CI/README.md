# M01 — Automated Regression Suite & CI

M01 turns the project’s manually started live-server checks into repeatable automated tests. It protects VMS workflows that affect staffing capacity, timesheets, immutable billing, invoices, and contractor release.

The suite now starts its own local API, recreates only a database ending in `_test`, runs all migrations, and executes the current regression scenarios. Frontend route protection has a focused automated test. CI repeats lint, backend coverage, frontend tests, and a production build.

Important rule: test reset refuses any database that does not end in `_test`. The historical `e2e_test.js` remains retained and superseded; it is not run as current coverage.
