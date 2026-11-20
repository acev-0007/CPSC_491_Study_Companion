
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import QuizHistory from "./QuizHistory";
import { getQuizAttempt, getQuizHistory } from "../services/quizHistory";

vi.mock("../services/quizHistory", () => ({
  getQuizHistory: vi.fn(),
  getQuizAttempt: vi.fn(),
}));

const attempts = [
  {
    id: "a1",
    topic: "Operating Systems",
    score_percent: 80,
    correct_count: 4,
    total_questions: 5,
    completed_at: "2026-11-19T10:00:00Z",
  },
  {
    id: "a2",
    topic: "Databases",
    score_percent: 40,
    correct_count: 2,
    total_questions: 5,
    completed_at: "2026-11-18T10:00:00Z",
  },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <QuizHistory />
    </MemoryRouter>
  );

beforeEach(() => vi.resetAllMocks());
afterEach(() => cleanup());

describe("Quiz History", () => {
  it("shows an empty state", async () => {
    getQuizHistory.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No completed quizzes yet")).toBeTruthy();
  });

  it("shows summary statistics and progress", async () => {
    getQuizHistory.mockResolvedValue(attempts);
    renderPage();
    expect(await screen.findByText("Score progression")).toBeTruthy();
    expect(screen.getByText("60%")).toBeTruthy();
    expect(screen.getByLabelText(/Quiz score progress/)).toBeTruthy();
  });

  it("filters topics and opens a saved answer review", async () => {
    getQuizHistory.mockResolvedValue(attempts);
    getQuizAttempt.mockResolvedValue({
      attempt: attempts[0],
      answers: [{
        question_index: 0,
        question_text: "What is a process?",
        selected_option_id: "B",
        correct_option_id: "B",
        options: [{ id: "B", text: "A running program" }],
        category: "Processes",
        is_correct: true,
      }],
    });
    renderPage();
    await screen.findByText("Previous attempts");
    fireEvent.change(screen.getByPlaceholderText("Search topics"), {
      target: { value: "Operating" },
    });
    expect(screen.queryByText("Databases")).toBeNull();
    fireEvent.click(screen.getByText("Operating Systems"));
    expect(await screen.findByText(/What is a process/)).toBeTruthy();
  });

  it("offers retry when loading fails", async () => {
    getQuizHistory.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText("Unable to load quiz history.")).toBeTruthy();
    fireEvent.click(screen.getByText("Try again"));
    await waitFor(() =>
      expect(screen.getByText("No completed quizzes yet")).toBeTruthy()
    );
  });
});
