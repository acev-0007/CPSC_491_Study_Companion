import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "../../pages/Dashboard";

function renderDashboard() {
  return render(<MemoryRouter><Dashboard /></MemoryRouter>);
}

describe("Dashboard", () => {
  it("renders the overview, study tools, and continue studying sections", () => {
    renderDashboard();
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Study Tools" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Continue Studying" })).toBeInTheDocument();
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
    const section = screen.getByRole("region", { name: "Study Tools" });
    expect(within(section).getByRole("link", { name: new RegExp(tool, "i") })).toHaveAttribute("href", path);
  });

  it("shows the current empty study history with an anchor back to the tools", () => {
    renderDashboard();
    expect(screen.getByText("Nothing to continue yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore study tools" })).toHaveAttribute("href", "#study-tools");
  });

  it("keeps the unfinished AI chat composer disabled", () => {
    renderDashboard();
    expect(screen.getByText("AI chat is not connected yet")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Ask your study companion" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});
