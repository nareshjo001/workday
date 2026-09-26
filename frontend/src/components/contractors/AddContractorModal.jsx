import { useEffect, useState } from "react";
import AlertBanner from "../AlertBanner";

const initialForm = { name: "", email: "", hourly_rate: "" };

export default function AddContractorModal({ onClose, onCreate }) {
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = "Name is required.";
    if (!form.email.trim()) errors.email = "Email is required.";

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
        hourlyRate: Number(form.hourly_rate),
      });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="add-contractor-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-contractor-title"
      onClick={onClose}
    >
      <div
        className="add-contractor-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="add-contractor-frame" data-testid="add-contractor-frame">
          <div className="add-contractor-header">
            <div className="flex items-start sm:items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
              <div className="flex h-10 w-10 sm:h-11.5 sm:w-11.5 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-blue-50 text-blue-600 border border-blue-100/70 shadow-xs">
                <UserPlusIcon className="h-5 w-5 sm:h-5.5 sm:w-5.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="add-contractor-title" className="text-lg sm:text-[21px] font-bold text-slate-900 tracking-tight leading-tight">
                  Add Contractor
                </h2>
                <p className="mt-0.5 text-xs sm:text-[13px] text-slate-500 leading-snug">
                  Create a new contractor and send them an invite to set their password.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8.5 w-8.5 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
            >
              <CloseIcon className="h-4.5 w-4.5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="add-contractor-form">
            <AlertBanner message={formError} />

            <div className="flex flex-col">
              <label htmlFor="name" className="text-xs sm:text-[13px] font-semibold text-slate-800 mb-1 sm:mb-1.5">
                Name <span className="text-red-500 font-normal">*</span>
              </label>
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="add-contractor-field-icon">
                  <UserIcon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Enter full name"
                    className={`add-contractor-input ${fieldErrors.name ? "has-error" : ""}`}
                  />
                </div>
              </div>
              {fieldErrors.name && (
                <p className="mt-1 text-xs font-medium text-red-600 pl-12 sm:pl-13.5">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div className="flex flex-col">
              <label htmlFor="email" className="text-xs sm:text-[13px] font-semibold text-slate-800 mb-1 sm:mb-1.5">
                Email <span className="text-red-500 font-normal">*</span>
              </label>
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="add-contractor-field-icon">
                  <MailIcon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter email address"
                    className={`add-contractor-input ${fieldErrors.email ? "has-error" : ""}`}
                  />
                </div>
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-xs font-medium text-red-600 pl-12 sm:pl-13.5">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 rounded-lg bg-blue-50/80 border border-blue-100 px-3 sm:px-3.5 py-2 sm:py-2.5 text-blue-900">
              <InfoIcon className="h-4.5 w-4.5 shrink-0 text-blue-600" />
              <p className="text-xs sm:text-[13px] font-medium leading-relaxed">
                The contractor will receive a one-time email link to create their own password.
              </p>
            </div>

            <div className="flex flex-col">
              <label htmlFor="hourly_rate" className="text-xs sm:text-[13px] font-semibold text-slate-800 mb-1 sm:mb-1.5">
                Hourly Rate
              </label>
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="add-contractor-field-icon">
                  <TagIcon className="h-4.5 w-4.5 -scale-x-100" />
                </div>
                <div className={`add-contractor-rate-wrapper ${fieldErrors.hourly_rate ? "has-error" : ""}`}>
                  <span className="add-contractor-currency-addon" aria-hidden="true">
                    ₹
                  </span>
                  <input
                    id="hourly_rate"
                    name="hourly_rate"
                    type="number"
                    step="any"
                    min="0"
                    value={form.hourly_rate}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="add-contractor-rate-input"
                  />
                </div>
              </div>
              <div className="pl-12 sm:pl-13.5">
                {fieldErrors.hourly_rate ? (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    {fieldErrors.hourly_rate}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    Set the contractor&apos;s hourly rate (INR).
                  </p>
                )}
              </div>
            </div>

            <div className="add-contractor-footer">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial sm:w-auto min-w-[85px] h-9.5 sm:h-10.5 px-3.5 sm:px-4.5 rounded-lg border border-slate-300 bg-white font-medium text-xs sm:text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial sm:w-auto min-w-[140px] sm:min-w-[150px] h-9.5 sm:h-10.5 px-4 sm:px-5 rounded-lg bg-primary hover:bg-primary-hover active:bg-primary-active font-medium text-xs sm:text-sm text-white shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {isSubmitting ? (
                  <>
                    <SpinnerIcon className="h-4 w-4 animate-spin text-white" />
                    <span>Adding…</span>
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="h-4 w-4 text-white" />
                    <span>Add Contractor</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function UserPlusIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function UserIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MailIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function InfoIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function TagIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <circle cx="7" cy="7" r="1" fill="currentColor" />
    </svg>
  );
}

function CloseIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SpinnerIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
