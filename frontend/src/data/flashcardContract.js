// Flashcard data contract.
//
// WHY THIS FILE EXISTS
// Sprint 1 uses a hardcoded mock array. Later sprints will replace that
// source with (a) a database via the backend API and (b) AI-generated
// cards from the shared AI service. Those sources are far less trustworthy
// than a hardcoded array: an API can return null, a missing field, or an
// empty list, and an LLM can return malformed JSON or extra/renamed keys.
//
// Rather than rewrite the validation logic (and the tests) at that point,
// the shape of a flashcard is defined ONCE here. Every data source is
// checked against this same contract, so when the data source changes the
// only thing that changes is where the array comes from -- not how it is
// validated, and not the tests that cover it.
//
// SHAPE
//   Flashcard { id: number|string, front: non-empty string, back: non-empty string }

export const MIN_CARDS = 5;
export const MAX_CARDS = 10;

/** True if a single value is a usable flashcard. */
export function isValidFlashcard(card) {
  if (card === null || typeof card !== "object" || Array.isArray(card)) {
    return false;
  }

  const hasUsableId =
    (typeof card.id === "number" && Number.isFinite(card.id)) ||
    (typeof card.id === "string" && card.id.trim() !== "");

  const hasUsableFront =
    typeof card.front === "string" && card.front.trim() !== "";

  const hasUsableBack = typeof card.back === "string" && card.back.trim() !== "";

  return hasUsableId && hasUsableFront && hasUsableBack;
}

/** True if every id in the set is unique. React keys and lookups depend on this. */
export function hasUniqueIds(cards) {
  if (!Array.isArray(cards)) return false;
  const ids = cards.map((card) => card?.id);
  return new Set(ids).size === ids.length;
}

/**
 * Filters any candidate list down to cards that satisfy the contract.
 *
 * This is the function the AI/API integration will call. An LLM response
 * of 10 cards where 2 are malformed becomes 8 usable cards instead of
 * crashing the study session, and the page renders what it can.
 */
export function normalizeFlashcards(cards) {
  if (!Array.isArray(cards)) return [];
  return cards.filter(isValidFlashcard);
}

/**
 * Full validation report for a candidate flashcard set.
 * Used by tests now; usable by the API/AI layer later to decide whether a
 * generated set is good enough to show the student.
 */
export function validateFlashcardSet(cards, { min = MIN_CARDS, max = MAX_CARDS } = {}) {
  const errors = [];

  if (!Array.isArray(cards)) {
    return { valid: false, errors: ["Flashcard set must be an array."], validCards: [] };
  }

  const validCards = normalizeFlashcards(cards);

  if (validCards.length !== cards.length) {
    errors.push(
      `${cards.length - validCards.length} card(s) failed the flashcard contract.`
    );
  }
  if (cards.length < min) {
    errors.push(`Expected at least ${min} cards, received ${cards.length}.`);
  }
  if (cards.length > max) {
    errors.push(`Expected at most ${max} cards, received ${cards.length}.`);
  }
  if (!hasUniqueIds(cards)) {
    errors.push("Flashcard ids must be unique.");
  }

  return { valid: errors.length === 0, errors, validCards };
}