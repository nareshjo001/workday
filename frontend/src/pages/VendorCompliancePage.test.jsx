import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VendorCompliancePage from "./VendorCompliancePage";
import vendorContractorService from "../services/vendorContractorService";
import documents from "../services/vendorDocumentService";

vi.mock("../layouts/DashboardLayout", () => ({
  default: ({ title, children }) => <div data-testid="dashboard-layout" data-title={title}>{children}</div>,
}));

vi.mock("../services/vendorContractorService", () => ({
  default: { listContractors: vi.fn() },
}));

vi.mock("../services/vendorDocumentService", () => ({
  default: { list: vi.fn(), upload: vi.fn(), review: vi.fn() },
}));

const contractors = [
  { id: 1, name: "Avery Frontend" },
  { id: 2, name: "Morgan DevOps" },
];

const verifiedData = {
  compliance: { status: "VERIFIED", missing_document_types: [] },
  documents: [
    { id: 11, document_type: "IDENTITY", original_filename: "identity-document.pdf", expiry_date: null, status: "VERIFIED", rejection_reason: null },
    { id: 12, document_type: "TAX", original_filename: "tax-document.png", expiry_date: "2027-03-18", status: "PENDING", rejection_reason: null },
    { id: 13, document_type: "QUALIFICATION", original_filename: "qualification.jpg", expiry_date: null, status: "REJECTED", rejection_reason: "Document is outdated" },
  ],
};

