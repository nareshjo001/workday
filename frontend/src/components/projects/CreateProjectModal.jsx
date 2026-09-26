import { useState } from "react";
import Modal from "../Modal";
import AlertBanner from "../AlertBanner";
import { SKILLS, SKILL_LABELS } from "../../constants/skills";
import "./CreateProjectModal.css";

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

const initialForm = { name: "", description: "", start_date: "", end_date: "", expected_hours: "" };
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

    const expectedHours = Number(form.expected_hours);
    if (!form.expected_hours || !Number.isFinite(expectedHours) || expectedHours <= 0) {
      errors.expected_hours = "Enter a positive number of hours.";
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
        expectedHours: Number(form.expected_hours),
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
    <Modal
      title="Create Project"
      subtitle="Set up a new project with key details and staffing requirements."
      icon={
        <span className="create-project-header-icon" aria-hidden="true">
          <PlusIcon />
        </span>
      }
      onClose={onClose}
      panelClassName="create-project-modal"
      headerClassName="create-project-modal-header"
      lockDocumentScroll
    >
      <form onSubmit={handleSubmit} noValidate className="create-project-form">
        <div className="create-project-body">
          <AlertBanner message={formError} />

          <section className="create-project-section" aria-labelledby="basic-info-title">
            <header className="create-project-section-header">
              <div className="create-project-section-title-group">
                <span className="create-project-section-icon" aria-hidden="true">
                  <DocumentIcon />
                </span>
                <div>
                  <h3 id="basic-info-title" className="create-project-section-title">
                    Basic Information
                  </h3>
                  <p className="create-project-section-desc">
                    Add a name and description for the project.
                  </p>
                </div>
              </div>
            </header>

            <div className="create-project-field-stack">
              <div className="create-project-field">
                <label htmlFor="name" className="create-project-label">
                  Project Name <span className="create-project-required">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="e.g. Atlas Commerce Modernization"
                  value={form.name}
                  onChange={handleChange}
                  className={`create-project-input ${fieldErrors.name ? "create-project-input-error" : ""}`}
                />
                {fieldErrors.name && (
                  <p className="create-project-error-text" role="alert">
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              <div className="create-project-field">
                <label htmlFor="description" className="create-project-label">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  placeholder="Enter a brief description of the project..."
                  value={form.description}
                  onChange={handleChange}
                  className="create-project-textarea"
                />
              </div>
            </div>
          </section>

          <section className="create-project-section" aria-labelledby="timeline-title">
            <header className="create-project-section-header">
              <div className="create-project-section-title-group">
                <span className="create-project-section-icon" aria-hidden="true">
                  <CalendarIcon />
                </span>
                <div>
                  <h3 id="timeline-title" className="create-project-section-title">
                    Timeline & Capacity
                  </h3>
                  <p className="create-project-section-desc">
                    Set the project duration and total expected hours.
                  </p>
                </div>
              </div>
            </header>

            <div className="create-project-field-stack">
              <div className="create-project-grid-two">
                <div className="create-project-field">
                  <label htmlFor="start_date" className="create-project-label">
                    Start Date <span className="create-project-required">*</span>
                  </label>
                  <input
                    id="start_date"
                    name="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={handleChange}
                    className={`create-project-input ${fieldErrors.start_date ? "create-project-input-error" : ""}`}
                  />
                  {fieldErrors.start_date && (
                    <p className="create-project-error-text" role="alert">
                      {fieldErrors.start_date}
                    </p>
                  )}
                </div>

                <div className="create-project-field">
                  <label htmlFor="end_date" className="create-project-label">
                    End Date (optional)
                  </label>
                  <input
                    id="end_date"
                    name="end_date"
                    type="date"
                    value={form.end_date}
                    onChange={handleChange}
                    className={`create-project-input ${fieldErrors.end_date ? "create-project-input-error" : ""}`}
                  />
                  {fieldErrors.end_date && (
                    <p className="create-project-error-text" role="alert">
                      {fieldErrors.end_date}
                    </p>
                  )}
                </div>
              </div>

              <div className="create-project-field">
                <label htmlFor="expected_hours" className="create-project-label">
                  Expected Hours (total project capacity) <span className="create-project-required">*</span>
                </label>
                <div className="create-project-input-wrapper">
                  <span className="create-project-input-icon" aria-hidden="true">
                    <ClockIcon />
                  </span>
                  <input
                    id="expected_hours"
                    name="expected_hours"
                    type="number"
                    min="1"
                    step="any"
                    placeholder="e.g. 150"
                    value={form.expected_hours}
                    onChange={handleChange}
                    className={`create-project-input create-project-input-with-icon ${
                      fieldErrors.expected_hours ? "create-project-input-error" : ""
                    }`}
                  />
                </div>
                {fieldErrors.expected_hours && (
                  <p className="create-project-error-text" role="alert">
                    {fieldErrors.expected_hours}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="create-project-section" aria-labelledby="staffing-title">
            <header className="create-project-section-header">
              <div className="create-project-section-title-group">
                <span className="create-project-section-icon" aria-hidden="true">
                  <PeopleIcon />
                </span>
                <div>
                  <h3 id="staffing-title" className="create-project-section-title">
                    Staffing Requirements
                  </h3>
                  <p className="create-project-section-desc">
                    Add the skills and headcount needed for this project.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={addRequirementRow}
                disabled={requirements.length >= SKILLS.length}
                className="create-project-add-skill-btn"
              >
                <PlusSmallIcon />
                <span>Add skill</span>
              </button>
            </header>

            <div className="create-project-requirement-list">
              {requirements.map((row, index) => (
                <div key={index} className="create-project-requirement-row">
                  <div className="create-project-field">
                    <select
                      id={`skill-${index}`}
                      aria-label="Select skill"
                      value={row.skill}
                      onChange={(e) => handleRequirementChange(index, "skill", e.target.value)}
                      className={`create-project-select ${
                        requirementErrors[index]?.skill ? "create-project-select-error" : ""
                      }`}
                    >
                      <option value="">Select skill…</option>
                      {availableSkillsFor(row.skill).map((s) => (
                        <option key={s} value={s}>
                          {SKILL_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    {requirementErrors[index]?.skill && (
                      <p className="create-project-error-text" role="alert">
                        {requirementErrors[index].skill}
                      </p>
                    )}
                  </div>

                  <div className="create-project-field">
                    <div className="create-project-input-wrapper">
                      <span className="create-project-input-icon" aria-hidden="true">
                        <PeopleIcon />
                      </span>
                      <input
                        id={`count-${index}`}
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Count"
                        aria-label="Staffing headcount"
                        value={row.required_count}
                        onChange={(e) => handleRequirementChange(index, "required_count", e.target.value)}
                        className={`create-project-input create-project-input-with-icon ${
                          requirementErrors[index]?.required_count ? "create-project-input-error" : ""
                        }`}
                      />
                    </div>
                    {requirementErrors[index]?.required_count && (
                      <p className="create-project-error-text" role="alert">
                        {requirementErrors[index].required_count}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeRequirementRow(index)}
                    disabled={requirements.length <= 1}
                    aria-label="Remove requirement"
                    className="create-project-remove-row-btn"
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="create-project-footer">
          <div className="create-project-footer-actions">
            <button type="button" onClick={onClose} className="create-project-cancel-btn">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="create-project-submit-btn"
            >
              {isSubmitting ? (
                <span>Creating…</span>
              ) : (
                <>
                  <CheckIcon />
                  <span>Create Project</span>
                </>
              )}
            </button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function PlusSmallIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
