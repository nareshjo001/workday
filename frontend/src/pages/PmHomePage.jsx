import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import AlertBanner from "../components/AlertBanner";
import SectionCard from "../components/dashboard/SectionCard";
import ProgressBar from "../components/dashboard/ProgressBar";
import ActivityPreview from "../components/activity/ActivityPreview";
import EmptyState from "../components/dashboard/EmptyState";
import { SectionSkeleton } from "../components/dashboard/Skeleton";
import PmDashboardSummary, { PmDashboardIcon } from "../components/dashboard/PmDashboardSummary";
import "./PmHomePage.css";
import { formatCurrency, formatHours } from "../components/dashboard/format";
import pmDashboardService from "../services/pmDashboardService";
import DashboardExports from "../components/dashboard/DashboardExports";
import DashboardFilters from "../components/dashboard/DashboardFilters";

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
  const [filters, setFilters] = useState({});
  const [toolsOpen, setToolsOpen] = useState(false);

  const loadDashboard = useCallback(async (activeFilters = filters) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await pmDashboardService.getDashboard(activeFilters);
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
  const milestones = dashboard?.milestones;
  const completion = dashboard?.completion_analytics;
  const commercial = dashboard?.m20;
  const financialMetrics = commercial ? [
    ["budget", "budget", "Project budget", formatCurrency(commercial.financial.budget), "Total allocated budget"],
    ["approved-work", "timesheets", "Approved work", formatHours(commercial.time.approved_hours), "Approved timesheet hours"],
    ["submitted", "invoices", "Submitted invoices", formatCurrency(commercial.financial.submitted_invoice_amount), "Awaiting review"],
    ["approved", "completed", "Approved invoices", formatCurrency(commercial.financial.approved_invoice_amount), "Approved invoice amount"],
    ["paid", "payment", "Paid", formatCurrency(commercial.financial.paid_amount), "Payments recorded"],
    ["outstanding", "outstanding", "Outstanding", formatCurrency(commercial.financial.outstanding_amount), "Approved invoices unpaid"],
    ["overdue", "alert", "Overdue", formatCurrency(commercial.financial.overdue_amount), "Past due approved balance"],
    ["review", "review", "Pending invoice reviews", commercial.financial.pending_invoice_reviews, "Submitted invoices"],
  ] : [];
  const activeProjects = dashboard?.projects?.filter((p) => p.status === "ACTIVE") ?? [];
  const hoursProgressProjects = activeProjects.filter((p) => p.expected_hours !== null);
  const hoursProgress = hoursProgressProjects.reduce(
    (totals, project) => ({
      approved: totals.approved + Number(project.approved_hours || 0),
      expected: totals.expected + Number(project.expected_hours || 0),
    }),
    { approved: 0, expected: 0 }
  );
  const approvedHoursPercent = hoursProgress.expected > 0
    ? Math.min(100, (hoursProgress.approved / hoursProgress.expected) * 100)
    : null;

  return (
    <DashboardLayout title="PM dashboard">
      <div className="pm-dashboard">
        <div className="dashboard-intro-actions pm-dashboard-intro-actions">
          <div className="pm-dashboard-intro">
            <h1 className="text-xl font-semibold text-text">Dashboard</h1>
            <p className="text-sm text-muted">Your projects, staffing, and billing at a glance.</p>
          </div>
          <nav className="dashboard-quick-actions" aria-label="Dashboard quick actions">
            <Link
              to="/pm/projects"
              className="dashboard-action dashboard-action--primary"
            >
              <PmDashboardIcon name="dashboard" />
              Manage Projects
            </Link>
            <Link
              to="/pm/timesheets"
              className="dashboard-action"
            >
              <PmDashboardIcon name="timesheets" />
              Timesheet
            </Link>
            <Link
              to="/pm/milestones"
              className="dashboard-action"
            >
              <PmDashboardIcon name="milestones" />
              Milestones & Billing
            </Link>
            <Link
              to="/pm/invoices"
              className="dashboard-action"
            >
              <PmDashboardIcon name="invoices" />
              Invoices
            </Link>
          </nav>
        </div>

        {(isLoading || summary) && <PmDashboardSummary summary={summary} isLoading={isLoading} />}

        <div className={`dashboard-tools${toolsOpen ? " is-expanded" : " is-collapsed"}`}>
          <button
            type="button"
            className="dashboard-tools-toggle"
            onClick={() => setToolsOpen((previous) => !previous)}
            aria-expanded={toolsOpen}
            aria-controls="pm-filters-panel"
          >
            <span>Filters &amp; exports</span>
            <span className="dashboard-tools-indicator" aria-hidden="true">
              {toolsOpen ? "−" : "+"}
            </span>
          </button>
          <div
            id="pm-filters-panel"
            data-testid="pm-filters-content"
            className={`dashboard-tools-content${toolsOpen ? " is-expanded" : ""}`}
            aria-hidden={!toolsOpen}
          >
            <div className="dashboard-tools-inner">
              <SectionCard title="Filters" description="Metrics and exports use the same server-side scope.">
                <DashboardFilters onApply={(next) => { setFilters(next); loadDashboard(next); }} />
              </SectionCard>
              <SectionCard title="Exports" description="Download exactly the filtered data available to your authorized projects.">
                <DashboardExports role="pm" filters={filters} />
              </SectionCard>
            </div>
          </div>
        </div>

        <AlertBanner message={loadError} />

        {isLoading ? (
          <div className="flex flex-col gap-5">
            <SectionSkeleton lines={5} />
            <SectionSkeleton lines={5} />
          </div>
        ) : !dashboard ? null : (
          <>
            <section className="pm-dashboard-analytics" aria-label="Project analytics overview">
              <SectionCard
                className="pm-dashboard-analytics-card"
                title={<span className="pm-dashboard-analytics-title"><span className="pm-dashboard-analytics-icon pm-dashboard-analytics-icon--hours"><PmDashboardIcon name="timesheets" /></span>Hours Progress</span>}
                description="Approved vs. expected hours for active projects."
              >
                {hoursProgressProjects.length === 0 ? <EmptyState message="No active projects with expected hours yet." compact /> : (
                  <div className="pm-dashboard-hours-summary">
                    <div className="pm-dashboard-hours-row">
                      <span>Approved</span>
                      <div aria-label="Approved hours progress"><ProgressBar percent={approvedHoursPercent} size="sm" /></div>
                      <strong>{formatHours(hoursProgress.approved)}</strong>
                    </div>
                    <div className="pm-dashboard-hours-row pm-dashboard-hours-row--expected">
                      <span>Expected</span>
                      <div aria-label="Expected hours"><ProgressBar percent={100} size="sm" /></div>
                      <strong>{formatHours(hoursProgress.expected)}</strong>
                    </div>
                  </div>
                )}
              </SectionCard>

              <SectionCard
                className="pm-dashboard-analytics-card"
                title={<span className="pm-dashboard-analytics-title"><span className="pm-dashboard-analytics-icon pm-dashboard-analytics-icon--milestones"><PmDashboardIcon name="milestones" /></span>Milestone Overview</span>}
                description="Status of project milestones."
              >
                <div className="pm-dashboard-analytics-tiles" aria-label="Milestone counts">
                  <div className="pm-dashboard-analytics-tile pm-dashboard-analytics-tile--pending"><span>Pending</span><strong>{milestones.pending}</strong></div>
                  <div className="pm-dashboard-analytics-tile pm-dashboard-analytics-tile--met"><span>Met</span><strong>{milestones.met}</strong></div>
                  <div className="pm-dashboard-analytics-tile pm-dashboard-analytics-tile--billed"><span>Billed</span><strong>{milestones.with_billing_generated}</strong></div>
                </div>
              </SectionCard>

              <SectionCard
                className="pm-dashboard-analytics-card"
                title={<span className="pm-dashboard-analytics-title"><span className="pm-dashboard-analytics-icon pm-dashboard-analytics-icon--invoices"><PmDashboardIcon name="invoices" /></span>Invoice Overview</span>}
                description="Across all projects you manage."
              >
                <div className="pm-dashboard-analytics-tiles" aria-label="Invoice counts">
                  <div className="pm-dashboard-analytics-tile pm-dashboard-analytics-tile--review"><span>Pending Review</span><strong>{invoices.pending_review_count}</strong></div>
                  <div className="pm-dashboard-analytics-tile pm-dashboard-analytics-tile--approved"><span>Approved</span><strong>{invoices.approved_count}</strong><small>{formatCurrency(invoices.approved_total)}</small></div>
                  <div className="pm-dashboard-analytics-tile pm-dashboard-analytics-tile--rejected"><span>Rejected</span><strong>{invoices.rejected_count}</strong><small>{formatCurrency(invoices.rejected_total)}</small></div>
                </div>
              </SectionCard>
            </section>

            <SectionCard title="Completion Analytics">
              <div className="pm-completion-analytics" aria-label="Completion metrics">
                <article className="pm-completion-metric pm-completion-metric--completed">
                  <span className="pm-completion-metric-icon"><PmDashboardIcon name="completed" /></span>
                  <div><h3>Completed</h3><strong>{completion.completed_projects}</strong><p>Projects completed</p></div>
                </article>
                <article className="pm-completion-metric pm-completion-metric--average">
                  <span className="pm-completion-metric-icon"><PmDashboardIcon name="analytics" /></span>
                  <div><h3>Avg. Completion</h3><strong>{completion.average_completion_percent === null ? "—" : `${completion.average_completion_percent}%`}</strong><p>Across active projects</p></div>
                </article>
                <article className="pm-completion-metric pm-completion-metric--approaching">
                  <span className="pm-completion-metric-icon"><PmDashboardIcon name="timesheets" /></span>
                  <div><h3>Approaching End Date</h3><strong>{completion.approaching_end_date_count}</strong><p>Within next 14 days</p></div>
                </article>
                <article className="pm-completion-metric pm-completion-metric--past-end">
                  <span className="pm-completion-metric-icon"><PmDashboardIcon name="calendar" /></span>
                  <div><h3>Past End Date, Still Active</h3><strong>{completion.past_end_date_still_active_count}</strong></div>
                </article>
              </div>
            </SectionCard>

            {commercial && <SectionCard
              className="pm-financial-summary"
              title={<span className="pm-financial-summary-title"><span className="pm-financial-summary-title-icon"><PmDashboardIcon name="analytics" /></span>Project financials</span>}
              description="Budget, approved work, invoicing, payment, and outstanding balances are separate."
            >
              <div className="pm-financial-grid" aria-label="Project financial metrics">
                {financialMetrics.map(([theme, icon, label, value, description]) => (
                  <article className={`pm-financial-metric pm-financial-metric--${theme}`} key={theme} aria-label={label}>
                    <span className="pm-financial-metric-icon"><PmDashboardIcon name={icon} /></span>
                    <div>
                      <h3>{label}</h3>
                      <strong>{value}</strong>
                      <p>{description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>}

            <SectionCard title="Recent Activity" className="vendor-recent-activity">
              <ActivityPreview activity={dashboard.recent_activity} to="/pm/activity" testId="pm-activity-preview" />
            </SectionCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
