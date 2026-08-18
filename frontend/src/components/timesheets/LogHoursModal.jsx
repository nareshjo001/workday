import { useMemo, useState } from "react";
import Modal from "../Modal";
import FormField, { inputClassName } from "../FormField";
import PrimaryButton from "../PrimaryButton";
import AlertBanner from "../AlertBanner";

const MAX_HOURS_PER_DAY = 24;

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

const initialForm = { projectId: "", workDate: "", hoursLogged: "" };

/**
 * `projects` is the contractor's own list of currently ACTIVE assigned
 * projects (filtered by the parent page from GET /contractor/projects —
 * see ContractorTimesheetsPage) so the dropdown only ever offers
 * projects the contractor is actually assigned to, never a free-text
 * project id.
 *
 * The date input's min/max attributes below (derived from the selected
 * project's own start_date/end_date, and "today" as the hard upper
 * bound) are a UX convenience ONLY — they steer a contractor away from
 * an obviously-invalid date before they even submit, but they are not
 * the security boundary. The backend independently re-validates the
 * exact same window server-side
 * (contractorTimesheetService.assertWorkDateWithinProject) against a
 * freshly-fetched project row, and rejects anything outside it
 * regardless of what this form's date picker would have allowed — a
 * hand-built request that skips this UI entirely gets the same 400.
 */
export default function LogHoursModal({ projects, onClose, onSubmit }) {
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((p) => String(p.id) === String(form.projectId)) || null,
    [projects, form.projectId]
  );

  const today = todayDateString();
  const minDate = selectedProject?.start_date || undefined;
  const maxDate = selectedProject?.end_date && selectedProject.end_date < today ? selectedProject.end_date : today;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const errors = {};

    if (!form.projectId) errors.projectId = "Select a project.";

    if (!form.workDate) {
      errors.workDate = "Select the date you worked.";
    } else if (form.workDate > today) {
      errors.workDate = "Date cannot be in the future.";
    } else if (selectedProject && form.workDate < selectedProject.start_date) {
      errors.workDate = "Date cannot be before the project's start date.";
    } else if (selectedProject?.end_date && form.workDate > selectedProject.end_date) {
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
      });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Log Hours" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <AlertBanner message={formError} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="projectId" className="text-sm font-medium text-text-secondary">
            Project
          </label>
          <select
            id="projectId"
            name="projectId"
            value={form.projectId}
            onChange={handleChange}
            className={inputClassName(fieldErrors.projectId)}
          >
            <option value="">Select project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {fieldErrors.projectId && <p className="text-sm text-error">{fieldErrors.projectId}</p>}
          {projects.length === 0 && (
            <p className="text-xs text-muted">
              You have no active project assignments to log hours against.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="workDate" className="text-sm font-medium text-text-secondary">
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
            className={inputClassName(fieldErrors.workDate)}
          />
          {fieldErrors.workDate && <p className="text-sm text-error">{fieldErrors.workDate}</p>}
        </div>

        <FormField
          id="hoursLogged"
          label="Hours Logged"
          type="number"
          value={form.hoursLogged}
          onChange={handleChange}
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
          <PrimaryButton
            isLoading={isSubmitting}
            loadingText="Submitting…"
            disabled={projects.length === 0}
            className="flex-1"
          >
            Submit
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
