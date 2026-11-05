import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import Account from "../pages/Account";
import ProtectedRoute from "../components/ProtectedRoute";
import { ProfileSettings, SecuritySettings, PreferenceSettings, PrivacySettings, SettingsMenu } from "../components/Account/SettingsSections";
import { getCurrentUser, logoutAccount } from "../api/auth";

vi.mock("../api/auth", () => ({ getCurrentUser: vi.fn(), logoutAccount: vi.fn() }));

function renderAccount(path = "/account/profile") {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/" element={<h1>Public landing page</h1>} />
    <Route path="/login" element={<h1>Login page</h1>} />
    <Route element={<Layout />}>
      <Route path="/dashboard" element={<h1>Dashboard page</h1>} />
      <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>}>
        <Route index element={<Navigate to="profile" replace />} />
        <Route path="profile" element={<ProfileSettings />} />
        <Route path="security" element={<SecuritySettings />} />
        <Route path="preferences" element={<PreferenceSettings />} />
        <Route path="privacy" element={<PrivacySettings />} />
        <Route path="menu" element={<SettingsMenu />} />
      </Route>
    </Route>
  </Routes></MemoryRouter>);
}

describe("Account settings workspace", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_ENABLE_ROUTE_PROTECTION", "true");
    getCurrentUser.mockResolvedValue({ user: { id: "one", email: "student@example.com", user_metadata: { name: "Study User" } } });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it("uses one dedicated settings sidebar and displays authenticated profile information", async () => {
    renderAccount();
    expect(screen.getByRole("complementary", { name: "Settings navigation" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Application navigation" })).not.toBeInTheDocument();
    expect(await screen.findByText("Study User", { selector: "h3" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Personal information" })).toBeInTheDocument();
  });
  it("defaults /account to Profile and switches categories", async () => {
    renderAccount("/account");
    expect(await screen.findByRole("heading", { name: "Profile" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Security" }));
    expect(screen.getByRole("heading", { name: "Sign-in details" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Preferences" }));
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Data & Privacy" }));
    expect(screen.getByRole("heading", { name: "Account lifecycle" })).toBeInTheDocument();
  });
  it("returns to dashboard with the main app sidebar restored", async () => {
    renderAccount();
    await userEvent.click(screen.getByRole("link", { name: /Back to dashboard/ }));
    expect(screen.getByRole("heading", { name: "Dashboard page" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Application navigation" })).toBeInTheDocument();
  });
  it("blocks settings for unauthenticated visitors", async () => {
    getCurrentUser.mockResolvedValue({ user: null });
    renderAccount();
    expect(await screen.findByRole("heading", { name: "Login page" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Profile" })).not.toBeInTheDocument();
  });
  it("logs out from settings and returns to the public landing page", async () => {
    logoutAccount.mockResolvedValue({});
    renderAccount();
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(logoutAccount).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: "Public landing page" })).toBeInTheDocument();
  });
  it("shows logout errors without navigating away", async () => {
    logoutAccount.mockRejectedValue(new Error("Unable to end your session"));
    renderAccount();
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to end your session");
    expect(screen.getByRole("complementary", { name: "Settings navigation" })).toBeInTheDocument();
  });
  it("provides a mobile category menu", async () => {
    renderAccount("/account/menu");
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    const menu = screen.getByRole("region", { name: "Settings categories" });
    expect(within(menu).getByRole("link", { name: /Profile/ })).toBeInTheDocument();
    await userEvent.click(within(menu).getByRole("link", { name: /Security/ }));
    expect(await screen.findByRole("heading", { name: "Sign-in details" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /All settings/ }));
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });
});
