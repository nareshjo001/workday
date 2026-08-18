/**
 * Centralized contractor-skill definitions — mirrors
 * backend/src/constants/skills.js. A contractor's skill answers "what
 * work can this contractor perform", a different concept from a user's
 * role (constants/roles.js — "what type of VMS user are you"). Never
 * hardcode skill strings elsewhere in the frontend.
 */
export const SKILLS = Object.freeze(["FRONTEND", "BACKEND", "QA", "DEVOPS", "DATA"]);

/** Display copy for skill selection/labels. */
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
