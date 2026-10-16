import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

import {
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import Flashcards from "./Flashcards";
import { getFlashcards } from "../data/flashcardSource";
import { deleteDeck, listDecks } from "../services/flashcardDecks";
import { generateFlashcards } from "../services/flashcardGeneration";

// Black-box component testing.
//
// Existing Flashcard Viewer tests remain unchanged in purpose.
// SCRUM-122 tests mock the generation service, verifying only
// how the Flashcards page handles its responses.
//
// Claude provider internals remain Zack's responsibility.

const SAMPLE_CARDS = [
  { id: 1, front: "Q1", back: "A1" },
  { id: 2, front: "Q2", back: "A2" },
  { id: 3, front: "Q3", back: "A3" },
];

vi.mock("../data/flashcardSource", () => ({
  getFlashcards: vi.fn(),
}));

// FLASH-DECK-1: saved decks come from the deck service.
vi.mock("../services/flashcardDecks", () => ({
  listDecks: vi.fn(),
  deleteDeck: vi.fn(),
}));

const DECK_OS = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Operating Systems",
  createdAt: null,
  cardCount: 3,
};

const DECK_DB = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  title: "Database Fundamentals",
  createdAt: null,
  cardCount: 1,
};

// Preserve validateStudyText because StudyMaterialInput uses it.
// Only replace the generation function with a mock.
vi.mock("../services/flashcardGeneration", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    generateFlashcards: vi.fn(),
  };
});

/**
 * Opens the saved-deck list (the page no longer loads cards up front).
 */
async function openSavedDecks(decks = [DECK_OS]) {
  listDecks.mockResolvedValue(decks);

  render(<Flashcards />);

  const user = userEvent.setup();

  await user.click(
    await screen.findByRole("button", {
      name: "Study Saved Flashcards",
    })
  );

  return user;
}

/**
 * Renders the page, opens the first saved deck,
 * and shows the existing Flashcard Viewer.
 */
async function renderLoaded(cards = SAMPLE_CARDS) {
  getFlashcards.mockResolvedValue(cards);

  const user = await openSavedDecks([DECK_OS]);

  await user.click(
    await screen.findByRole("button", {
      name: /study deck operating systems/i,
    })
  );

  await screen.findByText(cards[0].front);
}

beforeEach(() => {
  getFlashcards.mockReset();
  generateFlashcards.mockReset();
  listDecks.mockReset();
  deleteDeck.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// =========================================================
// Sprint 1: Initial Flashcard Viewer
// =========================================================

describe("Flashcards page - initial render", () => {
  it("shows the first card's question once loaded", async () => {
    await renderLoaded();

    expect(screen.getByText("Q1")).toBeInTheDocument();
  });

  it("shows the progress indicator as Card 1 of N", async () => {
    await renderLoaded();

    expect(screen.getByText("Card 1 of 3")).toBeInTheDocument();
  });

  it("does not reveal the answer before flipping", async () => {
    await renderLoaded();

    expect(screen.queryByText("A1")).not.toBeInTheDocument();
  });
});

// =========================================================
// FLASH-2: Flip Interaction
// =========================================================

describe("Flashcards page - flip interaction (FLASH-2)", () => {
  it("flips front to back on click", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(
      screen.getByRole("button", { name: /click to flip/i })
    );

    expect(screen.getByText("A1")).toBeInTheDocument();
  });

  it("flips back to front on a second click", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    const card = screen.getByRole("button", {
      name: /click to flip/i,
    });

    await user.click(card);
    await user.click(card);

    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(screen.queryByText("A1")).not.toBeInTheDocument();
  });

  it("flips using the Enter key", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    screen
      .getByRole("button", { name: /click to flip/i })
      .focus();

    await user.keyboard("{Enter}");

    expect(screen.getByText("A1")).toBeInTheDocument();
  });

  it("flips using the Space key", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    screen
      .getByRole("button", { name: /click to flip/i })
      .focus();

    await user.keyboard(" ");

    expect(screen.getByText("A1")).toBeInTheDocument();
  });
});

// =========================================================
// FLASH-2: Navigation
// =========================================================

