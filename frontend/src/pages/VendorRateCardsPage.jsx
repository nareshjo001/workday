import { useCallback, useEffect, useMemo, useState } from "react";
import AlertBanner from "../components/AlertBanner";
import PrimaryButton from "../components/PrimaryButton";
import Spinner from "../components/Spinner";
import DashboardLayout from "../layouts/DashboardLayout";
import service from "../services/vendorRateCardService";
import { getSkillTheme } from "../utils/skillTheme";

const blank = { skill_id: "", bill_rate: "", cost_rate: "", currency: "USD", effective_from: "", effective_to: "" };
const inputClassName = "mt-1.5 block h-[46px] w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const formatDate = (value) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "Ongoing";
const formatMoney = (value, currency) => new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(value));

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "—";
}

function currencySymbol(currency) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).formatToParts(0).find((part) => part.type === "currency")?.value || currency;
  } catch {
    return currency;
  }
}

function Icon({ children, className = "h-5 w-5" }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

function BuildingIcon() { return <Icon><path d="M4 21h16M6 21V5l6-2 6 2v16M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" /></Icon>; }
function UserIcon() { return <Icon><circle cx="12" cy="8" r="3.5" /><path d="M5.5 21a6.5 6.5 0 0 1 13 0" /></Icon>; }
function ProjectsIcon() { return <Icon><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></Icon>; }
function TagIcon() { return <Icon className="h-6 w-6"><path d="M20.6 13.6 11 23l-9-9V3h11l7.6 7.6a2.1 2.1 0 0 1 0 3Z" /><circle cx="7.5" cy="8.5" r="1.5" /></Icon>; }
function SearchIcon() { return <Icon><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon>; }
function PlusIcon() { return <Icon className="h-[18px] w-[18px]"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></Icon>; }
function ChevronDownIcon() { return <Icon className="h-4 w-4"><path d="m8 10 4 4 4-4" /></Icon>; }

function SectionHeading({ icon, title, description, id }) {
  return <div className="flex items-center gap-3.5">
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600" aria-hidden="true">{icon}</span>
    <div className="min-w-0">
      <h2 id={id} className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-0.5 text-sm text-slate-500">{description}</p>
    </div>
  </div>;
}

function SkillBadge({ skill }) {
  const theme = getSkillTheme(skill);
  return <span data-testid="rate-card-skill-badge" className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs font-medium leading-none" style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}>
    <i className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: theme.dot }} aria-hidden="true" />{skill}
  </span>;
}

function StatusBadge({ status }) {
  const active = status === "ACTIVE";
  return <span className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs font-medium leading-none ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
    <i className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-emerald-600" : "bg-slate-400"}`} aria-hidden="true" />{status}
  </span>;
}

function RateInput({ label, value, currency, onChange, ...props }) {
  return <label className="text-sm font-medium text-text-secondary">{label}
    <span className="mt-1.5 flex h-[46px] overflow-hidden rounded-lg border border-border-strong bg-surface transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
      <span className="flex w-14 shrink-0 items-center justify-center border-r border-border bg-surface-muted text-sm font-semibold text-slate-600" aria-hidden="true">{currencySymbol(currency)}</span>
      <input aria-label={label} type="number" value={value} onChange={onChange} className="min-w-0 flex-1 bg-transparent px-3 text-sm text-text outline-none" {...props} />
    </span>
  </label>;
}

