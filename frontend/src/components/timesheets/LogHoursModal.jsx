import { useEffect, useMemo, useState } from "react";
import AlertBanner from "../AlertBanner";
import ContractorTimesheetIntelligencePanel from "./ContractorTimesheetIntelligencePanel";
import intelligenceService from "../../services/intelligenceService";
import contractorTimesheetIntelligenceService from "../../services/contractorTimesheetIntelligenceService";

const MAX_HOURS_PER_DAY = 24;

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

const initialForm = { projectId: "", workDate: "", hoursLogged: "", description: "" };

/**
 * Enterprise Log Hours Modal:
 * Compact, polished enterprise modal matching the reference design:
 * ~600–620px desktop width, dark navy typography, full-width Project selector,
 * two-column Date + Hours row, compact Work Description, integrated Timesheet
 * Intelligence panel, and right-aligned Cancel / Save Draft actions.
 */
export default function LogHoursModal({ projects, onClose, onSubmit }) {
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [intelligenceEnabled, setIntelligenceEnabled] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStale, setAnalysisStale] = useState(false);

  useEffect(() => {
    let active = true;
    intelligenceService
      .getCapabilities()
      .then((response) => {
        if (active) {
          setIntelligenceEnabled(response.capabilities.contractor_timesheet_intelligence === true);
        }
      })
      .catch(() => {
        if (active) setIntelligenceEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const selectedProject = useMemo(
    () => projects.find((p) => String(p.id) === String(form.projectId)) || null,
    [projects, form.projectId]
  );

  const today = todayDateString();
  const minDate = selectedProject?.project_start_date || undefined;
  const maxDate =
    selectedProject?.project_end_date && selectedProject.project_end_date < today
      ? selectedProject.project_end_date
      : today;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    if (analysis) {
      setAnalysis(null);
      setAnalysisStale(true);
    }
    setAnalysisError(null);
  };

  const handleAnalyze = async () => {
    const hoursLogged = Number(form.hoursLogged);
    if (!form.projectId || !form.workDate || !Number.isFinite(hoursLogged) || hoursLogged <= 0) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisStale(false);
    try {
      const result = await contractorTimesheetIntelligenceService.analyzeTimesheet({
        projectId: Number(form.projectId),
        workDate: form.workDate,
        hoursLogged,
        description: form.description.trim() || undefined,
      });
      setAnalysis(result);
    } catch (err) {
      setAnalysis(null);
      setAnalysisError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const validate = () => {
    const errors = {};

    if (!form.projectId) errors.projectId = "Select a project.";

    if (!form.workDate) {
      errors.workDate = "Select the date you worked.";
    } else if (form.workDate > today) {
      errors.workDate = "Date cannot be in the future.";
    } else if (selectedProject && form.workDate < selectedProject.project_start_date) {
      errors.workDate = "Date cannot be before the project's start date.";
    } else if (selectedProject?.project_end_date && form.workDate > selectedProject.project_end_date) {
      errors.workDate = "Date cannot be after the project's end date.";
    }

    const hours = Number(form.hoursLogged);
    if (!form.hoursLogged || !Number.isFinite(hours)) {
      errors.hoursLogged = "Enter the number of hours worked.";
    } else if (hours <= 0) {
      errors.hoursLogged = "Hours must be greater than 0.";
    } else if (hours > MAX_HOURS_PER_DAY) {
      errors.hoursLogged = `Hours cannot exceed ${MAX_HOURS_PER_DAY} in a single day.`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        projectId: Number(form.projectId),
        workDate: form.workDate,
        hoursLogged: Number(form.hoursLogged),
        description: form.description.trim() || undefined,
      });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/45 backdrop-blur-xs overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-hours-modal-title"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-[540px] max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-32px)] rounded-xl sm:rounded-2xl bg-white border border-slate-200/90 shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pinned Header */}
        <div className="shrink-0 flex items-start justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 bg-white">
          <div>
            <h2
              id="log-hours-modal-title"
              className="text-xl sm:text-[22px] font-bold text-slate-900 tracking-tight leading-tight"
            >
              Log Hours
            </h2>
            <p className="mt-0.5 text-[13px] sm:text-sm text-slate-500">
              Record the time you worked on a project.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-1 -mr-1 -mt-0.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body with Internal Scroll and Pinned Footer */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Interior Container */}
          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col gap-2.5 sm:gap-3">
            {formError && <AlertBanner message={formError} />}

            {/* Project Row */}
            <div className="flex flex-col gap-1">
              <label htmlFor="projectId" className="text-[13px] sm:text-sm font-semibold text-slate-700">
                Project
              </label>
              <div className="relative">
                <select
                  id="projectId"
                  name="projectId"
                  value={form.projectId}
                  onChange={handleChange}
                  className={`w-full h-9.5 sm:h-10 appearance-none rounded-lg border bg-white px-3 pr-8 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                    fieldErrors.projectId ? "border-red-500 ring-1 ring-red-500/30" : "border-slate-200"
                  }`}
                >
                  <option value="">Select project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
              {fieldErrors.projectId && <p className="text-xs text-red-600">{fieldErrors.projectId}</p>}
              {projects.length === 0 && (
                <p className="text-xs text-slate-500">
                  You have no active project assignments to log hours against.
                </p>
              )}
            </div>

            {/* Date + Hours Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="workDate" className="text-[13px] sm:text-sm font-semibold text-slate-700">
                  Date Worked
                </label>
                <input
                  id="workDate"
                  name="workDate"
                  type="date"
                  value={form.workDate}
                  onChange={handleChange}
                  min={minDate}
                  max={maxDate}
                  className={`w-full h-9.5 sm:h-10 rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                    fieldErrors.workDate ? "border-red-500 ring-1 ring-red-500/30" : "border-slate-200"
                  }`}
                />
                {fieldErrors.workDate && <p className="text-xs text-red-600">{fieldErrors.workDate}</p>}
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="hoursLogged" className="text-[13px] sm:text-sm font-semibold text-slate-700">
                  Hours Logged
                </label>
                <input
                  id="hoursLogged"
                  name="hoursLogged"
                  type="number"
                  step="any"
                  value={form.hoursLogged}
                  onChange={handleChange}
                  placeholder="e.g. 8 or 7.5"
                  className={`w-full h-9.5 sm:h-10 rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                    fieldErrors.hoursLogged ? "border-red-500 ring-1 ring-red-500/30" : "border-slate-200"
                  }`}
                />
                {fieldErrors.hoursLogged && <p className="text-xs text-red-600">{fieldErrors.hoursLogged}</p>}
              </div>
            </div>

            {/* Work Description Row */}
            <div className="flex flex-col gap-1">
              <label htmlFor="description" className="text-[13px] sm:text-sm font-semibold text-slate-700">
                Work Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={2}
                value={form.description}
                onChange={handleChange}
                placeholder="What did you work on?"
                className="w-full h-15 sm:h-17 resize-y rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Timesheet Intelligence Panel */}
            {intelligenceEnabled && (
              <ContractorTimesheetIntelligencePanel
                proposal={form}
                analysis={analysis}
                stale={analysisStale}
                isLoading={isAnalyzing}
                error={analysisError}
                onAnalyze={handleAnalyze}
              />
            )}
          </div>

          {/* Pinned Footer */}
          <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-2.5 sm:px-5 sm:py-3 border-t border-slate-100 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="h-9 sm:h-9.5 px-3.5 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer min-w-[85px] sm:min-w-[90px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={projects.length === 0 || isSubmitting}
              className="h-9 sm:h-9.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-xs sm:text-sm font-medium text-white transition shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-w-[95px] sm:min-w-[100px] flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving…
                </>
              ) : (
                "Save Draft"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
