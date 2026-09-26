import { useEffect } from "react";

export default function Modal({ title, subtitle, icon, headerActions, onClose, children, panelClassName = "", headerClassName = "", lockDocumentScroll = false }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (lockDocumentScroll) document.body.style.overflow = "hidden";
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (lockDocumentScroll) document.body.style.overflow = previousOverflow;
    };
  }, [lockDocumentScroll, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`ui-modal-panel min-w-0 w-full max-w-xl rounded-lg bg-surface p-5 shadow-card ring-1 ring-border sm:p-6 ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`mb-5 flex items-start justify-between gap-4 border-b border-border pb-4 ${headerClassName}`}>
          {icon || subtitle ? (
            <div className="flex min-w-0 items-start gap-3">
              {icon}
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-text">{title}</h2>
                {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
              </div>
            </div>
          ) : (
            <h2 className="text-lg font-semibold text-text">{title}</h2>
          )}
          <div className="ui-modal-header-actions flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-md p-2 text-muted transition hover:bg-surface-muted hover:text-text-secondary"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
