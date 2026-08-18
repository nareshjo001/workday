import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import authService from "../services/authService";
import { getToken, setToken, clearToken } from "../utils/tokenStorage";

const AuthContext = createContext(undefined);

/**
 * Centralizes all authentication state and actions. Any component that
 * needs to know "am I logged in / who am I / what's my role" reads from
 * this context instead of touching the token or API directly.
 */
export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  // True while we resolve the session on first load (token -> /auth/me).
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const resolveSession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
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

  const logout = useCallback(() => {
    // Clear token -> clear user -> reset auth state -> navigate to login,
    // all synchronously, so no protected route ever re-renders in between
    // with a mismatched (token, user) pair. Navigating here — rather than
    // letting ProtectedRoute's "not authenticated" branch redirect us —
    // also avoids stamping the outgoing route's path onto `location.state
    // .from`, which would otherwise get replayed as the redirect target
    // after the *next* login regardless of the newly authenticated user's
    // role.
    clearToken();
    setUser(null);
    setError(null);
    navigate("/login", { replace: true });
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
    }),
    [user, isLoading, error, login, signup, logout]
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
