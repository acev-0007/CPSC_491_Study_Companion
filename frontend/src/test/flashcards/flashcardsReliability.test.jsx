import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Flashcards from "../../pages/Flashcards";
import { getFlashcards } from "../../data/flashcardSource";
import { listDecks } from "../../services/flashcardDecks";
import { generateFlashcards } from "../../services/flashcardGeneration";

// FLASH-UI-4: regression tests for asynchronous safety.
// Each test controls when a mocked request settles, so we can prove that a
// response arriving after the student has moved on does not change the view.

vi.mock("../../data/flashcardSource", () => ({
  getFlashcards: vi.fn(),
}));

vi.mock("../../services/flashcardDecks", () => ({
  listDecks: vi.fn(),
  deleteDeck: vi.fn(),
}));

vi.mock("../../services/flashcardGeneration", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, generateFlashcards: vi.fn() };
});

const DECK = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Operating Systems",
  createdAt: null,
  cardCount: 2,
};

const CARDS = [
  { id: 1, front: "Q1", back: "A1" },
  { id: 2, front: "Q2", back: "A2" },
];

// A promise the test resolves or rejects by hand.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  getFlashcards.mockReset();
  listDecks.mockReset();
  generateFlashcards.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function startGeneration(user) {
  await user.click(
    screen.getByRole("button", { name: "Generate New Flashcards" })
  );
  await user.type(
    screen.getByLabelText("Paste Study Notes"),
    "Encapsulation hides internal object state."
  );
  await user.click(
    screen.getByRole("button", { name: "Generate Flashcards" })
  );
}

describe("Flashcards reliability - stale deck-list responses (FLASH-UI-4)", () => {
  it("ignores a late deck list after the student opens the generate screen", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    listDecks.mockReturnValue(pending.promise);

    render(<Flashcards />);

    await user.click(
      screen.getByRole("button", { name: "Study Saved Flashcards" })
    );
    expect(screen.getByText("Loading saved decks...")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /back to flashcards/i })
    );
    await user.click(
      screen.getByRole("button", { name: "Generate New Flashcards" })
    );

    pending.resolve([DECK]);

    // The generate screen stays; the deck list never appears.
    await waitFor(() => {
      expect(screen.getByLabelText("Paste Study Notes")).toBeInTheDocument();
    });
    expect(screen.queryByText("Operating Systems")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading saved decks...")).not.toBeInTheDocument();
  });

  it("ignores a late deck-list failure after the student leaves", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    listDecks.mockReturnValue(pending.promise);

    render(<Flashcards />);

    await user.click(
      screen.getByRole("button", { name: "Study Saved Flashcards" })
    );
    await user.click(
      screen.getByRole("button", { name: /back to flashcards/i })
    );

    pending.reject(new Error("network down"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Generate New Flashcards" })
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Flashcards reliability - stale deck cards (FLASH-UI-4)", () => {
  it("does not show a deck's cards after going back to the deck list", async () => {
    const user = userEvent.setup();
    const pendingCards = deferred();
    listDecks.mockResolvedValue([DECK]);
    getFlashcards.mockReturnValue(pendingCards.promise);

    render(<Flashcards />);

    await user.click(
      screen.getByRole("button", { name: "Study Saved Flashcards" })
    );
    await user.click(
      await screen.findByRole("button", { name: /study deck operating systems/i })
    );
    expect(screen.getByText("Loading flashcards...")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /back to saved decks/i })
    );

    pendingCards.resolve(CARDS);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /study deck operating systems/i })
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Q1")).not.toBeInTheDocument();
  });
});

describe("Flashcards reliability - stale generation (FLASH-UI-4)", () => {
  it("discards a generation result after the student goes back", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    generateFlashcards.mockReturnValue(pending.promise);

    render(<Flashcards />);
    await startGeneration(user);

    // Generation is in flight; the student backs out.
    await user.click(screen.getByRole("button", { name: /back/i }));

    pending.resolve({
      flashcards: [{ front: "Late question", back: "Late answer" }],
      isStub: false,
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Generate New Flashcards" })
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Late question")).not.toBeInTheDocument();
    expect(screen.queryByText("AI-generated deck")).not.toBeInTheDocument();
  });

  it("still opens the generated deck when the student stays on the screen", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    generateFlashcards.mockReturnValue(pending.promise);

    render(<Flashcards />);
    await startGeneration(user);

    pending.resolve({
      flashcards: [{ front: "On-time question", back: "On-time answer" }],
      isStub: false,
    });

    expect(await screen.findByText("On-time question")).toBeInTheDocument();
    expect(screen.getByText("AI-generated deck")).toBeInTheDocument();
  });
});