describe("VendorCompliancePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vendorContractorService.listContractors.mockResolvedValue({ items: contractors });
    documents.list.mockResolvedValue(verifiedData);
    documents.upload.mockResolvedValue({ id: 20, document_type: "TAX", status: "PENDING" });
    documents.review.mockResolvedValue({ id: 12, status: "VERIFIED" });
  });

  it("renders the compact compliance structure using authoritative fields and no invented action menu", async () => {
    const { container } = render(<VendorCompliancePage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Contractor Compliance" })).toBeInTheDocument();
    expect(screen.getByText("Manage and verify contractor documents to ensure compliance requirements are met.")).toBeInTheDocument();
    expect(screen.getByLabelText("Select contractor")).toHaveValue("1");
    expect(screen.getByText("Status: VERIFIED")).toBeInTheDocument();
    expect(screen.getByText("Missing or invalid: None")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upload document" })).toBeInTheDocument();
    expect(screen.getByText("Accepted formats: PDF, PNG, JPEG (maximum 5 MB)")).toBeInTheDocument();
    expect(screen.getByTestId("compliance-upload-main-row")).toContainElement(screen.getByTestId("compliance-document-type"));
    expect(screen.getByTestId("compliance-upload-main-row")).toContainElement(screen.getByTestId("compliance-file"));
    expect(screen.getByTestId("compliance-upload-main-row")).toContainElement(screen.getByTestId("compliance-upload-button"));
    expect(screen.getByTestId("compliance-upload-main-row")).toContainElement(screen.getByTestId("compliance-expiry-date"));
    expect(screen.getByTestId("compliance-upload-main-row")).not.toContainElement(screen.getByTestId("compliance-format-hint"));

    const table = screen.getByRole("table");
    for (const heading of ["Document type", "File name", "Expiry date", "Status"]) expect(within(table).getByRole("columnheader", { name: heading })).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(within(table).getByText("identity-document.pdf")).toBeInTheDocument();
    expect(within(table).getAllByText("—")).toHaveLength(2);
    expect(within(table).getByText("Verified")).toBeInTheDocument();
    expect(within(table).getByText("Pending")).toBeInTheDocument();
    expect(within(table).getByText("Rejected")).toBeInTheDocument();
    expect(within(table).getByText("Verified").closest("span")).toHaveClass("inline-flex", "h-8", "items-center", "justify-center", "px-3", "leading-none", "bg-emerald-50");
    expect(within(table).getByText("Pending").closest("span")).toHaveClass("bg-amber-50", "border-amber-200", "text-amber-700");
    expect(within(table).getByText("Rejected").closest("span")).toHaveClass("bg-red-50", "border-red-200", "text-red-700");
    expect(within(table).getByText("Document is outdated")).toBeInTheDocument();
    expect(screen.queryByLabelText(/actions for/i)).not.toBeInTheDocument();
    expect(container.querySelector('[aria-label*="menu" i], [aria-label*="more" i]')).toBeNull();
    expect(/[🌀-🛿🤀-🧿☀-⛿✀-➿]/u.test(container.textContent || "")).toBe(false);
  });

  it("keeps contractor selection and compliance refresh behavior unchanged", async () => {
    documents.list
      .mockResolvedValueOnce(verifiedData)
      .mockResolvedValueOnce({ compliance: { status: "NOT_VERIFIED", missing_document_types: ["TAX"] }, documents: [] });
    render(<VendorCompliancePage />);

    const selector = await screen.findByLabelText("Select contractor");
    fireEvent.change(selector, { target: { value: "2" } });

    await waitFor(() => expect(documents.list).toHaveBeenLastCalledWith("2"));
    expect(await screen.findByText("Status: NOT_VERIFIED")).toBeInTheDocument();
    expect(screen.getByText("Missing or invalid: TAX")).toBeInTheDocument();
    expect(screen.getByText("No documents uploaded.")).toBeInTheDocument();
  });

  it("preserves document type, optional expiry, file selection, and upload payload behavior", async () => {
    render(<VendorCompliancePage />);
    await screen.findByText("Status: VERIFIED");

    const documentType = screen.getByLabelText("Document type");
    const expiryDate = screen.getByLabelText("Expiry date (optional)");
    const fileInput = screen.getByLabelText("File");
    const file = new File(["compliance"], "replacement.pdf", { type: "application/pdf" });

    expect(Array.from(documentType.options).map((option) => option.value)).toEqual(["IDENTITY", "TAX", "QUALIFICATION"]);
    expect(fileInput).toHaveAttribute("accept", "application/pdf,image/png,image/jpeg");
    fireEvent.change(documentType, { target: { value: "TAX" } });
    fireEvent.change(expiryDate, { target: { value: "2027-06-30" } });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(fileInput.files[0]).toBe(file);
    expect(screen.getByRole("button", { name: "Upload document", exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload document", exact: true }));

    await waitFor(() => expect(documents.upload).toHaveBeenCalledOnce());
    expect(documents.upload).toHaveBeenCalledWith(expect.objectContaining({
      contractorId: 1,
      documentType: "TAX",
      mimeType: "application/pdf",
      originalFilename: "replacement.pdf",
      expiryDate: "2027-06-30",
    }));
    expect(documents.list).toHaveBeenCalledTimes(2);
  });

  it("preserves the real pending-document Verify and Reject workflows inside the Status cell", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Unreadable scan");
    render(<VendorCompliancePage />);
    const table = await screen.findByRole("table");

    fireEvent.click(within(table).getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(documents.review).toHaveBeenCalledWith(12, { status: "VERIFIED", rejectionReason: null }));
    fireEvent.click(within(table).getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(documents.review).toHaveBeenCalledWith(12, { status: "REJECTED", rejectionReason: "Unreadable scan" }));
  });

  it("keeps loading, error, and no-contractor states visible", async () => {
    let resolveContractors;
    vendorContractorService.listContractors.mockReturnValueOnce(new Promise((resolve) => { resolveContractors = resolve; }));
    const { unmount } = render(<VendorCompliancePage />);
    expect(screen.getByText("Loading compliance…")).toBeInTheDocument();
    resolveContractors({ items: [] });
    expect(await screen.findByText("No contractor selected.")).toBeInTheDocument();
    unmount();

    vendorContractorService.listContractors.mockRejectedValueOnce(new Error("Unable to load compliance."));
    render(<VendorCompliancePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load compliance.");
    expect(screen.getByText("No contractor selected.")).toBeInTheDocument();
  });
});
