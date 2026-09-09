import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import VendorDashboardFilters from "./VendorDashboardFilters";

const clients = [{ id: 10, name: "Northwind" }, { id: 20, name: "Contoso" }];
const projects = [
  { id: 101, clientId: 10, name: "Northwind Platform" },
  { id: 202, clientId: 20, name: "Contoso Migration" },
];

test("uses human-readable optional dropdowns and omits empty filters", () => {
  const onApply = vi.fn();
  render(<VendorDashboardFilters clients={clients} projects={projects} onApply={onApply} />);
  expect(screen.getByRole("option", { name: "All clients" })).toHaveValue("");
  expect(screen.getByRole("option", { name: "All projects" })).toHaveValue("");
  expect(screen.getByRole("option", { name: "All statuses" })).toHaveValue("");
  expect(screen.getByLabelText("Project status").querySelectorAll("option")).toHaveLength(5);
  expect(screen.getByRole("option", { name: "Active" })).toHaveValue("ACTIVE");
  expect(screen.getByRole("option", { name: "On hold" })).toHaveValue("ON_HOLD");
  expect(screen.getByRole("option", { name: "Completed" })).toHaveValue("COMPLETED");
  expect(screen.getByRole("option", { name: "Cancelled" })).toHaveValue("CANCELLED");
  expect(screen.queryByLabelText(/skill/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(onApply).toHaveBeenCalledWith({});
});

test("applies client, project, status, and date values using existing parameter names", () => {
  const onApply = vi.fn();
  render(<VendorDashboardFilters clients={clients} projects={projects} onApply={onApply} />);
  fireEvent.change(screen.getByLabelText("Client"), { target: { value: "10" } });
  expect(screen.getByRole("option", { name: "Northwind Platform" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Contoso Migration" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Project"), { target: { value: "101" } });
  fireEvent.change(screen.getByLabelText("Project status"), { target: { value: "ACTIVE" } });
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-09-01" } });
  fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-09-30" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(onApply).toHaveBeenCalledWith({ clientId: "10", projectId: "101", status: "ACTIVE", startDate: "2026-09-01", endDate: "2026-09-30" });
});

test("supports client-only and status/date-only filter combinations", () => {
  const onApply = vi.fn();
  render(<VendorDashboardFilters clients={clients} projects={projects} onApply={onApply} />);
  fireEvent.change(screen.getByLabelText("Client"), { target: { value: "20" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(onApply).toHaveBeenLastCalledWith({ clientId: "20" });

  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  fireEvent.change(screen.getByLabelText("Project status"), { target: { value: "ON_HOLD" } });
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-10-01" } });
  fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-10-31" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(onApply).toHaveBeenLastCalledWith({ status: "ON_HOLD", startDate: "2026-10-01", endDate: "2026-10-31" });
});

test("supports project-only filtering and clear reloads the unfiltered scope", () => {
  const onApply = vi.fn();
  render(<VendorDashboardFilters clients={clients} projects={projects} onApply={onApply} />);
  fireEvent.change(screen.getByLabelText("Project"), { target: { value: "202" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(onApply).toHaveBeenLastCalledWith({ projectId: "202" });
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(onApply).toHaveBeenLastCalledWith({});
  expect(screen.getByLabelText("Project")).toHaveValue("");
});

test("clears an incompatible selected project when the client changes", () => {
  render(<VendorDashboardFilters clients={clients} projects={projects} onApply={() => {}} />);
  fireEvent.change(screen.getByLabelText("Project"), { target: { value: "202" } });
  fireEvent.change(screen.getByLabelText("Client"), { target: { value: "10" } });
  expect(screen.getByLabelText("Project")).toHaveValue("");
});
