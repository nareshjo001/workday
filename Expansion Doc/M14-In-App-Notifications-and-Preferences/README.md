# M14 — In-App Notifications & Preferences

Notification delivery is deliberately post-commit and best-effort: a notification failure is logged without changing the completed business mutation. Notifications are de-duplicated per recipient, event type, and entity.
