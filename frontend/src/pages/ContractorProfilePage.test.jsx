import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ContractorProfilePage from "./ContractorProfilePage";
import contractorProfileService from "../services/contractorProfileService";

vi.mock("../services/contractorProfileService", () => ({
  default: { getProfile: vi.fn(), updateProfile: vi.fn() },
}));
vi.mock("../layouts/DashboardLayout", () => ({ default: ({ children }) => <main>{children}</main> }));

const skillCodes = ["FRONTEND", "BACKEND", "QA", "DEVOPS", "DATA", "FRONTEND"];
const profileWithSkills = (count) => ({
  phone: "+1 555 123 4567",
  headline: "Primary demo backend specialist",
  total_experience_years: 6,
  skills: Array.from({ length: count }, (_, index) => ({
    code: skillCodes[index],
    proficiency: index % 2 ? "INTERMEDIATE" : "ADVANCED",
    years_experience: index + 1,
    is_primary: index === 0,
  })),
});

beforeEach(() => {
  vi.clearAllMocks();
  contractorProfileService.updateProfile.mockImplementation(async (payload) => payload);
});

async function renderWithSkillCount(count) {
  contractorProfileService.getProfile.mockResolvedValue(profileWithSkills(count));
  render(<ContractorProfilePage />);
  await screen.findByRole("heading", { name: "Skills" });
  return screen.getByTestId("contractor-profile-skills-list");
}

describe("Contractor profile skills layout", () => {
  test.each([1, 3])("renders %s vertical skill row(s) at natural height without scrolling", async (count) => {
    const list = await renderWithSkillCount(count);

    expect(within(list).getAllByTestId("contractor-profile-skill-row")).toHaveLength(count);
    expect(list).not.toHaveClass("is-scrollable");
    expect(list).not.toContainElement(screen.getByRole("heading", { name: "Skills" }));
    expect(list).not.toContainElement(screen.getByRole("button", { name: "Add skill" }));
  });

  test.each([4, 6])("caps %s vertical skill rows inside the internal scroll list", async (count) => {
    const list = await renderWithSkillCount(count);

    expect(within(list).getAllByTestId("contractor-profile-skill-row")).toHaveLength(count);
    expect(list).toHaveClass("is-scrollable");
  });

  test("uses icon-only delete controls while preserving the existing row-removal behavior", async () => {
    const list = await renderWithSkillCount(4);
    const deleteButtons = within(list).getAllByRole("button", { name: /Remove skill/ });

    expect(deleteButtons).toHaveLength(4);
    expect(screen.queryByText("Remove")).toBeNull();
    expect(deleteButtons.every((button) => button.querySelector("svg"))).toBe(true);

    fireEvent.click(deleteButtons[1]);
    await waitFor(() => expect(within(list).getAllByTestId("contractor-profile-skill-row")).toHaveLength(3));
    expect(list).not.toHaveClass("is-scrollable");
  });

  test("keeps the staffing note and Save profile action unchanged", async () => {
    await renderWithSkillCount(1);

    expect(screen.getByText("Changes affect future staffing only. Existing assignments and financial history remain unchanged.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save profile" })).toBeInTheDocument();
  });

  test("labels the per-skill experience value without changing its numeric contract", async () => {
    await renderWithSkillCount(1);

    const columns = screen.getByTestId("contractor-profile-skill-columns");
    expect(columns).toHaveTextContent("SkillProficiencyExperience (years)Primary");
    const experience = screen.getByRole("spinbutton", { name: "Years of experience 1" });
    expect(experience).toHaveValue(1);
    expect(experience).toHaveAttribute("min", "0");
    expect(experience).toHaveAttribute("max", "99.9");
    expect(experience).toHaveAttribute("step", "0.1");
  });
});
