import { useMemo, useState } from "react";
import Spinner from "../Spinner";
import AlertBanner from "../AlertBanner";

const statuses = ["", "SUBMITTED", "SHORTLISTED", "ACCEPTED", "REJECTED", "WITHDRAWN"];

export default function StaffingPipelineView({ data, loading, error, title, audience }) {
  const [status, setStatus] = useState("");
  const [skill, setSkill] = useState("");
  const [project, setProject] = useState("");
  const [client, setClient] = useState("");
  const [onlyBreached, setOnlyBreached] = useState(false);
  const skills = useMemo(() => [...new Set((data?.items || []).map((item) => item.skill))].sort(), [data]);
  const projects = useMemo(() => [...new Map((data?.items || []).map((item) => [item.project_id, item.project_name])).entries()], [data]);
  const clients = useMemo(() => [...new Map((data?.items || []).map((item) => [item.company_id, item.company_name || "Client company"])).entries()], [data]);
  const items = (data?.items || []).filter((item) => (!status || item[`${status.toLowerCase()}_count`] > 0) && (!skill || item.skill === skill) && (!project || String(item.project_id) === project) && (!client || String(item.company_id) === client) && (!onlyBreached || item.sla_breached));
  const summary = items.reduce((value, item) => ({
    open_positions: value.open_positions + item.open_positions,
    open_candidates: value.open_candidates + item.open_candidate_count,
    sla_breached_requirements: value.sla_breached_requirements + (item.sla_breached ? 1 : 0),
  }), { open_positions: 0, open_candidates: 0, sla_breached_requirements: 0 });
  return <div className="mx-auto flex min-w-0 w-full max-w-6xl flex-col gap-5">
    <div><h1 className="text-xl font-semibold text-text">{title}</h1><p className="mt-1 text-sm text-muted">Open positions, candidate decisions, and the oldest review waiting for action.</p></div>
    <AlertBanner message={error} />
    {loading ? <Spinner label="Loading staffing pipeline…" /> : <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Open positions" value={summary.open_positions} />
        <Metric label="Candidates awaiting review" value={summary.open_candidates} />
        <Metric label="SLA breaches" value={summary.sla_breached_requirements} alert={summary.sla_breached_requirements > 0} />
      </div>
      <div className="flex flex-wrap gap-3 rounded-lg bg-surface p-3 ring-1 ring-border">
        <select aria-label="Filter by candidate status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-border bg-surface px-2 py-1 text-sm"><option value="">All candidate statuses</option>{statuses.slice(1).map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter by skill" value={skill} onChange={(e) => setSkill(e.target.value)} className="rounded border border-border bg-surface px-2 py-1 text-sm"><option value="">All skills</option>{skills.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter by project" value={project} onChange={(e) => setProject(e.target.value)} className="rounded border border-border bg-surface px-2 py-1 text-sm"><option value="">All projects</option>{projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        <select aria-label="Filter by client" value={client} onChange={(e) => setClient(e.target.value)} className="rounded border border-border bg-surface px-2 py-1 text-sm"><option value="">All clients</option>{clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={onlyBreached} onChange={(e) => setOnlyBreached(e.target.checked)} />SLA breached only</label>
      </div>
      {items.length === 0 ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted">No connected open requirements match these filters.</div> : <div className="overflow-x-auto rounded-lg bg-surface shadow-panel ring-1 ring-border"><table className="min-w-full text-sm"><thead className="bg-surface-muted text-left text-text-secondary"><tr><th className="p-3">Client / project</th><th className="p-3">Skill</th><th className="p-3">Open</th><th className="p-3">Candidate funnel</th><th className="p-3">Oldest review</th></tr></thead><tbody>{items.map((item) => <tr key={item.requirement_id} className="border-t border-border align-top"><td className="p-3"><div className="font-medium text-text">{item.project_name}</div><div className="text-muted">{item.company_name || "Client company"}</div></td><td className="p-3">{item.skill}</td><td className="p-3">{item.open_positions} of {item.required_count}</td><td className="p-3 text-text-secondary">{item.submitted_count} submitted · {item.shortlisted_count} shortlisted<br />{item.accepted_count} accepted · {item.rejected_count} rejected · {item.withdrawn_count} withdrawn</td><td className="p-3">{item.oldest_open_submitted_at ? <><div className={item.sla_breached ? "font-medium text-danger" : "text-text"}>{item.sla_breached ? "SLA breached" : "Within SLA"}</div><div className="text-muted">Due {new Date(item.due_at).toLocaleString()} ({item.candidate_response_sla_hours}h policy)</div></> : <span className="text-muted">No review waiting</span>}</td></tr>)}</tbody></table></div>}
      <p className="text-xs text-muted">{audience === "vendor" ? "Only requirements on your currently connected projects are shown." : "Only your client-company projects are shown."} Due time is calculated from the submission timestamp and that project’s configured response policy.</p>
    </>}
  </div>;
}

function Metric({ label, value, alert }) { return <div className={`rounded-lg p-4 ring-1 ${alert ? "bg-red-50 text-danger ring-red-200" : "bg-surface text-text ring-border"}`}><div className="text-sm">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>; }
