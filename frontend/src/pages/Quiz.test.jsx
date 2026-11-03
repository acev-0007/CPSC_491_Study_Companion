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

// ---- Results screen -------------------------------------------------------

// Answer key for mockQuiz: B, C, A, D, B.
const ALL_CORRECT = ["B", "C", "A", "D", "B"];
const ALL_WRONG = ["A", "A", "B", "A", "A"];
const THREE_CORRECT = ["B", "C", "A", "A", "A"];

async function answerAll(user, picks) {
  for (let i = 0; i < picks.length; i += 1) {
    await user.click(option(picks[i]));
    if (i < picks.length - 1) {
      await user.click(screen.getByRole("button", { name: "Next" }));
    }
  }
}

describe("Quiz results screen", () => {
  it("does not offer results until every question is answered", async () => {
    const user = userEvent.setup();
    render(<Quiz />);

    // Answer only q1, then jump to the last question.
    await user.click(option("B"));
    for (let i = 0; i < 4; i += 1) {
      await user.click(screen.getByRole("button", { name: "Next" }));
    }

    expect(screen.queryByRole("button", { name: "View Results" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(
      screen.getByText("Answer the 4 remaining questions to see your results.")
    ).toBeInTheDocument();
  });

  it("replaces Next with View Results on the last question once complete", async () => {
    const user = userEvent.setup();
    render(<Quiz />);

    await answerAll(user, THREE_CORRECT);

    expect(screen.getByRole("button", { name: "View Results" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("shows correct, incorrect and total counts for a partial score", async () => {
    const user = userEvent.setup();
    render(<Quiz />);

    await answerAll(user, THREE_CORRECT);
    await user.click(screen.getByRole("button", { name: "View Results" }));

    expect(screen.getByRole("heading", { name: "Quiz complete" })).toHaveFocus();
    expect(screen.getByText("Correct answers").closest("div")).toHaveTextContent("3 / 5");
    expect(screen.getByText("Incorrect answers").closest("div")).toHaveTextContent("2 / 5");
    expect(
      screen.getByRole("img", { name: "3 of 5 correct, 2 incorrect, 60 percent" })
    ).toBeInTheDocument();
  });

  it("handles a perfect score", async () => {
    const user = userEvent.setup();
    const { container } = render(<Quiz />);

    await answerAll(user, ALL_CORRECT);
    await user.click(screen.getByRole("button", { name: "View Results" }));

    expect(
      screen.getByRole("img", { name: "5 of 5 correct, 0 incorrect, 100 percent" })
    ).toBeInTheDocument();
    expect(screen.getByText("Incorrect answers").closest("div")).toHaveTextContent("0 / 5");

    // Incorrect arc has zero length; correct arc fills the whole ring.
    const incorrectArc = container.querySelector(".quiz-ring-incorrect");
    expect(parseFloat(incorrectArc.getAttribute("stroke-dasharray"))).toBe(0);
    const correctArc = container.querySelector(".quiz-ring-correct");
    const [dash, rest] = correctArc.getAttribute("stroke-dasharray").split(" ").map(Number);
    expect(dash).toBeGreaterThan(300);
    expect(rest).toBeCloseTo(0, 5);
  });

  it("handles a zero score", async () => {
    const user = userEvent.setup();
    const { container } = render(<Quiz />);

    await answerAll(user, ALL_WRONG);
    await user.click(screen.getByRole("button", { name: "View Results" }));

    expect(
      screen.getByRole("img", { name: "0 of 5 correct, 5 incorrect, 0 percent" })
    ).toBeInTheDocument();
    expect(screen.getByText("Correct answers").closest("div")).toHaveTextContent("0 / 5");

    const correctArc = container.querySelector(".quiz-ring-correct");
    expect(parseFloat(correctArc.getAttribute("stroke-dasharray"))).toBe(0);
  });

  it("reviews each question with the chosen and correct answers", async () => {
    const user = userEvent.setup();
    render(<Quiz />);

    await answerAll(user, THREE_CORRECT);
    await user.click(screen.getByRole("button", { name: "View Results" }));

    const items = within(
      screen.getByRole("heading", { name: "Question review" }).closest("section")
    ).getAllByRole("listitem");
    expect(items).toHaveLength(5);

    // Q1 correct: no separate "Correct answer" line.
    expect(items[0]).toHaveTextContent("1. What is a context switch?");
    expect(items[0]).toHaveTextContent("Correct");
    expect(items[0]).toHaveTextContent("Your answer: B. Saving and restoring execution state");
    expect(items[0]).not.toHaveTextContent("Correct answer:");

    // Q4 incorrect: shows what was chosen and what was right.
    expect(items[3]).toHaveTextContent("Incorrect");
    expect(items[3]).toHaveTextContent("Your answer: A. Open file descriptors");
    expect(items[3]).toHaveTextContent(
      "Correct answer: D. Virtual-to-physical address mappings"
    );
  });

  it("restarts the quiz and clears previous answers", async () => {
    const user = userEvent.setup();
    render(<Quiz />);

    await answerAll(user, THREE_CORRECT);
    await user.click(screen.getByRole("button", { name: "View Results" }));
    await user.click(screen.getByRole("button", { name: "Restart quiz" }));

    expect(screen.getByText("Question 1 of 5")).toBeInTheDocument();
    expect(screen.getByText("0 of 5 answered")).toBeInTheDocument();
    expect(option("B")).not.toHaveClass("quiz-option--correct");
    expect(option("B")).toHaveAttribute("aria-pressed", "false");

    // Answers from the previous attempt are gone on every question.
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(option("C")).not.toHaveClass("quiz-option--correct");
  });
});