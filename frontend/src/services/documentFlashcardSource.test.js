import { describe, expect, it } from "vitest";

import { MAX_STUDY_TEXT_LENGTH } from "./flashcardGeneration";
import {
  DOCUMENT_ERRORS,
  documentErrorMessage,
  isReadyDocument,
  prepareDocumentText,
} from "./documentFlashcardSource";

describe("isReadyDocument", () => {
  it("accepts only ready documents", () => {
    expect(isReadyDocument({ status: "ready" })).toBe(true);
    expect(isReadyDocument({ status: "processing" })).toBe(false);
    expect(isReadyDocument({ status: "failed" })).toBe(false);
    expect(isReadyDocument(null)).toBe(false);
  });
});

describe("documentErrorMessage", () => {
  it.each([
    [401, DOCUMENT_ERRORS.signIn],
    [403, DOCUMENT_ERRORS.denied],
    [404, DOCUMENT_ERRORS.notFound],
    [409, DOCUMENT_ERRORS.notReady],
    [422, DOCUMENT_ERRORS.unreadable],
    [500, DOCUMENT_ERRORS.generic],
    [undefined, DOCUMENT_ERRORS.network],
  ])("maps status %s to a safe message", (status, expected) => {
    expect(documentErrorMessage({ status })).toBe(expected);
  });

  it("never exposes the raw server message", () => {
    expect(documentErrorMessage({ status: 500, message: "SELECT * leaked" })).not.toMatch(/SELECT/);
  });
});

describe("prepareDocumentText", () => {
  it("returns trimmed validated text for a ready document", () => {
    expect(prepareDocumentText({ status: "ready", text: "  Mitosis  " })).toEqual({
      valid: true,
      text: "Mitosis",
      error: null,
    });
  });

  it("rejects non-ready or missing content", () => {
    expect(prepareDocumentText({ status: "processing", text: "x" }).error).toBe(DOCUMENT_ERRORS.notReady);
    expect(prepareDocumentText(null).valid).toBe(false);
  });

  it.each([null, undefined, "", "   \n "])("rejects empty text %j", (text) => {
    const result = prepareDocumentText({ status: "ready", text });
    expect(result.valid).toBe(false);
    expect(result.error).toBe(DOCUMENT_ERRORS.empty);
  });

  it("rejects over-limit text explicitly instead of truncating", () => {
    const result = prepareDocumentText({
      status: "ready",
      text: "a".repeat(MAX_STUDY_TEXT_LENGTH + 1),
    });
    expect(result.valid).toBe(false);
    expect(result.text).toBe("");
    expect(result.error).toMatch(/too long.*20,001.*20,000.*not truncated/);
  });

  it("accepts text exactly at the limit", () => {
    const text = "a".repeat(MAX_STUDY_TEXT_LENGTH);
    expect(prepareDocumentText({ status: "ready", text }).valid).toBe(true);
  });
});