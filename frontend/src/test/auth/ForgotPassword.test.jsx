import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ForgotPassword from "../../pages/ForgotPassword";
import { requestPasswordRecovery } from "../../api/auth";

vi.mock("../../api/auth", () => ({ requestPasswordRecovery: vi.fn() }));
const confirmation = "If an account exists for that email address, we've sent password reset instructions.";
const renderPage = () => render(<MemoryRouter><ForgotPassword /></MemoryRouter>);

beforeEach(() => { requestPasswordRecovery.mockReset(); });

describe("ForgotPassword recovery request", () => {
  it("submits a normalized email and shows neutral confirmation", async () => {
    requestPasswordRecovery.mockResolvedValue({ message: confirmation });
    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: " Student@Example.com " } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() => expect(requestPasswordRecovery).toHaveBeenCalledWith({ email: "student@example.com" }));
    expect(await screen.findByRole("status")).toHaveTextContent(confirmation);
  });

  it("blocks invalid email without a network request", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "invalid" } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/valid email/i);
    expect(requestPasswordRecovery).not.toHaveBeenCalled();
  });

  it("disables submission while pending and prevents duplicate requests", async () => {
    let finish;
    requestPasswordRecovery.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "student@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
    expect(requestPasswordRecovery).toHaveBeenCalledTimes(1);
    finish({ message: confirmation });
    await screen.findByRole("status");
  });

  it("shows rate limits and allows another attempt", async () => {
    requestPasswordRecovery.mockRejectedValueOnce(Object.assign(new Error("limit"), { status: 429 }));
    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "student@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/too many recovery requests/i);
    expect(screen.getByRole("button", { name: /reset password/i })).toBeEnabled();
  });

  it("shows a generic error for service failures", async () => {
    requestPasswordRecovery.mockRejectedValueOnce(new Error("Sensitive provider message"));
    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "student@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to request password recovery/i);
    expect(screen.queryByText(/sensitive provider message/i)).not.toBeInTheDocument();
  });
});
