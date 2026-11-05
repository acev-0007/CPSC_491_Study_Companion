
import { normalizeFlashcards } from "./flashcardContract";

// SCRUM-123: Temporary UI IDs are not database IDs.
export const GENERATED_ID_PREFIX = "generated-";

function toContentPair(entry) {
  if (
    entry === null ||
    typeof entry !== "object" ||
    Array.isArray(entry)
  ) {
    return null;
  }

  if (
    typeof entry.front !== "string" ||
    typeof entry.back !== "string"
  ) {
    return null;
  }

  const front = entry.front.trim();
  const back = entry.back.trim();

  if (!front || !back) {
    return null;
  }

  return { front, back };
}

/**
 * SCRUM-123: Adapt AI-generated cards for the existing viewer.
 *
 * - Reject malformed entries.
 * - Trim valid front/back content.
 * - Ignore AI-supplied IDs and extra fields.
 * - Assign temporary UI IDs.
 * - Reuse the existing flashcard contract.
 *
 * These IDs must not be used as Supabase database IDs.
 */
export function adaptGeneratedFlashcards(rawFlashcards) {
  if (!Array.isArray(rawFlashcards)) {
    return {
      flashcards: [],
      rejectedCount: 0,
    };
  }

  const withIds = rawFlashcards
    .map(toContentPair)
    .filter(Boolean)
    .map((pair, index) => ({
      id: `${GENERATED_ID_PREFIX}${index + 1}`,
      ...pair,
    }));

  const flashcards = normalizeFlashcards(withIds);

  return {
    flashcards,
    rejectedCount: rawFlashcards.length - flashcards.length,
  };
}

export default adaptGeneratedFlashcards;
