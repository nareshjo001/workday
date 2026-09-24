import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ContractorCardList, {
  ContractorStatusBadge,
  SkillBadge,
} from "./ContractorCardList";
import { getInitials } from "./format";

describe("getInitials", () => {
  it("returns initials for multi-word names", () => {
    expect(getInitials("Avery Frontend")).toBe("AF");
    expect(getInitials("Casey Morgan QA")).toBe("CQ");
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("returns first two letters for single-word names", () => {
    expect(getInitials("Dakota")).toBe("DA");
    expect(getInitials("Al")).toBe("AL");
  });

  it("handles empty or invalid values safely", () => {
    expect(getInitials("")).toBe("?");
    expect(getInitials(null)).toBe("?");
    expect(getInitials(undefined)).toBe("?");
    expect(getInitials("   ")).toBe("?");
  });
});

describe("SkillBadge", () => {
  it("renders known skills with appropriate styling and dot", () => {
    const { container } = render(<SkillBadge skill="FRONTEND" />);
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(container.querySelector(".contractor-badge-dot")).toBeInTheDocument();
  });

  it("renders unknown/custom skills with deterministic colored styling, NOT generic grey", () => {
    render(<SkillBadge skill="ML Engineer" />);
    expect(screen.getByText("ML Engineer")).toBeInTheDocument();
    const badge = screen.getByTestId("contractor-skill-badge");
    // Should have valid background and color that is not grey #f8fafc
    expect(badge.style.backgroundColor).not.toBe("rgb(248, 250, 252)");
  });

  it("renders two different contractors with the same skill using the exact same badge style", () => {
    const contractors = [
      { id: 1, name: "Alice", email: "a@test.com", skill: "Cloud Engineer", hourly_rate: 100, status: "ACTIVE" },
      { id: 2, name: "Bob", email: "b@test.com", skill: "Cloud Engineer", hourly_rate: 120, status: "ACTIVE" },
    ];
    render(<ContractorCardList contractors={contractors} onEdit={vi.fn()} onHistory={vi.fn()} />);

    const badges = screen.getAllByTestId("contractor-skill-badge");
    expect(badges).toHaveLength(2);
    expect(badges[0].style.backgroundColor).toBe(badges[1].style.backgroundColor);
    expect(badges[0].style.color).toBe(badges[1].style.color);
    expect(badges[0].style.borderColor).toBe(badges[1].style.borderColor);
  });
});

describe("ContractorStatusBadge", () => {
  it("renders ACTIVE status with active class", () => {
    render(<ContractorStatusBadge status="ACTIVE" />);
    const badge = screen.getByTestId("contractor-status-badge");
    expect(badge).toHaveTextContent("ACTIVE");
    expect(badge).toHaveClass("is-active");
  });

  it("renders INACTIVE status with inactive class", () => {
    render(<ContractorStatusBadge status="INACTIVE" />);
    const badge = screen.getByTestId("contractor-status-badge");
    expect(badge).toHaveTextContent("INACTIVE");
    expect(badge).toHaveClass("is-inactive");
  });
});

describe("ContractorCardList", () => {
  const mockContractors = [
    {
      id: 101,
      name: "Alex Designer",
      email: "alex@design.com",
      skill: "DESIGN",
      hourly_rate: 110,
      status: "ACTIVE",
    },
  ];

  it("returns null when contractors list is empty", () => {
    const { container } = render(
      <ContractorCardList contractors={[]} onEdit={vi.fn()} onHistory={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders card and invokes action callbacks", () => {
    const onEdit = vi.fn();
    const onHistory = vi.fn();

    render(
      <ContractorCardList
        contractors={mockContractors}
        onEdit={onEdit}
        onHistory={onHistory}
      />
    );

    expect(screen.getByText("Alex Designer")).toBeInTheDocument();
    expect(screen.getByText("alex@design.com")).toBeInTheDocument();
    expect(screen.getByText("₹110.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Alex Designer" }));
    expect(onEdit).toHaveBeenCalledWith(mockContractors[0]);

    fireEvent.click(screen.getByRole("button", { name: "View history for Alex Designer" }));
    expect(onHistory).toHaveBeenCalledWith(mockContractors[0]);
  });

  it("renders the desktop list header with expected column titles", () => {
    render(
      <ContractorCardList
        contractors={mockContractors}
        onEdit={vi.fn()}
        onHistory={vi.fn()}
      />
    );

    const header = screen.getByTestId("contractor-list-header");
    expect(header).toBeInTheDocument();
    expect(header).toHaveTextContent("Contractor");
    expect(header).toHaveTextContent("Skill");
    expect(header).toHaveTextContent("Rate");
    expect(header).toHaveTextContent("Status");
    expect(header).toHaveTextContent("Actions");
  });
});
