import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import PrimaryButton from "../components/PrimaryButton";
import ContractorTable from "../components/contractors/ContractorTable";
import ContractorCardList from "../components/contractors/ContractorCardList";
import AddContractorModal from "../components/contractors/AddContractorModal";
import EditContractorModal from "../components/contractors/EditContractorModal";
import ContractorHistoryModal from "../components/contractors/ContractorHistoryModal";
import vendorContractorService from "../services/vendorContractorService";
import ListControls from "../components/ListControls";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { SKILLS, SKILL_LABELS } from "../constants/skills";

/**
 * Vendor's contractor-management screen: list + add + edit (rate/status).
 * All data comes from vendorContractorService, which is scoped to the
 * authenticated vendor server-side — this component never sends or reads
 * a vendor id itself.
 */
export default function VendorContractorsPage() {
  const [contractors, setContractors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingContractor, setEditingContractor] = useState(null);
  const [historyContractor, setHistoryContractor] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [page, setPage] = useState(() => Number(new URLSearchParams(window.location.search).get("page")) || 1);
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get("search") || "");
  const [pageInfo, setPageInfo] = useState({ total_pages: 1, total: 0 });
  const [skill, setSkill] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const loadContractors = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await vendorContractorService.listContractors({ page, pageSize: 25, sort: "name", order: "asc", ...(debouncedSearch ? { search: debouncedSearch } : {}), ...(skill ? { skill } : {}) });
      setContractors(data.items);
      setPageInfo(data);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, skill]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (search) params.set("search", search);
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }, [page, search]);

  useEffect(() => {
    loadContractors();
  }, [loadContractors]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleCreate = async (payload) => {
    const created = await vendorContractorService.createContractor(payload);
    setContractors((prev) => [created, ...prev]);
    setIsAddOpen(false);
    setSuccessMessage("Contractor added successfully.");
  };

  const handleUpdate = async (id, fields) => {
    const updated = await vendorContractorService.updateContractor(id, fields);
    setContractors((prev) => prev.map((c) => (c.id === id ? updated : c)));
    setEditingContractor(null);
    setSuccessMessage("Contractor updated successfully.");
  };

  return (
    <DashboardLayout title="Contractors">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-text">Contractors</h1>
          <PrimaryButton type="button" fullWidth={false} onClick={() => setIsAddOpen(true)}>
            + Add Contractor
          </PrimaryButton>
        </div>

        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={loadError} />

        {isLoading ? (
          <Spinner label="Loading contractors…" />
        ) : contractors.length === 0 ? (
          <EmptyState onAdd={() => setIsAddOpen(true)} />
        ) : (
          <div className="rounded-lg bg-surface p-4 shadow-panel ring-1 ring-border sm:p-6">
            <ContractorTable contractors={contractors} onEdit={setEditingContractor} onHistory={setHistoryContractor} />
            <ContractorCardList contractors={contractors} onEdit={setEditingContractor} onHistory={setHistoryContractor} />
            <div className="mb-3 flex justify-end"><select aria-label="Filter by skill" value={skill} onChange={(e) => { setPage(1); setSkill(e.target.value); }} className="rounded-md border border-border bg-surface px-3 py-2 text-sm"><option value="">All skills</option>{SKILLS.map((code) => <option key={code} value={code}>{SKILL_LABELS[code]}</option>)}</select></div><ListControls page={page} totalPages={pageInfo.total_pages} total={pageInfo.total} search={search} onSearchChange={(value) => { setPage(1); setSearch(value); }} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />
          </div>
        )}
      </div>

      {isAddOpen && <AddContractorModal onClose={() => setIsAddOpen(false)} onCreate={handleCreate} />}
      {editingContractor && (
        <EditContractorModal
          contractor={editingContractor}
          onClose={() => setEditingContractor(null)}
          onUpdate={handleUpdate}
        />
      )}
      {historyContractor && <ContractorHistoryModal contractor={historyContractor} onClose={() => setHistoryContractor(null)} />}
    </DashboardLayout>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
      <p className="text-text-secondary">No contractors yet.</p>
      <p className="max-w-sm text-sm text-muted">
        Add your first contractor to start managing your contingent workforce.
      </p>
      <PrimaryButton type="button" fullWidth={false} onClick={onAdd} className="mt-2">
        + Add Contractor
      </PrimaryButton>
    </div>
  );
}
