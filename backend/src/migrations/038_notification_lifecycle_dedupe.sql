ALTER TABLE notifications
  ADD COLUMN lifecycle_key VARCHAR(64) NOT NULL DEFAULT '' AFTER entity_id;

-- Associate historical submission notifications only with audit events that
-- already existed when each notification was created. Unresolved legacy rows
-- intentionally retain the empty lifecycle key.
UPDATE notifications n
INNER JOIN audit_log a ON a.id = (
  SELECT MAX(a2.id)
  FROM audit_log a2
  WHERE BINARY a2.action = BINARY n.event_type
    AND BINARY a2.entity_type = BINARY n.entity_type
    AND CAST(a2.entity_id AS UNSIGNED) = n.entity_id
    AND a2.created_at <= n.created_at
)
SET n.lifecycle_key = CONCAT('submission:', a.id)
WHERE (n.event_type = 'TIMESHEET_SUBMITTED' AND n.entity_type = 'timesheet')
   OR (n.event_type = 'INVOICE_SUBMITTED' AND n.entity_type = 'invoice');

ALTER TABLE notifications
  DROP INDEX uq_notification_event,
  ADD UNIQUE KEY uq_notification_event_lifecycle (
    recipient_id,
    event_type,
    entity_type,
    entity_id,
    lifecycle_key
  );
