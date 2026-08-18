import { useState } from "react";
import Modal from "../Modal";
import PrimaryButton from "../PrimaryButton";
import AlertBanner from "../AlertBanner";
import Spinner from "../Spinner";
import { formatSkill } from "../../constants/skills";

/**
 * Contractor picker scoped to ONE project + ONE requirement, reworked
 * (vendor-centric workflow revision) for atomic MULTI-contractor
 * assignment: a checkbox per eligible contractor, capped at however many
 * open slots remain on the requirement, and one "Assign Selected" call
 * that either assigns everyone checked or fails the whole batch.
 *
 * `contractors` here is already the server-filtered eligible list (own
 * vendor, ACTIVE, matching skill, not assigned to ANY project — see
 * vendorProjectService.getEligibleContractors /
 * contractorRepository.listEligibleForVendorAndSkill), so nothing is
 * re-filtered client-side; this component only handles selection +
 * the remaining-slots cap.
 */
export default function AssignContractorModal({
  project,
  requirement,
  contractors,
  isLoading,
  loadError,
  onClose,
  onAssign,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remaining = Math.max(requirement.required_count - requirement.assigned_count, 0);
  const isFull = remaining === 0;

  const toggleContractor = (id) => {
    setFormError(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= remaining) return prev; // capped at remaining open slots
      return [...prev, id];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (selectedIds.length === 0) {
      setFormError("Select at least one contractor.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAssign(selectedIds);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Assign ${formatSkill(requirement.skill)} Contractors`} onClose={onClose}>
      <p className="mb-1 text-sm text-muted">
        {project.name} · {project.company_name}
      </p>
      <p className="mb-4 text-sm text-text-secondary">
        Required: {requirement.required_count} · Assigned: {requirement.assigned_count} · Remaining:{" "}
        {remaining}
      </p>

      {isFull ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-6 text-center text-sm text-muted">
          This requirement is already fully staffed.
        </div>
      ) : isLoading ? (
        <Spinner label="Loading eligible contractors…" />
      ) : loadError ? (
        <AlertBanner message={loadError} />
      ) : contractors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-6 text-center text-sm text-muted">
          No eligible {formatSkill(requirement.skill)} contractors are currently available — every
          matching contractor is either inactive, missing this skill, or already assigned to another
          project.
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <AlertBanner message={formError} />

          {contractors.length < remaining && (
            <p className="rounded-md bg-surface-muted px-3 py-2 text-xs text-muted">
              Only {contractors.length} eligible contractor{contractors.length === 1 ? "" : "s"}{" "}
              {contractors.length === 1 ? "is" : "are"} currently available (remaining slots: {remaining}).
            </p>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-text-secondary">
              Select up to {remaining} contractor{remaining === 1 ? "" : "s"}
            </span>
            <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
              {contractors.map((c) => {
                const checked = selectedIds.includes(c.id);
                const disableUnchecked = !checked && selectedIds.length >= remaining;
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2.5 rounded px-2 py-2 text-sm ${
                      disableUnchecked ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-surface-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disableUnchecked}
                      onChange={() => toggleContractor(c.id)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-accent"
                    />
                    <span className="text-text">{c.name}</span>
                    <span className="text-xs text-muted">{c.email}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
            >
              Cancel
            </button>
            <PrimaryButton
              isLoading={isSubmitting}
              loadingText="Assigning…"
              disabled={selectedIds.length === 0}
              className="flex-1"
            >
              Assign Selected ({selectedIds.length})
            </PrimaryButton>
          </div>
        </form>
      )}
    </Modal>
  );
}
