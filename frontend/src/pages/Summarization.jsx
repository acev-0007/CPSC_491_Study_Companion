import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getAiReadyDocumentContent } from "../api/documents";
import "./Summarization.css";


function Summarization() {
  const [studyMaterial, setStudyMaterial] = useState("");
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("documentId");
  const [documentLoad, setDocumentLoad] = useState(null);
  const isLoadingDocument = Boolean(documentId) &&documentLoad?.id !== documentId;
  const documentError = documentLoad?.id === documentId ? documentLoad.error || "" : "";
  const documentName = documentLoad?.id === documentId ? documentLoad.name || "" : "";
  const [validationError, setValidationError] = useState("");
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState("");

  // SCRUM-231: Summary persistence state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isSaved, setIsSaved] = useState(false);



  // SCRUM-230: Load document content from Document Hub
  useEffect(() => {
    if (!documentId) return;

    let active = true;

    getAiReadyDocumentContent(documentId)
      .then((content) => {
        if (!active) return;

        if (!content.text?.trim()) {
          throw new Error(
            "The selected document has no readable text."
          );
        }

        setStudyMaterial(content.text);
        setDocumentLoad({
          id: documentId,
          name: content.name || "Uploaded document",
          error: "",
        });

        setSummary("");
        setIsSaved(false);
        setSaveError("");
        setValidationError("");
        setRequestError("");
      })
      .catch((error) => {
        if (!active) return;

        setStudyMaterial("");
        setDocumentLoad({
          id: documentId,
          name: "",
          error: error.message || "Unable to load document.",
        });
      });

    return () => {
      active = false;
    };
  }, [documentId]);


  // Generate a summary using Claude
  const handleGenerateSummary = async () => {
    if (isLoadingDocument || documentError) return;

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

        {isLoadingDocument && (
          <p role="status" className="summarization-loading">
            Loading uploaded document...
          </p>
        )}

        {documentName && (
          <p role="status">
            Loaded document: {documentName}
          </p>
        )}

        {documentError && (
          <p
            role="alert"
            className="summarization-request-error"
          >
            {documentError}
          </p>
        )}

        <textarea
          className="summarization-input"
          value={isLoadingDocument ? "" : studyMaterial}
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
          disabled={isLoading || isSaving || isLoadingDocument}
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
          disabled={isLoading || isSaving || isLoadingDocument}
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
