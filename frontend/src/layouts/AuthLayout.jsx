/**
 * Shared shell for Login/Signup.
 *
 * Desktop (md+): two-column composition — a brand panel on the left
 * establishing product identity, and the auth card on the right.
 * Mobile: the brand panel collapses to a compact wordmark above the
 * card, so nothing forces the desktop layout onto small screens.
 */
export default function AuthLayout({ title, description, children, footer, variant = "default" }) {
  const isPremiumAuth = variant === "login" || variant === "signup";
  const isSignup = variant === "signup";

  if (isPremiumAuth) {
    return (
      <main className={isSignup ? "login-shell signup-shell" : "login-shell"}>
        <section className={isSignup ? "login-hero signup-hero" : "login-hero"} aria-labelledby="login-hero-title">
          <div className="login-hero__top">
            <div className="login-brand" aria-label="VMS">
              <span className="login-brand__mark" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>VMS</span>
            </div>
            <div className="login-badge">
              <span aria-hidden="true" />
              Enterprise Workforce Platform
            </div>
          </div>

          <div className="login-hero__content">
            <h2 id="login-hero-title" className="login-hero__title">
              Contingent Workforce
              <em>Management</em>
            </h2>
            <p className="login-hero__description">
              Manage contractors, timesheets, milestones, and billing — all in one unified
              platform designed for modern enterprises.
            </p>

            <ul className="login-features" aria-label="Platform capabilities">
              <li><CheckIcon />Contractor onboarding &amp; lifecycle management</li>
              <li><ChartIcon />Real-time timesheets &amp; milestone tracking</li>
              <li><CardIcon />Automated billing &amp; invoice reconciliation</li>
            </ul>
          </div>

          <div className="login-hero__bottom">
            <dl className="login-stats">
              <div><dt>12,400+</dt><dd>Active Contractors</dd></div>
              <div><dt>98.6%</dt><dd>Uptime SLA</dd></div>
              <div><dt>340+</dt><dd>Enterprise Clients</dd></div>
            </dl>
            <footer className="login-hero__footer">
              <span>© 2026 Vendor Management System</span>
              <nav aria-label="Legal"><a href="#privacy">Privacy</a><a href="#terms">Terms</a></nav>
            </footer>
          </div>
        </section>

        <section className={isSignup ? "login-auth signup-auth" : "login-auth"} aria-labelledby="login-page-title">
          <div className={isSignup ? "login-card signup-card" : "login-card"}>
            {(title || description) && (
              <header className="login-card__header">
                {title && <h1 id="login-page-title">{title}</h1>}
                {description && <p>{description}</p>}
              </header>
            )}
            {children}
          </div>
          {footer}
        </section>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <div className="hidden flex-col justify-between gap-16 bg-primary px-10 py-12 text-primary-foreground md:flex md:w-1/2 lg:px-16 lg:py-16">
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

        <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-card ring-1 ring-border sm:p-8">
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

function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg>;
}

function ChartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19v-6h4v6M10 19V8h4v11M15 19V4h4v15M4 20h16" /></svg>;
}

function CardIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="M4 10h16M8 14h3" /></svg>;
}
