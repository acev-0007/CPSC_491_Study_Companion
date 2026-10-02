import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getFlashcards } from "./flashcardSource";
import mockFlashcards from "./mockFlashcards";
import { validateFlashcardSet, isValidFlashcard } from "./flashcardContract";

// TECHNIQUE: black-box testing of the data-source seam. These tests call
// getFlashcards() through its public async interface and assert only on the
// returned data -- never on where that data came from. When the body of
// getFlashcards() is swapped from the mock array to a fetch() against
// /api/flashcards (Sprint 2) or the AI service (Sprint 3), this suite is the
// contract the new implementation must satisfy, with no edits required.

describe("mockFlashcards dataset (FLASH-1 acceptance criteria)", () => {
  it("defines between 5 and 10 flashcards", () => {
    expect(mockFlashcards.length).toBeGreaterThanOrEqual(5);
    expect(mockFlashcards.length).toBeLessThanOrEqual(10);
  });

  it("satisfies the shared flashcard contract in full", () => {
    const result = validateFlashcardSet(mockFlashcards);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("gives every card a usable id, front, and back", () => {
    mockFlashcards.forEach((card) => {
      expect(isValidFlashcard(card)).toBe(true);
    });
  });
});

describe("getFlashcards - API data source", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retrieves flashcards from the backend API", async () => {
    const apiCards = [
      {
        id: "card-1",
        topic_id: "topic-1",
        user_id: "user-1",
        front: "What is virtual memory?",
        back: "A memory management technique.",
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        flashcards: apiCards,
      }),
    });

    const cards = await getFlashcards();

    expect(fetch).toHaveBeenCalledWith(
      "/api/flashcards",
      {
        credentials: "same-origin",
      }
    );

    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe(
      "What is virtual memory?"
    );
    expect(cards[0].back).toBe(
      "A memory management technique."
    );
  });

  it("returns an empty array when the API has no flashcards", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        flashcards: [],
      }),
    });

    const cards = await getFlashcards();

    expect(cards).toEqual([]);
  });

  it("throws when the backend request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(
      getFlashcards()
    ).rejects.toThrow(
      "Failed to load flashcards"
    );
  });

  it("normalizes API flashcards through the shared contract", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      flashcards: [
        {
          id: "card-1",
          topic_id: "topic-1",
          user_id: "user-1",
          front: "What is a mutex?",
          back: "A locking primitive.",
        },
      ],
    }),
  });

  const cards = await getFlashcards();

  expect(cards).toHaveLength(1);
  expect(cards[0].id).toBe("card-1");
  expect(cards[0].front).toBe("What is a mutex?");
  expect(cards[0].back).toBe("A locking primitive.");
});
});