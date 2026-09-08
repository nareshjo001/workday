# Implementation

`dashboardAnalyticsService` aggregates at the database and scopes every query by the authenticated Vendor or PM. Project filters support client, project, requirement skill, project status, and ISO date boundaries. Work-date filters apply to timesheets; invoice exports use submission date; payments use payment date; assignments use assignment start date.

Financial definitions: approved work is approved timesheet hours; billable-uninvoiced is unclaimed milestone billing; submitted/approved invoice amounts are lifecycle-specific invoice totals; paid is recorded payment amount; outstanding is approved total minus payments; overdue is outstanding approved value past due date. Margin uses rate snapshots, never current rate cards.

CSV exports provide assignments, approved timesheets, invoices, invoice items, payments, and project-financial summaries. Values with spreadsheet-formula prefixes are neutralized with a leading apostrophe.
