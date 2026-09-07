import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import { ROLES } from "./constants/roles";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import HomeRedirect from "./pages/HomeRedirect";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import NotFoundPage from "./pages/NotFoundPage";
import VendorHomePage from "./pages/VendorHomePage";
import VendorContractorsPage from "./pages/VendorContractorsPage";
import VendorAssignmentsPage from "./pages/VendorAssignmentsPage";
import ContractorHomePage from "./pages/ContractorHomePage";
import ContractorProjectsPage from "./pages/ContractorProjectsPage";
import ContractorProfilePage from "./pages/ContractorProfilePage";
import ContractorTimesheetsPage from "./pages/ContractorTimesheetsPage";
import PmHomePage from "./pages/PmHomePage";
import PMProjectsPage from "./pages/PMProjectsPage";
import PmTimesheetsPage from "./pages/PmTimesheetsPage";
import PmMilestonesPage from "./pages/PmMilestonesPage";
import PmInvoicesPage from "./pages/PmInvoicesPage";
import VendorInvoicesPage from "./pages/VendorInvoicesPage";
import VendorCompliancePage from "./pages/VendorCompliancePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import PasswordActionPage from "./pages/PasswordActionPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<PasswordActionPage mode="reset" />} />
        <Route path="/setup-password" element={<PasswordActionPage mode="setup" />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route element={<ProtectedRoute allowedRoles={[ROLES.VENDOR]} />}>
          <Route path="/vendor" element={<VendorHomePage />} />
          <Route path="/vendor/contractors" element={<VendorContractorsPage />} />
          <Route path="/vendor/assignments" element={<VendorAssignmentsPage />} />
          <Route path="/vendor/invoices" element={<VendorInvoicesPage />} />
          <Route path="/vendor/compliance" element={<VendorCompliancePage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[ROLES.CONTRACTOR]} />}>
          <Route path="/contractor" element={<ContractorHomePage />} />
          <Route path="/contractor/projects" element={<ContractorProjectsPage />} />
          <Route path="/contractor/profile" element={<ContractorProfilePage />} />
          <Route path="/contractor/timesheets" element={<ContractorTimesheetsPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[ROLES.PM]} />}>
          <Route path="/pm" element={<PmHomePage />} />
          <Route path="/pm/projects" element={<PMProjectsPage />} />
          <Route path="/pm/timesheets" element={<PmTimesheetsPage />} />
          <Route path="/pm/milestones" element={<PmMilestonesPage />} />
          <Route path="/pm/invoices" element={<PmInvoicesPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
