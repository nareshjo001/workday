import { useEffect, useMemo, useState } from "react";
import Spinner from "../Spinner";
import AlertBanner from "../AlertBanner";
import { getSkillTheme } from "../../utils/skillTheme";

const statuses = ["", "SUBMITTED", "SHORTLISTED", "ACCEPTED", "REJECTED", "WITHDRAWN"];
const PAGE_SIZE = 6;

export default function StaffingPipelineView({ data, loading, error, title = "Staffing Pipeline", description, subtitle, audience, showClient, lastUpdated, onRefresh }) {
  const [status, setStatus] = useState("");
  const [skill, setSkill] = useState("");
  const [project, setProject] = useState("");
  const [client, setClient] = useState("");
  const [onlyBreached, setOnlyBreached] = useState(false);
  const [page, setPage] = useState(1);
  const isVendor = audience === "vendor";
  const shouldShowClient = showClient !== undefined ? showClient : isVendor;
  const descText = description || subtitle || (isVendor
    ? "Open positions, candidate decisions, and the oldest review waiting for action."
    : "Review project openings, candidate decisions, and SLA attention.");
  const skills = useMemo(() => [...new Set((data?.items || []).map((item) => item.skill))].sort(), [data]);
  const projects = useMemo(() => [...new Map((data?.items || []).map((item) => [item.project_id, item.project_name])).entries()], [data]);
  const clients = useMemo(() => [...new Map((data?.items || []).map((item) => [item.company_id, item.company_name || "Client company"])).entries()], [data]);
  const items = (data?.items || []).filter((item) => (!status || item[`${status.toLowerCase()}_count`] > 0) && (!skill || item.skill === skill) && (!project || String(item.project_id) === project) && (!shouldShowClient || !client || String(item.company_id) === client) && (!onlyBreached || item.sla_breached));
  const summary = items.reduce((value, item) => ({
    open_positions: value.open_positions + item.open_positions,
    open_candidates: value.open_candidates + item.open_candidate_count,
    sla_breached_requirements: value.sla_breached_requirements + (item.sla_breached ? 1 : 0),
  }), { open_positions: 0, open_candidates: 0, sla_breached_requirements: 0 });
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const visibleItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [status, skill, project, client, onlyBreached, data]);

  return <div className={`mx-auto flex min-w-0 w-full max-w-6xl flex-col ${isVendor ? "gap-4" : "gap-5"}`}>
    <div className={isVendor ? "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" : undefined}>
      <div><h1 className="text-xl font-semibold text-text">{title}</h1><p className="mt-1 text-sm text-muted">{descText}</p></div>
      {isVendor && <RefreshPanel lastUpdated={lastUpdated} loading={loading} onRefresh={onRefresh} />}
    </div>
    <AlertBanner message={error} />
    {loading && !data ? <Spinner label="Loading staffing pipeline…" /> : <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Open positions" value={summary.open_positions} tone="blue" icon={<BriefcaseIcon />} />
        <Metric label="Candidates awaiting review" value={summary.open_candidates} tone="violet" icon={<UsersIcon />} />
        <Metric label="SLA breaches" value={summary.sla_breached_requirements} tone="red" icon={<ShieldIcon />} />
      </div>
      <VendorFilters
        status={status} setStatus={setStatus} skill={skill} setSkill={setSkill}
        project={project} setProject={setProject} client={client} setClient={setClient}
        onlyBreached={onlyBreached} setOnlyBreached={setOnlyBreached}
        skills={skills} projects={projects} clients={clients}
        showClient={shouldShowClient}
      />
      {items.length === 0
        ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted">No connected open requirements match these filters.</div>
        : <VendorPipelineTable items={visibleItems} page={page} totalPages={totalPages} onPageChange={setPage} />}
      <p className="text-xs text-muted">{isVendor ? "Only requirements on your currently connected projects are shown." : "Only your client-company projects are shown."} Due time is calculated from the submission timestamp and that project’s configured response policy.</p>
    </>}
  </div>;
}

