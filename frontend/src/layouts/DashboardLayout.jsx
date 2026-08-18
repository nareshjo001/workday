import { useAuth } from "../context/AuthContext";

/**
 * Minimal placeholder shell for the three role areas, using the same
 * design tokens as Authentication. Later modules will replace the
 * content region with real dashboards; this only exists so Module 1 can
 * demonstrate working, role-protected routing with a consistent look.
 */
export default function DashboardLayout({ title, children }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen w-full bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div>
          <p className="text-sm font-semibold tracking-tight text-text">VMS</p>
          <p className="text-xs text-muted">{title}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-text">{user?.name}</p>
            <p className="text-xs text-muted">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
