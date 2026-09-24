/**
 * Presentation utility for deterministic, stable contractor skill badge styling.
 *
 * Rules:
 * 1. Same skill (case/whitespace insensitive) -> exact same color every time.
 * 2. Known core skills retain currently established approved styles.
 * 3. Unknown/new/future skills are assigned deterministically via a stable string hash
 *    over an accessible, enterprise-grade color theme palette.
 * 4. Zero Math.random(), zero reliance on contractor IDs, row index, state, or storage.
 */

/**
 * Normalizes a skill string for identity comparison and deterministic color lookup.
 * @param {string} skill
 * @returns {string}
 */
export function normalizeSkill(skill) {
  if (skill === null || skill === undefined) return "";
  return String(skill).trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Established styles for known core skills to preserve existing visual hierarchy.
 */
export const KNOWN_SKILL_THEMES = Object.freeze({
  frontend: {
    bg: "#f5f3ff",
    text: "#6d28d9",
    border: "#ddd6fe",
    dot: "#8b5cf6",
  },
  backend: {
    bg: "#ecfdf5",
    text: "#047857",
    border: "#a7f3d0",
    dot: "#10b981",
  },
  qa: {
    bg: "#f0f9ff",
    text: "#0369a1",
    border: "#bae6fd",
    dot: "#0ea5e9",
  },
  data: {
    bg: "#fffbeb",
    text: "#b45309",
    border: "#fde68a",
    dot: "#f59e0b",
  },
  design: {
    bg: "#fff1f2",
    text: "#be123c",
    border: "#fecdd3",
    dot: "#f43f5e",
  },
  devops: {
    bg: "#eef2ff",
    text: "#3730a3",
    border: "#c7d2fe",
    dot: "#4f46e5",
  },
});

/** Neutral fallback used strictly when skill is empty or undefined. */
export const DEFAULT_NEUTRAL_SKILL_THEME = Object.freeze({
  bg: "#f8fafc",
  text: "#475569",
  border: "#e2e8f0",
  dot: "#94a3b8",
});

/**
 * Deterministic string hash function (djb2 variant).
 * @param {string} str
 * @returns {number} Non-negative 32-bit integer
 */
export function hashSkill(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generates a deterministic, constrained HSL theme for an arbitrary skill string.
 * Saturation and lightness are tightly constrained for professional, high-contrast,
 * accessible enterprise badges:
 * - Background: very light tint (L: 96%, S: 65%)
 * - Text: dark, readable, high contrast > 7:1 (L: 24%, S: 75%)
 * - Border: medium-light framing (L: 85%, S: 50%)
 * - Dot: strong vibrant indicator (L: 45%, S: 75%)
 *
 * @param {string} skill
 * @returns {{ bg: string, text: string, border: string, dot: string }}
 */
export function generateSkillThemeFromHash(skill) {
  const normalized = normalizeSkill(skill);
  const hash = hashSkill(normalized);
  const hue = hash % 360;

  return {
    bg: `hsl(${hue}, 65%, 96%)`,
    text: `hsl(${hue}, 75%, 24%)`,
    border: `hsl(${hue}, 50%, 85%)`,
    dot: `hsl(${hue}, 75%, 45%)`,
  };
}

/**
 * 14 restrained, accessible enterprise-grade theme palettes for optional discrete use.
 * Preserved for backwards compatibility with existing consumers.
 */
export const EXTENDED_SKILL_PALETTE = Object.freeze([
  // 0: Indigo
  { bg: "#eef2ff", text: "#3730a3", border: "#c7d2fe", dot: "#6366f1" },
  // 1: Teal
  { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4", dot: "#14b8a6" },
  // 2: Cyan
  { bg: "#ecfeff", text: "#0e7490", border: "#a5f3fc", dot: "#06b6d4" },
  // 3: Fuchsia
  { bg: "#fdf4ff", text: "#a21caf", border: "#f5d0fe", dot: "#d946ef" },
  // 4: Lime / Olive
  { bg: "#f7fee7", text: "#3f6212", border: "#d9f99d", dot: "#65a30d" },
  // 5: Orange
  { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa", dot: "#f97316" },
  // 6: Blue
  { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6" },
  // 7: Purple
  { bg: "#faf5ff", text: "#7e22ce", border: "#e9d5ff", dot: "#a855f7" },
  // 8: Pink
  { bg: "#fdf2f8", text: "#be185d", border: "#fbcfe8", dot: "#ec4899" },
  // 9: Deep Emerald
  { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0", dot: "#059669" },
  // 10: Slate / Steel
  { bg: "#f1f5f9", text: "#1e293b", border: "#cbd5e1", dot: "#475569" },
  // 11: Warm Amber
  { bg: "#fffbeb", text: "#92400e", border: "#fde68a", dot: "#d97706" },
  // 12: Vivid Rose
  { bg: "#fff1f2", text: "#9f1239", border: "#fecdd3", dot: "#e11d48" },
  // 13: Electric Violet
  { bg: "#f5f3ff", text: "#5b21b6", border: "#ddd6fe", dot: "#7c3aed" },
]);

/**
 * Resolves a stable, deterministic badge theme for any skill string.
 * @param {string} skill
 * @returns {{ bg: string, text: string, border: string, dot: string }}
 */
export function getSkillTheme(skill) {
  const normalized = normalizeSkill(skill);
  if (!normalized) {
    return DEFAULT_NEUTRAL_SKILL_THEME;
  }

  if (Object.prototype.hasOwnProperty.call(KNOWN_SKILL_THEMES, normalized)) {
    return KNOWN_SKILL_THEMES[normalized];
  }

  return generateSkillThemeFromHash(normalized);
}
