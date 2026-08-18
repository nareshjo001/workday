import { useState } from "react";
import Modal from "../Modal";
import FormField, { inputClassName } from "../FormField";
import PrimaryButton from "../PrimaryButton";
import AlertBanner from "../AlertBanner";

const MAX_HOURS_PER_DAY = 24;

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Edits a single REJECTED daily log (PATCH /api/contractor/timesheets/:id)
 * — the only path a contractor has to change hours/date after a PM has
 * rejected a submission. `log` is the REJECTED row being edited; `project`
 * is that log's own project (looked up by the parent page from its
 * already-loaded assignment list) purely to derive the same date-bound
 * UX hints LogHoursModal shows — again a convenience only, not the
 * security boundary; contractorTimesheetService.updateTimesheet
 * re-validates the window server-side against a freshly-fetched project
 * row regardless.
 *
 * There is no project picker here — project_id is immutable on an edit
 * (enforced server-side by never accepting it from this request body at
 * all, see validateEditTimesheet), so the project name is shown as
 * read-only context instead.
 */
export default function EditLogModal({ log, project, onClose, onSubmit }) {
  const [workDate, setWorkDate] = useState(log.work_date);
  const [hoursLogged, setHoursLogged] = useState(String(log.hours_logged));
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = todayDateString();
  const minDate = project?.start_date || undefined;
  const maxDate = project?.end_date && project.end_date < today ? project.end_date : today;

  const validate = () => {
    const errors = {};

    if (!workDate) {
      errors.workDate = "Select the date you worked.";
    } else if (workDate > today) {
      errors.workDate = "Date cannot be in the future.";
    } else if (project && workDate < project.start_date) {
      errors.workDate = "Date cannot be before the project's start date.";
    } else if (project?.end_date && workDate > project.end_date) {
      errors.workDate = "Date cannot be after the project's end date.";
    }

    const hours = Number(hoursLogged);
    if (!hoursLogged || !Number.isFinite(hours)) {
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
      await onSubmit({ workDate, hoursLogged: Number(hoursLogged) });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Edit Rejected Log" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <AlertBanner message={formError} />
        <p className="text-sm text-muted">
          Editing this log resubmits it for review — its status will change back to Pending.
        </p>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-secondary">Project</span>
          <p className="text-sm text-text">{log.project_name}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="editWorkDate" className="text-sm font-medium text-text-secondary">
            Date Worked
          </label>
          <input
            id="editWorkDate"
            name="editWorkDate"
            type="date"
            value={workDate}
            onChange={(e) => {
              setWorkDate(e.target.value);
              setFieldErrors((prev) => ({ ...prev, workDate: undefined }));
            }}
            min={minDate}
            max={maxDate}
            className={inputClassName(fieldErrors.workDate)}
          />
          {fieldErrors.workDate && <p className="text-sm text-error">{fieldErrors.workDate}</p>}
        </div>

        <FormField
          id="editHoursLogged"
          label="Hours Logged"
          type="number"
          value={hoursLogged}
          onChange={(e) => {
            setHoursLogged(e.target.value);
            setFieldErrors((prev) => ({ ...prev, hoursLogged: undefined }));
          }}
          error={fieldErrors.hoursLogged}
          placeholder="e.g. 8 or 7.5"
        />

        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
          >
            Cancel
          </button>
          <PrimaryButton isLoading={isSubmitting} loadingText="Resubmitting…" className="flex-1">
            Resubmit
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
