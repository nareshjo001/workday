import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import authService from "../services/authService";
import { getToken, setToken, clearToken } from "../utils/tokenStorage";

const AuthContext = createContext(undefined);

// Centralize session state so components do not manage tokens independently.
export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  // Wait for session restoration before deciding whether protected content can render.
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const resolveSession = useCallback(async () => {
    try {
      if (!getToken()) {
        const refreshed = await authService.refresh();
        setToken(refreshed.token);
        setUser(refreshed.user);
        return;
      }
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch {
      // Token missing/invalid/expired — treat as logged out.
      clearToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    resolveSession();
  }, [resolveSession]);

  const login = useCallback(async ({ email, password }) => {
    setError(null);
    const { token, user: loggedInUser } = await authService.login({ email, password });
    setToken(token);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const signup = useCallback(async ({ name, email, password, role, companyName }) => {
    setError(null);
    const { user: newUser } = await authService.signup({ name, email, password, role, companyName });
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    // Clear local authentication and navigate explicitly so the outgoing route is not replayed after login.
    try { await authService.logout(); } catch { /* local cleanup still protects the UI */ }
    clearToken();
    setUser(null);
    setError(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const logoutAll = useCallback(async () => {
    try { await authService.logoutAll(); } finally { clearToken(); setUser(null); navigate("/login", { replace: true }); }
  }, [navigate]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      error,
      login,
      signup,
      logout,
      logoutAll,
    }),
    [user, isLoading, error, login, signup, logout, logoutAll]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
