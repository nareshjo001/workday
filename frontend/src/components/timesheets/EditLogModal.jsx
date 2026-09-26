import { useState } from "react";
import Modal from "../Modal";
import FormField, { inputClassName } from "../FormField";
import PrimaryButton from "../PrimaryButton";
import AlertBanner from "../AlertBanner";

const MAX_HOURS_PER_DAY = 24;

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

// Edit drafts in place; rejected corrections return to DRAFT for explicit resubmission.
export default function EditLogModal({ log, project, onClose, onSubmit }) {
  const [workDate, setWorkDate] = useState(log.work_date);
  const [hoursLogged, setHoursLogged] = useState(String(log.hours_logged));
  const [description, setDescription] = useState(log.description || "");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = todayDateString();
  const minDate = project?.project_start_date || undefined;
  const maxDate = project?.project_end_date && project.project_end_date < today ? project.project_end_date : today;

  const validate = () => {
    const errors = {};

    if (!workDate) {
      errors.workDate = "Select the date you worked.";
    } else if (workDate > today) {
      errors.workDate = "Date cannot be in the future.";
    } else if (project && workDate < project.project_start_date) {
      errors.workDate = "Date cannot be before the project's start date.";
    } else if (project?.project_end_date && workDate > project.project_end_date) {
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
      await onSubmit({ workDate, hoursLogged: Number(hoursLogged), description });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRejected = log.status === "REJECTED";
  const title = isRejected ? "Edit Rejected Log" : "Edit Draft Log";
  const helperText = isRejected
    ? "Editing this log returns it to drafts so you can resubmit it for review."
    : "Editing this log updates your saved draft.";
  const submitLabel = isRejected ? "Resubmit" : "Save Changes";
  const loadingLabel = isRejected ? "Resubmitting…" : "Saving…";

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <AlertBanner message={formError} />
        <p className="text-sm text-muted">
          {helperText}
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
        <FormField id="editDescription" label="Work Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you work on?" />

        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
          >
            Cancel
          </button>
          <PrimaryButton isLoading={isSubmitting} loadingText={loadingLabel} className="flex-1">
            {submitLabel}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
