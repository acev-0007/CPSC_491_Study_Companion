import { useEffect, useRef, useState } from "react";

import { getDocumentAiContent, listDocuments } from "../api/documents";
import {
  DOCUMENT_ERRORS,
  documentErrorMessage,
  isReadyDocument,
  prepareDocumentText,
} from "../services/documentFlashcardSource";
import {
  MAX_STUDY_TEXT_LENGTH,
  validateStudyText,
} from "../services/flashcardGeneration";
import "./StudyMaterialInput.css";

/**
 * Study material entry for flashcard generation (SCRUM-121).
 *
 * Two input paths feed the same onGenerate() callback:
 *   - Paste notes: validated, then handed to onGenerate(studyText).
 *   - Document Hub (FLASH-11): the student loads their documents, picks a
 *     ready one, and its AI-ready text is fetched, validated with the same
 *     validateStudyText check, then handed to onGenerate(). No second
 *     generation pipeline or upload system exists.
 *
 * A single busy guard (busyRef) covers both paths so repeated clicks cannot
 * start duplicate work. Request ids and an AbortController make sure a late
 * response for a superseded selection (or an unmounted view) is ignored.
 *
 * `onGenerate` is an async function (studyText) => Promise. This component
 * owns only input state (text, loading, error); what happens with the
 * result belongs to the parent.
 */
