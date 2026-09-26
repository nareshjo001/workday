import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import AlertBanner from "../components/AlertBanner";
import KpiCard from "../components/dashboard/KpiCard";
import SectionCard from "../components/dashboard/SectionCard";
import BarList from "../components/dashboard/BarList";
import ProgressBar from "../components/dashboard/ProgressBar";
import EmptyState from "../components/dashboard/EmptyState";
import ActivityPreview from "../components/activity/ActivityPreview";
import { KpiRowSkeleton, SectionSkeleton } from "../components/dashboard/Skeleton";
import { formatCurrency, formatHours } from "../components/dashboard/format";
import vendorDashboardService from "../services/vendorDashboardService";
import vendorClientService from "../services/vendorClientService";
import DashboardExports from "../components/dashboard/DashboardExports";
import VendorDashboardFilters from "../components/dashboard/VendorDashboardFilters";

const PROJECT_PREVIEW_LIMIT = 3;
const EARNINGS_PREVIEW_LIMIT = 3;
const isActiveProject = (project) => project?.status === "ACTIVE";

// Present server-computed metrics scoped to the authenticated vendor.
export default function VendorHomePage() {
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filters, setFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({ clients: [], projects: [] });
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(true);
  const [filterOptionsError, setFilterOptionsError] = useState(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [companiesExpanded, setCompaniesExpanded] = useState(false);
  const [contractorsExpanded, setContractorsExpanded] = useState(false);
  const isCompaniesExpanded = companiesExpanded && ((dashboard?.earnings_by_company?.length || 0) > EARNINGS_PREVIEW_LIMIT);
  const isContractorsExpanded = contractorsExpanded && ((dashboard?.earnings_by_contractor?.length || 0) > EARNINGS_PREVIEW_LIMIT);
  const isAnyEarningsExpanded = isCompaniesExpanded || isContractorsExpanded;

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

  useEffect(() => {
    let cancelled = false;

    async function loadFilterOptions() {
      setFilterOptionsLoading(true);
      setFilterOptionsError(null);
      try {
        const response = await vendorClientService.list();
        const clients = response.items || [];
        const clientDetails = await Promise.all(clients.map((client) => vendorClientService.detail(client.id)));
        const projectsById = new Map();

        clientDetails.forEach((detail) => {
          (detail.active_projects || []).forEach((project) => {
            projectsById.set(project.id, {
              id: project.id,
              name: project.name,
              clientId: detail.company.id,
            });
          });
        });

        if (!cancelled) {
          setFilterOptions({
            clients: clients.map((client) => ({ id: client.id, name: client.name })),
            projects: Array.from(projectsById.values()).sort((a, b) => a.name.localeCompare(b.name)),
          });
        }
      } catch (err) {
        if (!cancelled) setFilterOptionsError(err.message || "Filter options could not be loaded.");
      } finally {
        if (!cancelled) setFilterOptionsLoading(false);
      }
    }

    loadFilterOptions();
    return () => { cancelled = true; };
  }, []);

  const invoices = dashboard?.invoices;
  const commercial = dashboard?.m20;
  const activeFilterLabels = [
    filters.clientId && `Client: ${filterOptions.clients.find((item) => String(item.id) === String(filters.clientId))?.name || "Selected"}`,
    filters.projectId && `Project: ${filterOptions.projects.find((item) => String(item.id) === String(filters.projectId))?.name || "Selected"}`,
    filters.status && `Status: ${String(filters.status).replace("_", " ")}`,
    filters.startDate && `Work from: ${filters.startDate}`,
    filters.endDate && `Work through: ${filters.endDate}`,
  ].filter(Boolean);

  return (
    <DashboardLayout title="Vendor dashboard">
      <div className="vendor-overview mx-auto flex max-w-6xl flex-col gap-5">
        <div className="dashboard-intro-actions">
          <div>
            <h1 className="text-xl font-semibold text-text">Dashboard</h1>
            <p className="text-sm text-muted">Your contractors, projects, and billing at a glance.</p>
          </div>
          <nav className="dashboard-quick-actions" aria-label="Dashboard quick actions">
            <Link
              to="/vendor/contractors"
              className="dashboard-action dashboard-action--primary"
            >
              Manage Contractors
            </Link>
            <Link
              to="/vendor/assignments"
              className="dashboard-action"
            >
              Assign to Project
            </Link>
            <Link
              to="/vendor/invoices"
              className="dashboard-action"
            >
              Invoices
            </Link>
            <Link
              to="/vendor/clients"
              className="dashboard-action"
            >
              Clients
            </Link>
          </nav>
        </div>

        <div className={`dashboard-tools${toolsOpen ? " is-expanded" : " is-collapsed"}`}>
          <button
            type="button"
            className="dashboard-tools-toggle"
            onClick={() => setToolsOpen((prev) => !prev)}
            aria-expanded={toolsOpen}
            aria-controls="vendor-filters-panel"
          >
            <span>Filters &amp; exports</span>
            <span className="dashboard-tools-indicator" aria-hidden="true">
              {toolsOpen ? "−" : "+"}
            </span>
          </button>
          <div
            id="vendor-filters-panel"
            data-testid="vendor-filters-content"
            className={`dashboard-tools-content${toolsOpen ? " is-expanded" : ""}`}
            aria-hidden={!toolsOpen}
          >
            <div className="dashboard-tools-inner">
              <SectionCard title="Filters" description="Client, project, and status scope every dashboard section. Dates scope work-date analytics only. Exports use the selected filters.">
                <VendorDashboardFilters
                  clients={filterOptions.clients}
                  projects={filterOptions.projects}
                  optionsLoading={filterOptionsLoading}
                  onApply={(next) => { setFilters(next); loadDashboard(next); }}
                />
                {filterOptionsError && <p className="mt-2 text-xs text-error" role="alert">{filterOptionsError}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
                  <span className="text-xs font-medium text-muted">Applied scope:</span>
                  {activeFilterLabels.length === 0 ? (
                    <span className="rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs text-text-secondary">All dashboard data</span>
                  ) : activeFilterLabels.map((label) => (
                    <span key={label} className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">{label}</span>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="Exports" description="Download exactly the filtered data available to your organization.">
                <DashboardExports role="vendor" filters={filters} />
              </SectionCard>
            </div>
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
            <div className="vendor-overview-kpis grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
              <KpiCard title="Active Projects" value={commercial.financial.active_projects} icon={<FolderKpiIcon />} />
              <KpiCard title="Active Contractors" value={commercial.workforce.active_contractors} icon={<UsersKpiIcon />} />
              <KpiCard
                title="Total Contractor Earnings"
                value={formatCurrency(commercial.financial.approved_earnings_amount)}
                description="Approved invoices, including legacy auto-approved"
                icon={<EarningsKpiIcon />}
              />
              <KpiCard title="Completed Projects" value={commercial.financial.completed_projects} icon={<CompletedKpiIcon />} />
            </div>

            <div
              className={`vendor-earnings-grid grid grid-cols-1 gap-5 lg:grid-cols-2 ${
                isAnyEarningsExpanded ? "earnings-grid--expanded is-any-expanded items-start" : "items-start lg:items-stretch"
              }`}
            >
              <EarningsSection
                title="Highest Pay by Company"
                description="Earned amount per client company"
                data={dashboard.earnings_by_company.map((company) => ({
                  label: company.company_name,
                  value: company.total,
                  displayValue: formatCurrency(company.total),
                }))}
                itemName="companies"
                testId="vendor-company-earnings"
                expanded={isCompaniesExpanded}
                onToggle={() => setCompaniesExpanded((current) => !current)}
              />

              <EarningsSection
                title="Contractor Earnings Breakdown"
                description="Earned amount per contractor"
                data={dashboard.earnings_by_contractor.map((contractor) => ({
                  label: contractor.contractor_name,
                  value: contractor.total,
                  displayValue: formatCurrency(contractor.total),
                }))}
                itemName="contractors"
                testId="vendor-contractor-earnings"
                barColorClass="vendor-bar-gradient--green"
                expanded={isContractorsExpanded}
                onToggle={() => setContractorsExpanded((current) => !current)}
              />
            </div>

            <ProjectProgressSection projects={dashboard.project_progress} />
            <InvoiceOverview invoices={invoices} />
            {commercial && <CommercialLifecycle commercial={commercial} />}
            <RecentActivity activity={dashboard.recent_activity} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function ProjectProgressSection({ projects = [] }) {
  const [showAllProjects, setShowAllProjects] = useState(false);
  const activeProjects = projects.filter(isActiveProject);
  const previewProjects = activeProjects.slice(0, PROJECT_PREVIEW_LIMIT);
  const additionalProjects = activeProjects.slice(PROJECT_PREVIEW_LIMIT);

  return (
    <SectionCard title="Project Progress" description="Approved work hours vs. expected hours for each project in the applied scope" className="vendor-project-progress">
      {activeProjects.length === 0 ? (
        <EmptyState message="No active projects to display." compact />
      ) : (
        <>
          <div id="vendor-project-preview" className="vendor-project-list" data-testid="vendor-project-preview">
            {previewProjects.map((project) => <ProjectProgressRow key={project.id} project={project} />)}
            {additionalProjects.length > 0 && (
              <CollapsibleExtra expanded={showAllProjects} className="vendor-project-extra-list">
                {additionalProjects.map((project) => <ProjectProgressRow key={project.id} project={project} />)}
              </CollapsibleExtra>
            )}
          </div>
          {activeProjects.length > PROJECT_PREVIEW_LIMIT && (
            <ExpandControl
              expanded={showAllProjects}
              itemName="projects"
              controlsId="vendor-project-preview"
              onToggle={() => setShowAllProjects((current) => !current)}
            />
          )}
        </>
      )}
    </SectionCard>
  );
}

function ProjectProgressRow({ project }) {
  return (
    <div className="vendor-project-row">
      <div className="vendor-project-meta">
        <span className="vendor-project-name" title={project.name}>{project.name}</span>
        <div className="vendor-project-status">
          <span className="vendor-project-client">
            <span className="vendor-project-status-icon"><BuildingIcon /></span>
            <span className="vendor-project-company" title={project.company_name}>{project.company_name}</span>
          </span>
          <span className="vendor-project-status-divider" aria-hidden="true" />
          <span className="vendor-project-hours">
            <ClockIcon />
            <span>
              {project.work_progress_percent === null
                ? "—"
                : `${formatHours(project.approved_hours)} / ${formatHours(project.expected_hours)}`}
            </span>
          </span>
          {project.work_progress_percent !== null && (
            <span className="vendor-project-percent">{project.work_progress_percent}%</span>
          )}
        </div>
      </div>
      <div className="vendor-project-progress-row">
        <ProgressBar percent={project.work_progress_percent} size="sm" />
      </div>
    </div>
  );
}

function EarningsSection({
  title,
  description,
  data,
  itemName,
  testId,
  barColorClass = "vendor-bar-gradient--blue",
  expanded,
  onToggle,
}) {
  const [internalShowAll, setInternalShowAll] = useState(false);
  const showAll = expanded !== undefined ? expanded : internalShowAll;
  const handleToggle = onToggle || (() => setInternalShowAll((current) => !current));
  const previewData = data.slice(0, EARNINGS_PREVIEW_LIMIT);
  const additionalData = data.slice(EARNINGS_PREVIEW_LIMIT);

  return (
    <SectionCard title={title} description={description} className={`vendor-earnings-card ${showAll ? "is-expanded" : "is-collapsed"}`}>
      <div id={testId} data-testid={testId}>
        <BarList data={previewData} emptyMessage="No earnings data available." barColorClass={barColorClass} />
        {additionalData.length > 0 && (
          <CollapsibleExtra expanded={showAll} className="vendor-earnings-extra-list">
            <BarList data={additionalData} barColorClass={barColorClass} />
          </CollapsibleExtra>
        )}
      </div>
      {data.length > EARNINGS_PREVIEW_LIMIT && (
        <ExpandControl
          expanded={showAll}
          itemName={itemName}
          controlsId={testId}
          onToggle={handleToggle}
        />
      )}
    </SectionCard>
  );
}

function CollapsibleExtra({ expanded, className, children }) {
  return (
    <div className={`vendor-collapsible-extra${expanded ? " is-expanded" : ""}`} aria-hidden={!expanded}>
      <div className={`vendor-collapsible-extra-inner ${className || ""}`}>{children}</div>
    </div>
  );
}

function ExpandControl({ expanded, itemName, controlsId, onToggle }) {
  const label = expanded ? "Show less" : `Show all ${itemName}`;

  return (
    <button
      type="button"
      className="vendor-section-footer-control vendor-expand-control"
      aria-expanded={expanded}
      aria-controls={controlsId}
      aria-label={expanded ? `Show fewer ${itemName}` : `Show all ${itemName}`}
      onClick={onToggle}
    >
      <span>{label}</span>
      <ChevronIcon />
    </button>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5 8 5 5 5-5" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 21V4h10v17M15 9h4v12M8 8h1m3 0h1m-5 4h1m3 0h1m-5 4h1m3 0h1M3 21h18" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </svg>
  );
}

function FolderKpiIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-testid="kpi-icon-projects">
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9l-.81-1.2a2 2 0 0 0-1.67-.9H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function UsersKpiIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-testid="kpi-icon-contractors">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function EarningsKpiIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-testid="kpi-icon-earnings">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 18V6" />
    </svg>
  );
}

function CompletedKpiIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-testid="kpi-icon-completed">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function InvoiceOverview({ invoices }) {
  const metrics = [
    { label: "Draft", value: invoices.draft_count, detail: formatCurrency(invoices.draft_total), tone: "draft" },
    { label: "Submitted", value: invoices.submitted_count, detail: formatCurrency(invoices.submitted_total), tone: "submitted" },
    { label: "Legacy Pending", value: invoices.pending_review_count, tone: "pending" },
    { label: "Approved", value: invoices.approved_count, detail: formatCurrency(invoices.approved_total), tone: "approved" },
    { label: "Rejected", value: invoices.rejected_count, detail: formatCurrency(invoices.rejected_total), tone: "rejected" },
    { label: "Total Invoiced", value: formatCurrency(invoices.total_invoiced_amount), tone: "total" },
  ];

  return (
    <SectionCard title="Invoice Overview" description="Invoice lifecycle totals for the applied project scope" className="vendor-financial-section vendor-invoice-section">
      <div className="vendor-invoice-grid" data-testid="vendor-invoice-metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className={`vendor-invoice-metric tone-${metric.tone}`}>
            <span className="vendor-metric-label"><i aria-hidden="true" />{metric.label}</span>
            <strong>{metric.value}</strong>
            {metric.detail && <small>{metric.detail}</small>}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function CommercialLifecycle({ commercial }) {
  const metrics = [
    { label: "Approved work", value: formatHours(commercial.time.approved_hours), tone: "approved-work" },
    { label: "Billable, uninvoiced", value: formatCurrency(commercial.financial.billable_uninvoiced_amount), tone: "billable" },
    { label: "Paid", value: formatCurrency(commercial.financial.paid_amount), tone: "paid" },
    { label: "Outstanding", value: formatCurrency(commercial.financial.outstanding_amount), tone: "outstanding" },
    { label: "Overdue", value: formatCurrency(commercial.financial.overdue_amount), tone: "overdue" },
    { label: "Open requirements", value: commercial.workforce.open_requirements, tone: "requirements" },
    { label: "Pending reviews", value: commercial.candidates.pending_reviews, tone: "reviews" },
    {
      label: "Snapshot margin",
      value: commercial.financial.margin ? formatCurrency(commercial.financial.margin.amount) : "—",
      detail: commercial.financial.margin?.percentage == null ? "No snapshot margin" : `${commercial.financial.margin.percentage}%`,
      tone: "margin",
    },
  ];

  return (
    <SectionCard title="Commercial lifecycle" description="Approved work, invoice state, settlement, and snapshot-based margin are distinct measures." className="vendor-financial-section vendor-commercial-section">
      <div className="vendor-commercial-grid" data-testid="vendor-commercial-metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className={`vendor-commercial-metric tone-${metric.tone}`}>
            <span className="vendor-metric-label"><i aria-hidden="true" />{metric.label}</span>
            <strong>{metric.value}</strong>
            {metric.detail && <small>{metric.detail}</small>}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function RecentActivity({ activity = [] }) {
  return (
    <SectionCard title="Recent Activity" className="vendor-recent-activity">
      <ActivityPreview activity={activity} to="/vendor/activity" testId="vendor-activity-preview" />
    </SectionCard>
  );
}
