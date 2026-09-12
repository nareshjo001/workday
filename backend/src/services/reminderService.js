const logger = require("../observability/logger");
const repository = require("../repositories/reminderRepository");
const notifications = require("./notificationService");
const { submissionLifecycleKey } = require("../utils/notificationLifecycle");

const DOCUMENT_EXPIRY_WARNING_DAYS = 30;

async function deliver(summary, item) {
  summary.evaluated += 1;
  const outcome = await notifications.notifyDetailed(item);
  summary[outcome] += 1;
}

async function deliverAll(summary, rows, toNotification) {
  for (const row of rows) {
    const item = toNotification(row);
    try {
      await deliver(summary, item);
    } catch (error) {
      summary.errors += 1;
      logger.error("reminder_delivery_failed", {
        event_type: item.eventType,
        entity_type: item.entityType,
        entity_id: row.id,
        error_message: error.message,
      });
    }
  }
}

async function runDueReminders() {
  const summary = { evaluated: 0, created: 0, deduplicated: 0, preference_skipped: 0, errors: 0 };
  logger.info("reminder_run_started");

  await deliverAll(summary, await repository.submittedTimesheets(), (row) => ({
    recipientId: row.recipient_id, eventType: "TIMESHEET_SUBMITTED", entityType: "timesheet", entityId: row.id,
    lifecycleKey: submissionLifecycleKey({ auditId: row.submission_audit_id, submittedAt: row.submitted_at }),
    message: `A timesheet for ${row.project_name} is awaiting your review.`, deepLink: "/pm/timesheets",
  }));
  await deliverAll(summary, await repository.submittedCandidates(), (row) => ({
    recipientId: row.recipient_id, eventType: "CANDIDATE_SUBMITTED", entityType: "candidate_submission", entityId: row.id,
    message: `A candidate for ${row.project_name} is awaiting your review.`, deepLink: "/pm/staffing-pipeline",
  }));
  await deliverAll(summary, await repository.submittedInvoices(), (row) => ({
    recipientId: row.recipient_id, eventType: "INVOICE_SUBMITTED", entityType: "invoice", entityId: row.id,
    lifecycleKey: submissionLifecycleKey({ auditId: row.submission_audit_id, submittedAt: row.submitted_at }),
    message: `An invoice for ${row.project_name} is awaiting your review.`, deepLink: "/pm/invoices",
  }));
  await deliverAll(summary, await repository.expiringVerifiedDocuments(DOCUMENT_EXPIRY_WARNING_DAYS), (row) => ({
    recipientId: row.recipient_id, eventType: "DOCUMENT_EXPIRING", entityType: "contractor_document", entityId: row.id,
    message: "A verified contractor document is expiring soon.", deepLink: "/vendor/compliance",
  }));

  // M19 payment alerts already use the same notification infrastructure.
  // They are materialized here as well so inbox reads stay observational.
  const paymentSummary = await notifications.materializePaymentAlerts();
  for (const key of Object.keys(summary)) summary[key] += paymentSummary[key] || 0;

  logger.info("reminder_run_finished", summary);
  return summary;
}

module.exports = { DOCUMENT_EXPIRY_WARNING_DAYS, runDueReminders };
