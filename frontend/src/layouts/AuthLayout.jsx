/**
 * Shared shell for Login/Signup.
 *
 * Desktop (md+): two-column composition — a brand panel on the left
 * establishing product identity, and the auth card on the right.
 * Mobile: the brand panel collapses to a compact wordmark above the
 * card, so nothing forces the desktop layout onto small screens.
 */
export default function AuthLayout({ title, description, children }) {
  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <div className="hidden flex-col justify-between bg-primary px-10 py-12 text-primary-foreground md:flex md:w-1/2 lg:w-3/5 lg:px-16 lg:py-16">
        <span className="text-lg font-semibold tracking-tight">VMS</span>

        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">
            Contingent Workforce Management
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Manage contractors, timesheets, milestones and billing in one place.
          </p>
        </div>

        <p className="text-sm text-white/60">Vendor Management System</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-10 sm:px-6 md:w-1/2 lg:w-2/5">
        <div className="mb-6 text-center md:hidden">
          <p className="text-xl font-semibold tracking-tight text-text">VMS</p>
          <p className="mt-1 text-sm text-muted">Contingent Workforce &amp; Timesheet Management</p>
        </div>

        <div className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-card ring-1 ring-border sm:p-8">
          {(title || description) && (
            <div className="mb-6">
              {title && (
                <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
              )}
              {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
