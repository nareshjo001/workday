import { useState } from "react";
import Modal from "../Modal";
import AlertBanner from "../AlertBanner";
import PrimaryButton from "../PrimaryButton";
import "./ProjectSettingsModal.css";

export default function ProjectSettingsModal({ project, onClose, onSave, onComplete, isCompleting = false }) {
  const [form, setForm] = useState({
    name: project.name,
    description: project.description || "",
    start_date: project.start_date,
    end_date: project.end_date || "",
    expected_hours: project.expected_hours || "",
    budget: project.budget || "",
    currency: project.currency || "",
    max_hours_per_day: project.max_hours_per_day || "",
    max_hours_per_week: project.max_hours_per_week || "",
    backdate_limit_days: project.backdate_limit_days ?? "",
    candidate_response_sla_hours: project.candidate_response_sla_hours ?? 48,
    allow_weekend: !!project.allow_weekend,
    status: project.status,
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const statuses = project.status === "ACTIVE"
    ? ["ACTIVE", "ON_HOLD", "CANCELLED"]
    : project.status === "ON_HOLD"
      ? ["ON_HOLD", "ACTIVE", "CANCELLED"]
      : [project.status];

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(project.id, {
        ...form,
        description: form.description || null,
        end_date: form.end_date || null,
        expected_hours: Number(form.expected_hours),
        budget: form.budget === "" ? null : Number(form.budget),
        max_hours_per_day: form.max_hours_per_day === "" ? null : Number(form.max_hours_per_day),
        max_hours_per_week: form.max_hours_per_week === "" ? null : Number(form.max_hours_per_week),
        backdate_limit_days: form.backdate_limit_days === "" ? null : Number(form.backdate_limit_days),
        candidate_response_sla_hours: Number(form.candidate_response_sla_hours),
      });
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Project settings: ${project.name}`}
      subtitle="Manage project details, limits, and workflow settings."
      icon={<span className="project-settings-header-icon" aria-hidden="true"><SettingsIcon /></span>}
      onClose={onClose}
      panelClassName="project-settings-modal"
      headerClassName="project-settings-modal-header"
      lockDocumentScroll
    >
      <form onSubmit={submit} className="project-settings-form">
        <div className="project-settings-body">
          <AlertBanner message={error} />

          <SettingsSection title="Basic information" description="Set the core details for this project.">
            <div className="project-settings-stack">
              <Field label="Name" required icon={<DocumentIcon />}>
                <input value={form.name} onChange={(event) => set("name", event.target.value)} />
              </Field>
              <Field label="Description" icon={<DocumentIcon />}>
                <textarea value={form.description} onChange={(event) => set("description", event.target.value)} />
              </Field>
            </div>
          </SettingsSection>

          <SettingsSection title="Timeline & effort" description="Define the project duration and expected effort.">
            <div className="project-settings-grid project-settings-grid--three">
              <Field label="Start date" required icon={<CalendarIcon />}>
                <input type="date" value={form.start_date} onChange={(event) => set("start_date", event.target.value)} />
              </Field>
              <Field label="End date" icon={<CalendarIcon />}>
                <input type="date" value={form.end_date} onChange={(event) => set("end_date", event.target.value)} />
              </Field>
              <Field label="Expected hours" required icon={<ClockIcon />}>
                <input type="number" value={form.expected_hours} onChange={(event) => set("expected_hours", event.target.value)} />
              </Field>
            </div>
          </SettingsSection>

          <SettingsSection title="Budget & limits" description="Set financial details and time tracking limits.">
            <div className="project-settings-grid project-settings-grid--two">
              <Field label="Budget" icon={<BudgetIcon />}>
                <input type="number" value={form.budget} onChange={(event) => set("budget", event.target.value)} />
              </Field>
              <Field label="Currency" icon={<LayersIcon />}>
                <input value={form.currency} maxLength="3" onChange={(event) => set("currency", event.target.value.toUpperCase())} />
              </Field>
            </div>
            <div className="project-settings-grid project-settings-grid--three">
              <Field label="Daily limit" icon={<ClockIcon />}>
                <input type="number" value={form.max_hours_per_day} onChange={(event) => set("max_hours_per_day", event.target.value)} />
              </Field>
              <Field label="Weekly limit" icon={<ClockIcon />}>
                <input type="number" value={form.max_hours_per_week} onChange={(event) => set("max_hours_per_week", event.target.value)} />
              </Field>
              <Field label="Backdate limit (days)" icon={<BackdateIcon />}>
                <input type="number" value={form.backdate_limit_days} onChange={(event) => set("backdate_limit_days", event.target.value)} />
              </Field>
            </div>
            <Field label="Candidate response SLA (hours)" required icon={<ClockIcon />}>
              <input type="number" value={form.candidate_response_sla_hours} onChange={(event) => set("candidate_response_sla_hours", event.target.value)} />
            </Field>
          </SettingsSection>

          <SettingsSection title="Additional settings" description="Configure work rules and project status.">
            <div className="project-settings-additional">
              <label className="project-settings-check-field">
                <input type="checkbox" checked={form.allow_weekend} onChange={(event) => set("allow_weekend", event.target.checked)} />
                <span>
                  <strong>Allow weekend work</strong>
                  <small>Allow timesheets to be submitted on weekends.</small>
                </span>
              </label>
              <Field label="Status" required icon={<StatusIcon />} helper="Completion is separate because it releases active contractors after submitted timesheets are resolved.">
                <select value={form.status} onChange={(event) => set("status", event.target.value)}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </Field>
            </div>
          </SettingsSection>
        </div>

        <footer className="project-settings-footer">
          <button type="button" onClick={onClose} className="project-settings-cancel">Cancel</button>
          <div className="project-settings-footer-actions">
            {onComplete && (
              <button type="button" onClick={() => onComplete(project)} disabled={isCompleting} className="project-settings-complete">
                {isCompleting ? "Checking…" : "Complete project"}
              </button>
            )}
            <PrimaryButton type="submit" fullWidth={false} isLoading={saving} loadingText="Saving…" className="project-settings-save">
              <CheckIcon />
              Save settings
            </PrimaryButton>
          </div>
        </footer>
      </form>
    </Modal>
  );
}

function SettingsSection({ title, description, children }) {
  return (
    <section className="project-settings-section">
      <header>
        <h3>{title}</h3>
        <p>{description}</p>
      </header>
      <div className="project-settings-section-content">{children}</div>
    </section>
  );
}

function Field({ label, required = false, helper, icon, children }) {
  return (
    <label className="project-settings-field">
      <span>{label}{required && <i aria-hidden="true">*</i>}</span>
      {icon ? (
        <span className="project-settings-control">
          <span className="project-settings-control-icon" aria-hidden="true">{icon}</span>
          {children}
        </span>
      ) : children}
      {helper && <small>{helper}</small>}
    </label>
  );
}

function SettingsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.52-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>;
}

function DocumentIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 12h6M9 16h6" /></svg>;
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

function BudgetIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M15 8.5c-.7-.7-1.7-1-3-1-1.7 0-3 .9-3 2.2 0 3.3 6 1.5 6 4.6 0 1.3-1.3 2.2-3 2.2-1.3 0-2.4-.4-3.2-1.2M12 5.5v13" /></svg>;
}

function LayersIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></svg>;
}

function BackdateIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m11 7-5 5 5 5zM19 7l-5 5 5 5z" /></svg>;
}

function StatusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2" /></svg>;
}