describe("Flashcards page - navigation (FLASH-2)", () => {
  it("advances to the next card", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(
      screen.getByRole("button", { name: "Next" })
    );

    expect(screen.getByText("Q2")).toBeInTheDocument();
    expect(screen.getByText("Card 2 of 3")).toBeInTheDocument();
  });

  it("returns to the previous card", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(
      screen.getByRole("button", { name: "Next" })
    );

    await user.click(
      screen.getByRole("button", { name: "Previous" })
    );

    expect(screen.getByText("Q1")).toBeInTheDocument();
  });

  it("disables Previous on the first card", async () => {
    await renderLoaded();

    expect(
      screen.getByRole("button", { name: "Previous" })
    ).toBeDisabled();
  });

  it("disables Next on the final card", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    const next = screen.getByRole("button", {
      name: "Next",
    });

    await user.click(next);
    await user.click(next);

    expect(screen.getByText("Card 3 of 3")).toBeInTheDocument();
    expect(next).toBeDisabled();
  });

  it("resets a flipped card when navigating", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(
      screen.getByRole("button", { name: /click to flip/i })
    );

    expect(screen.getByText("A1")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Next" })
    );

    expect(screen.getByText("Q2")).toBeInTheDocument();
    expect(screen.queryByText("A2")).not.toBeInTheDocument();
  });

  it("handles a single-card set", async () => {
    await renderLoaded([
      { id: 1, front: "Only", back: "Card" },
    ]);

    expect(
      screen.getByRole("button", { name: "Previous" })
    ).toBeDisabled();

    expect(
      screen.getByRole("button", { name: "Next" })
    ).toBeDisabled();
  });
});

// =========================================================
// FLASH-2: Edit Interaction
// =========================================================

describe("Flashcards page - edit interaction (FLASH-2)", () => {
  it("opens the edit form with current card values", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(
      screen.getByRole("button", { name: /edit flashcard/i })
    );

    expect(screen.getByLabelText("Front")).toHaveValue("Q1");
    expect(screen.getByLabelText("Back")).toHaveValue("A1");
  });

  it("saves an edited card", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(
      screen.getByRole("button", { name: /edit flashcard/i })
    );

    const front = screen.getByLabelText("Front");

    await user.clear(front);
    await user.type(front, "Edited question");

    await user.click(
      screen.getByRole("button", { name: "Apply Changes" })
    );

    expect(
      screen.getByText("Edited question")
    ).toBeInTheDocument();

    expect(screen.queryByText("Q1")).not.toBeInTheDocument();
  });

  it("discards changes on cancel", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(
      screen.getByRole("button", { name: /edit flashcard/i })
    );

    const front = screen.getByLabelText("Front");

    await user.clear(front);
    await user.type(front, "Discarded");

    await user.click(
      screen.getByRole("button", { name: "Cancel" })
    );

    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(
      screen.queryByText("Discarded")
    ).not.toBeInTheDocument();
  });

  it("edits only the selected card", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(
      screen.getByRole("button", { name: "Next" })
    );

    await user.click(
      screen.getByRole("button", { name: /edit flashcard/i })
    );

    const front = screen.getByLabelText("Front");

    await user.clear(front);
    await user.type(front, "Changed card 2");

    await user.click(
      screen.getByRole("button", { name: "Apply Changes" })
    );

    await user.click(
      screen.getByRole("button", { name: "Previous" })
    );

    expect(screen.getByText("Q1")).toBeInTheDocument();
  });

  it("hides navigation controls while editing", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(
      screen.getByRole("button", { name: /edit flashcard/i })
    );

    expect(
      screen.queryByRole("button", { name: "Next" })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Previous" })
    ).not.toBeInTheDocument();
  });

  it("returns the saved card to its front side", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(
      screen.getByRole("button", { name: /click to flip/i })
    );

    await user.click(
      screen.getByRole("button", { name: /edit flashcard/i })
    );

    await user.click(
      screen.getByRole("button", { name: "Apply Changes" })
    );

    expect(screen.getByText("Q1")).toBeInTheDocument();
  });
});

// =========================================================
// Loading, Empty, and Failure States
// =========================================================

