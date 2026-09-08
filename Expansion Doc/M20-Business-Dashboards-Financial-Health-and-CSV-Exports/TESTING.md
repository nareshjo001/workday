# Testing

Dedicated integration coverage resets the database, executes the established full lifecycle fixture, then verifies Vendor/PM aggregation, Contractor non-disclosure, tenant-limited filters, and all six CSV datasets. Backend coverage, frontend lint, frontend tests, and the production build pass.

CSV checks cover tenant scope, fixed business headers, filter application, content disposition, and formula-injection neutralization.
