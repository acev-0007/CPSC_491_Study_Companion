import { useCallback, useEffect, useState } from "react";
import DocumentCard from "../components/textbookHub/DocumentCard";
import DocumentUploadForm from "../components/textbookHub/DocumentUploadForm";
import { listDocuments, uploadDocument } from "../api/documents";
import "./TextbookHub.css";


const CATEGORIES = [
  "Textbook",
  "Lecture Notes",
  "Study Guide",
  "Assignment",
  "Reference",
  "Other",
];
function TextbookHub() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("Other");
  const [course, setCourse] = useState("");

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDocuments(await listDocuments());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function handleUpload(file) {
    setUploading(true);
    setError("");

    try {
      const created = await uploadDocument(file, category, course);
      setDocuments((current) => [created, ...current]);
      setCategory("Other");
      setCourse("");
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="textbook-hub">
      <header className="hub-page-header">
        <div>
          <p className="hub-eyebrow">Study materials</p>
          <h2>Textbook Hub</h2>
          <p className="hub-intro">
            Upload your TXT and PDF study documents so they can be organized here and
            read by AI study features later.
          </p>
        </div>
      </header>

      <DocumentUploadForm onUpload={handleUpload} uploading={uploading} category={category} setCategory={setCategory} categories={CATEGORIES} course={course} setCourse={setCourse}/>

      {error && (
        <p className="hub-message hub-message-error" role="alert">
          {error}
        </p>
      )}

      <div className="hub-library-heading">
        <h2>Your documents</h2>
        <button className="hub-secondary-button" type="button" onClick={loadDocuments}>
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="hub-state" role="status">Loading documents...</p>
      ) : documents.length === 0 ? (
        <div className="hub-empty-state">
          <h3>No documents yet</h3>
          <p>Upload a TXT or PDF file to start building your study library.</p>
        </div>
      ) : (
        <div className="document-grid">
          {documents.map((document) => (
            <DocumentCard key={document.id} document={document} />
          ))}
        </div>
      )}
    </section>
  );
}

export default TextbookHub;
