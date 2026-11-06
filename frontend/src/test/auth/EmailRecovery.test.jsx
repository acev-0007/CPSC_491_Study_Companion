import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "../../pages/Login";
import EmailConfirmation from "../../pages/EmailConfirmation";
import { loginAccount, verifyEmail, resendVerificationEmail } from "../../api/auth";

vi.mock("../../api/auth", () => ({
  loginAccount: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerificationEmail: vi.fn(),
}));

beforeEach(() => {
  loginAccount.mockReset();
  verifyEmail.mockReset();
  resendVerificationEmail.mockReset();
});

function renderJourney() {
  render(<MemoryRouter initialEntries={["/login"]}><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/auth/confirm" element={<EmailConfirmation />} />
    <Route path="/dashboard" element={<div>Protected dashboard</div>} />
  </Routes></MemoryRouter>);
}

function login() {
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "student@example.com" } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "Password123!" } });
  fireEvent.click(screen.getByRole("button", { name: /^log in$/i }));
}

describe("AC-07 verification recovery UI", () => {
  it("resumes the original verification screen without entering the dashboard", async () => {
    loginAccount.mockRejectedValueOnce(Object.assign(new Error("Verify email"), { code: "verification_required", status: 403 }));
    renderJourney();
    login();
    expect(await screen.findByRole("heading", { name: "Verify your email" })).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
    expect(screen.queryByText("Protected dashboard")).not.toBeInTheDocument();
    // Returning from a failed login does not mean a code was just sent.
    // The recovered screen should allow a resend unless a prior cooldown exists.
    expect(screen.getByRole("button", { name: /resend confirmation email/i })).toBeEnabled();
  });

  it("does not disclose verification state on incorrect password", async () => {
    loginAccount.mockRejectedValueOnce(Object.assign(new Error("Invalid email or password."), { status: 401 }));
    renderJourney();
    login();
    expect(await screen.findByRole("alert")).toHaveTextContent(/incorrect email or password/i);
    expect(screen.queryByRole("heading", { name: "Verify your email" })).not.toBeInTheDocument();
  });

  it("still signs in verified users normally", async () => {
    loginAccount.mockResolvedValueOnce({ user: { id: "user-123" } });
    renderJourney();
    login();
    await waitFor(() => expect(screen.getByText("Protected dashboard")).toBeInTheDocument());
  });
});
