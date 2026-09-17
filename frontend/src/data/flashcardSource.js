// Flashcard data source.
//
// The page does not import mockFlashcards directly. It calls getFlashcards()
// here. That indirection means the Sprint 1 -> Sprint 2/3 migration touches
// exactly one file:
//
//   Sprint 1 (now):  return the local mock array
//   Sprint 2 (API):  await fetch("/api/flashcards") -> normalizeFlashcards(...)
//   Sprint 3 (AI):   POST study material to the AI service -> normalizeFlashcards(...)
//
// Because it is already async, the page's loading/await handling does not
// need to change when a real network call replaces the mock return.

import mockFlashcards from "./mockFlashcards";
import { normalizeFlashcards } from "./flashcardContract";

/**
 * Returns a validated flashcard set.
 * Malformed cards are filtered out rather than thrown, so one bad card from
 * a future AI response cannot break an entire study session.
 */
export async function getFlashcards() {
  // --- Sprint 2/3 replacement point -------------------------------------
  // const response = await fetch("/api/flashcards");
  // if (!response.ok) throw new Error("Failed to load flashcards");
  // const data = await response.json();
  // return normalizeFlashcards(data);
  // ----------------------------------------------------------------------
  return normalizeFlashcards(mockFlashcards);
}

export default getFlashcards;