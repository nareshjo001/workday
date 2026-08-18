import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import PendingTimesheetTable from "../components/timesheets/PendingTimesheetTable";
import PendingTimesheetCardList from "../components/timesheets/PendingTimesheetCardList";
import pmTimesheetService from "../services/pmTimesheetService";

/**
 * PM's timesheet-approval queue: pending timesheets for the PM's own
 * projects only (enforced server-side, see pmTimesheetService.listPending)
 * with inline Approve/Reject actions. This component never sends or
 * reads a pm id itself.
 */
export default function PmTimesheetsPage() {
  const [timesheets, setTimesheets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const loadPending = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await pmTimesheetService.listPending();
      setTimesheets(data);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleReview = async (timesheetId, status) => {
    setActionError(null);
    setReviewingId(timesheetId);
    try {
      await pmTimesheetService.reviewTimesheet(timesheetId, status);
      // Reviewed timesheets drop out of the PENDING queue immediately —
      // re-fetching the full list isn't necessary since the only thing
      // that changed is this one row leaving PENDING.
      setTimesheets((prev) => prev.filter((t) => t.id !== timesheetId));
      setSuccessMessage(status === "APPROVED" ? "Timesheet approved." : "Timesheet rejected.");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <DashboardLayout title="Timesheet Approvals">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <h1 className="text-xl font-semibold text-text">Timesheet Approvals</h1>

        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={actionError || loadError} />

        {isLoading ? (
          <Spinner label="Loading pending timesheets…" />
        ) : timesheets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
            <p className="text-text-secondary">No timesheets awaiting review.</p>
            <p className="max-w-sm text-sm text-muted">
              Timesheets contractors log against your projects will show up here for approval.
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6">
            <PendingTimesheetTable
              timesheets={timesheets}
              reviewingId={reviewingId}
              onApprove={(id) => handleReview(id, "APPROVED")}
              onReject={(id) => handleReview(id, "REJECTED")}
            />
            <PendingTimesheetCardList
              timesheets={timesheets}
              reviewingId={reviewingId}
              onApprove={(id) => handleReview(id, "APPROVED")}
              onReject={(id) => handleReview(id, "REJECTED")}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