describe("Flashcards page - loading, empty, and failure states", () => {
  it("shows a loading message while fetching saved decks", async () => {
    const user = userEvent.setup();

    listDecks.mockReturnValue(new Promise(() => {}));

    render(<Flashcards />);

    await user.click(
      screen.getByRole("button", {
        name: "Study Saved Flashcards",
      })
    );

    expect(
      screen.getByText(/loading saved decks/i)
    ).toBeInTheDocument();
  });

  it("shows a loading message while fetching a deck's cards", async () => {
    getFlashcards.mockReturnValue(new Promise(() => {}));

    const user = await openSavedDecks();

    await user.click(
      await screen.findByRole("button", {
        name: /study deck operating systems/i,
      })
    );

    expect(
      screen.getByText(/loading flashcards/i)
    ).toBeInTheDocument();
  });

  it("shows an empty state when no decks exist", async () => {
    await openSavedDecks([]);

    expect(
      await screen.findByText(/no saved decks yet/i)
    ).toBeInTheDocument();
  });

  it("shows an error when loading decks fails", async () => {
    listDecks.mockRejectedValue(new Error("network down"));

    render(<Flashcards />);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", {
        name: "Study Saved Flashcards",
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /could not load saved flashcards/i
      );
    });
  });

  it("shows an error when loading a deck's cards fails", async () => {
    getFlashcards.mockRejectedValue(new Error("network down"));

    const user = await openSavedDecks();

    await user.click(
      await screen.findByRole("button", {
        name: /study deck operating systems/i,
      })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not load this deck's flashcards/i
    );
  });

  it("shows an empty state for a deck with no cards", async () => {
    getFlashcards.mockResolvedValue([]);

    const user = await openSavedDecks();

    await user.click(
      await screen.findByRole("button", {
        name: /study deck operating systems/i,
      })
    );

    expect(
      await screen.findByText(/no flashcards are available/i)
    ).toBeInTheDocument();
  });

  it("does not show navigation for an empty deck", async () => {
    getFlashcards.mockResolvedValue([]);

    const user = await openSavedDecks();

    await user.click(
      await screen.findByRole("button", {
        name: /study deck operating systems/i,
      })
    );

    await screen.findByText(/no flashcards are available/i);

    expect(
      screen.queryByRole("button", { name: "Next" })
    ).not.toBeInTheDocument();
  });

  it("does not show edit controls for an empty deck", async () => {
    getFlashcards.mockResolvedValue([]);

    const user = await openSavedDecks();

    await user.click(
      await screen.findByRole("button", {
        name: /study deck operating systems/i,
      })
    );

    await screen.findByText(/no flashcards are available/i);

    expect(
      screen.queryByRole("button", { name: /edit flashcard/i })
    ).not.toBeInTheDocument();
  });
});

// =========================================================
// CICD-ANT-2: Accessibility Regression
// =========================================================

describe("Flashcards page - accessibility state (CICD-ANT-2)", () => {
  it("updates aria-pressed when flipped", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    const card = screen.getByRole("button", {
      name: /click to flip/i,
    });

    expect(card).toHaveAttribute("aria-pressed", "false");

    await user.click(card);

    expect(card).toHaveAttribute("aria-pressed", "true");
  });

  it("resets aria-pressed after navigation", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    const card = screen.getByRole("button", {
      name: /click to flip/i,
    });

    await user.click(card);

    expect(card).toHaveAttribute("aria-pressed", "true");

    await user.click(
      screen.getByRole("button", { name: "Next" })
    );

    expect(
      screen.getByRole("button", { name: /click to flip/i })
    ).toHaveAttribute("aria-pressed", "false");
  });
});

// =========================================================
// CICD-ANT-2: Edit/Flip Regression
// =========================================================

describe("Flashcards page - edit/flip regression (CICD-ANT-2)", () => {
  it("can flip after canceling an edit", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(
      screen.getByRole("button", { name: /edit flashcard/i })
    );

    await user.click(
      screen.getByRole("button", { name: "Cancel" })
    );

    const card = screen.getByRole("button", {
      name: /click to flip/i,
    });

    await user.click(card);

    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(card).toHaveAttribute("aria-pressed", "true");
  });

  it("can navigate after canceling an edit", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(
      screen.getByRole("button", { name: /edit flashcard/i })
    );

    await user.click(
      screen.getByRole("button", { name: "Cancel" })
    );

    await user.click(
      screen.getByRole("button", { name: "Next" })
    );

    expect(screen.getByText("Q2")).toBeInTheDocument();
    expect(screen.getByText("Card 2 of 3")).toBeInTheDocument();
  });
});

// =========================================================
// SCRUM-121: Saved Cards Visibility
// =========================================================

