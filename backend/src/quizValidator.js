
// SCRUM-125: Parse and validate AI-generated quiz output.
// SCRUM-128: Support quiz topics and question categories.
//
// Expected AI response:
// {
//   "topic": "Operating Systems",
//   "questions": [
//     {
//       "question": "...",
//       "options": ["...", "...", "...", "..."],
//       "correctOptionId": "B",
//       "category": "Process Management"
//     }
//   ]
// }
//
// The backend assigns question and option IDs.
// Invalid quiz structure is rejected.
// Optional topic/category metadata defaults to "General".

export const QUESTION_COUNT = 5;
export const OPTION_IDS = ["A", "B", "C", "D"];

const MAX_QUESTION_LENGTH = 500;
const MAX_OPTION_LENGTH = 300;
const MAX_CATEGORY_LENGTH = 60;
const MAX_TOPIC_LENGTH = 80;

const isText = (value, max) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.trim().length <= max;

// The AI occasionally wraps JSON in Markdown code fences.
function stripCodeFence(text) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

// Normalize optional metadata without affecting quiz validity.
function normalizeLabel(value, maxLength) {
  if (typeof value !== "string") {
    return "General";
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (
    normalized.length === 0 ||
    normalized.length > maxLength
  ) {
    return "General";
  }

  return normalized;
}

/**
 * Extracts the topic from an AI-generated quiz.
 *
 * Missing, malformed, or invalid topics default to General.
 *
 * @param {string} rawResponse
 * @returns {string}
 */
export function parseQuizTopic(rawResponse) {
  if (typeof rawResponse !== "string") {
    return "General";
  }

  try {
    const parsed = JSON.parse(stripCodeFence(rawResponse));

    return normalizeLabel(
      parsed?.topic,
      MAX_TOPIC_LENGTH
    );
  } catch {
    return "General";
  }
}

/**
 * Parses and validates an AI-generated quiz.
 *
 * Returns null when required quiz data is invalid.
 * Optional category metadata never invalidates the quiz.
 *
 * @param {string} rawResponse
 * @returns {Array|null}
 */
export function parseQuiz(rawResponse) {
  if (typeof rawResponse !== "string") {
    return null;
  }

  let parsed;

  try {
    parsed = JSON.parse(stripCodeFence(rawResponse));
  } catch {
    return null;
  }

  const questions = parsed?.questions;

  if (
    !Array.isArray(questions) ||
    questions.length !== QUESTION_COUNT
  ) {
    return null;
  }

  const result = [];

  for (const [index, item] of questions.entries()) {
    // Validate question text.
    if (
      !item ||
      !isText(item.question, MAX_QUESTION_LENGTH)
    ) {
      return null;
    }

    // Validate exactly four nonempty options.
    if (
      !Array.isArray(item.options) ||
      item.options.length !== OPTION_IDS.length ||
      !item.options.every((option) =>
        isText(option, MAX_OPTION_LENGTH)
      )
    ) {
      return null;
    }

    const texts = item.options.map((option) =>
      option.trim()
    );

    // Reject duplicate options (case-insensitive).
    if (
      new Set(
        texts.map((text) => text.toLowerCase())
      ).size !== texts.length
    ) {
      return null;
    }

    // Validate the correct answer.
    if (!OPTION_IDS.includes(item.correctOptionId)) {
      return null;
    }

    // Normalize optional category metadata.
    const category = normalizeLabel(
      item.category,
      MAX_CATEGORY_LENGTH
    );

    result.push({
      id: `q${index + 1}`,
      question: item.question.trim(),
      options: texts.map((text, i) => ({
        id: OPTION_IDS[i],
        text,
      })),
      correctOptionId: item.correctOptionId,
      category,
    });
  }

  return result;
}
