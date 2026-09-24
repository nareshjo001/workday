import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RequirementManagerModal from "./RequirementManagerModal";

const project = {
  id: 10,
  name: "Atlas Commerce Modernization",
  requirements: [
    { id: 21, skill: "BACKEND", required_count: 1, assigned_count: 0, status: "OPEN", description: "Backend delivery capacity" },
    { id: 22, skill: "FRONTEND", required_count: 2, assigned_count: 1, status: "OPEN", description: "Frontend delivery capacity" },
    { id: 23, skill: "QA", required_count: 2, assigned_count: 2, status: "CLOSED", description: "QA delivery capacity" },
  ],
};

describe("RequirementManagerModal", () => {
  it("renders only the existing authoritative requirements with no add or delete controls", () => {
    render(<RequirementManagerModal project={project} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Staffing requirements: Atlas Commerce Modernization" })).toBeInTheDocument();
    expect(screen.getAllByTestId(/requirement-card-/)).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "Backend" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Frontend" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "QA" })).toBeInTheDocument();
    expect(screen.getByText("0 active assigned")).toBeInTheDocument();
    expect(screen.getByText("1 active assigned")).toBeInTheDocument();
    expect(screen.getByText("2 active assigned")).toBeInTheDocument();
    expect(screen.queryByText(/Add role|Add requirement/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove|delete/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save requirements" })).toBeInTheDocument();
  });

  it("saves only changed existing requirements through the current callback payload", async () => {
    const onSave = vi.fn().mockImplementation(async (_projectId, requirementId, payload) => ({
      ...project.requirements.find((item) => item.id === requirementId),
      ...payload,
      id: requirementId,
    }));
    render(<RequirementManagerModal project={project} onClose={vi.fn()} onSave={onSave} />);

    const frontendCard = screen.getByTestId("requirement-card-22");
    fireEvent.change(frontendCard.getElementsByTagName("input")[0], { target: { value: "3" } });
    fireEvent.change(frontendCard.getElementsByTagName("textarea")[0], { target: { value: "Updated frontend capacity" } });
    fireEvent.click(screen.getByRole("button", { name: "Save requirements" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith(10, 22, {
      required_count: 3,
      description: "Updated frontend capacity",
      status: "OPEN",
    });
  });

  it("keeps Cancel and Close behavior and does not save untouched requirements", () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(<RequirementManagerModal project={project} onClose={onClose} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Save requirements" }));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
