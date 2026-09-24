import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import PrimaryButton from "../components/PrimaryButton";
import ContractorCardList from "../components/contractors/ContractorCardList";
import AddContractorModal from "../components/contractors/AddContractorModal";
import EditContractorModal from "../components/contractors/EditContractorModal";
import ContractorHistoryModal from "../components/contractors/ContractorHistoryModal";
import vendorContractorService from "../services/vendorContractorService";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { SKILLS, SKILL_LABELS } from "../constants/skills";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-muted fill-none stroke-current stroke-[1.8] stroke-linecap-round stroke-linejoin-round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

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
      const data = await vendorContractorService.listContractors({
        page,
        pageSize: 15,
        sort: "name",
        order: "asc",
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(skill ? { skill } : {}),
      });
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

  const hasActiveFilters = Boolean(debouncedSearch || skill);

  return (
    <DashboardLayout title="Contractors">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        {/* Page Header: Title, Result Count, Add Contractor */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text">Contractors</h1>
            <p className="text-sm text-muted" data-testid="contractor-result-count">
              {pageInfo.total} result{pageInfo.total === 1 ? "" : "s"}
            </p>
          </div>
          <PrimaryButton type="button" fullWidth={false} onClick={() => setIsAddOpen(true)}>
            + Add Contractor
          </PrimaryButton>
        </div>

        {/* Filter & Search Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <label htmlFor="contractor-search" className="sr-only">Search by name or email</label>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <SearchIcon />
            </div>
            <input
              id="contractor-search"
              type="search"
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="Search by name or email..."
              className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label htmlFor="skill-filter" className="sr-only">Filter by skill</label>
            <select
              id="skill-filter"
              aria-label="Filter by skill"
              value={skill}
              onChange={(e) => { setPage(1); setSkill(e.target.value); }}
              className="w-full sm:w-48 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
            >
              <option value="">All skills</option>
              {SKILLS.map((code) => (
                <option key={code} value={code}>{SKILL_LABELS[code]}</option>
              ))}
            </select>
          </div>
        </div>

        <AlertBanner message={successMessage} variant="success" />
        <AlertBanner message={loadError} />

        {/* Content Area: Loading, Empty, or Cards */}
        {isLoading ? (
          <Spinner label="Loading contractors…" />
        ) : contractors.length === 0 ? (
          hasActiveFilters ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center" data-testid="contractor-empty-filter">
              <p className="text-sm font-medium text-text">No contractors found.</p>
              <p className="mt-1 text-xs text-muted">Try adjusting your search query or skill filter.</p>
            </div>
          ) : (
            <EmptyState onAdd={() => setIsAddOpen(true)} />
          )
        ) : (
          <div className="flex flex-col gap-4">
            <ContractorCardList
              contractors={contractors}
              onEdit={setEditingContractor}
              onHistory={setHistoryContractor}
            />

            {/* Bottom Pagination Info */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted" data-testid="contractor-pagination">
              <span>
                {pageInfo.total} result{pageInfo.total === 1 ? "" : "s"} · Page {page} of {Math.max(pageInfo.total_pages, 1)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                  className="rounded-md border border-border bg-surface px-3 py-1.5 font-medium text-text-secondary disabled:opacity-40 transition hover:bg-surface-muted"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pageInfo.total_pages}
                  onClick={() => setPage((value) => value + 1)}
                  className="rounded-md border border-border bg-surface px-3 py-1.5 font-medium text-text-secondary disabled:opacity-40 transition hover:bg-surface-muted"
                >
                  Next
                </button>
              </div>
            </div>
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
