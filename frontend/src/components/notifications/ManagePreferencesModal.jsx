import React, { useEffect, useId, useState } from "react";
import apiClient from "../../services/apiClient";
import { CloseIcon } from "../../utils/notificationTheme";

function formatPreferenceLabel(eventType) {
  return String(eventType || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const PREFERENCE_GROUPS = [
  {
    id: "staffing",
    title: "Staffing",
    matcher: (type) => type.startsWith("CANDIDATE_"),
  },
  {
    id: "assignments",
    title: "Assignments",
    matcher: (type) => type.startsWith("ASSIGNMENT_"),
  },
  {
    id: "timesheets",
    title: "Timesheets",
    matcher: (type) => type.startsWith("TIMESHEET_"),
  },
  {
    id: "invoices_payments",
    title: "Invoices & payments",
    matcher: (type) =>
      type.startsWith("INVOICE_") ||
      type.startsWith("PAYMENT_") ||
      type.startsWith("BILLING_") ||
      type.startsWith("MILESTONE_"),
  },
  {
    id: "compliance",
    title: "Compliance",
    matcher: (type) => type.includes("DOCUMENT"),
  },
];


export default function ManagePreferencesModal({
  isOpen,
  onClose,
  preferences = [],
  role = "vendor",
  onSaved,
}) {
  const [draftPrefs, setDraftPrefs] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const titleId = useId();
  const descId = useId();

  // Reset the preference draft when the dialog opens or server preferences change.
  useEffect(() => {
    if (isOpen) {
      setSaveError(null);
      const initial = {};
      for (const p of preferences) {
        initial[p.event_type] = Boolean(p.in_app_enabled);
      }
      setDraftPrefs(initial);
    }
  }, [isOpen, preferences]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggle = (eventType) => {
    setDraftPrefs((prev) => ({
      ...prev,
      [eventType]: !prev[eventType],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      // Persist only preferences that differ from the initial values.
      const initialMap = new Map(preferences.map((p) => [p.event_type, Boolean(p.in_app_enabled)]));
      const changes = [];

      for (const [eventType, enabled] of Object.entries(draftPrefs)) {
        if (initialMap.get(eventType) !== enabled) {
          changes.push(
            apiClient.put(`/${role}/notification-preferences/${eventType}`, {
              in_app_enabled: enabled,
            })
          );
        }
      }

      if (changes.length > 0) {
        await Promise.all(changes);
      }

      if (onSaved) {
        await onSaved();
      }
      onClose();
    } catch (err) {
      setSaveError(err?.message || "Failed to save preferences. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const categorized = [];
  const assigned = new Set();

  for (const group of PREFERENCE_GROUPS) {
    const matched = preferences.filter((p) => group.matcher(p.event_type));
    if (matched.length > 0) {
      categorized.push({
        id: group.id,
        title: group.title,
        items: matched,
      });
      matched.forEach((p) => assigned.add(p.event_type));
    }
  }

  const remaining = preferences.filter((p) => !assigned.has(p.event_type));
  if (remaining.length > 0) {
    categorized.push({
      id: "other",
      title: "Other notifications",
      items: remaining,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs transition-opacity"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-[calc(100%-32px)] sm:w-full sm:max-w-[520px] max-h-[70vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <header className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-4 pb-3.5 border-b border-slate-100 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[19px] sm:text-[20px] font-semibold text-slate-900 tracking-tight leading-snug">
              Manage notification preferences
            </h2>
            <p id={descId} className="mt-0.5 text-xs sm:text-[13px] text-slate-500">
              Choose which in-app notifications you want to receive.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        {saveError && (
          <div role="alert" className="mx-5 sm:mx-6 mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-medium shrink-0">
            {saveError}
          </div>
        )}

        <div className="flex-1 overflow-y-auto max-h-[300px] sm:max-h-[320px] px-5 sm:px-6 py-2 divide-y divide-slate-100">
          {categorized.map((group) => (
            <div key={group.id} className="py-2 first:pt-1 last:pb-1.5">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 pt-1">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.items.map((p) => {
                  const isChecked = draftPrefs[p.event_type] ?? true;
                  return (
                    <label
                      key={p.event_type}
                      className="flex min-h-[38px] sm:min-h-[40px] items-center justify-between gap-4 py-1 px-1.5 -mx-1.5 rounded-md text-[13px] sm:text-[13.5px] font-medium text-slate-700 cursor-pointer hover:bg-slate-50 transition select-none"
                    >
                      <span className="text-slate-800">{formatPreferenceLabel(p.event_type)}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggle(p.event_type)}
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600 text-blue-600 focus:ring-blue-500/20 cursor-pointer shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {preferences.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-500">No preference settings available.</p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2.5 px-5 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 text-xs sm:text-sm font-medium text-white shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}
