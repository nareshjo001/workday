# M23 Implementation

## Scope

M23 performed final reconciliation and release preparation. Stable workflows were not redesigned. Changes were limited to confirmed defects, removal of retired production entry points, focused final tests, and documentation.

## Confirmed fixes

1. **Currency continuity:** assignment snapshots already stored currency, but milestone billing and draft creation fell back to USD. Migration `037` adds the immutable milestone-billing currency snapshot; milestone evaluation copies assignment currency and invoice drafts consume it.
2. **Revoked relationship safety:** the billing queue and draft-item claim now recheck the active Vendor–Client relationship and project grant. A revoked Vendor retains historical invoice access but cannot initiate future invoicing or sourcing.
3. **CSV injection:** export neutralization now covers `*` in addition to `=`, `+`, `-`, and `@`.
4. **Retired surfaces:** verification-only sample routes, the direct Vendor assignment path, and the obsolete Vendor invoice-review implementation were removed. Candidate acceptance remains the only normal assignment-creation path; PM review remains the invoice decision path.

## Compatibility

Migration `037` backfills USD because USD was the only value previously materialized by the old invoice path. New contributions inherit the assignment snapshot currency. Existing invoice, item, PDF, payment, and audit rows are not rewritten.

The `M09_ENFORCE_ACCESS` compatibility switch remains consistent with existing tests; production always applies relationship checks. M23 tests explicitly enable it.
