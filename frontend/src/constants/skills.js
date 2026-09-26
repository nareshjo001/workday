// Keep contractor skill codes aligned with the backend definitions.
export const SKILLS = Object.freeze(["FRONTEND", "BACKEND", "QA", "DEVOPS", "DATA"]);

export const SKILL_LABELS = Object.freeze({
  FRONTEND: "Frontend",
  BACKEND: "Backend",
  QA: "QA",
  DEVOPS: "DevOps",
  DATA: "Data",
});

export function formatSkill(skill) {
  return skill ? SKILL_LABELS[skill] || skill : "—";
}
