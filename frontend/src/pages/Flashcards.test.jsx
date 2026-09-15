import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Flashcards from "./Flashcards";

// TECHNIQUE: black-box component testing. Tests drive the page the way a
// student does -- find controls by their visible label or role, click them,
// assert on what appears on screen. No test reaches into component state,
// so the internals can be refactored (or the data source swapped for the
// API/AI service) without rewriting this suite.
//
// The data source is mocked per-test so the page's loading, error, and
// empty-set branches can each be exercised deterministically. That same
// mocking seam is how Sprint 2/3 will simulate API failures and AI timeouts.

const SAMPLE_CARDS = [
  { id: 1, front: "Q1", back: "A1" },
  { id: 2, front: "Q2", back: "A2" },
  { id: 3, front: "Q3", back: "A3" },
];

vi.mock("../data/flashcardSource", () => ({
  getFlashcards: vi.fn(),
}));

const { getFlashcards } = await import("../data/flashcardSource");

/** Renders the page and waits for the async load to settle. */
async function renderLoaded(cards = SAMPLE_CARDS) {
  getFlashcards.mockResolvedValue(cards);
  render(<Flashcards />);
  await screen.findByText(cards[0].front);
}

beforeEach(() => {
  getFlashcards.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Flashcards page - initial render", () => {
  it("shows the first card's question once loaded", async () => {
    await renderLoaded();
    expect(screen.getByText("Q1")).toBeInTheDocument();
  });

  it("shows the progress indicator as 'Card 1 of N'", async () => {
    await renderLoaded();
    expect(screen.getByText("Card 1 of 3")).toBeInTheDocument();
  });

  it("does not reveal the answer before the card is flipped", async () => {
    await renderLoaded();
    expect(screen.queryByText("A1")).not.toBeInTheDocument();
  });
});

describe("Flashcards page - flip interaction (FLASH-2)", () => {
  it("flips front to back on click", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: /click to flip/i }));

    expect(screen.getByText("A1")).toBeInTheDocument();
  });

  it("flips back to front when clicked a second time", async () => {
    const user = userEvent.setup();
    await renderLoaded();
    const card = screen.getByRole("button", { name: /click to flip/i });

    await user.click(card);
    await user.click(card);

    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(screen.queryByText("A1")).not.toBeInTheDocument();
  });

  it("flips via the Enter key for keyboard users", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    screen.getByRole("button", { name: /click to flip/i }).focus();
    await user.keyboard("{Enter}");

    expect(screen.getByText("A1")).toBeInTheDocument();
  });

  it("flips via the Space key for keyboard users", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    screen.getByRole("button", { name: /click to flip/i }).focus();
    await user.keyboard(" ");

    expect(screen.getByText("A1")).toBeInTheDocument();
  });
});

describe("Flashcards page - navigation (FLASH-2)", () => {
  it("advances to the next card", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Q2")).toBeInTheDocument();
    expect(screen.getByText("Card 2 of 3")).toBeInTheDocument();
  });

  it("returns to the previous card", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Previous" }));

    expect(screen.getByText("Q1")).toBeInTheDocument();
  });

  // BOUNDARY: first card
  it("disables Previous on the first card", async () => {
    await renderLoaded();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  // BOUNDARY: last card
  it("disables Next on the final card", async () => {
    const user = userEvent.setup();
    await renderLoaded();
    const next = screen.getByRole("button", { name: "Next" });

    await user.click(next);
    await user.click(next);

    expect(screen.getByText("Card 3 of 3")).toBeInTheDocument();
    expect(next).toBeDisabled();
  });

  it("resets a flipped card to its front when navigating away", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: /click to flip/i }));
    expect(screen.getByText("A1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Q2")).toBeInTheDocument();
    expect(screen.queryByText("A2")).not.toBeInTheDocument();
  });

  it("handles a single-card set by disabling both controls", async () => {
    await renderLoaded([{ id: 1, front: "Only", back: "Card" }]);

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});

describe("Flashcards page - edit interaction (FLASH-2)", () => {
  it("opens the edit form prefilled with the current card", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: /edit flashcard/i }));

    expect(screen.getByLabelText("Front")).toHaveValue("Q1");
    expect(screen.getByLabelText("Back")).toHaveValue("A1");
  });

  it("saves an edited card and shows the new text", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: /edit flashcard/i }));
    const front = screen.getByLabelText("Front");
    await user.clear(front);
    await user.type(front, "Edited question");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Edited question")).toBeInTheDocument();
    expect(screen.queryByText("Q1")).not.toBeInTheDocument();
  });

  it("discards changes on cancel", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: /edit flashcard/i }));
    const front = screen.getByLabelText("Front");
    await user.clear(front);
    await user.type(front, "Discarded");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(screen.queryByText("Discarded")).not.toBeInTheDocument();
  });

  it("edits only the current card, leaving others untouched", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /edit flashcard/i }));
    const front = screen.getByLabelText("Front");
    await user.clear(front);
    await user.type(front, "Changed card 2");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await user.click(screen.getByRole("button", { name: "Previous" }));

    expect(screen.getByText("Q1")).toBeInTheDocument();
  });

  it("hides the navigation controls while editing to prevent mid-edit navigation", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: /edit flashcard/i }));

    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
  });

  it("returns the saved card to its front side", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: /click to flip/i }));
    await user.click(screen.getByRole("button", { name: /edit flashcard/i }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Q1")).toBeInTheDocument();
  });
});

describe("Flashcards page - loading, empty, and failure states", () => {
  it("shows a loading message before the data resolves", () => {
    getFlashcards.mockReturnValue(new Promise(() => {})); // never settles
    render(<Flashcards />);

    expect(screen.getByText(/loading flashcards/i)).toBeInTheDocument();
  });

  it("shows an empty-state message when no cards are returned", async () => {
    await getFlashcards.mockResolvedValue([]);
    render(<Flashcards />);

    expect(await screen.findByText(/no flashcards are available/i)).toBeInTheDocument();
  });

  // Matters for Sprint 2/3: this is the API-down / AI-timeout path.
  it("shows an error message when the data source rejects", async () => {
    getFlashcards.mockRejectedValue(new Error("network down"));
    render(<Flashcards />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/could not load flashcards/i);
    });
  });

  it("does not render study controls when the set is empty", async () => {
    getFlashcards.mockResolvedValue([]);
    render(<Flashcards />);
    await screen.findByText(/no flashcards are available/i);

    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });
});