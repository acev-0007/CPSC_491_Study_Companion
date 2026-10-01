import { describe, it, expect } from "vitest";

import {
  isValidFlashcard,
  hasUniqueIds,
  normalizeFlashcards,
  validateFlashcardSet,
  MIN_CARDS,
  MAX_CARDS,
} from "./flashcardContract";

// TECHNIQUE: unit testing with equivalence partitioning + boundary value
// analysis. Inputs are split into valid/invalid classes, and set-size rules
// are probed at min-1 / min / max / max+1 rather than at arbitrary sizes.
//
// These tests deliberately target the CONTRACT, not the mock array. When the
// data source becomes the API (Sprint 2) or the AI service (Sprint 3), the
// same contract validates the new data and this suite still applies
// unchanged -- that is the point of putting validation behind a contract.

describe("isValidFlashcard - valid partition", () => {
  it("accepts a well-formed card with a numeric id", () => {
    expect(isValidFlashcard({ id: 1, front: "Q", back: "A" })).toBe(true);
  });

  it("accepts a string id, which a database or AI service may return", () => {
    expect(isValidFlashcard({ id: "card-abc", front: "Q", back: "A" })).toBe(true);
  });

  it("ignores extra keys, so added API fields do not break the contract", () => {
    expect(
      isValidFlashcard({ id: 1, front: "Q", back: "A", topicId: 7, createdAt: "x" })
    ).toBe(true);
  });
});

describe("isValidFlashcard - invalid partitions", () => {
  // Each case represents a distinct failure class a real API/LLM can produce.
  const invalidCases = [
    ["null", null],
    ["undefined", undefined],
    ["an array", []],
    ["a bare string", "not a card"],
    ["a missing id", { front: "Q", back: "A" }],
    ["a missing front", { id: 1, back: "A" }],
    ["a missing back", { id: 1, front: "Q" }],
    ["an empty front", { id: 1, front: "", back: "A" }],
    ["a whitespace-only back", { id: 1, front: "Q", back: "   " }],
    ["a non-string front", { id: 1, front: 42, back: "A" }],
    ["a null back", { id: 1, front: "Q", back: null }],
    ["an empty string id", { id: "", front: "Q", back: "A" }],
    ["a NaN id", { id: NaN, front: "Q", back: "A" }],
  ];

  it.each(invalidCases)("rejects %s", (_label, value) => {
    expect(isValidFlashcard(value)).toBe(false);
  });
});

describe("hasUniqueIds", () => {
  it("passes when all ids differ", () => {
    expect(hasUniqueIds([{ id: 1 }, { id: 2 }, { id: 3 }])).toBe(true);
  });

  it("fails on duplicate ids, which would break React keys", () => {
    expect(hasUniqueIds([{ id: 1 }, { id: 1 }])).toBe(false);
  });
});

describe("normalizeFlashcards - resilience for future AI/API data", () => {
  it("drops malformed cards instead of throwing", () => {
    const messy = [
      { id: 1, front: "Q1", back: "A1" },
      { id: 2, front: "", back: "A2" }, // AI returned an empty front
      null, // API returned a null entry
      { id: 4, front: "Q4", back: "A4" },
    ];

    const result = normalizeFlashcards(messy);

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual([1, 4]);
  });

  it("returns an empty array for a non-array input rather than crashing", () => {
    expect(normalizeFlashcards(null)).toEqual([]);
    expect(normalizeFlashcards(undefined)).toEqual([]);
    expect(normalizeFlashcards({ cards: [] })).toEqual([]);
  });

  it("returns an empty array when the AI generates zero usable cards", () => {
    expect(normalizeFlashcards([{ id: 1, front: "", back: "" }])).toEqual([]);
  });
});

describe("validateFlashcardSet - boundary value analysis on set size", () => {
  const makeCards = (n) =>
    Array.from({ length: n }, (_, i) => ({ id: i + 1, front: `Q${i}`, back: `A${i}` }));

  it(`rejects ${MIN_CARDS - 1} cards (just below minimum)`, () => {
    expect(validateFlashcardSet(makeCards(MIN_CARDS - 1)).valid).toBe(false);
  });

  it(`accepts exactly ${MIN_CARDS} cards (lower boundary)`, () => {
    expect(validateFlashcardSet(makeCards(MIN_CARDS)).valid).toBe(true);
  });

  it(`accepts exactly ${MAX_CARDS} cards (upper boundary)`, () => {
    expect(validateFlashcardSet(makeCards(MAX_CARDS)).valid).toBe(true);
  });

  it(`rejects ${MAX_CARDS + 1} cards (just above maximum)`, () => {
    expect(validateFlashcardSet(makeCards(MAX_CARDS + 1)).valid).toBe(false);
  });

  it("reports a descriptive error for duplicate ids", () => {
    const duplicates = makeCards(6).map((c) => ({ ...c, id: 1 }));
    const result = validateFlashcardSet(duplicates);

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/unique/i);
  });

  it("still returns the usable subset alongside the errors", () => {
    const mixed = [...makeCards(5), { id: 99, front: "", back: "" }];
    const result = validateFlashcardSet(mixed);

    expect(result.valid).toBe(false);
    expect(result.validCards).toHaveLength(5);
  });
});