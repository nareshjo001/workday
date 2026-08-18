import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Spinner from "../components/Spinner";
import AlertBanner from "../components/AlertBanner";
import PrimaryButton from "../components/PrimaryButton";
import ContractorTable from "../components/contractors/ContractorTable";
import ContractorCardList from "../components/contractors/ContractorCardList";
import AddContractorModal from "../components/contractors/AddContractorModal";
import EditContractorModal from "../components/contractors/EditContractorModal";
import vendorContractorService from "../services/vendorContractorService";

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
  const [successMessage, setSuccessMessage] = useState(null);

  const loadContractors = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await vendorContractorService.listContractors();
      setContractors(data);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
        <div className="flex items-center justify-between gap-3">
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
            <ContractorTable contractors={contractors} onEdit={setEditingContractor} />
            <ContractorCardList contractors={contractors} onEdit={setEditingContractor} />
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
