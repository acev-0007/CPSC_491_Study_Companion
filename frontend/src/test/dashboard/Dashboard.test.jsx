
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "../../pages/Dashboard";

// Mock saved summaries so Dashboard tests do not
// make real API requests.
vi.mock(
  "../../components/RecentSummaries/RecentSummaries",
  () => ({
    default: () => (
      <div data-testid="recent-summaries">
        Saved Summaries
      </div>
    ),
  })
);

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe("Dashboard", () => {
  it("renders the overview, study tools, and continue studying sections", () => {
    renderDashboard();

    expect(
      screen.getByRole("heading", { name: "Dashboard" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Study Tools" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Continue Studying" })
    ).toBeInTheDocument();
  });

  it.each([
    ["Flashcards", "/flashcards"],
    ["Quiz", "/quiz"],
    ["Summarization", "/summarization"],
    ["Visual Generator", "/visual-generator"],
    ["Assignment Tracker", "/assignments"],
    ["Textbook Hub", "/textbooks"],
  ])("links %s to %s", (tool, path) => {
    renderDashboard();

    const section = screen.getByRole("region", {
      name: "Study Tools",
    });

    expect(
      within(section).getByRole("link", {
        name: new RegExp(tool, "i"),
      })
    ).toHaveAttribute("href", path);
  });

  // SCRUM-232: Dashboard now displays saved summaries
  // instead of the previous empty-state placeholder.
  it("renders saved summaries in Continue Studying", () => {
    renderDashboard();

    const section = screen.getByRole("region", {
      name: "Continue Studying",
    });

    expect(
      within(section).getByTestId("recent-summaries")
    ).toBeInTheDocument();

    expect(
      within(section).getByText("Saved Summaries")
    ).toBeInTheDocument();
  });

  it("keeps the unfinished AI chat composer disabled", () => {
    renderDashboard();

    expect(
      screen.getByText("AI chat is not connected yet")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("textbox", {
        name: "Ask your study companion",
      })
    ).toBeDisabled();

    expect(
      screen.getByRole("button", { name: "Send" })
    ).toBeDisabled();
  });
});
