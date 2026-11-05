import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ResetPassword from "../../pages/ResetPassword";
import { validatePasswordRecovery, completePasswordReset } from "../../api/auth";

vi.mock("../../api/auth", () => ({ validatePasswordRecovery: vi.fn(), completePasswordReset: vi.fn() }));
const link = "http://localhost:5173/reset-password#access_token=example-access&refresh_token=example-refresh&type=recovery";
function LoginDestination() {
  const location = useLocation();
  return <div data-testid="login-destination">{location.state?.passwordResetComplete ? "Password updated successfully" : "No confirmation"}</div>;
}
const renderPage = () => render(<MemoryRouter initialEntries={["/reset-password"]}><Routes><Route path="/reset-password" element={<ResetPassword />} /><Route path="/login" element={<LoginDestination />} /></Routes></MemoryRouter>);

beforeEach(() => {
  window.history.replaceState({}, "", "/reset-password");
  validatePasswordRecovery.mockReset().mockResolvedValue({ valid: true });
  completePasswordReset.mockReset().mockResolvedValue({ message: "Password updated successfully." });
});

describe("SCRUM-292 ResetPassword page", () => {
  it("handles missing tokens with a new-link option", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: /recovery link unavailable/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /request a new link/i })).toHaveAttribute("href", "/forgot-password");
    expect(validatePasswordRecovery).not.toHaveBeenCalled();
  });

  it("removes callback tokens from the address bar and validates them", async () => {
    window.history.replaceState({}, "", link);
    renderPage();
    await screen.findByRole("heading", { name: /create a new password/i });
    expect(validatePasswordRecovery).toHaveBeenCalledWith({ accessToken: "example-access", refreshToken: "example-refresh" });
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("");
  });

  it("displays an invalid/expired link response", async () => {
    window.history.replaceState({}, "", "/reset-password#error=access_denied&error_code=otp_expired");
    renderPage();
    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(validatePasswordRecovery).not.toHaveBeenCalled();
  });

  it("validates password length and matching before requesting an update", async () => {
    window.history.replaceState({}, "", link);
    renderPage();
    await screen.findByRole("button", { name: /update password/i });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/between 8 and 128/i);
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "newPassword123!" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/do not match/i);
    expect(completePasswordReset).not.toHaveBeenCalled();
  });

  it("returns to login with a success confirmation after password update", async () => {
    window.history.replaceState({}, "", link);
    renderPage();
    await screen.findByRole("button", { name: /update password/i });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "newPassword123!" } });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), { target: { value: "newPassword123!" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => expect(completePasswordReset).toHaveBeenCalledWith({ accessToken: "example-access", refreshToken: "example-refresh", password: "newPassword123!" }));
    expect(await screen.findByTestId("login-destination")).toHaveTextContent(/password updated successfully/i);
    expect(screen.queryByRole("heading", { name: /recovery link unavailable/i })).not.toBeInTheDocument();
  });

  it("keeps the form open when Supabase rejects the current password", async () => {
    window.history.replaceState({}, "", link);
    completePasswordReset.mockRejectedValueOnce(
      Object.assign(new Error("Choose a password different from your current password."), { status: 422, code: "same_password" })
    );
    renderPage();
    await screen.findByRole("button", { name: /update password/i });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "currentPassword123!" } });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), { target: { value: "currentPassword123!" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/different from your current password/i);
    expect(screen.getByRole("button", { name: /update password/i })).toBeEnabled();
    expect(screen.queryByRole("heading", { name: /recovery link unavailable/i })).not.toBeInTheDocument();
  });

  it("surfaces provider errors without exposing provider messages", async () => {
    window.history.replaceState({}, "", link);
    completePasswordReset.mockRejectedValueOnce(new Error("secret internal details"));
    renderPage();
    await screen.findByRole("button", { name: /update password/i });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "newPassword123!" } });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), { target: { value: "newPassword123!" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't update your password/i);
    expect(screen.queryByText(/secret internal details/i)).not.toBeInTheDocument();
  });
});
