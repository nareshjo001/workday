import { useEffect, useRef } from "react";
import Modal from "../Modal";
import ActivityList from "../activity/ActivityList";
import "./PMProjectActivityModal.css";

export default function PMProjectActivityModal({
  project,
  activity,
  isLoading,
  error,
  onClose,
  onRetry,
  onPrevious,
  onNext,
}) {
  const displayedProject = activity?.project || project;
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [displayedProject?.id]);

  return (
    <Modal
      title="Activity"
      subtitle={
        <span className="project-activity-modal-sub-group">
          <span className="project-activity-modal-desc">
            Track all important events across your projects, assignments, invoices and payments.
          </span>
          {displayedProject && (
            <span className="project-activity-modal-context">
              {displayedProject.name} · {displayedProject.status}
            </span>
          )}
        </span>
      }
      onClose={onClose}
      headerActions={
        <button
          type="button"
          onClick={onRetry}
          disabled={isLoading}
          aria-label={isLoading ? "Refreshing activity" : "Refresh activity"}
          className="project-activity-refresh-btn"
        >
          <RefreshIcon isRefreshing={isLoading} />
          <span>{isLoading ? "Refreshing…" : "Refresh activity"}</span>
        </button>
      }
      panelClassName="project-activity-modal"
      headerClassName="project-activity-modal-header"
      lockDocumentScroll
    >
      <div ref={bodyRef} className="project-activity-modal-body">
        <ActivityList
          activity={activity}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
          onPrevious={onPrevious}
          onNext={onNext}
          hideHeader
        />
      </div>
    </Modal>
  );
}

function RefreshIcon({ isRefreshing = false }) {
  return (
    <svg
      className={`h-4 w-4 text-blue-600 ${isRefreshing ? "animate-spin" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}
