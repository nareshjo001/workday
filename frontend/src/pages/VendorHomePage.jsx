import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";

export default function VendorHomePage() {
  return (
    <DashboardLayout title="Vendor area">
      <div className="flex flex-col gap-4">
        <p className="text-muted">Manage the contractors working under your account.</p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/vendor/contractors"
            className="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-panel transition-colors hover:bg-primary-hover"
          >
            Manage Contractors
          </Link>
          <Link
            to="/vendor/assignments"
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
          >
            Assign to Project
          </Link>
          <Link
            to="/vendor/invoices"
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted"
          >
            Invoices
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