describe("Flashcards page - saved cards visibility (SCRUM-121)", () => {
  it("shows the home screen without opening either deck", async () => {
  getFlashcards.mockResolvedValue(SAMPLE_CARDS);

  render(<Flashcards />);

  // Cards load only after a deck is chosen.
  expect(getFlashcards).not.toHaveBeenCalled();
  expect(listDecks).not.toHaveBeenCalled();

  expect(
    screen.getByRole("button", {
      name: "Generate New Flashcards",
    })
  ).toBeInTheDocument();

  expect(
    screen.getByRole("button", {
      name: "Study Saved Flashcards",
    })
  ).toBeInTheDocument();

  expect(
    screen.queryByLabelText("Paste Study Notes")
  ).not.toBeInTheDocument();

  expect(screen.queryByText("Q1")).not.toBeInTheDocument();
});

  it("reveals saved cards when requested", async () => {
    await renderLoaded();

    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(screen.getByText("Card 1 of 3")).toBeInTheDocument();
  });

  it("does not reveal saved cards when AI generation fails", async () => {
    const user = userEvent.setup();

    getFlashcards.mockResolvedValue(SAMPLE_CARDS);

    generateFlashcards.mockRejectedValueOnce(
      new Error("Flashcard generation failed.")
    );

    render(<Flashcards />);

    await user.click(
  screen.getByRole("button", {
    name: "Generate New Flashcards",
  })
);

    await user.type(
      screen.getByLabelText("Paste Study Notes"),
      "Some notes"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Generate Flashcards",
      })
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(/could not generate flashcards/i);

    expect(screen.queryByText("Q1")).not.toBeInTheDocument();
  });
});

// =========================================================
// SCRUM-122: AI Generation Response Handling
// =========================================================

describe("Flashcards page - AI generation (SCRUM-122)", () => {
  it("shows the count returned by the AI service", async () => {
    const user = userEvent.setup();

    getFlashcards.mockResolvedValue(SAMPLE_CARDS);

    generateFlashcards.mockResolvedValueOnce({
      flashcards: [
        {
          front: "What is encapsulation?",
          back: "Restricting direct access to internal state.",
        },
      ],
      isStub: false,
    });

    render(<Flashcards />);

    await user.click(
  screen.getByRole("button", {
    name: "Generate New Flashcards",
  })
);

    await user.type(
      screen.getByLabelText("Paste Study Notes"),
      "Encapsulation hides internal object state."
    );

    await user.click(
      screen.getByRole("button", {
        name: "Generate Flashcards",
      })
    );

    expect(
    await screen.findByText("What is encapsulation?")
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("status")
    ).toHaveTextContent(/generated 1 flashcard/i);

    expect(generateFlashcards).toHaveBeenCalledWith(
      "Encapsulation hides internal object state."
    );

    // Generation does not automatically open saved cards.
    expect(screen.queryByText("Q1")).not.toBeInTheDocument();
  });
});
describe("SCRUM-123: generated flashcard study view", () => {
  it("opens a dedicated study session with flip and navigation", async () => {
    const user = userEvent.setup();

    getFlashcards.mockResolvedValue(SAMPLE_CARDS);

    generateFlashcards.mockResolvedValueOnce({
      flashcards: [
        { front: "Question one", back: "Answer one" },
        { front: "Question two", back: "Answer two" },
      ],
      isStub: false,
    });

    render(<Flashcards />);

    await user.click(
      screen.getByRole("button", {
        name: "Generate New Flashcards",
      })
    );

    await user.type(
      screen.getByLabelText("Paste Study Notes"),
      "Study material for generation."
    );

    await user.click(
      screen.getByRole("button", {
        name: "Generate Flashcards",
      })
    );

    expect(
      await screen.findByText("Question one")
    ).toBeInTheDocument();

    expect(
      screen.queryByLabelText("Paste Study Notes")
    ).not.toBeInTheDocument();

    expect(screen.getByText("Card 1 of 2")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /click to flip/i,
      })
    );

    expect(screen.getByText("Answer one")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Next" })
    );

    expect(screen.getByText("Question two")).toBeInTheDocument();
    expect(screen.getByText("Card 2 of 2")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /back to flashcards/i,
      })
    );

    expect(
      screen.getByRole("button", {
        name: "Generate New Flashcards",
      })
    ).toBeInTheDocument();
  });
});

// =========================================================
// FLASH-DECK-1: Saved Flashcard Deck Management
// =========================================================

