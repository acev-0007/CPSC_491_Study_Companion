import { describe, it, expect, vi, afterEach } from "vitest";

import {
  MAX_STUDY_TEXT_LENGTH,
  STUB_DELAY_MS,
  generateFlashcards,
  validateStudyText,
} from "./flashcardGeneration";

afterEach(() => {
  vi.useRealTimers();
});

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

describe("generateFlashcards (SCRUM-121 stub)", () => {
  it("rejects invalid study text without waiting on the stub", async () => {
    await expect(generateFlashcards("   ")).rejects.toThrow(/paste some study notes/i);
  });

  it("resolves with the response-contract shape and flags itself as a stub", async () => {
    vi.useFakeTimers();
    const pending = generateFlashcards("Encapsulation hides state.");

    await vi.advanceTimersByTimeAsync(STUB_DELAY_MS);

    await expect(pending).resolves.toEqual({ flashcards: [], isStub: true });
  });
});