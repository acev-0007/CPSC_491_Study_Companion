import { useState } from "react";

import {
  MAX_STUDY_TEXT_LENGTH,
  validateStudyText,
} from "../services/flashcardGeneration";
import "./StudyMaterialInput.css";

/**
 * Study material entry for flashcard generation (SCRUM-121).
 *
 * Two input paths are shown, one is implemented:
 *   - Paste notes: enabled. Validated, then handed to onGenerate(studyText).
 *   - Document Hub: visible but disabled placeholder. It will later supply
 *     extracted text to the same onGenerate() function, so no second
 *     generation pipeline or upload system is needed.
 *
 * `onGenerate` is an async function (studyText) => Promise. This component
 * owns only input state (text, loading, error); what happens with the
 * result belongs to the parent.
 */
function StudyMaterialInput({ onGenerate }) {
  const [text, setText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(event) {
    setText(event.target.value);
    if (error) setError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isGenerating) return;

    const check = validateStudyText(text);
    if (!check.valid) {
      setError(check.error);
      return;
    }

    setError(null);
    setIsGenerating(true);
    try {
      await onGenerate(check.text);
    } catch {
      setError("Could not generate flashcards. Please try again.");
    } finally {
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
            disabled={isGenerating}
          >
            {isGenerating ? "Generating..." : "Generate Flashcards"}
          </button>
        </div>

        {error && (
          <p id="study-notes-error" role="alert" className="study-input-error">
            {error}
          </p>
        )}
      </form>

      <fieldset className="study-input-coming-soon" disabled>
        <legend>Select from Document Hub — Coming Soon</legend>
        <p>
          Select a document from your Document Hub to generate flashcards. This
          feature will be available after integration.
        </p>
        <button type="button" disabled>
          Choose a document
        </button>
      </fieldset>
    </div>
  );
}

export default StudyMaterialInput;