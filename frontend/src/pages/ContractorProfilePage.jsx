import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import PrimaryButton from "../components/PrimaryButton";
import { inputClassName } from "../components/FormField";
import { SKILLS, SKILL_LABELS } from "../constants/skills";
import contractorProfileService from "../services/contractorProfileService";

/**
 * Contractor's self-service profile: view + update their ONE primary
 * skill (Module 3 revision — multi-skill is explicitly out of scope for
 * this MVP). The backend derives the contractor from the JWT, so this
 * page never sends or reads a contractor id itself.
 */
export default function ContractorProfilePage() {
  const [skill, setSkill] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const profile = await contractorProfileService.getProfile();
        setSkill(profile.skill || "");
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!skill) {
      setFormError("Select a skill.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await contractorProfileService.updateSkill(skill);
      setSkill(result.skill);
      setSuccessMessage("Your primary skill has been updated.");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout title="My Profile">
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <h1 className="text-xl font-semibold text-text">My Profile</h1>

        {isLoading ? (
          <Spinner label="Loading your profile…" />
        ) : loadError ? (
          <AlertBanner message={loadError} />
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6"
          >
            <AlertBanner message={formError} />
            <AlertBanner message={successMessage} variant="success" />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="skill" className="text-sm font-medium text-text-secondary">
                Primary Skill
              </label>
              <select
                id="skill"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                className={inputClassName(false)}
              >
                <option value="">Select a skill…</option>
                {SKILLS.map((s) => (
                  <option key={s} value={s}>
                    {SKILL_LABELS[s]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted">
                This is what a Vendor matches you against when staffing a project. Changing it only
                affects future assignments — projects you're already on stay as they are.
              </p>
            </div>

            <PrimaryButton isLoading={isSaving} loadingText="Saving…" fullWidth={false} className="mt-1">
              Save
            </PrimaryButton>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
