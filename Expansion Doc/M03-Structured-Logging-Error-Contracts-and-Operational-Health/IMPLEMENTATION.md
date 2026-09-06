# Implementation

`requestContext` accepts a safe `X-Request-Id` or generates a UUID, returns it in the response header, and records status and duration after each response. It logs route, actor id/role when authenticated, status, and latency through the JSON logger.

The logger recursively redacts sensitive field names including passwords, tokens, cookies, authorization data, secrets, and document data. Unexpected-error logging uses a stable error code and redacted error text/stack.

`ApiError` now carries a stable domain code. The central error handler returns `{code,message,details?,request_id}` and maps duplicate/foreign-key database failures to non-leaking domain contracts. Frontend error normalization reads `details` and retains the request ID for support diagnostics.

`/api/health` and `/api/health/live` provide liveness. `/api/health/ready` verifies a database connection and reports only safe dependency states. Metrics stay in-process by design; M03 does not introduce a distributed tracing or telemetry platform.
