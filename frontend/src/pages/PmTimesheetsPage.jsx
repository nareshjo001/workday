import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import PendingTimesheetTable from "../components/timesheets/PendingTimesheetTable";
import pmTimesheetService from "../services/pmTimesheetService";
import RejectTimesheetModal from "../components/timesheets/RejectTimesheetModal";
import { formatSkill } from "../constants/skills";

// Present daily timesheets within the server-enforced PM review scope.
export default function PmTimesheetsPage() {
  const [timesheets, setTimesheets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pageInfo, setPageInfo] = useState({ total_pages: 1, total: 0 });
  const [sortField, setSortField] = useState("submitted_at");
  const [sortOrder, setSortOrder] = useState("asc");

  const [selectedIds, setSelectedIds] = useState([]);
  const [rejectingIds, setRejectingIds] = useState(null);

  // Track successful reviews in this session without claiming historical totals.
  const [sessionApproved, setSessionApproved] = useState(0);
  const [sessionRejected, setSessionRejected] = useState(0);

  const [selectedContractor, setSelectedContractor] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const loadPending = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Backend supports sort on submitted_at, work_date, project, contractor
      let backendSort = "submitted_at";
      if (sortField === "contractor_name") backendSort = "contractor";
      else if (sortField === "project_name") backendSort = "project";
      else if (sortField === "work_date") backendSort = "work_date";
      else if (sortField === "submitted_at") backendSort = "submitted_at";

      const data = await pmTimesheetService.listPending({
        page,
        pageSize,
        sort: backendSort,
        order: sortOrder,
      });
      setTimesheets(data.items || []);
      setPageInfo(data);
      setSelectedIds([]);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortField, sortOrder]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleReview = async (timesheetId, status, rejectionReason = null) => {
    setActionError(null);
    setReviewingId(timesheetId);
    try {
      await pmTimesheetService.reviewTimesheet(timesheetId, status, rejectionReason);
      setTimesheets((prev) => prev.filter((t) => t.id !== timesheetId));
      setSelectedIds((prev) => prev.filter((id) => id !== timesheetId));
      setPageInfo((prev) => ({
        ...prev,
        total: Math.max(0, (prev.total || 1) - 1),
      }));
      if (status === "APPROVED") {
        setSessionApproved((prev) => prev + 1);
        setSuccessMessage("Timesheet approved.");
      } else {
        setSessionRejected((prev) => prev + 1);
        setSuccessMessage("Timesheet rejected.");
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setReviewingId(null);
    }
  };

  const handleBulkReview = async (status, rejectionReason = null) => {
    const ids = selectedIds;
    if (!ids.length) return;
    setActionError(null);
    setReviewingId("bulk");
    try {
      await pmTimesheetService.bulkReviewTimesheets(ids, status, rejectionReason);
      setTimesheets((prev) => prev.filter((timesheet) => !ids.includes(timesheet.id)));
      setSelectedIds([]);
      setPageInfo((prev) => ({
        ...prev,
        total: Math.max(0, (prev.total || ids.length) - ids.length),
      }));
      if (status === "APPROVED") {
        setSessionApproved((prev) => prev + ids.length);
      } else {
        setSessionRejected((prev) => prev + ids.length);
      }
      setSuccessMessage(
        `${ids.length} timesheet${ids.length === 1 ? "" : "s"} ${status === "APPROVED" ? "approved" : "rejected"}.`
      );
    } catch (err) {
      setActionError(err.message);
      throw err;
    } finally {
      setReviewingId(null);
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const toggleAll = (checked) => {
    setSelectedIds(checked ? filteredTimesheets.map((t) => t.id) : []);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const contractorOptions = useMemo(() => {
    const map = new Map();
    timesheets.forEach((t) => {
      if (t.contractor_name) map.set(t.contractor_name, t.contractor_name);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [timesheets]);

  const skillOptions = useMemo(() => {
    const set = new Set();
    timesheets.forEach((t) => {
      if (t.contractor_skill) set.add(t.contractor_skill);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [timesheets]);

  const projectOptions = useMemo(() => {
    const map = new Map();
    timesheets.forEach((t) => {
      if (t.project_id && t.project_name) {
        map.set(t.project_id, { id: t.project_id, name: t.project_name });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [timesheets]);

  const filteredTimesheets = useMemo(() => {
    return timesheets
      .filter((t) => {
        if (selectedContractor && t.contractor_name !== selectedContractor) return false;
        if (selectedSkill && t.contractor_skill !== selectedSkill) return false;
        if (selectedProject && String(t.project_id) !== String(selectedProject)) return false;
        if (dateFilter !== "ALL") {
          const workDate = t.work_date;
          const today = new Date().toISOString().slice(0, 10);
          if (dateFilter === "TODAY") {
            if (workDate !== today) return false;
          } else if (dateFilter === "PAST_7_DAYS") {
            const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
            if (workDate < sevenDaysAgo) return false;
          } else if (dateFilter === "THIS_MONTH") {
            const monthStart = today.slice(0, 7) + "-01";
            if (workDate < monthStart) return false;
          }
        }
        if (searchTerm.trim()) {
          const q = searchTerm.trim().toLowerCase();
          const matchName = t.contractor_name?.toLowerCase().includes(q);
          const matchProject = t.project_name?.toLowerCase().includes(q);
          const matchSkill = t.contractor_skill?.toLowerCase().includes(q);
          const matchDesc = t.description?.toLowerCase().includes(q);
          if (!matchName && !matchProject && !matchSkill && !matchDesc) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Client-side sorting fallback for non-backend columns like hours_logged and contractor_skill
        if (sortField === "hours_logged") {
          const diff = Number(a.hours_logged) - Number(b.hours_logged);
          return sortOrder === "asc" ? diff : -diff;
        }
        if (sortField === "contractor_skill") {
          const comp = String(a.contractor_skill || "").localeCompare(String(b.contractor_skill || ""));
          return sortOrder === "asc" ? comp : -comp;
        }
        return 0;
      });
  }, [timesheets, selectedContractor, selectedSkill, selectedProject, dateFilter, searchTerm, sortField, sortOrder]);

  const pendingCount = pageInfo.total ?? timesheets.length;
  const totalSubmissions = pendingCount + sessionApproved + sessionRejected;

  const totalItems = pageInfo.total ?? timesheets.length;
  const totalPages = Math.max(pageInfo.total_pages || 1, Math.ceil(totalItems / pageSize) || 1);

  return (
    <DashboardLayout title="Timesheet Approvals">
      <div className="flex w-full flex-col gap-5">
        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={actionError || loadError} />

        <section
          aria-label="Timesheet Approvals Overview"
          className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm md:flex-row md:items-center"
        >
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-96 rounded-r-2xl bg-gradient-to-l from-blue-50/60 via-sky-50/20 to-transparent" />

          <div className="z-10 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600 shadow-sm sm:h-14 sm:w-14">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 sm:h-7 sm:w-7"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Timesheet Approvals
              </h1>
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                Review and approve contractor timesheets. Keep your projects on track.
              </p>
            </div>
          </div>

          <div className="pointer-events-none z-10 hidden select-none items-center gap-6 pr-2 lg:flex">
            <div className="relative flex items-center">
              <svg
                width="220"
                height="68"
                viewBox="0 0 220 68"
                fill="none"
                className="overflow-visible"
                aria-hidden="true"
              >
                <path
                  d="M 10 50 C 60 50, 75 18, 120 22 C 160 26, 175 46, 205 42"
                  stroke="url(#hero-gradient-path)"
                  strokeWidth="24"
                  strokeLinecap="round"
                  className="opacity-25"
                />
                <defs>
                  <linearGradient id="hero-gradient-path" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.1" />
                    <stop offset="50%" stopColor="#93c5fd" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                <path
                  d="M 10 46 C 50 46, 70 18, 110 22 C 145 26, 160 44, 195 40"
                  stroke="#93c5fd"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  fill="none"
                />
                <g transform="translate(94, 6)">
                  <rect x="0" y="0" width="30" height="38" rx="6" fill="#ffffff" stroke="#93c5fd" strokeWidth="2" />
                  <line x1="6" y1="9" x2="20" y2="9" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="6" y1="16" x2="24" y2="16" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
                  <line x1="6" y1="23" x2="18" y2="23" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="26" cy="30" r="7" fill="#2563eb" />
                  <polyline points="26 27 26 30 28 32" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </g>
                <g transform="translate(182, 27)">
                  <circle cx="13" cy="13" r="14" fill="#2563eb" />
                  <path d="m8.5 13 3 3 6-6" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              </svg>
            </div>
            <div className="flex w-[124px] shrink-0 flex-col justify-center">
              <span className="whitespace-nowrap text-xs font-semibold leading-snug text-blue-600">
                Accurate approvals.
              </span>
              <span className="whitespace-nowrap text-xs font-semibold leading-snug text-blue-600">
                On-time delivery.
              </span>
              <div className="mt-1.5 h-0.5 w-8 rounded-full bg-blue-600" />
            </div>
          </div>
        </section>

        <section aria-label="Review Queue Metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3.5 rounded-2xl border border-blue-100/80 bg-white p-4 shadow-sm transition hover:border-blue-200">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600">Total submissions</span>
              <p className="mt-0.5 text-2xl font-bold leading-tight text-slate-900">{totalSubmissions}</p>
              <span className="text-[11px] text-slate-400">In review queue</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl border border-amber-100/80 bg-[#fffdf7] p-4 shadow-sm transition hover:border-amber-200">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100/80 text-amber-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600">Pending review</span>
              <p className="mt-0.5 text-2xl font-bold leading-tight text-slate-900">{pendingCount}</p>
              <span className="text-[11px] text-slate-400">Awaiting your action</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-100/80 bg-[#f7fcf9] p-4 shadow-sm transition hover:border-emerald-200">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100/80 text-emerald-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600">Approved</span>
              <p className="mt-0.5 text-2xl font-bold leading-tight text-slate-900">{sessionApproved}</p>
              <span className="text-[11px] text-slate-400">Reviewed this session</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl border border-rose-100/80 bg-[#fff8f8] p-4 shadow-sm transition hover:border-rose-200">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100/80 text-rose-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600">Rejected</span>
              <p className="mt-0.5 text-2xl font-bold leading-tight text-slate-900">{sessionRejected}</p>
              <span className="text-[11px] text-slate-400">Reviewed this session</span>
            </div>
          </div>
        </section>

        <section
          aria-label="Timesheet Filters"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Filter by contractor"
              value={selectedContractor}
              onChange={(e) => setSelectedContractor(e.target.value)}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All contractors</option>
              {contractorOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by skill"
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All skills</option>
              {skillOptions.map((skill) => (
                <option key={skill} value={skill}>
                  {formatSkill(skill)}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by project"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="max-w-[200px] cursor-pointer truncate rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All projects</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <div className="relative inline-flex items-center">
              <svg
                className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <select
                aria-label="Filter by date range"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white pl-8 pr-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All time</option>
                <option value="TODAY">Today</option>
                <option value="PAST_7_DAYS">Past 7 days</option>
                <option value="THIS_MONTH">This month</option>
              </select>
            </div>
          </div>

          <div className="relative min-w-[220px] max-w-xs flex-1 sm:flex-initial">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              aria-label="Search timesheets"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search timesheets..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 shadow-sm transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </section>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                {selectedIds.length}
              </span>
              <span className="text-xs font-semibold text-slate-800">
                {selectedIds.length === 1
                  ? "1 timesheet selected"
                  : `${selectedIds.length} timesheets selected`}
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="cursor-pointer text-xs font-medium text-slate-500 underline hover:text-slate-800"
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={reviewingId === "bulk"}
                onClick={() => handleBulkReview("APPROVED")}
                className="inline-flex items-center justify-center rounded-lg border border-emerald-300 bg-emerald-100/90 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Approve selected
              </button>
              <button
                type="button"
                disabled={reviewingId === "bulk"}
                onClick={() => setRejectingIds(selectedIds)}
                className="inline-flex items-center justify-center rounded-lg border border-rose-300 bg-rose-100/90 px-3.5 py-1.5 text-xs font-semibold text-rose-800 shadow-sm transition hover:bg-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reject selected
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <Spinner label="Loading pending timesheets…" />
          </div>
        ) : (
          <PendingTimesheetTable
            timesheets={filteredTimesheets}
            reviewingId={reviewingId}
            onApprove={(id) => handleReview(id, "APPROVED")}
            onReject={(id) => setRejectingIds([id])}
            selectedIds={selectedIds}
            onToggle={toggleSelected}
            onToggleAll={toggleAll}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            emptyTitle={
              timesheets.length > 0 && filteredTimesheets.length === 0
                ? "No matching timesheets found"
                : "No timesheets awaiting review"
            }
            emptySubtitle={
              timesheets.length > 0 && filteredTimesheets.length === 0
                ? "Try adjusting or clearing your filters to see more results."
                : "Submitted contractor timesheets will appear here when action is required."
            }
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            totalItems={totalItems}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        )}
      </div>

      {rejectingIds && (
        <RejectTimesheetModal
          count={rejectingIds.length}
          onClose={() => setRejectingIds(null)}
          onConfirm={async (reason) => {
            if (rejectingIds.length === 1) {
              await handleReview(rejectingIds[0], "REJECTED", reason);
            } else {
              await handleBulkReview("REJECTED", reason);
            }
            setRejectingIds(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}
