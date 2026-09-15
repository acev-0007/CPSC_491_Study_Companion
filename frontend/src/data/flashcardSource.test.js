import { describe, it, expect } from "vitest";

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

describe("getFlashcards - data source interface", () => {
  it("resolves to an array (async, so a real fetch can drop in unchanged)", async () => {
    const cards = await getFlashcards();
    expect(Array.isArray(cards)).toBe(true);
  });

  it("returns only cards that satisfy the contract", async () => {
    const cards = await getFlashcards();
    cards.forEach((card) => {
      expect(isValidFlashcard(card)).toBe(true);
    });
  });

  it("returns a set the study session can actually run on", async () => {
    const cards = await getFlashcards();
    expect(cards.length).toBeGreaterThan(0);
    expect(validateFlashcardSet(cards).valid).toBe(true);
  });
});