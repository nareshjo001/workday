import { useEffect } from "react";
import { formatDate, formatHours } from "./format";
import { formatSkill } from "../../constants/skills";
import { getInitials } from "../contractors/format";

/**
 * Enterprise Project Team Modal:
 * Displays project overview, requirements, assigned contractor rosters,
 * and hours breakdown (Allocated, Logged, Approved, Pending, Remaining).
 * Matches the enterprise VMS design with independent internal scrolling.
 */
export default function ProjectTeamModal({ project, onClose, onAssignRequirement }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const totalAssigned = project.total_assigned ?? 0;
  const totalRequired = project.total_required ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-5 bg-slate-950/45 backdrop-blur-sm overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-team-modal-title"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-[900px] max-h-[calc(100dvh-36px)] rounded-[18px] sm:rounded-[20px] bg-white border border-slate-200/80 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="project-team-modal"
      >
        {/* Fixed Header Section */}
        <div className="flex-shrink-0 px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="project-team-modal-title"
              className="text-lg sm:text-[21px] font-bold text-slate-900 tracking-tight leading-snug min-w-0 flex-1"
            >
              {project.name}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Metadata Rows */}
          <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-1 gap-x-4 sm:gap-x-5 text-xs sm:text-[13px] text-slate-500 leading-tight">
            <div className="flex items-center gap-1.5">
              <BuildingIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>
                <span className="font-medium text-slate-700">{project.company_name}</span>
                {project.pm_name && <span> · PM: {project.pm_name}</span>}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>
                {formatDate(project.start_date)} – {formatDate(project.end_date)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <UsersIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>
                Team: <span className="font-medium text-slate-700">{totalAssigned} / {totalRequired}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-5 flex flex-col gap-3 sm:gap-3.5">
          {project.requirements && project.requirements.length > 0 ? (
            project.requirements.map((req) => {
              const isFilled = req.assigned_count >= req.required_count;
              const contractors = req.contractors || [];
              const hasContractors = contractors.length > 0;

              return (
                <div
                  key={req.id}
                  className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col"
                  data-testid={`requirement-section-${req.id}`}
                >
                  {/* Requirement Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <RoleIconSurface skill={req.skill} />
                      <div className="min-w-0">
                        <h3 className="text-[16px] sm:text-[17px] font-bold text-slate-900 leading-snug">
                          {formatSkill(req.skill)}
                        </h3>
                        <p
                          className={`text-xs sm:text-[13px] font-medium leading-tight mt-0.5 ${
                            isFilled ? "text-emerald-600" : "text-slate-500"
                          }`}
                        >
                          {req.assigned_count} / {req.required_count} assigned
                        </p>
                      </div>
                    </div>

                    {/* Right Action / Status */}
                    {isFilled ? (
                      <div
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 px-2.5 py-1 text-xs font-semibold"
                        data-testid={`filled-badge-${req.id}`}
                      >
                        <CheckCircleFillIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Filled</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAssignRequirement(req)}
                        className="inline-flex h-9 sm:h-10 items-center justify-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl bg-primary px-3.5 sm:px-4 text-xs sm:text-sm font-semibold text-white shadow-panel transition hover:bg-primary-hover active:bg-primary-active focus:outline-none focus:ring-2 focus:ring-primary/20"
                        data-testid={`submit-candidate-btn-${req.id}`}
                      >
                        <PlusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span>Submit {formatSkill(req.skill)} Candidate</span>
                      </button>
                    )}
                  </div>

                  {/* Empty state or Contractor Roster */}
                  {!hasContractors ? (
                    <div
                      className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50/70 border border-blue-100/80 px-3.5 py-2.5 min-h-[42px] text-xs sm:text-[12.5px] text-blue-900/80"
                      data-testid={`empty-contractors-${req.id}`}
                    >
                      <InfoCircleIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>No contractors assigned yet.</span>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-col divide-y divide-slate-100 border-t border-slate-100">
                      {contractors.map((c) => (
                        <div
                          key={c.contractor_id}
                          className="py-3 sm:py-3.5 first:pt-3.5 last:pb-0 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_210px] items-center gap-3 md:gap-0"
                          data-testid={`contractor-row-${c.contractor_id}`}
                        >
                          {/* Contractor Identity */}
                          <div className="flex items-center gap-3 min-w-0 pr-0 md:pr-4">
                            <div
                              className="contractor-avatar shrink-0"
                              aria-hidden="true"
                              data-testid="contractor-avatar"
                            >
                              {getInitials(c.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm sm:text-[14.5px] font-semibold text-slate-900 leading-snug truncate">
                                {c.name}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs sm:text-[12.5px] text-slate-500">
                                <span
                                  className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                                    c.assignment_status === "RELEASED"
                                      ? "bg-slate-400"
                                      : c.status === "ACTIVE"
                                        ? "bg-emerald-500"
                                        : "bg-amber-500"
                                  }`}
                                  aria-hidden="true"
                                />
                                <span>{formatSkill(c.skill || req.skill)}</span>
                                <span className="text-slate-300">·</span>
                                <span>
                                  {c.assignment_status === "RELEASED"
                                    ? "Released"
                                    : c.status === "ACTIVE"
                                      ? "Active"
                                      : "Inactive"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Hours Breakdown with Vertical Divider */}
                          <div
                            className="flex flex-col gap-1 text-[12px] sm:text-[12.5px] text-slate-500 shrink-0 pt-2.5 md:pt-0 border-t border-slate-100 md:border-t-0 md:border-l md:border-slate-200 md:pl-5 lg:pl-6"
                            data-testid={`contractor-hours-${c.contractor_id}`}
                          >
                            {c.allocated_hours !== null && c.allocated_hours !== undefined && (
                              <div className="inline-flex items-center gap-1.5 leading-tight">
                                <ClockIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>
                                  Allocated: <span className="font-medium text-slate-700">{formatHours(c.allocated_hours)}h</span>
                                </span>
                              </div>
                            )}
                            <div className="inline-flex items-center gap-1.5 leading-tight">
                              <PlayIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>
                                Logged: <span className="font-medium text-slate-700">{formatHours(c.logged_hours)}h</span>
                              </span>
                            </div>
                            <div className="inline-flex items-center gap-1.5 leading-tight">
                              <CheckCircleLineIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>
                                Approved: <span className="font-medium text-slate-700">{formatHours(c.approved_hours)}h</span>
                              </span>
                            </div>
                            {c.pending_hours !== null && c.pending_hours !== undefined && (
                              <div className="inline-flex items-center gap-1.5 leading-tight">
                                <HourglassIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>
                                  Pending: <span className="font-medium text-slate-700">{formatHours(c.pending_hours)}h</span>
                                </span>
                              </div>
                            )}
                            {c.remaining_hours !== null && c.remaining_hours !== undefined && (
                              <div className="inline-flex items-center gap-1.5 leading-tight">
                                <PieChartIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>
                                  Remaining: <span className="font-medium text-slate-700">{formatHours(c.remaining_hours)}h</span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-slate-500 text-sm">
              No staffing requirements defined for this project.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleIconSurface({ skill }) {
  const norm = String(skill || "").toUpperCase();
  if (norm.includes("BACKEND")) {
    return (
      <div className="flex h-10.5 w-10.5 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 border border-blue-100/70 shadow-xs">
        <ServerIcon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
      </div>
    );
  }
  if (norm.includes("FRONTEND") || norm.includes("WEB") || norm.includes("UI")) {
    return (
      <div className="flex h-10.5 w-10.5 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600 border border-purple-100/70 shadow-xs">
        <CodeIcon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
      </div>
    );
  }
  if (norm.includes("QA") || norm.includes("TEST")) {
    return (
      <div className="flex h-10.5 w-10.5 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100/70 shadow-xs">
        <ShieldCheckIcon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
      </div>
    );
  }
  if (norm.includes("DEVOPS") || norm.includes("CLOUD") || norm.includes("INFRA")) {
    return (
      <div className="flex h-10.5 w-10.5 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 border border-sky-100/70 shadow-xs">
        <CloudIcon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
      </div>
    );
  }
  return (
    <div className="flex h-10.5 w-10.5 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100/70 shadow-xs">
      <BriefcaseIcon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
    </div>
  );
}

function ServerIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" />
      <line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  );
}

function CodeIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="7 8 3 12 7 16" />
      <polyline points="17 8 21 12 17 16" />
      <line x1="14" y1="4" x2="10" y2="20" />
    </svg>
  );
}

function ShieldCheckIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CloudIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

function BriefcaseIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="20" height="14" x="2" y="7" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function BuildingIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </svg>
  );
}

function CalendarIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function UsersIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CloseIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckCircleFillIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="m8.5 12 2.5 2.5 5-5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function InfoCircleIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function ClockIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function PlayIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function CheckCircleLineIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function HourglassIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 22h14M5 2h14m-2 20v-5l-5-5 5-5V2M7 2v5l5 5-5 5v5" />
    </svg>
  );
}

function PieChartIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}
