# Audit

## Findings and resolution

- **Close race protection:** completion locks the project and recomputes readiness in the completion transaction rather than trusting the UI preflight.
- **Audit integrity:** individual releases and automatic releases write transactional audit rows. An audit failure rolls back the critical mutation.
- **Historical safety:** release only changes assignment lifecycle metadata. It does not update timesheets, milestone billings, invoices, payments, snapshots, or PDFs.
- **Tenant isolation:** Vendor history and release require both Vendor contractor ownership and active project access. PM close readiness requires project ownership.
- **Commercial privacy:** Vendor-only history may include its commercial snapshots; PM close UI does not expose Vendor cost or margin.
- **Notification isolation:** release notifications run only after commit and are best-effort, as required by M14.

No unresolved M21 audit findings remain.
