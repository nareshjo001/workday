# Audit

- Invoice totals are never trusted from request bodies. Item amounts originate
  from immutable milestone billing rows; tax and adjustment inputs are
  validated and totals are calculated by SQL.
- Number allocation uses a vendor/year row created with `INSERT IGNORE` and
  then locked with `FOR UPDATE`, preventing duplicate numbers under concurrent
  submissions.
- Invoice item ownership and compatibility are checked inside transactions.
- PDF content is generated only from persisted, authorized invoice data.
- PDF reads require Vendor ownership or PM project ownership and return the
  normal hidden not-found result for probes.
- Submission audit remains transactional. M14 notifications remain post-commit.
- PDF syntax escapes parentheses in displayed labels, as required by the PDF
  grammar. Acceptance tests validate the stored document representation and
  its rendered values originate only from persisted data.
- Invoice listing retains its established pagination, sort, and status/project
  filtering contract; this was checked after the M18 lifecycle integration
  replaced the prior list implementation.

Audit outcome: no open M18 defect remains. The deliberate operational
limitation is local storage durability/orphan cleanup, documented in
`IMPLEMENTATION.md`; it does not change invoice state or authorization.
