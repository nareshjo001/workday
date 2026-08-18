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
import ContractorHomePage from "./pages/ContractorHomePage";
import PmHomePage from "./pages/PmHomePage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route element={<ProtectedRoute allowedRoles={[ROLES.VENDOR]} />}>
          <Route path="/vendor" element={<VendorHomePage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[ROLES.CONTRACTOR]} />}>
          <Route path="/contractor" element={<ContractorHomePage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[ROLES.PM]} />}>
          <Route path="/pm" element={<PmHomePage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