function RefreshPanel({ lastUpdated, loading, onRefresh }) {
  return <div className="flex min-h-14 shrink-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
    <ClockIcon className="h-5 w-5 text-slate-500" />
    <div className="min-w-32"><div className="text-[11px] text-slate-400">Last updated</div><time className="block text-xs font-medium text-slate-600" dateTime={lastUpdated?.toISOString()}>{lastUpdated ? formatDateTime(lastUpdated) : "Not updated yet"}</time></div>
    <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60"><RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{loading ? "Refreshing…" : "Refresh"}</button>
  </div>;
}

function VendorFilters(props) {
  const showClient = Boolean(props.showClient);

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
      <div className={`grid flex-1 gap-2 sm:grid-cols-2 ${showClient ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <FilterSelect label="Filter by candidate status" value={props.status} onChange={props.setStatus} icon={<ClipboardIcon />}>
          <option value="">All candidate statuses</option>
          {statuses.slice(1).map((value) => <option key={value}>{value}</option>)}
        </FilterSelect>
        <FilterSelect label="Filter by skill" value={props.skill} onChange={props.setSkill} icon={<TagIcon />}>
          <option value="">All skills</option>
          {props.skills.map((value) => <option key={value}>{value}</option>)}
        </FilterSelect>
        <FilterSelect label="Filter by project" value={props.project} onChange={props.setProject} icon={<FolderIcon />}>
          <option value="">All projects</option>
          {props.projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </FilterSelect>
        {showClient && (
          <FilterSelect label="Filter by client" value={props.client} onChange={props.setClient} icon={<BuildingIcon />}>
            <option value="">All clients</option>
            {props.clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </FilterSelect>
        )}
      </div>
      <label className="flex h-10 shrink-0 cursor-pointer select-none items-center gap-2 whitespace-nowrap px-2 text-xs font-medium text-slate-700 transition hover:text-slate-900">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          <input
            type="checkbox"
            checked={props.onlyBreached}
            onChange={(event) => props.setOnlyBreached(event.target.checked)}
            style={{ margin: 0, padding: 0 }}
            className="!m-0 h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-0"
          />
        </span>
        <span className="select-none leading-4">SLA breached only</span>
      </label>
    </div>
  );
}

function FilterSelect({ label, value, onChange, icon, children }) {
  return <label className="relative block min-w-0"><span className="sr-only">{label}</span><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-blue-600" aria-hidden="true">{icon}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white py-0 pl-10 pr-8 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">{children}</select><ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /></label>;
}

function VendorPipelineTable({ items, page, totalPages, onPageChange }) {
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="overflow-x-auto"><table className="min-w-[860px] w-full table-fixed text-left">
      <colgroup><col className="w-[31%]" /><col className="w-[13%]" /><col className="w-[9%]" /><col className="w-[25%]" /><col className="w-[22%]" /></colgroup>
      <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500"><tr><th className="px-3 py-2.5">Client / project</th><th className="px-3 py-2.5">Skill</th><th className="px-3 py-2.5">Open</th><th className="px-3 py-2.5">Candidate funnel</th><th className="px-3 py-2.5">Oldest review</th></tr></thead>
      <tbody>{items.map((item) => <VendorPipelineRow key={item.requirement_id} item={item} />)}</tbody>
    </table></div>
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-3 py-2.5 text-[11px] text-slate-500"><span>Showing {items.length} result{items.length === 1 ? "" : "s"}</span><nav aria-label="Staffing pipeline pagination" className="flex items-center gap-3"><button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="h-8 rounded-lg border border-slate-200 px-3 font-medium disabled:text-slate-300">Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="h-8 rounded-lg border border-slate-200 px-3 font-medium disabled:text-slate-300">Next</button></nav></div>
  </div>;
}

function VendorPipelineRow({ item }) {
  const clientName = item.company_name || "Client company";
  return <tr className="h-16 border-t border-slate-200 align-middle text-xs text-slate-700 first:border-t-0">
    <td className="px-3 py-2"><div className="min-w-0"><div className="truncate text-[13px] font-semibold text-slate-900" title={item.project_name}>{item.project_name}</div><div className="mt-0.5 truncate text-[11px] text-slate-500">{clientName}</div></div></td>
    <td className="px-3 py-2"><SkillBadge skill={item.skill} /></td>
    <td className="px-3 py-2 font-medium text-slate-800">{item.open_positions} of {item.required_count}</td>
    <td className="px-3 py-2 text-[11px] leading-5 text-slate-500"><div>{item.submitted_count} submitted · {item.shortlisted_count} shortlisted</div><div>{item.accepted_count} accepted · {item.rejected_count} rejected · {item.withdrawn_count} withdrawn</div></td>
    <td className="px-3 py-2"><ReviewStatus item={item} /></td>
  </tr>;
}

function SkillBadge({ skill }) {
  const theme = getSkillTheme(skill);
  return <span className="inline-flex h-7 max-w-full items-center justify-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold uppercase leading-none align-middle" style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}><i className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: theme.dot }} />{skill}</span>;
}

function ReviewStatus({ item }) {
  if (!item.oldest_open_submitted_at) return <div className="flex items-center gap-2 text-[11px] text-slate-500"><ClockIcon className="h-4 w-4 shrink-0" /><span>No review waiting</span></div>;
  return <div className="flex items-start gap-2 text-[11px] leading-4"><AlertIcon className={`mt-0.5 h-4 w-4 shrink-0 ${item.sla_breached ? "text-red-600" : "text-slate-500"}`} /><div><div className={item.sla_breached ? "font-semibold text-red-600" : "font-medium text-slate-700"}>{item.sla_breached ? "SLA breached" : "Within SLA"}</div><div className="text-slate-500">Due {formatDateTime(item.due_at)}</div><div className="text-slate-500">({item.candidate_response_sla_hours}h policy)</div></div></div>;
}


const metricTones = { blue: { card: "bg-blue-50/80 ring-blue-200/80", icon: "bg-blue-100 text-blue-700" }, violet: { card: "bg-violet-50/80 ring-violet-200/80", icon: "bg-violet-100 text-violet-700" }, red: { card: "bg-red-50/80 ring-red-200/80", icon: "bg-red-100 text-red-700" } };
function Metric({ label, value, tone, icon }) { const colors = metricTones[tone]; return <div className={`flex min-h-24 items-center gap-4 rounded-xl p-4 text-text shadow-sm ring-1 ${colors.card}`}><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${colors.icon}`} aria-hidden="true">{icon}</div><div className="min-w-0"><div className="text-sm font-medium leading-snug text-text-secondary">{label}</div><div className="mt-1 text-2xl font-semibold leading-none text-text">{value}</div></div></div>; }
function formatDateTime(value) { if (!value) return ""; return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function Icon({ children, className = "h-4 w-4" }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>; }
function BriefcaseIcon() { return <Icon className="h-5 w-5"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></Icon>; }
function UsersIcon() { return <Icon className="h-5 w-5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 1-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Icon>; }
function ShieldIcon() { return <Icon className="h-5 w-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="M12 8v4M12 16h.01" /></Icon>; }
function ClockIcon({ className }) { return <Icon className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>; }
function RefreshIcon({ className }) { return <Icon className={className}><path d="M20 6v5h-5M4 18v-5h5" /><path d="M18.5 9A7 7 0 0 0 6 6.5L4 9m2 6a7 7 0 0 0 12 2.5l2-2.5" /></Icon>; }
function ClipboardIcon() { return <Icon><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4" /></Icon>; }
function TagIcon() { return <Icon><path d="M20 12 12 20l-9-9V4h7Z" /><circle cx="7.5" cy="8.5" r="1" /></Icon>; }
function FolderIcon() { return <Icon><path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></Icon>; }
function BuildingIcon() { return <Icon><path d="M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2M17 13h1M17 17h1M2 21h20" /></Icon>; }
function ChevronDownIcon({ className }) { return <Icon className={className}><path d="m7 10 5 5 5-5" /></Icon>; }
function AlertIcon({ className }) { return <Icon className={className}><path d="m12 3 9 17H3Z" /><path d="M12 9v4M12 17h.01" /></Icon>; }
