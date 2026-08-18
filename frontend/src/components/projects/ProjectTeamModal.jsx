import Modal from "../Modal";
import { formatDate, formatHours, StaffingProgress } from "./format";
import { formatSkill } from "../../constants/skills";

/**
 * Per-requirement breakdown for one project — required/assigned counts
 * per skill (an "X / Y" fraction via StaffingProgress) with an
 * "Assign X Contractor" action per open requirement. A filled
 * requirement shows "✓ Filled" instead of an assign button; the backend
 * enforces this too (over-assigning a full requirement is rejected with
 * 409 regardless of what the UI shows), this is just so the Vendor isn't
 * invited to try.
 *
 * Vendor Project Team revision: each requirement now also lists the
 * contractors actually filling it, with their Logged vs. Approved hours
 * on this project. This data rides on the SAME
 * GET /vendor/projects/:id/requirements response `project` already came
 * from (see vendorProjectService.getProjectDetail on the backend,
 * extended to attach `contractors` per requirement) — no second request,
 * no separate endpoint.
 *
 * Logged Hours = every hour this contractor has submitted on this
 * project regardless of review status. Approved Hours = only the subset
 * a PM has actually approved — it excludes both PENDING (not decided
 * yet) and REJECTED (decided against) hours on purpose, the same
 * "approved excludes rejected and pending" rule the daily timesheet
 * summary uses (see components/timesheets/weekGrouping.js).
 *
 * PROJECT HOURS/ALLOCATION REDESIGN: each contractor row also now carries
 * allocated_hours (their own committed share of the project's total
 * capacity), pending_hours (submitted but not yet reviewed), and
 * remaining_hours (allocated minus reserved — what they can still log
 * before hitting their cap, see contractorTimesheetService.
 * assertWithinRemainingAllocation on the backend). A contractor whose
 * assignment_status is RELEASED (project completed, or otherwise
 * released) is shown with a "Released" tag instead of Active/Inactive —
 * they're no longer able to log new hours here even though the row stays
 * for historical visibility.
 */
export default function ProjectTeamModal({ project, onClose, onAssignRequirement }) {
  return (
    <Modal title={project.name} onClose={onClose}>
      <div className="mb-4 flex flex-col gap-1 border-b border-border pb-4 text-sm text-muted">
        <p>
          {project.company_name}
          {project.pm_name && <span> · PM: {project.pm_name}</span>}
        </p>
        <p>
          {formatDate(project.start_date)} – {formatDate(project.end_date)}
        </p>
        <p className="text-text-secondary">
          Team: <StaffingProgress assigned={project.total_assigned} required={project.total_required} />
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {project.requirements.map((req) => {
          const isFilled = req.assigned_count >= req.required_count;
          return (
            <div key={req.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-text">{formatSkill(req.skill)}</p>
                  <p className="text-sm text-text-secondary">
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

              {req.contractors && req.contractors.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2.5 border-t border-border pt-3">
                  {req.contractors.map((c) => (
                    <li key={c.contractor_id} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-text">{c.name}</p>
                        <p className="text-xs text-muted">
                          {formatSkill(c.skill)} ·{" "}
                          {c.assignment_status === "RELEASED"
                            ? "Released"
                            : c.status === "ACTIVE"
                              ? "Active"
                              : "Inactive"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-xs text-text-secondary">
                        {c.allocated_hours !== null && c.allocated_hours !== undefined && (
                          <p>Allocated: {formatHours(c.allocated_hours)}h</p>
                        )}
                        <p>Logged: {formatHours(c.logged_hours)}h</p>
                        <p>Approved: {formatHours(c.approved_hours)}h</p>
                        {c.pending_hours !== null && c.pending_hours !== undefined && (
                          <p>Pending: {formatHours(c.pending_hours)}h</p>
                        )}
                        {c.remaining_hours !== null && c.remaining_hours !== undefined && (
                          <p>Remaining: {formatHours(c.remaining_hours)}h</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
                  No contractors assigned yet.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
