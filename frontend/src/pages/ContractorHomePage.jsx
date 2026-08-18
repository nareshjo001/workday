import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";

export default function ContractorHomePage() {
  return (
    <DashboardLayout title="Contractor area">
      <div className="flex flex-col gap-4">
        <p className="text-muted">
          Contractor dashboard placeholder — timesheets arrive in a later module.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/contractor/projects"
            className="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-panel transition-colors hover:bg-primary-hover"
          >
            View My Projects
          </Link>
          <Link
            to="/contractor/profile"
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
          >
            My Profile
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
