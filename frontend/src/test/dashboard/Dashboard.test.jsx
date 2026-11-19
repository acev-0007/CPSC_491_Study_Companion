
import { describe, expect, it, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
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

  it("enables the AI Study Companion chat when a question is entered", () => {
    renderDashboard();

    // Verify the AI Study Companion is displayed.
    expect(
      screen.getByRole("heading", {
        name: "AI Study Companion",
      })
    ).toBeInTheDocument();

    // Verify the new empty-state message.
    expect(
      screen.getByText("What would you like to study?")
    ).toBeInTheDocument();

    // Find the chat input.
    const textarea = screen.getByRole("textbox", {
      name: "Ask your study companion",
    });

    expect(textarea).toBeEnabled();

    // The Send button starts disabled because the input is empty.
    const sendButton = screen.getByRole("button", {
      name: "Send",
    });

    expect(sendButton).toBeDisabled();

    // Simulate the student typing a question.
    fireEvent.change(textarea, {
      target: {
        value: "Can you explain binary search?",
      },
    });

    // The Send button should now be enabled.
    expect(sendButton).toBeEnabled();

    // Verify the question appears in the input.
    expect(textarea).toHaveValue(
      "Can you explain binary search?"
    );
  });

});
