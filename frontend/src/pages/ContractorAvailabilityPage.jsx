import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import AlertBanner from "../components/AlertBanner";
import PrimaryButton from "../components/PrimaryButton";
import Spinner from "../components/Spinner";
import { formatDate } from "../components/projects/format";
import availabilityService from "../services/contractorAvailabilityService";
import "./ContractorAvailabilityPage.css";

export default function ContractorAvailabilityPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [appliedFilter, setAppliedFilter] = useState(null);

  const load = async (range = null) => {
    setLoading(true);
    setError(null);
    try {
      setItems(await availabilityService.list(range));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const created = await availabilityService.create({ start_date: startDate, end_date: endDate, reason: reason || undefined });
      setItems((current) => {
        if (appliedFilter && (created.start_date > appliedFilter.toDate || created.end_date < appliedFilter.fromDate)) return current;
        return [...current, created].sort((a, b) => a.start_date.localeCompare(b.start_date));
      });
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id) => {
    setError(null);
    try {
      await availabilityService.cancel(id);
      setItems((current) => current.map((item) => item.id === id ? { ...item, status: "CANCELLED" } : item));
    } catch (err) {
      setError(err.message);
    }
  };

  const applyFilter = async (event) => {
    event.preventDefault();
    const range = { fromDate: filterFromDate, toDate: filterToDate };
    setAppliedFilter(range);
    await load(range);
  };

  const clearFilter = async () => {
    setFilterFromDate("");
    setFilterToDate("");
    setAppliedFilter(null);
    await load();
  };

  return (
    <DashboardLayout title="My Availability">
      <div className="contractor-availability-page">
        <AlertBanner message={error} />
        <section className="contractor-availability-panel" aria-labelledby="availability-create-title">
          <header className="contractor-availability-section-header">
            <h1 id="availability-create-title">My Availability</h1>
            <p>Add periods when you are not available for work.</p>
          </header>
          <form onSubmit={submit} className="contractor-availability-form">
            <label><span>Start date</span><input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <label><span>End date</span><input required type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
            <label className="contractor-availability-reason"><span>Reason <b aria-hidden="true">*</b></span><input required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Holiday, Training, Personal" /></label>
            <PrimaryButton isLoading={saving} loadingText="Saving…" className="contractor-availability-submit">Add unavailable period</PrimaryButton>
          </form>
        </section>

        <section className="contractor-availability-panel" aria-labelledby="availability-list-title">
          <header className="contractor-availability-list-header">
            <h2 id="availability-list-title">Upcoming unavailable periods</h2>
            <p>These dates will be considered when assigning you to future work.</p>
          </header>
          <form className="contractor-availability-filter" onSubmit={applyFilter} aria-label="Filter unavailable periods by date">
            <label><span>From date</span><input required type="date" value={filterFromDate} onChange={(event) => setFilterFromDate(event.target.value)} /></label>
            <label><span>To date</span><input required type="date" min={filterFromDate || undefined} value={filterToDate} onChange={(event) => setFilterToDate(event.target.value)} /></label>
            <div className="contractor-availability-filter-actions">
              <button type="submit" className="contractor-availability-filter-apply" disabled={loading}>Apply filter</button>
              <button type="button" className="contractor-availability-filter-clear" onClick={clearFilter} disabled={loading || !appliedFilter}>Clear</button>
            </div>
          </form>
          {loading ? (
            <div className="contractor-availability-loading"><Spinner label="Loading availability…" /></div>
          ) : items.length === 0 ? (
            <p className="contractor-availability-empty">{appliedFilter ? "No unavailable periods found for the selected dates." : "No unavailable periods recorded."}</p>
          ) : (
            <div className={`contractor-availability-periods ${items.length > 3 ? "is-scrollable" : ""}`}>
              {items.map((item) => (
                <article key={item.id} className="contractor-availability-period">
                  <span className="contractor-availability-calendar" aria-hidden="true"><CalendarIcon /></span>
                  <div className="contractor-availability-period-copy">
                    <p aria-label={`${formatDate(item.start_date)} to ${formatDate(item.end_date)}`}>{formatDate(item.start_date)} – {formatDate(item.end_date)}</p>
                    <span>{item.reason || "No reason provided"}</span>
                  </div>
                  <div className="contractor-availability-actions">
                    <AvailabilityStatus status={item.status} />
                    {item.status === "ACTIVE" && <button type="button" onClick={() => cancel(item.id)} className="contractor-availability-cancel">Cancel</button>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

function AvailabilityStatus({ status }) {
  const isActive = status === "ACTIVE";
  return <span className={`contractor-availability-status ${isActive ? "is-active" : "is-neutral"}`}><i aria-hidden="true" />{status}</span>;
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
}