describe("Flashcards page - saved deck list (FLASH-DECK-1)", () => {
  it("lists each saved deck with its card count", async () => {
    await openSavedDecks([DECK_OS, DECK_DB]);

    expect(
      await screen.findByText("Operating Systems")
    ).toBeInTheDocument();
    expect(screen.getByText("3 flashcards")).toBeInTheDocument();
    expect(screen.getByText("Database Fundamentals")).toBeInTheDocument();
    expect(screen.getByText("1 flashcard")).toBeInTheDocument();
  });

  it("does not load any cards until a deck is chosen", async () => {
    await openSavedDecks([DECK_OS, DECK_DB]);

    await screen.findByText("Operating Systems");

    expect(getFlashcards).not.toHaveBeenCalled();
  });

  it("loads only the chosen deck's cards", async () => {
    getFlashcards.mockResolvedValue(SAMPLE_CARDS);

    const user = await openSavedDecks([DECK_OS, DECK_DB]);

    await user.click(
      await screen.findByRole("button", {
        name: /study deck database fundamentals/i,
      })
    );

    await screen.findByText("Q1");

    expect(getFlashcards).toHaveBeenCalledWith({ topicId: DECK_DB.id });
  });

  it("returns to the deck list from a studied deck", async () => {
    getFlashcards.mockResolvedValue(SAMPLE_CARDS);

    const user = await openSavedDecks([DECK_OS, DECK_DB]);

    await user.click(
      await screen.findByRole("button", {
        name: /study deck operating systems/i,
      })
    );
    await screen.findByText("Q1");

    await user.click(
      screen.getByRole("button", { name: /back to saved decks/i })
    );

    expect(await screen.findByText("Database Fundamentals")).toBeInTheDocument();
    expect(screen.queryByText("Q1")).not.toBeInTheDocument();
  });

  it("does not show a previous deck's cards while the next deck loads", async () => {
    getFlashcards.mockResolvedValueOnce(SAMPLE_CARDS);

    const user = await openSavedDecks([DECK_OS, DECK_DB]);

    await user.click(
      await screen.findByRole("button", {
        name: /study deck operating systems/i,
      })
    );
    await screen.findByText("Q1");

    await user.click(
      screen.getByRole("button", { name: /back to saved decks/i })
    );

    getFlashcards.mockReturnValueOnce(new Promise(() => {}));

    await user.click(
      await screen.findByRole("button", {
        name: /study deck database fundamentals/i,
      })
    );

    expect(screen.getByText(/loading flashcards/i)).toBeInTheDocument();
    expect(screen.queryByText("Q1")).not.toBeInTheDocument();
  });
});

