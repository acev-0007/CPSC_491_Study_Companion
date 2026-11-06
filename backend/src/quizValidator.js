// SCRUM-125: parses and validates the AI's quiz output.
//
// The AI is asked for the simplest possible shape:
//   { "questions": [ { "question": "...", "options": ["...", "...", "...", "..."], "correctOptionId": "B" } ] }
//
// This module turns that into the contract the Quiz UI (mockQuiz.js) expects,
// assigning the ids itself so the AI cannot produce duplicate or odd ids:
//   { id: "q1", question, options: [{ id: "A", text }, ...], correctOptionId }
//
// Anything that does not match exactly is rejected. Nothing is repaired or
// filled in, so a half-valid quiz never reaches the student.

export const QUESTION_COUNT = 5;
export const OPTION_IDS = ["A", "B", "C", "D"];

const MAX_QUESTION_LENGTH = 500;
const MAX_OPTION_LENGTH = 300;

const isText = (value, max) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.trim().length <= max;

// The AI is told not to use Markdown fences, but occasionally does anyway.
function stripCodeFence(text) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

/**
 * @param {string} rawResponse Raw text returned by the AI provider.
 * @returns {Array|null} Validated questions, or null if anything is invalid.
 */
export function parseQuiz(rawResponse) {
  if (typeof rawResponse !== "string") return null;

  let parsed;
  try {
    parsed = JSON.parse(stripCodeFence(rawResponse));
  } catch {
    return null;
  }

  const questions = parsed?.questions;
  if (!Array.isArray(questions) || questions.length !== QUESTION_COUNT) {
    return null;
  }

  const result = [];

  for (const [index, item] of questions.entries()) {
    if (!item || !isText(item.question, MAX_QUESTION_LENGTH)) return null;

    if (
      !Array.isArray(item.options) ||
      item.options.length !== OPTION_IDS.length ||
      !item.options.every((option) => isText(option, MAX_OPTION_LENGTH))
    ) {
      return null;
    }

    const texts = item.options.map((option) => option.trim());
    if (new Set(texts.map((text) => text.toLowerCase())).size !== texts.length) {
      return null;
    }

    if (!OPTION_IDS.includes(item.correctOptionId)) return null;

    result.push({
      id: `q${index + 1}`,
      question: item.question.trim(),
      options: texts.map((text, i) => ({ id: OPTION_IDS[i], text })),
      correctOptionId: item.correctOptionId,
    });
  }

  return result;
}