import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_HOME_PATH } from "../constants/roles";
import Spinner from "../components/Spinner";

export default function HomeRedirect() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <Spinner />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Navigate to={ROLE_HOME_PATH[user.role] || "/login"} replace />;
}
