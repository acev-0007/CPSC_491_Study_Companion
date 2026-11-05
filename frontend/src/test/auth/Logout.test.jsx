import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Sidebar from "../../components/Sidebar/Sidebar";
import { logoutAccount } from "../../api/auth";

vi.mock("../../api/auth", () => ({ logoutAccount: vi.fn() }));

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<Sidebar />} />
        <Route path="/" element={<h1>Landing page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function desktopLogoutButton() {
  return within(
    screen.getByRole("complementary", { name: "Application navigation" }),
  ).getByRole("button", { name: /log out/i });
}

describe("Sidebar logout", () => {
  beforeEach(() => vi.resetAllMocks());

  it("logs out and navigates to the public landing page", async () => {
    logoutAccount.mockResolvedValue(undefined);
    renderSidebar();

    await userEvent.click(desktopLogoutButton());

    expect(logoutAccount).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("heading", { name: "Landing page" }),
    ).toBeInTheDocument();
  });

  it("disables logout while the request is pending", async () => {
    let resolveLogout;
    logoutAccount.mockImplementation(
      () => new Promise((resolve) => { resolveLogout = resolve; }),
    );
    renderSidebar();

    const logoutButton = desktopLogoutButton();
    await userEvent.click(logoutButton);

    expect(logoutButton).toBeDisabled();
    expect(logoutButton).toHaveTextContent("Logging out...");
    expect(logoutAccount).toHaveBeenCalledTimes(1);

    resolveLogout();
    expect(
      await screen.findByRole("heading", { name: "Landing page" }),
    ).toBeInTheDocument();
  });

  it("shows an error and remains on the current page when logout fails", async () => {
    logoutAccount.mockRejectedValue(new Error("Logout unavailable"));
    renderSidebar();

    await userEvent.click(desktopLogoutButton());

    expect(await screen.findAllByRole("alert")).toHaveLength(2);
    expect(screen.getAllByText("Logout unavailable")).toHaveLength(2);
    await waitFor(() => expect(desktopLogoutButton()).toBeEnabled());
    expect(screen.queryByText("Landing page")).not.toBeInTheDocument();
  });
});
