import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import AlertBanner from "../components/AlertBanner";
import SectionCard from "../components/dashboard/SectionCard";
import LineChart from "../components/dashboard/LineChart";
import ProgressBar from "../components/dashboard/ProgressBar";
import EmptyState from "../components/dashboard/EmptyState";
import { KpiRowSkeleton, SectionSkeleton } from "../components/dashboard/Skeleton";
import { formatHours } from "../components/dashboard/format";
import contractorDashboardService from "../services/contractorDashboardService";
import "./ContractorHomePage.css";

const metricIcons = {
  projects: <><path d="M3.5 7.5h6l1.8 2h9.2v9.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7.5Z" /><path d="M3.5 7.5V5a2 2 0 0 1 2-2h4l1.8 2h5.2" /></>,
  approvedTime: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /><path d="m8.5 12.5 2 2 4.5-5" /></>,
  remainingTime: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 11h6M9 15h4" /></>,
  activeAssignments: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.25" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 15.5a4.5 4.5 0 0 1 6.5 4" /></>,
  upcomingAssignments: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h3M13 14h3" /></>,
  allocatedHours: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l4 2" /></>,
  submittedHours: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 11h6M9 15h6" /><path d="m9 18 1.5 1.5L14 16" /></>,
  approvedHours: <><path d="m5 12 4 4L19 6" /></>,
  correction: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></>,
  expiringDocuments: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 11h6M9 15h4" /><path d="M15.5 15v3M15.5 20h.01" /></>,
  trendTotal: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  trendHigh: <><path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" /></>,
  trendLow: <><path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" /></>,
  timesheetPending: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  timesheetApproved: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  timesheetRejected: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
  timesheetTotal: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 11h6M9 15h6" /></>,
};

function MetricIcon({ type }) {
  return (
    <span className="contractor-metric-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {metricIcons[type]}
      </svg>
    </span>
  );
}

function SummaryMetric({ title, value, description, icon, tone }) {
  return (
    <article className={`contractor-summary-card contractor-metric--${tone}`} aria-label={title}>
      <MetricIcon type={icon} />
      <div className="contractor-summary-copy">
        <p className="contractor-metric-label">{title}</p>
        <p className="contractor-summary-value">{value}</p>
        <p className="contractor-metric-description">{description}</p>
      </div>
    </article>
  );
}

function WorkMetric({ title, value, icon, tone }) {
  return (
    <article className={`contractor-work-card contractor-metric--${tone}`} aria-label={title}>
      <MetricIcon type={icon} />
      <div>
        <p className="contractor-metric-label">{title}</p>
        <p className="contractor-work-value">{value}</p>
      </div>
    </article>
  );
}

function HoursTrendMetric({ title, value, period, icon, tone }) {
  return (
    <article className={`contractor-hours-summary-item contractor-metric--${tone}`} aria-label={title}>
      <MetricIcon type={icon} />
      <div className="contractor-hours-summary-copy">
        <p className="contractor-hours-summary-label">{title}</p>
        <div className="contractor-hours-summary-value-row">
          <strong>{value}</strong>
          {period && <span>{period}</span>}
        </div>
      </div>
    </article>
  );
}

