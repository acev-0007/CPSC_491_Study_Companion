import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateQuiz,
  GENERIC_ERROR,
  isValidQuiz,
  MAX_STUDY_TEXT_LENGTH,
  QUIZ_ENDPOINT,
} from "./quizGeneration";
import { mockQuiz } from "../data/mockQuiz";

// SCRUM-125: the service's request/response contract.

function respond(body, { ok = true, status = 200 } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isValidQuiz", () => {
  it("accepts the mock quiz shape", () => {
    expect(isValidQuiz(mockQuiz)).toBe(true);
  });

  it("rejects empty, non-array, and malformed quizzes", () => {
    expect(isValidQuiz([])).toBe(false);
    expect(isValidQuiz(null)).toBe(false);
    expect(isValidQuiz([{ ...mockQuiz[0], correctOptionId: "Z" }])).toBe(false);
    expect(isValidQuiz([{ ...mockQuiz[0], options: mockQuiz[0].options.slice(1) }])).toBe(false);
    expect(isValidQuiz([mockQuiz[0], mockQuiz[0]])).toBe(false); // duplicate ids
  });
});

describe("generateQuiz", () => {
  it("POSTs trimmed notes to the quiz endpoint and returns the questions", async () => {
    respond({ questions: mockQuiz });

    const result = await generateQuiz("  Process notes  ");

    expect(result).toEqual(mockQuiz);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(QUIZ_ENDPOINT);
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ notes: "Process notes" });
  });

  it("rejects empty and oversized text without calling the API", async () => {
    vi.stubGlobal("fetch", vi.fn());

    await expect(generateQuiz("   ")).rejects.toThrow(/study material/i);
    await expect(
      generateQuiz("a".repeat(MAX_STUDY_TEXT_LENGTH + 1))
    ).rejects.toThrow(/too long/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces the server's error message", async () => {
    respond({ error: "Quiz generation failed." }, { ok: false, status: 502 });

    await expect(generateQuiz("notes")).rejects.toThrow(
      "Quiz generation failed."
    );
  });

  it("rejects a 200 response with an invalid quiz", async () => {
    respond({ questions: [{ id: "q1", question: "Q?", options: [] }] });

    await expect(generateQuiz("notes")).rejects.toThrow(GENERIC_ERROR);
  });

  it("handles network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(generateQuiz("notes")).rejects.toThrow(GENERIC_ERROR);
  });
});