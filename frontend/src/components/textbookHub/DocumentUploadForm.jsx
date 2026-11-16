import { useRef, useState } from "react";
import { isSupportedDocument } from "./documentUtils";

function DocumentUploadForm({
  onUpload,
  uploading,
  category,
  setCategory,
  categories,
  course,
  setCourse,
}) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [validationError, setValidationError] = useState("");
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  function handleFileChange(event) {
    const selected = event.target.files?.[0] ?? null;
    setValidationError("");
    
    if (selected && selected.size > MAX_FILE_SIZE) {
      setFile(null);
      setValidationError("File is too large. Maximum upload size is 10 MB.");

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }

    if (selected && !isSupportedDocument(selected)) {
      setFile(null);
      setValidationError("Only TXT, PDF, and DOCX files are supported.");
      return;
    }

    setFile(selected);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!file) {
      setValidationError("Choose a TXT, PDF, or DOCX file first.");
      return;
    }

    const success = await onUpload(file);

    if (success) {
      setFile(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <form className="hub-upload" onSubmit={handleSubmit}>
      <div>
        <label className="hub-label" htmlFor="study-document">
          Add a study document
        </label>

        <p className="hub-help">
          TXT, DOCX, and digital-text PDF files, up to 10 MB.
        </p>
      </div>

      <div className="hub-upload-controls">
        <input
          ref={inputRef}
          id="study-document"
          name="study-document"
          type="file"
          accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileChange}
          disabled={uploading}
        />

        <label className="hub-label" htmlFor="document-category">
          Category
        </label>

        <select
          id="document-category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          disabled={uploading}
        >
          {categories.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <label className="hub-label" htmlFor="document-course">
          Course
        </label>

        <input
          id="document-course"
          type="text"
          value={course}
          onChange={(event) => setCourse(event.target.value)}
          placeholder="e.g. CPSC 491"
          disabled={uploading}
        />

        <button
          className="hub-primary-button"
          type="submit"
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>

      {file && (
        <p className="hub-selected-file">
          Selected: {file.name}
        </p>
      )}

      {validationError && (
        <p className="hub-message hub-message-error" role="alert">
          {validationError}
        </p>
      )}
    </form>
  );
}

export default DocumentUploadForm;