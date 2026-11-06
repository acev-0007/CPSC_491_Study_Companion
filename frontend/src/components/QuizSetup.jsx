import { useEffect, useRef, useState } from "react";

import { getAiReadyDocumentContent, listDocuments } from "../api/documents";
import {
  generateQuiz,
  MAX_STUDY_TEXT_LENGTH,
} from "../services/quizGeneration";

// SCRUM-125: quiz setup screen. The student either pastes study material or
// picks a processed Document Hub file, whose text is loaded into the same box,
// then presses Create Quiz. onQuizReady(questions) is called only with a fully
// validated quiz; failures stay on this screen with an error message.

function QuizSetup({ onQuizReady }) {
  const [documents, setDocuments] = useState([]);
  const [documentId, setDocumentId] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Synchronous guard: state updates are async, so a fast double-click could
  // otherwise send two requests.
  const inFlightRef = useRef(false);
  // Ignores results that arrive after the document changed or the screen closed.
  const loadIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    listDocuments()
      .then((all) => {
        if (isMountedRef.current) {
          setDocuments(all.filter((doc) => doc.status === "ready"));
        }
      })
      .catch(() => {
        // Not fatal: the student can still paste notes.
      });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function handleDocumentChange(event) {
    const id = event.target.value;
    const loadId = ++loadIdRef.current;

    setDocumentId(id);
    setError("");
    setNotice("");

    if (!id) return;

    setIsLoadingDocument(true);

    try {
      const content = await getAiReadyDocumentContent(id);
      if (loadId !== loadIdRef.current) return;

      const text = (content.text ?? "").trim();
      if (!text) throw new Error("The selected document has no readable text.");

      // The AI endpoint accepts 20,000 characters, so long documents are cut.
      if (text.length > MAX_STUDY_TEXT_LENGTH) {
        setNotes(text.slice(0, MAX_STUDY_TEXT_LENGTH));
        setNotice(
          `Long document: the quiz will use the first ${MAX_STUDY_TEXT_LENGTH.toLocaleString("en-US")} characters.`
        );
      } else {
        setNotes(text);
      }
    } catch (err) {
      if (loadId !== loadIdRef.current) return;
      setError(err.message || "Unable to load document.");
    } finally {
      if (loadId === loadIdRef.current) setIsLoadingDocument(false);
    }
  }

  async function handleCreateQuiz() {
    if (inFlightRef.current || isLoadingDocument) return;

    inFlightRef.current = true;
    setIsGenerating(true);
    setError("");

    try {
      const questions = await generateQuiz(notes);
      if (!isMountedRef.current) return;
      onQuizReady(questions);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err.message);
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) setIsGenerating(false);
    }
  }

  return (
    <section className="quiz-page" aria-labelledby="quiz-setup-title">
      <header>
        <h1 id="quiz-setup-title" className="quiz-setup-title">
          Create a quiz
        </h1>
        <p className="quiz-setup-intro">
          Paste study material or choose a document from your Document Hub. You
          will get five multiple-choice questions.
        </p>
      </header>

      <div className="quiz-setup-field">
        <label htmlFor="quiz-document">Document Hub file (optional)</label>
        <select
          id="quiz-document"
          value={documentId}
          onChange={handleDocumentChange}
          disabled={isGenerating}
        >
          <option value="">None: I will paste notes</option>
          {documents.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.name}
            </option>
          ))}
        </select>
        {isLoadingDocument && (
          <p role="status" className="quiz-setup-hint">
            Loading document...
          </p>
        )}
      </div>

      <div className="quiz-setup-field">
        <label htmlFor="quiz-notes">Study material</label>
        <textarea
          id="quiz-notes"
          rows={10}
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            setNotice("");
          }}
          disabled={isGenerating}
          placeholder="Paste notes or a topic's key points here"
        />
        {notice && <p className="quiz-setup-hint">{notice}</p>}
      </div>

      {error && (
        <p role="alert" className="quiz-setup-error">
          {error}
        </p>
      )}

      <div>
        <button
          type="button"
          className="quiz-nav-button quiz-nav-button--primary"
          onClick={handleCreateQuiz}
          disabled={isGenerating || isLoadingDocument || !notes.trim()}
        >
          {isGenerating ? "Creating quiz..." : "Create Quiz"}
        </button>
      </div>
    </section>
  );
}

export default QuizSetup;