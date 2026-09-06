# ADR 0001: Modular Monolith and Explicit mysql2 Transactions

## Status

Accepted — hackathon baseline.

## Decision

Retain the Node/Express modular monolith and explicit mysql2 repositories. Services own transaction and lock rules; repositories own parameterized SQL.

## Rationale

Replacing this proven model with an ORM or microservices without a roadmap requirement would risk existing concurrency protections without product value.
