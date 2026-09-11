import { useEffect, useState } from "react";
import Modal from "../Modal";
import PrimaryButton from "../PrimaryButton";
import AlertBanner from "../AlertBanner";
import Spinner from "../Spinner";
import { formatSkill } from "../../constants/skills";
import intelligenceService from "../../services/intelligenceService";
import vendorRateIntelligenceService from "../../services/vendorRateIntelligenceService";
import VendorRateIntelligencePanel from "./VendorRateIntelligencePanel";

/**
 * Contractor picker scoped to ONE project + ONE requirement, reworked
 * for multi-contractor candidate submission: a checkbox per eligible
 * contractor, capped at the requirement's open slots. Each submitted
 * candidate remains pending until the PM accepts or rejects it.
 *
 * `contractors` here is already the server-filtered eligible list (own
 * Vendor, active, matching skill, compliant and date-valid — see
 * vendorProjectService.getEligibleContractors /
 * contractorRepository.listEligibleForVendorAndSkill), so nothing is
 * re-filtered client-side; this component only handles selection.
 *
 * MVP FIX 1 ("work-hour allocation must belong to the PM, not the
 * Vendor"): this modal deliberately has NO hours input anywhere — the
 * Vendor's only job is proposing candidates. Allocating hours after PM
 * acceptance is a PM-only control; this component never reads or sends
 * an hours value.
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
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(project.end_date || "");
  const [rateCapability, setRateCapability] = useState(false);
  const [proposedRate, setProposedRate] = useState("");
  const [rateAnalysis, setRateAnalysis] = useState(null);
  const [isAnalyzingRate, setIsAnalyzingRate] = useState(false);
  const [rateAnalysisError, setRateAnalysisError] = useState(null);

  const remaining = Math.max(requirement.required_count - requirement.assigned_count, 0);
  const isFull = remaining === 0;

  useEffect(() => {
    let active = true;
    intelligenceService.getCapabilities()
      .then((response) => { if (active) setRateCapability(response.capabilities.vendor_rate_intelligence === true); })
      .catch(() => { if (active) setRateCapability(false); });
    return () => { active = false; };
  }, []);

  // Any commercial context change invalidates advisory output immediately.
  useEffect(() => {
    setRateAnalysis((current) => current ? { stale: true, message: "Commercial context changed. Re-analyze to refresh Rate Intelligence." } : current);
    setRateAnalysisError(null);
  }, [project.id, requirement.id]);

  const toggleContractor = (id) => {
    setFormError(null);
    setRateAnalysis((current) => current ? { stale: true, message: "Contractor selection changed. Re-analyze to refresh Rate Intelligence." } : current);
    setRateAnalysisError(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= remaining) return prev; // capped at remaining open slots
      return [...prev, id];
    });
  };

  const updateProposedRate = (value) => {
    setProposedRate(value);
    // A changed proposed rate invalidates the server response. Do not retain
    // its values: every margin, finding, and recommendation belongs only to
    // the exact request that produced it.
    setRateAnalysis((current) => current ? { stale: true, message: "Proposed rate changed. Re-analyze to refresh Rate Intelligence." } : current);
    setRateAnalysisError(null);
  };

  const handleAnalyzeRate = async () => {
    if (selectedIds.length !== 1 || proposedRate === "" || Number(proposedRate) < 0) return;
    setIsAnalyzingRate(true);
    setRateAnalysisError(null);
    try {
      const result = await vendorRateIntelligenceService.analyzeRate({
        contractorId: selectedIds[0],
        projectId: project.id,
        requirementId: requirement.id,
        proposedBillRate: Number(proposedRate),
      });
      setRateAnalysis({ result, stale: false });
    } catch {
      setRateAnalysis(null);
      setRateAnalysisError(true);
    } finally {
      setIsAnalyzingRate(false);
    }
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
      await onAssign(selectedIds, { startDate, endDate: endDate || null });
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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-text-secondary">
              Assignment start date
              <input type="date" required value={startDate} min={project.start_date} max={project.end_date || undefined} onChange={(e) => setStartDate(e.target.value)} className="mt-1 block w-full rounded border border-border px-2 py-1.5 text-text" />
            </label>
            <label className="text-sm text-text-secondary">
              Assignment end date <span className="text-muted">(optional)</span>
              <input type="date" value={endDate} min={startDate || project.start_date} max={project.end_date || undefined} onChange={(e) => setEndDate(e.target.value)} className="mt-1 block w-full rounded border border-border px-2 py-1.5 text-text" />
            </label>
          </div>

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

          {rateCapability && <VendorRateIntelligencePanel
            selectedContractorId={selectedIds.length === 1 ? selectedIds[0] : null}
            projectId={project.id}
            requirementId={requirement.id}
            proposedRate={proposedRate}
            onProposedRateChange={updateProposedRate}
            analysis={rateAnalysis}
            isLoading={isAnalyzingRate}
            error={rateAnalysisError}
            onAnalyze={handleAnalyzeRate}
          />}

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
              Submit Selected ({selectedIds.length})
            </PrimaryButton>
          </div>
        </form>
      )}
    </Modal>
  );
}
