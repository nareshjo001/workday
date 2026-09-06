# M05 — API Scalability, Search, Filtering & API Documentation

M05 makes the VMS list screens safe to use as contractors, projects, timesheets, and invoices grow. Before this module, several main list endpoints returned every matching row.

The main list APIs now return `{items, page, page_size, total, total_pages}`. The server applies tenant scope, filters, ordering, and pagination in SQL. Vendor contractor lists, PM projects, vendor staffing projects, contractor timesheets, PM pending-timesheet queues, and both invoice histories use this contract.

Users can move through list pages. Contractor and PM project lists have debounced text search; contractor search state is retained in the URL. Loading, empty, error, and page-navigation states remain available.

JWT-derived identities and SQL ownership predicates remain the security boundary. Pagination never exposes rows outside a Vendor, PM, or Contractor scope.
