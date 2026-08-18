import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/Spinner";

/**
 * Reusable route guard.
 *   - Not authenticated -> redirect to /login (remembers where they were headed)
 *   - Authenticated but role not allowed -> redirect to /unauthorized
 *   - Otherwise -> render the nested route
 *
 * Usage:
 *   <Route element={<ProtectedRoute allowedRoles={["VENDOR"]} />}>
 *     <Route path="/vendor" element={<VendorHomePage />} />
 *   </Route>
 */
export default function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <Spinner label="Checking your session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
