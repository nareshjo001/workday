# Implementation

Notifications are user-owned inbox rows. Candidate, assignment, and timesheet lifecycle services call the notification service only after their database transaction commits. Preferences suppress non-critical in-app events. No email, SMS, or push channel is introduced.
