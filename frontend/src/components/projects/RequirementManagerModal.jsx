import { useState } from "react";
import Modal from "../Modal";
import AlertBanner from "../AlertBanner";
import PrimaryButton from "../PrimaryButton";
import { formatSkill } from "../../constants/skills";
import { getSkillTheme } from "../../utils/skillTheme";
import "./RequirementManagerModal.css";

export default function RequirementManagerModal({ project, onClose, onSave }) {
  const [requirements, setRequirements] = useState(project.requirements || []);
  const [dirtyIds, setDirtyIds] = useState(() => new Set());
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const update = (id, field, value) => {
    setRequirements((rows) => rows.map((row) => row.id === id ? { ...row, [field]: value } : row));
    setDirtyIds((current) => new Set(current).add(id));
  };

  const saveRequirements = async () => {
    const changedRequirements = requirements.filter((requirement) => dirtyIds.has(requirement.id));
    if (changedRequirements.length === 0) return;
    setError(null);
    setSaving(true);
    try {
      const saved = [];
      for (const requirement of changedRequirements) {
        const updated = await onSave(project.id, requirement.id, {
          required_count: Number(requirement.required_count),
          description: requirement.description || null,
          status: requirement.status || "OPEN",
        });
        saved.push(updated);
      }
      setRequirements((rows) => rows.map((row) => {
        const updated = saved.find((item) => item.id === row.id);
        return updated ? { ...row, ...updated } : row;
      }));
      setDirtyIds(new Set());
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Staffing requirements: ${project.name}`}
      subtitle="Define the roles, headcount, and status for this project. Closing a requirement stops new sourcing while preserving its assignment history."
      icon={<span className="requirement-manager-header-icon" aria-hidden="true"><PeopleIcon /></span>}
      onClose={onClose}
      panelClassName="requirement-manager-modal"
      headerClassName="requirement-manager-header"
      lockDocumentScroll
    >
      <div className="requirement-manager-shell">
        <div className="requirement-manager-body">
          <AlertBanner message={error} />
          <p className="requirement-manager-constraint">Required people cannot be lowered below the active assigned count.</p>

          {requirements.length > 0 ? requirements.map((requirement) => (
            <RequirementCard key={requirement.id} requirement={requirement} onUpdate={update} />
          )) : (
            <div className="requirement-manager-empty">No staffing requirements are defined for this project.</div>
          )}
        </div>

        <footer className="requirement-manager-footer">
          <button type="button" onClick={onClose} className="requirement-manager-cancel">Cancel</button>
          <PrimaryButton
            type="button"
            fullWidth={false}
            isLoading={saving}
            loadingText="Saving…"
            disabled={requirements.length === 0}
            onClick={saveRequirements}
            className="requirement-manager-save"
          >
            <CheckIcon />
            Save requirements
          </PrimaryButton>
        </footer>
      </div>
    </Modal>
  );
}

function RequirementCard({ requirement, onUpdate }) {
  const theme = getSkillTheme(requirement.skill);
  const assignedCount = Number(requirement.assigned_count || 0);
  const status = requirement.status || "OPEN";

  return (
    <section className="requirement-card" data-testid={`requirement-card-${requirement.id}`}>
      <header className="requirement-card-header">
        <span
          className="requirement-skill-icon"
          style={{ color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }}
          aria-hidden="true"
        >
          <SkillIcon skill={requirement.skill} />
        </span>
        <div className="requirement-card-identity">
          <h3>{formatSkill(requirement.skill)}</h3>
          <span>Staffing requirement</span>
        </div>
        <span className={`requirement-assigned-badge${assignedCount > 0 ? " is-active" : ""}`}>
          <PeopleIcon />
          {assignedCount} active assigned
        </span>
      </header>

      <div className="requirement-card-fields">
        <label className="requirement-field">
          <span>Required people <i aria-hidden="true">*</i></span>
          <input
            min="1"
            type="number"
            value={requirement.required_count}
            onChange={(event) => onUpdate(requirement.id, "required_count", event.target.value)}
          />
        </label>

        <label className="requirement-field">
          <span>Status</span>
          <span className="requirement-status-control" data-status={status}>
            <span className="requirement-status-dot" aria-hidden="true" />
            <select value={status} onChange={(event) => onUpdate(requirement.id, "status", event.target.value)}>
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </span>
        </label>

        <label className="requirement-field requirement-field--notes">
          <span>Notes</span>
          <textarea
            value={requirement.description || ""}
            onChange={(event) => onUpdate(requirement.id, "description", event.target.value)}
          />
          <small>{String(requirement.description || "").length}/500</small>
        </label>
      </div>
    </section>
  );
}

function SkillIcon({ skill }) {
  if (skill === "FRONTEND") return <MonitorIcon />;
  if (skill === "QA") return <ShieldIcon />;
  if (skill === "DEVOPS") return <GearIcon />;
  if (skill === "DATA") return <ChartIcon />;
  if (skill === "BACKEND") return <ServerIcon />;
  return <PeopleIcon />;
}

function PeopleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}

function ServerIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" /><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6" /></svg>;
}

function MonitorIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;
}

function ShieldIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg>;
}

function GearIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34A1.7 1.7 0 0 0 14 20.92V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" /></svg>;
}

function ChartIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>;
}