describe("Flashcards page - three-dot menu (FLASH-DECK-1)", () => {
  it("exposes an accessible actions button for each deck", async () => {
    await openSavedDecks([DECK_OS, DECK_DB]);

    const button = await screen.findByRole("button", {
      name: "Actions for Operating Systems",
    });

    expect(button).toHaveAttribute("aria-haspopup", "menu");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", {
        name: "Actions for Database Fundamentals",
      })
    ).toBeInTheDocument();
  });

  it("keeps the menu closed until opened", async () => {
    await openSavedDecks();

    await screen.findByText("Operating Systems");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("contains exactly one action: Delete deck", async () => {
    const user = await openSavedDecks();

    await user.click(
      await screen.findByRole("button", {
        name: "Actions for Operating Systems",
      })
    );

    expect(screen.getByRole("menu")).toBeInTheDocument();

    const items = screen.getAllByRole("menuitem");

    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Delete deck");
    expect(
      screen.getByRole("button", { name: "Actions for Operating Systems" })
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("moves focus to the menu item when opened", async () => {
    const user = await openSavedDecks();

    await user.click(
      await screen.findByRole("button", {
        name: "Actions for Operating Systems",
      })
    );

    expect(screen.getByRole("menuitem")).toHaveFocus();
  });

  it("opens only one deck's menu at a time", async () => {
    const user = await openSavedDecks([DECK_OS, DECK_DB]);

    await user.click(
      await screen.findByRole("button", {
        name: "Actions for Operating Systems",
      })
    );
    await user.click(
      screen.getByRole("button", {
        name: "Actions for Database Fundamentals",
      })
    );

    expect(screen.getAllByRole("menu")).toHaveLength(1);
  });

  it("closes on Escape and returns focus to the button", async () => {
    const user = await openSavedDecks();

    const trigger = await screen.findByRole("button", {
      name: "Actions for Operating Systems",
    });

    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes when clicking outside the menu", async () => {
    const user = await openSavedDecks();

    await user.click(
      await screen.findByRole("button", {
        name: "Actions for Operating Systems",
      })
    );
    await user.click(screen.getByRole("heading", { name: "Saved Flashcards" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens with the keyboard", async () => {
    const user = await openSavedDecks();

    const trigger = await screen.findByRole("button", {
      name: "Actions for Operating Systems",
    });

    trigger.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("menuitem")).toBeInTheDocument();
  });
});

describe("Flashcards page - delete deck (FLASH-DECK-1)", () => {
  async function chooseDelete(decks = [DECK_OS, DECK_DB]) {
    const user = await openSavedDecks(decks);

    await user.click(
      await screen.findByRole("button", {
        name: `Actions for ${decks[0].title}`,
      })
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete deck" }));

    return user;
  }

  it("opens a confirmation dialog instead of deleting immediately", async () => {
    await chooseDelete();

    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent(/operating systems/i);
    expect(dialog).toHaveTextContent(/permanently deletes the deck/i);
    expect(dialog).toHaveTextContent(/all 3 of its flashcards/i);
    expect(deleteDeck).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("focuses Cancel, the safe choice, when the dialog opens", async () => {
    await chooseDelete();

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("cancels without deleting and keeps the deck", async () => {
    const user = await chooseDelete();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteDeck).not.toHaveBeenCalled();
    expect(screen.getByText("Operating Systems")).toBeInTheDocument();
  });

  it("cancels with Escape", async () => {
    const user = await chooseDelete();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteDeck).not.toHaveBeenCalled();
  });

  it("returns focus to the actions button after cancelling", async () => {
    const user = await chooseDelete();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("button", { name: "Actions for Operating Systems" })
    ).toHaveFocus();
  });

  it("keeps Tab focus inside the dialog", async () => {
    const user = await chooseDelete();

    // Cancel -> Delete deck -> wraps back to Cancel.
    await user.tab();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete deck",
      })
    ).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("deletes the deck on confirm and removes it from the list", async () => {
    deleteDeck.mockResolvedValue(undefined);

    const user = await chooseDelete();

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete deck",
      })
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(deleteDeck).toHaveBeenCalledTimes(1);
    expect(deleteDeck).toHaveBeenCalledWith(DECK_OS.id);
    expect(screen.queryByText("Operating Systems")).not.toBeInTheDocument();
    expect(screen.getByText("Database Fundamentals")).toBeInTheDocument();
  });

  it("shows a confirmation message after deleting", async () => {
    deleteDeck.mockResolvedValue(undefined);

    const user = await chooseDelete();

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete deck",
      })
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      /deleted "operating systems"/i
    );
  });

  it("shows the empty state after deleting the last deck", async () => {
    deleteDeck.mockResolvedValue(undefined);

    const user = await chooseDelete([DECK_OS]);

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete deck",
      })
    );

    expect(await screen.findByText(/no saved decks yet/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/deleted/i);
  });

  it("disables the dialog buttons while deleting", async () => {
    let finish;
    deleteDeck.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    const user = await chooseDelete();

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete deck",
      })
    );

    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    finish();

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("does not send a second delete request on repeated clicks", async () => {
    let finish;
    deleteDeck.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    const user = await chooseDelete();

    const confirm = within(screen.getByRole("dialog")).getByRole("button", {
      name: "Delete deck",
    });

    await user.click(confirm);
    await user.click(confirm);

    expect(deleteDeck).toHaveBeenCalledTimes(1);

    finish();

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("keeps the deck and shows an error when deletion fails", async () => {
    deleteDeck.mockRejectedValue(new Error("Topic not found."));

    const user = await chooseDelete();

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete deck",
      })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not delete this deck/i
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Operating Systems")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("allows retrying after a failed delete", async () => {
    deleteDeck
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(undefined);

    const user = await chooseDelete();

    const confirm = () =>
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete deck",
      });

    await user.click(confirm());
    await screen.findByRole("alert");

    await user.click(confirm());

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(deleteDeck).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Operating Systems")).not.toBeInTheDocument();
  });

  it("clears a previous error when the dialog is reopened", async () => {
    deleteDeck.mockRejectedValue(new Error("network down"));

    const user = await chooseDelete();

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete deck",
      })
    );
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(
      screen.getByRole("button", { name: "Actions for Operating Systems" })
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete deck" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});