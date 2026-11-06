// FLASH-11: helpers for generating flashcards from Document Hub files.
//
// Pure functions only (no fetch, no React). The retrieved text is always run
// through validateStudyText, the same check used for pasted notes, so no
// second validation pipeline exists. Text is never truncated and never logged.

import {
  MAX_STUDY_TEXT_LENGTH,
  validateStudyText,
} from "./flashcardGeneration";

export const READY_STATUS = "ready";

export const DOCUMENT_ERRORS = {
  signIn: "Please sign in again to use your documents.",
  denied: "You do not have access to this document.",
  notFound: "This document could not be found. Refresh your document list.",
  notReady: "This document is still being processed. Try again shortly.",
  unreadable: "Text could not be extracted from this document.",
  network: "Could not reach the server. Check your connection and try again.",
  generic: "Could not load this document. Please try again.",
  empty: "This document has no extracted text to generate flashcards from.",
};

export function isReadyDocument(document) {
  return Boolean(document) && document.status === READY_STATUS;
}

/** Maps a failed document request to a safe, user-facing message. */
export function documentErrorMessage(error) {
  switch (error?.status) {
    case 401:
      return DOCUMENT_ERRORS.signIn;
    case 403:
      return DOCUMENT_ERRORS.denied;
    case 404:
      return DOCUMENT_ERRORS.notFound;
    case 409:
      return DOCUMENT_ERRORS.notReady;
    case 422:
      return DOCUMENT_ERRORS.unreadable;
    case undefined:
      return DOCUMENT_ERRORS.network;
    default:
      return DOCUMENT_ERRORS.generic;
  }
}

/**
 * Validates an ai-content response before generation.
 * Returns { valid, text, error }. On success `text` is exactly what
 * validateStudyText approved, which is what onGenerate must receive.
 */
export function prepareDocumentText(content) {
  if (!content || content.status !== READY_STATUS) {
    return { valid: false, text: "", error: DOCUMENT_ERRORS.notReady };
  }

  if (typeof content.text !== "string" || content.text.trim() === "") {
    return { valid: false, text: "", error: DOCUMENT_ERRORS.empty };
  }

  const check = validateStudyText(content.text);

  if (!check.valid) {
    return {
      valid: false,
      text: "",
      error:
        `This document is too long (${check.text.length.toLocaleString("en-US")} characters). ` +
        `The limit is ${MAX_STUDY_TEXT_LENGTH.toLocaleString("en-US")} characters, ` +
        "and documents are not truncated. Choose a shorter document.",
    };
  }

  return { valid: true, text: check.text, error: null };
}