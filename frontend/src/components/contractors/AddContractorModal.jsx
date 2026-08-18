import { useState } from "react";
import Modal from "../Modal";
import FormField from "../FormField";
import PasswordField from "../PasswordField";
import PrimaryButton from "../PrimaryButton";
import AlertBanner from "../AlertBanner";

const initialForm = { name: "", email: "", password: "", hourly_rate: "" };

/**
 * `onCreate` does the actual API call and list update (owned by
 * VendorContractorsPage) and is expected to close this modal on success.
 * If it throws (validation/duplicate-email/network), the error is shown
 * inline and the modal stays open so the vendor can fix the input.
 */
export default function AddContractorModal({ onClose, onCreate }) {
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
    if (!form.email.trim()) errors.email = "Email is required.";
    if (!form.password) errors.password = "Password is required.";
    else if (form.password.length < 8) errors.password = "Password must be at least 8 characters.";

    if (form.hourly_rate === "") {
      errors.hourly_rate = "Hourly rate is required.";
    } else {
      const rate = Number(form.hourly_rate);
      if (Number.isNaN(rate) || rate < 0) errors.hourly_rate = "Enter a valid non-negative rate.";
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
        email: form.email.trim(),
        password: form.password,
        hourlyRate: Number(form.hourly_rate),
      });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Add Contractor" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <AlertBanner message={formError} />

        <FormField
          id="name"
          label="Name"
          value={form.name}
          onChange={handleChange}
          error={fieldErrors.name}
        />
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          error={fieldErrors.email}
        />
        <PasswordField
          id="password"
          label="Temporary Password"
          autoComplete="new-password"
          value={form.password}
          onChange={handleChange}
          error={fieldErrors.password}
        />
        <FormField
          id="hourly_rate"
          label="Hourly Rate"
          type="number"
          value={form.hourly_rate}
          onChange={handleChange}
          error={fieldErrors.hourly_rate}
        />

        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
          >
            Cancel
          </button>
          <PrimaryButton isLoading={isSubmitting} loadingText="Adding…" className="flex-1">
            Add Contractor
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
