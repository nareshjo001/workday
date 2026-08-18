import { useState } from "react";
import Modal from "../Modal";
import FormField from "../FormField";
import PrimaryButton from "../PrimaryButton";
import AlertBanner from "../AlertBanner";
import { inputClassName } from "../FormField";

/**
 * MVP edit interaction: hourly rate + status only, exactly what the
 * backend's PATCH /api/vendor/contractors/:id accepts. `onUpdate` does the
 * API call and list update, and is expected to close this modal on
 * success.
 */
export default function EditContractorModal({ contractor, onClose, onUpdate }) {
  const [hourlyRate, setHourlyRate] = useState(String(contractor.hourly_rate));
  const [status, setStatus] = useState(contractor.status);
  const [rateError, setRateError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setRateError(null);

    const rate = Number(hourlyRate);
    if (hourlyRate === "" || Number.isNaN(rate) || rate < 0) {
      setRateError("Enter a valid non-negative rate.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdate(contractor.id, { hourlyRate: rate, status });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Edit Contractor" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <AlertBanner message={formError} />

        <div>
          <p className="text-sm font-medium text-text">{contractor.name}</p>
          <p className="text-sm text-muted">{contractor.email}</p>
        </div>

        <FormField
          id="hourly_rate"
          label="Hourly Rate"
          type="number"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
          error={rateError}
          required={false}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium text-text-secondary">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClassName(false)}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>

        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
          >
            Cancel
          </button>
          <PrimaryButton isLoading={isSubmitting} loadingText="Saving…" className="flex-1">
            Save Changes
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
