
import { describe, it, expect } from "vitest";

import {
  adaptGeneratedFlashcards,
  GENERATED_ID_PREFIX,
} from "./generatedFlashcardAdapter";

import {
  hasUniqueIds,
  isValidFlashcard,
} from "./flashcardContract";

const VALID_CARDS = [
  {
    front: "What is encapsulation?",
    back: "Restricting direct access to internal state.",
  },
  {
    front: "What is inheritance?",
    back: "Deriving behavior from another class.",
  },
];

describe("SCRUM-123: valid generated cards", () => {
  it("returns viewer-ready cards", () => {
    const result = adaptGeneratedFlashcards(VALID_CARDS);

    expect(result.flashcards).toHaveLength(2);
    expect(result.rejectedCount).toBe(0);

    expect(result.flashcards[0]).toEqual({
      id: "generated-1",
      front: "What is encapsulation?",
      back: "Restricting direct access to internal state.",
    });
  });

  it("satisfies the existing flashcard contract", () => {
    const { flashcards } = adaptGeneratedFlashcards(VALID_CARDS);

    flashcards.forEach((card) => {
      expect(isValidFlashcard(card)).toBe(true);
    });

    expect(hasUniqueIds(flashcards)).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const { flashcards } = adaptGeneratedFlashcards([
      { front: "  Question  ", back: "\n Answer \t" },
    ]);

    expect(flashcards[0]).toMatchObject({
      front: "Question",
      back: "Answer",
    });
  });

  it("preserves card order", () => {
    const { flashcards } = adaptGeneratedFlashcards([
      { front: "First", back: "1" },
      { front: "Second", back: "2" },
      { front: "Third", back: "3" },
    ]);

    expect(flashcards.map((card) => card.front)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
  });
});

describe("SCRUM-123: temporary IDs", () => {
  it("assigns sequential IDs", () => {
    const { flashcards } = adaptGeneratedFlashcards(VALID_CARDS);

    expect(flashcards.map((card) => card.id)).toEqual([
      "generated-1",
      "generated-2",
    ]);

    flashcards.forEach((card) => {
      expect(card.id.startsWith(GENERATED_ID_PREFIX)).toBe(true);
    });
  });

  it("does not leave gaps after invalid cards", () => {
    const { flashcards } = adaptGeneratedFlashcards([
      { front: "Missing answer" },
      { front: "Valid one", back: "A" },
      { front: "Valid two", back: "B" },
    ]);

    expect(flashcards.map((card) => card.id)).toEqual([
      "generated-1",
      "generated-2",
    ]);
  });

  it("does not use database-shaped UUIDs", () => {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const { flashcards } = adaptGeneratedFlashcards(VALID_CARDS);

    flashcards.forEach((card) => {
      expect(uuidPattern.test(card.id)).toBe(false);
    });
  });

  it("ignores IDs and extra fields supplied by AI", () => {
    const { flashcards } = adaptGeneratedFlashcards([
      {
        id: "external-id",
        user_id: "another-user",
        front: "Q",
        back: "A",
      },
    ]);

    expect(flashcards).toEqual([
      {
        id: "generated-1",
        front: "Q",
        back: "A",
      },
    ]);
  });
});

describe("SCRUM-123: malformed generated cards", () => {
  it("drops invalid cards but keeps valid cards", () => {
    const result = adaptGeneratedFlashcards([
      { front: "Valid question", back: "Valid answer" },
      { front: "Missing back" },
      { front: "", back: "Answer" },
      null,
    ]);

    expect(result.flashcards).toHaveLength(1);
    expect(result.flashcards[0].front).toBe("Valid question");
    expect(result.rejectedCount).toBe(3);
  });

  it.each([
    ["missing front", { back: "A" }],
    ["missing back", { front: "Q" }],
    ["empty front", { front: "", back: "A" }],
    ["whitespace back", { front: "Q", back: "   " }],
    ["non-string front", { front: 42, back: "A" }],
    ["null back", { front: "Q", back: null }],
    ["bare string", "invalid"],
    ["null entry", null],
    ["nested array", [["Q", "A"]]],
  ])("rejects %s", (_label, entry) => {
    const result = adaptGeneratedFlashcards([entry]);

    expect(result.flashcards).toEqual([]);
    expect(result.rejectedCount).toBe(1);
  });
});

describe("SCRUM-123: empty responses", () => {
  it("handles an empty array", () => {
    expect(adaptGeneratedFlashcards([])).toEqual({
      flashcards: [],
      rejectedCount: 0,
    });
  });

  it.each([null, undefined, "text", 42, {}])(
    "handles non-array input %j",
    (input) => {
      expect(adaptGeneratedFlashcards(input)).toEqual({
        flashcards: [],
        rejectedCount: 0,
      });
    }
  );
});
