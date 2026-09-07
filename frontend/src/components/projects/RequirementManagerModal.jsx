import { useState } from "react";
import Modal from "../Modal";
import AlertBanner from "../AlertBanner";
import PrimaryButton from "../PrimaryButton";
import { formatSkill } from "../../constants/skills";

export default function RequirementManagerModal({ project, onClose, onSave }) {
  const [requirements, setRequirements] = useState(project.requirements || []);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const update = (id, field, value) => setRequirements((rows) => rows.map((row) => row.id === id ? { ...row, [field]: value } : row));
  const save = async (requirement) => {
    setError(null); setSavingId(requirement.id);
    try {
      const updated = await onSave(project.id, requirement.id, {
        required_count: Number(requirement.required_count), description: requirement.description || null, status: requirement.status,
      });
      setRequirements((rows) => rows.map((row) => row.id === updated.id ? { ...row, ...updated } : row));
    } catch (saveError) { setError(saveError.message); } finally { setSavingId(null); }
  };
  return <Modal title={`Staffing requirements: ${project.name}`} onClose={onClose}><div className="flex flex-col gap-4"><AlertBanner message={error} />
    <p className="text-sm text-muted">Closing a requirement stops new sourcing while preserving its assignment history. Counts cannot be lowered below active assignments.</p>
    {requirements.map((requirement) => <section key={requirement.id} className="rounded border border-border p-3"><div className="mb-2 flex justify-between gap-3"><strong>{formatSkill(requirement.skill)}</strong><span className="text-xs text-muted">{requirement.assigned_count} active assigned</span></div>
      <label className="block text-sm">Required people<input min="1" type="number" value={requirement.required_count} onChange={(event) => update(requirement.id, "required_count", event.target.value)} className="mt-1 block w-full rounded border border-border p-2" /></label>
      <label className="mt-2 block text-sm">Notes<textarea value={requirement.description || ""} onChange={(event) => update(requirement.id, "description", event.target.value)} className="mt-1 block min-h-16 w-full rounded border border-border p-2" /></label>
      <div className="mt-2 flex items-end justify-between gap-3"><label className="text-sm">Status<select value={requirement.status || "OPEN"} onChange={(event) => update(requirement.id, "status", event.target.value)} className="mt-1 block rounded border border-border p-2"><option value="OPEN">OPEN</option><option value="CLOSED">CLOSED</option></select></label><PrimaryButton fullWidth={false} isLoading={savingId === requirement.id} loadingText="Saving…" onClick={() => save(requirement)}>Save</PrimaryButton></div>
    </section>)}
  </div></Modal>;
}
