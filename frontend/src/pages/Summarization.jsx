import { useState } from "react";
import "./Summarization.css";

function Summarization() {
  const [studyMaterial, setStudyMaterial] = useState("");
  const [validationError, setValidationError] = useState("");
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState("");

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
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes: studyMaterial,
        }),
      });

      const contentType = response.headers.get("content-type");

      let data = {};

      if (contentType?.includes("application/json")) {
        data = await response.json();
      }

      if (!response.ok) {
        console.error(
          `Summarization request failed with status ${response.status}`
        );

        throw new Error(
          data.error || "Unable to generate summary. Please try again."
        );
      }

      setSummary(data.summary);
    } catch (error) {
      console.error("Summarization request failed:", error);

      setRequestError(
        error.message || "Unable to generate summary. Please try again."
      );
    } finally {
      setIsLoading(false);
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

            if (validationError) {
              setValidationError("");
            }

            if (requestError) {
              setRequestError("");
            }
          }}
          placeholder="Paste your notes or study material here..."
          rows={12}
          disabled={isLoading}
        />

        {validationError && (
          <p className="summarization-validation-error">
            {validationError}
          </p>
        )}

        {requestError && (
          <p className="summarization-request-error">
            {requestError}
          </p>
        )}

        <button
          className="summarization-button"
          type="button"
          onClick={handleGenerateSummary}
          disabled={isLoading}
        >
          {isLoading ? "Generating Summary..." : "Generate Summary"}
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
          </div>
        )}
      </div>
    </div>
  );
}

export default Summarization;
