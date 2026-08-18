import { useState } from "react";
import Modal from "../Modal";
import FormField, { inputClassName } from "../FormField";
import PrimaryButton from "../PrimaryButton";
import AlertBanner from "../AlertBanner";
import { SKILLS, SKILL_LABELS } from "../../constants/skills";

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

const initialForm = { name: "", description: "", start_date: "", end_date: "" };
const emptyRequirementRow = () => ({ skill: "", required_count: "" });

export default function CreateProjectModal({ onClose, onCreate }) {
  const [form, setForm] = useState(initialForm);
  const [requirements, setRequirements] = useState([emptyRequirementRow()]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [requirementErrors, setRequirementErrors] = useState([]);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleRequirementChange = (index, field, value) => {
    setRequirements((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addRequirementRow = () => {
    setRequirements((prev) => [...prev, emptyRequirementRow()]);
  };

  const removeRequirementRow = (index) => {
    setRequirements((prev) => prev.filter((_, i) => i !== index));
  };

  // Skills already picked in another row aren't offered again — the
  // backend rejects duplicate skill requirements on the same project, so
  // the UI simply doesn't let you create that error in the first place.
  const availableSkillsFor = (currentSkill) =>
    SKILLS.filter((s) => s === currentSkill || !requirements.some((r) => r.skill === s));

  const validate = () => {
    const errors = {};
    const today = todayDateString();

    if (!form.name.trim()) errors.name = "Name is required.";

    if (!form.start_date) errors.start_date = "Start date is required.";
    else if (form.start_date < today) errors.start_date = "Start date cannot be in the past.";

    if (form.end_date) {
      if (form.end_date < today) errors.end_date = "End date cannot be in the past.";
      else if (form.start_date && form.end_date < form.start_date) {
        errors.end_date = "End date cannot be before start date.";
      }
    }

    const rowErrors = requirements.map((row) => {
      const rowErr = {};
      if (!row.skill) rowErr.skill = "Select a skill.";
      const count = Number(row.required_count);
      if (!row.required_count || !Number.isInteger(count) || count <= 0) {
        rowErr.required_count = "Enter a positive whole number.";
      }
      return rowErr;
    });
    const hasRowErrors = rowErrors.some((r) => Object.keys(r).length > 0);

    setFieldErrors(errors);
    setRequirementErrors(rowErrors);

    if (requirements.length === 0) {
      setFormError("Add at least one staffing requirement.");
      return false;
    }

    return Object.keys(errors).length === 0 && !hasRowErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onCreate({
        name: form.name.trim(),
        description: form.description.trim(),
        startDate: form.start_date,
        endDate: form.end_date,
        requirements: requirements.map((r) => ({
          skill: r.skill,
          requiredCount: Number(r.required_count),
        })),
      });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Create Project" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <AlertBanner message={formError} />

        <FormField
          id="name"
          label="Project Name"
          value={form.name}
          onChange={handleChange}
          error={fieldErrors.name}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium text-text-secondary">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={form.description}
            onChange={handleChange}
            className={inputClassName(false)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            id="start_date"
            label="Start Date"
            type="date"
            value={form.start_date}
            onChange={handleChange}
            error={fieldErrors.start_date}
          />
          <FormField
            id="end_date"
            label="End Date (optional)"
            type="date"
            value={form.end_date}
            onChange={handleChange}
            error={fieldErrors.end_date}
            required={false}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-secondary">Staffing Requirements</span>
            <button
              type="button"
              onClick={addRequirementRow}
              disabled={requirements.length >= SKILLS.length}
              className="text-sm font-medium text-accent hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add skill
            </button>
          </div>

          {requirements.map((row, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1">
                <select
                  value={row.skill}
                  onChange={(e) => handleRequirementChange(index, "skill", e.target.value)}
                  className={inputClassName(requirementErrors[index]?.skill)}
                >
                  <option value="">Select skill…</option>
                  {availableSkillsFor(row.skill).map((s) => (
                    <option key={s} value={s}>
                      {SKILL_LABELS[s]}
                    </option>
                  ))}
                </select>
                {requirementErrors[index]?.skill && (
                  <p className="mt-1 text-xs text-error">{requirementErrors[index].skill}</p>
                )}
              </div>
              <div className="w-28">
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Count"
                  value={row.required_count}
                  onChange={(e) => handleRequirementChange(index, "required_count", e.target.value)}
                  className={inputClassName(requirementErrors[index]?.required_count)}
                />
                {requirementErrors[index]?.required_count && (
                  <p className="mt-1 text-xs text-error">{requirementErrors[index].required_count}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeRequirementRow(index)}
                disabled={requirements.length <= 1}
                aria-label="Remove requirement"
                className="mt-2.5 shrink-0 text-sm font-medium text-muted hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
          >
            Cancel
          </button>
          <PrimaryButton isLoading={isSubmitting} loadingText="Creating…" className="flex-1">
            Create Project
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
