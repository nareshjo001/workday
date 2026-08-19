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
import { formatCurrency, formatHours, formatDate } from "../components/dashboard/format";
import pmDashboardService from "../services/pmDashboardService";

/**
 * PM dashboard (UI + analytics redesign). Single read-only GET
 * /pm/dashboard call — pmDashboardService.getPmDashboard derives the PM's
 * identity from the JWT, reusing pmProjectService.listProjects(pmId) for
 * every per-project figure so the numbers here are guaranteed to match
 * the existing Projects page (same server-computed work_progress_percent
 * / staffing_status, never re-derived).
 */
export default function PmHomePage() {
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await pmDashboardService.getDashboard();
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
  const invoices = dashboard?.invoices;
  const milestones = dashboard?.milestones;
  const completion = dashboard?.completion_analytics;
  const activeProjects = dashboard?.projects?.filter((p) => p.status === "ACTIVE") ?? [];
  const hoursProgressProjects = activeProjects.filter((p) => p.expected_hours !== null);

  return (
    <DashboardLayout title="PM dashboard">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text">Dashboard</h1>
            <p className="text-sm text-muted">Your projects, staffing, and billing at a glance.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/pm/projects"
              className="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-panel transition-colors hover:bg-primary-hover"
            >
              Manage Projects
            </Link>
            <Link
              to="/pm/timesheets"
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
            >
              Timesheet Approvals
            </Link>
            <Link
              to="/pm/milestones"
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
            >
              Milestones & Billing
            </Link>
            <Link
              to="/pm/invoices"
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
            >
              Invoice Review
            </Link>
          </div>
        </div>

        <AlertBanner message={loadError} />

        {isLoading ? (
          <div className="flex flex-col gap-5">
            <KpiRowSkeleton count={5} />
            <SectionSkeleton lines={5} />
            <SectionSkeleton lines={5} />
          </div>
        ) : !dashboard ? null : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <KpiCard title="Active Projects" value={summary.active_projects} icon="📁" />
              <KpiCard title="Active Contractors" value={summary.active_contractors} icon="👥" />
              <KpiCard title="Completed Projects" value={summary.completed_projects} icon="✅" />
              <KpiCard title="Pending Staffing" value={summary.pending_staffing_projects} icon="⚠" />
              <KpiCard
                title="Project Progress"
                value={summary.overall_progress_percent === null ? "—" : `${summary.overall_progress_percent}%`}
                description="Across active projects"
                icon="📈"
              />
            </div>

            <SectionCard
              title="Project Progress Overview"
              description="Every project you manage — hours, progress, and staffing status"
            >
              {!dashboard.projects || dashboard.projects.length === 0 ? (
                <EmptyState message="No projects created yet." compact />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted">
                        <th className="py-2 pr-3 font-medium">Project</th>
                        <th className="py-2 pr-3 font-medium">Company</th>
                        <th className="py-2 pr-3 font-medium">Dates</th>
                        <th className="py-2 pr-3 font-medium">Hours</th>
                        <th className="py-2 pr-3 font-medium">Progress</th>
                        <th className="py-2 pr-3 font-medium">Staffing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {dashboard.projects.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2.5 pr-3 font-medium text-text">{p.name}</td>
                          <td className="py-2.5 pr-3 text-text-secondary">{p.company_name}</td>
                          <td className="py-2.5 pr-3 whitespace-nowrap text-text-secondary">
                            {formatDate(p.start_date)} – {formatDate(p.end_date)}
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap text-text-secondary">
                            {p.expected_hours === null
                              ? "—"
                              : `${formatHours(p.approved_hours)}/${formatHours(p.expected_hours)}h`}
                          </td>
                          <td className="py-2.5 pr-3">
                            {p.work_progress_percent === null ? (
                              <span className="text-text-secondary">—</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="w-24">
                                  <ProgressBar percent={p.work_progress_percent} size="sm" />
                                </div>
                                <span className="text-text-secondary">{p.work_progress_percent}%</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                p.staffing_status === "FULLY_STAFFED"
                                  ? "bg-success-bg text-success"
                                  : "bg-warning-bg text-warning"
                              }`}
                            >
                              {p.staffing_status === "FULLY_STAFFED" ? "✓ Fully Staffed" : "⚠ Pending"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Hours Progress" description="Approved vs. expected hours for each active project">
              <BarList
                data={hoursProgressProjects.map((p) => ({
                  label: p.name,
                  value: p.approved_hours,
                  displayValue: `${formatHours(p.approved_hours)}/${formatHours(p.expected_hours)}h`,
                }))}
                emptyMessage="No active projects yet."
              />
            </SectionCard>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <SectionCard title="Milestone Overview">
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                    <span className="text-xs text-muted">Pending</span>
                    <span className="text-lg font-semibold text-text">{milestones.pending}</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                    <span className="text-xs text-muted">Met</span>
                    <span className="text-lg font-semibold text-text">{milestones.met}</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                    <span className="text-xs text-muted">Billed</span>
                    <span className="text-lg font-semibold text-text">{milestones.with_billing_generated}</span>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Invoice Overview" description="Across all projects you manage">
                <div className="grid grid-cols-3 gap-3">
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
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Completion Analytics">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                  <span className="text-xs text-muted">Completed</span>
                  <span className="text-lg font-semibold text-text">{completion.completed_projects}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                  <span className="text-xs text-muted">Avg. Completion</span>
                  <span className="text-lg font-semibold text-text">
                    {completion.average_completion_percent === null ? "—" : `${completion.average_completion_percent}%`}
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                  <span className="text-xs text-muted">Approaching End Date</span>
                  <span className="text-lg font-semibold text-text">{completion.approaching_end_date_count}</span>
                  <span className="text-xs text-muted">Within next 14 days</span>
                </div>
                <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                  <span className="text-xs text-muted">Past End Date, Still Active</span>
                  <span className="text-lg font-semibold text-text">{completion.past_end_date_still_active_count}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Recent Activity">
              <ActivityFeed activity={dashboard.recent_activity} />
            </SectionCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
