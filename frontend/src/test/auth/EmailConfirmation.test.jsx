import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

beforeEach(() => vi.resetAllMocks());

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
    expect(await screen.findByRole("status")).toHaveTextContent(/check your inbox for a new verification code/i);
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
