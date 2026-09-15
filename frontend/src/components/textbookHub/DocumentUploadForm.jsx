import { useRef, useState } from "react";

const ALLOWED_EXTENSIONS = [".txt", ".pdf"];
const ALLOWED_MIME_TYPES = ["text/plain", "application/pdf"];

export function isSupportedDocument(file) {
  const lowerName = file.name.toLowerCase();
  const validExtension = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const validMime = !file.type || ALLOWED_MIME_TYPES.includes(file.type);
  return validExtension && validMime;
}

function DocumentUploadForm({ onUpload, uploading }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [validationError, setValidationError] = useState("");

  function handleFileChange(event) {
    const selected = event.target.files?.[0] ?? null;
    setValidationError("");

    if (selected && !isSupportedDocument(selected)) {
      setFile(null);
      setValidationError("Only TXT and PDF files are supported.");
      return;
    }

    setFile(selected);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      setValidationError("Choose a TXT or PDF file first.");
      return;
    }

    const success = await onUpload(file);
    if (success) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <form className="hub-upload" onSubmit={handleSubmit}>
      <div>
        <label className="hub-label" htmlFor="study-document">
          Add a study document
        </label>
        <p className="hub-help">TXT and digital-text PDF files, up to 10 MB.</p>
      </div>

      <div className="hub-upload-controls">
        <input
          ref={inputRef}
          id="study-document"
          name="study-document"
          type="file"
          accept=".txt,.pdf,text/plain,application/pdf"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <button className="hub-primary-button" type="submit" disabled={uploading}>
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>

      {file && <p className="hub-selected-file">Selected: {file.name}</p>}
      {validationError && (
        <p className="hub-message hub-message-error" role="alert">
          {validationError}
        </p>
      )}
    </form>
  );
}

export default DocumentUploadForm;
