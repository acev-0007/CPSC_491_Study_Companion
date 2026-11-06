import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EmailConfirmation from "../../pages/EmailConfirmation";
import { resendConfirmationEmail, verifyEmail } from "../../api/auth";

vi.mock("../../api/auth", () => ({
  resendConfirmationEmail: vi.fn(),
  verifyEmail: vi.fn(),
}));

function renderConfirmation(email = "student@example.com", confirmationSentAt = Date.now()) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/auth/confirm", state: { email, confirmationSentAt } }]}>
      <Routes>
        <Route path="/auth/confirm" element={<EmailConfirmation />} />
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  window.sessionStorage.clear();
});

describe("Email confirmation resend", () => {
  it("renders a secondary resend control for a registration email", () => {
    renderConfirmation();
    expect(screen.getByRole("button", { name: "Resend available in 60s" })).toBeDisabled();
    expect(resendConfirmationEmail).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify Email" })).toBeDisabled();
  });

  it("submits only once, then shows success and cooldown", async () => {
    let resolveRequest;
    resendConfirmationEmail.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    // Pretend the initial email was sent more than a minute ago.
    renderConfirmation("student@example.com", Date.now() - 61_000);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Resend confirmation email" }));
    expect(resendConfirmationEmail).toHaveBeenCalledWith({ email: "student@example.com" });
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
    resolveRequest({ message: "ok" });
    expect(await screen.findByRole("status")).toHaveTextContent(/please check your inbox shortly/i);
    expect(screen.getByRole("button", { name: /resend available in/i })).toBeDisabled();
    expect(resendConfirmationEmail).toHaveBeenCalledTimes(1);
  });

  it("shows a retryable generic error on a network failure", async () => {
    resendConfirmationEmail.mockRejectedValueOnce(new Error("network failure"));
    renderConfirmation("student@example.com", Date.now() - 61_000);
    await userEvent.click(screen.getByRole("button", { name: "Resend confirmation email" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/couldn't request a new code/i);
    expect(screen.getByRole("button", { name: "Resend confirmation email" })).toBeEnabled();
  });

  it("disables resend after rate limiting", async () => {
    resendConfirmationEmail.mockRejectedValueOnce(Object.assign(new Error("limited"), { status: 429 }));
    renderConfirmation("student@example.com", Date.now() - 61_000);
    await userEvent.click(screen.getByRole("button", { name: "Resend confirmation email" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/please wait/i);
    expect(screen.getByRole("button", { name: /resend available/i })).toBeDisabled();
  });

  it("enables the button once the full 60-second cooldown expires", () => {
    vi.useFakeTimers();
    try {
      const now = Date.now();
      renderConfirmation("student@example.com", now);
      expect(screen.getByRole("button", { name: "Resend available in 60s" })).toBeDisabled();
      act(() => { vi.advanceTimersByTime(59_000); });
      expect(screen.getByRole("button", { name: "Resend available in 1s" })).toBeDisabled();
      act(() => { vi.advanceTimersByTime(1_000); });
      expect(screen.getByRole("button", { name: "Resend confirmation email" })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves remaining cooldown across a refresh without route timestamp", () => {
    vi.useFakeTimers();
    try {
      const now = Date.now();
      const view = renderConfirmation("student@example.com", now);
      act(() => { vi.advanceTimersByTime(25_000); });
      expect(screen.getByRole("button", { name: "Resend available in 35s" })).toBeDisabled();
      view.unmount();
      // A refresh may lose location.state; keep the saved expiration instead.
      render(
        <MemoryRouter initialEntries={[{ pathname: "/auth/confirm", state: { email: "student@example.com" } }]}>
          <Routes><Route path="/auth/confirm" element={<EmailConfirmation />} /></Routes>
        </MemoryRouter>,
      );
      expect(screen.getByRole("button", { name: "Resend available in 35s" })).toBeDisabled();
      act(() => { vi.advanceTimersByTime(35_000); });
      expect(screen.getByRole("button", { name: "Resend confirmation email" })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("requires a registration email before showing resend", () => {
    renderConfirmation("");
    expect(screen.queryByRole("button", { name: "Resend confirmation email" })).not.toBeInTheDocument();
  });

  it("preserves existing verification behavior", async () => {
    verifyEmail.mockResolvedValueOnce({ authenticated: true });
    renderConfirmation();
    await userEvent.type(screen.getByLabelText("Verification code"), "12345678");
    await userEvent.click(screen.getByRole("button", { name: "Verify Email" }));
    expect(verifyEmail).toHaveBeenCalledWith({ email: "student@example.com", code: "12345678" });
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });
});
