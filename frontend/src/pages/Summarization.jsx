import { useState } from "react";
import "./Summarization.css";

function Summarization() {
  const [studyMaterial, setStudyMaterial] = useState("");

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
          onChange={(event) => setStudyMaterial(event.target.value)}
          placeholder="Paste your notes or study material here..."
          rows={12}
        />

        <button
          className="summarization-button"
          type="button"
        >
          Generate Summary
        </button>
      </div>
    </div>
  );
}

export default Summarization;
