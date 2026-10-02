import { useCallback, useEffect, useState } from "react";
import DocumentCard from "../components/textbookHub/DocumentCard";
import DocumentUploadForm from "../components/textbookHub/DocumentUploadForm";
import { listDocuments, uploadDocument, updateDocument, deleteDocument} from "../api/documents";
import "./TextbookHub.css";
import DocumentDetailModal from "../components/textbookHub/DocumentDetailModal";

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
  const [selectedDocument, setSelectedDocument] = useState(null);



  const [categoryFilter, setCategoryFilter] = useState("All");
  const [courseFilter, setCourseFilter] = useState("All");

  const courseOptions = [
  ...new Set(
    documents
      .map((document) => document.course)
      .filter(Boolean)),].sort();

  const filteredDocuments = documents.filter((document) => {
  const matchesCategory =
    categoryFilter === "All" ||
    document.category === categoryFilter;

  const matchesCourse =
    courseFilter === "All" ||
    document.course === courseFilter;

  return matchesCategory && matchesCourse;});





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

  async function handleDeleteDocument(id) {
    setError("");

    try {
      await deleteDocument(id);

      setDocuments((current) =>
        current.filter((document) => document.id !== id)
      );

      setSelectedDocument(null);

      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleUpdateDocument(id, updates) {
    setError("");

    try {
      const updated = await updateDocument(id, updates);

      setDocuments((current) =>
        current.map((document) =>
          document.id === updated.id ? updated : document
        )
      );

      setSelectedDocument(updated);

      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
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
        <h2>Your documents --- (select a card to edit or delete)</h2>
        <button className="hub-secondary-button" type="button" onClick={loadDocuments}>
          Refresh
        </button>
      </div>




      <div className="hub-filters">
        <label>
          Category
          <select
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(event.target.value)
            }
          >
            <option value="All">All categories</option>

            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label>
          Course
          <select
            value={courseFilter}
            onChange={(event) =>
              setCourseFilter(event.target.value)
            }
          >
            <option value="All">All courses</option>

            {courseOptions.map((course) => (
              <option key={course} value={course}>
                {course}
              </option>
            ))}
          </select>
        </label>
      </div>





      {loading ? (
        <p className="hub-state" role="status">
          Loading documents...
        </p>
      ) : documents.length === 0 ? (
        <div className="hub-empty-state">
          <h3>No documents yet</h3>
          <p>
            Upload a TXT or PDF file to start building your study library.
          </p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="hub-empty-state">
          <h3>No matching documents</h3>
          <p>
            Try changing the selected category or course.
          </p>
        </div>
      ) : (
        <div className="document-grid">
          {filteredDocuments.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              onOpen={() => setSelectedDocument(document)}
            />
          ))}
        </div>
      )}

      {selectedDocument && (<DocumentDetailModal
        document={selectedDocument}
        categories={CATEGORIES}
        onSave={handleUpdateDocument}
        onDelete={handleDeleteDocument}
        onClose={() => setSelectedDocument(null)}
        />)}
    </section>
    
  )

}

export default TextbookHub;