function StudyMaterialInput({ onGenerate, initialDocumentId = null,}) {
  const [text, setText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Document Hub path state. Kept separate from the pasted text.
  const [documents, setDocuments] = useState([]);
  const [listStatus, setListStatus] = useState("idle"); // idle|loading|loaded|error
  const [listError, setListError] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [isFetchingDoc, setIsFetchingDoc] = useState(false);
  const [activePath, setActivePath] = useState(null); // "paste" | "document"
  const [docError, setDocError] = useState(null);

  // Refs update synchronously, so they block repeated clicks that state
  // (which updates on the next render) cannot.
  const busyRef = useRef(false);
  const fetchingDocRef = useRef(false);
  const fetchIdRef = useRef(0);
  const listIdRef = useRef(0);
  const abortRef = useRef(null);

  // Abandon any in-flight work when the input leaves the screen.
  useEffect(() => {
    return () => {
      fetchIdRef.current += 1;
      listIdRef.current += 1;
      abortRef.current?.abort();
    };
  }, []);

  // Load document if passed
    useEffect(() => {
    if (!initialDocumentId) return;

    handleLoadDocuments();
  }, [initialDocumentId]);

  // Selects handoff doc
    useEffect(() => {
      if (
        !initialDocumentId ||
        listStatus !== "loaded"
      ) {
        return;
      }

      const matchedDocument = documents.find(
        (doc) =>
          String(doc.id) === String(initialDocumentId)
      );

      if (!matchedDocument) {
        setSelectedId("");
        setDocError("Document not found.");
        return;
      }

      if (!isReadyDocument(matchedDocument)) {
        setSelectedId("");
        setDocError(DOCUMENT_ERRORS.notReady);
        return;
      }

      setSelectedId(String(matchedDocument.id));
      setDocError(null);
    }, [
      initialDocumentId,
      documents,
      listStatus,
    ]);

  const isBusy = isGenerating || isFetchingDoc;
  const readyDocuments = documents.filter(isReadyDocument);

  function handleChange(event) {
    setText(event.target.value);
    if (error) setError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busyRef.current) return;

    const check = validateStudyText(text);
    if (!check.valid) {
      setError(check.error);
      return;
    }

    busyRef.current = true;
    setError(null);
    setDocError(null);
    setActivePath("paste");
    setIsGenerating(true);
    try {
      await onGenerate(check.text);
    } catch {
      setError("Could not generate flashcards. Please try again.");
    } finally {
      busyRef.current = false;
      setIsGenerating(false);
    }
  }

  async function handleLoadDocuments() {
    if (listStatus === "loading") return;

    const requestId = ++listIdRef.current;
    setListStatus("loading");
    setListError(null);

    try {
      const loaded = await listDocuments();
      if (requestId !== listIdRef.current) return;

      const next = Array.isArray(loaded) ? loaded : [];
      setDocuments(next);
      setListStatus("loaded");
      // Drop a selection that is no longer a ready document.
      setSelectedId((current) =>
        next.some((doc) => String(doc.id) === current && isReadyDocument(doc))
          ? current
          : ""
      );
    } catch (err) {
      if (requestId !== listIdRef.current) return;
      setListError(
        err?.status === undefined || err.status === 401 || err.status === 403
          ? documentErrorMessage(err)
          : "Could not load your documents. Please try again."
      );
      setListStatus("error");
    }
  }

  function handleSelectDocument(event) {
    // Any pending document fetch belongs to the previous selection.
    fetchIdRef.current += 1;
    abortRef.current?.abort();
    if (fetchingDocRef.current) {
      fetchingDocRef.current = false;
      busyRef.current = false;
      setIsFetchingDoc(false);
    }

    setSelectedId(event.target.value);
    setDocError(null);
  }

  async function handleDocumentSubmit(event) {
    event.preventDefault();
    if (busyRef.current || selectedId === "") return;

    const selected = documents.find((doc) => String(doc.id) === selectedId);
    if (!isReadyDocument(selected)) {
      setDocError(DOCUMENT_ERRORS.notReady);
      return;
    }

    busyRef.current = true;
    fetchingDocRef.current = true;
    const requestId = ++fetchIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setDocError(null);
    setActivePath("document");
    setIsFetchingDoc(true);

    let content;
    try {
      content = await getDocumentAiContent(selected.id, {
        signal: controller.signal,
      });
    } catch (err) {
      // A superseded request must not touch current state or the guard.
      if (requestId !== fetchIdRef.current) return;
      fetchingDocRef.current = false;
      busyRef.current = false;
      setIsFetchingDoc(false);
      setDocError(documentErrorMessage(err));
      return;
    }

    if (requestId !== fetchIdRef.current) return;
    fetchingDocRef.current = false;
    setIsFetchingDoc(false);

    // The response must be for the document that was requested.
    const sameDocument =
      content?.documentId === undefined ||
      String(content.documentId) === String(selected.id);
    const prepared = sameDocument
      ? prepareDocumentText(content)
      : { valid: false, error: DOCUMENT_ERRORS.generic };

    if (!prepared.valid) {
      busyRef.current = false;
      setDocError(prepared.error);
      return;
    }

    setIsGenerating(true);
    try {
      await onGenerate(prepared.text);
    } catch {
      setDocError("Could not generate flashcards. Please try again.");
    } finally {
      busyRef.current = false;
      setIsGenerating(false);
    }
  }

  return (
    <div className="study-input">
      <h2>Generate Flashcards</h2>
      <p className="study-input-intro">
        Turn your study materials into flashcards.
      </p>

      <form onSubmit={handleSubmit} noValidate aria-busy={isGenerating} >
        <label htmlFor="study-notes-input">Paste Study Notes</label>
        <textarea
          id="study-notes-input"
          value={text}
          onChange={handleChange}
          rows={8}
          maxLength={MAX_STUDY_TEXT_LENGTH}
          placeholder="Paste your lecture notes, definitions, or textbook excerpts here..."
          disabled={isGenerating}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "study-notes-error" : undefined}
        />

        <div className="study-input-footer">
          <span className="study-input-count">
            {text.length.toLocaleString("en-US")} /{" "}
            {MAX_STUDY_TEXT_LENGTH.toLocaleString("en-US")} characters
            </span>
          <button
            type="submit"
            className="study-input-submit"
            disabled={isBusy}
          >
            {isGenerating && activePath === "paste"
              ? "Generating..."
              : "Generate Flashcards"}
          </button>
        </div>

        {error && (
          <p id="study-notes-error" role="alert" className="study-input-error">
            {error}
          </p>
        )}
      </form>

      <form
        onSubmit={handleDocumentSubmit}
        noValidate
        aria-busy={isBusy}
        className="study-input-documents"
      >
        <fieldset disabled={isGenerating}>
          <legend>Or generate from a Document Hub file</legend>

          <button
            type="button"
            className="study-input-secondary"
            onClick={handleLoadDocuments}
            disabled={listStatus === "loading" || isBusy}
          >
            {listStatus === "loading"
              ? "Loading documents..."
              : listStatus === "idle"
                ? "Load my documents"
                : "Refresh documents"}
          </button>

          {listStatus === "loading" && (
            <p role="status" className="study-input-hint">
              Loading your documents...
            </p>
          )}

          {listStatus === "error" && (
            <p role="alert" className="study-input-error">
              {listError}
            </p>
          )}

          {listStatus === "loaded" && documents.length === 0 && (
            <p role="status" className="study-input-hint">
              You have no documents yet. Upload one in the Document Hub first.
            </p>
          )}

          {listStatus === "loaded" &&
            documents.length > 0 &&
            readyDocuments.length === 0 && (
              <p role="status" className="study-input-hint">
                None of your documents are ready yet. Check back once
                processing finishes.
              </p>
            )}

          {listStatus === "loaded" && documents.length > 0 && (
            <>
              <label htmlFor="study-document-select">Document</label>
              <select
                id="study-document-select"
                value={selectedId}
                onChange={handleSelectDocument}
                aria-invalid={docError ? "true" : undefined}
                aria-describedby={docError ? "study-document-error" : undefined}
              >
                <option value="">Select a document...</option>
                {documents.map((doc) => (
                  <option
                    key={doc.id}
                    value={String(doc.id)}
                    disabled={!isReadyDocument(doc)}
                  >
                    {isReadyDocument(doc)
                      ? doc.name
                      : `${doc.name} (${doc.status ?? "not ready"})`}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="study-input-submit"
                disabled={isBusy || selectedId === ""}
              >
                {isFetchingDoc
                  ? "Loading document..."
                  : isGenerating && activePath === "document"
                    ? "Generating from document..."
                    : "Generate from Document"}
              </button>
            </>
          )}

          {docError && (
            <p
              id="study-document-error"
              role="alert"
              className="study-input-error"
            >
              {docError}
            </p>
          )}
        </fieldset>
      </form>
    </div>
  );
}

export default StudyMaterialInput;