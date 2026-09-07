# M11 Testing

The M11 integration test covers:

- date validation and staffing of the same contractor on consecutive, non-overlapping project periods;
- rejection of an overlapping active assignment with `409`;
- two concurrent overlapping staffing requests, with exactly one accepted;
- authorized PM early release, stored reason/actual end date, and historical visibility;
- contractor-owned availability creation/listing; and
- rejection of staffing inside an active unavailable period.

Run from `backend`:

```text
npm run test:coverage
git diff --check
```

The full sequential integration suite and coverage gate were run after the M11 changes. The integration runner uses a shared reset database, so it is intentionally run with its configured sequential test concurrency.
