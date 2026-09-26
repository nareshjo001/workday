import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import AlertBanner from "../components/AlertBanner";
import Spinner from "../components/Spinner";
import VendorClientCard from "../components/clients/VendorClientCard";
import VendorClientDetailDialog from "../components/clients/VendorClientDetailDialog";
import clients from "../services/vendorClientService";

export default function VendorClientsPage() {
  const [clientsList, setClientsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("name_asc");

  useEffect(() => {
    let isMounted = true;

    async function fetchClients() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await clients.list();
        const items = res?.items || (Array.isArray(res) ? res : []);

        const hasProjectsAttached = items.some(
          (item) => Array.isArray(item.recent_projects) || Array.isArray(item.projects)
        );

        let enriched = items;
        if (!hasProjectsAttached && items.length > 0) {
          const detailResults = await Promise.allSettled(
            items.map((c) => clients.detail(c.id))
          );
          enriched = items.map((client, idx) => {
            const detailRes = detailResults[idx];
            if (detailRes.status === "fulfilled" && detailRes.value) {
              const d = detailRes.value;
              return {
                ...client,
                recent_projects: d.active_projects || [],
                detail_pm_contacts: d.pm_contacts || [],
              };
            }
            return {
              ...client,
              recent_projects: [],
            };
          });
        }

        if (isMounted) {
          setClientsList(enriched);
        }
      } catch (err) {
        if (isMounted) {
          setLoadError(err.message || "Failed to load clients.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchClients();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenDetail = async (client) => {
    setLoadError(null);
    try {
      const detail = await clients.detail(client.id);
      setSelectedClient(detail);
    } catch (err) {
      setLoadError(err.message || "Failed to load client details.");
    }
  };

  const closeClientDetail = useCallback(() => {
    setSelectedClient(null);
  }, []);

  const filteredClients = useMemo(() => {
    return clientsList
      .filter((c) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        const nameMatch = (c.name || "").toLowerCase().includes(term);
        const pmMatch = (c.pm_contacts || "").toLowerCase().includes(term);
        return nameMatch || pmMatch;
      })
      .sort((a, b) => {
        const nameA = a.name || "";
        const nameB = b.name || "";
        if (sortOrder === "name_desc") {
          return nameB.localeCompare(nameA);
        }
        return nameA.localeCompare(nameB);
      });
  }, [clientsList, searchTerm, sortOrder]);

  return (
    <DashboardLayout title="Clients">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="vendor-clients-toolbar" data-testid="clients-toolbar">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Clients
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Connected client companies and the work currently available through each relationship.
            </p>
          </div>

          <div className="vendor-clients-toolbar-controls" data-testid="clients-toolbar-controls">
            <div className="vendor-clients-search relative min-w-0 w-full">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search clients..."
                aria-label="Search clients"
                data-testid="client-search-input"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-800 placeholder-slate-400 shadow-2xs transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="vendor-clients-sort relative w-full shrink-0">
              <SortIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                aria-label="Sort clients"
                data-testid="client-sort-select"
                className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pl-8 pr-8 text-sm font-medium text-slate-700 shadow-2xs transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="name_asc">Name (A–Z)</option>
                <option value="name_desc">Name (Z–A)</option>
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>

        <AlertBanner message={loadError} />

        {isLoading ? (
          <div className="py-12 flex justify-center" data-testid="clients-loading">
            <Spinner label="Loading clients…" />
          </div>
        ) : clientsList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <p className="text-sm font-medium text-slate-500">No connected client companies.</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <p className="text-sm font-medium text-slate-500">No clients match your search.</p>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 items-start lg:grid-cols-2 gap-5 sm:gap-6"
            data-testid="clients-grid"
          >
            {filteredClients.map((client) => (
              <VendorClientCard
                key={client.id}
                client={client}
                onViewDetail={handleOpenDetail}
              />
            ))}
          </div>
        )}

        {selectedClient && (
          <VendorClientDetailDialog
            client={selectedClient}
            onClose={closeClientDetail}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function SearchIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function SortIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 15l5 5 5-5" />
      <path d="M7 9l5-5 5 5" />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}
