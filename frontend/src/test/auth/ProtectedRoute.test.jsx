import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../../components/ProtectedRoute";
import { getCurrentUser } from "../../api/auth";

vi.mock("../../api/auth", () => ({ getCurrentUser: vi.fn() }));

function renderProtectedRoute(redirectTo) {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<ProtectedRoute redirectTo={redirectTo}><h1>Protected dashboard</h1></ProtectedRoute>} />
        <Route path="/login" element={<h1>Login page</h1>} />
        <Route path="/session-expired" element={<h1>Session expired</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_ENABLE_ROUTE_PROTECTION", "true");
    vi.resetAllMocks();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("does not reveal protected content while session verification is pending", () => {
    getCurrentUser.mockReturnValue(new Promise(() => {}));
    renderProtectedRoute();
    expect(screen.queryByText("Protected dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });

  it("renders protected content when the backend returns a user", async () => {
    getCurrentUser.mockResolvedValue({ user: { id: "test-user" } });
    renderProtectedRoute();
    expect(await screen.findByRole("heading", { name: "Protected dashboard" })).toBeInTheDocument();
  });

  it("redirects to login when the backend returns no user", async () => {
    getCurrentUser.mockResolvedValue({ user: null });
    renderProtectedRoute();
    expect(await screen.findByRole("heading", { name: "Login page" })).toBeInTheDocument();
    expect(screen.queryByText("Protected dashboard")).not.toBeInTheDocument();
  });

  it("redirects on a 401 response", async () => {
    getCurrentUser.mockRejectedValue({ status: 401 });
    renderProtectedRoute();
    expect(await screen.findByRole("heading", { name: "Login page" })).toBeInTheDocument();
  });

  it("respects a custom redirect destination", async () => {
    getCurrentUser.mockResolvedValue({ user: null });
    renderProtectedRoute("/session-expired");
    expect(await screen.findByRole("heading", { name: "Session expired" })).toBeInTheDocument();
  });

  it("offers retry on a network failure instead of logging the user out", async () => {
    getCurrentUser.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ user: { id: "test-user" } });
    renderProtectedRoute();
    expect(await screen.findByRole("heading", { name: "Unable to verify your session" })).toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await waitFor(() => expect(getCurrentUser).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("heading", { name: "Protected dashboard" })).toBeInTheDocument();
  });

  it("preserves the existing explicit development bypass", () => {
    vi.stubEnv("VITE_ENABLE_ROUTE_PROTECTION", "false");
    renderProtectedRoute();
    expect(screen.getByRole("heading", { name: "Protected dashboard" })).toBeInTheDocument();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });
});
