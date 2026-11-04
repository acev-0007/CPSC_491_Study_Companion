import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Flashcards from "../../pages/Flashcards";
import { getFlashcards } from "../../data/flashcardSource";
import { listDecks } from "../../services/flashcardDecks";
import { saveGeneratedFlashcards } from "../../services/flashcardPersistence";

// FLASH-UI-4: UI semantics, edit behavior, smoke, and lightweight performance.

vi.mock("../../data/flashcardSource", () => ({ getFlashcards: vi.fn() }));
vi.mock("../../services/flashcardDecks", () => ({
  listDecks: vi.fn(),
  deleteDeck: vi.fn(),
}));
vi.mock("../../services/flashcardPersistence", () => ({
  saveGeneratedFlashcards: vi.fn(),
}));

const DECK = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Operating Systems",
  createdAt: null,
  cardCount: 3,
};

function makeCards(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    front: `Q${i + 1}`,
    back: `A${i + 1}`,
  }));
}

async function openDeck(cards) {
  listDecks.mockResolvedValue([DECK]);
  getFlashcards.mockResolvedValue(cards);

  const user = userEvent.setup();
  render(<Flashcards />);

  await user.click(
    screen.getByRole("button", { name: "Study Saved Flashcards" })
  );
  await user.click(
    await screen.findByRole("button", { name: /study deck operating systems/i })
  );
  await screen.findByText(cards[0].front);

  return user;
}

beforeEach(() => {
  getFlashcards.mockReset();
  listDecks.mockReset();
  saveGeneratedFlashcards.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Flashcards UI - smoke (FLASH-UI-4)", () => {
  it("renders the home screen with both entry points", () => {
    render(<Flashcards />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Flashcards" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate New Flashcards" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Study Saved Flashcards" })
    ).toBeInTheDocument();
  });

  it("loads a deck and keeps the card interactive", async () => {
    const user = await openDeck(makeCards(3));

    await user.click(screen.getByRole("button", { name: /click to flip/i }));
    expect(screen.getByText("A1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Q2")).toBeInTheDocument();
  });
});

describe("Flashcards UI - accessibility (FLASH-UI-4)", () => {
  it("exposes the flashcard as a native button", async () => {
    await openDeck(makeCards(2));

    const card = screen.getByRole("button", { name: /click to flip/i });

    expect(card.tagName).toBe("BUTTON");
    expect(card).toHaveAttribute("type", "button");
    expect(card).not.toHaveAttribute("role");
    expect(card).not.toHaveAttribute("tabindex");
  });

  it("labels which side of the card is showing", async () => {
    const user = await openDeck(makeCards(2));
    const card = screen.getByRole("button", { name: /click to flip/i });

    expect(within(card).getByText("Question")).toBeInTheDocument();

    await user.click(card);

    expect(within(card).getByText("Answer")).toBeInTheDocument();
  });

  it("announces card progress politely", async () => {
    await openDeck(makeCards(3));

    expect(screen.getByText("Card 1 of 3")).toHaveAttribute(
      "aria-live",
      "polite"
    );
  });

  it("announces the loading state as a status", async () => {
    listDecks.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<Flashcards />);

    await user.click(
      screen.getByRole("button", { name: "Study Saved Flashcards" })
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading saved decks..."
    );
  });

  it("announces a load failure as an alert", async () => {
    listDecks.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    render(<Flashcards />);

    await user.click(
      screen.getByRole("button", { name: "Study Saved Flashcards" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load saved flashcards."
    );
  });
});

describe("Flashcards UI - edit behavior is session-only (FLASH-UI-4)", () => {
  it("tells the student that edits are not saved to the deck", async () => {
    const user = await openDeck(makeCards(2));

    await user.click(screen.getByRole("button", { name: /edit flashcard/i }));

    expect(screen.getByText(/session only/i)).toBeInTheDocument();
  });

  it("applies an edit locally without calling any persistence", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const user = await openDeck(makeCards(2));
    const callsBeforeEdit = fetchSpy.mock.calls.length;

    await user.click(screen.getByRole("button", { name: /edit flashcard/i }));
    const front = screen.getByLabelText("Front");
    await user.clear(front);
    await user.type(front, "Edited");
    await user.click(screen.getByRole("button", { name: "Apply Changes" }));

    expect(screen.getByText("Edited")).toBeInTheDocument();
    expect(saveGeneratedFlashcards).not.toHaveBeenCalled();
    expect(fetchSpy.mock.calls.length).toBe(callsBeforeEdit);
  });

  it("discards the edit when the deck is reopened", async () => {
    const user = await openDeck(makeCards(2));

    await user.click(screen.getByRole("button", { name: /edit flashcard/i }));
    const front = screen.getByLabelText("Front");
    await user.clear(front);
    await user.type(front, "Edited");
    await user.click(screen.getByRole("button", { name: "Apply Changes" }));

    await user.click(
      screen.getByRole("button", { name: /back to saved decks/i })
    );
    await user.click(
      await screen.findByRole("button", { name: /study deck operating systems/i })
    );

    expect(await screen.findByText("Q1")).toBeInTheDocument();
    expect(screen.queryByText("Edited")).not.toBeInTheDocument();
  });
});

describe("Flashcards UI - large deck performance (FLASH-UI-4)", () => {
  it("renders only one card at a time regardless of deck size", async () => {
    await openDeck(makeCards(500));

    expect(screen.getAllByRole("button", { name: /click to flip/i })).toHaveLength(1);
    expect(screen.getByText("Card 1 of 500")).toBeInTheDocument();
  });

  it("navigates a 500-card deck end to end without noticeable delay", async () => {
    await openDeck(makeCards(500));
    const next = screen.getByRole("button", { name: "Next" });

    const start = performance.now();
    for (let i = 0; i < 499; i += 1) {
      fireEvent.click(next);
    }
    const elapsed = performance.now() - start;

    expect(screen.getByText("Card 500 of 500")).toBeInTheDocument();
    expect(next).toBeDisabled();
    // Generous ceiling so CI hardware variance cannot make this flaky;
    // it exists to catch order-of-magnitude regressions only.
    expect(elapsed).toBeLessThan(8000);
  });

  it("does not overflow when a card contains very long text", async () => {
    const long = "A".repeat(5000);
    await openDeck([{ id: 1, front: long, back: "short" }]);

    expect(screen.getByText(long)).toHaveClass("flashcard-text");
  });
});
