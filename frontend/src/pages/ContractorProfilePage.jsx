import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import PrimaryButton from "../components/PrimaryButton";
import { inputClassName } from "../components/FormField";
import { SKILLS, SKILL_LABELS } from "../constants/skills";
import contractorProfileService from "../services/contractorProfileService";
import "./ContractorProfilePage.css";

const newSkill = () => ({ code: "", proficiency: "INTERMEDIATE", years_experience: 0, is_primary: false });

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </svg>
  );
}

export default function ContractorProfilePage() {
  const [profile, setProfile] = useState({ phone: "", headline: "", total_experience_years: "", skills: [] });
  const [loading, setLoading] = useState(true); const [error, setError] = useState(null); const [saved, setSaved] = useState(null); const [saving, setSaving] = useState(false);
  useEffect(() => { (async () => { try { const p = await contractorProfileService.getProfile(); setProfile({ phone: p.phone || "", headline: p.headline || "", total_experience_years: p.total_experience_years ?? "", skills: p.skills || [] }); } catch (e) { setError(e.message); } finally { setLoading(false); } })(); }, []);
  const changeSkill = (index, field, value) => setProfile((p) => ({ ...p, skills: p.skills.map((s, i) => i === index ? { ...s, [field]: value } : field === "is_primary" && value ? { ...s, is_primary: false } : s) }));
  const submit = async (e) => { e.preventDefault(); setError(null); setSaved(null); if (profile.skills.length && profile.skills.filter((s) => s.is_primary).length !== 1) return setError("Choose one primary skill."); setSaving(true); try { const result = await contractorProfileService.updateProfile({ phone: profile.phone, headline: profile.headline, total_experience_years: profile.total_experience_years === "" ? null : Number(profile.total_experience_years), skills: profile.skills }); setProfile((p) => ({ ...p, skills: result.skills })); setSaved("Your profile has been saved."); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  return (
    <DashboardLayout title="My Profile">
      <div className="ui-form-page mx-auto flex max-w-2xl flex-col gap-5">
        <h1 className="text-xl font-semibold text-text">My Profile</h1>
        {loading ? <Spinner label="Loading your profile…" /> : (
          <form onSubmit={submit} className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6">
            <AlertBanner message={error} />
            <AlertBanner message={saved} variant="success" />
            <label className="text-sm font-medium text-text-secondary">
              Professional headline
              <input className={inputClassName(false)} value={profile.headline} maxLength="160" onChange={(e) => setProfile({ ...profile, headline: e.target.value })} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-text-secondary">
                Phone
                <input className={inputClassName(false)} value={profile.phone} maxLength="30" onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              </label>
              <label className="text-sm font-medium text-text-secondary">
                Total experience (years)
                <input className={inputClassName(false)} type="number" min="0" max="99.9" step="0.1" value={profile.total_experience_years} onChange={(e) => setProfile({ ...profile, total_experience_years: e.target.value })} />
              </label>
            </div>

            <section className="contractor-profile-skills" aria-labelledby="contractor-profile-skills-title">
              <div className="contractor-profile-skills-heading">
                <h2 id="contractor-profile-skills-title" className="font-medium text-text">Skills</h2>
                <button type="button" onClick={() => setProfile({ ...profile, skills: [...profile.skills, newSkill()] })} className="text-sm font-medium text-primary">Add skill</button>
              </div>
              {profile.skills.length > 0 ? (
                <>
                  <div className="contractor-profile-skill-columns" data-testid="contractor-profile-skill-columns" aria-hidden="true">
                    <span>Skill</span>
                    <span>Proficiency</span>
                    <span>Experience (years)</span>
                    <span>Primary</span>
                    <span />
                  </div>
                  <div
                    className={`contractor-profile-skills-list${profile.skills.length > 3 ? " is-scrollable" : ""}`}
                    data-testid="contractor-profile-skills-list"
                  >
                    {profile.skills.map((skill, index) => (
                      <div key={index} className="contractor-profile-skill-row" data-testid="contractor-profile-skill-row">
                      <select aria-label={`Skill ${index + 1}`} className={inputClassName(false)} value={skill.code} onChange={(e) => changeSkill(index, "code", e.target.value)}>
                        <option value="">Select skill</option>
                        {SKILLS.map((code) => <option key={code} value={code}>{SKILL_LABELS[code]}</option>)}
                      </select>
                      <select aria-label={`Proficiency ${index + 1}`} className={inputClassName(false)} value={skill.proficiency} onChange={(e) => changeSkill(index, "proficiency", e.target.value)}>
                        {["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"].map((v) => <option key={v}>{v}</option>)}
                      </select>
                      <label className="contractor-profile-experience-field">
                        <span>Experience (years)</span>
                        <input className={inputClassName(false)} type="number" min="0" max="99.9" step="0.1" value={skill.years_experience} onChange={(e) => changeSkill(index, "years_experience", e.target.value)} aria-label={`Years of experience ${index + 1}`} />
                      </label>
                      <label className="contractor-profile-primary-control">
                        <input type="radio" checked={skill.is_primary} onChange={() => changeSkill(index, "is_primary", true)} />
                        Primary
                      </label>
                      <button
                        type="button"
                        className="contractor-profile-delete-skill"
                        onClick={() => setProfile({ ...profile, skills: profile.skills.filter((_, i) => i !== index) })}
                        aria-label={`Remove skill ${index + 1}`}
                        title="Remove skill"
                      >
                        <TrashIcon />
                      </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted">Add skills to be considered for future staffing.</p>
              )}
            </section>

            <p className="text-xs text-muted">Changes affect future staffing only. Existing assignments and financial history remain unchanged.</p>
            <PrimaryButton isLoading={saving} loadingText="Saving…" fullWidth={false}>Save profile</PrimaryButton>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
