import { describe, it, expect, vi, afterEach } from "vitest";

import {
  GENERATE_ENDPOINT,
  GENERIC_ERROR,
  MAX_STUDY_TEXT_LENGTH,
  generateFlashcards,
  validateStudyText,
} from "./flashcardGeneration";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Builds a fetch response without a network. `body` is what .json() resolves
// to; pass `jsonError: true` to simulate a body that is not valid JSON.
function mockFetchResponse({ ok = true, status = 200, body, jsonError = false }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: jsonError
      ? () => Promise.reject(new SyntaxError("Unexpected token <"))
      : () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("validateStudyText", () => {
  it("rejects an empty string", () => {
    expect(validateStudyText("").valid).toBe(false);
  });

  it("rejects whitespace-only input", () => {
    const result = validateStudyText("   \n\t  ");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/paste some study notes/i);
  });

  it("rejects non-string input", () => {
    expect(validateStudyText(null).valid).toBe(false);
    expect(validateStudyText(undefined).valid).toBe(false);
    expect(validateStudyText(42).valid).toBe(false);
  });

  it("accepts real notes and returns them trimmed", () => {
    const result = validateStudyText("  Encapsulation hides state.  ");
    expect(result).toEqual({
      valid: true,
      error: null,
      text: "Encapsulation hides state.",
    });
  });

  // BOUNDARY: exactly at the limit passes, one over fails.
  it("enforces the maximum length", () => {
    expect(validateStudyText("a".repeat(MAX_STUDY_TEXT_LENGTH)).valid).toBe(true);
    expect(validateStudyText("a".repeat(MAX_STUDY_TEXT_LENGTH + 1)).valid).toBe(false);
  });
});

describe("generateFlashcards request (SCRUM-122)", () => {
  it("rejects invalid study text without calling the backend", async () => {
    const fetchMock = mockFetchResponse({ body: { flashcards: [] } });

    await expect(generateFlashcards("   ")).rejects.toThrow(/paste some study notes/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs the trimmed notes to the agreed endpoint", async () => {
    const fetchMock = mockFetchResponse({ body: { flashcards: [] } });

    await generateFlashcards("  Encapsulation hides state.  ");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(GENERATE_ENDPOINT);
    expect(url).toBe("/api/ai/flashcards");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "Content-Type": "application/json" });
    expect(options.credentials).toBe("same-origin");
    expect(JSON.parse(options.body)).toEqual({ notes: "Encapsulation hides state." });
  });
});

describe("generateFlashcards response (SCRUM-122)", () => {
  it("returns the structured flashcards on success", async () => {
    const flashcards = [
      { front: "What is encapsulation?", back: "Restricting direct access to internal state." },
    ];
    mockFetchResponse({ body: { flashcards } });

    const result = await generateFlashcards("Encapsulation hides state.");

    expect(result).toEqual({ flashcards, isStub: false });
  });

  it("accepts an empty flashcards array (zero-card handling is SCRUM-123)", async () => {
    mockFetchResponse({ body: { flashcards: [] } });

    await expect(generateFlashcards("Some notes.")).resolves.toEqual({
      flashcards: [],
      isStub: false,
    });
  });

  it("does not validate individual cards (SCRUM-123), only the array shape", async () => {
    const flashcards = [{ front: "", back: null }];
    mockFetchResponse({ body: { flashcards } });

    const result = await generateFlashcards("Some notes.");

    expect(result.flashcards).toBe(flashcards);
  });
});

describe("generateFlashcards error handling (SCRUM-122)", () => {
  it("surfaces the backend's error message on a non-2xx response", async () => {
    mockFetchResponse({ ok: false, status: 500, body: { error: "Flashcard generation failed." } });

    await expect(generateFlashcards("Some notes.")).rejects.toThrow(
      "Flashcard generation failed."
    );
  });

  it("uses a specific backend message when one is provided", async () => {
    mockFetchResponse({ ok: false, status: 401, body: { error: "Authentication required." } });

    await expect(generateFlashcards("Some notes.")).rejects.toThrow(
      "Authentication required."
    );
  });

  it("falls back to the generic error when a non-2xx body has no error field", async () => {
    mockFetchResponse({ ok: false, status: 502, body: {} });

    await expect(generateFlashcards("Some notes.")).rejects.toThrow(GENERIC_ERROR);
  });

  it("falls back to the generic error when a non-2xx body is not JSON", async () => {
    mockFetchResponse({ ok: false, status: 502, jsonError: true });

    await expect(generateFlashcards("Some notes.")).rejects.toThrow(GENERIC_ERROR);
  });

  it("rejects with the generic error when the network request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(generateFlashcards("Some notes.")).rejects.toThrow(GENERIC_ERROR);
  });

  it("rejects when a 200 response is not valid JSON", async () => {
    mockFetchResponse({ jsonError: true });

    await expect(generateFlashcards("Some notes.")).rejects.toThrow(GENERIC_ERROR);
  });

  it("rejects when the response has no flashcards array", async () => {
    mockFetchResponse({ body: { response: "plain text from /generate" } });

    await expect(generateFlashcards("Some notes.")).rejects.toThrow(GENERIC_ERROR);
  });

  it("rejects when flashcards is not an array", async () => {
    mockFetchResponse({ body: { flashcards: "not an array" } });

    await expect(generateFlashcards("Some notes.")).rejects.toThrow(GENERIC_ERROR);
  });

  it("rejects when the response body is null", async () => {
    mockFetchResponse({ body: null });

    await expect(generateFlashcards("Some notes.")).rejects.toThrow(GENERIC_ERROR);
  });
});