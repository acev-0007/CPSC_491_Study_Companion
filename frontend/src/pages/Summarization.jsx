import { useState } from "react";
import "./Summarization.css";

function Summarization() {
  const [studyMaterial, setStudyMaterial] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleGenerateSummary = async () => {
    if (!studyMaterial.trim()) {
      setValidationError(
        "Please enter study material before generating a summary."
      );
      return;
    }

    setValidationError("");

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to generate summary."
        );
      }

      console.log("Generated summary:", data.summary);
    } catch (error) {
      console.error(
        "Summarization request failed:",
        error
      );
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
          }}
          placeholder="Paste your notes or study material here..."
          rows={12}
        />

        {validationError && (
          <p className="summarization-validation-error">
            {validationError}
          </p>
        )}

        <button
          className="summarization-button"
          type="button"
          onClick={handleGenerateSummary}
        >
          Generate Summary
        </button>
      </div>
    </div>
  );
}

export default Summarization;