function TimesheetMetric({ title, value, icon, tone }) {
  return (
    <article className={`contractor-timesheet-card contractor-timesheet-card--${tone}`} aria-label={title}>
      <MetricIcon type={icon} />
      <div className="contractor-timesheet-card-copy">
        <p>{title}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function formatWeekRange(period, compact = false) {
  const [year, month, day] = String(period).split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(start.getTime())) return period;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const startLabel = shortDate.format(start);
  const endLabel = shortDate.format(end);
  return compact ? `${startLabel}–${endLabel}` : `${startLabel}–${endLabel}, ${end.getUTCFullYear()}`;
}

function summarizeHoursTrend(hoursTrend) {
  if (!Array.isArray(hoursTrend) || hoursTrend.length === 0) return null;

  return hoursTrend.reduce(
    (result, point) => {
      const hours = Number(point.hours) || 0;
      const normalizedPoint = { ...point, hours };

      return {
        total: result.total + hours,
        highest: !result.highest || hours > result.highest.hours ? normalizedPoint : result.highest,
        lowest: !result.lowest || hours < result.lowest.hours ? normalizedPoint : result.lowest,
      };
    },
    { total: 0, highest: null, lowest: null }
  );
}

/** Contractor-scoped operational dashboard. */
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
  const m20 = dashboard?.m20;
  const timesheets = dashboard?.timesheet_summary;
  const activeProjects = dashboard?.active_projects ?? [];
  const hoursTrend = dashboard?.hours_trend ?? [];
  const hoursTrendSummary = summarizeHoursTrend(hoursTrend);

  return (
    <DashboardLayout title="Contractor dashboard">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text">Dashboard</h1>
            <p className="text-sm text-muted">Your assignments, hours, and compliance actions at a glance.</p>
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
            <KpiRowSkeleton count={3} />
            <SectionSkeleton lines={5} />
            <SectionSkeleton lines={5} />
          </div>
        ) : !dashboard ? null : (
          <>
            <section className="contractor-summary-grid" aria-label="Contractor summary metrics">
              <SummaryMetric title="Active Projects" value={activeProjects.length} description="Projects you're assigned to" icon="projects" tone="blue" />
              <SummaryMetric title="Total Approved Hours" value={formatHours(summary.total_approved_hours)} description="Across all projects" icon="approvedTime" tone="green" />
              <SummaryMetric
                title="Remaining Assigned Hours"
                value={
                  activeProjects.length === 0
                    ? "—"
                    : formatHours(
                        activeProjects.reduce((sum, p) => sum + (p.remaining_hours ?? 0), 0)
                      )
                }
                description="Across active assignments"
                icon="remainingTime"
                tone="amber"
              />
            </section>

            {m20 && (
              <section className="contractor-work-panel" aria-labelledby="contractor-work-title">
                <div className="contractor-work-heading">
                  <h2 id="contractor-work-title">My work</h2>
                  <p>Your assignment, timesheet, and compliance actions.</p>
                </div>
                <div className="contractor-work-row contractor-work-row--four" data-testid="contractor-work-row-one">
                  <WorkMetric title="Active assignments" value={m20.assignments.active_assignments} icon="activeAssignments" tone="blue" />
                  <WorkMetric title="Upcoming assignments" value={m20.assignments.upcoming_assignments} icon="upcomingAssignments" tone="violet" />
                  <WorkMetric title="Allocated hours" value={formatHours(m20.assignments.allocated_hours)} icon="allocatedHours" tone="blue" />
                  <WorkMetric title="Submitted hours" value={formatHours(m20.timesheets.submitted_hours)} icon="submittedHours" tone="green" />
                </div>
                <div className="contractor-work-row contractor-work-row--three" data-testid="contractor-work-row-two">
                  <WorkMetric title="Approved hours" value={formatHours(m20.timesheets.approved_hours)} icon="approvedHours" tone="green" />
                  <WorkMetric title="Needs correction" value={m20.timesheets.rejected_action_items} icon="correction" tone="rose" />
                  <WorkMetric title="Documents expiring" value={m20.compliance.expiring_documents} icon="expiringDocuments" tone="amber" />
                </div>
              </section>
            )}

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
                        <div className="contractor-project-progress-copy w-40 shrink-0 text-right text-xs text-muted">
                          {p.work_progress_percent === null ? "—" : (
                            <>
                              <span className="contractor-project-hours-line">
                                <span className="contractor-project-hours-badge bg-primary text-primary-foreground">
                                  {formatHours(p.project_approved_hours)} of {formatHours(p.expected_hours)}
                                </span>
                                <span>completed</span>
                              </span>
                              <span className="contractor-project-progress-percent">{p.work_progress_percent}%</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <section className="contractor-hours-panel" aria-labelledby="contractor-hours-title">
              <div className="contractor-hours-heading">
                <div>
                  <h2 id="contractor-hours-title">Hours Trend</h2>
                  <p>Approved hours per week</p>
                </div>
              </div>
              <LineChart
                data={hoursTrend}
                valueKey="hours"
                labelKey="period"
                emptyMessage="No approved hours data available."
                formatLabel={formatWeekRange}
                seriesLabel="Approved hours"
                yAxisLabel="Hours"
              />
              {hoursTrendSummary && (
                <div className="contractor-hours-summary" aria-label="Hours trend summary">
                  <HoursTrendMetric
                    title="Total (period)"
                    value={formatHours(hoursTrendSummary.total)}
                    icon="trendTotal"
                    tone="blue"
                  />
                  <HoursTrendMetric
                    title="Highest week"
                    value={formatHours(hoursTrendSummary.highest.hours)}
                    period={formatWeekRange(hoursTrendSummary.highest.period, true)}
                    icon="trendHigh"
                    tone="green"
                  />
                  <HoursTrendMetric
                    title="Lowest week"
                    value={formatHours(hoursTrendSummary.lowest.hours)}
                    period={formatWeekRange(hoursTrendSummary.lowest.period, true)}
                    icon="trendLow"
                    tone="rose"
                  />
                </div>
              )}
            </section>

            <section className="contractor-timesheet-panel" aria-labelledby="contractor-timesheet-title">
              <div className="contractor-timesheet-heading">
                <h2 id="contractor-timesheet-title">Timesheet Summary</h2>
                <p>Overview of your submitted timesheets.</p>
              </div>
              <div className="contractor-timesheet-grid" data-testid="contractor-timesheet-summary-grid">
                <TimesheetMetric title="Pending" value={timesheets.pending} icon="timesheetPending" tone="pending" />
                <TimesheetMetric title="Approved" value={timesheets.approved} icon="timesheetApproved" tone="approved" />
                <TimesheetMetric title="Rejected" value={timesheets.rejected} icon="timesheetRejected" tone="rejected" />
                <TimesheetMetric title="Total Submitted" value={formatHours(timesheets.total_submitted_hours)} icon="timesheetTotal" tone="total" />
              </div>
            </section>

          </>
        )}
      </div>
    </DashboardLayout>
  );
}
