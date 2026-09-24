import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import apiClient from "../services/apiClient";
import ManagePreferencesModal from "../components/notifications/ManagePreferencesModal";
import {
  BellIcon,
  SettingsIcon,
  formatNotificationTimestamp,
  getNotificationTheme,
  getOutcomeStatus,
  getNotificationContent,
  resolveNotificationDestination,
} from "../utils/notificationTheme";

export default function NotificationsPage({ role }) {
  const navigate = useNavigate();
  const manageButtonRef = useRef(null);
  const [data, setData] = useState({
    items: [],
    unread_count: 0,
    pagination: { page: 1, limit: 10, total: 0, total_pages: 1 },
  });
  const [page, setPage] = useState(1);
  const [preferences, setPreferences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (targetPage = 1) => {
    try {
      setError(null);
      const [inbox, prefs] = await Promise.all([
        apiClient.get(`/${role}/notifications`, { params: { page: targetPage, limit: 10 } }),
        apiClient.get(`/${role}/notification-preferences`),
      ]);
      setData(inbox.data);
      setPreferences(prefs.data.items || []);
      if (inbox.data.pagination?.page) {
        setPage(inbox.data.pagination.page);
      }
    } catch (e) {
      setError(e.message || "Failed to load notifications.");
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    load(page);
  }, [load, page]);

  const open = async (notification) => {
    const destination = resolveNotificationDestination(notification, role);

    // Optimistically mark as read in local state
    setData((prev) => {
      const isCurrentlyUnread = !notification.read_at;
      return {
        ...prev,
        unread_count: isCurrentlyUnread ? Math.max(0, prev.unread_count - 1) : prev.unread_count,
        items: prev.items.map((item) =>
          item.id === notification.id
            ? { ...item, read_at: item.read_at || new Date().toISOString() }
            : item
        ),
      };
    });

    // Attempt backend mark-read in background without blocking navigation
    try {
      await apiClient.patch(`/${role}/notifications/${notification.id}/read`);
    } catch (err) {
      console.warn("Failed to mark notification as read on server:", err?.message);
    }

    // Follow primary deep link or deterministic fallback (omit redundant navigation if staying on notifications)
    if (destination && destination !== `/${role}/notifications`) {
      navigate(destination);
    }
  };

  const totalCount = data.pagination?.total ?? data.items.length;
  const totalPages = data.pagination?.total_pages ?? Math.max(1, Math.ceil(totalCount / 10));

  const handleMarkAllRead = async () => {
    try {
      await apiClient.patch(`/${role}/notifications/read-all`);
      setData((prev) => ({
        ...prev,
        unread_count: 0,
        items: prev.items.map((item) => ({
          ...item,
          read_at: item.read_at || new Date().toISOString(),
        })),
      }));
      load(page);
    } catch {
      setError("Failed to mark all notifications read.");
    }
  };

  const handleOpenPreferences = () => {
    setIsPreferencesOpen(true);
  };

  const handleClosePreferences = () => {
    setIsPreferencesOpen(false);
    manageButtonRef.current?.focus();
  };

  return (
    <DashboardLayout title="Notifications">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        {/* Header with single entry point for Manage preferences beside Mark all read */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Notifications
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              {totalCount === 0
                ? "Stay up to date with your activity and workflow alerts."
                : `${totalCount} total · ${data.unread_count} unread`}
            </p>
          </div>

          {/* Action area: [ Manage preferences ]   Mark all read */}
          <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
            <button
              ref={manageButtonRef}
              type="button"
              onClick={handleOpenPreferences}
              aria-haspopup="dialog"
              aria-expanded={isPreferencesOpen}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3.5 text-xs sm:text-sm font-medium text-blue-600 shadow-2xs hover:bg-blue-50/50 hover:border-blue-300 active:bg-blue-100/50 transition cursor-pointer"
            >
              <SettingsIcon className="h-4 w-4 text-blue-600" />
              <span>Manage preferences</span>
            </button>

            {data.unread_count > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex h-10 items-center px-2 py-1.5 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline active:text-blue-800 transition cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>
        </header>


        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs sm:text-sm text-red-700 font-medium"
          >
            {error}
          </div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xs">
            <div
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-primary animate-pulse mb-3"
              aria-hidden="true"
            >
              <BellIcon className="h-5 w-5" />
            </div>
            <p role="status" className="text-sm font-semibold text-slate-700">
              Loading notifications…
            </p>
          </div>
        ) : data.items.length === 0 ? (
          /* Empty state */
          <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 text-center shadow-2xs">
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-3"
              aria-hidden="true"
            >
              <BellIcon className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">No notifications yet</h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
              Updates about invoices, staffing, compliance, and other workflow events will appear
              here.
            </p>
          </div>
        ) : (
          /* Notification feed */
          <ul role="list" className="space-y-2.5" data-testid="notification-feed">
            {data.items.map((n) => {
              const theme = getNotificationTheme(n);
              const isUnread = !n.read_at;
              const { date, time } = formatNotificationTimestamp(n.created_at);
              const outcome = getOutcomeStatus(n);
              const content = getNotificationContent(n);

              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={`group flex w-full flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 rounded-xl border p-3.5 sm:p-4 text-left transition shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      isUnread
                        ? "border-blue-200/90 bg-blue-50/35 hover:bg-blue-50/65 hover:border-blue-300"
                        : "border-slate-200/80 bg-white hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-3 sm:gap-3.5 min-w-0 flex-1">
                      {/* Category Icon Badge */}
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-2xs"
                        style={{
                          backgroundColor: theme.bg,
                          color: theme.text,
                          borderColor: theme.border,
                        }}
                        aria-hidden="true"
                      >
                        <theme.Icon className="h-5 w-5" />
                      </div>

                      {/* Content: Compact 3-line card */}
                      <div className="min-w-0 flex-1">
                        {/* Line 1: Headline Title */}
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm tracking-tight ${
                              isUnread ? "font-semibold text-slate-900" : "font-medium text-slate-700"
                            }`}
                          >
                            {content.title}
                          </p>
                          {isUnread && (
                            <span
                              className="inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
                              aria-label="Unread"
                              title="Unread"
                            />
                          )}
                        </div>

                        {/* Line 2: Context line (Contractor · Document Type, or Invoice # · Project) */}
                        {content.contextLine && (
                          <p className="mt-0.5 text-xs font-semibold text-slate-700 truncate">
                            {content.contextLine}
                          </p>
                        )}

                        {/* Line 3: Category badge, outcome badge, and detail/expiry line */}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span className="font-medium text-slate-600">{theme.label}</span>
                          {outcome && (
                            <>
                              <span className="text-slate-300" aria-hidden="true">
                                ·
                              </span>
                              <span
                                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold border ${outcome.colorClass}`}
                              >
                                {outcome.label}
                              </span>
                            </>
                          )}
                          {content.detailLine && (
                            <>
                              <span className="text-slate-300" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-medium text-slate-600">
                                {content.detailLine}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 2-line right-aligned timestamp */}
                    <div className="shrink-0 text-left sm:text-right pl-13 sm:pl-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <time
                        className="block text-xs font-bold text-slate-900 whitespace-nowrap"
                        dateTime={n.created_at}
                      >
                        {date}
                      </time>
                      <span className="block text-[11px] font-medium text-slate-500 whitespace-nowrap">
                        {time}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav
            aria-label="Notifications pagination"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2"
          >
            <span className="text-xs sm:text-sm font-medium text-slate-500">
              {data.items.length} result{data.items.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs sm:text-sm font-medium text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              >
                Next
              </button>
            </div>
          </nav>
        )}

        {/* Preferences modal dialog */}
        <ManagePreferencesModal
          isOpen={isPreferencesOpen}
          onClose={handleClosePreferences}
          preferences={preferences}
          role={role}
          onSaved={() => load(page)}
        />
      </div>
    </DashboardLayout>
  );
}
