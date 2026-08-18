/**
 * Centralized contractor-skill definitions. A contractor's `skill`
 * answers "what work can this contractor perform" — a different concept
 * from a user's `role` (constants/roles.js), which answers "what type of
 * VMS user are you". Every skill check/comparison across the codebase
 * (contractors.skill, project_requirements.skill) must reference this
 * list rather than hardcoding skill strings. Matches the ENUM in
 * migrations 005/007.
 */
const SKILLS = Object.freeze(["FRONTEND", "BACKEND", "QA", "DEVOPS", "DATA"]);

module.exports = { SKILLS };