export default function VendorRateCardsPage() {
  const [clients, setClients] = useState([]);
  const [skills, setSkills] = useState([]);
  const [clientId, setClientId] = useState("");
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const client = clients.find((item) => String(item.id) === clientId);
  const shown = useMemo(() => items.filter((item) => item.skill?.toLowerCase().includes(search.toLowerCase())), [items, search]);

  const load = useCallback(async (id) => {
    if (!id) { setItems([]); return; }
    setBusy(true);
    try { setItems(await service.list(id)); setError(null); }
    catch (loadError) { setError(loadError.message || "Could not load rate cards."); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    service.setup().then((data) => { setClients(data.clients); setSkills(data.skills); })
      .catch((setupError) => setError(setupError.message || "Could not load rate-card setup."))
      .finally(() => setLoading(false));
  }, []);

  const change = (key, event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await service.create({ ...form, client_company_id: Number(clientId), skill_id: Number(form.skill_id), bill_rate: Number(form.bill_rate), cost_rate: Number(form.cost_rate), effective_to: form.effective_to || null });
      setForm(blank);
      await load(clientId);
    } catch (saveError) {
      setError(saveError.message || "Could not save the rate card.");
    } finally {
      setBusy(false);
    }
  }

  return <DashboardLayout title="Rate cards"><main className="mx-auto flex w-full max-w-6xl flex-col gap-4">
    <header><h1 className="text-[22px] font-semibold text-text">Rate cards</h1><p className="mt-0.5 text-sm text-muted">Set client-specific bill and cost rates for future assignments. Existing assignment rates are preserved.</p></header>
    <AlertBanner message={error} />

    <section className="rounded-2xl border border-border bg-surface p-4 shadow-panel sm:p-5">
      <h2 id="client-rate-card-heading" className="text-lg font-semibold text-slate-900">Client</h2><p className="mt-0.5 text-sm text-slate-500">Select the client for this rate card.</p>
      <label className="relative mt-3 block" htmlFor="rate-card-client">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-slate-500" aria-hidden="true"><BuildingIcon /></span>
        <select id="rate-card-client" aria-label="Client" disabled={loading} value={clientId} onChange={(event) => { setClientId(event.target.value); load(event.target.value); }} className="block h-[46px] w-full rounded-lg border border-border-strong bg-surface pl-12 pr-10 text-sm text-text transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Select a connected client</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      {client && <div data-testid="selected-client-summary" className="mt-4 grid overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/90 to-slate-50 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.55fr)_minmax(230px,.75fr)_minmax(170px,.45fr)]">
        <div className="flex min-w-0 items-center gap-3.5 p-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-base font-semibold text-blue-700" aria-hidden="true">{initials(client.name)}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{client.name}</p><p className="mt-0.5 text-xs text-slate-500">Connected client</p></div></div>
        <div className="flex items-center gap-3 border-t border-blue-100 p-4 sm:border-l sm:border-t-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm" aria-hidden="true"><UserIcon /></span><div className="min-w-0"><p className="text-xs text-slate-500">PM contact</p><p className="mt-0.5 truncate text-sm font-medium text-slate-900" title={client.pm_contacts || "—"}>{client.pm_contacts || "—"}</p></div></div>
        <div className="flex items-center gap-3 border-t border-blue-100 p-4 sm:col-span-2 lg:col-span-1 lg:border-l lg:border-t-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm" aria-hidden="true"><ProjectsIcon /></span><div><p className="text-xs text-slate-500">Active projects</p><p className="mt-0.5 text-sm font-medium text-slate-900">{client.active_projects ?? 0}</p></div></div>
      </div>}
    </section>

    {clientId && <>
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-panel sm:p-5" aria-labelledby="add-rate-card-heading">
        <SectionHeading id="add-rate-card-heading" icon={<TagIcon />} title="Add future rate card" description="Create a rate card for a new skill or update rates. Existing assignment rates are preserved." />
        <form onSubmit={submit} className="mt-5 grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-text-secondary">Skill<select aria-label="Skill" required value={form.skill_id} onChange={(event) => change("skill_id", event)} className={inputClassName}><option value="">Select skill</option>{skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.code}</option>)}</select></label>
          <RateInput label="Bill rate" value={form.bill_rate} currency={form.currency} onChange={(event) => change("bill_rate", event)} required min="0.01" step="0.01" />
          <RateInput label="Cost rate (optional)" value={form.cost_rate} currency={form.currency} onChange={(event) => change("cost_rate", event)} required min="0.01" step="0.01" />
          <label className="text-sm font-medium text-text-secondary">Currency<span className="relative block"><input aria-label="Currency" list="rate-card-currencies" required maxLength="3" value={form.currency} onChange={(event) => change("currency", event)} className={`${inputClassName} pr-10 uppercase`} /><span className="pointer-events-none absolute inset-y-0 right-3 mt-1.5 flex items-center text-slate-600" aria-hidden="true"><ChevronDownIcon /></span></span><datalist id="rate-card-currencies"><option value="USD" /><option value="INR" /><option value="EUR" /><option value="GBP" /></datalist></label>
          <label className="text-sm font-medium text-text-secondary">Effective from<input aria-label="Effective from" type="date" required value={form.effective_from} onChange={(event) => change("effective_from", event)} className={inputClassName} /></label>
          <label className="text-sm font-medium text-text-secondary">Effective to (optional)<input aria-label="Effective to (optional)" type="date" value={form.effective_to} onChange={(event) => change("effective_to", event)} className={inputClassName} /></label>
          <div className="flex flex-wrap gap-3 sm:col-span-2"><PrimaryButton isLoading={busy} loadingText="Adding…" fullWidth={false} className="min-w-44 rounded-lg text-sm"><PlusIcon /> Add rate card</PrimaryButton><button type="button" onClick={() => setForm(blank)} className="h-[46px] min-w-40 rounded-lg border border-border-strong bg-white px-6 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">Clear</button></div>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-panel sm:p-5" aria-labelledby="existing-rate-cards-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><SectionHeading id="existing-rate-cards-heading" icon={<ProjectsIcon />} title="Existing rate cards" description="Current and future rate cards for the selected client." /><label className="relative block w-full sm:w-72 lg:w-80"><span className="sr-only">Search skills</span><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500" aria-hidden="true"><SearchIcon /></span><input aria-label="Search skills" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search skills..." className="h-[46px] w-full rounded-lg border border-border-strong bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" /></label></div>
        {busy ? <div className="py-8"><Spinner label="Loading rate cards…" /></div> : <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[850px] table-fixed text-left"><colgroup><col className="w-[16%]" /><col className="w-[14%]" /><col className="w-[14%]" /><col className="w-[11%]" /><col className="w-[16%]" /><col className="w-[16%]" /><col className="w-[13%]" /></colgroup><thead className="bg-slate-50/90 text-[11px] font-semibold text-slate-600"><tr>{["Skill", "Bill rate", "Cost rate", "Currency", "Effective from", "Effective to", "Status"].map((heading) => <th key={heading} className="px-3.5 py-2.5">{heading}</th>)}</tr></thead><tbody>{shown.map((item) => <tr key={item.id} className="border-t border-slate-200 text-xs text-slate-700"><td className="px-3.5 py-2.5"><SkillBadge skill={item.skill} /></td><td className="px-3.5 py-2.5 font-medium text-slate-900">{formatMoney(item.bill_rate, item.currency)}</td><td className="px-3.5 py-2.5 font-medium text-slate-900">{formatMoney(item.cost_rate, item.currency)}</td><td className="px-3.5 py-2.5">{item.currency}</td><td className="px-3.5 py-2.5 text-slate-600">{formatDate(item.effective_from)}</td><td className="px-3.5 py-2.5 text-slate-600">{formatDate(item.effective_to)}</td><td className="px-3.5 py-2.5"><StatusBadge status={item.status} /></td></tr>)}</tbody></table>{!shown.length && <p className="border-t border-slate-200 p-8 text-center text-sm text-muted">{items.length ? "No rate cards match your search." : "No rate cards configured for this client."}</p>}</div>}
      </section>
    </>}
  </main></DashboardLayout>;
}
