
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
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import Flashcards from "./Flashcards";
import { getFlashcards } from "../data/flashcardSource";
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
 * Renders the page, waits for saved cards to load,
 * and opens the existing Flashcard Viewer.
 */
async function renderLoaded(cards = SAMPLE_CARDS) {
  getFlashcards.mockResolvedValue(cards);

  render(<Flashcards />);

  const user = userEvent.setup();

  await user.click(
    await screen.findByRole("button", {
      name: "Study Saved Flashcards",
    })
  );

  await screen.findByText(cards[0].front);
}

beforeEach(() => {
  getFlashcards.mockReset();
  generateFlashcards.mockReset();
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
      screen.getByRole("button", { name: "Save" })
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
      screen.getByRole("button", { name: "Save" })
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
      screen.getByRole("button", { name: "Save" })
    );

    expect(screen.getByText("Q1")).toBeInTheDocument();
  });
});

// =========================================================
// Loading, Empty, and Failure States
// =========================================================

describe("Flashcards page - loading, empty, and failure states", () => {
  it("shows a loading message while fetching cards", () => {
    getFlashcards.mockReturnValue(
      new Promise(() => {})
    );

    render(<Flashcards />);

    expect(
      screen.getByText(/loading flashcards/i)
    ).toBeInTheDocument();
  });

  it("shows an empty state when no cards exist", async () => {
    getFlashcards.mockResolvedValue([]);

    render(<Flashcards />);

    expect(
      await screen.findByText(/no flashcards are available/i)
    ).toBeInTheDocument();
  });

  it("shows an error when loading fails", async () => {
    getFlashcards.mockRejectedValue(
      new Error("network down")
    );

    render(<Flashcards />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /could not load flashcards/i
      );
    });
  });

  it("does not show navigation for an empty set", async () => {
    getFlashcards.mockResolvedValue([]);

    render(<Flashcards />);

    await screen.findByText(/no flashcards are available/i);

    expect(
      screen.queryByRole("button", { name: "Next" })
    ).not.toBeInTheDocument();
  });

  it("does not show edit controls for an empty set", async () => {
    getFlashcards.mockResolvedValue([]);

    render(<Flashcards />);

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
  it("shows the input and hides saved cards initially", async () => {
    getFlashcards.mockResolvedValue(SAMPLE_CARDS);

    render(<Flashcards />);

    expect(
      await screen.findByRole("button", {
        name: "Study Saved Flashcards",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Paste Study Notes")
    ).toBeInTheDocument();

    expect(screen.queryByText("Q1")).not.toBeInTheDocument();

    expect(
      screen.queryByText("Card 1 of 3")
    ).not.toBeInTheDocument();
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

    await screen.findByRole("button", {
      name: "Study Saved Flashcards",
    });

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

    await screen.findByRole("button", {
      name: "Study Saved Flashcards",
    });

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
