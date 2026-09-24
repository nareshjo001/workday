import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import PrimaryButton from "../components/PrimaryButton";
import vendorContractorService from "../services/vendorContractorService";
import documents from "../services/vendorDocumentService";

const types = ["IDENTITY", "TAX", "QUALIFICATION"];
const inputClassName = "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

function useSafeSearchParams() {
  let routerResult = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    routerResult = useSearchParams();
  } catch {
    // Outside Router context (e.g. isolated unit tests)
  }
  const [fallbackParams, setFallbackParams] = useState(() => {
    if (typeof window !== "undefined" && window.location?.search) {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  });

  if (routerResult) {
    return routerResult;
  }
  return [fallbackParams, setFallbackParams];
}

export default function VendorCompliancePage() {
  const [searchParams, setSearchParams] = useSafeSearchParams();
  const targetContractorParam = searchParams.get("contractor");
  const targetDocumentParam = searchParams.get("document");

  const [contractors, setContractors] = useState([]);
  const [contractorId, setContractorId] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [type, setType] = useState("IDENTITY");
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [highlightedDocId, setHighlightedDocId] = useState(null);

  const load = async (id) => {
    if (!id) return;
    try {
      setLoading(true);
      setData(await documents.list(id));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const result = await vendorContractorService.listContractors({ page: 1, pageSize: 100, sort: "name", order: "asc" });
        const list = result.items || [];
        setContractors(list);

        const matched = targetContractorParam && list.find((c) => String(c.id) === String(targetContractorParam));
        const selected = matched || list[0];

        if (selected) {
          setContractorId(String(selected.id));
          await load(selected.id);
        }
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!targetContractorParam || contractors.length === 0) return;
    const matched = contractors.find((c) => String(c.id) === String(targetContractorParam));
    if (matched && String(matched.id) !== String(contractorId)) {
      setContractorId(String(matched.id));
      load(matched.id);
    }
  }, [targetContractorParam, contractors, contractorId]);

  useEffect(() => {
    if (!targetDocumentParam || !data?.documents) return;
    const docIdNum = Number(targetDocumentParam);
    const docExists = data.documents.some((d) => Number(d.id) === docIdNum);
    if (docExists) {
      setHighlightedDocId(docIdNum);
      const timer = setTimeout(() => {
        const el = document.getElementById(`document-row-${docIdNum}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 150);
      const clearTimer = setTimeout(() => {
        setHighlightedDocId(null);
      }, 4000);
      return () => {
        clearTimeout(timer);
        clearTimeout(clearTimer);
      };
    }
  }, [targetDocumentParam, data]);

  const upload = async (event) => {
    event.preventDefault();
    if (!file) return setError("Choose a PDF, PNG, or JPEG file.");
    if (file.size > 5 * 1024 * 1024) return setError("Files must be 5 MB or smaller.");
    setSaving(true);
    setError(null);
    try {
      const contentBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await documents.upload({
        contractorId: Number(contractorId),
        documentType: type,
        mimeType: file.type,
        originalFilename: file.name,
        contentBase64,
        expiryDate: expiryDate || null,
      });
      setFile(null);
      setExpiryDate("");
      await load(contractorId);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setSaving(false);
    }
  };

  const review = async (document, status) => {
    const rejectionReason = status === "REJECTED" ? window.prompt("Rejection reason") : null;
    if (status === "REJECTED" && !rejectionReason) return;
    try {
      await documents.review(document.id, { status, rejectionReason });
      await load(contractorId);
    } catch (reviewError) {
      setError(reviewError.message);
    }
  };

  const selectContractor = (event) => {
    const val = event.target.value;
    setContractorId(val);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("contractor", val);
      next.delete("document");
      return next;
    }, { replace: true });
    load(val);
  };

  return <DashboardLayout title="Compliance">
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Contractor Compliance</h1>
        <p className="mt-1 text-sm text-slate-500">Manage and verify contractor documents to ensure compliance requirements are met.</p>
      </header>
      <AlertBanner message={error} />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="contractor-compliance-heading">
        <h2 id="contractor-compliance-heading" className="sr-only">Contractor compliance status</h2>
        <label className="block max-w-xl text-sm font-semibold text-slate-800">
          Select contractor
          <select className={inputClassName} value={contractorId} onChange={selectContractor} aria-label="Select contractor">
            {contractors.map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.name}</option>)}
          </select>
        </label>
        <div className="mt-3 max-w-xl border-t border-slate-200" aria-hidden="true" />
        {loading ? <div className="mt-4"><Spinner label="Loading compliance…" /></div> : contractorId && data
          ? <ComplianceBanner compliance={data.compliance} />
          : <p className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">No contractor selected.</p>}
      </section>

      {!loading && contractorId && data && <>
        <form onSubmit={upload} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="upload-document-heading">
          <SectionHeading id="upload-document-heading" icon={<UploadIcon />} title="Upload document" description="Add or update a compliance document for the selected contractor." />
          <div data-testid="compliance-upload-main-row" className="mt-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(130px,.8fr)_minmax(150px,.8fr)_minmax(210px,1.35fr)_auto]">
            <label data-testid="compliance-document-type" className="block text-xs font-medium text-slate-600">Document type
              <select className={inputClassName} value={type} onChange={(event) => setType(event.target.value)}>{types.map((value) => <option key={value}>{value}</option>)}</select>
            </label>
            <label data-testid="compliance-expiry-date" className="block text-xs font-medium text-slate-600">Expiry date (optional)
              <input className={inputClassName} type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
            </label>
            <label data-testid="compliance-file" className="block min-w-0 text-xs font-medium text-slate-600">File
              <input className="mt-1.5 block h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white text-xs text-slate-500 file:mr-3 file:h-full file:border-0 file:border-r file:border-slate-200 file:bg-slate-50 file:px-3 file:text-xs file:font-medium file:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
            <PrimaryButton data-testid="compliance-upload-button" isLoading={saving} loadingText="Uploading…" fullWidth={false} className="h-11 whitespace-nowrap text-sm">
              <UploadIcon className="h-4 w-4" />Upload document
            </PrimaryButton>
          </div>
          <div data-testid="compliance-format-hint" className="mt-3 flex min-h-10 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-blue-800">
            <InfoIcon className="h-4 w-4 shrink-0" />
            <span>Accepted formats: PDF, PNG, JPEG (maximum 5 MB)</span>
          </div>
        </form>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="documents-heading">
          <div className="p-4 pb-3 sm:p-5 sm:pb-4">
            <SectionHeading id="documents-heading" icon={<DocumentIcon />} title="Documents" description="Compliance documents for the selected contractor." />
          </div>
          {!data.documents.length
            ? <p className="mx-4 mb-4 rounded-xl border border-dashed border-slate-200 px-5 py-7 text-sm text-slate-500 sm:mx-5 sm:mb-5">No documents uploaded.</p>
            : <DocumentTable items={data.documents} onReview={review} highlightedDocId={highlightedDocId} />}
        </section>
      </>}
    </div>
  </DashboardLayout>;
}

function ComplianceBanner({ compliance }) {
  const verified = compliance?.status === "VERIFIED";
  const neutral = !compliance?.status;
  const colors = neutral
    ? "border-slate-200 bg-slate-50 text-slate-700"
    : verified
      ? "border-emerald-200 bg-emerald-50/80 text-emerald-800"
      : "border-amber-200 bg-amber-50/80 text-amber-900";
  const iconColors = neutral ? "bg-slate-100 text-slate-600" : verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
  return <div className={`mt-3 flex min-h-20 items-center gap-4 rounded-lg border px-4 py-3 ${colors}`} role="status">
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${verified ? "bg-emerald-600 text-white" : iconColors}`} aria-hidden="true">{verified ? <CheckCircleIcon /> : <AlertCircleIcon />}</span>
    <div className="min-w-0">
      <p className="text-sm font-semibold">Status: {compliance?.status || "UNKNOWN"}</p>
      <p className="mt-0.5 text-xs opacity-80">Missing or invalid: {compliance?.missing_document_types?.join(", ") || "None"}</p>
    </div>
  </div>;
}

function SectionHeading({ id, icon, title, description }) {
  return <div className="flex items-center gap-3">
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700" aria-hidden="true">{icon}</span>
    <div className="min-w-0"><h2 id={id} className="text-base font-semibold text-slate-900">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{description}</p></div>
  </div>;
}

function DocumentTable({ items, onReview, highlightedDocId }) {
  return <div className="mx-4 mb-4 overflow-x-auto rounded-xl border border-slate-200 sm:mx-5 sm:mb-5">
    <table className="min-w-[680px] w-full table-fixed text-left">
      <colgroup><col className="w-[20%]" /><col className="w-[32%]" /><col className="w-[18%]" /><col className="w-[30%]" /></colgroup>
      <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500"><tr><th className="px-4 py-2.5">Document type</th><th className="px-4 py-2.5">File name</th><th className="px-4 py-2.5">Expiry date</th><th className="px-4 py-2.5">Status</th></tr></thead>
      <tbody>{items.map((document) => <DocumentRow key={document.id} document={document} onReview={onReview} isHighlighted={highlightedDocId === document.id} />)}</tbody>
    </table>
  </div>;
}

function DocumentRow({ document, onReview, isHighlighted }) {
  return <tr
    id={`document-row-${document.id}`}
    data-testid={`document-row-${document.id}`}
    className={`border-t border-slate-200 text-xs text-slate-700 first:border-t-0 transition-colors duration-500 ${
      isHighlighted ? "bg-amber-50/70 ring-1 ring-inset ring-amber-300" : ""
    }`}
  >
    <td className="px-4 py-2.5 font-medium text-slate-800">{document.document_type}</td>
    <td className="px-4 py-2.5"><p className="truncate" title={document.original_filename}>{document.original_filename}</p>{document.rejection_reason && <p className="mt-1 truncate text-[11px] text-red-600" title={document.rejection_reason}>{document.rejection_reason}</p>}</td>
    <td className="px-4 py-2.5 text-slate-500">{document.expiry_date ? String(document.expiry_date).slice(0, 10) : "—"}</td>
    <td className="px-4 py-2.5"><div className="flex flex-wrap items-center gap-2"><DocumentStatusBadge status={document.status} />{document.status === "PENDING" && <div className="flex items-center gap-1.5"><button type="button" className="rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" onClick={() => onReview(document, "VERIFIED")}>Verify</button><button type="button" className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500" onClick={() => onReview(document, "REJECTED")}>Reject</button></div>}</div></td>
  </tr>;
}

function DocumentStatusBadge({ status }) {
  const styles = {
    VERIFIED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    REJECTED: "border-red-200 bg-red-50 text-red-700",
    PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return <span className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold leading-none ${styles[status] || "border-slate-200 bg-slate-50 text-slate-600"}`}><StatusGlyph status={status} />{formatStatus(status)}</span>;
}

function StatusGlyph({ status }) {
  if (status === "VERIFIED") return <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="m4.8 8.1 2 2 4.4-4.5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (status === "REJECTED") return <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="m5.6 5.6 4.8 4.8m0-4.8-4.8 4.8" fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round" /></svg>;
  if (status === "PENDING") return <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6.5" /><path d="M8 4.5V8l2.2 1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />;
}

function formatStatus(status) {
  if (!status) return "Unknown";
  return status.charAt(0) + status.slice(1).toLowerCase().replaceAll("_", " ");
}

function Icon({ children, className = "h-5 w-5" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>;
}
function UploadIcon({ className }) { return <Icon className={className}><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" /></Icon>; }
function DocumentIcon() { return <Icon><path d="M6 2h8l4 4v16H6Z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></Icon>; }
function InfoIcon({ className }) { return <Icon className={className}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Icon>; }
function CheckCircleIcon() { return <Icon><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></Icon>; }
function AlertCircleIcon() { return <Icon><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></Icon>; }
