import { useState } from "react";
import Modal from "../Modal";
import PrimaryButton from "../PrimaryButton";
import AlertBanner from "../AlertBanner";

const initialForm = { name: "", thresholdHours: "", description: "", sequenceOrder: "", dueDate: "" };

function FlagIcon({ className = "h-5 w-5" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4" />
      <path d="M5 5c4-3 8 3 14 0v9c-6 3-10-3-14 0" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

function FieldIcon({ type }) {
  const paths = {
    flag: <><path d="M6 21V4" /><path d="M6 5c4-3 7 3 12 0v8c-5 3-8-3-12 0" /></>,
    document: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 12h6M9 16h5" /></>,
    hash: <><path d="M10 3 8 21M16 3l-2 18M4 9h16M3 15h16" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  };
  return (
    <svg aria-hidden="true" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[type]}
    </svg>
  );
}

const inputClass = (hasError) => `h-11 w-full rounded-lg border bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 ${hasError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"}`;

function FieldError({ id, message }) {
  return message ? <p id={id} role="alert" className="mt-1 text-xs font-medium text-red-600">{message}</p> : null;
}

/**
 * PM creates a milestone for the currently selected PROJECT (project
 * hours/allocation redesign: milestones are project-scoped, not
 * per-contractor — every contractor staffed on the project contributes
 * hours toward the same shared threshold, apportioned chronologically by
 * checkAndTriggerMilestones on the backend). The old contractor picker is
 * gone entirely; there is no per-milestone contractor to select anymore.
 */
export default function CreateMilestoneModal({ onClose, onCreate }) {
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = "Name is required.";

    const threshold = Number(form.thresholdHours);
    if (!form.thresholdHours || !Number.isFinite(threshold) || threshold <= 0) {
      errors.thresholdHours = "Enter a positive number of hours.";
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
      await onCreate({
        name: form.name.trim(),
        thresholdHours: Number(form.thresholdHours),
        description: form.description || null, sequenceOrder: form.sequenceOrder ? Number(form.sequenceOrder) : null, dueDate: form.dueDate || null,
      });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Create Milestone"
      subtitle="Define a project milestone and set the hours threshold that triggers it."
      icon={<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700" aria-hidden="true"><FlagIcon className="h-6 w-6" /></span>}
      onClose={onClose}
      lockDocumentScroll
      panelClassName="flex max-h-[calc(100dvh-32px)] !max-w-[800px] flex-col overflow-hidden !rounded-[20px] !p-0 shadow-2xl sm:!p-0"
      headerClassName="relative mb-0 shrink-0 overflow-hidden bg-gradient-to-r from-white via-white to-blue-50/70 px-5 py-4 sm:px-6 [&>div:first-child]:items-center [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:tracking-tight [&_p]:mt-0.5 [&_p]:text-sm [&_p]:leading-5"
    >
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div data-testid="create-milestone-body" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          <AlertBanner message={formError} />

          <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/80 px-3.5 py-2.5 text-xs text-blue-900 sm:items-center">
            <span className="mt-0.5 shrink-0 text-blue-600 sm:mt-0"><InfoIcon /></span>
            <p className="leading-5">This milestone applies to the whole project — every contractor staffed on it contributes toward the same hours threshold.</p>
          </div>

          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-slate-800">Milestone Name <span className="text-red-600" aria-hidden="true">*</span></label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-blue-600"><FieldIcon type="flag" /></span>
              <input id="name" name="name" autoFocus required value={form.name} onChange={handleChange} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "name-error" : undefined} placeholder="e.g. Phase 1 Completion" className={inputClass(fieldErrors.name)} />
            </div>
            <FieldError id="name-error" message={fieldErrors.name} />
          </div>

          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-semibold text-slate-800">Description <span className="font-normal text-slate-500">(optional)</span></label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-3 text-slate-500"><FieldIcon type="document" /></span>
              <textarea id="description" name="description" rows={3} value={form.description} onChange={handleChange} placeholder="Deliverable or checkpoint" className="h-20 min-h-20 w-full resize-y rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm leading-5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sequenceOrder" className="mb-1.5 block text-sm font-semibold text-slate-800">Sequence <span className="font-normal text-slate-500">(optional)</span></label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500"><FieldIcon type="hash" /></span>
                <input id="sequenceOrder" name="sequenceOrder" type="number" value={form.sequenceOrder} onChange={handleChange} placeholder="e.g. 1" className={inputClass(false)} />
              </div>
              <p className="mt-1 text-xs text-slate-500">Order in which this milestone appears.</p>
            </div>
            <div>
              <label htmlFor="dueDate" className="mb-1.5 block text-sm font-semibold text-slate-800">Due date <span className="font-normal text-slate-500">(optional)</span></label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500"><FieldIcon type="calendar" /></span>
                <input id="dueDate" name="dueDate" type="date" value={form.dueDate} onChange={handleChange} className={inputClass(false)} />
              </div>
              <p className="mt-1 text-xs text-slate-500">Target date for this milestone.</p>
            </div>
          </div>

          <div>
            <label htmlFor="thresholdHours" className="mb-1.5 block text-sm font-semibold text-slate-800">Hours Threshold <span className="text-red-600" aria-hidden="true">*</span></label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-blue-600"><FieldIcon type="clock" /></span>
              <input id="thresholdHours" name="thresholdHours" type="number" required value={form.thresholdHours} onChange={handleChange} aria-invalid={Boolean(fieldErrors.thresholdHours)} aria-describedby={fieldErrors.thresholdHours ? "thresholdHours-error" : "thresholdHours-help"} placeholder="e.g. 40" className={inputClass(fieldErrors.thresholdHours)} />
            </div>
            <p id="thresholdHours-help" className="mt-1 text-xs text-slate-500">Total hours that need to be contributed to mark this milestone as met.</p>
            <FieldError id="thresholdHours-error" message={fieldErrors.thresholdHours} />
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse justify-end gap-2.5 border-t border-slate-200 bg-white px-5 py-3.5 sm:flex-row sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 sm:w-auto"
          >
            Cancel
          </button>
          <PrimaryButton isLoading={isSubmitting} loadingText="Creating…" fullWidth={false} className="h-10 !w-full !rounded-lg !px-5 !py-0 !text-sm sm:!w-auto">
            <FlagIcon className="h-4 w-4" />
            Create Milestone
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
