import { useAuth } from "../context/AuthContext";
import { Link, NavLink } from "react-router-dom";

const navigation = {
  VENDOR: [["", "Overview"], ["contractors", "Contractors"], ["assignments", "Projects & assignments"], ["clients", "Clients"], ["staffing-pipeline", "Staffing pipeline"], ["compliance", "Compliance"], ["rate-cards", "Rate cards"], ["invoices", "Invoices & payments"], ["notifications", "Notifications"]],
  PM: [["", "Overview"], ["projects", "Projects"], ["vendor-access", "Vendor access"], ["staffing-pipeline", "Staffing & candidates"], ["timesheets", "Timesheet reviews"], ["milestones", "Milestones"], ["invoices", "Invoice reviews"], ["notifications", "Notifications"]],
  CONTRACTOR: [["", "Overview"], ["profile", "My profile"], ["projects", "My projects"], ["timesheets", "Timesheets"], ["availability", "Availability"], ["notifications", "Notifications"]],
};

/**
 * Presentation-only shell. ProtectedRoute and the API remain authoritative.
 */
export default function DashboardLayout({ title, children }) {
  const { user, logout, logoutAll } = useAuth();
  const role = user?.role;
  const links = (navigation[role] || []).map(([path, label]) => (
    <NavLink key={path} end to={`/${role.toLowerCase()}${path ? `/${path}` : ""}`} className={({ isActive }) => `workspace-nav-link${isActive ? " is-active" : ""}`}>
      <span className="nav-marker" aria-hidden="true" />{label}
    </NavLink>
  ));

  return (
    <div className="workspace">
      <a className="skip-link" href="#workspace-content">Skip to content</a>
      <aside className="workspace-sidebar">
        <div className="workspace-brand"><span className="brand-mark" aria-hidden="true">W</span><div><strong>Workforce</strong><span>Vendor Management System</span></div></div>
        <p className="nav-caption">{role === "PM" ? "Client workspace" : role === "CONTRACTOR" ? "My workspace" : "Vendor workspace"}</p>
        <nav aria-label="Workspace navigation">{links}</nav>
        <div className="sidebar-footer">People. Projects. Progress.</div>
      </aside>
      <div className="workspace-body">
      <header className="workspace-header">
        <div className="header-context"><span className="text-xs font-medium text-muted">Workspace</span><p className="text-sm font-semibold text-text">{title}</p></div>
        <div className="header-actions">
          {role && <Link to={`/${role.toLowerCase()}/notifications`} className="notification-link" aria-label="Notifications"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg><span>Notifications</span></Link>}
          <details className="account-menu"><summary aria-label="Account menu"><span className="account-avatar" aria-hidden="true">{user?.name?.slice(0, 1) || "U"}</span><span className="account-name">{user?.name}<small>{role}</small></span><span aria-hidden="true">⌄</span></summary><div className="account-popover"><p>{user?.name}<span>{role}</span></p>
          <button
            onClick={logout}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
          >
            Logout
          </button>
          <button
            onClick={logoutAll}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
          >
            Logout all sessions
          </button>
          </div></details>
        </div>
      </header>
      <details className="mobile-navigation"><summary>Browse workspace <span aria-hidden="true">⌄</span></summary><nav aria-label="Mobile workspace navigation">{links}</nav></details>
      <main id="workspace-content" tabIndex={-1} className="workspace-content">{children}</main>
      </div>
    </div>
  );
}
