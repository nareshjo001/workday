import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import ProtectedRoute from "./ProtectedRoute";

const useAuth = vi.fn();
vi.mock("../context/AuthContext", () => ({ useAuth: () => useAuth() }));

function renderRoute(auth) {
  useAuth.mockReturnValue(auth);
  render(
    <MemoryRouter initialEntries={["/vendor"]}>
      <Routes>
        <Route element={<ProtectedRoute allowedRoles={["VENDOR"]} />}>
          <Route path="/vendor" element={<p>Vendor home</p>} />
        </Route>
        <Route path="/login" element={<p>Login</p>} />
        <Route path="/unauthorized" element={<p>Unauthorized</p>} />
      </Routes>
    </MemoryRouter>
  );
}

test("redirects an anonymous visitor to login", () => {
  renderRoute({ isLoading: false, isAuthenticated: false, user: null });
  expect(screen.getByText("Login")).toBeInTheDocument();
});

test("redirects a wrong-role user to unauthorized", () => {
  renderRoute({ isLoading: false, isAuthenticated: true, user: { role: "PM" } });
  expect(screen.getByText("Unauthorized")).toBeInTheDocument();
});

test("renders the protected route for the allowed role", () => {
  renderRoute({ isLoading: false, isAuthenticated: true, user: { role: "VENDOR" } });
  expect(screen.getByText("Vendor home")).toBeInTheDocument();
});
