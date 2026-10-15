// Flashcard generation service.
//
// generateFlashcards() sends validated study notes to the shared AI backend
// (POST /api/ai/flashcards) and returns the structured response. All AI-provider
// work happens in that backend route; this file only makes the HTTP request, so
// no provider code lives in React.
//
// Agreed contract (Sprint 3):
//   Request:  { "notes": "<study text>" }
//   Success:  { "flashcards": [ { "front": "...", "back": "..." } ] }
//   Error:    non-2xx + { "error": "Flashcard generation failed." }
//
// The generated cards carry no IDs. Validating each card, assigning IDs, and
// passing them through normalizeFlashcards() is SCRUM-123, not done here.

export const MAX_STUDY_TEXT_LENGTH = 20000;
export const GENERATE_ENDPOINT = "/api/ai/flashcards";
export const GENERIC_ERROR = "Flashcard generation failed.";

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
 *
 * Resolves with { flashcards, isStub: false }. Rejects with an Error whose
 * message is safe to show the user for: network failure, non-2xx responses,
 * unreadable JSON, or a response without a flashcards array.
 */
export async function generateFlashcards(studyText) {
  const check = validateStudyText(studyText);
  if (!check.valid) {
    throw new Error(check.error);
  }

  let response;
  try {
    response = await fetch(GENERATE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ notes: check.text }),
    });
  } catch {
    throw new Error(GENERIC_ERROR);
  }

  // The body may be missing or not JSON (e.g. a proxy error page).
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" && data.error.trim() !== ""
        ? data.error
        : GENERIC_ERROR
    );
  }

  if (!data || !Array.isArray(data.flashcards)) {
    throw new Error(GENERIC_ERROR);
  }

  return { flashcards: data.flashcards, isStub: false };
}

export default generateFlashcards;