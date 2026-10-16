
import { useState } from "react";
import "./Summarization.css";

function Summarization() {
  const [studyMaterial, setStudyMaterial] = useState("");
  const [validationError, setValidationError] = useState("");
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState("");

  // SCRUM-231: Summary persistence state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  // Generate a summary using Claude
  const handleGenerateSummary = async () => {
    if (!studyMaterial.trim()) {
      setValidationError(
        "Please enter study material before generating a summary."
      );
      return;
    }

    setValidationError("");
    setRequestError("");
    setSummary("");
    setIsSaved(false);
    setSaveError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes: studyMaterial.trim(),
        }),
      });

      const contentType = response.headers.get("content-type");

      let data = {};

      if (contentType?.includes("application/json")) {
        data = await response.json();
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to generate summary. Please try again."
        );
      }

      if (
        typeof data.summary !== "string" ||
        !data.summary.trim()
      ) {
        throw new Error("No valid summary was generated.");
      }

      setSummary(data.summary);
    } catch (error) {
      console.error("Summarization request failed:", error);

      setRequestError(
        error.message ||
        "Unable to generate summary. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // SCRUM-231: Save generated summary to Supabase
  const handleSaveSummary = async () => {
    if (!summary || isSaving || isSaved || isLoading) return;

    setIsSaving(true);
    setSaveError("");

    try {
      const response = await fetch("/api/summaries", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceText: studyMaterial.trim(),
          summary: summary.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to save summary."
        );
      }

      setIsSaved(true);
    } catch (error) {
      console.error("Summary save failed:", error);

      setSaveError(
        error.message || "Unable to save summary."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="summarization-page">
      <h1>Summarization</h1>

      <p className="summarization-description">
        Enter your study material below to generate a summary.
      </p>

      <div className="summarization-form">
        <textarea
          className="summarization-input"
          value={studyMaterial}
          onChange={(event) => {
            setStudyMaterial(event.target.value);

            // Clear the previous summary when notes change.
            setSummary("");
            setIsSaved(false);
            setSaveError("");
            setValidationError("");
            setRequestError("");
          }}
          placeholder="Paste your notes or study material here..."
          rows={12}
          disabled={isLoading || isSaving}
        />

        {validationError && (
          <p className="summarization-validation-error" role="alert">
            {validationError}
          </p>
        )}

        {requestError && (
          <p className="summarization-request-error" role="alert">
            {requestError}
          </p>
        )}

        <button
          className="summarization-button"
          type="button"
          onClick={handleGenerateSummary}
          disabled={isLoading || isSaving}
        >
          {isLoading
            ? "Generating Summary..."
            : "Generate Summary"}
        </button>

        {isLoading && (
          <p className="summarization-loading">
            Generating your summary...
          </p>
        )}

        {summary && (
          <div className="summarization-result">
            <h2>Generated Summary</h2>
            <p>{summary}</p>

            {/* SCRUM-231: Save Summary button */}
            <button
              type="button"
              className="summarization-button"
              onClick={handleSaveSummary}
              disabled={isSaving || isSaved || isLoading}
            >
              {isSaving
                ? "Saving..."
                : isSaved
                  ? "Summary Saved"
                  : "Save Summary"}
            </button>

            {isSaved && (
              <p role="status">
                Your summary was saved successfully.
              </p>
            )}

            {saveError && (
              <p
                role="alert"
                className="summarization-request-error"
              >
                {saveError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Summarization;
