import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NEUTRAL_SKILL_THEME,
  KNOWN_SKILL_THEMES,
  generateSkillThemeFromHash,
  getSkillTheme,
  hashSkill,
  normalizeSkill,
} from "./skillTheme";

describe("skillTheme utility", () => {
  describe("normalizeSkill", () => {
    it("normalizes case and trims whitespace", () => {
      expect(normalizeSkill("Frontend")).toBe("frontend");
      expect(normalizeSkill("FRONTEND")).toBe("frontend");
      expect(normalizeSkill("  frontend  ")).toBe("frontend");
      expect(normalizeSkill("  ML   Engineer  ")).toBe("ml engineer");
    });

    it("handles null, undefined, and empty string safely", () => {
      expect(normalizeSkill(null)).toBe("");
      expect(normalizeSkill(undefined)).toBe("");
      expect(normalizeSkill("")).toBe("");
      expect(normalizeSkill("   ")).toBe("");
    });
  });

  describe("Known Core Skill Distinctness", () => {
    it("proves Design theme !== DevOps theme", () => {
      const designTheme = getSkillTheme("Design");
      const devOpsTheme = getSkillTheme("DevOps");

      expect(designTheme).not.toEqual(devOpsTheme);
      expect(designTheme.text).not.toBe(devOpsTheme.text);
      expect(designTheme.bg).not.toBe(devOpsTheme.bg);
      expect(designTheme.border).not.toBe(devOpsTheme.border);
      expect(designTheme.dot).not.toBe(devOpsTheme.dot);
    });

    it("proves Frontend !== Backend !== QA !== Data !== Design !== DevOps (all distinct)", () => {
      const coreSkills = ["Frontend", "Backend", "QA", "Data", "Design", "DevOps"];
      const themes = coreSkills.map((skill) => ({
        skill,
        theme: getSkillTheme(skill),
      }));

      for (let i = 0; i < themes.length; i++) {
        for (let j = i + 1; j < themes.length; j++) {
          expect(
            themes[i].theme,
            `Expected ${themes[i].skill} theme to differ from ${themes[j].skill} theme`
          ).not.toEqual(themes[j].theme);
        }
      }
    });

    it("preserves exact approved styles for known core skills", () => {
      expect(getSkillTheme("Frontend")).toEqual(KNOWN_SKILL_THEMES.frontend);
      expect(getSkillTheme("Backend")).toEqual(KNOWN_SKILL_THEMES.backend);
      expect(getSkillTheme("QA")).toEqual(KNOWN_SKILL_THEMES.qa);
      expect(getSkillTheme("Data")).toEqual(KNOWN_SKILL_THEMES.data);
      expect(getSkillTheme("Design")).toEqual(KNOWN_SKILL_THEMES.design);
      expect(getSkillTheme("DevOps")).toEqual(KNOWN_SKILL_THEMES.devops);
    });
  });

  describe("getSkillTheme - Stability & Case Normalization", () => {
    it("returns identical theme for same skill regardless of casing or surrounding whitespace", () => {
      const themeUpper = getSkillTheme("FRONTEND");
      const themeLower = getSkillTheme("frontend");
      const themeMixed = getSkillTheme("  fRoNtEnD  ");

      expect(themeUpper).toEqual(KNOWN_SKILL_THEMES.frontend);
      expect(themeLower).toEqual(KNOWN_SKILL_THEMES.frontend);
      expect(themeMixed).toEqual(KNOWN_SKILL_THEMES.frontend);
    });

    it("proves getSkillTheme('ML Engineer') === getSkillTheme('ml engineer')", () => {
      const mixedCase = getSkillTheme("ML Engineer");
      const lowerCase = getSkillTheme("ml engineer");
      const padded = getSkillTheme("   ML   Engineer   ");

      expect(mixedCase).toEqual(lowerCase);
      expect(mixedCase).toEqual(padded);
    });

    it("proves getSkillTheme('Cloud Engineer') is stable across repeated calls", () => {
      const call1 = getSkillTheme("Cloud Engineer");
      const call2 = getSkillTheme("Cloud Engineer");
      const call3 = getSkillTheme("Cloud Engineer");

      expect(call1).toEqual(call2);
      expect(call2).toEqual(call3);
    });

    it("unknown/new skills do NOT fall back to generic grey, but generate constrained HSL themes", () => {
      const mlTheme = getSkillTheme("ML Engineer");
      const cloudTheme = getSkillTheme("Cloud Engineer");
      const securityTheme = getSkillTheme("Security");

      expect(mlTheme).not.toEqual(DEFAULT_NEUTRAL_SKILL_THEME);
      expect(cloudTheme).not.toEqual(DEFAULT_NEUTRAL_SKILL_THEME);
      expect(securityTheme).not.toEqual(DEFAULT_NEUTRAL_SKILL_THEME);

      // Verify constrained HSL structure
      [mlTheme, cloudTheme, securityTheme].forEach((theme) => {
        expect(theme.bg).toMatch(/^hsl\(\d+, 65%, 96%\)$/);
        expect(theme.text).toMatch(/^hsl\(\d+, 75%, 24%\)$/);
        expect(theme.border).toMatch(/^hsl\(\d+, 50%, 85%\)$/);
        expect(theme.dot).toMatch(/^hsl\(\d+, 75%, 45%\)$/);
      });
    });

    it("proves no Math.random() is used anywhere", () => {
      const spy = vi.spyOn(Math, "random");
      getSkillTheme("Some Future Skill");
      getSkillTheme("Frontend");
      getSkillTheme("DevOps");
      getSkillTheme("ML Engineer");
      getSkillTheme("Cloud Engineer");
      generateSkillThemeFromHash("Custom Role");
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("falls back to neutral style only when skill string is empty, null, or undefined", () => {
      expect(getSkillTheme("")).toEqual(DEFAULT_NEUTRAL_SKILL_THEME);
      expect(getSkillTheme("   ")).toEqual(DEFAULT_NEUTRAL_SKILL_THEME);
      expect(getSkillTheme(null)).toEqual(DEFAULT_NEUTRAL_SKILL_THEME);
      expect(getSkillTheme(undefined)).toEqual(DEFAULT_NEUTRAL_SKILL_THEME);
    });
  });

  describe("generateSkillThemeFromHash", () => {
    it("generates deterministic theme from skill identity", () => {
      const themeA = generateSkillThemeFromHash("Rust Developer");
      const themeB = generateSkillThemeFromHash("rust developer");
      expect(themeA).toEqual(themeB);
    });

    it("produces valid HSL values with safe, readable constraints", () => {
      const theme = generateSkillThemeFromHash("Blockchain");
      expect(theme.bg).toMatch(/^hsl\(\d+, 65%, 96%\)$/);
      expect(theme.text).toMatch(/^hsl\(\d+, 75%, 24%\)$/);
      expect(theme.border).toMatch(/^hsl\(\d+, 50%, 85%\)$/);
      expect(theme.dot).toMatch(/^hsl\(\d+, 75%, 45%\)$/);
    });
  });

  describe("hashSkill", () => {
    it("produces a stable non-negative integer", () => {
      const hash1 = hashSkill("frontend");
      const hash2 = hashSkill("frontend");
      expect(hash1).toBe(hash2);
      expect(Number.isInteger(hash1)).toBe(true);
      expect(hash1).toBeGreaterThanOrEqual(0);
    });
  });
});
