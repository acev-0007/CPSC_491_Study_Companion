import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Quiz from "./Quiz";
import { mockQuiz } from "../data/mockQuiz";

// SCRUM-124: basic functional validation of the mock-data Quiz UI.

function option(letter) {
  return screen.getByRole("button", { name: new RegExp(`^Option ${letter}:`) });
}

describe("mockQuiz data", () => {
  it("has five questions, each with four options and a valid correct answer", () => {
    expect(mockQuiz).toHaveLength(5);
    for (const question of mockQuiz) {
      expect(question.options).toHaveLength(4);
      const ids = question.options.map((o) => o.id);
      expect(ids).toContain(question.correctOptionId);
    }
    expect(new Set(mockQuiz.map((q) => q.id)).size).toBe(5);
  });
});

describe("Quiz page", () => {
  it("opens on the first question with progress shown", () => {
    render(<Quiz />);

    expect(
      screen.getByRole("heading", { name: mockQuiz[0].question })
    ).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 5")).toBeInTheDocument();
    expect(screen.getByText("0 of 5 answered")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Option [A-D]:/ })).toHaveLength(4);
  });

  it("marks a correct answer green with a check and text", async () => {
    const user = userEvent.setup();
    render(<Quiz />);

    await user.click(option("B"));

    expect(option("B")).toHaveClass("quiz-option--correct");
    expect(within(option("B")).getByText("Correct")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Correct.");
    expect(screen.getByText("1 of 5 answered")).toBeInTheDocument();
  });

  it("marks an incorrect answer red and reveals the correct one in green", async () => {
    const user = userEvent.setup();
    render(<Quiz />);

    await user.click(option("A"));

    expect(option("A")).toHaveClass("quiz-option--incorrect");
    expect(within(option("A")).getByText("Incorrect")).toBeInTheDocument();
    expect(option("B")).toHaveClass("quiz-option--correct");
    expect(within(option("B")).getByText("Correct answer")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Incorrect. The correct answer is B."
    );
  });

  it("locks the answer after the first selection", async () => {
    const user = userEvent.setup();
    render(<Quiz />);

    await user.click(option("A"));
    await user.click(option("B"));

    expect(option("A")).toHaveClass("quiz-option--incorrect");
    // B is correct because it is the answer key, not because it was selected.
    expect(option("B")).toHaveAttribute("aria-pressed", "false");
    expect(option("A")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1 of 5 answered")).toBeInTheDocument();
  });

  it("navigates with Next/Previous and enforces the boundaries", async () => {
    const user = userEvent.setup();
    render(<Quiz />);

    const previous = screen.getByRole("button", { name: "Previous" });
    const next = screen.getByRole("button", { name: "Next" });

    // First question: Previous does nothing.
    expect(previous).toHaveAttribute("aria-disabled", "true");
    await user.click(previous);
    expect(screen.getByText("Question 1 of 5")).toBeInTheDocument();

    for (let i = 2; i <= 5; i += 1) {
      await user.click(next);
      expect(screen.getByText(`Question ${i} of 5`)).toBeInTheDocument();
    }

    // Last question: Next does nothing.
    expect(next).toHaveAttribute("aria-disabled", "true");
    await user.click(next);
    expect(screen.getByText("Question 5 of 5")).toBeInTheDocument();

    await user.click(previous);
    expect(screen.getByText("Question 4 of 5")).toBeInTheDocument();
  });

  it("keeps answers and feedback when navigating away and back", async () => {
    const user = userEvent.setup();
    render(<Quiz />);

    await user.click(option("A")); // wrong on q1
    await user.click(screen.getByRole("button", { name: "Next" }));

    // q2 starts unanswered.
    expect(
      screen.getByRole("heading", { name: mockQuiz[1].question })
    ).toBeInTheDocument();
    expect(option("A")).not.toHaveClass("quiz-option--incorrect");
    await user.click(option("C")); // correct on q2

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(option("A")).toHaveClass("quiz-option--incorrect");
    expect(option("B")).toHaveClass("quiz-option--correct");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(option("C")).toHaveClass("quiz-option--correct");
    expect(screen.getByText("2 of 5 answered")).toBeInTheDocument();
  });

  it("labels Hint and Chat as Coming Soon and omits Quiz Settings", () => {
    render(<Quiz />);

    expect(screen.getByRole("button", { name: /Hint/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Chat/ })).toBeDisabled();
    expect(screen.getAllByText("Coming Soon")).toHaveLength(2);
    expect(screen.queryByText(/settings/i)).not.toBeInTheDocument();
  });
});