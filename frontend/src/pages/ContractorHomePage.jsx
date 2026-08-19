import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import AlertBanner from "../components/AlertBanner";
import KpiCard from "../components/dashboard/KpiCard";
import SectionCard from "../components/dashboard/SectionCard";
import BarList from "../components/dashboard/BarList";
import LineChart from "../components/dashboard/LineChart";
import ProgressBar from "../components/dashboard/ProgressBar";
import EmptyState from "../components/dashboard/EmptyState";
import { KpiRowSkeleton, SectionSkeleton } from "../components/dashboard/Skeleton";
import { formatCurrency, formatHours, formatDate } from "../components/dashboard/format";
import contractorDashboardService from "../services/contractorDashboardService";

const INVOICE_STATUS_STYLES = {
  PENDING_REVIEW: "bg-warning-bg text-warning",
  APPROVED: "bg-success-bg text-success",
  AUTO_APPROVED: "bg-success-bg text-success",
  REJECTED: "bg-error-bg text-error",
};

/**
 * Contractor dashboard (UI + analytics redesign). Single read-only GET
 * /contractor/dashboard call — contractorDashboardService.getContractorDashboard
 * derives identity from the JWT and never counts PENDING_REVIEW/REJECTED
 * invoices as "earned" (see summary.lifetime_revenue).
 */
export default function ContractorHomePage() {
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await contractorDashboardService.getDashboard();
      setDashboard(data);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const summary = dashboard?.summary;
  const timesheets = dashboard?.timesheet_summary;
  const activeProjects = dashboard?.active_projects ?? [];

  return (
    <DashboardLayout title="Contractor dashboard">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text">Dashboard</h1>
            <p className="text-sm text-muted">Your assignments, hours, and earnings at a glance.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/contractor/projects"
              className="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-panel transition-colors hover:bg-primary-hover"
            >
              View My Projects
            </Link>
            <Link
              to="/contractor/timesheets"
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
            >
              Timesheets
            </Link>
            <Link
              to="/contractor/profile"
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
            >
              My Profile
            </Link>
          </div>
        </div>

        <AlertBanner message={loadError} />

        {isLoading ? (
          <div className="flex flex-col gap-5">
            <KpiRowSkeleton count={4} />
            <SectionSkeleton lines={5} />
            <SectionSkeleton lines={5} />
          </div>
        ) : !dashboard ? null : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                title="Lifetime Revenue Earned"
                value={formatCurrency(summary.lifetime_revenue)}
                description="Approved invoices only"
                icon="💰"
              />
              <KpiCard title="Active Projects" value={activeProjects.length} icon="📁" />
              <KpiCard title="Total Approved Hours" value={formatHours(summary.total_approved_hours)} icon="⏱" />
              <KpiCard
                title="Remaining Assigned Hours"
                value={
                  activeProjects.length === 0
                    ? "—"
                    : formatHours(
                        activeProjects.reduce((sum, p) => sum + (p.remaining_hours ?? 0), 0)
                      )
                }
                description="Across active assignments"
                icon="📋"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <SectionCard title="Highest Revenue Project">
                {!dashboard.highest_revenue_project ? (
                  <EmptyState message="No earnings data available." compact />
                ) : (
                  <div className="flex flex-col gap-1">
                    <span className="text-lg font-semibold text-text">
                      {dashboard.highest_revenue_project.project_name}
                    </span>
                    <span className="text-2xl font-semibold text-primary">
                      {formatCurrency(dashboard.highest_revenue_project.total)}
                    </span>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Revenue by Project">
                <BarList
                  data={dashboard.revenue_by_project.map((p) => ({
                    label: p.project_name,
                    value: p.total,
                    displayValue: formatCurrency(p.total),
                  }))}
                  emptyMessage="No earnings data available."
                />
              </SectionCard>
            </div>

            <SectionCard title="Hours Trend" description="Approved hours per week">
              <LineChart data={dashboard.hours_trend} valueKey="hours" labelKey="period" emptyMessage="No hours data available." />
            </SectionCard>

            <SectionCard title="Current Project Progress">
              {activeProjects.length === 0 ? (
                <EmptyState message="No active project." compact />
              ) : (
                <div className="flex flex-col gap-4">
                  {activeProjects.map((p) => (
                    <div key={p.id} className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="text-sm font-medium text-text">{p.name}</span>
                        <span className="text-xs text-muted">{p.company_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <ProgressBar percent={p.work_progress_percent} />
                        <span className="w-40 shrink-0 text-right text-xs text-muted">
                          {p.work_progress_percent === null
                            ? "—"
                            : `${formatHours(p.project_approved_hours)}/${formatHours(p.expected_hours)}h (${p.work_progress_percent}%)`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Timesheet Summary">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                  <span className="text-xs text-muted">Pending</span>
                  <span className="text-lg font-semibold text-text">{timesheets.pending}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                  <span className="text-xs text-muted">Approved</span>
                  <span className="text-lg font-semibold text-text">{timesheets.approved}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                  <span className="text-xs text-muted">Rejected</span>
                  <span className="text-lg font-semibold text-text">{timesheets.rejected}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                  <span className="text-xs text-muted">Total Submitted</span>
                  <span className="text-lg font-semibold text-text">{formatHours(timesheets.total_submitted_hours)}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Invoice / Billing History">
              {dashboard.invoice_history.length === 0 ? (
                <EmptyState message="No earnings data available." compact />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted">
                        <th className="py-2 pr-3 font-medium">Project</th>
                        <th className="py-2 pr-3 font-medium">Hours</th>
                        <th className="py-2 pr-3 font-medium">Amount</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 pr-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {dashboard.invoice_history.map((inv) => (
                        <tr key={inv.id}>
                          <td className="py-2.5 pr-3 font-medium text-text">{inv.project_name}</td>
                          <td className="py-2.5 pr-3 text-text-secondary">{formatHours(inv.hours)}</td>
                          <td className="py-2.5 pr-3 text-text-secondary">{formatCurrency(inv.amount)}</td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                INVOICE_STATUS_STYLES[inv.status] || "bg-surface-muted text-muted"
                              }`}
                            >
                              {inv.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap text-text-secondary">
                            {formatDate(inv.generated_at?.slice(0, 10))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
