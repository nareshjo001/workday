import { useState } from "react";
import AlertBanner from "../AlertBanner";
import Spinner from "../Spinner";
import { formatSkill } from "../../constants/skills";
import { formatDate } from "../projects/format";
import "./CandidateReviewQueue.css";

const actionable = new Set(["SUBMITTED", "SHORTLISTED"]);

const STATUS_CONFIG = {
  SUBMITTED: { label: "Pending", key: "pending" },
  SHORTLISTED: { label: "Shortlisted", key: "shortlisted" },
  ACCEPTED: { label: "Accepted", key: "accepted" },
  REJECTED: { label: "Rejected", key: "rejected" },
  WITHDRAWN: { label: "Withdrawn", key: "withdrawn" },
};

function formatStatus(status) {
  return STATUS_CONFIG[status] || { label: status || "Unknown", key: "default" };
}

function formatProposedDates(startDate, endDate) {
  if (!startDate) return "—";
  const start = formatDate(startDate);
  if (!endDate) return start;
  const end = formatDate(endDate);
  return `${start} – ${end}`;
}

/* --- SVG Icons --- */


function ClockIcon({ size = 14, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckIcon({ size = 13, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CloseIcon({ size = 13, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function EmptyInboxIcon({ size = 26, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

/* --- Main Component --- */

export default function CandidateReviewQueue({ submissions, loading, error, onDecision }) {
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState(null);

  const queue = (submissions || []).filter((item) => actionable.has(item.status));

  const decide = async (item, status, rejectionReason = null) => {
    setBusyId(item.id);
    setActionError(null);
    try {
      await onDecision(item.id, status, rejectionReason);
      setSuccess(`${item.contractor_name} was ${status.toLowerCase()}.`);
      setRejecting(null);
      setReason("");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="crq-container" aria-labelledby="candidate-review-title">
      {/* Section Header */}
      <div className="crq-section-header">
        <div>
          <h2 id="candidate-review-title" className="crq-section-title">
            Candidate review queue
          </h2>
          <p className="crq-section-desc">
            Review candidates submitted to your projects. Acceptance creates the assignment through the existing protected workflow.
          </p>
        </div>

        <div className="crq-counter-pill">
          <span className="crq-counter-icon" aria-hidden="true">
            <ClockIcon />
          </span>
          <span>{queue.length} awaiting review</span>
        </div>
      </div>

      {/* Alert Notifications */}
      {(actionError || error || success) && (
        <div>
          <AlertBanner message={actionError || error} />
          <AlertBanner message={success} variant="success" />
        </div>
      )}

      {/* Table Card */}
      <div className="crq-table-card">
        {loading ? (
          <div className="crq-loading-box">
            <Spinner label="Loading candidate reviews…" />
          </div>
        ) : queue.length === 0 ? (
          <div className="crq-empty-container">
            <div className="crq-empty-icon-wrap" aria-hidden="true">
              <EmptyInboxIcon />
            </div>
            <h3 className="crq-empty-title">No candidates awaiting review</h3>
            <p className="crq-empty-desc">
              New vendor submissions will appear here when they require your decision.
            </p>
          </div>
        ) : (
          <div className="crq-table-scroll-wrapper">
            <table className="crq-table">
              <thead className="crq-thead">
                <tr>
                  <th scope="col" className="crq-th">Candidate</th>
                  <th scope="col" className="crq-th">Vendor</th>
                  <th scope="col" className="crq-th">Project / requirement</th>
                  <th scope="col" className="crq-th">Proposed dates</th>
                  <th scope="col" className="crq-th">Decision</th>
                  <th scope="col" className="crq-th crq-th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => {
                  const statusTheme = formatStatus(item.status);
                  return (
                    <tr
                      key={item.id}
                      data-testid={`candidate-${item.id}`}
                      className="crq-tr"
                    >
                      <td className="crq-td">
                        <div className="crq-candidate-name">{item.contractor_name}</div>
                      </td>
                      <td className="crq-td">
                        <div className="crq-vendor-name">{item.vendor_name}</div>
                      </td>
                      <td className="crq-td">
                        <div className="crq-project-cell">
                          <span className="crq-project-name">{item.project_name}</span>
                          <span className="crq-skill-name">{formatSkill(item.skill)}</span>
                        </div>
                      </td>
                      <td className="crq-td">
                        <span className="crq-dates-text">
                          {formatProposedDates(item.proposed_start_date, item.proposed_end_date)}
                        </span>
                      </td>
                      <td className="crq-td">
                        <span className={`crq-status-pill crq-status-pill--${statusTheme.key}`}>
                          <span className="crq-status-dot" aria-hidden="true" />
                          {statusTheme.label}
                        </span>
                      </td>
                      <td className="crq-td crq-actions-cell">
                        <div className="crq-actions-group">
                          <button
                            type="button"
                            data-testid={`accept-candidate-${item.id}`}
                            disabled={busyId === item.id}
                            onClick={() => decide(item, "ACCEPTED")}
                            className="crq-btn-accept"
                            title="Accept"
                            aria-label={`Accept ${item.contractor_name}`}
                          >
                            <CheckIcon />
                            <span className="crq-btn-label">Accept</span>
                          </button>
                          <button
                            type="button"
                            data-testid={`reject-candidate-${item.id}`}
                            disabled={busyId === item.id}
                            onClick={() => {
                              setRejecting(item);
                              setReason("");
                              setActionError(null);
                            }}
                            className="crq-btn-reject"
                            title="Reject"
                            aria-label={`Reject ${item.contractor_name}`}
                          >
                            <CloseIcon />
                            <span className="crq-btn-label">Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rejection Modal Dialog */}
      {rejecting && (
        <div
          className="crq-modal-backdrop"
          onClick={() => {
            setRejecting(null);
            setReason("");
            setActionError(null);
          }}
        >
          <div
            className="crq-modal-dialog"
            role="dialog"
            aria-label="Reject candidate"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="crq-modal-header">
              <div className="crq-modal-icon-badge" aria-hidden="true">
                <CloseIcon size={18} />
              </div>
              <div>
                <h3 className="crq-modal-title">Reject candidate submission</h3>
                <p className="crq-modal-desc">
                  Rejecting <strong style={{ color: "#0f172a" }}>{rejecting.contractor_name}</strong> for {rejecting.project_name}. A reason is required for the vendor.
                </p>
              </div>
            </div>

            <div className="crq-modal-body">
              <label className="crq-label" htmlFor="candidate-rejection-reason">
                Reason
                <textarea
                  id="candidate-rejection-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Provide a specific reason for rejection (required)..."
                  className="crq-textarea"
                  rows={3}
                  autoFocus
                />
              </label>
            </div>

            <div className="crq-modal-footer">
              <button
                type="button"
                onClick={() => {
                  setRejecting(null);
                  setReason("");
                  setActionError(null);
                }}
                className="crq-btn-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reason.trim() || busyId === rejecting.id}
                onClick={() => decide(rejecting, "REJECTED", reason.trim())}
                className="crq-btn-confirm-reject"
              >
                {busyId === rejecting.id ? "Rejecting..." : "Confirm rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
