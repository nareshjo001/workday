import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import AlertBanner from "../components/AlertBanner";
import KpiCard from "../components/dashboard/KpiCard";
import SectionCard from "../components/dashboard/SectionCard";
import BarList from "../components/dashboard/BarList";
import ProgressBar from "../components/dashboard/ProgressBar";
import ActivityFeed from "../components/dashboard/ActivityFeed";
import EmptyState from "../components/dashboard/EmptyState";
import { KpiRowSkeleton, SectionSkeleton } from "../components/dashboard/Skeleton";
import { formatCurrency, formatHours } from "../components/dashboard/format";
import vendorDashboardService from "../services/vendorDashboardService";
import DashboardExports from "../components/dashboard/DashboardExports";
import DashboardFilters from "../components/dashboard/DashboardFilters";

/**
 * Vendor dashboard (UI + analytics redesign). Single read-only
 * GET /vendor/dashboard call — the backend derives the vendor's identity
 * from the JWT (see vendorDashboardService.getVendorDashboard), so this
 * page never sends or receives a vendor id itself. Existing quick-nav
 * links are preserved, just relocated into a "Quick actions" row so
 * navigation isn't lost.
 */
export default function VendorHomePage() {
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filters, setFilters] = useState({});

  const loadDashboard = useCallback(async (activeFilters = filters) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await vendorDashboardService.getDashboard(activeFilters);
      setDashboard(data);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const summary = dashboard?.summary;
  const invoices = dashboard?.invoices;
  const commercial = dashboard?.m20;

  return (
    <DashboardLayout title="Vendor dashboard">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text">Dashboard</h1>
            <p className="text-sm text-muted">Your contractors, projects, and billing at a glance.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/vendor/contractors"
              className="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-panel transition-colors hover:bg-primary-hover"
            >
              Manage Contractors
            </Link>
            <Link
              to="/vendor/assignments"
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
            >
              Assign to Project
            </Link>
            <Link
              to="/vendor/invoices"
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
            >
              Invoices
            </Link>
            <Link
              to="/vendor/clients"
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
            >
              Clients
            </Link>
          </div>
        </div>

        <details className="dashboard-tools"><summary>Filters &amp; exports</summary><div>
        <SectionCard title="Filters" description="Metrics and exports use the same server-side scope."><DashboardFilters onApply={(next) => { setFilters(next); loadDashboard(next); }} /></SectionCard>
        <SectionCard title="Exports" description="Download exactly the filtered data available to your organization."><DashboardExports role="vendor" filters={filters} /></SectionCard>
        </div></details>

        <AlertBanner message={loadError} />

        {isLoading ? (
          <div className="flex flex-col gap-5">
            <KpiRowSkeleton count={4} />
            <SectionSkeleton lines={5} />
            <SectionSkeleton lines={5} />
          </div>
        ) : !dashboard ? null : (
          <>
            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
              <KpiCard title="Active Projects" value={summary.active_projects} icon="📁" />
              <KpiCard title="Active Contractors" value={summary.active_contractors} icon="👥" />
              <KpiCard
                title="Total Contractor Earnings"
                value={formatCurrency(summary.total_earnings)}
                description="Approved invoices only"
                icon="💰"
              />
              <KpiCard title="Completed Projects" value={summary.completed_projects} icon="✅" />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <SectionCard title="Highest Pay by Company" description="Earned amount per client company">
                <BarList
                  data={dashboard.earnings_by_company.map((c) => ({
                    label: c.company_name,
                    value: c.total,
                    displayValue: formatCurrency(c.total),
                  }))}
                  emptyMessage="No earnings data available."
                />
              </SectionCard>

              <SectionCard title="Contractor Earnings Breakdown" description="Earned amount per contractor">
                <BarList
                  data={dashboard.earnings_by_contractor.map((c) => ({
                    label: c.contractor_name,
                    value: c.total,
                    displayValue: formatCurrency(c.total),
                  }))}
                  emptyMessage="No earnings data available."
                  barColorClass="bg-success"
                />
              </SectionCard>
            </div>

            <SectionCard title="Project Progress" description="Approved work hours vs. expected hours for each active project">
              {dashboard.project_progress.length === 0 ? (
                <EmptyState message="No active projects yet." compact />
              ) : (
                <div className="flex flex-col gap-4">
                  {dashboard.project_progress.map((p) => (
                    <div key={p.id} className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="text-sm font-medium text-text">{p.name}</span>
                        <span className="text-xs text-muted">{p.company_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <ProgressBar percent={p.work_progress_percent} />
                        <span className="w-28 shrink-0 text-right text-xs text-muted">
                          {p.work_progress_percent === null
                            ? "—"
                            : `${formatHours(p.approved_hours)}/${formatHours(p.expected_hours)}h (${p.work_progress_percent}%)`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Invoice Overview" description="Across all of your contractors' invoices">
              <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
                <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                  <span className="text-xs text-muted">Pending Review</span>
                  <span className="text-lg font-semibold text-text">{invoices.pending_review_count}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                  <span className="text-xs text-muted">Approved</span>
                  <span className="text-lg font-semibold text-text">{invoices.approved_count}</span>
                  <span className="text-xs text-muted">{formatCurrency(invoices.approved_total)}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                  <span className="text-xs text-muted">Rejected</span>
                  <span className="text-lg font-semibold text-text">{invoices.rejected_count}</span>
                  <span className="text-xs text-muted">{formatCurrency(invoices.rejected_total)}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                  <span className="text-xs text-muted">Total Invoiced</span>
                  <span className="text-lg font-semibold text-text">{formatCurrency(invoices.total_invoiced_amount)}</span>
                </div>
              </div>
            </SectionCard>

            {commercial && <SectionCard title="Commercial lifecycle" description="Approved work, invoice state, settlement, and snapshot-based margin are distinct measures."><div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4"><KpiCard title="Approved work" value={formatHours(commercial.time.approved_hours)} /><KpiCard title="Billable, uninvoiced" value={formatCurrency(commercial.financial.billable_uninvoiced_amount)} /><KpiCard title="Paid" value={formatCurrency(commercial.financial.paid_amount)} /><KpiCard title="Outstanding" value={formatCurrency(commercial.financial.outstanding_amount)} /><KpiCard title="Overdue" value={formatCurrency(commercial.financial.overdue_amount)} /><KpiCard title="Open requirements" value={commercial.workforce.open_requirements} /><KpiCard title="Pending reviews" value={commercial.candidates.pending_reviews} /><KpiCard title="Snapshot margin" value={commercial.financial.margin ? formatCurrency(commercial.financial.margin.amount) : "—"} description={commercial.financial.margin?.percentage == null ? "No snapshot margin" : `${commercial.financial.margin.percentage}%`} /></div></SectionCard>}

            <SectionCard title="Recent Activity">
              <ActivityFeed activity={dashboard.recent_activity} />
            </SectionCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
