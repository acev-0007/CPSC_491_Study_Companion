// Flashcard generation service.
//
// The body of generateFlashcards() is a TEMPORARY STUB. It waits briefly (so the
// loading state is real) and returns no cards. It does NOT call Claude.
//
//   SCRUM-122: replace the stub body with a POST to the agreed AI endpoint
//              (proposed: POST /api/ai/flashcards with { notes }) and return
//              { flashcards: data.flashcards, isStub: false }.
//   SCRUM-123: pass result.flashcards through normalizeFlashcards() from
//              data/flashcardContract.js before anything is displayed.
//
// Returning { flashcards } mirrors the proposed response contract, so swapping
// the stub for the real call should not change the caller.

export const MAX_STUDY_TEXT_LENGTH = 20000;
export const STUB_DELAY_MS = 800;

/**
 * Checks pasted study notes before generation.
 * Returns the trimmed text so callers send exactly what was validated.
 */
export function validateStudyText(studyText) {
  if (typeof studyText !== "string" || studyText.trim() === "") {
    return {
      valid: false,
      error: "Paste some study notes before generating flashcards.",
      text: "",
    };
  }

  const text = studyText.trim();

  if (text.length > MAX_STUDY_TEXT_LENGTH) {
    return {
      valid: false,
      error: `Study notes are too long. The limit is ${MAX_STUDY_TEXT_LENGTH.toLocaleString("en-US")} characters.`,
      text,
    };
  }

  return { valid: true, error: null, text };
}

/**
 * Requests flashcards for the given study text.
 * Rejects if the text fails validation, so invalid input can never reach the
 * AI backend even if a caller skips the UI check.
 */
export async function generateFlashcards(studyText) {
  const check = validateStudyText(studyText);
  if (!check.valid) {
    throw new Error(check.error);
  }

  // TEMPORARY STUB (SCRUM-121). Replaced in SCRUM-122.
  await new Promise((resolve) => setTimeout(resolve, STUB_DELAY_MS));
  return { flashcards: [], isStub: true };
}

export default generateFlashcards;