import { useEffect, useState } from "react";
import PrimaryButton from "../PrimaryButton";
import AlertBanner from "../AlertBanner";
import Spinner from "../Spinner";
import { formatSkill } from "../../constants/skills";
import { getInitials } from "../contractors/format";
import intelligenceService from "../../services/intelligenceService";
import vendorRateIntelligenceService from "../../services/vendorRateIntelligenceService";
import VendorRateIntelligencePanel from "./VendorRateIntelligencePanel";

/**
 * Enterprise Assign Contractor / Candidate Picker Modal:
 * Scoped to ONE project + ONE requirement for candidate submission.
 * Checkbox per eligible contractor, capped at open requirement slots.
 * Features compact enterprise typography, summary strip, date picker,
 * horizontally-scrollable table, Rate Intelligence, and fixed header/footer.
 */
export default function AssignContractorModal({
  project,
  requirement,
  contractors = [],
  isLoading,
  loadError,
  onClose,
  onAssign,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(project.end_date || "");
  const [rateCapability, setRateCapability] = useState(false);
  const [proposedRate, setProposedRate] = useState("");
  const [rateAnalysis, setRateAnalysis] = useState(null);
  const [isAnalyzingRate, setIsAnalyzingRate] = useState(false);
  const [rateAnalysisError, setRateAnalysisError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const remaining = Math.max(requirement.required_count - requirement.assigned_count, 0);
  const isFull = remaining === 0;

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    intelligenceService.getCapabilities()
      .then((response) => { if (active) setRateCapability(response.capabilities.vendor_rate_intelligence === true); })
      .catch(() => { if (active) setRateCapability(false); });
    return () => { active = false; };
  }, []);

  // Any commercial context change invalidates advisory output immediately.
  useEffect(() => {
    setRateAnalysis((current) => current ? { stale: true, message: "Commercial context changed. Re-analyze to refresh Rate Intelligence." } : current);
    setRateAnalysisError(null);
  }, [project.id, requirement.id]);

  const toggleContractor = (id) => {
    setFormError(null);
    setRateAnalysis((current) => current ? { stale: true, message: "Contractor selection changed. Re-analyze to refresh Rate Intelligence." } : current);
    setRateAnalysisError(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= remaining) return prev; // capped at remaining open slots
      return [...prev, id];
    });
  };

  const updateProposedRate = (value) => {
    setProposedRate(value);
    setRateAnalysis((current) => current ? { stale: true, message: "Proposed rate changed. Re-analyze to refresh Rate Intelligence." } : current);
    setRateAnalysisError(null);
  };

  const handleAnalyzeRate = async () => {
    if (selectedIds.length !== 1 || proposedRate === "" || Number(proposedRate) < 0) return;
    setIsAnalyzingRate(true);
    setRateAnalysisError(null);
    try {
      const result = await vendorRateIntelligenceService.analyzeRate({
        contractorId: selectedIds[0],
        projectId: project.id,
        requirementId: requirement.id,
        proposedBillRate: Number(proposedRate),
      });
      setRateAnalysis({ result, stale: false });
    } catch {
      setRateAnalysis(null);
      setRateAnalysisError(true);
    } finally {
      setIsAnalyzingRate(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (selectedIds.length === 0) {
      setFormError("Select at least one contractor.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAssign(selectedIds, { startDate, endDate: endDate || null });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredContractors = contractors.filter((c) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (c.name || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-5 bg-slate-950/45 backdrop-blur-sm overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-contractors-modal-title"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-[860px] max-h-[calc(100dvh-32px)] rounded-[18px] sm:rounded-[20px] bg-white border border-slate-200/80 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="assign-contractor-modal"
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 border border-blue-100/80 shadow-xs mt-0.5">
              <UsersIcon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                id="assign-contractors-modal-title"
                className="text-lg sm:text-[21px] font-bold text-slate-900 tracking-tight leading-snug"
              >
                Assign {formatSkill(requirement.skill)} Contractors
              </h2>
              <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5 leading-tight">
                Assign contractors to work on the {formatSkill(requirement.skill)} role for this project.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Form wrapping scrollable content and pinned footer */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-5 flex flex-col gap-4">
            {/* Project Summary Strip */}
            <div
              className="shrink-0 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              data-testid="assign-project-summary-strip"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200/70 shadow-xs text-slate-600">
                  <BuildingIcon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-[15px] font-bold text-slate-900 leading-snug truncate">
                    {project.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-tight truncate">
                    <span className="font-medium text-slate-700">{project.company_name}</span>
                    {project.pm_name && <span> · PM: {project.pm_name}</span>}
                  </p>
                </div>
              </div>

              {/* Metrics */}
              <div className="flex items-center divide-x divide-slate-200 text-center shrink-0 self-start sm:self-center bg-white sm:bg-transparent rounded-lg sm:rounded-none p-1.5 sm:p-0 border sm:border-0 border-slate-200/70">
                <div className="px-3 sm:px-4 first:pl-2 sm:first:pl-0">
                  <div className="text-[11px] font-medium text-slate-500">Required</div>
                  <div className="text-sm sm:text-base font-bold text-blue-600 mt-0.5">
                    {requirement.required_count}
                  </div>
                </div>
                <div className="px-3 sm:px-4">
                  <div className="text-[11px] font-medium text-slate-500">Assigned</div>
                  <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                    {requirement.assigned_count}
                  </div>
                </div>
                <div className="px-3 sm:px-4 last:pr-2 sm:last:pr-0">
                  <div className="text-[11px] font-medium text-slate-500">Remaining</div>
                  <div className={`text-sm sm:text-base font-bold mt-0.5 ${remaining > 0 ? "text-emerald-600" : "text-slate-500"}`}>
                    {remaining}
                  </div>
                </div>
              </div>
            </div>

            {formError && (
              <div className="shrink-0">
                <AlertBanner message={formError} />
              </div>
            )}

            {isFull && (
              <div className="shrink-0 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-xs sm:text-sm text-slate-500">
                This requirement is already fully staffed.
              </div>
            )}

            {/* Assignment Dates */}
            <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <label className="text-xs sm:text-[12.5px] font-medium text-slate-700">
                Assignment start date
                <div className="relative mt-1">
                  <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="date"
                    required
                    aria-label="Assignment start date"
                    value={startDate}
                    min={project.start_date}
                    max={project.end_date || undefined}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10 sm:h-[42px] block w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </label>
              <label className="text-xs sm:text-[12.5px] font-medium text-slate-700">
                Assignment end date <span className="text-slate-400 font-normal">(optional)</span>
                <div className="relative mt-1">
                  <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="date"
                    aria-label="Assignment end date"
                    value={endDate}
                    min={startDate || project.start_date}
                    max={project.end_date || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10 sm:h-[42px] block w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </label>
            </div>

            {!isFull && !isLoading && !loadError && contractors.length > 0 && contractors.length < remaining && (
              <p className="shrink-0 rounded-lg bg-blue-50/60 border border-blue-100/70 px-3.5 py-2 text-xs text-blue-800">
                Only {contractors.length} eligible contractor{contractors.length === 1 ? "" : "s"}{" "}
                {contractors.length === 1 ? "is" : "are"} currently available (remaining slots: {remaining}).
              </p>
            )}

            {/* Contractor Candidate Selection Panel */}
            <div
              className="shrink-0 rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-xs"
              data-testid="contractor-selection-section"
            >
              {/* Header with Search */}
              <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div className="text-xs sm:text-[13px] font-semibold text-slate-800">
                  Select up to {remaining} contractor{remaining === 1 ? "" : "s"}
                </div>
                <div className="relative w-full sm:w-[260px]">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    aria-label="Search contractors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search contractors..."
                    className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-xs sm:text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {loadError ? (
                <div className="p-4">
                  <AlertBanner message={loadError} />
                </div>
              ) : (
                /* Table with Horizontal Scroll */
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[480px]">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="w-12 px-3.5 py-2.5 text-center"></th>
                        <th className="px-3.5 py-2.5">Name</th>
                        <th className="px-3.5 py-2.5">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoading ? (
                        <tr>
                          <td colSpan={3} className="py-10 text-center">
                            <Spinner label="Loading eligible contractors…" />
                          </td>
                        </tr>
                      ) : contractors.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-xs sm:text-sm text-slate-500" data-testid="no-contractors-message">
                            No eligible contractors found for this role.
                          </td>
                        </tr>
                      ) : filteredContractors.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-xs sm:text-sm text-slate-500">
                            No contractors match &ldquo;{searchTerm}&rdquo;.
                          </td>
                        </tr>
                      ) : (
                        filteredContractors.map((c) => {
                          const checked = selectedIds.includes(c.id);
                          const disableUnchecked = !checked && (isFull || selectedIds.length >= remaining);
                          return (
                            <tr
                              key={c.id}
                              onClick={() => !disableUnchecked && toggleContractor(c.id)}
                              className={`h-[48px] sm:h-[52px] transition-colors ${
                                checked ? "bg-blue-50/40" : "hover:bg-slate-50/70"
                              } ${disableUnchecked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                              data-testid={`contractor-row-${c.id}`}
                            >
                              <td className="w-12 px-3.5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${c.name}`}
                                  checked={checked}
                                  disabled={disableUnchecked}
                                  onChange={() => toggleContractor(c.id)}
                                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-3.5 py-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className="contractor-avatar shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center border border-violet-200/60"
                                    aria-hidden="true"
                                    data-testid={`avatar-${c.id}`}
                                  >
                                    {getInitials(c.name)}
                                  </div>
                                  <span className="text-xs sm:text-[13.5px] font-semibold text-slate-900 leading-snug truncate">
                                    {c.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3.5 py-2 text-xs text-slate-500 truncate">
                                {c.email}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Rate Intelligence Section */}
            {rateCapability && (
              <div className="shrink-0">
                <VendorRateIntelligencePanel
                  selectedContractorId={selectedIds.length === 1 ? selectedIds[0] : null}
                  projectId={project.id}
                  requirementId={requirement.id}
                  proposedRate={proposedRate}
                  onProposedRateChange={updateProposedRate}
                  analysis={rateAnalysis}
                  isLoading={isAnalyzingRate}
                  error={rateAnalysisError}
                  onAnalyze={handleAnalyzeRate}
                />
              </div>
            )}
          </div>

          {/* Footer with Divider */}
          <div className="flex-shrink-0 px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-100 bg-white flex items-center justify-end gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 sm:h-10 px-4 shrink-0 whitespace-nowrap rounded-lg sm:rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
            >
              Cancel
            </button>
            <PrimaryButton
              type="submit"
              fullWidth={false}
              isLoading={isSubmitting}
              loadingText="Assigning…"
              disabled={selectedIds.length === 0 || isFull}
              className="h-9 sm:h-10 px-4 shrink-0 whitespace-nowrap rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold shadow-xs"
            >
              Submit Selected ({selectedIds.length})
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function UsersIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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

function SearchIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
