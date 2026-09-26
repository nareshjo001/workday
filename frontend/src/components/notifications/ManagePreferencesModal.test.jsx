import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ManagePreferencesModal from "./ManagePreferencesModal";
import apiClient from "../../services/apiClient";

vi.mock("../../services/apiClient", () => ({
  default: { put: vi.fn() },
}));

const mockPreferences = [
  { event_type: "DOCUMENT_EXPIRING", in_app_enabled: true },
  { event_type: "INVOICE_APPROVED", in_app_enabled: true },
  { event_type: "INVOICE_REJECTED", in_app_enabled: false },
  { event_type: "CANDIDATE_ACCEPTED", in_app_enabled: true },
];

describe("ManagePreferencesModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.put.mockResolvedValue({});
  });

  it("does not render when isOpen is false", () => {
    render(
      <ManagePreferencesModal
        isOpen={false}
        onClose={vi.fn()}
        preferences={mockPreferences}
        role="vendor"
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders modal header, grouped preference options, and footer buttons when isOpen is true", () => {
    render(
      <ManagePreferencesModal
        isOpen={true}
        onClose={vi.fn()}
        preferences={mockPreferences}
        role="vendor"
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Manage notification preferences" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Choose which in-app notifications you want to receive.")
    ).toBeInTheDocument();

    expect(screen.getByText("Compliance")).toBeInTheDocument();
    expect(screen.getByText("Invoices & payments")).toBeInTheDocument();
    expect(screen.getByText("Staffing")).toBeInTheDocument();

    expect(screen.getByText("Document Expiring")).toBeInTheDocument();
    expect(screen.getByText("Invoice Approved")).toBeInTheDocument();
    expect(screen.getByText("Invoice Rejected")).toBeInTheDocument();
    expect(screen.getByText("Candidate Accepted")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("closes modal when X close button is clicked", () => {
    const onCloseMock = vi.fn();
    render(
      <ManagePreferencesModal
        isOpen={true}
        onClose={onCloseMock}
        preferences={mockPreferences}
        role="vendor"
      />
    );

    const closeBtn = screen.getByRole("button", { name: "Close dialog" });
    fireEvent.click(closeBtn);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("closes modal on Escape key press", () => {
    const onCloseMock = vi.fn();
    render(
      <ManagePreferencesModal
        isOpen={true}
        onClose={onCloseMock}
        preferences={mockPreferences}
        role="vendor"
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("closes without calling API when Cancel is clicked", () => {
    const onCloseMock = vi.fn();
    render(
      <ManagePreferencesModal
        isOpen={true}
        onClose={onCloseMock}
        preferences={mockPreferences}
        role="vendor"
      />
    );

    const invoiceApprovedCheckbox = screen.getByLabelText("Invoice Approved");
    fireEvent.click(invoiceApprovedCheckbox);

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);

    expect(onCloseMock).toHaveBeenCalledTimes(1);
    expect(apiClient.put).not.toHaveBeenCalled();
  });

  it("persists changes using existing API when Save changes is clicked", async () => {
    const onCloseMock = vi.fn();
    const onSavedMock = vi.fn();

    render(
      <ManagePreferencesModal
        isOpen={true}
        onClose={onCloseMock}
        preferences={mockPreferences}
        role="vendor"
        onSaved={onSavedMock}
      />
    );

    const invoiceApprovedCheckbox = screen.getByLabelText("Invoice Approved");
    expect(invoiceApprovedCheckbox).toBeChecked();
    fireEvent.click(invoiceApprovedCheckbox);
    expect(invoiceApprovedCheckbox).not.toBeChecked();

    const saveBtn = screen.getByRole("button", { name: "Save changes" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        "/vendor/notification-preferences/INVOICE_APPROVED",
        { in_app_enabled: false }
      );
    });

    expect(onSavedMock).toHaveBeenCalledTimes(1);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
