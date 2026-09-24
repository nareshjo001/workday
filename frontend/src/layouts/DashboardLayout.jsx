import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, NavLink } from "react-router-dom";

const navigation = {
  VENDOR: [["", "Overview"], ["contractors", "Contractors"], ["assignments", "Projects & assignments"], ["clients", "Clients"], ["staffing-pipeline", "Staffing pipeline"], ["compliance", "Compliance"], ["rate-cards", "Rate cards"], ["invoices", "Invoices & payments"], ["activity", "Activity"], ["notifications", "Notifications"]],
  PM: [["", "Overview"], ["projects", "Projects"], ["vendor-access", "Vendor access"], ["staffing-pipeline", "Staffing & candidates"], ["timesheets", "Timesheet reviews"], ["milestones", "Milestones"], ["invoices", "Invoice reviews"], ["activity", "Activity"], ["notifications", "Notifications"]],
  CONTRACTOR: [["", "Overview"], ["profile", "My profile"], ["projects", "My projects"], ["timesheets", "Timesheets"], ["availability", "Availability"], ["activity", "Activity"], ["notifications", "Notifications"]],
};

/**
 * Presentation-only shell. ProtectedRoute and the API remain authoritative.
 */
export default function DashboardLayout({ title, children }) {
  const { user, logout, logoutAll } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem("vms_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("vms_sidebar_collapsed", String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuRef.current?.querySelector("summary")?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const role = user?.role;
  const links = (navigation[role] || []).map(([path, label]) => (
    <NavLink
      key={path}
      end
      to={`/${role.toLowerCase()}${path ? `/${path}` : ""}`}
      className={({ isActive }) => `workspace-nav-link${isActive ? " is-active" : ""}`}
      aria-label={label}
      data-tooltip={label}
      title={isCollapsed ? label : undefined}
    >
      <span className="vendor-nav-indicator" aria-hidden="true" />
      <VendorNavIcon path={path} />
      <span className="nav-label">{label}</span>
    </NavLink>
  ));

  const captionText =
    role === "PM" ? "Client workspace" : role === "CONTRACTOR" ? "My workspace" : "Vendor workspace";
  const subtitleText =
    role === "PM" ? "Client Management System" : role === "CONTRACTOR" ? "Contractor Portal" : "Vendor Management System";

  return (
    <div className={`workspace${role === "VENDOR" ? " workspace--vendor" : role === "PM" ? " workspace--pm" : role === "CONTRACTOR" ? " workspace--contractor" : ""}${isCollapsed ? " has-collapsed-sidebar" : ""}`}>
      <a className="skip-link" href="#workspace-content">Skip to content</a>
      <aside className={`workspace-sidebar${isCollapsed ? " is-collapsed" : ""}`}>
        <div className="workspace-brand">
          <div className="brand-identity">
            <span className="brand-mark" aria-hidden="true">W</span>
            <div className="brand-text">
              <strong>Workforce</strong>
              <span>{subtitleText}</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCollapsed}
            data-tooltip={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <PanelExpandIcon /> : <PanelCollapseIcon />}
          </button>
        </div>
        <p className="nav-caption">{captionText}</p>
        <nav aria-label="Workspace navigation">{links}</nav>
      </aside>
      <div className="workspace-body">
      <header className="workspace-header">
        <div className="header-context"><span className="text-xs font-medium text-muted">Workspace</span><p className="text-sm font-semibold text-text">{title}</p></div>
        <div className="header-actions">
          {role && <Link to={`/${role.toLowerCase()}/notifications`} className="notification-link" aria-label="Notifications"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg><span>Notifications</span></Link>}
          <details
            ref={menuRef}
            className={`account-menu${menuOpen ? " is-open" : ""}`}
            open={menuOpen}
          >
            <summary
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.preventDefault();
                setMenuOpen((prev) => !prev);
              }}
            >
              <span className="account-avatar" aria-hidden="true">
                {user?.name?.slice(0, 1).toUpperCase() || "U"}
              </span>
              <span className="account-name">
                {user?.name}
                <small>{role}</small>
              </span>
              <span className="account-trigger-chevron" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </summary>
            <div className="account-popover" role="menu" aria-label="Account menu options">
              <span className="account-popover-caret" aria-hidden="true" />
              <div className="account-popover-identity">
                <div className="account-popover-avatar" aria-hidden="true">
                  {user?.name?.slice(0, 1).toUpperCase() || "U"}
                </div>
                <div className="account-popover-user">
                  <p className="account-popover-name">{user?.name}</p>
                  <p className="account-popover-role">{role}</p>
                </div>
              </div>
              <div className="account-popover-divider" role="separator" />
              <div className="account-popover-actions">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="account-popover-btn account-popover-btn--primary"
                >
                  <span className="account-btn-left">
                    <span className="account-btn-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                    </span>
                    <span className="account-btn-label">Logout</span>
                  </span>
                  <span className="account-btn-chevron" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logoutAll();
                  }}
                  className="account-popover-btn account-popover-btn--secondary"
                >
                  <span className="account-btn-left">
                    <span className="account-btn-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </span>
                    <span className="account-btn-label">Logout all sessions</span>
                  </span>
                  <span className="account-btn-chevron" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          </details>
        </div>
      </header>
      <details className="mobile-navigation">
        <summary>
          Browse workspace
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </summary>
        <nav aria-label="Mobile workspace navigation">{links}</nav>
      </details>
      <main id="workspace-content" tabIndex={-1} className="workspace-content">{children}</main>
      </div>
    </div>
  );
}

function VendorNavIcon({ path }) {
  const paths = {
    "": <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10M9.5 20v-6h5v6" /></>,
    contractors: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.25" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 15.5a4.5 4.5 0 0 1 6.5 4" /></>,
    assignments: <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5V3h6v2M9 10h6M9 14h6" /></>,
    projects: <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5V3h6v2M9 10h6M9 14h6" /></>,
    clients: <><path d="M5 21V5h10v16M15 9h4v12M8 9h1m2 0h1m-4 4h1m2 0h1m-4 4h1m2 0h1" /></>,
    "staffing-pipeline": <><path d="m4 17 5-5 4 3 7-8" /><path d="M15 7h5v5" /></>,
    compliance: <><path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    "rate-cards": <><path d="M3 10V5a2 2 0 0 1 2-2h5l11 11-7 7L3 10Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
    invoices: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6m-6 4h6m-6 4h4" /></>,
    activity: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    "vendor-access": <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></>,
    timesheets: <><circle cx="12" cy="12" r="9" /><polyline points="12 6 12 12 15 15" /></>,
    milestones: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></>,
    profile: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    availability: <><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="m9 16 2 2 4-4" /></>,
  };

  return (
    <svg
      className="vendor-nav-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[path] || <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}


function PanelCollapseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 15-3-3 3-3" />
    </svg>
  );
}

function PanelExpandIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
    </svg>
  );
}
