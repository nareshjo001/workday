import Modal from "../Modal";
import { StaffingProgress } from "./format";
import { formatSkill } from "../../constants/skills";

/**
 * Per-requirement breakdown for one project — required/assigned counts
 * per skill, with an "Assign X Contractor" action per open requirement
 * (Module 3 revision spec section 13). A filled requirement shows
 * "✓ Filled" instead of an assign button; the backend enforces this too
 * (over-assigning a full requirement is rejected with 409 regardless of
 * what the UI shows), this is just so the Vendor isn't invited to try.
 */
export default function ProjectTeamModal({ project, onClose, onAssignRequirement }) {
  return (
    <Modal title={project.name} onClose={onClose}>
      <p className="mb-4 text-sm text-muted">
        {project.company_name}
        {project.pm_name && <span> · PM: {project.pm_name}</span>}
      </p>

      <div className="flex flex-col gap-3">
        {project.requirements.map((req) => {
          const isFilled = req.assigned_count >= req.required_count;
          return (
            <div
              key={req.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div>
                <p className="font-medium text-text">{formatSkill(req.skill)}</p>
                <p className="text-sm text-text-secondary">
                  Required: {req.required_count} · Assigned:{" "}
                  <StaffingProgress assigned={req.assigned_count} required={req.required_count} />
                </p>
              </div>
              {isFilled ? (
                <span className="shrink-0 text-sm font-medium text-success">✓ Filled</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onAssignRequirement(req)}
                  className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  Assign {formatSkill(req.skill)} Contractor
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
