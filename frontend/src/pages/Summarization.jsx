import { useState } from "react";
import "./Summarization.css";

function Summarization() {
  const [studyMaterial, setStudyMaterial] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleGenerateSummary = () => {
    if (!studyMaterial.trim()) {
      setValidationError("Please enter study material before generating a summary.");
      return;
    }

    setValidationError("");

    // Backend request will be added in SCRUM-85.
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
