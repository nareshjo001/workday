# Audit

Notification writes occur after successful business commits and failures are isolated. Inbox reads and mutations are recipient-scoped. Expiry generation is deterministic on inbox access, uses a 30-day threshold, and deduplicates by event/entity/recipient. Messages contain no document content.
