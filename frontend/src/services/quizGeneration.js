// Quiz generation service (SCRUM-125).
//
// generateQuiz() sends study text to the shared AI backend
// (POST /api/ai/quiz) and returns validated questions. No provider code lives
// in React; this file only makes the HTTP request and checks the response.
//
//   Request:  { "notes": "<study text>" }
//   Success:  { "questions": [ { id, question, options: [{ id, text }],
//               correctOptionId } ] }      (same shape as data/mockQuiz.js)
//   Error:    non-2xx + { "error": "..." }

export const MAX_STUDY_TEXT_LENGTH = 20000;
export const QUIZ_ENDPOINT = "/api/ai/quiz";
export const GENERIC_ERROR = "Quiz generation failed. Please try again.";

// True only if every question matches the shape the Quiz UI relies on.
export function isValidQuiz(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return false;

  const ids = new Set();

  return questions.every((q) => {
    if (!q || typeof q.id !== "string" || ids.has(q.id)) return false;
    ids.add(q.id);

    return (
      typeof q.question === "string" &&
      q.question.trim() !== "" &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      q.options.every(
        (o) =>
          typeof o?.id === "string" &&
          typeof o?.text === "string" &&
          o.text.trim() !== ""
      ) &&
      q.options.some((o) => o.id === q.correctOptionId)
    );
  });
}

/**
 * Requests a quiz for the given study text.
 * Resolves with the question array. Rejects with an Error whose message is
 * safe to show the user.
 */
export async function generateQuiz(studyText) {
  const text = typeof studyText === "string" ? studyText.trim() : "";

  if (!text) {
    throw new Error("Add some study material before creating a quiz.");
  }

  if (text.length > MAX_STUDY_TEXT_LENGTH) {
    throw new Error(
      `Study material is too long. The limit is ${MAX_STUDY_TEXT_LENGTH.toLocaleString("en-US")} characters.`
    );
  }

  let response;
  try {
    response = await fetch(QUIZ_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ notes: text }),
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

  if (!isValidQuiz(data?.questions)) {
    throw new Error(GENERIC_ERROR);
  }

  return data.questions;
}

export default generateQuiz;