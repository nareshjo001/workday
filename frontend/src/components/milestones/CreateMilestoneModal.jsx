import { useState } from "react";
import Modal from "../Modal";
import FormField from "../FormField";
import PrimaryButton from "../PrimaryButton";
import AlertBanner from "../AlertBanner";

const initialForm = { contractorId: "", name: "", thresholdHours: "" };

/**
 * PM creates a milestone for one contractor staffed on the currently
 * selected project. `contractors` is the project's assigned-contractor
 * roster (see pmProjectService.listAssignedContractors) — the picker is
 * scoped to exactly who's on this project, the same "you can only pick
 * from what's actually valid here" pattern AssignContractorModal already
 * uses for eligible contractors.
 */
export default function CreateMilestoneModal({ contractors, onClose, onCreate }) {
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
    if (!form.contractorId) errors.contractorId = "Select a contractor.";
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
        contractorId: Number(form.contractorId),
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

        <div className="flex flex-col gap-1.5">
          <label htmlFor="contractorId" className="text-sm font-medium text-text-secondary">
            Contractor
          </label>
          <select
            id="contractorId"
            name="contractorId"
            value={form.contractorId}
            onChange={handleChange}
            className={`w-full rounded-md border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition focus:ring-2 focus:ring-offset-0 ${
              fieldErrors.contractorId
                ? "border-error focus:border-error focus:ring-error/20"
                : "border-border focus:border-accent focus:ring-accent/20"
            }`}
          >
            <option value="">Select contractor…</option>
            {contractors.map((c) => (
              <option key={c.contractor_id} value={c.contractor_id}>
                {c.name}
              </option>
            ))}
          </select>
          {fieldErrors.contractorId && <p className="text-sm text-error">{fieldErrors.contractorId}</p>}
          {contractors.length === 0 && (
            <p className="text-xs text-muted">No contractors are assigned to this project yet.</p>
          )}
        </div>

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
