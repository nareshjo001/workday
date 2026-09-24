import { useEffect, useRef } from "react";
import { getInitials } from "../contractors/format";

export default function VendorClientDetailDialog({ client, onClose }) {
  const closeButtonRef = useRef(null);
  const title = client.company?.name || client.name || "Client Details";
  const contacts = normalizeContacts(client.pm_contacts);
  const projects = client.active_projects || client.recent_projects || [];

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const dialog = closeButtonRef.current?.closest('[role="dialog"]');
      const focusable = dialog?.querySelectorAll("button:not([disabled])");
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-[2px] sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendor-client-detail-title"
        aria-describedby="vendor-client-detail-description"
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-[20px] border border-slate-200/90 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)] sm:max-h-[calc(100dvh-2rem)]"
        data-testid="client-detail-dialog"
      >
        <header className="flex shrink-0 items-start gap-3 px-5 pb-4 pt-5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-base font-bold text-blue-700 sm:h-[52px] sm:w-[52px] sm:text-lg"
            data-testid="client-detail-avatar"
            aria-hidden="true"
          >
            {getInitials(title)}
          </div>
          <div className="min-w-0 flex-1 self-center">
            <h2 id="vendor-client-detail-title" className="break-words text-[19px] font-bold leading-tight tracking-[-0.02em] text-slate-950 sm:text-[21px]">
              {title}
            </h2>
            <p id="vendor-client-detail-description" className="mt-0.5 text-xs leading-5 text-slate-500 sm:text-[13px]">
              Client details and active projects
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            data-testid="close-client-detail-icon"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto px-5 pb-4" data-testid="client-detail-content">
          <section className="rounded-[14px] border border-blue-100/90 bg-gradient-to-br from-blue-50/80 to-slate-50 px-3.5 py-3" aria-labelledby="vendor-client-pm-title">
            <div className="flex items-start gap-3">
              <IconSurface sizeClassName="h-10 w-10" className="bg-blue-100/70 text-blue-700">
                <UserIcon />
              </IconSurface>
              <div className="min-w-0 flex-1">
                <h3 id="vendor-client-pm-title" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  PM Contacts
                </h3>
                <div className="mt-1.5 space-y-2.5" data-testid="detail-pm-contacts">
                  {contacts.length === 0 ? (
                    <p className="text-[13px] text-slate-500">No PM contact available.</p>
                  ) : contacts.map((contact, index) => (
                    <div key={contact.id || `${contact.name}-${index}`} className="min-w-0">
                      <p className="break-words text-sm font-semibold leading-[18px] text-slate-900">{contact.name || "—"}</p>
                      {contact.email && <p className="break-all text-xs leading-[18px] text-slate-500 sm:text-[13px]">{contact.email}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-5" aria-labelledby="vendor-client-projects-title">
            <div className="flex items-start gap-2.5">
              <IconSurface sizeClassName="h-9 w-9" className="bg-slate-100 text-slate-600">
                <DocumentIcon />
              </IconSurface>
              <div className="min-w-0 pt-0.5">
                <h3 id="vendor-client-projects-title" className="text-base font-semibold leading-5 text-slate-950">
                  Active projects
                </h3>
                <p className="mt-0.5 text-xs leading-[18px] text-slate-500">
                  Projects currently associated with this client.
                </p>
              </div>
            </div>

            {projects.length === 0 ? (
              <p className="mt-3.5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                No active projects are currently available.
              </p>
            ) : (
              <ul className="mt-2.5 flex flex-col gap-2" data-testid="client-detail-projects">
                {projects.map((project) => (
                  <li
                    key={project.id || project.name}
                    className="flex items-start gap-3 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5"
                    data-testid={`client-detail-project-${project.id || project.name}`}
                  >
                    <IconSurface sizeClassName="h-9 w-9" className="bg-blue-50 text-blue-600">
                      <FolderIcon />
                    </IconSurface>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="break-words text-sm font-semibold leading-[18px] text-slate-900 sm:text-[15px]">{project.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px] leading-[18px] text-slate-500 sm:text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          <RequirementIcon />
                          {formatCount(project.open_requirements, "open requirement", "open requirements")}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <UsersIcon />
                          {formatCount(project.deployed_contractors, "deployed contractor", "deployed contractors")}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="flex shrink-0 justify-end border-t border-slate-200/80 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-[38px] items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            data-testid="close-detail-button"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}

function normalizeContacts(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [{ id: "legacy-contact", name: String(value), email: "" }];
}

function formatCount(value, singular, plural) {
  const count = Number(value ?? 0);
  return `${count} ${count === 1 ? singular : plural}`;
}

function IconSurface({ sizeClassName, className, children }) {
  return <span className={`flex shrink-0 items-center justify-center rounded-full ${sizeClassName} ${className}`} aria-hidden="true">{children}</span>;
}

function CloseIcon() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

function UserIcon() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></svg>;
}

function DocumentIcon() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>;
}

function FolderIcon() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" /></svg>;
}

function RequirementIcon() {
  return <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3h10v18H7zM10 8h4M10 12h4M10 16h3" /></svg>;
}

function UsersIcon() {
  return <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 4 4.9" /></svg>;
}
