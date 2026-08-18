import { useState } from "react";
import Modal from "../Modal";
import FormField from "../FormField";
import PrimaryButton from "../PrimaryButton";
import AlertBanner from "../AlertBanner";

const initialForm = { name: "", thresholdHours: "" };

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
      });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Create Milestone" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <AlertBanner message={formError} />

        <p className="text-sm text-muted">
          This milestone applies to the whole project — every contractor staffed on it contributes
          toward the same hours threshold.
        </p>

        <FormField
          id="name"
          label="Milestone Name"
          value={form.name}
          onChange={handleChange}
          error={fieldErrors.name}
          placeholder="e.g. Phase 1 Completion"
        />

        <FormField
          id="thresholdHours"
          label="Hours Threshold"
          type="number"
          value={form.thresholdHours}
          onChange={handleChange}
          error={fieldErrors.thresholdHours}
          placeholder="e.g. 40"
        />

        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
          >
            Cancel
          </button>
          <PrimaryButton isLoading={isSubmitting} loadingText="Creating…" className="flex-1">
            Create Milestone
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
