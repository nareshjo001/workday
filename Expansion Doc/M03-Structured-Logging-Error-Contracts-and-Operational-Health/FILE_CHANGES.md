# File changes

## Added files

- `backend/src/observability/logger.js` — redacted structured JSON logger.
- `backend/src/observability/metrics.js` — in-process request counters and latency measurements.
- `backend/src/middleware/requestContext.js` — correlation ID, response header, request log, and metrics middleware.
- `backend/test/integration/observability.test.js` — contract and redaction integration tests.
- `Expansion Doc/M03-Structured-Logging-Error-Contracts-and-Operational-Health/{README,IMPLEMENTATION,TESTING,AUDIT,FILE_CHANGES}.md` — M03 handoff records.

## Modified files

- `backend/src/app.js`, `backend/src/server.js`, and `backend/src/migrations/run.js` — health routes and structured lifecycle logging.
- `backend/src/middleware/errorHandler.js` and `backend/src/utils/ApiError.js` — stable, request-correlated error contracts.
- `backend/src/services/mailService.js` — safe mail dependency status.
- `backend/package.json` — coverage includes observability code.
- `frontend/src/services/apiClient.js` — preserves error details, code, and request ID.

## Deleted files

Deleted files: None.
