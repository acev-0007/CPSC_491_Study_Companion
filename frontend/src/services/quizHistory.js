
const BASE_URL = "/api/quiz-history";

async function requestJson(url, options = {}) {
  let response;

  try {
    response = await fetch(url, {
      credentials: "same-origin",
      ...options,
    });
  } catch {
    throw new Error("Unable to connect to the server.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" && data.error.trim()
        ? data.error
        : "The request could not be completed."
    );
  }

  return data;
}

export async function submitQuizAttempt({
  quizId,
  idempotencyKey,
  answers,
}) {
  const data = await requestJson(`${BASE_URL}/attempts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      quizId,
      idempotencyKey,
      answers,
    }),
  });

  if (
    typeof data?.attemptId !== "string" ||
    !Number.isInteger(data.scorePercent) ||
    !Number.isInteger(data.correctCount) ||
    !Number.isInteger(data.totalQuestions) ||
    data.correctCount < 0 ||
    data.correctCount > data.totalQuestions ||
    data.scorePercent < 0 ||
    data.scorePercent > 100
  ) {
    throw new Error("Invalid response from quiz grading service.");
  }

  return data;
}

export async function getQuizHistory() {
  const data = await requestJson(`${BASE_URL}/attempts`);

  if (!Array.isArray(data?.attempts)) {
    throw new Error("Invalid quiz history response.");
  }

  return data.attempts;
}

export async function getQuizAttempt(attemptId) {
  const data = await requestJson(
    `${BASE_URL}/attempts/${encodeURIComponent(attemptId)}`
  );

  if (!data?.attempt || !Array.isArray(data.answers)) {
    throw new Error("Invalid quiz attempt response.");
  }

  return data;
}
